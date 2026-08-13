import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { FakeAIEngine } from "../../dist/adapters/fake-ai-engine.js";
import { processTurn } from "../../dist/application/process-turn.js";
import { buildBeliefKey } from "../../dist/domain/proposition.js";

const lenoSeedId = "K-TEST-001";
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
    lenoSeedId,
    sequence: 1,
    type: "lenoseed_created",
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
      lenoSeedId,
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

  assert.equal(await store.getStateVersion(lenoSeedId), 0);
  assert.equal(await store.readActiveBeliefByKey(lenoSeedId, key), null);

  const t1 = await runTurn(store, ai, "T1", messages.t1, 1);
  assert.equal(t1.response, "Tu m’as indiqué 2022.");
  assert.equal(await store.getStateVersion(lenoSeedId), 1);
  assert.equal((await store.readActiveBeliefByKey(lenoSeedId, key))?.proposition.value, 2022);

  ai.resetConversationContext();
  const t2 = await runTurn(store, ai, "T2", messages.t2, 2);
  assert.equal(t2.response, "Tu m’avais dit 2022.");
  assert.equal(await store.getStateVersion(lenoSeedId), 1);

  ai.resetConversationContext();
  const t3 = await runTurn(store, ai, "T3", messages.t3, 3);
  assert.equal(t3.response, "D’après ta correction, 2021.");
  assert.equal(await store.getStateVersion(lenoSeedId), 2);
  const t3Formulation = ai.formulationInputs.find(({ intention }) => intention.id === "I-T3");
  assert.equal(t3Formulation?.intention.kind, "acknowledge_correction");
  assert.deepEqual(t3Formulation?.context.turnEvidence, [
    { predicate: "employment_start_year", value: 2021 },
  ]);
  const evidence2022 = await store.readEvidenceItem(lenoSeedId, "EV-START-2022");
  const evidence2021 = await store.readEvidenceItem(lenoSeedId, "EV-START-2021");
  assert.deepEqual(evidence2021?.proposition, employmentStartProposition(2021));
  assert.equal(evidence2021?.supersedesId, evidence2022?.id);
  assert.ok(evidence2022);
  assert.equal(await store.readEvidenceItem(lenoSeedId, "EV-T3"), null);
  const history = await store.readBeliefHistoryByKey(lenoSeedId, key);
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
  const eventT1BeforeT6 = structuredClone(await store.readEventById(lenoSeedId, "E-T1-input"));
  const evidence2022BeforeT6 = structuredClone(await store.readEvidenceItem(lenoSeedId, "EV-START-2022"));
  const t6 = await runTurn(store, ai, "T6", messages.t6, 6);
  assert.equal(
    t6.response,
    "Dans mon historique, tu m’avais bien indiqué 2022 au départ, puis tu as corrigé en 2021.",
  );
  const t6Formulation = ai.formulationInputs.find(({ intention }) => intention.id === "I-T6");
  assert.equal(t6Formulation?.intention.kind, "report_record_conflict");
  assert.deepEqual(t6Formulation?.context.turnEvidence, [
    { predicate: "denies_prior_employment_start_year_testimony", value: 2022 },
  ]);
  const t6Evidence = await store.readEvidenceItem(lenoSeedId, "EV-T6");
  assert.equal(t6Evidence?.proposition.predicate, "denies_prior_employment_start_year_testimony");
  assert.equal(t6Evidence?.proposition.value, 2022);
  assert.equal(t6Evidence?.supersedesId, null);
  assert.deepEqual(await store.readEventById(lenoSeedId, "E-T1-input"), eventT1BeforeT6);
  assert.deepEqual(await store.readEvidenceItem(lenoSeedId, "EV-START-2022"), evidence2022BeforeT6);
  assert.equal((await store.readActiveBeliefByKey(lenoSeedId, key))?.proposition.value, 2021);

  ai.resetConversationContext();
  const t7 = await runTurn(store, ai, "T7", messages.t7, 7);
  assert.equal(
    t7.response,
    "Ma conclusion actuelle est 2021, d’après ta correction explicite ; tu avais auparavant indiqué 2022.",
  );

  const events = await store.readEventsInSequence(lenoSeedId);
  assert.equal(events.find((event) => event.id === "E-T1-input")?.payload.text, messages.t1);
  assert.equal(events.filter((event) => event.type === "human_message_received").length, 7);
  assert.equal(events.filter((event) => event.type === "lenoseed_message_emitted").length, 7);
  assert.equal(events.filter((event) => event.type === "validation_decision_recorded").length, 7);
  for (const turnId of ["T1", "T2", "T3", "T4", "T5", "T6", "T7"]) {
    const checkpoint = events.find(
      (event) => event.turnId === turnId && event.id === `E-${turnId}-temporary-evidence`,
    );
    const intention = events.find(
      (event) => event.turnId === turnId && event.type === "intention_selected",
    );
    assert.equal(checkpoint?.type, "validation_decision_recorded");
    assert.equal(checkpoint?.payloadSchemaVersion, 2);
    assert.equal(checkpoint?.payload.scope, "temporary_evidence");
    assert.equal(checkpoint?.payload.completed, true);
    assert.ok(checkpoint && intention && checkpoint.sequence < intention.sequence);
  }
  const acceptedT1 = events.find((event) => event.id === "E-T1-temporary-evidence")?.payload.outcomes?.[0];
  assert.equal(acceptedT1?.decision, "accept");
  assert.equal(Object.hasOwn(acceptedT1?.candidateSnapshot ?? {}, "eventId"), false);
  assert.equal(Object.hasOwn(acceptedT1?.candidateSnapshot ?? {}, "sourceId"), false);
  for (const emitted of events.filter((event) => event.type === "lenoseed_message_emitted")) {
    const intention = events.find(
      (event) => event.turnId === emitted.turnId && event.type === "intention_selected",
    );
    assert.ok(intention);
    assert.ok(intention.sequence < emitted.sequence);
  }
  assert.doesNotMatch(JSON.stringify(events), /SelfHypothesis|HumanHypothesis|preference/);

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
  assert.equal(await store.getStateVersion(lenoSeedId), 0);
  const failedEvents = await store.readEventsByTurn(lenoSeedId, "T-RETRY");
  assert.equal(failedEvents.filter((event) => event.type === "human_message_received").length, 1);
  assert.equal(failedEvents.filter((event) => event.type === "intention_selected").length, 1);
  assert.equal(failedEvents.filter((event) => event.type === "lenoseed_message_emitted").length, 0);
  assert.equal(failedEvents.filter((event) => event.type === "processing_failure_recorded").length, 1);
  assert.equal(await store.readActiveBeliefByKey(lenoSeedId, buildBeliefKey(employmentStartProposition(2022))), null);

  const retry = await runTurn(store, ai, "T-RETRY", messages.t1, 10);
  assert.equal(retry.response, "Tu m’as indiqué 2022.");
  assert.equal(await store.getStateVersion(lenoSeedId), 1);
  const events = await store.readEventsByTurn(lenoSeedId, "T-RETRY");
  assert.equal(events.filter((event) => event.type === "human_message_received").length, 1);
  assert.equal(events.filter((event) => event.type === "lenoseed_message_emitted").length, 1);
  assert.equal(events.filter((event) => event.type === "processing_failure_recorded").length, 1);
});

