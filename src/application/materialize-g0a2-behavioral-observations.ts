import { DomainInvariantError } from "../domain/errors.js";
import { decisionStyleForIntentionKind } from "../domain/evidence-grounding.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import type { EntityId, StateVersion } from "../domain/primitives.js";
import type { AtomicCommitResult, PersistencePort } from "../ports/persistence.js";
import { validateEvidenceItem } from "./validate-evidence.js";

const MATERIALIZATION_SCOPE = "behavioral_observation_materialization";
const EXTRACTOR_VERSION = "kinseed-g0a2-behavioral-observation-v1";
const REQUIRED_SITUATIONS = ["S1", "S2", "S3", "S4"] as const;

export interface MaterializeG0A2BehavioralObservationsInput {
  readonly kinseedId: EntityId;
  readonly historyId: string;
  readonly systemSourceId: EntityId;
  readonly intentionEventIds: readonly EntityId[];
  readonly engineVersion: string;
}

export interface MaterializeG0A2BehavioralObservationsResult {
  readonly evidenceItemIds: readonly EntityId[];
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
  readonly changed: boolean;
  readonly replayed: boolean;
}

export async function materializeG0A2BehavioralObservations(
  input: MaterializeG0A2BehavioralObservationsInput,
  persistence: PersistencePort,
): Promise<MaterializeG0A2BehavioralObservationsResult> {
  const systemSource = await persistence.readSource(input.systemSourceId);
  if (systemSource?.kind !== "system") {
    throw new DomainInvariantError(`G0-A2 materialization requires system source ${input.systemSourceId}`);
  }

  const fixtures = await readAndValidateFixtures(input, persistence);
  const observations = fixtures.map(buildBehavioralObservation);
  for (const observation of observations) {
    const rejection = await validateEvidenceItem(observation, persistence);
    if (rejection !== null) {
      throw new DomainInvariantError(
        `G0-A2 observation ${observation.id} failed grounding: ${rejection}`,
      );
    }
  }

  const events = await persistence.readEventsInSequence(input.kinseedId);
  const completion = findCompletionEvent(events, input.historyId);
  if (completion !== null) {
    const result = validateHistoricalCompletion(completion, input.systemSourceId, fixtures);
    await validateHistoricalObservations(input.kinseedId, observations, persistence);
    return { evidenceItemIds: observations.map((observation) => observation.id), ...result, replayed: true };
  }

  const commit = await persistence.atomicCommit(
    input.kinseedId,
    await persistence.getStateVersion(input.kinseedId),
    { evidenceItems: observations, evidenceLinks: [], beliefs: [], selfHypotheses: [] },
    commitIdempotencyKey(input),
  );

  await appendCompletionEvent(input, fixtures, commit, persistence);
  return {
    evidenceItemIds: observations.map((observation) => observation.id),
    previousStateVersion: commit.previousStateVersion,
    newStateVersion: commit.newStateVersion,
    changed: commit.applied,
    replayed: false,
  };
}

export function buildG0A2BehavioralObservationId(sourceEventId: EntityId): EntityId {
  return `EV-G0A2-OBS-${sourceEventId}`;
}

function buildBehavioralObservation(sourceEvent: Event): EvidenceItem {
  const value = decisionStyleForIntentionKind(sourceEvent.payload.kind);
  if (value === null) {
    throw new DomainInvariantError(`G0-A2 source event ${sourceEvent.id} has invalid intention kind`);
  }
  const situationId = sourceEvent.payload.situationId;
  if (typeof situationId !== "string") {
    throw new DomainInvariantError(`G0-A2 source event ${sourceEvent.id} has no situationId`);
  }
  return {
    id: buildG0A2BehavioralObservationId(sourceEvent.id),
    kinseedId: sourceEvent.kinseedId,
    kind: "behavioral_observation",
    proposition: {
      subjectRef: sourceEvent.kinseedId,
      predicate: "selected_decision_style_under_uncertainty",
      value,
      context: { protocol: "G0-A2", situationId },
    },
    sourceId: sourceEvent.sourceId,
    eventIds: [sourceEvent.id],
    grounding: { kind: "structured_event", eventId: sourceEvent.id },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: EXTRACTOR_VERSION,
    createdAt: sourceEvent.occurredAt,
  };
}

async function readAndValidateFixtures(
  input: MaterializeG0A2BehavioralObservationsInput,
  persistence: PersistencePort,
): Promise<readonly Event[]> {
  if (input.intentionEventIds.length !== 4 || new Set(input.intentionEventIds).size !== 4) {
    throw new DomainInvariantError("G0-A2 materialization requires exactly four distinct fixtures");
  }

  const fixtures: Event[] = [];
  for (const eventId of input.intentionEventIds) {
    const event = await persistence.readEventById(input.kinseedId, eventId);
    if (event === null || event.kinseedId !== input.kinseedId) {
      throw new DomainInvariantError(`G0-A2 fixture ${eventId} does not belong to ${input.kinseedId}`);
    }
    const source = await persistence.readSource(event.sourceId);
    if (source?.kind !== "system") {
      throw new DomainInvariantError(`G0-A2 fixture ${event.id} must use a system source`);
    }
    if (event.type !== "intention_selected" || event.payloadSchemaVersion !== 2) {
      throw new DomainInvariantError(`G0-A2 fixture ${event.id} must be intention_selected schema v2`);
    }
    const situationId = event.payload.situationId;
    if (!isRequiredSituation(situationId)) {
      throw new DomainInvariantError(`G0-A2 fixture ${event.id} has invalid situationId`);
    }
    if (decisionStyleForIntentionKind(event.payload.kind) === null) {
      throw new DomainInvariantError(`G0-A2 fixture ${event.id} has invalid intention kind`);
    }
    if (!Array.isArray(event.payload.triggerSelfHypothesisIds) || event.payload.triggerSelfHypothesisIds.length !== 0) {
      throw new DomainInvariantError(`G0-A2 fixture ${event.id} must have no SelfHypothesis trigger`);
    }
    fixtures.push(event);
  }

  const situations = new Set(fixtures.map((fixture) => fixture.payload.situationId));
  if (situations.size !== REQUIRED_SITUATIONS.length || REQUIRED_SITUATIONS.some((situation) => !situations.has(situation))) {
    throw new DomainInvariantError("G0-A2 fixtures must contain S1, S2, S3, and S4 exactly once");
  }
  return fixtures.sort((left, right) => left.sequence - right.sequence);
}

