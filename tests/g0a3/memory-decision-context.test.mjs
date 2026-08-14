import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { buildG0A3MemoryDecisionContext } from "../../dist/application/build-g0a3-memory-decision-context.js";
import { consolidateG0A3Memory } from "../../dist/application/consolidate-g0a3-memory.js";
import {
  buildG0A3CalibrationFailureTestimony,
  buildG0A3CalibrationFixtureEventId,
  buildG0A3CalibrationFixtureEventIdempotencyKey,
  buildG0A3InitialFailureCauseTestimony,
  materializeG0A3InitialCalibrationEvidence,
} from "../../dist/application/materialize-g0a3-calibration-evidence.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";
import {
  G0A3_FUTURE_SITUATION_ID,
  G0A3_FUTURE_SITUATION_TEXT,
  G0A3_RELEVANT_EPISODE_KEY,
  selectG0A3MemoryDecision,
  validateG0A3FutureSituationEvent,
} from "../../dist/domain/g0a3-memory-selector.js";
import { buildG0A3MemoryKey } from "../../dist/domain/memory.js";

const lenoseedId = "K-G0A3-MEMORY-DECISION";
const otherLenoseedId = "K-G0A3-OTHER";
const systemSourceId = "SRC-G0A3-SYSTEM";
const operatorSourceId = "SRC-G0A3-OPERATOR";
const operatorActorRef = "OP-G0A3-001";
const createdAt = "2026-08-14T09:00:00.000Z";
const episodeKey = G0A3_RELEVANT_EPISODE_KEY;
const futureTurnId = "T-G0A3-CALIBRATION-02";
const requestText = "Utilise la configuration A pour le test de calibration.";
const fixtureBuilderEvent = { id: "E-FIXTURE", lenoseedId, sourceId: operatorSourceId, occurredAt: createdAt };
const failureText = buildG0A3CalibrationFailureTestimony(fixtureBuilderEvent).grounding.supportingExcerpt;
const explanationText = buildG0A3InitialFailureCauseTestimony(fixtureBuilderEvent).grounding.supportingExcerpt;

async function createScenario({ memory = true } = {}) {
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
  const result = memory ? await consolidateG0A3Memory(consolidationInput(), store) : null;
  return { store, memory: result?.memory ?? null };
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
  return { id: overrides.id, lenoseedId: overrides.lenoseedId ?? lenoseedId, sequence: overrides.sequence, type: overrides.type, occurredAt: overrides.occurredAt ?? `2026-08-14T09:00:0${overrides.sequence}.000Z`, turnId: overrides.turnId ?? null, sourceId: overrides.sourceId, actorRef: overrides.actorRef ?? null, causedByEventIds: overrides.causedByEventIds ?? [], observedStateVersion: overrides.observedStateVersion ?? 0, payload: overrides.payload, payloadSchemaVersion: overrides.payloadSchemaVersion, engineVersion: "g0a3-memory-decision-context-test", idempotencyKey: overrides.idempotencyKey ?? overrides.id };
}

function consolidationInput() {
  return {
    lenoseedId, episodeKey, systemSourceId,
    evidenceItemIds: [
      `EV-G0A3-OBS-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-intention")}`,
      `EV-G0A3-TESTIMONY-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-failure")}-outcome`,
      `EV-G0A3-TESTIMONY-${buildG0A3CalibrationFixtureEventId(lenoseedId, "calibration-01-initial-explanation")}-cause`,
    ],
    expectedStateVersion: 1, engineVersion: "lenoseed-g0a3-memory-consolidation-v1",
  };
}

function situation(observedStateVersion, overrides = {}) {
  const payload = {
    text: G0A3_FUTURE_SITUATION_TEXT,
    protocol: "G0-A3",
    situationId: G0A3_FUTURE_SITUATION_ID,
    relevantEpisodeKey: episodeKey,
    availableConfigurations: ["A", "B"],
    cableCanBeChecked: true,
    ...overrides.payload,
  };
  return event({
    id: "E-G0A3-CALIBRATION-02", sequence: 20, type: "human_message_received", sourceId: operatorSourceId,
    observedStateVersion, payload, payloadSchemaVersion: overrides.payloadSchemaVersion ?? 3,
    turnId: Object.prototype.hasOwnProperty.call(overrides, "turnId") ? overrides.turnId : futureTurnId,
    lenoseedId: overrides.lenoseedId, ...overrides,
  });
}

