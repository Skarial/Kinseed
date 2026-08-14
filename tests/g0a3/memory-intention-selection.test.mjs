import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { consolidateG0A3Memory } from "../../dist/application/consolidate-g0a3-memory.js";
import { reviseG0A3Memory } from "../../dist/application/revise-g0a3-memory.js";
import {
  buildG0A3CalibrationFailureTestimony,
  buildG0A3CalibrationFixtureEventId,
  buildG0A3CalibrationFixtureEventIdempotencyKey,
  buildG0A3InitialFailureCauseTestimony,
  G0A3_CORRECTION_TEXT,
  materializeG0A3CorrectionEvidence,
  materializeG0A3InitialCalibrationEvidence,
} from "../../dist/application/materialize-g0a3-calibration-evidence.js";
import { selectG0A3MemoryIntention } from "../../dist/application/select-g0a3-memory-intention.js";
import { revisedIds } from "../../dist/application/validate-g0a3-memory.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";
import { buildG0A3MemoryId, buildG0A3MemoryKey } from "../../dist/domain/memory.js";

const lenoseedId = "K-G0A3-INTENTION";
const systemSourceId = "SRC-G0A3-SYSTEM";
const humanSourceId = "SRC-G0A3-OPERATOR";
const humanActorRef = "OP-G0A3-001";
const episodeKey = "EP-G0A3-CALIBRATION-01";
const createdAt = "2026-08-14T09:00:00.000Z";
const turnId = "T-G0A3-CALIBRATION-02";
const engineVersion = "lenoseed-g0a3-memory-intention-v1";
const requestText = "Utilise la configuration A pour le test de calibration.";
const fixtureBuilderEvent = { id: "E-FIXTURE", lenoseedId, sourceId: humanSourceId, occurredAt: createdAt };
const failureText = buildG0A3CalibrationFailureTestimony(fixtureBuilderEvent).grounding.supportingExcerpt;
const explanationText = buildG0A3InitialFailureCauseTestimony(fixtureBuilderEvent).grounding.supportingExcerpt;

async function createScenario({ memory = true } = {}) {
  const store = new InMemoryStore();
  await store.registerSource({ id: systemSourceId, kind: "system", actorRef: null, channel: "test", createdAt });
  await store.registerSource({ id: humanSourceId, kind: "human", actorRef: humanActorRef, channel: "test", createdAt });
  await store.appendEvent(event({ id: "E-CREATED", sequence: 1, type: "lenoseed_created", sourceId: systemSourceId, payload: { generation: 0 }, payloadSchemaVersion: 1 }));
  const request = humanFixture("calibration-01-request", 2, "configuration_request", requestText);
  const intention = event({ ...identity("calibration-01-intention"), sequence: 3, type: "intention_selected", sourceId: systemSourceId, payload: { intentionId: `I-G0A3-${lenoseedId}-CALIBRATION-01`, protocol: "G0-A3", episodeKey, kind: "run_calibration_with_configuration_a", motivation: "execute_requested_calibration_configuration", triggerEventIds: [request.id], triggerMemoryIds: [] }, payloadSchemaVersion: 3, causedByEventIds: [request.id] });
  const failure = humanFixture("calibration-01-failure", 4, "calibration_failure_report", failureText);
  const explanation = humanFixture("calibration-01-initial-explanation", 5, "initial_failure_explanation", explanationText);
  for (const item of [request, intention, failure, explanation]) await store.appendEvent(item);
  await materializeG0A3InitialCalibrationEvidence({ lenoseedId, configurationRequestEventId: request.id, intentionEventId: intention.id, failureEventId: failure.id, initialExplanationEventId: explanation.id }, store);
  const result = memory ? await consolidateG0A3Memory(consolidationInput(), store) : null;
  return { store, memory: result?.memory ?? null, initialExplanation: explanation };
}

