import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import type { EntityId, StateVersion } from "../domain/primitives.js";
import type { PersistencePort } from "../ports/persistence.js";
import { validateEvidenceItem } from "./validate-evidence.js";

export const G0A3_CALIBRATION_EPISODE_KEY = "EP-G0A3-CALIBRATION-01";
export const G0A3_SYSTEM_SOURCE_ID = "SRC-G0A3-SYSTEM";
export const G0A3_OPERATOR_SOURCE_ID = "SRC-G0A3-OPERATOR";
export const G0A3_OPERATOR_ACTOR_REF = "OP-G0A3-001";

const CONFIGURATION_REQUEST_TEXT = "Utilise la configuration A pour le test de calibration.";
const CALIBRATION_FAILURE_TEXT = "La calibration a échoué.";
const INITIAL_EXPLANATION_TEXT =
  "D’après le contrôle initial, la configuration A est incompatible avec ce capteur.";
const CORRECTION_TEXT =
  "Correction : la configuration A était compatible. L’échec venait du câble C, qui était débranché.";
const E4_SUPPORTING_EXCERPT = "la configuration A était compatible";
const E5_SUPPORTING_EXCERPT = "L’échec venait du câble C, qui était débranché.";
const OBSERVATION_EXTRACTOR_VERSION = "lenoseed-g0a3-behavioral-observation-v1";
const TESTIMONY_EXTRACTOR_VERSION = "lenoseed-g0a3-testimony-v1";

export type G0A3CalibrationFixtureSuffix =
  | "calibration-01-request"
  | "calibration-01-intention"
  | "calibration-01-failure"
  | "calibration-01-initial-explanation"
  | "calibration-01-correction";

export interface MaterializeG0A3InitialCalibrationEvidenceInput {
  readonly lenoseedId: EntityId;
  readonly configurationRequestEventId: EntityId;
  readonly intentionEventId: EntityId;
  readonly failureEventId: EntityId;
  readonly initialExplanationEventId: EntityId;
}

export interface MaterializeG0A3CorrectionEvidenceInput {
  readonly lenoseedId: EntityId;
  readonly initialExplanationEventId: EntityId;
  readonly correctionEventId: EntityId;
}

export interface MaterializeG0A3CalibrationEvidenceResult {
  readonly evidenceItemIds: readonly EntityId[];
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
  readonly changed: boolean;
  readonly replayed: boolean;
}

export async function materializeG0A3InitialCalibrationEvidence(
  input: MaterializeG0A3InitialCalibrationEvidenceInput,
  persistence: PersistencePort,
): Promise<MaterializeG0A3CalibrationEvidenceResult> {
  const fixtures = await readAndValidateInitialFixtures(input, persistence);
  const evidenceItems = [
    buildG0A3CalibrationObservation(fixtures.intention),
    buildG0A3CalibrationFailureTestimony(fixtures.failure),
    buildG0A3InitialFailureCauseTestimony(fixtures.initialExplanation),
  ];
  await validateEvidenceItems(evidenceItems, persistence);

  return commitEvidenceItems(
    input.lenoseedId,
    evidenceItems,
    initialCommitIdempotencyKey(input.lenoseedId),
    persistence,
  );
}