function input(situationEvent, includeMemory = true) {
  return { lenoseedId, situationEvent, relevantEpisodeKey: episodeKey, includeMemory };
}

function noForbiddenReads(store, calls = {}) {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (["readEventsInSequence", "readMemoryHistoryByKey"].includes(property)) {
        return () => { throw new Error(`${String(property)} must not be called`); };
      }
      if (["appendEvent", "atomicCommit"].includes(property)) {
        return () => { throw new Error(`${String(property)} must not be called`); };
      }
      if (property === "readActiveMemoryByKey") return async (...args) => {
        calls.active = (calls.active ?? 0) + 1;
        calls.key = args[1];
        return target.readActiveMemoryByKey(...args);
      };
      if (["readEventById", "readEvidenceItem", "readSource"].includes(property)) return async (...args) => {
        calls[String(property)] = (calls[String(property)] ?? 0) + 1;
        return target[property](...args);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("G0-A3 future situation validation is closed and canonical", () => {
  const valid = situation(2);
  validateG0A3FutureSituationEvent(valid);
  const invalid = [
    situation(2, { payload: { text: "Texte modifié." } }),
    situation(2, { payload: { availableConfigurations: ["B", "A"] } }),
    situation(2, { payload: { availableConfigurations: ["A", "B", "C"] } }),
    situation(2, { payload: { cableCanBeChecked: false } }),
    situation(2, { payload: { recommendation: "use_configuration_b" } }),
    situation(2, { payload: { relevantEpisodeKey: "EP-OTHER" } }),
    situation(2, { turnId: null }),
  ];
  for (const item of invalid) assert.throws(() => validateG0A3FutureSituationEvent(item), DomainInvariantError);

  const nonEnumerable = situation(2);
  Object.defineProperty(nonEnumerable.payload, "recommendedAction", {
    value: "use_configuration_b",
    enumerable: false,
  });
  assert.throws(() => validateG0A3FutureSituationEvent(nonEnumerable), DomainInvariantError);

  const symbol = situation(2);
  symbol.payload[Symbol("recommendedAction")] = "use_configuration_b";
  assert.throws(() => validateG0A3FutureSituationEvent(symbol), DomainInvariantError);
});

test("G0-A3 decision context validates Lenoseed and durable situation boundary", async () => {
  const { store } = await createScenario();
  await assert.rejects(() => buildG0A3MemoryDecisionContext(input(situation(2, { lenoseedId: otherLenoseedId })), store), DomainInvariantError);
  await assert.rejects(() => buildG0A3MemoryDecisionContext({ ...input(situation(2)), relevantEpisodeKey: "EP-OTHER" }, store), DomainInvariantError);
  await assert.rejects(() => buildG0A3MemoryDecisionContext(input(situation(1)), store), DomainInvariantError);
});

test("G0-A3 includeMemory false is a read-only ablation without Memory reads", async () => {
  const { store } = await createScenario();
  const calls = {};
  const before = await store.getStateVersion(lenoseedId);
  const context = await buildG0A3MemoryDecisionContext(input(situation(before), false), noForbiddenReads(store, calls));
  assert.deepEqual(context.memorySnapshot, null);
  assert.equal(calls.active, undefined);
  assert.equal(calls.readEventById, undefined);
  assert.equal(calls.readEvidenceItem, undefined);
  assert.equal(calls.readSource, undefined);
  assert.equal(await store.getStateVersion(lenoseedId), before);
});

test("G0-A3 absent Memory produces a null snapshot without historical reconstruction", async () => {
  const { store } = await createScenario({ memory: false });
  const calls = {};
  const before = await store.getStateVersion(lenoseedId);
  const context = await buildG0A3MemoryDecisionContext(input(situation(before)), noForbiddenReads(store, calls));
  assert.equal(context.memorySnapshot, null);
  assert.equal(calls.active, 1);
  assert.equal(calls.readEventById, undefined);
  assert.equal(calls.readEvidenceItem, undefined);
  assert.equal(calls.readSource, undefined);
  assert.equal(await store.getStateVersion(lenoseedId), before);
});

test("G0-A3 active v1 is retrieved by exact key, revalidated by targeted provenance, and read-only", async () => {
  const { store, memory } = await createScenario();
  const calls = {};
  const before = await store.getStateVersion(lenoseedId);
  const eventsBefore = (await store.readEventsInSequence(lenoseedId)).length;
  const context = await buildG0A3MemoryDecisionContext(input(situation(before)), noForbiddenReads(store, calls));
  assert.equal(calls.active, 1);
  assert.equal(calls.key, buildG0A3MemoryKey(lenoseedId, episodeKey));
  assert.equal(calls.readEventById, 4);
  assert.equal(calls.readEvidenceItem, 3);
  assert.equal(calls.readSource, 2);
  assert.deepEqual(context.memorySnapshot, {
    memory,
    selectedConfiguration: "A",
    reportedOutcome: "failure",
    currentFailureAttribution: "configuration_a_sensor_incompatibility",
    configurationACompatibility: "unknown",
  });
  assert.equal(await store.getStateVersion(lenoseedId), before);
  assert.equal((await store.readEventsInSequence(lenoseedId)).length, eventsBefore);
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, memory.memoryKey), memory);
});