class FailBeforeCommitStore extends InMemoryStore {
  failCommitCheckOnce = true;

  async checkIdempotencyKey(lenoSeed, idempotencyKey) {
    if (this.failCommitCheckOnce && idempotencyKey.endsWith(":commit")) {
      this.failCommitCheckOnce = false;
      throw new Error("Injected failure before commit");
    }
    return super.checkIdempotencyKey(lenoSeed, idempotencyKey);
  }
}

test("G0-A1 resumes after emission without emitting a second response", async () => {
  const { store, ai } = await createScenario(new FailBeforeCommitStore());

  await assert.rejects(
    () => runTurn(store, ai, "T-AFTER-EMIT", messages.t1, 11),
    /Injected failure before commit/,
  );
  assert.equal(await store.getStateVersion(lenoSeedId), 0);

  const interrupted = await store.readEventsByTurn(lenoSeedId, "T-AFTER-EMIT");
  assertTurnEventCounts(interrupted, {
    human_message_received: 1,
    intention_selected: 1,
    lenoseed_message_emitted: 1,
    state_commit_completed: 0,
  });
  assert.equal(interrupted.filter((event) => event.type === "processing_failure_recorded").length, 1);

  const resumed = await runTurn(store, ai, "T-AFTER-EMIT", messages.t1, 11);
  assert.equal(resumed.response, "Tu m’as indiqué 2022.");
  assert.equal(await store.getStateVersion(lenoSeedId), 1);
  const completed = await store.readEventsByTurn(lenoSeedId, "T-AFTER-EMIT");
  assertTurnEventCounts(completed, {
    human_message_received: 1,
    intention_selected: 1,
    lenoseed_message_emitted: 1,
    state_commit_completed: 1,
  });
  assertStrictEventOrdering(completed);

  const replay = await runTurn(store, ai, "T-AFTER-EMIT", messages.t1, 11);
  assert.equal(replay.replayed, true);
  assert.equal(replay.response, resumed.response);
  assert.equal((await store.readEventsByTurn(lenoSeedId, "T-AFTER-EMIT")).length, completed.length);
});

