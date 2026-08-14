import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import { buildG0A3MemoryKey, type Memory } from "../domain/memory.js";
import type { EntityId, SerializableValue, StateVersion } from "../domain/primitives.js";
import type { PersistencePort } from "../ports/persistence.js";
import {
  G0A3_CALIBRATION_EPISODE_KEY,
  G0A3_SYSTEM_SOURCE_ID,
} from "./materialize-g0a3-calibration-evidence.js";
import {
  buildG0A3InitialMemory,
  buildG0A3RevisedMemory,
  initialIds,
  revisedIds,
  type G0A3MemoryValidationContext,
  validateG0A3Memory,
} from "./validate-g0a3-memory.js";

const SCOPE = "memory_consolidation";
const ACTION = "revise";

export interface ReviseG0A3MemoryInput {
  readonly lenoseedId: EntityId;
  readonly episodeKey: typeof G0A3_CALIBRATION_EPISODE_KEY;
  readonly systemSourceId: EntityId;
  readonly evidenceItemIds: readonly EntityId[];
  readonly expectedStateVersion: StateVersion;
  readonly engineVersion: string;
}

export interface ReviseG0A3MemoryResult {
  readonly memory: Memory;
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
  readonly changed: boolean;
  readonly replayed: boolean;
}

interface RevisionPlan {
  readonly operationId: string;
  readonly checkpointId: EntityId;
  readonly checkpointIdempotencyKey: string;
  readonly commitIdempotencyKey: string;
  readonly completionId: EntityId;
  readonly completionIdempotencyKey: string;
  readonly priorMemorySnapshot: Memory;
  readonly nextMemorySnapshot: Memory;
  readonly inputEventIds: readonly EntityId[];
  readonly inputEvidenceItemIds: readonly EntityId[];
  readonly expectedStateVersion: StateVersion;
  readonly engineVersion: string;
}

interface HistoricalBoundary {
  readonly checkpoint: Event | null;
  readonly completion: Event | null;
}

/** Applies the bounded, atomic G0-A3 calibration Memory v1 to v2 revision. */
export async function reviseG0A3Memory(
  input: ReviseG0A3MemoryInput,
  persistence: PersistencePort,
): Promise<ReviseG0A3MemoryResult> {
  assertInput(input);
  await assertSystemSource(input, persistence);
  const events = await persistence.readEventsInSequence(input.lenoseedId);
  if (!events.some((event) => event.type === "lenoseed_created")) {
    throw new DomainInvariantError("G0-A3 Memory revision requires an existing Lenoseed");
  }

  const historical = findRevisionBoundary(events, input.lenoseedId);
  if (historical.completion !== null && historical.checkpoint === null) {
    throw new DomainInvariantError("G0-A3 Memory revision completion exists without its checkpoint");
  }

  let plan: RevisionPlan;
  if (historical.checkpoint === null) {
    const context = await readValidationContext(input.lenoseedId, persistence);
    plan = await buildFreshPlan(input, events, context, persistence);
    if ((await persistence.getStateVersion(input.lenoseedId)) !== input.expectedStateVersion) {
      throw new DomainInvariantError("G0-A3 Memory revision expectedStateVersion does not match the checkpoint boundary");
    }
    await persistence.appendEvent(buildRevisionCheckpoint(input, plan, nextSequence(events)));
  } else {
    plan = await parseRevisionCheckpoint(historical.checkpoint, input, events, persistence);
  }

  if (historical.completion !== null) {
    await validateRevisionCompletion(historical.completion, input, plan, persistence);
    await validateRevisionDurable(input, plan, persistence);
    return completedResult(plan, true);
  }

  const committed = await persistence.checkIdempotencyKey(input.lenoseedId, plan.commitIdempotencyKey);
  if (!committed) {
    await validatePreCommitBoundary(input, plan, persistence);
  } else {
    await validateRevisionDurable(input, plan, persistence);
  }

  const commit = await persistence.atomicCommit(
    input.lenoseedId,
    plan.expectedStateVersion,
    revisionMutations(plan),
    plan.commitIdempotencyKey,
  );
  await validateRevisionDurable(input, plan, persistence);
  const eventsAfterCommit = await persistence.readEventsInSequence(input.lenoseedId);
  await persistence.appendEvent(
    buildRevisionCompletion(
      input,
      plan,
      commit.previousStateVersion,
      commit.newStateVersion,
      nextSequence(eventsAfterCommit),
    ),
  );
  return {
    memory: plan.nextMemorySnapshot,
    previousStateVersion: commit.previousStateVersion,
    newStateVersion: commit.newStateVersion,
    changed: commit.applied,
    replayed: committed,
  };
}

