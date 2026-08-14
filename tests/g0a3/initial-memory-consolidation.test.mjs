import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import {
  consolidateG0A3Memory,
} from "../../dist/application/consolidate-g0a3-memory.js";
import {
  buildG0A3CalibrationFailureTestimony,
  buildG0A3CalibrationFixtureEventId,
  buildG0A3CalibrationFixtureEventIdempotencyKey,
  buildG0A3InitialFailureCauseTestimony,
  materializeG0A3InitialCalibrationEvidence,
} from "../../dist/application/materialize-g0a3-calibration-evidence.js";
import { DomainInvariantError, IdempotencyConflictError } from "../../dist/domain/errors.js";
import { buildG0A3MemoryKey } from "../../dist/domain/memory.js";

const lenoseedId = "K-G0A3-MEMORY-CONSOLIDATION";
const systemSourceId = "SRC-G0A3-SYSTEM";
const operatorSourceId = "SRC-G0A3-OPERATOR";
const operatorActorRef = "OP-G0A3-001";
const episodeKey = "EP-G0A3-CALIBRATION-01";
const createdAt = "2026-08-14T09:00:00.000Z";
const requestText = "Utilise la configuration A pour le test de calibration.";
const fixtureBuilderEvent = { id: "E-FIXTURE", lenoseedId, sourceId: operatorSourceId, occurredAt: createdAt };
const failureText = buildG0A3CalibrationFailureTestimony(fixtureBuilderEvent).grounding.supportingExcerpt;
const explanationText = buildG0A3InitialFailureCauseTestimony(fixtureBuilderEvent).grounding.supportingExcerpt;

async function createScenario() {
  const store = new InMemoryStore();
  await store.registerSource({ id: systemSourceId, kind: "system", actorRef: null, channel: "test", createdAt });
  await store.registerSource({ id: operatorSourceId, kind: "human", actorRef: operatorActorRef, channel: "test", createdAt });
  await store.appendEvent(event({ id: "E-G0A3-CREATED", sequence: 1, type: "lenoseed_created", sourceId: systemSourceId, payload: { generation: 0 }, payloadSchemaVersion: 1 }));
  const request = humanFixture("calibration-01-request", 2, "configuration_request", requestText);
  const intention = event({
    ...identity("calibration-01-intention"), sequence: 3, type: "intention_selected", sourceId: systemSourceId,
    payload: { intentionId: `I-G0A3-${lenoseedId}-CALIBRATION-01`, protocol: "G0-A3", episodeKey, kind: "run_calibration_with_configuration_a", motivation: "execute_requested_calibration_configuration", triggerEventIds: [request.id], triggerMemoryIds: [] },
    payloadSchemaVersion: 3, causedByEventIds: [request.id],
  });
  const failure = humanFixture("calibration-01-failure", 4, "calibration_failure_report", failureText);
  const initialExplanation = humanFixture("calibration-01-initial-explanation", 5, "initial_failure_explanation", explanationText);
  for (const item of [request, intention, failure, initialExplanation]) await store.appendEvent(item);
  await materializeG0A3InitialCalibrationEvidence({ lenoseedId, configurationRequestEventId: request.id, intentionEventId: intention.id, failureEventId: failure.id, initialExplanationEventId: initialExplanation.id }, store);
  return { store, request, intention, failure, initialExplanation };
}

function identity(suffix) {
  return {
    id: buildG0A3CalibrationFixtureEventId(lenoseedId, suffix),
    idempotencyKey: buildG0A3CalibrationFixtureEventIdempotencyKey(lenoseedId, suffix),
  };
}

function humanFixture(suffix, sequence, fixtureKind, text) {
  return event({ ...identity(suffix), sequence, type: "human_message_received", sourceId: operatorSourceId, actorRef: operatorActorRef, payload: { text, protocol: "G0-A3", episodeKey, fixtureKind }, payloadSchemaVersion: 3 });
}

