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
  buildG0A3ConfigurationCompatibilityTestimony,
  buildG0A3CorrectedFailureCauseTestimony,
  buildG0A3InitialFailureCauseTestimony,
  G0A3_CALIBRATION_EPISODE_KEY,
  G0A3_CALIBRATION_FAILURE_TEXT,
  G0A3_CONFIGURATION_REQUEST_TEXT,
  G0A3_CORRECTION_TEXT,
  G0A3_INITIAL_EXPLANATION_TEXT,
  G0A3_OPERATOR_ACTOR_REF,
  G0A3_OPERATOR_SOURCE_ID,
  G0A3_SYSTEM_SOURCE_ID,
} from "./materialize-g0a3-calibration-evidence.js";

export const G0A3_INITIAL_MEMORY_GIST =
  "Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test ; l’opérateur a signalé l’échec de la calibration et l’a alors attribué à une incompatibilité entre A et le capteur.";

export const G0A3_REVISED_MEMORY_GIST =
  "Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test et l’opérateur a signalé l’échec de la calibration ; une correction ultérieure indique que A était compatible et que le câble C était débranché.";

export interface G0A3MemoryValidationContext {
  readonly sourcesById: ReadonlyMap<EntityId, Source>;
  readonly eventsById: ReadonlyMap<EntityId, Event>;
  readonly evidenceItemsById: ReadonlyMap<EntityId, EvidenceItem>;
  readonly memoryHistory: readonly Memory[];
  /** Required for v2 so a pre-commit candidate cannot be confused with durable history. */
  readonly revisedMemoryValidationMode?: "planned" | "durable";
}

/** Validates one of the two bounded G0-A3 calibration Memory versions. */
export function validateG0A3Memory(
  candidate: Memory,
  context: G0A3MemoryValidationContext,
): void {
  if (candidate.version !== 1 && candidate.version !== 2) {
    throw new DomainInvariantError("G0-A3 Memory supports only versions 1 and 2");
  }

  const ids = initialIds(candidate.lenoseedId);
  const request = requiredEvent(context, ids.requestEventId);
  const intention = requiredEvent(context, ids.intentionEventId);
  const failure = requiredEvent(context, ids.failureEventId);
  const initialExplanation = requiredEvent(context, ids.initialExplanationEventId);
  const e1 = requiredEvidence(context, ids.e1Id);
  const e2 = requiredEvidence(context, ids.e2Id);
  const e3 = requiredEvidence(context, ids.e3Id);

  validateInitialProvenance(context, request, intention, failure, initialExplanation, e1, e2, e3);
  const expectedV1 = buildG0A3InitialMemory(candidate.lenoseedId, initialExplanation.occurredAt);
  validateHistory(context.memoryHistory, expectedV1);

  if (candidate.version === 1) {
    validateInitialCandidate(candidate, expectedV1, context);
    return;
  }

  const revised = revisedIds(candidate.lenoseedId);
  const correction = requiredEvent(context, revised.correctionEventId);
  const e4 = requiredEvidence(context, revised.e4Id);
  const e5 = requiredEvidence(context, revised.e5Id);
  validateRevisedProvenance(context, correction, initialExplanation, e3, e4, e5);
  validateRevisedCandidate(candidate, expectedV1, correction, context);
}