function assertInput(input: ReviseG0A3MemoryInput): void {
  const ids = revisedIds(input.lenoseedId);
  if (
    input.episodeKey !== G0A3_CALIBRATION_EPISODE_KEY ||
    input.systemSourceId !== G0A3_SYSTEM_SOURCE_ID ||
    !sameList(input.evidenceItemIds, [ids.e1Id, ids.e2Id, ids.e4Id, ids.e5Id]) ||
    !Number.isInteger(input.expectedStateVersion) ||
    input.expectedStateVersion < 0 ||
    input.engineVersion.length === 0
  ) {
    throw new DomainInvariantError("G0-A3 Memory revision input is not canonical");
  }
}

async function assertSystemSource(input: ReviseG0A3MemoryInput, persistence: PersistencePort): Promise<void> {
  const source = await persistence.readSource(input.systemSourceId);
  if (source?.kind !== "system") {
    throw new DomainInvariantError("G0-A3 Memory revision requires the canonical system source");
  }
}

async function buildFreshPlan(
  input: ReviseG0A3MemoryInput,
  events: readonly Event[],
  context: G0A3MemoryValidationContext,
  persistence: PersistencePort,
): Promise<RevisionPlan> {
  const priorMemorySnapshot = await readValidatedInitialBoundary(
    input.lenoseedId,
    events,
    context,
    persistence,
  );
  if (!sameValue(context.memoryHistory, [priorMemorySnapshot])) {
    throw new DomainInvariantError("G0-A3 Memory revision requires exactly the current active v1");
  }

  const correction = context.eventsById.get(revisedIds(input.lenoseedId).correctionEventId);
  if (correction === undefined) throw new DomainInvariantError("G0-A3 Memory correction is unavailable");
  const nextMemorySnapshot = buildG0A3RevisedMemory(
    input.lenoseedId,
    correction.occurredAt,
    priorMemorySnapshot.id,
  );
  validateG0A3Memory(nextMemorySnapshot, {
    ...context,
    memoryHistory: [priorMemorySnapshot],
    revisedMemoryValidationMode: "planned",
  });
  return buildPlan(input, priorMemorySnapshot, nextMemorySnapshot);
}

function buildPlan(
  input: ReviseG0A3MemoryInput,
  priorMemorySnapshot: Memory,
  nextMemorySnapshot: Memory,
): RevisionPlan {
  const initial = initialIds(input.lenoseedId);
  const revised = revisedIds(input.lenoseedId);
  return {
    operationId: revisionOperationId(input.lenoseedId),
    checkpointId: revisionCheckpointId(input.lenoseedId),
    checkpointIdempotencyKey: revisionDecisionKey(input.lenoseedId),
    commitIdempotencyKey: revisionCommitKey(input.lenoseedId),
    completionId: revisionCompletionId(input.lenoseedId),
    completionIdempotencyKey: revisionCompletedKey(input.lenoseedId),
    priorMemorySnapshot,
    nextMemorySnapshot,
    inputEventIds: [initial.intentionEventId, initial.failureEventId, revised.correctionEventId],
    inputEvidenceItemIds: [revised.e1Id, revised.e2Id, revised.e4Id, revised.e5Id],
    expectedStateVersion: input.expectedStateVersion,
    engineVersion: input.engineVersion,
  };
}

