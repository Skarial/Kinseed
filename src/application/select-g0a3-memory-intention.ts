import { DomainInvariantError } from "../domain/errors.js";
import type { Event } from "../domain/event.js";
import {
  G0A3_FUTURE_SITUATION_ID,
  G0A3_FUTURE_SITUATION_TEXT,
  G0A3_RELEVANT_EPISODE_KEY,
  selectG0A3MemoryDecision,
  validateG0A3FutureSituationEvent,
  type G0A3MemorySelection,
} from "../domain/g0a3-memory-selector.js";
import type { Intention, IntentionKind } from "../domain/intention.js";
import { buildG0A3MemoryId } from "../domain/memory.js";
import type { EntityId, Timestamp, TurnId } from "../domain/primitives.js";
import type { PersistencePort } from "../ports/persistence.js";
import { buildG0A3MemoryDecisionContext } from "./build-g0a3-memory-decision-context.js";

export interface SelectG0A3MemoryIntentionInput {
  readonly lenoseedId: EntityId;
  readonly turnId: TurnId;
  readonly humanSourceId: EntityId;
  readonly humanActorRef: EntityId;
  readonly systemSourceId: EntityId;
  readonly occurredAt: Timestamp;
  readonly engineVersion: string;
  readonly includeMemory: boolean;
}

export interface SelectG0A3MemoryIntentionResult {
  readonly situationEvent: Event;
  readonly intention: Intention;
  readonly intentionEvent: Event;
  readonly replayed: boolean;
}

export async function selectG0A3MemoryIntention(
  input: SelectG0A3MemoryIntentionInput,
  persistence: PersistencePort,
): Promise<SelectG0A3MemoryIntentionResult> {
  const turnEvents = await persistence.readEventsByTurn(input.lenoseedId, input.turnId);
  const { situationEvent: historicalSituation, intentionEvent: historicalIntention } =
    classifyTurn(input, turnEvents);

  if (historicalSituation !== null || historicalIntention !== null) {
    if (historicalSituation === null || historicalIntention === null) {
      throw new DomainInvariantError(
        `G0-A3 turn ${input.turnId} has a partial decision history and cannot be resumed`,
      );
    }
    const situationEvent = validateHistoricalSituation(input, historicalSituation);
    const intention = reconstructHistoricalIntention(input, situationEvent, historicalIntention);
    return { situationEvent, intention, intentionEvent: historicalIntention, replayed: true };
  }

  await validateSources(input, persistence);
  const situationEvent = await appendSituation(input, persistence);
  const context = await buildG0A3MemoryDecisionContext(
    {
      lenoseedId: input.lenoseedId,
      situationEvent,
      relevantEpisodeKey: G0A3_RELEVANT_EPISODE_KEY,
      includeMemory: input.includeMemory,
    },
    persistence,
  );
  const selection = selectG0A3MemoryDecision(context);
  const intention = buildIntention(input, situationEvent, selection);
  const intentionEvent = await appendIntention(input, situationEvent, intention, selection, persistence);
  return { situationEvent, intention, intentionEvent, replayed: false };
}

function classifyTurn(
  input: SelectG0A3MemoryIntentionInput,
  events: readonly Event[],
): { readonly situationEvent: Event | null; readonly intentionEvent: Event | null } {
  const situations = events.filter((event) => event.type === "human_message_received");
  const intentions = events.filter((event) => event.type === "intention_selected");
  if (
    events.length !== situations.length + intentions.length ||
    situations.length > 1 ||
    intentions.length > 1
  ) {
    throw new DomainInvariantError(`G0-A3 turn ${input.turnId} has incompatible historical events`);
  }
  return {
    situationEvent: situations[0] ?? null,
    intentionEvent: intentions[0] ?? null,
  };
}

async function validateSources(
  input: SelectG0A3MemoryIntentionInput,
  persistence: PersistencePort,
): Promise<void> {
  const [human, system] = await Promise.all([
    persistence.readSource(input.humanSourceId),
    persistence.readSource(input.systemSourceId),
  ]);
  if (
    human?.id !== input.humanSourceId ||
    human.kind !== "human" ||
    human.actorRef !== input.humanActorRef
  ) {
    throw new DomainInvariantError("G0-A3 decision requires the matching human source");
  }
  if (system?.id !== input.systemSourceId || system.kind !== "system") {
    throw new DomainInvariantError("G0-A3 decision requires a system source");
  }
}

