import { DomainInvariantError } from "../domain/errors.js";
import type { Event } from "../domain/event.js";
import type { Intention, IntentionKind } from "../domain/intention.js";
import {
  selectG0A2S5Intention as selectFromSnapshot,
  validateS5SituationEvent,
  type G0A2S5Selection,
} from "../domain/g0a2-s5-selector.js";
import type { EntityId, StateVersion, Timestamp, TurnId } from "../domain/primitives.js";
import { buildSelfHypothesisKey } from "../domain/self-hypothesis.js";
import type { PersistencePort } from "../ports/persistence.js";

const S5_TEXT_AXIS = "decision_style_under_uncertainty";
const INFLUENCED_MOTIVATION = "apply_active_self_hypothesis_under_uncertainty";
const NEUTRAL_MOTIVATION = "apply_neutral_g0a2_policy";
const ASK_CLARIFICATION: IntentionKind = "ask_clarification";
const USE_AVAILABLE_INFORMATION: IntentionKind =
  "respond_with_available_information_under_uncertainty";

export interface SelectG0A2S5IntentionInput {
  readonly kinseedId: EntityId;
  readonly turnId: TurnId;
  readonly humanSourceId: EntityId;
  readonly humanActorRef: EntityId;
  readonly systemSourceId: EntityId;
  readonly text: string;
  readonly occurredAt: Timestamp;
  readonly engineVersion: string;
}

export interface SelectG0A2S5IntentionResult {
  readonly situationEvent: Event;
  readonly intention: Intention;
  readonly selection: G0A2S5Selection;
  readonly stateVersion: StateVersion;
  readonly replayed: boolean;
}

export async function selectG0A2S5Intention(
  input: SelectG0A2S5IntentionInput,
  persistence: PersistencePort,
): Promise<SelectG0A2S5IntentionResult> {
  await validateSources(input, persistence);
  const turnEvents = await persistence.readEventsByTurn(input.kinseedId, input.turnId);
  const historicalInput = oneEvent(turnEvents, "human_message_received", input.turnId);
  const historicalIntention = oneEvent(turnEvents, "intention_selected", input.turnId);
  if (historicalIntention !== null && historicalInput === null) {
    throw new DomainInvariantError(`G0-A2 S5 turn ${input.turnId} has intention_selected without input`);
  }

  const situationEvent = historicalInput === null
    ? await appendSituationEvent(input, persistence)
    : validateHistoricalSituationEvent(historicalInput, input);

  if (historicalIntention !== null) {
    const reconstructed = await reconstructHistoricalDecision(
      input,
      situationEvent,
      historicalIntention,
      persistence,
    );
    return {
      situationEvent,
      ...reconstructed,
      stateVersion: situationEvent.observedStateVersion,
      replayed: true,
    };
  }

  const stateVersion = await persistence.getStateVersion(input.kinseedId);
  if (stateVersion !== situationEvent.observedStateVersion) {
    throw new DomainInvariantError(`G0-A2 S5 turn ${input.turnId} has an ambiguous durable snapshot`);
  }
  const active = await persistence.readActiveSelfHypothesisByKey(
    input.kinseedId,
    buildSelfHypothesisKey({
      subjectRef: input.kinseedId,
      predicate: S5_TEXT_AXIS,
      value: "seek_clarification",
      context: { protocol: "G0-A2" },
    }),
  );
  const selection = selectFromSnapshot({
    situationEvent,
    activeSelfHypotheses: active === null ? [] : [active],
  });
  const intention = buildIntention(input, situationEvent, selection);
  await appendIntentionEvent(input, situationEvent, intention, selection, persistence);
  return { situationEvent, intention, selection, stateVersion, replayed: false };
}

async function validateSources(
  input: SelectG0A2S5IntentionInput,
  persistence: PersistencePort,
): Promise<void> {
  const human = await persistence.readSource(input.humanSourceId);
  const system = await persistence.readSource(input.systemSourceId);
  if (human?.kind !== "human" || human.actorRef !== input.humanActorRef) {
    throw new DomainInvariantError("G0-A2 S5 requires the matching human source");
  }
  if (system?.kind !== "system") {
    throw new DomainInvariantError("G0-A2 S5 requires a system source");
  }
}

async function appendSituationEvent(
  input: SelectG0A2S5IntentionInput,
  persistence: PersistencePort,
): Promise<Event> {
  const observedStateVersion = await persistence.getStateVersion(input.kinseedId);
  const event = {
    id: `E-${input.turnId}-input`,
    kinseedId: input.kinseedId,
    sequence: await nextSequence(input.kinseedId, persistence),
    type: "human_message_received" as const,
    occurredAt: input.occurredAt,
    turnId: input.turnId,
    sourceId: input.humanSourceId,
    actorRef: input.humanActorRef,
    causedByEventIds: [],
    observedStateVersion,
    payload: situationPayload(input.text),
    payloadSchemaVersion: 2,
    engineVersion: input.engineVersion,
    idempotencyKey: `${input.turnId}:input`,
  };
  await persistence.appendEvent(event);
  return event;
}

