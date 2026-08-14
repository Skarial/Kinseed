import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { consolidateG0A3Memory } from "../../dist/application/consolidate-g0a3-memory.js";
import { reviseG0A3Memory } from "../../dist/application/revise-g0a3-memory.js";
import {
  G0A3_CALIBRATION_EPISODE_KEY,
  G0A3_CALIBRATION_FAILURE_TEXT,
  G0A3_CONFIGURATION_REQUEST_TEXT,
  G0A3_CORRECTION_TEXT,
  G0A3_INITIAL_EXPLANATION_TEXT,
  G0A3_OPERATOR_ACTOR_REF,
  G0A3_OPERATOR_SOURCE_ID,
  G0A3_SYSTEM_SOURCE_ID,
  buildG0A3CalibrationFixtureEventId,
  buildG0A3CalibrationFixtureEventIdempotencyKey,
  materializeG0A3CorrectionEvidence,
  materializeG0A3InitialCalibrationEvidence,
} from "../../dist/application/materialize-g0a3-calibration-evidence.js";
import {
  buildG0A3InitialMemory,
  buildG0A3RevisedMemory,
  initialIds,
  revisedIds,
} from "../../dist/application/validate-g0a3-memory.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";
import { buildG0A3MemoryKey } from "../../dist/domain/memory.js";

const episodeKey = G0A3_CALIBRATION_EPISODE_KEY;
const engineVersion = "lenoseed-g0a3-memory-revision-v2";
const createdAt = "2026-08-14T10:00:00.000Z";

async function createScenario(lenoseedId, { createV1 = true, correction = true } = {}) {
  const store = new InMemoryStore();
  await store.registerSource({ id: G0A3_SYSTEM_SOURCE_ID, kind: "system", actorRef: null, channel: "test", createdAt });
  await store.registerSource({ id: G0A3_OPERATOR_SOURCE_ID, kind: "human", actorRef: G0A3_OPERATOR_ACTOR_REF, channel: "test", createdAt });
  await store.appendEvent(event(lenoseedId, { id: `E-${lenoseedId}-created`, sequence: 1, type: "lenoseed_created", sourceId: G0A3_SYSTEM_SOURCE_ID, payload: { generation: 0 }, payloadSchemaVersion: 1 }));
  const request = humanFixture(lenoseedId, "calibration-01-request", 2, "configuration_request", G0A3_CONFIGURATION_REQUEST_TEXT);
  const intention = event(lenoseedId, {
    ...identity(lenoseedId, "calibration-01-intention"), sequence: 3, type: "intention_selected", sourceId: G0A3_SYSTEM_SOURCE_ID,
    payload: { intentionId: `I-G0A3-${lenoseedId}-CALIBRATION-01`, protocol: "G0-A3", episodeKey, kind: "run_calibration_with_configuration_a", motivation: "execute_requested_calibration_configuration", triggerEventIds: [request.id], triggerMemoryIds: [] },
    payloadSchemaVersion: 3, causedByEventIds: [request.id],
  });
  const failure = humanFixture(lenoseedId, "calibration-01-failure", 4, "calibration_failure_report", G0A3_CALIBRATION_FAILURE_TEXT);
  const initialExplanation = humanFixture(lenoseedId, "calibration-01-initial-explanation", 5, "initial_failure_explanation", G0A3_INITIAL_EXPLANATION_TEXT);
  for (const item of [request, intention, failure, initialExplanation]) await store.appendEvent(item);
  await materializeG0A3InitialCalibrationEvidence({ lenoseedId, configurationRequestEventId: request.id, intentionEventId: intention.id, failureEventId: failure.id, initialExplanationEventId: initialExplanation.id }, store);

  let v1 = null;
  if (createV1) v1 = (await consolidateG0A3Memory(createInput(lenoseedId, 1), store)).memory;

  let correctionEvent = null;
  if (correction) {
    correctionEvent = humanFixture(lenoseedId, "calibration-01-correction", createV1 ? 8 : 6, "failure_explanation_correction", G0A3_CORRECTION_TEXT);
    await store.appendEvent(correctionEvent);
    await materializeG0A3CorrectionEvidence({ lenoseedId, initialExplanationEventId: initialExplanation.id, correctionEventId: correctionEvent.id }, store);
  }
  return { store, lenoseedId, request, intention, failure, initialExplanation, correction: correctionEvent, v1 };
}

function identity(lenoseedId, suffix) {
  return {
    id: buildG0A3CalibrationFixtureEventId(lenoseedId, suffix),
    idempotencyKey: buildG0A3CalibrationFixtureEventIdempotencyKey(lenoseedId, suffix),
  };
}