export async function materializeG0A3CorrectionEvidence(
  input: MaterializeG0A3CorrectionEvidenceInput,
  persistence: PersistencePort,
): Promise<MaterializeG0A3CalibrationEvidenceResult> {
  const initialExplanation = await readEvent(
    input.lenoseedId,
    input.initialExplanationEventId,
    persistence,
  );
  assertCanonicalG0A3FixtureIdentity(
    initialExplanation,
    input.lenoseedId,
    "calibration-01-initial-explanation",
  );
  await validateHumanFixture(
    initialExplanation,
    "initial_failure_explanation",
    INITIAL_EXPLANATION_TEXT,
    persistence,
  );

  const expectedE3 = buildG0A3InitialFailureCauseTestimony(initialExplanation);
  const actualE3 = await persistence.readEvidenceItem(input.lenoseedId, expectedE3.id);
  if (actualE3 === null || !jsonEquals(actualE3, expectedE3)) {
    throw new DomainInvariantError(`G0-A3 correction requires coherent initial EvidenceItem ${expectedE3.id}`);
  }
  const e3Rejection = await validateEvidenceItem(actualE3, persistence);
  if (e3Rejection !== null) {
    throw new DomainInvariantError(`G0-A3 initial EvidenceItem ${actualE3.id} failed grounding: ${e3Rejection}`);
  }

  const correction = await readEvent(input.lenoseedId, input.correctionEventId, persistence);
  assertCanonicalG0A3FixtureIdentity(
    correction,
    input.lenoseedId,
    "calibration-01-correction",
  );
  await validateHumanFixture(
    correction,
    "failure_explanation_correction",
    CORRECTION_TEXT,
    persistence,
  );
  if (correction.sequence <= initialExplanation.sequence) {
    throw new DomainInvariantError("G0-A3 correction must be strictly after the initial explanation");
  }

  const evidenceItems = [
    buildG0A3ConfigurationCompatibilityTestimony(correction),
    buildG0A3CorrectedFailureCauseTestimony(correction, expectedE3.id),
  ];
  await validateEvidenceItems(evidenceItems, persistence);

  return commitEvidenceItems(
    input.lenoseedId,
    evidenceItems,
    correctionCommitIdempotencyKey(input.lenoseedId),
    persistence,
  );
}

export function buildG0A3CalibrationObservation(sourceEvent: Event): EvidenceItem {
  return {
    id: `EV-G0A3-OBS-${sourceEvent.id}`,
    lenoseedId: sourceEvent.lenoseedId,
    kind: "behavioral_observation",
    proposition: {
      subjectRef: sourceEvent.lenoseedId,
      predicate: "selected_calibration_configuration",
      value: "A",
      context: { protocol: "G0-A3", episodeKey: G0A3_CALIBRATION_EPISODE_KEY },
    },
    sourceId: sourceEvent.sourceId,
    eventIds: [sourceEvent.id],
    grounding: { kind: "structured_event", eventId: sourceEvent.id },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: OBSERVATION_EXTRACTOR_VERSION,
    createdAt: sourceEvent.occurredAt,
  };
}

export function buildG0A3CalibrationFailureTestimony(sourceEvent: Event): EvidenceItem {
  return buildTestimony(sourceEvent, "outcome", {
    subjectRef: G0A3_OPERATOR_ACTOR_REF,
    predicate: "reported_calibration_outcome",
    value: "failure",
    context: { protocol: "G0-A3", episodeKey: G0A3_CALIBRATION_EPISODE_KEY },
  }, CALIBRATION_FAILURE_TEXT, null);
}

export function buildG0A3InitialFailureCauseTestimony(sourceEvent: Event): EvidenceItem {
  return buildTestimony(sourceEvent, "cause", {
    subjectRef: G0A3_OPERATOR_ACTOR_REF,
    predicate: "attributed_calibration_failure_cause",
    value: "configuration_a_sensor_incompatibility",
    context: { protocol: "G0-A3", episodeKey: G0A3_CALIBRATION_EPISODE_KEY },
  }, INITIAL_EXPLANATION_TEXT, null);
}

export function buildG0A3ConfigurationCompatibilityTestimony(sourceEvent: Event): EvidenceItem {
  return buildTestimony(sourceEvent, "compatibility", {
    subjectRef: G0A3_OPERATOR_ACTOR_REF,
    predicate: "reported_configuration_compatibility",
    value: "compatible",
    context: {
      protocol: "G0-A3",
      episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
      configuration: "A",
    },
  }, E4_SUPPORTING_EXCERPT, null);
}

export function buildG0A3CorrectedFailureCauseTestimony(
  sourceEvent: Event,
  supersedesId: EntityId,
): EvidenceItem {
  return buildTestimony(sourceEvent, "cause", {
    subjectRef: G0A3_OPERATOR_ACTOR_REF,
    predicate: "attributed_calibration_failure_cause",
    value: "cable_c_disconnected",
    context: { protocol: "G0-A3", episodeKey: G0A3_CALIBRATION_EPISODE_KEY },
  }, E5_SUPPORTING_EXCERPT, supersedesId);
}