async function appendSituation(
  input: SelectG0A3MemoryIntentionInput,
  persistence: PersistencePort,
): Promise<Event> {
  const observedStateVersion = await persistence.getStateVersion(input.lenoseedId);
  const event: Event = {
    id: `E-${input.turnId}-input`,
    lenoseedId: input.lenoseedId,
    sequence: await nextSequence(input.lenoseedId, persistence),
    type: "human_message_received",
    occurredAt: input.occurredAt,
    turnId: input.turnId,
    sourceId: input.humanSourceId,
    actorRef: input.humanActorRef,
    causedByEventIds: [],
    observedStateVersion,
    payload: situationPayload(),
    payloadSchemaVersion: 3,
    engineVersion: input.engineVersion,
    idempotencyKey: `${input.turnId}:input`,
  };
  validateG0A3FutureSituationEvent(event);
  await persistence.appendEvent(event);
  return event;
}

function validateHistoricalSituation(input: SelectG0A3MemoryIntentionInput, event: Event): Event {
  if (
    event.id !== `E-${input.turnId}-input` ||
    event.idempotencyKey !== `${input.turnId}:input` ||
    event.lenoseedId !== input.lenoseedId ||
    event.turnId !== input.turnId ||
    event.sourceId !== input.humanSourceId ||
    event.actorRef !== input.humanActorRef ||
    !sameArray(event.causedByEventIds, []) ||
    event.occurredAt !== input.occurredAt ||
    event.engineVersion !== input.engineVersion ||
    !isStateVersion(event.observedStateVersion)
  ) {
    throw new DomainInvariantError(`G0-A3 situation ${event.id} conflicts with the requested turn`);
  }
  validateG0A3FutureSituationEvent(event);
  return event;
}

function buildIntention(
  input: SelectG0A3MemoryIntentionInput,
  situationEvent: Event,
  selection: G0A3MemorySelection,
): Intention {
  return {
    id: `I-${input.turnId}`,
    lenoseedId: input.lenoseedId,
    kind: selection.selectedKind,
    target: input.humanActorRef,
    triggerEventIds: [situationEvent.id],
    triggerEvidenceItemIds: [],
    triggerBeliefIds: [],
    triggerSelfHypothesisIds: [],
    triggerMemoryIds: selection.triggerMemoryIds,
    motivation: selection.motivation,
    observedStateVersion: situationEvent.observedStateVersion,
    status: "selected",
    createdAt: situationEvent.occurredAt,
  };
}

async function appendIntention(
  input: SelectG0A3MemoryIntentionInput,
  situationEvent: Event,
  intention: Intention,
  selection: G0A3MemorySelection,
  persistence: PersistencePort,
): Promise<Event> {
  const event: Event = {
    id: `E-${input.turnId}-intention`,
    lenoseedId: input.lenoseedId,
    sequence: await nextSequence(input.lenoseedId, persistence),
    type: "intention_selected",
    occurredAt: situationEvent.occurredAt,
    turnId: input.turnId,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: [situationEvent.id],
    observedStateVersion: situationEvent.observedStateVersion,
    payload: {
      intentionId: intention.id,
      protocol: "G0-A3",
      situationId: G0A3_FUTURE_SITUATION_ID,
      kind: selection.selectedKind,
      motivation: selection.motivation,
      triggerEventIds: [situationEvent.id],
      triggerMemoryIds: [...selection.triggerMemoryIds],
    },
    payloadSchemaVersion: 3,
    engineVersion: input.engineVersion,
    idempotencyKey: `${input.turnId}:intention`,
  };
  await persistence.appendEvent(event);
  return event;
}