function validateHistoricalSituationEvent(
  event: Event,
  input: SelectG0A2S5IntentionInput,
): Event {
  const expectedPayload = situationPayload(input.text);
  if (
    event.id !== `E-${input.turnId}-input` ||
    event.kinseedId !== input.kinseedId ||
    event.type !== "human_message_received" ||
    event.payloadSchemaVersion !== 2 ||
    event.turnId !== input.turnId ||
    event.sourceId !== input.humanSourceId ||
    event.actorRef !== input.humanActorRef ||
    event.occurredAt !== input.occurredAt ||
    event.idempotencyKey !== `${input.turnId}:input` ||
    event.engineVersion !== input.engineVersion ||
    event.causedByEventIds.length !== 0 ||
    !Number.isInteger(event.observedStateVersion) ||
    event.observedStateVersion < 0 ||
    !sameRecord(event.payload, expectedPayload)
  ) {
    throw new DomainInvariantError(`G0-A2 S5 input ${event.id} conflicts with the requested turn`);
  }
  validateS5SituationEvent(event);
  return event;
}

function buildIntention(
  input: SelectG0A2S5IntentionInput,
  situationEvent: Event,
  selection: G0A2S5Selection,
): Intention {
  return {
    id: `I-${input.turnId}`,
    kinseedId: input.kinseedId,
    kind: selection.selectedKind,
    target: input.humanActorRef,
    triggerEventIds: [situationEvent.id],
    triggerEvidenceItemIds: [],
    triggerBeliefIds: [],
    triggerSelfHypothesisIds: selection.triggerSelfHypothesisIds,
    motivation: selection.favoredKind === null ? NEUTRAL_MOTIVATION : INFLUENCED_MOTIVATION,
    observedStateVersion: situationEvent.observedStateVersion,
    status: "selected",
    createdAt: situationEvent.occurredAt,
  };
}

async function appendIntentionEvent(
  input: SelectG0A2S5IntentionInput,
  situationEvent: Event,
  intention: Intention,
  selection: G0A2S5Selection,
  persistence: PersistencePort,
): Promise<void> {
  await persistence.appendEvent({
    id: `E-${input.turnId}-intention`,
    kinseedId: input.kinseedId,
    sequence: await nextSequence(input.kinseedId, persistence),
    type: "intention_selected",
    occurredAt: situationEvent.occurredAt,
    turnId: input.turnId,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: [situationEvent.id],
    observedStateVersion: situationEvent.observedStateVersion,
    payload: {
      intentionId: intention.id,
      kind: intention.kind,
      motivation: intention.motivation,
      situationId: "S5",
      triggerSelfHypothesisIds: [...selection.triggerSelfHypothesisIds],
      favoredKind: selection.favoredKind,
      neutralTieBreakApplied: selection.neutralTieBreakApplied,
    },
    payloadSchemaVersion: 2,
    engineVersion: input.engineVersion,
    idempotencyKey: `${input.turnId}:intention`,
  });
}

async function reconstructHistoricalDecision(
  input: SelectG0A2S5IntentionInput,
  situationEvent: Event,
  event: Event,
  persistence: PersistencePort,
): Promise<Pick<SelectG0A2S5IntentionResult, "intention" | "selection">> {
  if (
    event.id !== `E-${input.turnId}-intention` ||
    event.kinseedId !== input.kinseedId ||
    event.type !== "intention_selected" ||
    event.payloadSchemaVersion !== 2 ||
    event.turnId !== input.turnId ||
    event.sourceId !== input.systemSourceId ||
    event.actorRef !== null ||
    event.occurredAt !== situationEvent.occurredAt ||
    event.idempotencyKey !== `${input.turnId}:intention` ||
    event.engineVersion !== input.engineVersion ||
    event.observedStateVersion !== situationEvent.observedStateVersion ||
    event.causedByEventIds.length !== 1 ||
    event.causedByEventIds[0] !== situationEvent.id ||
    event.payload.intentionId !== `I-${input.turnId}` ||
    event.payload.situationId !== "S5"
  ) {
    throw new DomainInvariantError(`G0-A2 S5 intention ${event.id} is incoherent`);
  }
  const selection = await selectionFromHistoricalPayload(input.kinseedId, event, persistence);
  const intention = buildIntention(input, situationEvent, selection);
  if (
    event.payload.kind !== intention.kind ||
    event.payload.motivation !== intention.motivation
  ) {
    throw new DomainInvariantError(`G0-A2 S5 intention ${event.id} does not match its selection`);
  }
  return { intention, selection };
}