function buildRevisionCheckpoint(
  input: ReviseG0A3MemoryInput,
  plan: RevisionPlan,
  sequence: number,
): Event {
  return {
    id: plan.checkpointId,
    lenoseedId: input.lenoseedId,
    sequence,
    type: "validation_decision_recorded",
    occurredAt: plan.nextMemorySnapshot.createdAt,
    turnId: null,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: [revisedIds(input.lenoseedId).correctionEventId, initialCheckpointId(input.lenoseedId)],
    observedStateVersion: plan.expectedStateVersion,
    payload: {
      scope: SCOPE,
      operationId: plan.operationId,
      action: ACTION,
      memoryKey: plan.nextMemorySnapshot.memoryKey,
      episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
      version: 2,
      inputEventIds: plan.inputEventIds,
      inputEvidenceItemIds: plan.inputEvidenceItemIds,
      priorMemorySnapshot: plan.priorMemorySnapshot as unknown as SerializableValue,
      nextMemorySnapshot: plan.nextMemorySnapshot as unknown as SerializableValue,
      expectedStateVersion: plan.expectedStateVersion,
    },
    payloadSchemaVersion: 4,
    engineVersion: plan.engineVersion,
    idempotencyKey: plan.checkpointIdempotencyKey,
  };
}

function buildRevisionCompletion(
  input: ReviseG0A3MemoryInput,
  plan: RevisionPlan,
  previousStateVersion: StateVersion,
  newStateVersion: StateVersion,
  sequence: number,
): Event {
  return {
    id: plan.completionId,
    lenoseedId: input.lenoseedId,
    sequence,
    type: "state_commit_completed",
    occurredAt: plan.nextMemorySnapshot.createdAt,
    turnId: null,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: [plan.checkpointId],
    observedStateVersion: previousStateVersion,
    payload: {
      scope: SCOPE,
      operationId: plan.operationId,
      action: ACTION,
      memoryKey: plan.nextMemorySnapshot.memoryKey,
      version: 2,
      previousStateVersion,
      newStateVersion,
      changed: true,
    },
    payloadSchemaVersion: 3,
    engineVersion: plan.engineVersion,
    idempotencyKey: plan.completionIdempotencyKey,
  };
}

async function parseRevisionCheckpoint(
  checkpoint: Event,
  input: ReviseG0A3MemoryInput,
  events: readonly Event[],
  persistence: PersistencePort,
): Promise<RevisionPlan> {
  const priorMemorySnapshot = parseMemory(checkpoint.payload.priorMemorySnapshot);
  const nextMemorySnapshot = parseMemory(checkpoint.payload.nextMemorySnapshot);
  const plan = buildPlan(input, priorMemorySnapshot, nextMemorySnapshot);
  if (!sameValue(checkpoint, buildRevisionCheckpoint(input, plan, checkpoint.sequence))) {
    throw new DomainInvariantError("G0-A3 Memory revision checkpoint is incompatible");
  }

  const context = await readValidationContext(input.lenoseedId, persistence);
  const canonicalV1 = await readValidatedInitialBoundary(input.lenoseedId, events, context, persistence);
  if (!sameValue(plan.priorMemorySnapshot, canonicalV1)) {
    throw new DomainInvariantError("G0-A3 Memory revision checkpoint has an invalid prior snapshot");
  }
  validateG0A3Memory(plan.priorMemorySnapshot, { ...context, memoryHistory: [canonicalV1] });
  validateG0A3Memory(plan.nextMemorySnapshot, {
    ...context,
    memoryHistory: [canonicalV1],
    revisedMemoryValidationMode: "planned",
  });
  return plan;
}

async function validatePreCommitBoundary(
  input: ReviseG0A3MemoryInput,
  plan: RevisionPlan,
  persistence: PersistencePort,
): Promise<void> {
  if ((await persistence.getStateVersion(input.lenoseedId)) !== plan.expectedStateVersion) {
    throw new DomainInvariantError("G0-A3 Memory revision checkpoint boundary no longer matches durable state");
  }
  const context = await readValidationContext(input.lenoseedId, persistence);
  if (!sameValue(context.memoryHistory, [plan.priorMemorySnapshot])) {
    throw new DomainInvariantError("G0-A3 Memory revision durable state is partial before its commit");
  }
  validateG0A3Memory(plan.priorMemorySnapshot, { ...context, memoryHistory: [plan.priorMemorySnapshot] });
  validateG0A3Memory(plan.nextMemorySnapshot, {
    ...context,
    memoryHistory: [plan.priorMemorySnapshot],
    revisedMemoryValidationMode: "planned",
  });
}