test("G0-A1 keeps atomic commit mutations absent on failure and applies them once on retry", async () => {
  const { store, ai } = await createScenario();
  store.failNextAtomicCommitForTests();

  await assert.rejects(
    () => runTurn(store, ai, "T-COMMIT-FAIL", messages.t1, 12),
    /Injected atomic commit failure/,
  );
  assert.equal(await store.getStateVersion(lenoSeedId), 0);
  assert.equal(await store.readEvidenceItem(lenoSeedId, "EV-START-2022"), null);
  assert.equal(
    await store.readEvidenceLink(lenoSeedId, "EL-EV-START-2022-B-START-v1-supports"),
    null,
  );
  assert.equal(await store.readActiveBeliefByKey(lenoSeedId, buildBeliefKey(employmentStartProposition(2022))), null);

  const failedEvents = await store.readEventsByTurn(lenoSeedId, "T-COMMIT-FAIL");
  assertTurnEventCounts(failedEvents, {
    human_message_received: 1,
    intention_selected: 1,
    lenoseed_message_emitted: 1,
    state_commit_completed: 0,
  });
  assert.equal(failedEvents.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "state_commit");

  const committed = await runTurn(store, ai, "T-COMMIT-FAIL", messages.t1, 12);
  assert.equal(committed.stateVersion, 1);
  assert.equal((await store.readActiveBeliefByKey(lenoSeedId, buildBeliefKey(employmentStartProposition(2022))))?.proposition.value, 2022);
  const completed = await store.readEventsByTurn(lenoSeedId, "T-COMMIT-FAIL");
  assertTurnEventCounts(completed, {
    human_message_received: 1,
    intention_selected: 1,
    lenoseed_message_emitted: 1,
    state_commit_completed: 1,
  });

  const replay = await runTurn(store, ai, "T-COMMIT-FAIL", messages.t1, 12);
  assert.equal(replay.replayed, true);
  assert.equal(await store.getStateVersion(lenoSeedId), 1);
  assert.equal((await store.readEventsByTurn(lenoSeedId, "T-COMMIT-FAIL")).length, completed.length);
});

class FailAfterAppliedCommitStore extends InMemoryStore {
  failAfterAppliedCommitOnce = true;
  atomicCommitCalls = 0;

  async atomicCommit(...args) {
    this.atomicCommitCalls += 1;
    const result = await super.atomicCommit(...args);
    if (this.failAfterAppliedCommitOnce) {
      this.failAfterAppliedCommitOnce = false;
      throw new Error("Injected failure after applied commit");
    }
    return result;
  }
}

test("R8: recovery records the real transition after a commit was already applied", async () => {
  const { store, ai } = await createScenario(new FailAfterAppliedCommitStore());

  await assert.rejects(
    () => runTurn(store, ai, "T-R8-CHANGED", messages.t1, 13),
    /Injected failure after applied commit/,
  );
  assert.equal(await store.getStateVersion(lenoSeedId), 1);
  assert.equal((await store.readEvidenceItem(lenoSeedId, "EV-START-2022"))?.proposition.value, 2022);
  assert.equal(
    (await store.readActiveBeliefByKey(lenoSeedId, buildBeliefKey(employmentStartProposition(2022))))?.proposition.value,
    2022,
  );
  const interrupted = await store.readEventsByTurn(lenoSeedId, "T-R8-CHANGED");
  assert.equal(interrupted.some((event) => event.type === "state_commit_completed"), false);
  assert.equal(ai.extractionInputs.length, 1);
  assert.equal(ai.formulationInputs.length, 1);

  const resumed = await runTurn(store, ai, "T-R8-CHANGED", messages.t1, 13);
  assert.equal(resumed.stateVersion, 1);
  assert.equal(ai.extractionInputs.length, 1);
  assert.equal(ai.formulationInputs.length, 1);
  assert.equal(store.atomicCommitCalls, 1);
  const completed = await store.readEventsByTurn(lenoSeedId, "T-R8-CHANGED");
  const commit = completed.find((event) => event.type === "state_commit_completed");
  assert.equal(completed.filter((event) => event.type === "state_commit_completed").length, 1);
  assert.equal(commit?.observedStateVersion, 0);
  assert.deepEqual(commit?.payload, {
    previousStateVersion: 0,
    newStateVersion: 1,
    changed: true,
  });
});