async function selectionFromHistoricalPayload(
  kinseedId: EntityId,
  event: Event,
  persistence: PersistencePort,
): Promise<G0A2S5Selection> {
  const kind = event.payload.kind;
  const favoredKind = event.payload.favoredKind;
  const triggerIds = event.payload.triggerSelfHypothesisIds;
  const neutralTieBreakApplied = event.payload.neutralTieBreakApplied;
  if (
    !Array.isArray(triggerIds) ||
    !triggerIds.every((id) => typeof id === "string") ||
    typeof neutralTieBreakApplied !== "boolean" ||
    (kind !== ASK_CLARIFICATION && kind !== USE_AVAILABLE_INFORMATION) ||
    (favoredKind !== null && favoredKind !== ASK_CLARIFICATION && favoredKind !== USE_AVAILABLE_INFORMATION)
  ) {
    throw new DomainInvariantError(`G0-A2 S5 intention ${event.id} has invalid payload`);
  }
  if (triggerIds.length === 0) {
    if (
      favoredKind !== null ||
      kind !== USE_AVAILABLE_INFORMATION ||
      neutralTieBreakApplied !== true ||
      event.payload.motivation !== NEUTRAL_MOTIVATION
    ) {
      throw new DomainInvariantError(`G0-A2 S5 neutral intention ${event.id} is incoherent`);
    }
    return neutralSelection();
  }
  if (
    triggerIds.length !== 1 ||
    favoredKind === null ||
    favoredKind !== kind ||
    neutralTieBreakApplied !== false ||
    event.payload.motivation !== INFLUENCED_MOTIVATION
  ) {
    throw new DomainInvariantError(`G0-A2 S5 influenced intention ${event.id} is incoherent`);
  }
  const triggerId = triggerIds[0];
  if (triggerId === undefined) {
    throw new DomainInvariantError(`G0-A2 S5 influenced intention ${event.id} has no trigger`);
  }
  const hypothesis = await persistence.readSelfHypothesis(kinseedId, triggerId);
  if (
    hypothesis === null ||
    hypothesis.kinseedId !== kinseedId ||
    hypothesis.proposition.subjectRef !== kinseedId ||
    hypothesis.proposition.predicate !== S5_TEXT_AXIS ||
    hypothesis.proposition.context.protocol !== "G0-A2"
  ) {
    throw new DomainInvariantError(`G0-A2 S5 intention ${event.id} has invalid historical SelfHypothesis`);
  }
  const expectedKind = hypothesis.proposition.value === "seek_clarification"
    ? ASK_CLARIFICATION
    : hypothesis.proposition.value === "use_available_information"
      ? USE_AVAILABLE_INFORMATION
      : null;
  if (expectedKind === null || favoredKind !== expectedKind) {
    throw new DomainInvariantError(`G0-A2 S5 intention ${event.id} conflicts with historical SelfHypothesis`);
  }
  return influencedSelection(hypothesis.id, expectedKind);
}

function neutralSelection(): G0A2S5Selection {
  return {
    eligibleKinds: [ASK_CLARIFICATION, USE_AVAILABLE_INFORMATION],
    favoredKind: null,
    selectedKind: USE_AVAILABLE_INFORMATION,
    triggerSelfHypothesisIds: [],
    neutralTieBreakApplied: true,
  };
}

function influencedSelection(hypothesisId: EntityId, kind: IntentionKind): G0A2S5Selection {
  return {
    eligibleKinds: [ASK_CLARIFICATION, USE_AVAILABLE_INFORMATION],
    favoredKind: kind,
    selectedKind: kind,
    triggerSelfHypothesisIds: [hypothesisId],
    neutralTieBreakApplied: false,
  };
}

function situationPayload(text: string): Readonly<Record<string, string>> {
  return {
    text,
    protocol: "G0-A2",
    situationId: "S5",
    decisionAxis: S5_TEXT_AXIS,
  };
}

function oneEvent(events: readonly Event[], type: Event["type"], turnId: TurnId): Event | null {
  const matches = events.filter((event) => event.type === type);
  if (matches.length > 1) {
    throw new DomainInvariantError(`G0-A2 S5 turn ${turnId} has multiple ${type} events`);
  }
  return matches[0] ?? null;
}

async function nextSequence(kinseedId: EntityId, persistence: PersistencePort): Promise<number> {
  const events = await persistence.readEventsInSequence(kinseedId);
  return (events.at(-1)?.sequence ?? 0) + 1;
}

function sameRecord(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}
