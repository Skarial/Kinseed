import { DomainInvariantError } from "../domain/errors.js";
import { validateBehavioralObservationGrounding, validateTextEvidenceGrounding } from "../domain/evidence-grounding.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import { buildG0A3MemoryId, buildG0A3MemoryKey, type Memory } from "../domain/memory.js";
import type { EntityId } from "../domain/primitives.js";
import type { Source } from "../domain/source.js";
import {
  buildG0A3CalibrationFailureTestimony,
  buildG0A3CalibrationFixtureEventId,
  buildG0A3CalibrationFixtureEventIdempotencyKey,
  buildG0A3CalibrationObservation,
  buildG0A3InitialFailureCauseTestimony,
  G0A3_CALIBRATION_EPISODE_KEY,
  G0A3_OPERATOR_SOURCE_ID,
  G0A3_SYSTEM_SOURCE_ID,
} from "./materialize-g0a3-calibration-evidence.js";

export const G0A3_INITIAL_MEMORY_GIST =
  "Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test ; l’opérateur a signalé l’échec de la calibration et l’a alors attribué à une incompatibilité entre A et le capteur.";

export interface G0A3MemoryValidationContext {
  readonly sourcesById: ReadonlyMap<EntityId, Source>;
  readonly eventsById: ReadonlyMap<EntityId, Event>;
  readonly evidenceItemsById: ReadonlyMap<EntityId, EvidenceItem>;
  readonly memoryHistory: readonly Memory[];
}

/**
 * Validates the bounded G0-A3 calibration Memory v1 from already-resolved data.
 * It deliberately has no persistence, clock, or model dependency.
 */
export function validateG0A3Memory(
  candidate: Memory,
  context: G0A3MemoryValidationContext,
): void {
  const ids = initialIds(candidate.lenoseedId);
  const request = requiredEvent(context, ids.requestEventId);
  const intention = requiredEvent(context, ids.intentionEventId);
  const failure = requiredEvent(context, ids.failureEventId);
  const initialExplanation = requiredEvent(context, ids.initialExplanationEventId);
  const e1 = requiredEvidence(context, ids.e1Id);
  const e2 = requiredEvidence(context, ids.e2Id);
  const e3 = requiredEvidence(context, ids.e3Id);

  assertSource(context, request, G0A3_OPERATOR_SOURCE_ID, "human");
  assertSource(context, intention, G0A3_SYSTEM_SOURCE_ID, "system");
  assertSource(context, failure, G0A3_OPERATOR_SOURCE_ID, "human");
  assertSource(context, initialExplanation, G0A3_OPERATOR_SOURCE_ID, "human");
  assertFixtureEvent(request, "calibration-01-request", "configuration_request");
  assertFixtureEvent(failure, "calibration-01-failure", "calibration_failure_report");
  assertFixtureEvent(
    initialExplanation,
    "calibration-01-initial-explanation",
    "initial_failure_explanation",
  );
  assertInitialIntention(intention, request);
  assertInitialEventOrder(request, intention, failure, initialExplanation);

  assertExact(e1, buildG0A3CalibrationObservation(intention), "E1");
  assertExact(e2, buildG0A3CalibrationFailureTestimony(failure), "E2");
  assertExact(e3, buildG0A3InitialFailureCauseTestimony(initialExplanation), "E3");
  validateBehavioralObservationGrounding(e1, intention);
  assertGroundedTestimony(e2, failure);
  assertGroundedTestimony(e3, initialExplanation);

  const expectedEventIds = [intention.id, failure.id, initialExplanation.id];
  const expectedEvidenceItemIds = [e1.id, e2.id, e3.id];
  assertExact(candidate.id, buildG0A3MemoryId(candidate.lenoseedId, G0A3_CALIBRATION_EPISODE_KEY, 1), "Memory id");
  assertExact(candidate.episodeKey, G0A3_CALIBRATION_EPISODE_KEY, "Memory episodeKey");
  assertExact(candidate.memoryKey, buildG0A3MemoryKey(candidate.lenoseedId, candidate.episodeKey), "Memory memoryKey");
  if (candidate.version !== 1 || !Number.isInteger(candidate.version)) {
    throw new DomainInvariantError("G0-A3 initial Memory must be version 1");
  }
  assertExact(candidate.eventIds, expectedEventIds, "Memory eventIds");
  assertExact(candidate.evidenceItemIds, expectedEvidenceItemIds, "Memory evidenceItemIds");
  assertExact(candidate.gist, G0A3_INITIAL_MEMORY_GIST, "Memory gist");
  assertExact(candidate.createdAt, initialExplanation.occurredAt, "Memory createdAt");
  if (
    candidate.salience !== "high" ||
    candidate.confidence !== "high" ||
    candidate.status !== "active" ||
    candidate.revisionOf !== null ||
    candidate.lastRecalledAt !== null
  ) {
    throw new DomainInvariantError("G0-A3 initial Memory has invalid immutable fields");
  }

  validateHistory(candidate, context.memoryHistory);
}

export function buildG0A3InitialMemory(
  lenoseedId: EntityId,
  createdAt: string,
): Memory {
  const ids = initialIds(lenoseedId);
  return {
    id: buildG0A3MemoryId(lenoseedId, G0A3_CALIBRATION_EPISODE_KEY, 1),
    lenoseedId,
    memoryKey: buildG0A3MemoryKey(lenoseedId, G0A3_CALIBRATION_EPISODE_KEY),
    episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
    version: 1,
    eventIds: [ids.intentionEventId, ids.failureEventId, ids.initialExplanationEventId],
    evidenceItemIds: [ids.e1Id, ids.e2Id, ids.e3Id],
    gist: G0A3_INITIAL_MEMORY_GIST,
    createdAt,
    salience: "high",
    confidence: "high",
    status: "active",
    revisionOf: null,
    lastRecalledAt: null,
  };
}