class GroundingTestEngine extends FakeAIEngine {
  constructor(candidate) {
    super();
    this.candidate = candidate;
  }

  async extractEvidence(input) {
    this.extractionInputs.push(input);
    return [this.candidate];
  }
}

function hostileCandidate(supportingExcerpt, value = 20212021) {
  return {
    kind: "testimony",
    proposition: employmentStartProposition(value),
    supportingExcerpt,
    extractionConfidence: "high",
    extractorVersion: "grounding-test-v1",
  };
}

test("G0-A1 rejects an unsupported extracted value without mutating state or leaking it to formulation", async () => {
  const { store } = await createScenario();
  const message = "J’ai commencé à travailler à l’Atelier Nova en 2021.";
  const ai = new GroundingTestEngine(hostileCandidate(message));

  const result = await runTurn(store, ai, "T-GROUNDING-HOSTILE", message, 20);
  assert.equal(result.stateVersion, 0);
  assert.equal(result.response, "Je n’ai pas de conclusion durable à ajouter.");
  assert.doesNotMatch(result.response, /20212021/);
  assert.equal(await store.readEvidenceItem(lenoSeedId, "EV-START-20212021"), null);
  assert.equal(await store.readActiveBeliefByKey(lenoSeedId, buildBeliefKey(employmentStartProposition(20212021))), null);

  const events = await store.readEventsByTurn(lenoSeedId, "T-GROUNDING-HOSTILE");
  const decision = events.find((event) => event.type === "validation_decision_recorded");
  const intention = events.find((event) => event.type === "intention_selected");
  assert.equal(decision?.payloadSchemaVersion, 2);
  assert.equal(decision?.payload.scope, "temporary_evidence");
  assert.equal(decision?.payload.completed, true);
  assert.deepEqual(decision?.payload.outcomes, [{
    candidateId: "CAND-T-GROUNDING-HOSTILE-1",
    decision: "reject",
    reasonCodes: ["proposition_value_not_in_supporting_excerpt"],
  }]);
  assert.ok(decision && intention && decision.sequence < intention.sequence);
  assert.equal(events.filter((event) => event.type === "processing_failure_recorded").length, 0);
  assert.equal(events.find((event) => event.type === "state_commit_completed")?.payload.changed, false);
  const formulation = ai.formulationInputs.at(-1);
  assert.deepEqual(formulation?.context.turnEvidence, []);

  const replay = await runTurn(store, ai, "T-GROUNDING-HOSTILE", message, 20);
  assert.equal(replay.replayed, true);
  assert.equal((await store.readEventsByTurn(lenoSeedId, "T-GROUNDING-HOSTILE")).filter(
    (event) => event.type === "validation_decision_recorded",
  ).length, 1);
});

test("G0-A1 rejects empty, invented, and value-less supporting excerpts", async () => {
  const message = "J’ai commencé à travailler à l’Atelier Nova en 2021.";
  const cases = [
    ["", 2021, "supporting_excerpt_empty"],
    ["J’ai commencé en 2022", 2021, "supporting_excerpt_not_in_event_text"],
    ["J’ai commencé à travailler à l’Atelier Nova", 2021, "proposition_value_not_in_supporting_excerpt"],
  ];

  for (const [index, [supportingExcerpt, value, reasonCode]] of cases.entries()) {
    const { store } = await createScenario();
    const ai = new GroundingTestEngine(hostileCandidate(supportingExcerpt, value));
    await runTurn(store, ai, `T-GROUNDING-${index}`, message, 21 + index);
    const events = await store.readEventsByTurn(lenoSeedId, `T-GROUNDING-${index}`);
    assert.deepEqual(
      events.find((event) => event.type === "validation_decision_recorded")?.payload.outcomes,
      [{ candidateId: `CAND-T-GROUNDING-${index}-1`, decision: "reject", reasonCodes: [reasonCode] }],
    );
    assert.equal(await store.getStateVersion(lenoSeedId), 0);
  }
});