function identity(suffix) { return { id: buildG0A3CalibrationFixtureEventId(lenoseedId, suffix), idempotencyKey: buildG0A3CalibrationFixtureEventIdempotencyKey(lenoseedId, suffix) }; }
function humanFixture(suffix, sequence, fixtureKind, text) { return event({ ...identity(suffix), sequence, type: "human_message_received", sourceId: humanSourceId, actorRef: humanActorRef, payload: { text, protocol: "G0-A3", episodeKey, fixtureKind }, payloadSchemaVersion: 3 }); }
function event(overrides) { return { id: overrides.id, lenoseedId, sequence: overrides.sequence, type: overrides.type, occurredAt: overrides.occurredAt ?? `2026-08-14T09:00:0${overrides.sequence}.000Z`, turnId: overrides.turnId ?? null, sourceId: overrides.sourceId, actorRef: overrides.actorRef ?? null, causedByEventIds: overrides.causedByEventIds ?? [], observedStateVersion: overrides.observedStateVersion ?? 0, payload: overrides.payload, payloadSchemaVersion: overrides.payloadSchemaVersion, engineVersion: overrides.engineVersion ?? engineVersion, idempotencyKey: overrides.idempotencyKey ?? overrides.id }; }
function consolidationInput() { return { lenoseedId, episodeKey, systemSourceId, evidenceItemIds: [`EV-G0A3-OBS-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-intention")}`, `EV-G0A3-TESTIMONY-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-failure")}-outcome`, `EV-G0A3-TESTIMONY-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-initial-explanation")}-cause`], expectedStateVersion: 1, engineVersion: "lenoseed-g0a3-memory-consolidation-v1" }; }
function revisionInput(expectedStateVersion) { const ids = revisedIds(lenoseedId); return { lenoseedId, episodeKey, systemSourceId, evidenceItemIds: [ids.e1Id, ids.e2Id, ids.e4Id, ids.e5Id], expectedStateVersion, engineVersion: "lenoseed-g0a3-memory-revision-v2" }; }
function input(overrides = {}) { return { lenoseedId, turnId, humanSourceId, humanActorRef, systemSourceId, occurredAt: "2026-08-14T10:00:00.000Z", engineVersion, includeMemory: true, ...overrides }; }

async function appendFutureV2(store, v1) {
  const v2 = {
    ...v1,
    id: buildG0A3MemoryId(lenoseedId, episodeKey, 2),
    version: 2,
    gist: "Future revision fixture.",
    status: "active",
    revisionOf: v1.id,
  };
  await store.atomicCommit(
    lenoseedId,
    await store.getStateVersion(lenoseedId),
    { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [], memories: [{ ...v1, status: "revised" }, v2] },
    "g0a3:future-v2-memory-intention-fixture",
  );
  return v2;
}

function withTurnEvents(store, transform) {
  return new Proxy(store, { get(target, property, receiver) {
    if (property === "readEventsByTurn") return async (...args) => transform(await target.readEventsByTurn(...args));
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  }});
}

const replayForbiddenMethods = [
  "getStateVersion",
  "readSource",
  "readEventsInSequence",
  "readActiveMemoryByKey",
  "readMemory",
  "readMemoryHistoryByKey",
  "readEvidenceItem",
  "readEventById",
  "atomicCommit",
  "appendEvent",
];

function replayOnlyPersistence(store) {
  return new Proxy(store, { get(target, property, receiver) {
    if (replayForbiddenMethods.includes(property)) return () => { throw new Error(`${String(property)} must not be called during replay`); };
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  }});
}