export function initialCommitIdempotencyKey(lenoseedId: EntityId): string {
  return `g0a3:${lenoseedId}:${G0A3_CALIBRATION_EPISODE_KEY}:evidence:initial:commit`;
}

export function correctionCommitIdempotencyKey(lenoseedId: EntityId): string {
  return `g0a3:${lenoseedId}:${G0A3_CALIBRATION_EPISODE_KEY}:evidence:correction:commit`;
}

export function buildG0A3CalibrationFixtureEventId(
  lenoseedId: EntityId,
  suffix: G0A3CalibrationFixtureSuffix,
): EntityId {
  return `E-G0A3-${lenoseedId}-${suffix}`;
}

export function buildG0A3CalibrationFixtureEventIdempotencyKey(
  lenoseedId: EntityId,
  suffix: G0A3CalibrationFixtureSuffix,
): string {
  return `g0a3:${lenoseedId}:${G0A3_CALIBRATION_EPISODE_KEY}:fixture:${suffix}`;
}

function buildTestimony(
  sourceEvent: Event,
  role: "outcome" | "cause" | "compatibility",
  proposition: EvidenceItem["proposition"],
  supportingExcerpt: string,
  supersedesId: EntityId | null,
): EvidenceItem {
  return {
    id: `EV-G0A3-TESTIMONY-${sourceEvent.id}-${role}`,
    lenoseedId: sourceEvent.lenoseedId,
    kind: "testimony",
    proposition,
    sourceId: sourceEvent.sourceId,
    eventIds: [sourceEvent.id],
    grounding: {
      kind: "text_excerpt",
      eventId: sourceEvent.id,
      supportingExcerpt,
    },
    extractionConfidence: "high",
    status: "active",
    supersedesId,
    extractorVersion: TESTIMONY_EXTRACTOR_VERSION,
    createdAt: sourceEvent.occurredAt,
  };
}

async function readAndValidateInitialFixtures(
  input: MaterializeG0A3InitialCalibrationEvidenceInput,
  persistence: PersistencePort,
): Promise<{ readonly intention: Event; readonly failure: Event; readonly initialExplanation: Event }> {
  const request = await readEvent(input.lenoseedId, input.configurationRequestEventId, persistence);
  assertCanonicalG0A3FixtureIdentity(request, input.lenoseedId, "calibration-01-request");
  await validateHumanFixture(request, "configuration_request", CONFIGURATION_REQUEST_TEXT, persistence);

  const intention = await readEvent(input.lenoseedId, input.intentionEventId, persistence);
  await validateInitialIntention(intention, request, persistence);

  const failure = await readEvent(input.lenoseedId, input.failureEventId, persistence);
  assertCanonicalG0A3FixtureIdentity(failure, input.lenoseedId, "calibration-01-failure");
  await validateHumanFixture(failure, "calibration_failure_report", CALIBRATION_FAILURE_TEXT, persistence);
  if (failure.sequence <= intention.sequence) {
    throw new DomainInvariantError("G0-A3 failure report must be strictly after the calibration intention");
  }

  const initialExplanation = await readEvent(
    input.lenoseedId,
    input.initialExplanationEventId,
    persistence,
  );
  assertCanonicalG0A3FixtureIdentity(
    initialExplanation,
    input.lenoseedId,
    "calibration-01-initial-explanation",
  );
  await validateHumanFixture(
    initialExplanation,
    "initial_failure_explanation",
    INITIAL_EXPLANATION_TEXT,
    persistence,
  );
  if (initialExplanation.sequence <= failure.sequence) {
    throw new DomainInvariantError("G0-A3 initial explanation must be strictly after the failure report");
  }

  return { intention, failure, initialExplanation };
}