function event(lenoseedId, overrides) {
  return {
    id: overrides.id,
    lenoseedId,
    sequence: overrides.sequence,
    type: overrides.type,
    occurredAt: overrides.occurredAt ?? `2026-08-14T10:00:${String(overrides.sequence).padStart(2, "0")}.000Z`,
    turnId: null,
    sourceId: overrides.sourceId,
    actorRef: overrides.actorRef ?? null,
    causedByEventIds: overrides.causedByEventIds ?? [],
    observedStateVersion: overrides.observedStateVersion ?? 0,
    payload: overrides.payload,
    payloadSchemaVersion: overrides.payloadSchemaVersion,
    engineVersion: overrides.engineVersion ?? engineVersion,
    idempotencyKey: overrides.idempotencyKey ?? overrides.id,
  };
}

function humanFixture(lenoseedId, suffix, sequence, fixtureKind, text) {
  return event(lenoseedId, {
    ...identity(lenoseedId, suffix), sequence, type: "human_message_received", sourceId: G0A3_OPERATOR_SOURCE_ID,
    actorRef: G0A3_OPERATOR_ACTOR_REF,
    payload: { text, protocol: "G0-A3", episodeKey, fixtureKind },
    payloadSchemaVersion: 3,
  });
}

function createInput(lenoseedId, expectedStateVersion) {
  const ids = initialIds(lenoseedId);
  return {
    lenoseedId,
    episodeKey,
    systemSourceId: G0A3_SYSTEM_SOURCE_ID,
    evidenceItemIds: [ids.e1Id, ids.e2Id, ids.e3Id],
    expectedStateVersion,
    engineVersion: "lenoseed-g0a3-memory-consolidation-v1",
  };
}

function revisionInput(s, overrides = {}) {
  const ids = revisedIds(s.lenoseedId);
  return {
    lenoseedId: s.lenoseedId,
    episodeKey,
    systemSourceId: G0A3_SYSTEM_SOURCE_ID,
    evidenceItemIds: [ids.e1Id, ids.e2Id, ids.e4Id, ids.e5Id],
    expectedStateVersion: 3,
    engineVersion,
    ...overrides,
  };
}

function revisionEvents(events) {
  return {
    checkpoint: events.find((event) => event.payload.operationId?.endsWith(":v2:revise") && event.type === "validation_decision_recorded"),
    completion: events.find((event) => event.payload.operationId?.endsWith(":v2:revise") && event.type === "state_commit_completed"),
  };
}

