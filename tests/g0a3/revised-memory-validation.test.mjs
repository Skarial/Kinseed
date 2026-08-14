import test from "node:test";
import assert from "node:assert/strict";

import { DomainInvariantError } from "../../dist/domain/errors.js";
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
} from "../../dist/application/materialize-g0a3-calibration-evidence.js";
import {
  buildG0A3InitialMemory,
  buildG0A3RevisedMemory,
  G0A3_REVISED_MEMORY_GIST,
  validateG0A3Memory,
} from "../../dist/application/validate-g0a3-memory.js";

const lenoseedId = "K-G0A3-REVISED-VALIDATION";
const episodeKey = G0A3_CALIBRATION_EPISODE_KEY;
const engineVersion = "g0a3-revised-memory-validation-test";

function fixtureIdentity(suffix) {
  return {
    id: buildG0A3CalibrationFixtureEventId(lenoseedId, suffix),
    idempotencyKey: buildG0A3CalibrationFixtureEventIdempotencyKey(lenoseedId, suffix),
  };
}

function event({ id, idempotencyKey, sequence, type, sourceId, actorRef = null, causedByEventIds = [], payload }) {
  return {
    id,
    lenoseedId,
    sequence,
    type,
    occurredAt: `2026-08-14T09:00:0${sequence}.000Z`,
    turnId: null,
    sourceId,
    actorRef,
    causedByEventIds,
    observedStateVersion: 0,
    payload,
    payloadSchemaVersion: 3,
    engineVersion,
    idempotencyKey,
  };
}

function scenario() {
  const request = event({
    ...fixtureIdentity("calibration-01-request"),
    sequence: 2,
    type: "human_message_received",
    sourceId: G0A3_OPERATOR_SOURCE_ID,
    actorRef: G0A3_OPERATOR_ACTOR_REF,
    payload: { text: G0A3_CONFIGURATION_REQUEST_TEXT, protocol: "G0-A3", episodeKey, fixtureKind: "configuration_request" },
  });
  const intention = event({
    ...fixtureIdentity("calibration-01-intention"),
    sequence: 3,
    type: "intention_selected",
    sourceId: G0A3_SYSTEM_SOURCE_ID,
    causedByEventIds: [request.id],
    payload: {
      intentionId: `I-G0A3-${lenoseedId}-CALIBRATION-01`,
      protocol: "G0-A3",
      episodeKey,
      kind: "run_calibration_with_configuration_a",
      motivation: "execute_requested_calibration_configuration",
      triggerEventIds: [request.id],
      triggerMemoryIds: [],
    },
  });
  const failure = event({
    ...fixtureIdentity("calibration-01-failure"),
    sequence: 4,
    type: "human_message_received",
    sourceId: G0A3_OPERATOR_SOURCE_ID,
    actorRef: G0A3_OPERATOR_ACTOR_REF,
    payload: { text: G0A3_CALIBRATION_FAILURE_TEXT, protocol: "G0-A3", episodeKey, fixtureKind: "calibration_failure_report" },
  });
  const initialExplanation = event({
    ...fixtureIdentity("calibration-01-initial-explanation"),
    sequence: 5,
    type: "human_message_received",
    sourceId: G0A3_OPERATOR_SOURCE_ID,
    actorRef: G0A3_OPERATOR_ACTOR_REF,
    payload: { text: G0A3_INITIAL_EXPLANATION_TEXT, protocol: "G0-A3", episodeKey, fixtureKind: "initial_failure_explanation" },
  });
  const correction = event({
    ...fixtureIdentity("calibration-01-correction"),
    sequence: 6,
    type: "human_message_received",
    sourceId: G0A3_OPERATOR_SOURCE_ID,
    actorRef: G0A3_OPERATOR_ACTOR_REF,
    payload: { text: G0A3_CORRECTION_TEXT, protocol: "G0-A3", episodeKey, fixtureKind: "failure_explanation_correction" },
  });
  const e1 = buildG0A3CalibrationObservation(intention);
  const e2 = buildG0A3CalibrationFailureTestimony(failure);
  const e3 = buildG0A3InitialFailureCauseTestimony(initialExplanation);
  const e4 = buildG0A3ConfigurationCompatibilityTestimony(correction);
  const e5 = buildG0A3CorrectedFailureCauseTestimony(correction, e3.id);
  const v1 = buildG0A3InitialMemory(lenoseedId, initialExplanation.occurredAt);
  const v2 = buildG0A3RevisedMemory(lenoseedId, correction.occurredAt, v1.id);
  return {
    request,
    intention,
    failure,
    initialExplanation,
    correction,
    e1,
    e2,
    e3,
    e4,
    e5,
    v1,
    v2,
    sourcesById: new Map([
      [G0A3_SYSTEM_SOURCE_ID, { id: G0A3_SYSTEM_SOURCE_ID, kind: "system", actorRef: null, channel: "test", createdAt: request.occurredAt }],
      [G0A3_OPERATOR_SOURCE_ID, { id: G0A3_OPERATOR_SOURCE_ID, kind: "human", actorRef: G0A3_OPERATOR_ACTOR_REF, channel: "test", createdAt: request.occurredAt }],
    ]),
    eventsById: new Map([request, intention, failure, initialExplanation, correction].map((item) => [item.id, item])),
    evidenceItemsById: new Map([e1, e2, e3, e4, e5].map((item) => [item.id, item])),
  };
}