test("G0-A3 v1 persists the canonical situation and Memory-driven intention without a state commit", async () => {
  const { store, memory } = await createScenario();
  const before = await store.getStateVersion(lenoseedId);
  const result = await selectG0A3MemoryIntention(input(), store);
  assert.equal(result.replayed, false);
  assert.deepEqual(result.intention, {
    id: `I-${turnId}`,
    lenoseedId,
    kind: "use_configuration_b",
    target: humanActorRef,
    triggerEventIds: [result.situationEvent.id],
    triggerEvidenceItemIds: [],
    triggerBeliefIds: [],
    triggerSelfHypothesisIds: [],
    triggerMemoryIds: [memory.id],
    motivation: "apply_active_g0a3_memory_avoid_reported_incompatibility",
    observedStateVersion: before,
    status: "selected",
    createdAt: input().occurredAt,
  });
  assert.deepEqual(result.situationEvent.payload, { text: "Une nouvelle calibration du même modèle de capteur doit être lancée.\nLes configurations A et B sont disponibles.\nLe câble C peut être vérifié avant le lancement.", protocol: "G0-A3", situationId: "S-G0A3-CALIBRATION-02", relevantEpisodeKey: episodeKey, availableConfigurations: ["A", "B"], cableCanBeChecked: true });
  assert.deepEqual({ id: result.situationEvent.id, idempotencyKey: result.situationEvent.idempotencyKey, type: result.situationEvent.type, turnId: result.situationEvent.turnId, sourceId: result.situationEvent.sourceId, actorRef: result.situationEvent.actorRef, causedByEventIds: result.situationEvent.causedByEventIds, observedStateVersion: result.situationEvent.observedStateVersion, payloadSchemaVersion: result.situationEvent.payloadSchemaVersion, occurredAt: result.situationEvent.occurredAt, engineVersion: result.situationEvent.engineVersion }, { id: `E-${turnId}-input`, idempotencyKey: `${turnId}:input`, type: "human_message_received", turnId, sourceId: humanSourceId, actorRef: humanActorRef, causedByEventIds: [], observedStateVersion: before, payloadSchemaVersion: 3, occurredAt: input().occurredAt, engineVersion });
  const { sequence: intentionSequence, ...intentionEvent } = result.intentionEvent;
  assert.ok(intentionSequence > result.situationEvent.sequence);
  assert.deepEqual(intentionEvent, {
    id: `E-${turnId}-intention`,
    lenoseedId,
    type: "intention_selected",
    occurredAt: input().occurredAt,
    turnId,
    sourceId: systemSourceId,
    actorRef: null,
    causedByEventIds: [result.situationEvent.id],
    observedStateVersion: before,
    payload: {
      intentionId: `I-${turnId}`,
      protocol: "G0-A3",
      situationId: "S-G0A3-CALIBRATION-02",
      kind: "use_configuration_b",
      motivation: "apply_active_g0a3_memory_avoid_reported_incompatibility",
      triggerEventIds: [result.situationEvent.id],
      triggerMemoryIds: [memory.id],
    },
    payloadSchemaVersion: 3,
    engineVersion,
    idempotencyKey: `${turnId}:intention`,
  });
  assert.equal(await store.getStateVersion(lenoseedId), before);
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, buildG0A3MemoryKey(lenoseedId, episodeKey)), memory);
});