function reconstructHistoricalIntention(
  input: SelectG0A3MemoryIntentionInput,
  situationEvent: Event,
  event: Event,
): Intention {
  const payload = event.payload;
  if (
    event.id !== `E-${input.turnId}-intention` ||
    event.idempotencyKey !== `${input.turnId}:intention` ||
    event.lenoseedId !== input.lenoseedId ||
    event.type !== "intention_selected" ||
    event.payloadSchemaVersion !== 3 ||
    event.turnId !== input.turnId ||
    event.sourceId !== input.systemSourceId ||
    event.actorRef !== null ||
    !sameArray(event.causedByEventIds, [situationEvent.id]) ||
    event.observedStateVersion !== situationEvent.observedStateVersion ||
    event.occurredAt !== situationEvent.occurredAt ||
    event.engineVersion !== input.engineVersion ||
    !hasExactOwnKeys(payload, [
      "intentionId",
      "protocol",
      "situationId",
      "kind",
      "motivation",
      "triggerEventIds",
      "triggerMemoryIds",
    ]) ||
    payload.intentionId !== `I-${input.turnId}` ||
    payload.protocol !== "G0-A3" ||
    payload.situationId !== G0A3_FUTURE_SITUATION_ID ||
    !sameArray(payload.triggerEventIds, [situationEvent.id]) ||
    !isStringArray(payload.triggerMemoryIds)
  ) {
    throw new DomainInvariantError(`G0-A3 intention ${event.id} is incoherent`);
  }
  const kind = payload.kind;
  const motivation = payload.motivation;
  const triggerMemoryIds = payload.triggerMemoryIds;
  if (typeof kind !== "string" || typeof motivation !== "string") {
    throw new DomainInvariantError(`G0-A3 intention ${event.id} has invalid payload values`);
  }
  validateHistoricalSelection(input.lenoseedId, kind, motivation, triggerMemoryIds);
  return {
    id: payload.intentionId,
    lenoseedId: input.lenoseedId,
    kind: kind as IntentionKind,
    target: input.humanActorRef,
    triggerEventIds: [situationEvent.id],
    triggerEvidenceItemIds: [],
    triggerBeliefIds: [],
    triggerSelfHypothesisIds: [],
    triggerMemoryIds,
    motivation,
    observedStateVersion: situationEvent.observedStateVersion,
    status: "selected",
    createdAt: situationEvent.occurredAt,
  };
}

function validateHistoricalSelection(
  lenoseedId: EntityId,
  kind: string,
  motivation: string,
  triggerMemoryIds: readonly string[],
): void {
  const v1 = buildG0A3MemoryId(lenoseedId, G0A3_RELEVANT_EPISODE_KEY, 1);
  const v2 = buildG0A3MemoryId(lenoseedId, G0A3_RELEVANT_EPISODE_KEY, 2);
  const valid =
    (kind === "request_new_diagnostic" &&
      motivation === "apply_neutral_g0a3_policy_without_memory" &&
      triggerMemoryIds.length === 0) ||
    (kind === "use_configuration_b" &&
      motivation === "apply_active_g0a3_memory_avoid_reported_incompatibility" &&
      sameArray(triggerMemoryIds, [v1])) ||
    (kind === "use_configuration_a_after_checking_cable_c" &&
      motivation === "apply_active_g0a3_memory_check_corrected_cable_cause" &&
      sameArray(triggerMemoryIds, [v2]));
  if (!valid) throw new DomainInvariantError("G0-A3 historical intention has an invalid Memory selection");
}

function situationPayload() {
  return {
    text: G0A3_FUTURE_SITUATION_TEXT,
    protocol: "G0-A3",
    situationId: G0A3_FUTURE_SITUATION_ID,
    relevantEpisodeKey: G0A3_RELEVANT_EPISODE_KEY,
    availableConfigurations: ["A", "B"],
    cableCanBeChecked: true,
  };
}

async function nextSequence(lenoseedId: EntityId, persistence: PersistencePort): Promise<number> {
  const events = await persistence.readEventsInSequence(lenoseedId);
  return (events.at(-1)?.sequence ?? 0) + 1;
}

function isStateVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sameArray(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
}

function hasExactOwnKeys(value: unknown, expectedKeys: readonly string[]): boolean {
  if (typeof value !== "object" || value === null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === expectedKeys.length && keys.every((key) => typeof key === "string" && expectedKeys.includes(key));
}