function initialEvents(events) {
  return {
    checkpoint: events.find((event) => event.payload.operationId?.endsWith(":v1:create") && event.type === "validation_decision_recorded"),
    completion: events.find((event) => event.payload.operationId?.endsWith(":v1:create") && event.type === "state_commit_completed"),
  };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function eventsProxy(store, replacements) {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readEventsInSequence") return async (lenoseedId) => (await target.readEventsInSequence(lenoseedId)).map((event) => replacements.get(event.id) ?? event);
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("G0-A3 revises the canonical Memory atomically from v1 to v2", async () => {
  const s = await createScenario("K-G0A3-REVISION-NOMINAL");
  const result = await reviseG0A3Memory(revisionInput(s), s.store);
  const expectedV2 = buildG0A3RevisedMemory(s.lenoseedId, s.correction.occurredAt, s.v1.id);
  const revisedV1 = { ...s.v1, status: "revised" };
  assert.deepEqual(result, { memory: expectedV2, previousStateVersion: 3, newStateVersion: 4, changed: true, replayed: false });
  assert.deepEqual(await s.store.readMemoryHistoryByKey(s.lenoseedId, buildG0A3MemoryKey(s.lenoseedId, episodeKey)), [revisedV1, expectedV2]);
  assert.deepEqual(await s.store.readActiveMemoryByKey(s.lenoseedId, expectedV2.memoryKey), expectedV2);
  assert.deepEqual(await s.store.readMemory(s.lenoseedId, s.v1.id), revisedV1);
  assert.deepEqual(await s.store.readMemory(s.lenoseedId, expectedV2.id), expectedV2);
  assert.equal(await s.store.getStateVersion(s.lenoseedId), 4);

  const { checkpoint, completion } = revisionEvents(await s.store.readEventsInSequence(s.lenoseedId));
  const v1Boundary = initialEvents(await s.store.readEventsInSequence(s.lenoseedId));
  assert.deepEqual(checkpoint, {
    id: `E-G0A3-${s.lenoseedId}-${episodeKey}-v2-revise-decision`,
    lenoseedId: s.lenoseedId,
    sequence: 9,
    type: "validation_decision_recorded",
    occurredAt: s.correction.occurredAt,
    turnId: null,
    sourceId: G0A3_SYSTEM_SOURCE_ID,
    actorRef: null,
    causedByEventIds: [s.correction.id, v1Boundary.checkpoint.id],
    observedStateVersion: 3,
    payload: {
      scope: "memory_consolidation", operationId: `g0a3:${s.lenoseedId}:${episodeKey}:v2:revise`, action: "revise",
      memoryKey: expectedV2.memoryKey, episodeKey, version: 2,
      inputEventIds: [s.intention.id, s.failure.id, s.correction.id],
      inputEvidenceItemIds: expectedV2.evidenceItemIds,
      priorMemorySnapshot: s.v1, nextMemorySnapshot: expectedV2, expectedStateVersion: 3,
    },
    payloadSchemaVersion: 4,
    engineVersion,
    idempotencyKey: `g0a3:${s.lenoseedId}:${episodeKey}:v2:revise:decision`,
  });
  assert.deepEqual(completion, {
    id: `E-G0A3-${s.lenoseedId}-${episodeKey}-v2-revise-completed`,
    lenoseedId: s.lenoseedId,
    sequence: 10,
    type: "state_commit_completed",
    occurredAt: s.correction.occurredAt,
    turnId: null,
    sourceId: G0A3_SYSTEM_SOURCE_ID,
    actorRef: null,
    causedByEventIds: [checkpoint.id],
    observedStateVersion: 3,
    payload: { scope: "memory_consolidation", operationId: checkpoint.payload.operationId, action: "revise", memoryKey: expectedV2.memoryKey, version: 2, previousStateVersion: 3, newStateVersion: 4, changed: true },
    payloadSchemaVersion: 3,
    engineVersion,
    idempotencyKey: `g0a3:${s.lenoseedId}:${episodeKey}:v2:revise:completed`,
  });
});

test("G0-A3 revision rejects missing or invalid predecessor inputs before a v2 checkpoint", async (t) => {
  await t.test("v1 is absent", async () => {
    const s = await createScenario("K-G0A3-REVISION-NO-V1", { createV1: false });
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s, { expectedStateVersion: 2 }), s.store), DomainInvariantError);
  });
  await t.test("v1 creation checkpoint is absent", async () => {
    const s = await createScenario("K-G0A3-REVISION-NO-CHECKPOINT");
    const { checkpoint } = initialEvents(await s.store.readEventsInSequence(s.lenoseedId));
    const persistence = eventsProxy(s.store, new Map([[checkpoint.id, { ...checkpoint, id: "E-FORGED" }]]));
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), DomainInvariantError);
  });
  await t.test("v1 creation completion is absent", async () => {
    const s = await createScenario("K-G0A3-REVISION-NO-COMPLETION");
    const { completion } = initialEvents(await s.store.readEventsInSequence(s.lenoseedId));
    const persistence = eventsProxy(s.store, new Map([[completion.id, { ...completion, id: "E-FORGED" }]]));
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), DomainInvariantError);
  });
  await t.test("revision completion exists without a checkpoint", async () => {
    const s = await createScenario("K-G0A3-REVISION-ORPHAN-COMPLETION");
    await s.store.appendEvent(event(s.lenoseedId, {
      id: `E-G0A3-${s.lenoseedId}-${episodeKey}-v2-revise-completed`, sequence: 9,
      type: "state_commit_completed", sourceId: G0A3_SYSTEM_SOURCE_ID,
      payload: { scope: "memory_consolidation", operationId: `g0a3:${s.lenoseedId}:${episodeKey}:v2:revise` },
      payloadSchemaVersion: 3,
      idempotencyKey: `g0a3:${s.lenoseedId}:${episodeKey}:v2:revise:completed`,
    }));
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), s.store), DomainInvariantError);
  });
  await t.test("v1 is no longer active", async () => {
    const s = await createScenario("K-G0A3-REVISION-INACTIVE");
    const persistence = new Proxy(s.store, {
      get(target, property, receiver) {
        if (property === "readMemoryHistoryByKey") return async (lenoseedId, memoryKey) => (await target.readMemoryHistoryByKey(lenoseedId, memoryKey)).map((memory) => ({ ...memory, status: "revised" }));
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), DomainInvariantError);
  });
  await t.test("correction is absent", async () => {
    const s = await createScenario("K-G0A3-REVISION-NO-CORRECTION");
    const persistence = new Proxy(s.store, {
      get(target, property, receiver) {
        if (property === "readEventById") return async (lenoseedId, eventId) => eventId === s.correction.id ? null : target.readEventById(lenoseedId, eventId);
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), DomainInvariantError);
  });
  for (const [name, mutate] of [
    ["E4 is absent", (ids, item) => item.id === ids.e4Id ? null : item],
    ["E5 is absent", (ids, item) => item.id === ids.e5Id ? null : item],
    ["E5 supersedes the wrong evidence", (ids, item) => item.id === ids.e5Id ? { ...item, supersedesId: ids.e2Id } : item],
  ]) await t.test(name, async () => {
    const s = await createScenario(`K-G0A3-REVISION-${name.replaceAll(" ", "-").toUpperCase()}`);
    const ids = revisedIds(s.lenoseedId);
    const persistence = new Proxy(s.store, {
      get(target, property, receiver) {
        if (property === "readEvidenceItem") return async (lenoseedId, evidenceId) => {
          const item = await target.readEvidenceItem(lenoseedId, evidenceId);
          return item === null ? null : mutate(ids, item);
        };
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), DomainInvariantError);
  });
  await t.test("input evidence order is wrong", async () => {
    const s = await createScenario("K-G0A3-REVISION-EVIDENCE-ORDER");
    const input = revisionInput(s); const reversed = [...input.evidenceItemIds].reverse();
    await assert.rejects(() => reviseG0A3Memory({ ...input, evidenceItemIds: reversed }, s.store), DomainInvariantError);
  });
  await t.test("expected state version is wrong", async () => {
    const s = await createScenario("K-G0A3-REVISION-STATE");
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s, { expectedStateVersion: 2 }), s.store), DomainInvariantError);
  });
  await t.test("system source is wrong", async () => {
    const s = await createScenario("K-G0A3-REVISION-SOURCE");
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s, { systemSourceId: "SRC-FORGED" }), s.store), DomainInvariantError);
  });
});

