import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { FakeAIEngine } from "../../dist/adapters/fake-ai-engine.js";
import { processTurn } from "../../dist/application/process-turn.js";
import { buildBeliefKey } from "../../dist/domain/proposition.js";

const kinseedId = "K-TEST-001";
const humanId = "H-TEST-001";
const humanSourceId = "SRC-HUMAN-001";
const systemSourceId = "SRC-SYSTEM-001";
const engineVersion = "g0a1-deterministic-test";

const messages = {
  t1: "J’ai commencé à travailler à l’Atelier Nova en 2022.",
  t2: "En quelle année t’ai-je dit avoir commencé à l’Atelier Nova ?",
  t3: "Correction : je m’étais trompé. J’ai commencé en 2021, pas en 2022.",
  t4: "En quelle année ai-je commencé à l’Atelier Nova ?",
  t5: "Est-ce que je t’avais donné une autre année auparavant ?",
  t6: "Non, je ne t’ai jamais dit 2022. Tu inventes.",
  t7: "Quelle est ta conclusion actuelle sur mon année de début à l’Atelier Nova, et pourquoi ?",
};

function employmentStartProposition(year) {
  return {
    subjectRef: humanId,
    predicate: "employment_start_year",
    value: year,
    context: { organisation: "Atelier Nova" },
  };
}

async function createScenario(store = new InMemoryStore()) {
  const ai = new FakeAIEngine();
  await store.registerSource({
    id: systemSourceId,
    kind: "system",
    actorRef: null,
    channel: "internal",
    createdAt: "2026-08-11T08:00:00.000Z",
  });
  await store.registerSource({
    id: humanSourceId,
    kind: "human",
    actorRef: humanId,
    channel: "test",
    createdAt: "2026-08-11T08:00:00.000Z",
  });
  await store.appendEvent({
    id: "E-000",
    kinseedId,
    sequence: 1,
    type: "kinseed_created",
    occurredAt: "2026-08-11T08:00:01.000Z",
    turnId: null,
    sourceId: systemSourceId,
    actorRef: null,
    causedByEventIds: [],
    observedStateVersion: 0,
    payload: { generation: 0 },
    payloadSchemaVersion: 1,
    engineVersion,
    idempotencyKey: "create:K-TEST-001",
  });
  return { store, ai };
}

function runTurn(store, ai, turnId, message, second) {
  return processTurn(
    {
      kinseedId,
      turnId,
      humanSourceId,
      humanActorRef: humanId,
      systemSourceId,
      message,
      occurredAt: `2026-08-11T08:${String(second).padStart(2, "0")}:00.000Z`,
      engineVersion,
    },
    store,
    ai,
  );
}

