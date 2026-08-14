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
  initialIds,
  type G0A3MemoryValidationContext,
  validateG0A3Memory,
} from "./validate-g0a3-memory.js";

const SCOPE = "memory_consolidation";
const ACTION = "create";

export interface ConsolidateG0A3MemoryInput {
  readonly lenoseedId: EntityId;
  readonly episodeKey: typeof G0A3_CALIBRATION_EPISODE_KEY;
  readonly systemSourceId: EntityId;
  readonly evidenceItemIds: readonly EntityId[];
  readonly expectedStateVersion: StateVersion;
  readonly engineVersion: string;
}

export interface ConsolidateG0A3MemoryResult {
  readonly memory: Memory;
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
  readonly changed: boolean;
  readonly replayed: boolean;
}

interface CreatePlan {
  readonly operationId: string;
  readonly checkpointId: EntityId;
  readonly checkpointIdempotencyKey: string;
  readonly commitIdempotencyKey: string;
  readonly completionId: EntityId;
  readonly completionIdempotencyKey: string;
  readonly memory: Memory;
  readonly inputEventIds: readonly EntityId[];
  readonly inputEvidenceItemIds: readonly EntityId[];
  readonly expectedStateVersion: StateVersion;
  readonly engineVersion: string;
}

export async function consolidateG0A3Memory(
  input: ConsolidateG0A3MemoryInput,
  persistence: PersistencePort,
): Promise<ConsolidateG0A3MemoryResult> {
  assertInput(input);
  await assertSystemSource(input, persistence);
  const events = await persistence.readEventsInSequence(input.lenoseedId);
  const historical = findHistoricalEvents(events, input);
  if (historical.completion !== null && historical.checkpoint === null) {
    throw new DomainInvariantError("G0-A3 Memory completion exists without its checkpoint");
  }

  let plan: CreatePlan;
  if (historical.checkpoint !== null) {
    plan = await parseCheckpoint(historical.checkpoint, input, persistence);
  } else {
    await assertNoCorrectionBeforeCreate(input.lenoseedId, persistence);
    const context = await readValidationContext(input.lenoseedId, persistence);
    if (context.memoryHistory.length !== 0) {
      throw new DomainInvariantError("G0-A3 initial Memory cannot be created with existing history");
    }
    const createdAt = context.eventsById.get(initialIds(input.lenoseedId).initialExplanationEventId)?.occurredAt;
    if (createdAt === undefined) throw new DomainInvariantError("G0-A3 initial explanation is unavailable");
    plan = buildPlan(input, buildG0A3InitialMemory(input.lenoseedId, createdAt));
    validateG0A3Memory(plan.memory, context);
    if ((await persistence.getStateVersion(input.lenoseedId)) !== input.expectedStateVersion) {
      throw new DomainInvariantError("G0-A3 Memory expectedStateVersion does not match the checkpoint boundary");
    }
    await persistence.appendEvent(buildCheckpoint(input, plan, nextSequence(events)));
  }

  if (historical.completion !== null) {
    await validateCompletion(historical.completion, plan, input, persistence);
    await validateDurable(plan, input, persistence);
    return {
      memory: plan.memory,
      previousStateVersion: plan.expectedStateVersion,
      newStateVersion: plan.expectedStateVersion + 1,
      changed: true,
      replayed: true,
    };
  }

  const committed = await persistence.checkIdempotencyKey(input.lenoseedId, plan.commitIdempotencyKey);
  if (!committed) {
    const stateVersion = await persistence.getStateVersion(input.lenoseedId);
    if (stateVersion !== plan.expectedStateVersion) {
      throw new DomainInvariantError("G0-A3 Memory checkpoint boundary no longer matches durable state");
    }
    const history = await persistence.readMemoryHistoryByKey(input.lenoseedId, plan.memory.memoryKey);
    if (history.length !== 0) {
      throw new DomainInvariantError("G0-A3 Memory durable state is partial before its commit");
    }
  } else {
    await validateDurable(plan, input, persistence);
  }

  const commit = await persistence.atomicCommit(
    input.lenoseedId,
    plan.expectedStateVersion,
    emptyMutations(plan.memory),
    plan.commitIdempotencyKey,
  );
  await validateDurable(plan, input, persistence);
  const eventsAfterCommit = await persistence.readEventsInSequence(input.lenoseedId);
  await persistence.appendEvent(
    buildCompletion(
      input,
      plan,
      commit.previousStateVersion,
      commit.newStateVersion,
      nextSequence(eventsAfterCommit),
    ),
  );
  return {
    memory: plan.memory,
    previousStateVersion: commit.previousStateVersion,
    newStateVersion: commit.newStateVersion,
    changed: commit.applied,
    replayed: committed,
  };
}