function isRequiredSituation(value: unknown): value is (typeof REQUIRED_SITUATIONS)[number] {
  return typeof value === "string" && REQUIRED_SITUATIONS.includes(value as (typeof REQUIRED_SITUATIONS)[number]);
}

function findCompletionEvent(events: readonly Event[], historyId: string): Event | null {
  const completions = events.filter(
    (event) =>
      event.type === "state_commit_completed" &&
      event.payloadSchemaVersion === 2 &&
      event.payload.scope === MATERIALIZATION_SCOPE &&
      event.payload.materializationId === historyId,
  );
  if (completions.length > 1) {
    throw new DomainInvariantError(`G0-A2 history ${historyId} has multiple completion events`);
  }
  return completions[0] ?? null;
}

function validateHistoricalCompletion(
  completion: Event,
  systemSourceId: EntityId,
  fixtures: readonly Event[],
): Omit<MaterializeG0A2BehavioralObservationsResult, "evidenceItemIds" | "replayed"> {
  const causedByEventIds = fixtures.map((fixture) => fixture.id);
  if (
    completion.causedByEventIds.length !== causedByEventIds.length ||
    completion.causedByEventIds.some((eventId, index) => eventId !== causedByEventIds[index])
  ) {
    throw new DomainInvariantError(`G0-A2 completion ${completion.id} has incoherent fixture causes`);
  }
  if (completion.sourceId !== systemSourceId || completion.turnId !== null) {
    throw new DomainInvariantError(`G0-A2 completion ${completion.id} has incoherent source`);
  }
  const previousStateVersion = completion.payload.previousStateVersion;
  const newStateVersion = completion.payload.newStateVersion;
  const changed = completion.payload.changed;
  if (
    typeof previousStateVersion !== "number" ||
    typeof newStateVersion !== "number" ||
    changed !== true ||
    newStateVersion !== previousStateVersion + 1 ||
    completion.observedStateVersion !== previousStateVersion
  ) {
    throw new DomainInvariantError(`G0-A2 completion ${completion.id} has incoherent commit result`);
  }
  if (completion.occurredAt !== fixtures.at(-1)?.occurredAt) {
    throw new DomainInvariantError(`G0-A2 completion ${completion.id} has incoherent occurredAt`);
  }
  if (completion.id !== completionEventId(completion.kinseedId, completion.payload.materializationId as string)) {
    throw new DomainInvariantError(`G0-A2 completion ${completion.id} has incoherent id`);
  }
  if (completion.idempotencyKey !== completionIdempotencyKey(completion.kinseedId, completion.payload.materializationId as string)) {
    throw new DomainInvariantError(`G0-A2 completion ${completion.id} has incoherent idempotencyKey`);
  }
  return { previousStateVersion, newStateVersion, changed };
}

async function validateHistoricalObservations(
  kinseedId: EntityId,
  observations: readonly EvidenceItem[],
  persistence: PersistencePort,
): Promise<void> {
  for (const expected of observations) {
    const actual = await persistence.readEvidenceItem(kinseedId, expected.id);
    if (actual === null || JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new DomainInvariantError(`G0-A2 historical observation ${expected.id} is incoherent`);
    }
  }
}

async function appendCompletionEvent(
  input: MaterializeG0A2BehavioralObservationsInput,
  fixtures: readonly Event[],
  commit: AtomicCommitResult,
  persistence: PersistencePort,
): Promise<void> {
  const events = await persistence.readEventsInSequence(input.kinseedId);
  const lastFixture = fixtures.at(-1);
  if (lastFixture === undefined) {
    throw new DomainInvariantError("G0-A2 materialization has no final fixture");
  }
  await persistence.appendEvent({
    id: completionEventId(input.kinseedId, input.historyId),
    kinseedId: input.kinseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    type: "state_commit_completed",
    occurredAt: lastFixture.occurredAt,
    turnId: null,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: fixtures.map((fixture) => fixture.id),
    observedStateVersion: commit.previousStateVersion,
    payload: {
      scope: MATERIALIZATION_SCOPE,
      materializationId: input.historyId,
      previousStateVersion: commit.previousStateVersion,
      newStateVersion: commit.newStateVersion,
      changed: commit.applied,
    },
    payloadSchemaVersion: 2,
    engineVersion: input.engineVersion,
    idempotencyKey: completionIdempotencyKey(input.kinseedId, input.historyId),
  });
}

function commitIdempotencyKey(input: MaterializeG0A2BehavioralObservationsInput): string {
  return `g0a2:${input.kinseedId}:${input.historyId}:behavioral-observations:commit`;
}

function completionEventId(kinseedId: EntityId, historyId: string): EntityId {
  return `E-G0A2-${kinseedId}-${historyId}-behavioral-observations-completed`;
}

function completionIdempotencyKey(kinseedId: EntityId, historyId: string): string {
  return `g0a2:${kinseedId}:${historyId}:behavioral-observations:completed`;
}
