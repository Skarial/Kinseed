import { DomainInvariantError } from "../domain/errors.js";
import { decisionStyleForIntentionKind } from "../domain/evidence-grounding.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import type { EntityId, StateVersion } from "../domain/primitives.js";
import type { AtomicCommitResult, PersistencePort } from "../ports/persistence.js";
import {
  buildG0A2BehavioralObservationFromIntention,
} from "./materialize-g0a2-behavioral-observations.js";
import { validateEvidenceItem } from "./validate-evidence.js";

const MATERIALIZATION_SCOPE = "behavioral_observation_materialization";
const ADDITIONAL_SITUATIONS = ["R1", "R2", "R3", "S5"] as const;
const REVISION_SITUATIONS = ["R1", "R2", "R3"] as const;

export interface MaterializeG0A2AdditionalBehavioralObservationsInput {
  readonly lenoseedId: EntityId;
  readonly materializationId: string;
  readonly systemSourceId: EntityId;
  readonly intentionEventIds: readonly EntityId[];
  readonly engineVersion: string;
}

export interface MaterializeG0A2AdditionalBehavioralObservationsResult {
  readonly evidenceItemIds: readonly EntityId[];
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
  readonly changed: boolean;
  readonly replayed: boolean;
}

export async function materializeG0A2AdditionalBehavioralObservations(
  input: MaterializeG0A2AdditionalBehavioralObservationsInput,
  persistence: PersistencePort,
): Promise<MaterializeG0A2AdditionalBehavioralObservationsResult> {
  const systemSource = await persistence.readSource(input.systemSourceId);
  if (systemSource?.kind !== "system") {
    throw new DomainInvariantError(`G0-A2 additional materialization requires system source ${input.systemSourceId}`);
  }
  const intentions = await readAndValidateAdditionalIntentions(input, persistence);
  const observations = intentions.map(buildG0A2BehavioralObservationFromIntention);
  for (const observation of observations) {
    const rejection = await validateEvidenceItem(observation, persistence);
    if (rejection !== null) {
      throw new DomainInvariantError(`G0-A2 observation ${observation.id} failed grounding: ${rejection}`);
    }
  }

  const events = await persistence.readEventsInSequence(input.lenoseedId);
  const completion = findCompletion(events, input.materializationId);
  if (completion !== null) {
    const result = validateCompletion(completion, input.systemSourceId, intentions);
    await validateHistoricalObservations(input.lenoseedId, observations, persistence);
    return { evidenceItemIds: observations.map((observation) => observation.id), ...result, replayed: true };
  }

  const commit = await persistence.atomicCommit(
    input.lenoseedId,
    await persistence.getStateVersion(input.lenoseedId),
    { evidenceItems: observations, evidenceLinks: [], beliefs: [], selfHypotheses: [] },
    commitKey(input),
  );
  await appendCompletion(input, intentions, commit, persistence);
  return {
    evidenceItemIds: observations.map((observation) => observation.id),
    previousStateVersion: commit.previousStateVersion,
    newStateVersion: commit.newStateVersion,
    changed: commit.applied,
    replayed: false,
  };
}

async function readAndValidateAdditionalIntentions(
  input: MaterializeG0A2AdditionalBehavioralObservationsInput,
  persistence: PersistencePort,
): Promise<readonly Event[]> {
  if (input.intentionEventIds.length === 0 || new Set(input.intentionEventIds).size !== input.intentionEventIds.length) {
    throw new DomainInvariantError("G0-A2 additional materialization requires distinct intention events");
  }
  const intentions: Event[] = [];
  for (const eventId of input.intentionEventIds) {
    const event = await persistence.readEventById(input.lenoseedId, eventId);
    if (event === null || event.lenoseedId !== input.lenoseedId) {
      throw new DomainInvariantError(`G0-A2 additional event ${eventId} does not belong to ${input.lenoseedId}`);
    }
    const source = await persistence.readSource(event.sourceId);
    if (source?.kind !== "system") {
      throw new DomainInvariantError(`G0-A2 additional event ${event.id} must use a system source`);
    }
    if (event.type !== "intention_selected" || event.payloadSchemaVersion !== 2) {
      throw new DomainInvariantError(`G0-A2 additional event ${event.id} must be intention_selected schema v2`);
    }
    if (typeof event.payload.intentionId !== "string" || typeof event.payload.motivation !== "string") {
      throw new DomainInvariantError(`G0-A2 additional event ${event.id} has invalid intention payload`);
    }
    if (decisionStyleForIntentionKind(event.payload.kind) === null) {
      throw new DomainInvariantError(`G0-A2 additional event ${event.id} has invalid intention kind`);
    }
    const situationId = event.payload.situationId;
    if (!isAdditionalSituation(situationId)) {
      throw new DomainInvariantError(`G0-A2 additional event ${event.id} has invalid situationId`);
    }
    const triggerIds = event.payload.triggerSelfHypothesisIds;
    if (!Array.isArray(triggerIds) || !triggerIds.every((id) => typeof id === "string")) {
      throw new DomainInvariantError(`G0-A2 additional event ${event.id} has invalid SelfHypothesis triggers`);
    }
    if (isRevisionSituation(situationId) && triggerIds.length !== 0) {
      throw new DomainInvariantError(`G0-A2 revision event ${event.id} must have no SelfHypothesis trigger`);
    }
    if (situationId === "S5") {
      if (triggerIds.length > 1) {
        throw new DomainInvariantError(`G0-A2 S5 event ${event.id} has multiple SelfHypothesis triggers`);
      }
      const triggerId = triggerIds[0];
      if (triggerId !== undefined) {
        const hypothesis = await persistence.readSelfHypothesis(input.lenoseedId, triggerId);
        if (
          hypothesis === null ||
          hypothesis.lenoseedId !== input.lenoseedId ||
          hypothesis.proposition.subjectRef !== input.lenoseedId ||
          hypothesis.proposition.predicate !== "decision_style_under_uncertainty" ||
          hypothesis.proposition.context.protocol !== "G0-A2"
        ) {
          throw new DomainInvariantError(`G0-A2 S5 event ${event.id} has invalid SelfHypothesis trigger`);
        }
      }
    }
    intentions.push(event);
  }
  const revisionIds = intentions
    .map((event) => event.payload.situationId)
    .filter(isRevisionSituation);
  if (new Set(revisionIds).size !== revisionIds.length) {
    throw new DomainInvariantError("G0-A2 additional materialization has duplicate revision situations");
  }
  return intentions.sort((left, right) => left.sequence - right.sequence);
}