class OrderedCandidatesEngine extends FakeAIEngine {
  async extractEvidence(input) {
    this.extractionInputs.push(input);
    return [
      {
        kind: "testimony",
        proposition: employmentStartProposition(2021),
        supportingExcerpt: "2021",
        extractionConfidence: "high",
        extractorVersion: "ordered-test-v1",
      },
      hostileCandidate("2021"),
    ];
  }
}

test("G0-A1 checkpoints accept and reject outcomes in candidate order", async () => {
  const { store } = await createScenario();
  const ai = new OrderedCandidatesEngine();
  const message = "J’ai commencé à travailler à l’Atelier Nova en 2021.";
  await runTurn(store, ai, "T-CHECKPOINT-ORDER", message, 29);
  const checkpoint = (await store.readEventsByTurn(lenoSeedId, "T-CHECKPOINT-ORDER")).find(
    (event) => event.id === "E-T-CHECKPOINT-ORDER-temporary-evidence",
  );
  assert.deepEqual(checkpoint?.payload.outcomes?.map((outcome) => [outcome.candidateId, outcome.decision]), [
    ["CAND-T-CHECKPOINT-ORDER-1", "accept"],
    ["CAND-T-CHECKPOINT-ORDER-2", "reject"],
  ]);
  assert.equal(Object.hasOwn(checkpoint?.payload.outcomes?.[0]?.candidateSnapshot ?? {}, "eventId"), false);
  assert.equal(Object.hasOwn(checkpoint?.payload.outcomes?.[0]?.candidateSnapshot ?? {}, "sourceId"), false);
});

test("R1: a rejected candidate checkpoint survives a formulation failure and retry", async () => {
  const { store } = await createScenario();
  const message = "J’ai commencé à travailler à l’Atelier Nova en 2021.";
  const ai = new GroundingTestEngine(hostileCandidate(message));
  ai.failNextFormulation();

  await assert.rejects(() => runTurn(store, ai, "T-R1", message, 30), /formulation failure/);
  const first = await store.readEventsByTurn(lenoSeedId, "T-R1");
  assert.equal(ai.extractionInputs.length, 1);
  assert.equal(first.filter((event) => event.id === "E-T-R1-temporary-evidence").length, 1);
  assert.deepEqual(
    first.find((event) => event.id === "E-T-R1-temporary-evidence")?.payload.outcomes,
    [{ candidateId: "CAND-T-R1-1", decision: "reject", reasonCodes: ["proposition_value_not_in_supporting_excerpt"] }],
  );

  await runTurn(store, ai, "T-R1", message, 30);
  const completed = await store.readEventsByTurn(lenoSeedId, "T-R1");
  assert.equal(ai.extractionInputs.length, 1);
  assert.equal(completed.filter((event) => event.id === "E-T-R1-temporary-evidence").length, 1);
  assert.equal(completed.filter((event) => event.type === "lenoseed_message_emitted").length, 1);
});

test("R2: a rejected candidate is not re-extracted or reformulated after emission before commit", async () => {
  const { store } = await createScenario(new FailBeforeCommitStore());
  const message = "J’ai commencé à travailler à l’Atelier Nova en 2021.";
  const ai = new GroundingTestEngine(hostileCandidate(message));

  await assert.rejects(() => runTurn(store, ai, "T-R2", message, 31), /Injected failure before commit/);
  assert.equal(ai.extractionInputs.length, 1);
  assert.equal(ai.formulationInputs.length, 1);

  const resumed = await runTurn(store, ai, "T-R2", message, 31);
  assert.equal(resumed.stateVersion, 0);
  assert.equal(ai.extractionInputs.length, 1);
  assert.equal(ai.formulationInputs.length, 1);
  const events = await store.readEventsByTurn(lenoSeedId, "T-R2");
  assert.equal(events.filter((event) => event.id === "E-T-R2-temporary-evidence").length, 1);
  assert.equal(events.filter((event) => event.type === "lenoseed_message_emitted").length, 1);
  assert.equal(events.find((event) => event.type === "state_commit_completed")?.payload.changed, false);
});

class AlternatingEvidenceEngine extends FakeAIEngine {
  async extractEvidence(input) {
    this.extractionInputs.push(input);
    const year = this.extractionInputs.length === 1 ? 2021 : 2022;
    return [{
      kind: "testimony",
      proposition: employmentStartProposition(year),
      supportingExcerpt: String(year),
      extractionConfidence: "high",
      extractorVersion: "alternating-test-v1",
    }];
  }
}