async function validateRevisionDurable(
  input: ReviseG0A3MemoryInput,
  plan: RevisionPlan,
  persistence: PersistencePort,
): Promise<void> {
  const context = await readValidationContext(input.lenoseedId, persistence);
  const revisedV1 = { ...plan.priorMemorySnapshot, status: "revised" as const };
  if (!sameValue(context.memoryHistory, [revisedV1, plan.nextMemorySnapshot])) {
    throw new DomainInvariantError("G0-A3 Memory revision durable history differs from its checkpoint");
  }
  validateG0A3Memory(revisedV1, {
    ...context,
    revisedMemoryValidationMode: "durable",
  });
  validateG0A3Memory(plan.nextMemorySnapshot, {
    ...context,
    revisedMemoryValidationMode: "durable",
  });
  const active = await persistence.readActiveMemoryByKey(input.lenoseedId, plan.nextMemorySnapshot.memoryKey);
  const storedV1 = await persistence.readMemory(input.lenoseedId, plan.priorMemorySnapshot.id);
  const storedV2 = await persistence.readMemory(input.lenoseedId, plan.nextMemorySnapshot.id);
  if (!sameValue(active, plan.nextMemorySnapshot) || !sameValue(storedV1, revisedV1) || !sameValue(storedV2, plan.nextMemorySnapshot)) {
    throw new DomainInvariantError("G0-A3 Memory revision durable reads differ from its checkpoint");
  }
}

async function validateRevisionCompletion(
  completion: Event,
  input: ReviseG0A3MemoryInput,
  plan: RevisionPlan,
  persistence: PersistencePort,
): Promise<void> {
  const expected = buildRevisionCompletion(
    input,
    plan,
    plan.expectedStateVersion,
    plan.expectedStateVersion + 1,
    completion.sequence,
  );
  if (!sameValue(completion, expected)) {
    throw new DomainInvariantError("G0-A3 Memory revision completion is incompatible");
  }
  if (!(await persistence.checkIdempotencyKey(input.lenoseedId, plan.commitIdempotencyKey))) {
    throw new DomainInvariantError("G0-A3 Memory revision completion announces a missing commit");
  }
}

async function readValidatedInitialBoundary(
  lenoseedId: EntityId,
  events: readonly Event[],
  context: G0A3MemoryValidationContext,
  persistence: PersistencePort,
): Promise<Memory> {
  const historical = findInitialBoundary(events, lenoseedId);
  if (historical.checkpoint === null || historical.completion === null) {
    throw new DomainInvariantError("G0-A3 Memory revision requires a complete initial Memory boundary");
  }
  if (historical.completion.sequence <= historical.checkpoint.sequence) {
    throw new DomainInvariantError("G0-A3 initial Memory completion precedes its checkpoint");
  }
  const initialExplanation = context.eventsById.get(initialIds(lenoseedId).initialExplanationEventId);
  if (initialExplanation === undefined) throw new DomainInvariantError("G0-A3 initial explanation is unavailable");
  const priorMemorySnapshot = buildG0A3InitialMemory(lenoseedId, initialExplanation.occurredAt);
  const expectedCheckpoint = buildInitialCheckpoint(
    lenoseedId,
    priorMemorySnapshot,
    historical.checkpoint.observedStateVersion,
    historical.checkpoint.engineVersion,
    historical.checkpoint.sequence,
  );
  if (
    historical.checkpoint.engineVersion.length === 0 ||
    !sameValue(historical.checkpoint, expectedCheckpoint)
  ) {
    throw new DomainInvariantError("G0-A3 initial Memory checkpoint is incompatible");
  }
  const expectedCompletion = buildInitialCompletion(
    lenoseedId,
    priorMemorySnapshot,
    historical.checkpoint.observedStateVersion,
    historical.checkpoint.engineVersion,
    historical.completion.sequence,
  );
  if (!sameValue(historical.completion, expectedCompletion)) {
    throw new DomainInvariantError("G0-A3 initial Memory completion is incompatible");
  }
  if (!(await persistence.checkIdempotencyKey(lenoseedId, initialCommitKey(lenoseedId)))) {
    throw new DomainInvariantError("G0-A3 initial Memory completion announces a missing commit");
  }
  validateG0A3Memory(priorMemorySnapshot, { ...context, memoryHistory: [priorMemorySnapshot] });
  return priorMemorySnapshot;
}