test("G0-A3 revision failure injection leaves v1 active and does not write a completion", async () => {
  const s = await createScenario("K-G0A3-REVISION-ATOMIC");
  s.store.failNextAtomicCommitForTests(new Error("revision commit failure"));
  await assert.rejects(() => reviseG0A3Memory(revisionInput(s), s.store), /revision commit failure/);
  const ids = revisedIds(s.lenoseedId);
  assert.deepEqual(await s.store.readMemoryHistoryByKey(s.lenoseedId, buildG0A3MemoryKey(s.lenoseedId, episodeKey)), [s.v1]);
  assert.equal(await s.store.readMemory(s.lenoseedId, `MEM-G0A3-${s.lenoseedId}-${episodeKey}-v2`), null);
  assert.equal(await s.store.getStateVersion(s.lenoseedId), 3);
  const boundary = revisionEvents(await s.store.readEventsInSequence(s.lenoseedId));
  assert.ok(boundary.checkpoint);
  assert.equal(boundary.completion, undefined);
  assert.deepEqual(revisionInput(s).evidenceItemIds, [ids.e1Id, ids.e2Id, ids.e4Id, ids.e5Id]);
});

test("G0-A3 revision recovers a checkpoint before commit without changing its plan", async () => {
  const s = await createScenario("K-G0A3-REVISION-R2");
  s.store.failNextAtomicCommitForTests(new Error("revision commit failure"));
  await assert.rejects(() => reviseG0A3Memory(revisionInput(s), s.store), /revision commit failure/);
  const firstCheckpoint = revisionEvents(await s.store.readEventsInSequence(s.lenoseedId)).checkpoint;
  const recovered = await reviseG0A3Memory(revisionInput(s), s.store);
  const events = await s.store.readEventsInSequence(s.lenoseedId);
  const recoveredBoundary = revisionEvents(events);
  assert.equal(recovered.replayed, false);
  assert.equal(await s.store.getStateVersion(s.lenoseedId), 4);
  assert.deepEqual(recoveredBoundary.checkpoint, firstCheckpoint);
  assert.equal(events.filter((event) => event.id === firstCheckpoint.id).length, 1);
  assert.ok(recoveredBoundary.completion);
});