test("R3: commit uses the accepted checkpoint snapshot, never an alternate extraction", async () => {
  const { store } = await createScenario(new FailBeforeCommitStore());
  const ai = new AlternatingEvidenceEngine();
  const message = "J’ai commencé à travailler à l’Atelier Nova en 2021.";

  await assert.rejects(() => runTurn(store, ai, "T-R3", message, 32), /Injected failure before commit/);
  await runTurn(store, ai, "T-R3", message, 32);

  assert.equal(ai.extractionInputs.length, 1);
  assert.equal((await store.readEvidenceItem(lenoSeedId, "EV-START-2021"))?.proposition.value, 2021);
  assert.equal(await store.readEvidenceItem(lenoSeedId, "EV-START-2022"), null);
  assert.equal(
    (await store.readActiveBeliefByKey(lenoSeedId, buildBeliefKey(employmentStartProposition(2021))))?.proposition.value,
    2021,
  );
});

class EmptyEvidenceEngine extends FakeAIEngine {
  async extractEvidence(input) {
    this.extractionInputs.push(input);
    return [];
  }
}

test("R4: an empty extraction is checkpointed and finalizes without durable evidence", async () => {
  const { store } = await createScenario(new FailBeforeCommitStore());
  const ai = new EmptyEvidenceEngine();
  const message = "Question sans fait autobiographique.";

  await assert.rejects(() => runTurn(store, ai, "T-R4", message, 33), /Injected failure before commit/);
  await runTurn(store, ai, "T-R4", message, 33);

  assert.equal(ai.extractionInputs.length, 1);
  const events = await store.readEventsByTurn(lenoSeedId, "T-R4");
  assert.deepEqual(events.find((event) => event.id === "E-T-R4-temporary-evidence")?.payload.outcomes, []);
  assert.equal(events.find((event) => event.type === "state_commit_completed")?.payload.changed, false);
  assert.equal(await store.getStateVersion(lenoSeedId), 0);
});

test("R8: recovery preserves a previously applied empty commit as unchanged", async () => {
  const { store } = await createScenario(new FailAfterAppliedCommitStore());
  const ai = new EmptyEvidenceEngine();
  const message = "Question sans fait autobiographique.";

  await assert.rejects(
    () => runTurn(store, ai, "T-R8-EMPTY", message, 33),
    /Injected failure after applied commit/,
  );
  assert.equal(await store.getStateVersion(lenoSeedId), 0);

  await runTurn(store, ai, "T-R8-EMPTY", message, 33);
  const commit = (await store.readEventsByTurn(lenoSeedId, "T-R8-EMPTY")).find(
    (event) => event.type === "state_commit_completed",
  );
  assert.equal(ai.extractionInputs.length, 1);
  assert.equal(ai.formulationInputs.length, 1);
  assert.equal(store.atomicCommitCalls, 1);
  assert.deepEqual(commit?.payload, {
    previousStateVersion: 0,
    newStateVersion: 0,
    changed: false,
  });
});

class ExtractionFailureEngine extends FakeAIEngine {
  async extractEvidence(input) {
    this.extractionInputs.push(input);
    throw new Error("Injected extraction failure");
  }
}

class ValidationFailureStore extends InMemoryStore {
  failValidationOnce = true;

  async readEventById(lenoSeed, eventId) {
    if (this.failValidationOnce) {
      this.failValidationOnce = false;
      throw new Error("Injected validation failure");
    }
    return super.readEventById(lenoSeed, eventId);
  }
}

test("R5: technical extraction and validation failures are recorded before intention", async (t) => {
  await t.test("extraction", async () => {
    const { store } = await createScenario();
    const ai = new ExtractionFailureEngine();
    await assert.rejects(() => runTurn(store, ai, "T-R5-EXTRACT", messages.t1, 34), /Injected extraction failure/);
    const events = await store.readEventsByTurn(lenoSeedId, "T-R5-EXTRACT");
    assert.equal(events.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "evidence_extraction");
    assert.equal(events.some((event) => event.type === "intention_selected"), false);
    assert.equal(events.some((event) => event.type === "lenoseed_message_emitted"), false);
    assert.equal(await store.getStateVersion(lenoSeedId), 0);
  });
  await t.test("validation", async () => {
    const { store, ai } = await createScenario(new ValidationFailureStore());
    await assert.rejects(() => runTurn(store, ai, "T-R5-VALIDATE", messages.t1, 35), /Injected validation failure/);
    const events = await store.readEventsByTurn(lenoSeedId, "T-R5-VALIDATE");
    assert.equal(events.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "evidence_validation");
    assert.equal(events.some((event) => event.type === "intention_selected"), false);
    assert.equal(events.some((event) => event.type === "lenoseed_message_emitted"), false);
    assert.equal(await store.getStateVersion(lenoSeedId), 0);
  });
});