function buildInitialCheckpoint(
  lenoseedId: EntityId,
  memory: Memory,
  expectedStateVersion: StateVersion,
  engineVersion: string,
  sequence: number,
): Event {
  const ids = initialIds(lenoseedId);
  return {
    id: initialCheckpointId(lenoseedId),
    lenoseedId,
    sequence,
    type: "validation_decision_recorded",
    occurredAt: memory.createdAt,
    turnId: null,
    sourceId: G0A3_SYSTEM_SOURCE_ID,
    actorRef: null,
    causedByEventIds: [ids.intentionEventId, ids.failureEventId, ids.initialExplanationEventId],
    observedStateVersion: expectedStateVersion,
    payload: {
      scope: SCOPE,
      operationId: initialOperationId(lenoseedId),
      action: "create",
      memoryKey: memory.memoryKey,
      episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
      version: 1,
      inputEventIds: [ids.intentionEventId, ids.failureEventId, ids.initialExplanationEventId],
      inputEvidenceItemIds: [ids.e1Id, ids.e2Id, ids.e3Id],
      priorMemorySnapshot: null,
      nextMemorySnapshot: memory as unknown as SerializableValue,
      expectedStateVersion,
    },
    payloadSchemaVersion: 4,
    engineVersion,
    idempotencyKey: initialDecisionKey(lenoseedId),
  };
}

function buildInitialCompletion(
  lenoseedId: EntityId,
  memory: Memory,
  previousStateVersion: StateVersion,
  engineVersion: string,
  sequence: number,
): Event {
  return {
    id: initialCompletionId(lenoseedId),
    lenoseedId,
    sequence,
    type: "state_commit_completed",
    occurredAt: memory.createdAt,
    turnId: null,
    sourceId: G0A3_SYSTEM_SOURCE_ID,
    actorRef: null,
    causedByEventIds: [initialCheckpointId(lenoseedId)],
    observedStateVersion: previousStateVersion,
    payload: {
      scope: SCOPE,
      operationId: initialOperationId(lenoseedId),
      action: "create",
      memoryKey: memory.memoryKey,
      version: 1,
      previousStateVersion,
      newStateVersion: previousStateVersion + 1,
      changed: true,
    },
    payloadSchemaVersion: 3,
    engineVersion,
    idempotencyKey: initialCompletedKey(lenoseedId),
  };
}

async function readValidationContext(
  lenoseedId: EntityId,
  persistence: PersistencePort,
): Promise<G0A3MemoryValidationContext> {
  const initial = initialIds(lenoseedId);
  const revised = revisedIds(lenoseedId);
  const events = await Promise.all([
    requireEvent(persistence, lenoseedId, initial.requestEventId),
    requireEvent(persistence, lenoseedId, initial.intentionEventId),
    requireEvent(persistence, lenoseedId, initial.failureEventId),
    requireEvent(persistence, lenoseedId, initial.initialExplanationEventId),
    requireEvent(persistence, lenoseedId, revised.correctionEventId),
  ]);
  const evidence = await Promise.all([
    requireEvidence(persistence, lenoseedId, revised.e1Id),
    requireEvidence(persistence, lenoseedId, revised.e2Id),
    requireEvidence(persistence, lenoseedId, initial.e3Id),
    requireEvidence(persistence, lenoseedId, revised.e4Id),
    requireEvidence(persistence, lenoseedId, revised.e5Id),
  ]);
  const sources = await Promise.all([...new Set(events.map((event) => event.sourceId))].map(async (sourceId) => {
    const source = await persistence.readSource(sourceId);
    if (source === null) throw new DomainInvariantError(`G0-A3 Memory source ${sourceId} is unavailable`);
    return source;
  }));
  return {
    eventsById: new Map(events.map((event) => [event.id, event])),
    evidenceItemsById: new Map(evidence.map((item) => [item.id, item])),
    sourcesById: new Map(sources.map((source) => [source.id, source])),
    memoryHistory: await persistence.readMemoryHistoryByKey(
      lenoseedId,
      buildG0A3MemoryKey(lenoseedId, G0A3_CALIBRATION_EPISODE_KEY),
    ),
  };
}