export function initialIds(lenoseedId: EntityId) {
  const requestEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-request");
  const intentionEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-intention");
  const failureEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-failure");
  const initialExplanationEventId = buildG0A3CalibrationFixtureEventId(
    lenoseedId,
    "calibration-01-initial-explanation",
  );
  return {
    requestEventId,
    intentionEventId,
    failureEventId,
    initialExplanationEventId,
    e1Id: `EV-G0A3-OBS-${intentionEventId}`,
    e2Id: `EV-G0A3-TESTIMONY-${failureEventId}-outcome`,
    e3Id: `EV-G0A3-TESTIMONY-${initialExplanationEventId}-cause`,
  };
}

function requiredEvent(context: G0A3MemoryValidationContext, id: EntityId): Event {
  const event = context.eventsById.get(id);
  if (event === undefined) throw new DomainInvariantError(`G0-A3 Memory requires Event ${id}`);
  return event;
}

function requiredEvidence(context: G0A3MemoryValidationContext, id: EntityId): EvidenceItem {
  const evidence = context.evidenceItemsById.get(id);
  if (evidence === undefined) throw new DomainInvariantError(`G0-A3 Memory requires EvidenceItem ${id}`);
  return evidence;
}

function assertSource(
  context: G0A3MemoryValidationContext,
  event: Event,
  sourceId: EntityId,
  kind: Source["kind"],
): void {
  const source = context.sourcesById.get(event.sourceId);
  if (event.sourceId !== sourceId || source?.kind !== kind) {
    throw new DomainInvariantError(`G0-A3 Memory Event ${event.id} has invalid source provenance`);
  }
}

function assertInitialEventOrder(...events: readonly Event[]): void {
  if (events.some((event, index) => index > 0 && event.sequence <= (events[index - 1]?.sequence ?? -1))) {
    throw new DomainInvariantError("G0-A3 initial Memory Event order is invalid");
  }
}

function assertFixtureEvent(
  event: Event,
  suffix: "calibration-01-request" | "calibration-01-failure" | "calibration-01-initial-explanation",
  fixtureKind: string,
): void {
  if (
    event.id !== buildG0A3CalibrationFixtureEventId(event.lenoseedId, suffix) ||
    event.idempotencyKey !== buildG0A3CalibrationFixtureEventIdempotencyKey(event.lenoseedId, suffix) ||
    event.type !== "human_message_received" ||
    event.payloadSchemaVersion !== 3 ||
    event.payload.protocol !== "G0-A3" ||
    event.payload.episodeKey !== G0A3_CALIBRATION_EPISODE_KEY ||
    event.payload.fixtureKind !== fixtureKind ||
    typeof event.payload.text !== "string"
  ) throw new DomainInvariantError(`G0-A3 Memory fixture ${event.id} is invalid`);
}

function assertInitialIntention(intention: Event, request: Event): void {
  const expectedPayload = {
    intentionId: `I-G0A3-${intention.lenoseedId}-CALIBRATION-01`,
    protocol: "G0-A3",
    episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
    kind: "run_calibration_with_configuration_a",
    motivation: "execute_requested_calibration_configuration",
    triggerEventIds: [request.id],
    triggerMemoryIds: [],
  };
  if (
    intention.id !== buildG0A3CalibrationFixtureEventId(intention.lenoseedId, "calibration-01-intention") ||
    intention.idempotencyKey !== buildG0A3CalibrationFixtureEventIdempotencyKey(intention.lenoseedId, "calibration-01-intention") ||
    intention.type !== "intention_selected" ||
    intention.payloadSchemaVersion !== 3 ||
    !jsonEquals(intention.payload, expectedPayload) ||
    !jsonEquals(intention.causedByEventIds, [request.id])
  ) throw new DomainInvariantError(`G0-A3 Memory intention ${intention.id} is invalid`);
}

function assertGroundedTestimony(evidence: EvidenceItem, event: Event): void {
  const rejection = validateTextEvidenceGrounding(evidence, event);
  if (rejection !== null) {
    throw new DomainInvariantError(`G0-A3 Memory EvidenceItem ${evidence.id} failed grounding: ${rejection}`);
  }
}

function validateHistory(candidate: Memory, history: readonly Memory[]): void {
  if (history.length === 0) return;
  const ordered = [...history].sort((left, right) => left.version - right.version);
  if (ordered.some((memory, index) => memory.version !== index + 1)) {
    throw new DomainInvariantError("G0-A3 Memory history has a version gap or duplicate");
  }
  if (ordered.some((memory) => memory.memoryKey !== candidate.memoryKey)) {
    throw new DomainInvariantError("G0-A3 Memory history has another memoryKey");
  }
  const active = ordered.filter((memory) => memory.status === "active");
  if (active.length !== 1 || active[0]?.version !== ordered.length) {
    throw new DomainInvariantError("G0-A3 Memory history must have one highest active version");
  }
  if (ordered.slice(0, -1).some((memory) => memory.status !== "revised")) {
    throw new DomainInvariantError("G0-A3 Memory history has a non-revised prior version");
  }
  const v1 = ordered[0];
  if (v1 === undefined || !sameMemoryExceptStatus(v1, candidate) || !["active", "revised"].includes(v1.status)) {
    throw new DomainInvariantError("G0-A3 durable Memory v1 differs from its validated snapshot");
  }
}

function sameMemoryExceptStatus(left: Memory, right: Memory): boolean {
  return jsonEquals({ ...left, status: "active" }, { ...right, status: "active" });
}

function assertExact(actual: unknown, expected: unknown, label: string): void {
  if (!jsonEquals(actual, expected)) throw new DomainInvariantError(`${label} is not canonical`);
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}