function isAdditionalSituation(value: unknown): value is (typeof ADDITIONAL_SITUATIONS)[number] {
  return typeof value === "string" && ADDITIONAL_SITUATIONS.includes(value as (typeof ADDITIONAL_SITUATIONS)[number]);
}

function isRevisionSituation(value: unknown): value is (typeof REVISION_SITUATIONS)[number] {
  return typeof value === "string" && REVISION_SITUATIONS.includes(value as (typeof REVISION_SITUATIONS)[number]);
}

function findCompletion(events: readonly Event[], materializationId: string): Event | null {
  const matches = events.filter((event) =>
    event.type === "state_commit_completed" &&
    event.payloadSchemaVersion === 2 &&
    event.payload.scope === MATERIALIZATION_SCOPE &&
    event.payload.materializationId === materializationId,
  );
  if (matches.length > 1) throw new DomainInvariantError(`G0-A2 materialization ${materializationId} has multiple completions`);
  return matches[0] ?? null;
}

function validateCompletion(
  completion: Event,
  systemSourceId: EntityId,
  intentions: readonly Event[],
): Omit<MaterializeG0A2AdditionalBehavioralObservationsResult, "evidenceItemIds" | "replayed"> {
  const causedByEventIds = intentions.map((event) => event.id);
  const previousStateVersion = completion.payload.previousStateVersion;
  const newStateVersion = completion.payload.newStateVersion;
  if (
    completion.sourceId !== systemSourceId ||
    completion.turnId !== null ||
    completion.causedByEventIds.length !== causedByEventIds.length ||
    completion.causedByEventIds.some((id, index) => id !== causedByEventIds[index]) ||
    typeof previousStateVersion !== "number" ||
    typeof newStateVersion !== "number" ||
    completion.payload.changed !== true ||
    newStateVersion !== previousStateVersion + 1 ||
    completion.observedStateVersion !== previousStateVersion ||
    completion.occurredAt !== intentions.at(-1)?.occurredAt ||
    completion.id !== completionId(completion.lenoseedId, completion.payload.materializationId as string) ||
    completion.idempotencyKey !== completionKey(completion.lenoseedId, completion.payload.materializationId as string)
  ) {
    throw new DomainInvariantError(`G0-A2 additional completion ${completion.id} is incoherent`);
  }
  return { previousStateVersion, newStateVersion, changed: true };
}

async function validateHistoricalObservations(
  lenoseedId: EntityId,
  observations: readonly EvidenceItem[],
  persistence: PersistencePort,
): Promise<void> {
  for (const expected of observations) {
    const actual = await persistence.readEvidenceItem(lenoseedId, expected.id);
    if (actual === null || JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new DomainInvariantError(`G0-A2 historical observation ${expected.id} is incoherent`);
    }
  }
}

async function appendCompletion(
  input: MaterializeG0A2AdditionalBehavioralObservationsInput,
  intentions: readonly Event[],
  commit: AtomicCommitResult,
  persistence: PersistencePort,
): Promise<void> {
  const events = await persistence.readEventsInSequence(input.lenoseedId);
  const lastIntention = intentions.at(-1);
  if (lastIntention === undefined) throw new DomainInvariantError("G0-A2 additional materialization has no events");
  await persistence.appendEvent({
    id: completionId(input.lenoseedId, input.materializationId),
    lenoseedId: input.lenoseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    type: "state_commit_completed",
    occurredAt: lastIntention.occurredAt,
    turnId: null,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: intentions.map((event) => event.id),
    observedStateVersion: commit.previousStateVersion,
    payload: {
      scope: MATERIALIZATION_SCOPE,
      materializationId: input.materializationId,
      previousStateVersion: commit.previousStateVersion,
      newStateVersion: commit.newStateVersion,
      changed: commit.applied,
    },
    payloadSchemaVersion: 2,
    engineVersion: input.engineVersion,
    idempotencyKey: completionKey(input.lenoseedId, input.materializationId),
  });
}

function commitKey(input: MaterializeG0A2AdditionalBehavioralObservationsInput): string {
  return `g0a2:${input.lenoseedId}:${input.materializationId}:behavioral-observations:commit`;
}

function completionId(lenoseedId: EntityId, materializationId: string): EntityId {
  return `E-G0A2-${lenoseedId}-${materializationId}-behavioral-observations-completed`;
}

function completionKey(lenoseedId: EntityId, materializationId: string): string {
  return `g0a2:${lenoseedId}:${materializationId}:behavioral-observations:completed`;
}