export function buildG0A3InitialMemory(lenoseedId: EntityId, createdAt: string): Memory {
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

export function buildG0A3RevisedMemory(
  lenoseedId: EntityId,
  createdAt: string,
  revisionOf: EntityId,
): Memory {
  const ids = revisedIds(lenoseedId);
  return {
    id: buildG0A3MemoryId(lenoseedId, G0A3_CALIBRATION_EPISODE_KEY, 2),
    lenoseedId,
    memoryKey: buildG0A3MemoryKey(lenoseedId, G0A3_CALIBRATION_EPISODE_KEY),
    episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
    version: 2,
    eventIds: [ids.intentionEventId, ids.failureEventId, ids.correctionEventId],
    evidenceItemIds: [ids.e1Id, ids.e2Id, ids.e4Id, ids.e5Id],
    gist: G0A3_REVISED_MEMORY_GIST,
    createdAt,
    salience: "high",
    confidence: "high",
    status: "active",
    revisionOf,
    lastRecalledAt: null,
  };
}

export function initialIds(lenoseedId: EntityId) {
  const requestEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-request");
  const intentionEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-intention");
  const failureEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-failure");
  const initialExplanationEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-initial-explanation");
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

export function revisedIds(lenoseedId: EntityId) {
  const initial = initialIds(lenoseedId);
  const correctionEventId = buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-correction");
  return {
    ...initial,
    correctionEventId,
    e4Id: `EV-G0A3-TESTIMONY-${correctionEventId}-compatibility`,
    e5Id: `EV-G0A3-TESTIMONY-${correctionEventId}-cause`,
  };
}

function validateInitialProvenance(
  context: G0A3MemoryValidationContext,
  request: Event,
  intention: Event,
  failure: Event,
  initialExplanation: Event,
  e1: EvidenceItem,
  e2: EvidenceItem,
  e3: EvidenceItem,
): void {
  assertSource(context, request, G0A3_OPERATOR_SOURCE_ID, "human", G0A3_OPERATOR_ACTOR_REF);
  assertSource(context, intention, G0A3_SYSTEM_SOURCE_ID, "system");
  assertSource(context, failure, G0A3_OPERATOR_SOURCE_ID, "human", G0A3_OPERATOR_ACTOR_REF);
  assertSource(context, initialExplanation, G0A3_OPERATOR_SOURCE_ID, "human", G0A3_OPERATOR_ACTOR_REF);
  assertFixtureEvent(request, "calibration-01-request", "configuration_request", G0A3_CONFIGURATION_REQUEST_TEXT);
  assertFixtureEvent(failure, "calibration-01-failure", "calibration_failure_report", G0A3_CALIBRATION_FAILURE_TEXT);
  assertFixtureEvent(initialExplanation, "calibration-01-initial-explanation", "initial_failure_explanation", G0A3_INITIAL_EXPLANATION_TEXT);
  assertInitialIntention(intention, request);
  assertEventOrder(request, intention, failure, initialExplanation);

  assertExact(e1, buildG0A3CalibrationObservation(intention), "E1");
  assertExact(e2, buildG0A3CalibrationFailureTestimony(failure), "E2");
  assertExact(e3, buildG0A3InitialFailureCauseTestimony(initialExplanation), "E3");
  validateBehavioralObservationGrounding(e1, intention);
  assertGroundedTestimony(e2, failure);
  assertGroundedTestimony(e3, initialExplanation);
}

function validateInitialCandidate(
  candidate: Memory,
  expected: Memory,
  context: G0A3MemoryValidationContext,
): void {
  if (!sameMemoryExceptStatus(candidate, expected) || !["active", "revised"].includes(candidate.status)) {
    throw new DomainInvariantError("G0-A3 initial Memory has invalid immutable fields");
  }
  if (candidate.status === "revised") {
    const [v1, v2] = context.memoryHistory;
    if (
      context.revisedMemoryValidationMode !== "durable" ||
      context.memoryHistory.length !== 2 ||
      !sameValue(v1, candidate) ||
      v2?.status !== "active"
    ) {
      throw new DomainInvariantError("G0-A3 initial Memory may be revised only in durable v2 history");
    }
  }
}

function validateRevisedProvenance(
  context: G0A3MemoryValidationContext,
  correction: Event,
  initialExplanation: Event,
  e3: EvidenceItem,
  e4: EvidenceItem,
  e5: EvidenceItem,
): void {
  assertSource(context, correction, G0A3_OPERATOR_SOURCE_ID, "human", G0A3_OPERATOR_ACTOR_REF);
  if (correction.actorRef !== G0A3_OPERATOR_ACTOR_REF) {
    throw new DomainInvariantError("G0-A3 correction has an invalid actorRef");
  }
  assertFixtureEvent(correction, "calibration-01-correction", "failure_explanation_correction", G0A3_CORRECTION_TEXT);
  assertEventOrder(initialExplanation, correction);
  assertExact(e4, buildG0A3ConfigurationCompatibilityTestimony(correction), "E4");
  assertExact(e5, buildG0A3CorrectedFailureCauseTestimony(correction, e3.id), "E5");
  assertGroundedTestimony(e4, correction);
  assertGroundedTestimony(e5, correction);
}

function validateRevisedCandidate(
  candidate: Memory,
  expectedV1: Memory,
  correction: Event,
  context: G0A3MemoryValidationContext,
): void {
  const expected = buildG0A3RevisedMemory(candidate.lenoseedId, correction.occurredAt, expectedV1.id);
  assertExact(candidate, expected, "G0-A3 revised Memory");
  if (context.revisedMemoryValidationMode === "planned") {
    if (
      context.memoryHistory.length !== 1 ||
      !sameValue(context.memoryHistory[0], expectedV1) ||
      context.memoryHistory.some((memory) => memory.id === candidate.id)
    ) {
      throw new DomainInvariantError("G0-A3 planned v2 requires exactly the active v1 history");
    }
    return;
  }
  if (context.revisedMemoryValidationMode === "durable") {
    const [v1, v2] = context.memoryHistory;
    if (
      context.memoryHistory.length !== 2 ||
      !sameValue(v1, { ...expectedV1, status: "revised" }) ||
      !sameValue(v2, candidate)
    ) {
      throw new DomainInvariantError("G0-A3 durable v2 requires the exact revised v1 to active v2 chain");
    }
    return;
  }
  throw new DomainInvariantError("G0-A3 revised Memory requires an explicit planned or durable validation mode");
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
  actorRef?: EntityId,
): void {
  const source = context.sourcesById.get(event.sourceId);
  if (
    event.sourceId !== sourceId ||
    source?.id !== sourceId ||
    source?.kind !== kind ||
    (actorRef !== undefined && source?.actorRef !== actorRef)
  ) {
    throw new DomainInvariantError(`G0-A3 Memory Event ${event.id} has invalid source provenance`);
  }
}

function assertEventOrder(...events: readonly Event[]): void {
  if (events.some((event, index) => index > 0 && event.sequence <= (events[index - 1]?.sequence ?? -1))) {
    throw new DomainInvariantError("G0-A3 Memory Event order is invalid");
  }
}

function assertFixtureEvent(
  event: Event,
  suffix: "calibration-01-request" | "calibration-01-failure" | "calibration-01-initial-explanation" | "calibration-01-correction",
  fixtureKind: string,
  text: string,
): void {
  const expectedPayload = { text, protocol: "G0-A3", episodeKey: G0A3_CALIBRATION_EPISODE_KEY, fixtureKind };
  if (
    event.id !== buildG0A3CalibrationFixtureEventId(event.lenoseedId, suffix) ||
    event.idempotencyKey !== buildG0A3CalibrationFixtureEventIdempotencyKey(event.lenoseedId, suffix) ||
    event.type !== "human_message_received" ||
    event.payloadSchemaVersion !== 3 ||
    !jsonEquals(event.payload, expectedPayload)
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

function validateHistory(history: readonly Memory[], expectedV1: Memory): void {
  if (history.length === 0) return;
  const ordered = [...history].sort((left, right) => left.version - right.version);
  if (ordered.some((memory, index) => memory.version !== index + 1)) {
    throw new DomainInvariantError("G0-A3 Memory history has a version gap or duplicate");
  }
  for (const [index, memory] of ordered.entries()) {
    if (
      memory.lenoseedId !== expectedV1.lenoseedId ||
      memory.episodeKey !== expectedV1.episodeKey ||
      memory.memoryKey !== expectedV1.memoryKey ||
      memory.id !== buildG0A3MemoryId(expectedV1.lenoseedId, expectedV1.episodeKey, memory.version) ||
      (index === 0 ? memory.revisionOf !== null : memory.revisionOf !== ordered[index - 1]?.id)
    ) {
      throw new DomainInvariantError("G0-A3 Memory history has an invalid identity or predecessor");
    }
  }
  const active = ordered.filter((memory) => memory.status === "active");
  if (active.length !== 1 || active[0]?.version !== ordered.length) {
    throw new DomainInvariantError("G0-A3 Memory history must have one highest active version");
  }
  if (ordered.slice(0, -1).some((memory) => memory.status !== "revised")) {
    throw new DomainInvariantError("G0-A3 Memory history has a non-revised prior version");
  }
  if (!sameMemoryExceptStatus(ordered[0], expectedV1)) {
    throw new DomainInvariantError("G0-A3 durable Memory v1 differs from its validated snapshot");
  }
}

function sameMemoryExceptStatus(left: Memory | undefined, right: Memory): boolean {
  return left !== undefined && jsonEquals({ ...left, status: "active" }, { ...right, status: "active" });
}

function assertExact(actual: unknown, expected: unknown, label: string): void {
  if (!jsonEquals(actual, expected)) throw new DomainInvariantError(`${label} is not canonical`);
}

function sameValue(left: unknown, right: unknown): boolean {
  return jsonEquals(left, right);
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