async function requireEvent(persistence: PersistencePort, lenoseedId: EntityId, id: EntityId): Promise<Event> {
  const event = await persistence.readEventById(lenoseedId, id);
  if (event === null) throw new DomainInvariantError(`G0-A3 Memory Event ${id} is unavailable`);
  return event;
}

async function requireEvidence(
  persistence: PersistencePort,
  lenoseedId: EntityId,
  id: EntityId,
): Promise<EvidenceItem> {
  const evidence = await persistence.readEvidenceItem(lenoseedId, id);
  if (evidence === null) throw new DomainInvariantError(`G0-A3 Memory EvidenceItem ${id} is unavailable`);
  return evidence;
}

function findRevisionBoundary(events: readonly Event[], lenoseedId: EntityId): HistoricalBoundary {
  return findBoundary(
    events,
    revisionCheckpointId(lenoseedId),
    revisionCompletionId(lenoseedId),
    revisionDecisionKey(lenoseedId),
    revisionCompletedKey(lenoseedId),
    revisionOperationId(lenoseedId),
    "revision",
  );
}

function findInitialBoundary(events: readonly Event[], lenoseedId: EntityId): HistoricalBoundary {
  return findBoundary(
    events,
    initialCheckpointId(lenoseedId),
    initialCompletionId(lenoseedId),
    initialDecisionKey(lenoseedId),
    initialCompletedKey(lenoseedId),
    initialOperationId(lenoseedId),
    "initial",
  );
}

function findBoundary(
  events: readonly Event[],
  checkpointId: EntityId,
  completionId: EntityId,
  checkpointKey: string,
  completionKey: string,
  operationId: string,
  label: string,
): HistoricalBoundary {
  const checkpoints = events.filter((event) =>
    event.id === checkpointId ||
    event.idempotencyKey === checkpointKey ||
    (event.type === "validation_decision_recorded" && event.payload.scope === SCOPE && event.payload.operationId === operationId),
  );
  const completions = events.filter((event) =>
    event.id === completionId ||
    event.idempotencyKey === completionKey ||
    (event.type === "state_commit_completed" && event.payload.scope === SCOPE && event.payload.operationId === operationId),
  );
  if (checkpoints.length > 1 || completions.length > 1) {
    throw new DomainInvariantError(`G0-A3 Memory ${label} boundary is not unique`);
  }
  return { checkpoint: checkpoints[0] ?? null, completion: completions[0] ?? null };
}