test("G0-A1 deterministic protocol replays T1 through T7 without AI context leakage", async () => {
  const { store, ai } = await createScenario();
  const key = buildBeliefKey(employmentStartProposition(2022));

  assert.equal(await store.getStateVersion(kinseedId), 0);
  assert.equal(await store.readActiveBeliefByKey(kinseedId, key), null);

  const t1 = await runTurn(store, ai, "T1", messages.t1, 1);
  assert.equal(t1.response, "Tu m’as indiqué 2022.");
  assert.equal(await store.getStateVersion(kinseedId), 1);
  assert.equal((await store.readActiveBeliefByKey(kinseedId, key))?.proposition.value, 2022);

  ai.resetConversationContext();
  const t2 = await runTurn(store, ai, "T2", messages.t2, 2);
  assert.equal(t2.response, "Tu m’avais dit 2022.");
  assert.equal(await store.getStateVersion(kinseedId), 1);

  ai.resetConversationContext();
  const t3 = await runTurn(store, ai, "T3", messages.t3, 3);
  assert.equal(t3.response, "D’après ta correction, 2021.");
  assert.equal(await store.getStateVersion(kinseedId), 2);
  const history = await store.readBeliefHistoryByKey(kinseedId, key);
  assert.deepEqual(
    history.map((belief) => [belief.id, belief.version, belief.status, belief.proposition.value]),
    [
      ["B-START-v1", 1, "superseded", 2022],
      ["B-START-v2", 2, "active", 2021],
    ],
  );

  ai.resetConversationContext();
  const t4 = await runTurn(store, ai, "T4", messages.t4, 4);
  assert.equal(t4.response, "D’après ta correction, 2021.");

  ai.resetConversationContext();
  const t5 = await runTurn(store, ai, "T5", messages.t5, 5);
  assert.equal(t5.response, "Oui. Tu m’avais d’abord dit 2022, puis tu as corrigé en 2021.");

  ai.resetConversationContext();
  const t6 = await runTurn(store, ai, "T6", messages.t6, 6);
  assert.equal(
    t6.response,
    "Dans mon historique, tu m’avais bien indiqué 2022 au départ, puis tu as corrigé en 2021.",
  );
  assert.equal((await store.readActiveBeliefByKey(kinseedId, key))?.proposition.value, 2021);

  ai.resetConversationContext();
  const t7 = await runTurn(store, ai, "T7", messages.t7, 7);
  assert.equal(
    t7.response,
    "Ma conclusion actuelle est 2021, d’après ta correction explicite ; tu avais auparavant indiqué 2022.",
  );

  const events = await store.readEventsInSequence(kinseedId);
  assert.equal(events.find((event) => event.id === "E-T1-input")?.payload.text, messages.t1);
  assert.equal(events.filter((event) => event.type === "human_message_received").length, 7);
  assert.equal(events.filter((event) => event.type === "kinseed_message_emitted").length, 7);
  for (const emitted of events.filter((event) => event.type === "kinseed_message_emitted")) {
    const intention = events.find(
      (event) => event.turnId === emitted.turnId && event.type === "intention_selected",
    );
    assert.ok(intention);
    assert.ok(intention.sequence < emitted.sequence);
  }
  assert.doesNotMatch(JSON.stringify(events), /SelfHypothesis|HumanHypothesis|preference|value/);

  assert.equal(ai.resetCount, 6);
  for (const input of ai.extractionInputs) {
    assert.deepEqual(input.allowedContext, {});
  }
  for (const input of ai.formulationInputs) {
    assert.equal(Object.hasOwn(input.context, "previousMessages"), false);
    assert.doesNotMatch(JSON.stringify(input.context), /J’ai commencé à travailler/);
    assert.doesNotMatch(JSON.stringify(input.context), /Correction :/);
  }
});

test("G0-A1 records a failure after intention selection without durable mutation", async () => {
  const { store, ai } = await createScenario();
  ai.failNextFormulation();

  await assert.rejects(
    () => runTurn(store, ai, "T-RETRY", messages.t1, 10),
    /FakeAIEngine formulation failure/,
  );
  assert.equal(await store.getStateVersion(kinseedId), 0);
  const failedEvents = await store.readEventsByTurn(kinseedId, "T-RETRY");
  assert.equal(failedEvents.filter((event) => event.type === "human_message_received").length, 1);
  assert.equal(failedEvents.filter((event) => event.type === "intention_selected").length, 1);
  assert.equal(failedEvents.filter((event) => event.type === "kinseed_message_emitted").length, 0);
  assert.equal(failedEvents.filter((event) => event.type === "processing_failure_recorded").length, 1);
  assert.equal(await store.readActiveBeliefByKey(kinseedId, buildBeliefKey(employmentStartProposition(2022))), null);

  const retry = await runTurn(store, ai, "T-RETRY", messages.t1, 10);
  assert.equal(retry.response, "Tu m’as indiqué 2022.");
  assert.equal(await store.getStateVersion(kinseedId), 1);
  const events = await store.readEventsByTurn(kinseedId, "T-RETRY");
  assert.equal(events.filter((event) => event.type === "human_message_received").length, 1);
  assert.equal(events.filter((event) => event.type === "kinseed_message_emitted").length, 1);
  assert.equal(events.filter((event) => event.type === "processing_failure_recorded").length, 1);
});

class FailBeforeCommitStore extends InMemoryStore {
  failCommitCheckOnce = true;

  async checkIdempotencyKey(kinseed, idempotencyKey) {
    if (this.failCommitCheckOnce && idempotencyKey.endsWith(":commit")) {
      this.failCommitCheckOnce = false;
      throw new Error("Injected failure before commit");
    }
    return super.checkIdempotencyKey(kinseed, idempotencyKey);
  }
}