test("G0-A3 real revision causally changes the future structured intention from v1 to v2", async () => {
  const { store, memory: v1, initialExplanation } = await createScenario();
  const memoryKey = buildG0A3MemoryKey(lenoseedId, episodeKey);
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, memoryKey), v1);
  assert.deepEqual({ version: v1.version, status: v1.status }, { version: 1, status: "active" });

  const first = await selectG0A3MemoryIntention(input(), store);
  assert.equal(first.replayed, false);
  assert.deepEqual(
    {
      kind: first.intention.kind,
      motivation: first.intention.motivation,
      triggerMemoryIds: first.intention.triggerMemoryIds,
      status: first.intention.status,
    },
    {
      kind: "use_configuration_b",
      motivation: "apply_active_g0a3_memory_avoid_reported_incompatibility",
      triggerMemoryIds: [v1.id],
      status: "selected",
    },
  );
  assert.deepEqual(
    {
      kind: first.intentionEvent.payload.kind,
      motivation: first.intentionEvent.payload.motivation,
      triggerMemoryIds: first.intentionEvent.payload.triggerMemoryIds,
    },
    {
      kind: "use_configuration_b",
      motivation: "apply_active_g0a3_memory_avoid_reported_incompatibility",
      triggerMemoryIds: [v1.id],
    },
  );

  const ids = revisedIds(lenoseedId);
  const e3BeforeCorrection = await store.readEvidenceItem(lenoseedId, ids.e3Id);
  assert.notEqual(e3BeforeCorrection, null);
  const correction = {
    ...humanFixture("calibration-01-correction", 10, "failure_explanation_correction", G0A3_CORRECTION_TEXT),
    occurredAt: "2026-08-14T10:30:00.000Z",
  };
  await store.appendEvent(correction);
  await materializeG0A3CorrectionEvidence({
    lenoseedId,
    initialExplanationEventId: initialExplanation.id,
    correctionEventId: correction.id,
  }, store);
  const e3 = await store.readEvidenceItem(lenoseedId, ids.e3Id);
  const e5 = await store.readEvidenceItem(lenoseedId, ids.e5Id);
  assert.notEqual(e3, null);
  assert.deepEqual(e3, e3BeforeCorrection);
  assert.equal(e5?.supersedesId, e3.id);

  const stateVersionBeforeRevision = await store.getStateVersion(lenoseedId);
  assert.equal(stateVersionBeforeRevision, 3);
  const revision = await reviseG0A3Memory(revisionInput(stateVersionBeforeRevision), store);
  const v2 = revision.memory;
  const revisedV1 = { ...v1, status: "revised" };
  assert.deepEqual(await store.readMemoryHistoryByKey(lenoseedId, memoryKey), [revisedV1, v2]);
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, memoryKey), v2);
  assert.deepEqual({ version: v2.version, status: v2.status, revisionOf: v2.revisionOf }, {
    version: 2,
    status: "active",
    revisionOf: v1.id,
  });

  const secondInput = input({
    turnId: "T-G0A3-CALIBRATION-03",
    occurredAt: "2026-08-14T11:00:00.000Z",
  });
  const second = await selectG0A3MemoryIntention(secondInput, store);
  assert.equal(second.replayed, false);
  assert.deepEqual(second.situationEvent.payload, first.situationEvent.payload);
  assert.notEqual(second.situationEvent.turnId, first.situationEvent.turnId);
  assert.notEqual(second.situationEvent.observedStateVersion, first.situationEvent.observedStateVersion);
  assert.deepEqual(
    {
      kind: second.intention.kind,
      motivation: second.intention.motivation,
      triggerMemoryIds: second.intention.triggerMemoryIds,
      status: second.intention.status,
    },
    {
      kind: "use_configuration_a_after_checking_cable_c",
      motivation: "apply_active_g0a3_memory_check_corrected_cable_cause",
      triggerMemoryIds: [v2.id],
      status: "selected",
    },
  );
  assert.deepEqual(
    {
      kind: second.intentionEvent.payload.kind,
      motivation: second.intentionEvent.payload.motivation,
      triggerMemoryIds: second.intentionEvent.payload.triggerMemoryIds,
    },
    {
      kind: "use_configuration_a_after_checking_cable_c",
      motivation: "apply_active_g0a3_memory_check_corrected_cable_cause",
      triggerMemoryIds: [v2.id],
    },
  );

  const stateVersionBeforeAblation = await store.getStateVersion(lenoseedId);
  const ablationPersistence = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readActiveMemoryByKey") {
        return () => { throw new Error("v2 ablation must not consume active Memory"); };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const ablation = await selectG0A3MemoryIntention(input({
    turnId: "T-G0A3-CALIBRATION-04",
    occurredAt: "2026-08-14T11:30:00.000Z",
    includeMemory: false,
  }), ablationPersistence);
  assert.deepEqual(
    {
      kind: ablation.intention.kind,
      motivation: ablation.intention.motivation,
      triggerMemoryIds: ablation.intention.triggerMemoryIds,
    },
    {
      kind: "request_new_diagnostic",
      motivation: "apply_neutral_g0a3_policy_without_memory",
      triggerMemoryIds: [],
    },
  );
  assert.equal(await store.getStateVersion(lenoseedId), stateVersionBeforeAblation);
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, memoryKey), v2);
  assert.equal((await store.readEventsInSequence(lenoseedId)).some((event) => event.type === "ablation_applied"), false);

  const replay = await selectG0A3MemoryIntention(
    { ...secondInput, includeMemory: false },
    replayOnlyPersistence(store),
  );
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.intention, second.intention);
  assert.deepEqual(
    {
      kind: replay.intention.kind,
      triggerMemoryIds: replay.intention.triggerMemoryIds,
    },
    {
      kind: "use_configuration_a_after_checking_cable_c",
      triggerMemoryIds: [v2.id],
    },
  );
});