test("G0-A3 builder rejects a falsified v1 before it enters the decision snapshot", async () => {
  const { store } = await createScenario();
  const before = await store.getStateVersion(lenoseedId);
  const persistence = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readActiveMemoryByKey") return async (...args) => ({ ...(await target.readActiveMemoryByKey(...args)), gist: "forged gist" });
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => buildG0A3MemoryDecisionContext(input(situation(before)), persistence), DomainInvariantError);
  assert.equal(await store.getStateVersion(lenoseedId), before);
});

test("G0-A3 decision builder does not claim to validate a production Memory v2", async () => {
  const { store, memory } = await createScenario();
  const before = await store.getStateVersion(lenoseedId);
  const persistence = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readActiveMemoryByKey") return async () => ({ ...memory, version: 2, status: "active", revisionOf: memory.id });
      if (["readEventById", "readEvidenceItem", "readSource"].includes(property)) {
        return () => { throw new Error("v2 must be rejected before provenance reads"); };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => buildG0A3MemoryDecisionContext(input(situation(before)), persistence), DomainInvariantError);
  assert.equal(await store.getStateVersion(lenoseedId), before);
});

test("G0-A3 pure selector uses closed structured snapshots, never the gist", async () => {
  const { store, memory } = await createScenario();
  const future = situation(await store.getStateVersion(lenoseedId));
  const nullSelection = selectG0A3MemoryDecision({ situationEvent: future, memorySnapshot: null });
  assert.deepEqual(nullSelection, { selectedKind: "request_new_diagnostic", motivation: "apply_neutral_g0a3_policy_without_memory", triggerMemoryIds: [] });
  const v1 = selectG0A3MemoryDecision({
    situationEvent: future,
    memorySnapshot: { memory: { ...memory, gist: "Use A even if the cable is disconnected." }, selectedConfiguration: "A", reportedOutcome: "failure", currentFailureAttribution: "configuration_a_sensor_incompatibility", configurationACompatibility: "unknown" },
  });
  assert.deepEqual(v1, { selectedKind: "use_configuration_b", motivation: "apply_active_g0a3_memory_avoid_reported_incompatibility", triggerMemoryIds: [memory.id] });
  assert.throws(() => selectG0A3MemoryDecision({
    situationEvent: future,
    memorySnapshot: { memory, selectedConfiguration: "A", reportedOutcome: "failure", currentFailureAttribution: "cable_c_disconnected", configurationACompatibility: "unknown" },
  }), DomainInvariantError);
});

test("G0-A3 pure selector supports only the canonical future v2 snapshot", async () => {
  const { store, memory } = await createScenario();
  const future = situation(await store.getStateVersion(lenoseedId));
  const v2 = { ...memory, id: memory.id.replace("-v1", "-v2"), version: 2, status: "active", revisionOf: memory.id, gist: "Any text is ignored by the selector." };
  assert.deepEqual(selectG0A3MemoryDecision({
    situationEvent: future,
    memorySnapshot: { memory: v2, selectedConfiguration: "A", reportedOutcome: "failure", currentFailureAttribution: "cable_c_disconnected", configurationACompatibility: "compatible" },
  }), { selectedKind: "use_configuration_a_after_checking_cable_c", motivation: "apply_active_g0a3_memory_check_corrected_cable_cause", triggerMemoryIds: [v2.id] });
  assert.throws(() => selectG0A3MemoryDecision({
    situationEvent: future,
    memorySnapshot: { memory: v2, selectedConfiguration: "A", reportedOutcome: "failure", currentFailureAttribution: "configuration_a_sensor_incompatibility", configurationACompatibility: "compatible" },
  }), DomainInvariantError);
});