test("G0-A1 resumes after emission without emitting a second response", async () => {
  const { store, ai } = await createScenario(new FailBeforeCommitStore());

  await assert.rejects(
    () => runTurn(store, ai, "T-AFTER-EMIT", messages.t1, 11),
    /Injected failure before commit/,
  );
  assert.equal(await store.getStateVersion(kinseedId), 0);

  const interrupted = await store.readEventsByTurn(kinseedId, "T-AFTER-EMIT");
  assertTurnEventCounts(interrupted, {
    human_message_received: 1,
    intention_selected: 1,
    kinseed_message_emitted: 1,
    state_commit_completed: 0,
  });
  assert.equal(interrupted.filter((event) => event.type === "processing_failure_recorded").length, 1);

  const resumed = await runTurn(store, ai, "T-AFTER-EMIT", messages.t1, 11);
  assert.equal(resumed.response, "Tu m’as indiqué 2022.");
  assert.equal(await store.getStateVersion(kinseedId), 1);
  const completed = await store.readEventsByTurn(kinseedId, "T-AFTER-EMIT");
  assertTurnEventCounts(completed, {
    human_message_received: 1,
    intention_selected: 1,
    kinseed_message_emitted: 1,
    state_commit_completed: 1,
  });
  assertStrictEventOrdering(completed);

  const replay = await runTurn(store, ai, "T-AFTER-EMIT", messages.t1, 11);
  assert.equal(replay.replayed, true);
  assert.equal(replay.response, resumed.response);
  assert.equal((await store.readEventsByTurn(kinseedId, "T-AFTER-EMIT")).length, completed.length);
});

test("G0-A1 keeps atomic commit mutations absent on failure and applies them once on retry", async () => {
  const { store, ai } = await createScenario();
  store.failNextAtomicCommitForTests();

  await assert.rejects(
    () => runTurn(store, ai, "T-COMMIT-FAIL", messages.t1, 12),
    /Injected atomic commit failure/,
  );
  assert.equal(await store.getStateVersion(kinseedId), 0);
  assert.equal(await store.readEvidenceItem(kinseedId, "EV-START-2022"), null);
  assert.equal(
    await store.readEvidenceLink(kinseedId, "EL-EV-START-2022-B-START-v1-supports"),
    null,
  );
  assert.equal(await store.readActiveBeliefByKey(kinseedId, buildBeliefKey(employmentStartProposition(2022))), null);

  const failedEvents = await store.readEventsByTurn(kinseedId, "T-COMMIT-FAIL");
  assertTurnEventCounts(failedEvents, {
    human_message_received: 1,
    intention_selected: 1,
    kinseed_message_emitted: 1,
    state_commit_completed: 0,
  });
  assert.equal(failedEvents.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "state_commit");

  const committed = await runTurn(store, ai, "T-COMMIT-FAIL", messages.t1, 12);
  assert.equal(committed.stateVersion, 1);
  assert.equal((await store.readActiveBeliefByKey(kinseedId, buildBeliefKey(employmentStartProposition(2022))))?.proposition.value, 2022);
  const completed = await store.readEventsByTurn(kinseedId, "T-COMMIT-FAIL");
  assertTurnEventCounts(completed, {
    human_message_received: 1,
    intention_selected: 1,
    kinseed_message_emitted: 1,
    state_commit_completed: 1,
  });

  const replay = await runTurn(store, ai, "T-COMMIT-FAIL", messages.t1, 12);
  assert.equal(replay.replayed, true);
  assert.equal(await store.getStateVersion(kinseedId), 1);
  assert.equal((await store.readEventsByTurn(kinseedId, "T-COMMIT-FAIL")).length, completed.length);
});

function assertTurnEventCounts(events, expected) {
  for (const [type, count] of Object.entries(expected)) {
    assert.equal(events.filter((event) => event.type === type).length, count, type);
  }
}

function assertStrictEventOrdering(events) {
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(events[index - 1].sequence < events[index].sequence);
  }
}