test("G0-A3 reads the turn history before any new-turn dependency", async () => {
  const { store } = await createScenario();
  const calls = [];
  const persistence = new Proxy(store, { get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== "function") return value;
    return async (...args) => {
      calls.push({ property, args });
      return value.apply(target, args);
    };
  }});
  await selectG0A3MemoryIntention(input(), persistence);
  assert.deepEqual(calls[0], { property: "readEventsByTurn", args: [lenoseedId, turnId] });
  for (const property of ["readSource", "getStateVersion", "readEventsInSequence", "readActiveMemoryByKey", "appendEvent"]) {
    assert.ok(calls.findIndex((call) => call.property === property) > 0, `${property} follows readEventsByTurn`);
  }
});

test("G0-A3 C1 and ablation are neutral without reconstructing or consuming Memory", async () => {
  const c1 = await createScenario({ memory: false });
  const c1Persistence = new Proxy(c1.store, {
    get(target, property, receiver) {
      if (["readMemory", "readMemoryHistoryByKey", "readEvidenceItem", "readEventById", "atomicCommit"].includes(property)) return () => { throw new Error(`${String(property)} must not reconstruct a Memory`); };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const c1Result = await selectG0A3MemoryIntention(input({ turnId: "T-C1" }), c1Persistence);
  assert.deepEqual({ kind: c1Result.intention.kind, triggerMemoryIds: c1Result.intention.triggerMemoryIds }, { kind: "request_new_diagnostic", triggerMemoryIds: [] });
  assert.equal(await c1.store.readActiveMemoryByKey(lenoseedId, buildG0A3MemoryKey(lenoseedId, episodeKey)), null);
  for (const evidenceItemId of consolidationInput().evidenceItemIds) assert.notEqual(await c1.store.readEvidenceItem(lenoseedId, evidenceItemId), null);
  assert.ok((await c1.store.readEventsInSequence(lenoseedId)).some((item) => item.type === "human_message_received"));

  const ablation = await createScenario();
  const before = await ablation.store.getStateVersion(lenoseedId);
  const ablationPersistence = new Proxy(ablation.store, {
    get(target, property, receiver) {
      if (property === "readActiveMemoryByKey") return () => { throw new Error("ablation must not read active Memory"); };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const result = await selectG0A3MemoryIntention(input({ turnId: "T-ABLATION", includeMemory: false }), ablationPersistence);
  assert.deepEqual({ kind: result.intention.kind, triggerMemoryIds: result.intention.triggerMemoryIds }, { kind: "request_new_diagnostic", triggerMemoryIds: [] });
  assert.equal(await ablation.store.getStateVersion(lenoseedId), before);
  assert.deepEqual(await ablation.store.readActiveMemoryByKey(lenoseedId, ablation.memory.memoryKey), ablation.memory);
  assert.equal((await ablation.store.readEventsInSequence(lenoseedId)).some((item) => item.type === "ablation_applied"), false);
  const ablationReplay = await selectG0A3MemoryIntention(input({ turnId: "T-ABLATION", includeMemory: true }), ablation.store);
  assert.equal(ablationReplay.replayed, true);
  assert.deepEqual(ablationReplay.intention, result.intention);
});

test("G0-A3 complete replay ignores current Memory access and includeMemory", async () => {
  const { store } = await createScenario();
  const first = await selectG0A3MemoryIntention(input(), store);
  const replay = await selectG0A3MemoryIntention(input({ includeMemory: false }), replayOnlyPersistence(store));
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.intention, first.intention);
  assert.deepEqual(replay.intentionEvent, first.intentionEvent);
});

test("G0-A3 replay stays causal after a future structural v2 and state version change", async () => {
  const { store, memory } = await createScenario();
  const first = await selectG0A3MemoryIntention(input(), store);
  const v2 = await appendFutureV2(store, memory);
  assert.equal((await store.getStateVersion(lenoseedId)) > first.intention.observedStateVersion, true);
  assert.equal((await store.readActiveMemoryByKey(lenoseedId, memory.memoryKey)).id, v2.id);
  const replayPort = new Proxy(store, {
    get(target, property, receiver) {
      if (["getStateVersion", "readActiveMemoryByKey", "readMemory", "readMemoryHistoryByKey", "readEvidenceItem", "readEventById", "atomicCommit"].includes(property)) return () => { throw new Error(`${String(property)} must not be called during replay`); };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const replay = await selectG0A3MemoryIntention(input({ includeMemory: false }), replayPort);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.intention, first.intention);
  assert.equal(replay.intention.kind, "use_configuration_b");
});

test("G0-A3 replay accepts the reserved historical v2 selection without reading Memory", async () => {
  const { store } = await createScenario();
  const first = await selectG0A3MemoryIntention(input(), store);
  const v2MemoryId = buildG0A3MemoryId(lenoseedId, episodeKey, 2);
  const persistence = withTurnEvents(store, (events) => events.map((item) => item.type === "intention_selected" ? {
    ...item,
    payload: {
      ...item.payload,
      kind: "use_configuration_a_after_checking_cable_c",
      motivation: "apply_active_g0a3_memory_check_corrected_cable_cause",
      triggerMemoryIds: [v2MemoryId],
    },
  } : item));
  const replay = await selectG0A3MemoryIntention(input({ includeMemory: false }), new Proxy(persistence, {
    get(target, property, receiver) {
      if (["getStateVersion", "readActiveMemoryByKey", "readMemory", "readMemoryHistoryByKey", "readEvidenceItem", "readEventById", "atomicCommit"].includes(property)) return () => { throw new Error(`${String(property)} must not be called during replay`); };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }));
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual({ kind: replay.intention.kind, motivation: replay.intention.motivation, triggerMemoryIds: replay.intention.triggerMemoryIds }, { kind: "use_configuration_a_after_checking_cable_c", motivation: "apply_active_g0a3_memory_check_corrected_cable_cause", triggerMemoryIds: [v2MemoryId] });
});

test("G0-A3 rejects an orphaned situation after an interrupted first attempt", async () => {
  const { store } = await createScenario();
  let situationWritten = false;
  const interrupted = new Proxy(store, { get(target, property, receiver) {
    if (property === "appendEvent") return async (item) => { await target.appendEvent(item); if (item.type === "human_message_received") situationWritten = true; };
    if (property === "readActiveMemoryByKey") return () => { throw new Error("interrupted Memory read"); };
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  }});
  await assert.rejects(() => selectG0A3MemoryIntention(input(), interrupted), /interrupted Memory read/);
  assert.equal(situationWritten, true);
  assert.equal((await store.readEventsByTurn(lenoseedId, turnId)).filter((item) => item.type === "intention_selected").length, 0);
  const eventCountBeforeRetry = (await store.readEventsInSequence(lenoseedId)).length;
  await assert.rejects(() => selectG0A3MemoryIntention(input(), replayOnlyPersistence(store)), DomainInvariantError);
  assert.equal((await store.readEventsInSequence(lenoseedId)).length, eventCountBeforeRetry);
});

test("G0-A3 validates sources before it writes the situation", async (t) => {
  const replacements = [
    ["missing human", async (target, id) => id === humanSourceId ? null : target.readSource(id)],
    ["human actor mismatch", async (target, id) => id === humanSourceId ? { id, kind: "human", actorRef: "OP-FORGED", channel: "test", createdAt } : target.readSource(id)],
    ["human source id mismatch", async (target, id) => id === humanSourceId ? { id: "SRC-FORGED", kind: "human", actorRef: humanActorRef, channel: "test", createdAt } : target.readSource(id)],
    ["missing system", async (target, id) => id === systemSourceId ? null : target.readSource(id)],
    ["non-system source", async (target, id) => id === systemSourceId ? { id, kind: "human", actorRef: humanActorRef, channel: "test", createdAt } : target.readSource(id)],
    ["system source id mismatch", async (target, id) => id === systemSourceId ? { id: "SRC-FORGED", kind: "system", actorRef: null, channel: "test", createdAt } : target.readSource(id)],
  ];
  for (const [name, readSource] of replacements) {
    await t.test(name, async () => {
      const { store } = await createScenario();
      const before = (await store.readEventsInSequence(lenoseedId)).length;
      const persistence = new Proxy(store, {
        get(target, property, receiver) {
          if (property === "readSource") return (id) => readSource(target, id);
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await assert.rejects(() => selectG0A3MemoryIntention(input(), persistence), DomainInvariantError);
      assert.equal((await store.readEventsInSequence(lenoseedId)).length, before);
    });
  }
});

test("G0-A3 closes malformed historical decision payloads and impossible turn shapes", async (t) => {
  const { store } = await createScenario();
  await selectG0A3MemoryIntention(input(), store);
  const cases = [
    ["wrong kind", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, payload: { ...item.payload, kind: "answer_question" } } : item)],
    ["wrong motivation", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, payload: { ...item.payload, motivation: "forged" } } : item)],
    ["wrong trigger", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, payload: { ...item.payload, triggerMemoryIds: [] } } : item)],
    ["enumerable payload field", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, payload: { ...item.payload, recommendedAction: "use_configuration_b" } } : item)],
    ["missing payload field", (events) => events.map((item) => { if (item.type !== "intention_selected") return item; const { triggerMemoryIds, ...payload } = item.payload; return { ...item, payload }; })],
    ["hidden payload field", (events) => events.map((item) => { if (item.type !== "intention_selected") return item; const payload = { ...item.payload }; Object.defineProperty(payload, "hidden", { value: true, enumerable: false }); return { ...item, payload }; })],
    ["symbol payload field", (events) => events.map((item) => { if (item.type !== "intention_selected") return item; const payload = { ...item.payload }; payload[Symbol("hidden")] = true; return { ...item, payload }; })],
    ["wrong cause", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, causedByEventIds: [] } : item)],
    ["wrong intention id", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, id: "E-FORGED-intention" } : item)],
    ["wrong intention idempotency key", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, idempotencyKey: "forged:intention" } : item)],
    ["wrong intention observed state version", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, observedStateVersion: item.observedStateVersion + 1 } : item)],
    ["wrong system source", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, sourceId: "SRC-FORGED" } : item)],
    ["wrong trigger event", (events) => events.map((item) => item.type === "intention_selected" ? { ...item, payload: { ...item.payload, triggerEventIds: ["E-FORGED"] } } : item)],
    ["wrong situation payload", (events) => events.map((item) => item.type === "human_message_received" ? { ...item, payload: { ...item.payload, text: "forged" } } : item)],
    ["wrong situation idempotency key", (events) => events.map((item) => item.type === "human_message_received" ? { ...item, idempotencyKey: "forged:input" } : item)],
  ];
  for (const [name, transform] of cases) await t.test(name, async () => assert.rejects(() => selectG0A3MemoryIntention(input(), withTurnEvents(store, transform)), DomainInvariantError));
  const history = await store.readEventsByTurn(lenoseedId, turnId);
  const situation = history.find((item) => item.type === "human_message_received");
  const intention = history.find((item) => item.type === "intention_selected");
  await t.test("two situations", async () => assert.rejects(() => selectG0A3MemoryIntention(input(), withTurnEvents(store, (events) => [...events, situation])), DomainInvariantError));
  await t.test("two intentions", async () => assert.rejects(() => selectG0A3MemoryIntention(input(), withTurnEvents(store, (events) => [...events, intention])), DomainInvariantError));
  await t.test("intention without situation", async () => assert.rejects(() => selectG0A3MemoryIntention(input(), withTurnEvents(store, (events) => [intention])), DomainInvariantError));
  await t.test("situation without intention", async () => assert.rejects(() => selectG0A3MemoryIntention(input(), withTurnEvents(store, (events) => [situation])), DomainInvariantError));
  await t.test("incompatible third event", async () => assert.rejects(() => selectG0A3MemoryIntention(input(), withTurnEvents(store, (events) => [...events, { ...situation, type: "lenoseed_created" }])), DomainInvariantError));
});