function assertInput(input: ConsolidateG0A3MemoryInput): void {
  const ids = initialIds(input.lenoseedId);
  if (
    input.episodeKey !== G0A3_CALIBRATION_EPISODE_KEY ||
    input.systemSourceId !== G0A3_SYSTEM_SOURCE_ID ||
    !sameList(input.evidenceItemIds, [ids.e1Id, ids.e2Id, ids.e3Id]) ||
    !Number.isInteger(input.expectedStateVersion) ||
    input.expectedStateVersion < 0 ||
    input.engineVersion.length === 0
  ) {
    throw new DomainInvariantError("G0-A3 Memory consolidation input is not canonical");
  }
}

async function assertSystemSource(input: ConsolidateG0A3MemoryInput, persistence: PersistencePort): Promise<void> {
  const source = await persistence.readSource(input.systemSourceId);
  if (source?.kind !== "system") throw new DomainInvariantError("G0-A3 Memory requires the canonical system source");
}

async function assertNoCorrectionBeforeCreate(lenoseedId: EntityId, persistence: PersistencePort): Promise<void> {
  const correctionId = `E-G0A3-${lenoseedId}-calibration-01-correction`;
  if (await persistence.readEventById(lenoseedId, correctionId) !== null) {
    throw new DomainInvariantError("G0-A3 correction exists before initial Memory checkpoint");
  }
}

function findHistoricalEvents(events: readonly Event[], input: ConsolidateG0A3MemoryInput): {
  readonly checkpoint: Event | null;
  readonly completion: Event | null;
} {
  const operationId = operationIdFor(input.lenoseedId);
  const checkpointId = checkpointIdFor(input.lenoseedId);
  const completionId = completionIdFor(input.lenoseedId);
  const checkpointKey = decisionKeyFor(input.lenoseedId);
  const completionKey = completedKeyFor(input.lenoseedId);
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
    throw new DomainInvariantError("G0-A3 Memory historical boundary is not unique");
  }
  return { checkpoint: checkpoints[0] ?? null, completion: completions[0] ?? null };
}

function buildPlan(input: ConsolidateG0A3MemoryInput, memory: Memory): CreatePlan {
  const ids = initialIds(input.lenoseedId);
  return {
    operationId: operationIdFor(input.lenoseedId),
    checkpointId: checkpointIdFor(input.lenoseedId),
    checkpointIdempotencyKey: decisionKeyFor(input.lenoseedId),
    commitIdempotencyKey: commitKeyFor(input.lenoseedId),
    completionId: completionIdFor(input.lenoseedId),
    completionIdempotencyKey: completedKeyFor(input.lenoseedId),
    memory,
    inputEventIds: [ids.intentionEventId, ids.failureEventId, ids.initialExplanationEventId],
    inputEvidenceItemIds: [ids.e1Id, ids.e2Id, ids.e3Id],
    expectedStateVersion: input.expectedStateVersion,
    engineVersion: input.engineVersion,
  };
}

function buildCheckpoint(
  input: ConsolidateG0A3MemoryInput,
  plan: CreatePlan,
  sequence: number,
): Event {
  return {
    id: plan.checkpointId,
    lenoseedId: input.lenoseedId,
    sequence,
    type: "validation_decision_recorded",
    occurredAt: plan.memory.createdAt,
    turnId: null,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: plan.inputEventIds,
    observedStateVersion: plan.expectedStateVersion,
    payload: checkpointPayload(plan),
    payloadSchemaVersion: 4,
    engineVersion: plan.engineVersion,
    idempotencyKey: plan.checkpointIdempotencyKey,
  };
}

function buildCompletion(
  input: ConsolidateG0A3MemoryInput,
  plan: CreatePlan,
  previousStateVersion: StateVersion,
  newStateVersion: StateVersion,
  sequence: number,
): Event {
  return {
    id: plan.completionId,
    lenoseedId: input.lenoseedId,
    sequence,
    type: "state_commit_completed",
    occurredAt: plan.memory.createdAt,
    turnId: null,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: [plan.checkpointId],
    observedStateVersion: previousStateVersion,
    payload: {
      scope: SCOPE,
      operationId: plan.operationId,
      action: ACTION,
      memoryKey: plan.memory.memoryKey,
      version: 1,
      previousStateVersion,
      newStateVersion,
      changed: true,
    },
    payloadSchemaVersion: 3,
    engineVersion: plan.engineVersion,
    idempotencyKey: plan.completionIdempotencyKey,
  };
}

async function parseCheckpoint(
  checkpoint: Event,
  input: ConsolidateG0A3MemoryInput,
  persistence: PersistencePort,
): Promise<CreatePlan> {
  const memory = parseMemory(checkpoint.payload.nextMemorySnapshot);
  const plan = buildPlan(input, memory);
  const expected = buildCheckpoint(input, plan, checkpoint.sequence);
  if (!sameEvent(checkpoint, expected)) throw new DomainInvariantError("G0-A3 Memory checkpoint is incompatible");
  const context = await readValidationContext(input.lenoseedId, persistence);
  validateG0A3Memory(plan.memory, { ...context, memoryHistory: context.memoryHistory });
  return plan;
}