function context(s, overrides = {}) {
  return {
    sourcesById: new Map(s.sourcesById),
    eventsById: new Map(s.eventsById),
    evidenceItemsById: new Map(s.evidenceItemsById),
    memoryHistory: [],
    ...overrides,
  };
}

function planned(s, overrides = {}) {
  return context(s, { memoryHistory: [s.v1], revisedMemoryValidationMode: "planned", ...overrides });
}

function durable(s, v1 = { ...s.v1, status: "revised" }, v2 = s.v2, overrides = {}) {
  return context(s, { memoryHistory: [v1, v2], revisedMemoryValidationMode: "durable", ...overrides });
}

function rejectsV2(s, candidate, validationContext) {
  assert.throws(() => validateG0A3Memory(candidate, validationContext), DomainInvariantError);
}

test("G0-A3 revised Memory builder and both validation boundaries are exact", () => {
  const s = scenario();
  assert.equal(
    G0A3_REVISED_MEMORY_GIST,
    "Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test et l’opérateur a signalé l’échec de la calibration ; une correction ultérieure indique que A était compatible et que le câble C était débranché.",
  );
  assert.deepEqual(s.v2, {
    id: `MEM-G0A3-${lenoseedId}-${episodeKey}-v2`,
    lenoseedId,
    memoryKey: `g0a3:${lenoseedId}:${episodeKey}`,
    episodeKey,
    version: 2,
    eventIds: [s.intention.id, s.failure.id, s.correction.id],
    evidenceItemIds: [s.e1.id, s.e2.id, s.e4.id, s.e5.id],
    gist: G0A3_REVISED_MEMORY_GIST,
    createdAt: s.correction.occurredAt,
    salience: "high",
    confidence: "high",
    status: "active",
    revisionOf: s.v1.id,
    lastRecalledAt: null,
  });
  validateG0A3Memory(s.v1, context(s));
  validateG0A3Memory(s.v1, context(s, { memoryHistory: [s.v1] }));
  validateG0A3Memory(s.v2, planned(s));
  const revisedV1 = { ...s.v1, status: "revised" };
  validateG0A3Memory(revisedV1, durable(s, revisedV1));
  validateG0A3Memory(s.v2, durable(s, revisedV1));
});

test("G0-A3 revised Memory rejects non-canonical version and history structures", async (t) => {
  await t.test("wrong v2 id", () => { const s = scenario(); rejectsV2(s, { ...s.v2, id: "MEM-FORGED" }, planned(s)); });
  await t.test("wrong memoryKey", () => { const s = scenario(); rejectsV2(s, { ...s.v2, memoryKey: "g0a3:forged:key" }, planned(s)); });
  await t.test("version three", () => { const s = scenario(); rejectsV2(s, { ...s.v2, version: 3 }, planned(s)); });
  await t.test("revisionOf null", () => { const s = scenario(); rejectsV2(s, { ...s.v2, revisionOf: null }, planned(s)); });
  await t.test("wrong predecessor", () => { const s = scenario(); rejectsV2(s, { ...s.v2, revisionOf: "MEM-FORGED" }, planned(s)); });
  await t.test("v1 modified outside status", () => { const s = scenario(); const v1 = { ...s.v1, status: "revised", gist: "forged" }; rejectsV2(s, s.v2, durable(s, v1)); });
  await t.test("two active", () => { const s = scenario(); rejectsV2(s, s.v2, durable(s, s.v1)); });
  await t.test("v1 active in durable history", () => { const s = scenario(); rejectsV2(s, s.v2, durable(s, s.v1)); });
  await t.test("v1 active cannot reactivate a durable v2 history", () => {
    const s = scenario();
    const revisedV1 = { ...s.v1, status: "revised" };
    assert.throws(() => validateG0A3Memory(s.v1, durable(s, revisedV1)), DomainInvariantError);
  });
  await t.test("v2 revised", () => { const s = scenario(); rejectsV2(s, { ...s.v2, status: "revised" }, planned(s)); });
  await t.test("planned v2 already durable", () => { const s = scenario(); rejectsV2(s, s.v2, planned(s, { memoryHistory: [s.v1, s.v2] })); });
});