test("R6: an intention or emitted response without a checkpoint fails closed", async () => {
  for (const [turnId, includeEmission] of [["T-R6-INTENTION", false], ["T-R6-EMITTED", true]]) {
    const { store, ai } = await createScenario();
    await store.appendEvent({
      id: `E-${turnId}-input`, lenoSeedId, sequence: 2, type: "human_message_received",
      occurredAt: "2026-08-11T08:36:00.000Z", turnId, sourceId: humanSourceId, actorRef: humanId,
      causedByEventIds: [], observedStateVersion: 0, payload: { text: messages.t1 }, payloadSchemaVersion: 1,
      engineVersion, idempotencyKey: `${turnId}:input`,
    });
    await store.appendEvent({
      id: `E-${turnId}-intention`, lenoSeedId, sequence: 3, type: "intention_selected",
      occurredAt: "2026-08-11T08:36:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
      causedByEventIds: [`E-${turnId}-input`], observedStateVersion: 0,
      payload: { intentionId: `I-${turnId}`, kind: "answer_question", motivation: "record_first_testimony" },
      payloadSchemaVersion: 1, engineVersion, idempotencyKey: `${turnId}:intention`,
    });
    if (includeEmission) {
      await store.appendEvent({
        id: `E-${turnId}-emitted`, lenoSeedId, sequence: 4, type: "lenoseed_message_emitted",
        occurredAt: "2026-08-11T08:36:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
        causedByEventIds: [`E-${turnId}-input`, `E-${turnId}-intention`], observedStateVersion: 0,
        payload: { text: "Réponse historique", intentionId: `I-${turnId}` }, payloadSchemaVersion: 1,
        engineVersion, idempotencyKey: `${turnId}:response`,
      });
    }
    await assert.rejects(() => runTurn(store, ai, turnId, messages.t1, 36), /temporary evidence checkpoint/);
    assert.equal(ai.extractionInputs.length, 0);
    const events = await store.readEventsByTurn(lenoSeedId, turnId);
    assert.equal(events.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "evidence_validation");
    assert.equal(await store.getStateVersion(lenoSeedId), 0);
  }
});

test("G0-A1 rejects an emitted response that has no historical intention", async () => {
  const { store, ai } = await createScenario();
  const turnId = "T-EMITTED-WITHOUT-INTENTION";
  await store.appendEvent({
    id: `E-${turnId}-input`, lenoSeedId, sequence: 2, type: "human_message_received",
    occurredAt: "2026-08-11T08:38:00.000Z", turnId, sourceId: humanSourceId, actorRef: humanId,
    causedByEventIds: [], observedStateVersion: 0, payload: { text: messages.t1 }, payloadSchemaVersion: 1,
    engineVersion, idempotencyKey: `${turnId}:input`,
  });
  await store.appendEvent({
    id: `E-${turnId}-temporary-evidence`, lenoSeedId, sequence: 3, type: "validation_decision_recorded",
    occurredAt: "2026-08-11T08:38:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
    causedByEventIds: [`E-${turnId}-input`], observedStateVersion: 0,
    payload: { scope: "temporary_evidence", completed: true, outcomes: [] },
    payloadSchemaVersion: 2, engineVersion, idempotencyKey: `${turnId}:temporary-evidence`,
  });
  await store.appendEvent({
    id: `E-${turnId}-emitted`, lenoSeedId, sequence: 4, type: "lenoseed_message_emitted",
    occurredAt: "2026-08-11T08:38:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
    causedByEventIds: [`E-${turnId}-input`], observedStateVersion: 0,
    payload: { text: "Réponse historique", intentionId: `I-${turnId}` }, payloadSchemaVersion: 1,
    engineVersion, idempotencyKey: `${turnId}:response`,
  });

  await assert.rejects(() => runTurn(store, ai, turnId, messages.t1, 38), /without intention_selected/);
  assert.equal(ai.extractionInputs.length, 0);
  assert.equal(ai.formulationInputs.length, 0);
  const events = await store.readEventsByTurn(lenoSeedId, turnId);
  assert.equal(events.filter((event) => event.type === "intention_selected").length, 0);
  assert.equal(events.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "language_generation");
  assert.equal(await store.getStateVersion(lenoSeedId), 0);
});