async function validateCompletion(
  completion: Event,
  plan: CreatePlan,
  input: ConsolidateG0A3MemoryInput,
  persistence: PersistencePort,
): Promise<void> {
  const expected = buildCompletion(
    input,
    plan,
    plan.expectedStateVersion,
    plan.expectedStateVersion + 1,
    completion.sequence,
  );
  if (!sameEvent(completion, expected)) throw new DomainInvariantError("G0-A3 Memory completion is incompatible");
  if (!(await persistence.checkIdempotencyKey(input.lenoseedId, plan.commitIdempotencyKey))) {
    throw new DomainInvariantError("G0-A3 Memory completion announces a missing commit");
  }
}

async function validateDurable(
  plan: CreatePlan,
  input: ConsolidateG0A3MemoryInput,
  persistence: PersistencePort,
): Promise<void> {
  const context = await readValidationContext(input.lenoseedId, persistence);
  validateG0A3Memory(plan.memory, context);
  const durable = await persistence.readMemory(input.lenoseedId, plan.memory.id);
  if (durable === null || !sameMemoryExceptStatus(durable, plan.memory)) {
    throw new DomainInvariantError("G0-A3 Memory durable snapshot differs from checkpoint");
  }
}

async function readValidationContext(
  lenoseedId: EntityId,
  persistence: PersistencePort,
): Promise<G0A3MemoryValidationContext> {
  const ids = initialIds(lenoseedId);
  const events = await Promise.all([
    requireEvent(persistence, lenoseedId, ids.requestEventId),
    requireEvent(persistence, lenoseedId, ids.intentionEventId),
    requireEvent(persistence, lenoseedId, ids.failureEventId),
    requireEvent(persistence, lenoseedId, ids.initialExplanationEventId),
  ]);
  const evidence = await Promise.all([
    requireEvidence(persistence, lenoseedId, ids.e1Id),
    requireEvidence(persistence, lenoseedId, ids.e2Id),
    requireEvidence(persistence, lenoseedId, ids.e3Id),
  ]);
  const sources = await Promise.all([...new Set(events.map((event) => event.sourceId))].map(async (id) => {
    const source = await persistence.readSource(id);
    if (source === null) throw new DomainInvariantError(`G0-A3 Memory source ${id} is unavailable`);
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

function parseMemory(value: SerializableValue | undefined): Memory {
  if (!isRecord(value) || !isStringArray(value.eventIds) || !isStringArray(value.evidenceItemIds)) {
    throw new DomainInvariantError("G0-A3 Memory checkpoint has an invalid snapshot");
  }
  if (
    typeof value.id !== "string" || typeof value.lenoseedId !== "string" ||
    typeof value.memoryKey !== "string" || typeof value.episodeKey !== "string" ||
    typeof value.version !== "number" || typeof value.gist !== "string" ||
    typeof value.createdAt !== "string" || typeof value.salience !== "string" ||
    typeof value.confidence !== "string" || typeof value.status !== "string" ||
    !(typeof value.revisionOf === "string" || value.revisionOf === null) ||
    !(typeof value.lastRecalledAt === "string" || value.lastRecalledAt === null)
  ) throw new DomainInvariantError("G0-A3 Memory checkpoint has an invalid snapshot");
  return value as unknown as Memory;
}

function checkpointPayload(plan: CreatePlan): Readonly<Record<string, SerializableValue>> {
  return {
    scope: SCOPE,
    operationId: plan.operationId,
    action: ACTION,
    memoryKey: plan.memory.memoryKey,
    episodeKey: G0A3_CALIBRATION_EPISODE_KEY,
    version: 1,
    inputEventIds: plan.inputEventIds,
    inputEvidenceItemIds: plan.inputEvidenceItemIds,
    priorMemorySnapshot: null,
    nextMemorySnapshot: plan.memory as unknown as SerializableValue,
    expectedStateVersion: plan.expectedStateVersion,
  };
}

function emptyMutations(memory: Memory) {
  return { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [], memories: [memory] };
}

function operationIdFor(lenoseedId: EntityId): string {
  return `g0a3:${lenoseedId}:${G0A3_CALIBRATION_EPISODE_KEY}:v1:create`;
}
function decisionKeyFor(lenoseedId: EntityId): string { return `${operationIdFor(lenoseedId)}:decision`; }
function commitKeyFor(lenoseedId: EntityId): string { return `${operationIdFor(lenoseedId)}:commit`; }
function completedKeyFor(lenoseedId: EntityId): string { return `${operationIdFor(lenoseedId)}:completed`; }
function checkpointIdFor(lenoseedId: EntityId): EntityId {
  return `E-G0A3-${lenoseedId}-${G0A3_CALIBRATION_EPISODE_KEY}-v1-create-decision`;
}
function completionIdFor(lenoseedId: EntityId): EntityId {
  return `E-G0A3-${lenoseedId}-${G0A3_CALIBRATION_EPISODE_KEY}-v1-create-completed`;
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
function sameEvent(actual: Event, expected: Event): boolean { return sameValue(actual, expected); }
function sameMemoryExceptStatus(actual: Memory, expected: Memory): boolean {
  return sameValue({ ...actual, status: "active" }, { ...expected, status: "active" });
}
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