function event(overrides) {
  return { id: overrides.id, lenoseedId, sequence: overrides.sequence, type: overrides.type, occurredAt: overrides.occurredAt ?? `2026-08-14T09:00:0${overrides.sequence}.000Z`, turnId: null, sourceId: overrides.sourceId, actorRef: overrides.actorRef ?? null, causedByEventIds: overrides.causedByEventIds ?? [], observedStateVersion: 0, payload: overrides.payload, payloadSchemaVersion: overrides.payloadSchemaVersion, engineVersion: "g0a3-memory-consolidation-test", idempotencyKey: overrides.idempotencyKey ?? overrides.id };
}

function input(expectedStateVersion = 1) {
  return {
    lenoseedId,
    episodeKey,
    systemSourceId,
    evidenceItemIds: [
      `EV-G0A3-OBS-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-intention")}`,
      `EV-G0A3-TESTIMONY-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-failure")}-outcome`,
      `EV-G0A3-TESTIMONY-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-initial-explanation")}-cause`,
    ],
    expectedStateVersion,
    engineVersion: "lenoseed-g0a3-memory-consolidation-v1",
  };
}

function memoryKey() { return buildG0A3MemoryKey(lenoseedId, episodeKey); }
function checkpoint(events) { return events.find((item) => item.type === "validation_decision_recorded" && item.payload.scope === "memory_consolidation"); }
function completion(events) { return events.find((item) => item.type === "state_commit_completed" && item.payload.scope === "memory_consolidation"); }

async function appendFutureV2(store) {
  const first = await consolidateG0A3Memory(input(), store);
  const revisedV1 = { ...first.memory, status: "revised" };
  const v2 = {
    ...first.memory,
    id: first.memory.id.replace("-v1", "-v2"),
    version: 2,
    gist: "Future revision fixture.",
    status: "active",
    revisionOf: first.memory.id,
  };
  await store.atomicCommit(
    lenoseedId,
    2,
    { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [], memories: [revisedV1, v2] },
    "g0a3:future-v2-fixture",
  );
  return { first, v2 };
}

test("G0-A3 v1 consolidates only E1 E2 E3 into the exact active Memory", async () => {
  const { store, intention, failure, initialExplanation } = await createScenario();
  const result = await consolidateG0A3Memory(input(), store);
  assert.equal(result.changed, true);
  assert.equal(result.replayed, false);
  assert.equal(result.previousStateVersion, 1);
  assert.equal(result.newStateVersion, 2);
  assert.deepEqual(result.memory.eventIds, [intention.id, failure.id, initialExplanation.id]);
  assert.equal(result.memory.status, "active");
  assert.equal(result.memory.createdAt, initialExplanation.occurredAt);
  assert.equal(await store.getStateVersion(lenoseedId), 2);
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, memoryKey()), result.memory);
  const events = await store.readEventsInSequence(lenoseedId);
  assert.equal(checkpoint(events)?.payloadSchemaVersion, 4);
  assert.equal(completion(events)?.payloadSchemaVersion, 3);
  assert.deepEqual(completion(events)?.causedByEventIds, [checkpoint(events)?.id]);
});

test("G0-A3 v1 recovery R2 persists its checkpoint before an atomic failure", async () => {
  const { store } = await createScenario();
  store.failNextAtomicCommitForTests(new Error("v1 commit failure"));
  await assert.rejects(() => consolidateG0A3Memory(input(), store), /v1 commit failure/);
  assert.equal(await store.getStateVersion(lenoseedId), 1);
  assert.equal((await store.readMemoryHistoryByKey(lenoseedId, memoryKey())).length, 0);
  assert.ok(checkpoint(await store.readEventsInSequence(lenoseedId)));
  const recovered = await consolidateG0A3Memory(input(), store);
  assert.equal(recovered.changed, true);
  assert.equal(await store.getStateVersion(lenoseedId), 2);
});

test("G0-A3 v1 recovery R2 reuses the checkpoint despite a later correction", async () => {
  const { store } = await createScenario();
  store.failNextAtomicCommitForTests();
  await assert.rejects(() => consolidateG0A3Memory(input(), store));
  await store.appendEvent(humanFixture("calibration-01-correction", 7, "failure_explanation_correction", "later correction"));
  const recovered = await consolidateG0A3Memory(input(), store);
  assert.equal(recovered.memory.version, 1);
  assert.equal(recovered.memory.gist.includes("incompatibilité"), true);
  assert.equal(await store.getStateVersion(lenoseedId), 2);
});