function parseMemory(value: SerializableValue | undefined): Memory {
  const memoryFields = [
    "id", "lenoseedId", "memoryKey", "episodeKey", "version", "eventIds", "evidenceItemIds",
    "gist", "createdAt", "salience", "confidence", "status", "revisionOf", "lastRecalledAt",
  ];
  const ownKeys = isRecord(value) ? Reflect.ownKeys(value) : [];
  if (
    !isRecord(value) ||
    ownKeys.length !== memoryFields.length ||
    !ownKeys.every((key) => typeof key === "string" && memoryFields.includes(key)) ||
    !memoryFields.every((field) => Object.hasOwn(value, field)) ||
    !isStringArray(value.eventIds) ||
    !isStringArray(value.evidenceItemIds)
  ) {
    throw new DomainInvariantError("G0-A3 Memory revision checkpoint has an invalid snapshot");
  }
  if (
    typeof value.id !== "string" || typeof value.lenoseedId !== "string" ||
    typeof value.memoryKey !== "string" || typeof value.episodeKey !== "string" ||
    typeof value.version !== "number" || typeof value.gist !== "string" ||
    typeof value.createdAt !== "string" || typeof value.salience !== "string" ||
    typeof value.confidence !== "string" || typeof value.status !== "string" ||
    !(typeof value.revisionOf === "string" || value.revisionOf === null) ||
    !(typeof value.lastRecalledAt === "string" || value.lastRecalledAt === null)
  ) throw new DomainInvariantError("G0-A3 Memory revision checkpoint has an invalid snapshot");
  return {
    id: value.id,
    lenoseedId: value.lenoseedId,
    memoryKey: value.memoryKey,
    episodeKey: value.episodeKey,
    version: value.version,
    eventIds: [...value.eventIds],
    evidenceItemIds: [...value.evidenceItemIds],
    gist: value.gist,
    createdAt: value.createdAt,
    salience: value.salience as Memory["salience"],
    confidence: value.confidence as Memory["confidence"],
    status: value.status as Memory["status"],
    revisionOf: value.revisionOf,
    lastRecalledAt: value.lastRecalledAt,
  };
}

function revisionMutations(plan: RevisionPlan) {
  return {
    evidenceItems: [],
    evidenceLinks: [],
    beliefs: [],
    selfHypotheses: [],
    memories: [{ ...plan.priorMemorySnapshot, status: "revised" as const }, plan.nextMemorySnapshot],
  };
}

function completedResult(plan: RevisionPlan, replayed: boolean): ReviseG0A3MemoryResult {
  return {
    memory: plan.nextMemorySnapshot,
    previousStateVersion: plan.expectedStateVersion,
    newStateVersion: plan.expectedStateVersion + 1,
    changed: true,
    replayed,
  };
}

function initialOperationId(lenoseedId: EntityId): string {
  return `g0a3:${lenoseedId}:${G0A3_CALIBRATION_EPISODE_KEY}:v1:create`;
}
function initialDecisionKey(lenoseedId: EntityId): string { return `${initialOperationId(lenoseedId)}:decision`; }
function initialCommitKey(lenoseedId: EntityId): string { return `${initialOperationId(lenoseedId)}:commit`; }
function initialCompletedKey(lenoseedId: EntityId): string { return `${initialOperationId(lenoseedId)}:completed`; }
function initialCheckpointId(lenoseedId: EntityId): EntityId {
  return `E-G0A3-${lenoseedId}-${G0A3_CALIBRATION_EPISODE_KEY}-v1-create-decision`;
}
function initialCompletionId(lenoseedId: EntityId): EntityId {
  return `E-G0A3-${lenoseedId}-${G0A3_CALIBRATION_EPISODE_KEY}-v1-create-completed`;
}
function revisionOperationId(lenoseedId: EntityId): string {
  return `g0a3:${lenoseedId}:${G0A3_CALIBRATION_EPISODE_KEY}:v2:revise`;
}
function revisionDecisionKey(lenoseedId: EntityId): string { return `${revisionOperationId(lenoseedId)}:decision`; }
function revisionCommitKey(lenoseedId: EntityId): string { return `${revisionOperationId(lenoseedId)}:commit`; }
function revisionCompletedKey(lenoseedId: EntityId): string { return `${revisionOperationId(lenoseedId)}:completed`; }
function revisionCheckpointId(lenoseedId: EntityId): EntityId {
  return `E-G0A3-${lenoseedId}-${G0A3_CALIBRATION_EPISODE_KEY}-v2-revise-decision`;
}
function revisionCompletionId(lenoseedId: EntityId): EntityId {
  return `E-G0A3-${lenoseedId}-${G0A3_CALIBRATION_EPISODE_KEY}-v2-revise-completed`;
}

function sameList(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isRecord(value: unknown): value is Readonly<Record<string, SerializableValue>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nextSequence(events: readonly Event[]): number { return (events.at(-1)?.sequence ?? 0) + 1; }
function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value as Readonly<Record<string, unknown>>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, canonicalize(nested)]));
}