test("G0-A3 revised Memory rejects non-canonical v2 structure", async (t) => {
  await t.test("wrong eventIds", () => { const s = scenario(); rejectsV2(s, { ...s.v2, eventIds: [s.intention.id, s.correction.id, s.failure.id] }, planned(s)); });
  await t.test("wrong evidenceItemIds", () => { const s = scenario(); rejectsV2(s, { ...s.v2, evidenceItemIds: [s.e1.id, s.e2.id, s.e4.id, "EV-FORGED"] }, planned(s)); });
  await t.test("E4 E5 inverted", () => { const s = scenario(); rejectsV2(s, { ...s.v2, evidenceItemIds: [s.e1.id, s.e2.id, s.e5.id, s.e4.id] }, planned(s)); });
  await t.test("wrong gist", () => { const s = scenario(); rejectsV2(s, { ...s.v2, gist: "approximate gist" }, planned(s)); });
  await t.test("wrong createdAt", () => { const s = scenario(); rejectsV2(s, { ...s.v2, createdAt: s.initialExplanation.occurredAt }, planned(s)); });
  await t.test("lastRecalledAt", () => { const s = scenario(); rejectsV2(s, { ...s.v2, lastRecalledAt: "2026-08-14T10:00:00.000Z" }, planned(s)); });
  await t.test("salience", () => { const s = scenario(); rejectsV2(s, { ...s.v2, salience: "medium" }, planned(s)); });
  await t.test("confidence", () => { const s = scenario(); rejectsV2(s, { ...s.v2, confidence: "moderate_high" }, planned(s)); });
});

test("G0-A3 revised Memory requires the canonical correction and E4 E5", async (t) => {
  await t.test("E4 absent", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.delete(s.e4.id); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
  await t.test("E5 absent", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.delete(s.e5.id); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
  await t.test("correction absent", () => { const s = scenario(); const eventsById = new Map(s.eventsById); eventsById.delete(s.correction.id); rejectsV2(s, s.v2, planned(s, { eventsById })); });
  await t.test("correction source", () => { const s = scenario(); const eventsById = new Map(s.eventsById); eventsById.set(s.correction.id, { ...s.correction, sourceId: "SRC-FORGED" }); rejectsV2(s, s.v2, planned(s, { eventsById })); });
  await t.test("correction actorRef", () => { const s = scenario(); const eventsById = new Map(s.eventsById); eventsById.set(s.correction.id, { ...s.correction, actorRef: "OP-FORGED" }); rejectsV2(s, s.v2, planned(s, { eventsById })); });
  await t.test("correction text", () => { const s = scenario(); const eventsById = new Map(s.eventsById); eventsById.set(s.correction.id, { ...s.correction, payload: { ...s.correction.payload, text: "Correction différente." } }); rejectsV2(s, s.v2, planned(s, { eventsById })); });
  await t.test("correction before initial explanation", () => { const s = scenario(); const eventsById = new Map(s.eventsById); eventsById.set(s.correction.id, { ...s.correction, sequence: s.initialExplanation.sequence }); rejectsV2(s, s.v2, planned(s, { eventsById })); });
  await t.test("E4 proposition", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.set(s.e4.id, { ...s.e4, proposition: { ...s.e4.proposition, value: "incompatible" } }); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
  await t.test("E4 supportingExcerpt", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.set(s.e4.id, { ...s.e4, grounding: { ...s.e4.grounding, supportingExcerpt: "forged" } }); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
  await t.test("E5 cause", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.set(s.e5.id, { ...s.e5, proposition: { ...s.e5.proposition, value: "configuration_a_sensor_incompatibility" } }); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
  await t.test("E5 supportingExcerpt", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.set(s.e5.id, { ...s.e5, grounding: { ...s.e5.grounding, supportingExcerpt: "forged" } }); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
  await t.test("E5 supersedes null", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.set(s.e5.id, { ...s.e5, supersedesId: null }); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
  await t.test("E5 supersedes another EvidenceItem", () => { const s = scenario(); const evidenceItemsById = new Map(s.evidenceItemsById); evidenceItemsById.set(s.e5.id, { ...s.e5, supersedesId: s.e2.id }); rejectsV2(s, s.v2, planned(s, { evidenceItemsById })); });
});