test("G0-A3 v1 recovery R3 writes only the missing completion", async () => {
  const { store } = await createScenario();
  let failCompletion = true;
  const persistence = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "appendEvent") return async (item) => {
        if (failCompletion && item.type === "state_commit_completed") { failCompletion = false; throw new Error("completion failure"); }
        return target.appendEvent(item);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => consolidateG0A3Memory(input(), persistence), /completion failure/);
  assert.equal(await store.getStateVersion(lenoseedId), 2);
  assert.equal(completion(await store.readEventsInSequence(lenoseedId)), undefined);
  const recovered = await consolidateG0A3Memory(input(), persistence);
  assert.equal(recovered.changed, true);
  assert.equal(await store.getStateVersion(lenoseedId), 2);
  assert.ok(completion(await store.readEventsInSequence(lenoseedId)));
});

test("G0-A3 v1 recovery R4 replays checkpoint completion and durable state without mutation", async () => {
  const { store } = await createScenario();
  await consolidateG0A3Memory(input(), store);
  const eventCount = (await store.readEventsInSequence(lenoseedId)).length;
  const replay = await consolidateG0A3Memory(input(), store);
  assert.equal(replay.replayed, true);
  assert.equal(replay.changed, true);
  assert.equal(await store.getStateVersion(lenoseedId), 2);
  assert.equal((await store.readEventsInSequence(lenoseedId)).length, eventCount);
});

test("G0-A3 v1 R4 accepts its historical snapshot after a future v2 revision", async () => {
  const { store } = await createScenario();
  const { first } = await appendFutureV2(store);
  const replay = await consolidateG0A3Memory(input(), store);
  assert.equal(replay.replayed, true);
  assert.equal(replay.memory.status, "active");
  assert.equal((await store.readMemory(lenoseedId, first.memory.id))?.status, "revised");
  assert.equal(await store.getStateVersion(lenoseedId), 3);
});

test("G0-A3 v1 rejects a correction before its first checkpoint", async () => {
  const { store } = await createScenario();
  await store.appendEvent(humanFixture("calibration-01-correction", 6, "failure_explanation_correction", "correction present"));
  await assert.rejects(() => consolidateG0A3Memory(input(), store), DomainInvariantError);
  assert.equal((await store.readMemoryHistoryByKey(lenoseedId, memoryKey())).length, 0);
});