test("G0-A1 rejects state_commit_completed without an emitted response", async () => {
  const { store, ai } = await createScenario();
  const turnId = "T-COMMIT-WITHOUT-EMISSION";
  await store.appendEvent({
    id: `E-${turnId}-input`, lenoSeedId, sequence: 2, type: "human_message_received",
    occurredAt: "2026-08-11T08:39:00.000Z", turnId, sourceId: humanSourceId, actorRef: humanId,
    causedByEventIds: [], observedStateVersion: 0, payload: { text: messages.t1 }, payloadSchemaVersion: 1,
    engineVersion, idempotencyKey: `${turnId}:input`,
  });
  await store.appendEvent({
    id: `E-${turnId}-temporary-evidence`, lenoSeedId, sequence: 3, type: "validation_decision_recorded",
    occurredAt: "2026-08-11T08:39:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
    causedByEventIds: [`E-${turnId}-input`], observedStateVersion: 0,
    payload: { scope: "temporary_evidence", completed: true, outcomes: [] },
    payloadSchemaVersion: 2, engineVersion, idempotencyKey: `${turnId}:temporary-evidence`,
  });
  await store.appendEvent({
    id: `E-${turnId}-intention`, lenoSeedId, sequence: 4, type: "intention_selected",
    occurredAt: "2026-08-11T08:39:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
    causedByEventIds: [`E-${turnId}-input`], observedStateVersion: 0,
    payload: { intentionId: `I-${turnId}`, kind: "answer_question", motivation: "record_first_testimony" },
    payloadSchemaVersion: 1, engineVersion, idempotencyKey: `${turnId}:intention`,
  });
  await store.appendEvent({
    id: `E-${turnId}-commit`, lenoSeedId, sequence: 5, type: "state_commit_completed",
    occurredAt: "2026-08-11T08:39:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
    causedByEventIds: [], observedStateVersion: 0,
    payload: { previousStateVersion: 0, newStateVersion: 0, changed: false }, payloadSchemaVersion: 1,
    engineVersion, idempotencyKey: `${turnId}:state_commit`,
  });

  await assert.rejects(() => runTurn(store, ai, turnId, messages.t1, 39), /without lenoseed_message_emitted/);
  assert.equal(ai.extractionInputs.length, 0);
  assert.equal(ai.formulationInputs.length, 0);
  const events = await store.readEventsByTurn(lenoSeedId, turnId);
  assert.equal(events.filter((event) => event.type === "lenoseed_message_emitted").length, 0);
  assert.equal(events.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "state_commit");
});

test("G0-A1 treats a malformed historical checkpoint as an evidence validation anomaly", async () => {
  const { store, ai } = await createScenario();
  const turnId = "T-MALFORMED-CHECKPOINT";
  await store.appendEvent({
    id: `E-${turnId}-input`, lenoSeedId, sequence: 2, type: "human_message_received",
    occurredAt: "2026-08-11T08:37:00.000Z", turnId, sourceId: humanSourceId, actorRef: humanId,
    causedByEventIds: [], observedStateVersion: 0, payload: { text: messages.t1 }, payloadSchemaVersion: 1,
    engineVersion, idempotencyKey: `${turnId}:input`,
  });
  await store.appendEvent({
    id: `E-${turnId}-temporary-evidence`, lenoSeedId, sequence: 3, type: "validation_decision_recorded",
    occurredAt: "2026-08-11T08:37:00.000Z", turnId, sourceId: systemSourceId, actorRef: null,
    causedByEventIds: [`E-${turnId}-input`], observedStateVersion: 0,
    payload: { scope: "temporary_evidence", completed: true, outcomes: [{ candidateId: `CAND-${turnId}-1`, decision: "accept" }] },
    payloadSchemaVersion: 2, engineVersion, idempotencyKey: `${turnId}:temporary-evidence`,
  });
  await assert.rejects(() => runTurn(store, ai, turnId, messages.t1, 37), /candidate snapshot/);
  assert.equal(ai.extractionInputs.length, 0);
  const events = await store.readEventsByTurn(lenoSeedId, turnId);
  assert.equal(events.find((event) => event.type === "processing_failure_recorded")?.payload.stage, "evidence_validation");
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