test("G0-A3 revision recovers an idempotent commit before its completion", async () => {
  const s = await createScenario("K-G0A3-REVISION-R3");
  let failCompletion = true;
  let atomicCalls = 0;
  const persistence = new Proxy(s.store, {
    get(target, property, receiver) {
      if (property === "atomicCommit") return async (...args) => { atomicCalls += 1; return target.atomicCommit(...args); };
      if (property === "appendEvent") return async (event) => {
        if (failCompletion && event.type === "state_commit_completed" && event.payload.action === "revise") {
          failCompletion = false;
          throw new Error("revision completion failure");
        }
        return target.appendEvent(event);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), /revision completion failure/);
  assert.equal(await s.store.getStateVersion(s.lenoseedId), 4);
  assert.equal(revisionEvents(await s.store.readEventsInSequence(s.lenoseedId)).completion, undefined);
  const recovered = await reviseG0A3Memory(revisionInput(s), persistence);
  assert.equal(recovered.replayed, true);
  assert.equal(await s.store.getStateVersion(s.lenoseedId), 4);
  assert.equal(atomicCalls, 2);
  assert.ok(revisionEvents(await s.store.readEventsInSequence(s.lenoseedId)).completion);
});

test("G0-A3 revision completion replays without another event, version or commit", async () => {
  const s = await createScenario("K-G0A3-REVISION-R4");
  const first = await reviseG0A3Memory(revisionInput(s), s.store);
  const stateVersion = await s.store.getStateVersion(s.lenoseedId);
  const eventCount = (await s.store.readEventsInSequence(s.lenoseedId)).length;
  const replay = await reviseG0A3Memory(revisionInput(s), s.store);
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(await s.store.getStateVersion(s.lenoseedId), stateVersion);
  assert.equal((await s.store.readEventsInSequence(s.lenoseedId)).length, eventCount);
});

test("G0-A3 revision rejects falsified checkpoint, completion and durable boundaries", async (t) => {
  const cases = [
    ["checkpoint gist", (checkpoint) => { checkpoint.payload.nextMemorySnapshot.gist = "forged"; }, false],
    ["prior snapshot", (checkpoint) => { checkpoint.payload.priorMemorySnapshot.gist = "forged"; }, false],
    ["next revisionOf", (checkpoint) => { checkpoint.payload.nextMemorySnapshot.revisionOf = "MEM-FORGED"; }, false],
    ["operation id", (checkpoint) => { checkpoint.payload.operationId = "g0a3:forged"; }, false],
    ["action", (checkpoint) => { checkpoint.payload.action = "create"; }, false],
    ["version", (checkpoint) => { checkpoint.payload.version = 3; }, false],
    ["expected state version", (checkpoint) => { checkpoint.payload.expectedStateVersion = 99; }, false],
    ["causes", (checkpoint) => { checkpoint.causedByEventIds.reverse(); }, false],
    ["completion versions", (_checkpoint, completion) => { completion.payload.newStateVersion = 99; }, false],
    ["engine version", (checkpoint) => { checkpoint.engineVersion = "forged"; }, false],
    ["completion without commit", () => {}, true],
  ];
  for (const [index, [name, mutate, missingCommit]] of cases.entries()) await t.test(name, async () => {
    const s = await createScenario(`K-G0A3-REVISION-FORGE-${index}`);
    await reviseG0A3Memory(revisionInput(s), s.store);
    const boundary = revisionEvents(await s.store.readEventsInSequence(s.lenoseedId));
    const checkpoint = clone(boundary.checkpoint);
    const completion = clone(boundary.completion);
    mutate(checkpoint, completion);
    const replacements = new Map([[checkpoint.id, checkpoint], [completion.id, completion]]);
    const events = eventsProxy(s.store, replacements);
    const persistence = missingCommit ? new Proxy(events, {
      get(target, property, receiver) {
        if (property === "checkIdempotencyKey") return async (lenoseedId, key) => key.endsWith(":v2:revise:commit") ? false : target.checkIdempotencyKey(lenoseedId, key);
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) : events;
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), DomainInvariantError);
  });
  await t.test("partial durable history", async () => {
    const s = await createScenario("K-G0A3-REVISION-PARTIAL");
    await reviseG0A3Memory(revisionInput(s), s.store);
    const persistence = new Proxy(s.store, {
      get(target, property, receiver) {
        if (property === "readMemoryHistoryByKey") return async (lenoseedId, memoryKey) => (await target.readMemoryHistoryByKey(lenoseedId, memoryKey)).slice(0, 1);
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(() => reviseG0A3Memory(revisionInput(s), persistence), DomainInvariantError);
  });
});

test("G0-A3 revision rejects a durable v2 without its own revision boundary", async () => {
  const s = await createScenario("K-G0A3-REVISION-ORPHAN-V2");
  const v2 = buildG0A3RevisedMemory(s.lenoseedId, s.correction.occurredAt, s.v1.id);
  await s.store.atomicCommit(
    s.lenoseedId,
    3,
    { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [], memories: [{ ...s.v1, status: "revised" }, v2] },
    "g0a3:orphan-v2",
  );
  await assert.rejects(() => reviseG0A3Memory(revisionInput(s), s.store), DomainInvariantError);
});