test("G0-A3 v1 rejects R5 completion without checkpoint and R6 falsified checkpoint", async (t) => {
  await t.test("completion without checkpoint", async () => {
    const { store } = await createScenario();
    await store.appendEvent(event({ id: `E-G0A3-${lenoseedId}-${episodeKey}-v1-create-completed`, sequence: 6, type: "state_commit_completed", sourceId: systemSourceId, payload: { scope: "memory_consolidation", operationId: `g0a3:${lenoseedId}:${episodeKey}:v1:create` }, payloadSchemaVersion: 3, idempotencyKey: `g0a3:${lenoseedId}:${episodeKey}:v1:create:completed` }));
    await assert.rejects(() => consolidateG0A3Memory(input(), store), DomainInvariantError);
  });
  await t.test("falsified checkpoint snapshot", async () => {
    const { store } = await createScenario();
    store.failNextAtomicCommitForTests();
    await assert.rejects(() => consolidateG0A3Memory(input(), store));
    const persistence = new Proxy(store, {
      get(target, property, receiver) {
        if (property === "readEventsInSequence") return async (id) => (await target.readEventsInSequence(id)).map((item) => item.type === "validation_decision_recorded" ? { ...item, payload: { ...item.payload, nextMemorySnapshot: { ...item.payload.nextMemorySnapshot, gist: "forged" } } } : item);
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(() => consolidateG0A3Memory(input(), persistence), DomainInvariantError);
    assert.equal(await store.getStateVersion(lenoseedId), 1);
  });
  await t.test("hidden checkpoint snapshot field", async () => {
    const { store } = await createScenario();
    store.failNextAtomicCommitForTests();
    await assert.rejects(() => consolidateG0A3Memory(input(), store));
    const persistence = new Proxy(store, {
      get(target, property, receiver) {
        if (property === "readEventsInSequence") return async (id) => (await target.readEventsInSequence(id)).map((item) => item.type === "validation_decision_recorded" ? { ...item, payload: { ...item.payload, nextMemorySnapshot: { ...item.payload.nextMemorySnapshot, recommendedAction: "use_configuration_b" } } } : item);
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(() => consolidateG0A3Memory(input(), persistence), DomainInvariantError);
    const events = await store.readEventsInSequence(lenoseedId);
    assert.equal((await store.readMemoryHistoryByKey(lenoseedId, memoryKey())).length, 0);
    assert.equal(await store.getStateVersion(lenoseedId), 1);
    assert.equal(events.filter((item) => item.type === "validation_decision_recorded" && item.payload.scope === "memory_consolidation").length, 1);
    assert.equal(completion(events), undefined);
  });
});

test("G0-A3 v1 rejects falsified canonical human fixtures before checkpoint", async (t) => {
  const cases = [
    ["request text", async (target, id) => {
      const event = await target.readEventById(lenoseedId, id);
      return id.endsWith("calibration-01-request") ? { ...event, payload: { ...event.payload, text: "Utilise plutôt une autre configuration." } } : event;
    }],
    ["enriched failure text", async (target, id) => {
      const event = await target.readEventById(lenoseedId, id);
      return id.endsWith("calibration-01-failure") ? { ...event, payload: { ...event.payload, text: `${failureText} Mais ce résultat est peut-être faux.` } } : event;
    }],
  ];
  for (const [name, readEventById] of cases) {
    await t.test(name, async () => {
      const { store } = await createScenario();
      const persistence = new Proxy(store, {
        get(target, property, receiver) {
          if (property === "readEventById") return (id, eventId) => readEventById(target, eventId);
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await assert.rejects(() => consolidateG0A3Memory(input(), persistence), DomainInvariantError);
      assert.equal((await store.readMemoryHistoryByKey(lenoseedId, memoryKey())).length, 0);
      assert.equal(checkpoint(await store.readEventsInSequence(lenoseedId)), undefined);
      assert.equal(await store.getStateVersion(lenoseedId), 1);
    });
  }
  await t.test("operator actorRef", async () => {
    const { store } = await createScenario();
    const persistence = new Proxy(store, {
      get(target, property, receiver) {
        if (property === "readSource") return async (id) => {
          const source = await target.readSource(id);
          return id === operatorSourceId && source !== null ? { ...source, actorRef: "OP-FORGED" } : source;
        };
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(() => consolidateG0A3Memory(input(), persistence), DomainInvariantError);
    assert.equal((await store.readMemoryHistoryByKey(lenoseedId, memoryKey())).length, 0);
    assert.equal(checkpoint(await store.readEventsInSequence(lenoseedId)), undefined);
    assert.equal(await store.getStateVersion(lenoseedId), 1);
  });
});

test("G0-A3 v1 recovery rejects a forged v2 predecessor", async () => {
  const { store } = await createScenario();
  const { v2 } = await appendFutureV2(store);
  const persistence = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readMemoryHistoryByKey") return async (id, key) => (await target.readMemoryHistoryByKey(id, key)).map((memory) => memory.id === v2.id ? { ...memory, revisionOf: "MEM-FORGED" } : memory);
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => consolidateG0A3Memory(input(), persistence), DomainInvariantError);
  assert.equal(await store.getStateVersion(lenoseedId), 3);
});

test("G0-A3 v1 R8 keeps the original commit and rejects another fingerprint", async () => {
  const { store } = await createScenario();
  const result = await consolidateG0A3Memory(input(), store);
  const key = `g0a3:${lenoseedId}:${episodeKey}:v1:create:commit`;
  const original = { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [], memories: [result.memory] };
  const replay = await store.atomicCommit(lenoseedId, 1, original, key);
  assert.deepEqual(replay, { applied: true, previousStateVersion: 1, newStateVersion: 2 });
  await assert.rejects(
    () => store.atomicCommit(lenoseedId, 1, { ...original, memories: [{ ...result.memory, gist: "forged" }] }, key),
    IdempotencyConflictError,
  );
  assert.equal(await store.getStateVersion(lenoseedId), 2);
});