async function validateInitialIntention(
  event: Event,
  request: Event,
  persistence: PersistencePort,
): Promise<void> {
  assertCanonicalG0A3FixtureIdentity(event, request.lenoseedId, "calibration-01-intention");
  const source = await persistence.readSource(event.sourceId);
  if (event.sourceId !== G0A3_SYSTEM_SOURCE_ID || source?.kind !== "system") {
    throw new DomainInvariantError(`G0-A3 calibration intention ${event.id} must use the system source`);
  }
  if (event.type !== "intention_selected" || event.payloadSchemaVersion !== 3) {
    throw new DomainInvariantError(`G0-A3 calibration intention ${event.id} must be schema v3`);
  }
  if (event.sequence <= request.sequence) {
    throw new DomainInvariantError("G0-A3 calibration intention must be strictly after the request");
  }
  const expectedPayload = {
    intentionId: `I-G0A3-${event.lenoseedId}-CALIBRATION-01`,
    protocol: "G0-A3",
    episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
    kind: "run_calibration_with_configuration_a",
    motivation: "execute_requested_calibration_configuration",
    triggerEventIds: [request.id],
    triggerMemoryIds: [],
  };
  if (
    !jsonEquals(event.payload, expectedPayload) ||
    !hasExactly(event.causedByEventIds, [request.id])
  ) {
    throw new DomainInvariantError(`G0-A3 calibration intention ${event.id} has invalid payload or causes`);
  }
}

function assertCanonicalG0A3FixtureIdentity(
  event: Event,
  lenoseedId: EntityId,
  suffix: G0A3CalibrationFixtureSuffix,
): void {
  if (event.id !== buildG0A3CalibrationFixtureEventId(lenoseedId, suffix)) {
    throw new DomainInvariantError(`G0-A3 fixture ${event.id} has non-canonical id`);
  }
  if (event.idempotencyKey !== buildG0A3CalibrationFixtureEventIdempotencyKey(lenoseedId, suffix)) {
    throw new DomainInvariantError(`G0-A3 fixture ${event.id} has non-canonical idempotencyKey`);
  }
}

async function validateHumanFixture(
  event: Event,
  fixtureKind: string,
  text: string,
  persistence: PersistencePort,
): Promise<void> {
  const source = await persistence.readSource(event.sourceId);
  if (
    event.sourceId !== G0A3_OPERATOR_SOURCE_ID ||
    source?.kind !== "human" ||
    source.actorRef !== G0A3_OPERATOR_ACTOR_REF
  ) {
    throw new DomainInvariantError(`G0-A3 fixture ${event.id} must use the canonical operator source`);
  }
  if (event.type !== "human_message_received" || event.payloadSchemaVersion !== 3) {
    throw new DomainInvariantError(`G0-A3 fixture ${event.id} must be a human_message_received schema v3`);
  }
  if (!jsonEquals(event.payload, {
    text,
    protocol: "G0-A3",
    episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
    fixtureKind,
  })) {
    throw new DomainInvariantError(`G0-A3 fixture ${event.id} has invalid payload`);
  }
}

async function readEvent(
  lenoseedId: EntityId,
  eventId: EntityId,
  persistence: PersistencePort,
): Promise<Event> {
  const event = await persistence.readEventById(lenoseedId, eventId);
  if (event === null || event.lenoseedId !== lenoseedId) {
    throw new DomainInvariantError(`G0-A3 fixture ${eventId} does not belong to ${lenoseedId}`);
  }
  return event;
}

async function validateEvidenceItems(
  evidenceItems: readonly EvidenceItem[],
  persistence: PersistencePort,
): Promise<void> {
  for (const evidenceItem of evidenceItems) {
    const rejection = await validateEvidenceItem(evidenceItem, persistence);
    if (rejection !== null) {
      throw new DomainInvariantError(`G0-A3 EvidenceItem ${evidenceItem.id} failed grounding: ${rejection}`);
    }
  }
}

async function commitEvidenceItems(
  lenoseedId: EntityId,
  evidenceItems: readonly EvidenceItem[],
  idempotencyKey: string,
  persistence: PersistencePort,
): Promise<MaterializeG0A3CalibrationEvidenceResult> {
  const replayed = await persistence.checkIdempotencyKey(lenoseedId, idempotencyKey);
  const commit = await persistence.atomicCommit(
    lenoseedId,
    await persistence.getStateVersion(lenoseedId),
    { evidenceItems, evidenceLinks: [], beliefs: [], selfHypotheses: [], memories: [] },
    idempotencyKey,
  );
  return {
    evidenceItemIds: evidenceItems.map((evidenceItem) => evidenceItem.id),
    previousStateVersion: commit.previousStateVersion,
    newStateVersion: commit.newStateVersion,
    changed: commit.applied,
    replayed,
  };
}

function hasExactly(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
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
