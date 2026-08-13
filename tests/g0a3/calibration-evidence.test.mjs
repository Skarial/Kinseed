import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import {
  buildG0A3CalibrationFixtureEventId,
  buildG0A3CalibrationFixtureEventIdempotencyKey,
  buildG0A3CalibrationFailureTestimony,
  buildG0A3CalibrationObservation,
  buildG0A3ConfigurationCompatibilityTestimony,
  buildG0A3CorrectedFailureCauseTestimony,
  buildG0A3InitialFailureCauseTestimony,
  correctionCommitIdempotencyKey,
  initialCommitIdempotencyKey,
  materializeG0A3CorrectionEvidence,
  materializeG0A3InitialCalibrationEvidence,
} from "../../dist/application/materialize-g0a3-calibration-evidence.js";
import { validateEvidenceItem } from "../../dist/application/validate-evidence.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";
import { buildG0A3MemoryKey } from "../../dist/domain/memory.js";

const lenoseedId = "K-G0A3-CALIBRATION";
const systemSourceId = "SRC-G0A3-SYSTEM";
const operatorSourceId = "SRC-G0A3-OPERATOR";
const operatorActorRef = "OP-G0A3-001";
const episodeKey = "EP-G0A3-CALIBRATION-01";
const createdAt = "2026-08-14T09:00:00.000Z";
const configurationRequestText = "Utilise la configuration A pour le test de calibration.";
const failureText = "La calibration a échoué.";
const initialExplanationText =
  "D’après le contrôle initial, la configuration A est incompatible avec ce capteur.";
const correctionText =
  "Correction : la configuration A était compatible. L’échec venait du câble C, qui était débranché.";

async function createStore() {
  const store = new InMemoryStore();
  await store.registerSource({
    id: systemSourceId,
    kind: "system",
    actorRef: null,
    channel: "test",
    createdAt,
  });
  await store.registerSource({
    id: operatorSourceId,
    kind: "human",
    actorRef: operatorActorRef,
    channel: "test",
    createdAt,
  });
  await store.appendEvent(event({
    id: "E-G0A3-CREATED",
    sequence: 1,
    type: "lenoseed_created",
    sourceId: systemSourceId,
    payload: { generation: 0 },
    payloadSchemaVersion: 1,
  }));
  return store;
}

function event(overrides) {
  return {
    id: overrides.id,
    lenoseedId: overrides.lenoseedId ?? lenoseedId,
    sequence: overrides.sequence,
    type: overrides.type,
    occurredAt: overrides.occurredAt ?? `2026-08-14T09:00:0${overrides.sequence}.000Z`,
    turnId: null,
    sourceId: overrides.sourceId,
    actorRef: overrides.actorRef ?? null,
    causedByEventIds: overrides.causedByEventIds ?? [],
    observedStateVersion: 0,
    payload: overrides.payload,
    payloadSchemaVersion: overrides.payloadSchemaVersion,
    engineVersion: "g0a3-calibration-evidence-test",
    idempotencyKey: overrides.idempotencyKey ?? overrides.id,
  };
}

function fixtureIdentity(suffix) {
  return {
    id: buildG0A3CalibrationFixtureEventId(lenoseedId, suffix),
    idempotencyKey: buildG0A3CalibrationFixtureEventIdempotencyKey(lenoseedId, suffix),
  };
}

function requestEvent(overrides = {}) {
  return event({
    ...fixtureIdentity("calibration-01-request"),
    ...overrides,
    sequence: overrides.sequence ?? 2,
    type: "human_message_received",
    sourceId: overrides.sourceId ?? operatorSourceId,
    actorRef: operatorActorRef,
    payload: overrides.payload ?? {
      text: configurationRequestText,
      protocol: "G0-A3",
      episodeKey,
      fixtureKind: "configuration_request",
    },
    payloadSchemaVersion: overrides.payloadSchemaVersion ?? 3,
  });
}

function intentionEvent(request, overrides = {}) {
  return event({
    ...fixtureIdentity("calibration-01-intention"),
    ...overrides,
    sequence: overrides.sequence ?? 3,
    type: overrides.type ?? "intention_selected",
    sourceId: overrides.sourceId ?? systemSourceId,
    payload: overrides.payload ?? {
      intentionId: `I-G0A3-${lenoseedId}-CALIBRATION-01`,
      protocol: "G0-A3",
      episodeKey,
      kind: "run_calibration_with_configuration_a",
      motivation: "execute_requested_calibration_configuration",
      triggerEventIds: [request.id],
      triggerMemoryIds: [],
    },
    payloadSchemaVersion: overrides.payloadSchemaVersion ?? 3,
    causedByEventIds: overrides.causedByEventIds ?? [request.id],
  });
}

function failureEvent(overrides = {}) {
  return event({
    ...fixtureIdentity("calibration-01-failure"),
    ...overrides,
    sequence: overrides.sequence ?? 4,
    type: "human_message_received",
    sourceId: overrides.sourceId ?? operatorSourceId,
    actorRef: operatorActorRef,
    payload: overrides.payload ?? {
      text: failureText,
      protocol: "G0-A3",
      episodeKey,
      fixtureKind: "calibration_failure_report",
    },
    payloadSchemaVersion: overrides.payloadSchemaVersion ?? 3,
  });
}

function initialExplanationEvent(overrides = {}) {
  return event({
    ...fixtureIdentity("calibration-01-initial-explanation"),
    ...overrides,
    sequence: overrides.sequence ?? 5,
    type: "human_message_received",
    sourceId: overrides.sourceId ?? operatorSourceId,
    actorRef: operatorActorRef,
    payload: overrides.payload ?? {
      text: initialExplanationText,
      protocol: "G0-A3",
      episodeKey,
      fixtureKind: "initial_failure_explanation",
    },
    payloadSchemaVersion: overrides.payloadSchemaVersion ?? 3,
  });
}

function correctionEvent(overrides = {}) {
  return event({
    ...fixtureIdentity("calibration-01-correction"),
    ...overrides,
    sequence: overrides.sequence ?? 6,
    type: "human_message_received",
    sourceId: overrides.sourceId ?? operatorSourceId,
    actorRef: operatorActorRef,
    payload: overrides.payload ?? {
      text: correctionText,
      protocol: "G0-A3",
      episodeKey,
      fixtureKind: "failure_explanation_correction",
    },
    payloadSchemaVersion: overrides.payloadSchemaVersion ?? 3,
  });
}

async function appendInitialHistory(store, overrides = {}) {
  const request = requestEvent(overrides.request);
  const intention = intentionEvent(request, overrides.intention);
  const failure = failureEvent(overrides.failure);
  const initialExplanation = initialExplanationEvent(overrides.initialExplanation);
  for (const item of [request, intention, failure, initialExplanation]) await store.appendEvent(item);
  return { request, intention, failure, initialExplanation };
}

function initialInput(history) {
  return {
    lenoseedId,
    configurationRequestEventId: history.request.id,
    intentionEventId: history.intention.id,
    failureEventId: history.failure.id,
    initialExplanationEventId: history.initialExplanation.id,
  };
}

function correctionInput(history, correction) {
  return {
    lenoseedId,
    initialExplanationEventId: history.initialExplanation.id,
    correctionEventId: correction.id,
  };
}

test("G0-A3 E1 builder and grounding are exact", async () => {
  const store = await createStore();
  const history = await appendInitialHistory(store);
  assert.equal(
    history.intention.id,
    `E-G0A3-${lenoseedId}-calibration-01-intention`,
  );
  assert.equal(
    history.intention.idempotencyKey,
    `g0a3:${lenoseedId}:${episodeKey}:fixture:calibration-01-intention`,
  );
  const actual = buildG0A3CalibrationObservation(history.intention);
  assert.deepEqual(actual, {
    id: `EV-G0A3-OBS-${history.intention.id}`,
    lenoseedId,
    kind: "behavioral_observation",
    proposition: {
      subjectRef: lenoseedId,
      predicate: "selected_calibration_configuration",
      value: "A",
      context: { protocol: "G0-A3", episodeKey },
    },
    sourceId: systemSourceId,
    eventIds: [history.intention.id],
    grounding: { kind: "structured_event", eventId: history.intention.id },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "lenoseed-g0a3-behavioral-observation-v1",
    createdAt: history.intention.occurredAt,
  });
  assert.equal(await validateEvidenceItem(actual, store), null);
});

test("G0-A2 behavioral grounding remains strictly unchanged", async (t) => {
  const store = await createStore();
  const source = event({
    id: "E-G0A2-intention",
    sequence: 2,
    type: "intention_selected",
    sourceId: systemSourceId,
    payload: {
      intentionId: "I-G0A2",
      kind: "ask_clarification",
      motivation: "controlled_historical_fixture",
      situationId: "S1",
      triggerSelfHypothesisIds: [],
    },
    payloadSchemaVersion: 2,
  });
  await store.appendEvent(source);
  const observation = {
    id: "EV-G0A2-observation",
    lenoseedId,
    kind: "behavioral_observation",
    proposition: {
      subjectRef: lenoseedId,
      predicate: "selected_decision_style_under_uncertainty",
      value: "seek_clarification",
      context: { protocol: "G0-A2", situationId: "S1" },
    },
    sourceId: systemSourceId,
    eventIds: [source.id],
    grounding: { kind: "structured_event", eventId: source.id },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "lenoseed-g0a2-behavioral-observation-v1",
    createdAt: source.occurredAt,
  };
  await t.test("schema v2 remains accepted", async () => {
    assert.equal(await validateEvidenceItem(observation, store), null);
  });
  await t.test("invalid G0-A2 kind remains rejected", async () => {
    const invalid = { ...observation, proposition: { ...observation.proposition, value: "use_available_information" } };
    await assert.rejects(() => validateEvidenceItem(invalid, store), DomainInvariantError);
  });
});

test("G0-A3 behavioral grounding rejects malformed E1 sources and propositions", async (t) => {
  const cases = [
    ["wrong protocol", { payload: { protocol: "G0-A2" } }],
    ["wrong schema", { payloadSchemaVersion: 2 }],
    ["wrong intention kind", { payload: { kind: "use_configuration_b" } }],
    ["wrong motivation", { payload: { motivation: "other" } }],
    ["triggerMemoryIds is not empty", { payload: { triggerMemoryIds: ["MEM-1"] } }],
    ["wrong episodeKey", { payload: { episodeKey: "EP-OTHER" } }],
  ];
  for (const [name, overrides] of cases) {
    await t.test(name, async () => {
      const store = await createStore();
      const request = requestEvent();
      const base = intentionEvent(request);
      const payload = { ...base.payload, ...(overrides.payload ?? {}) };
      const source = { ...base, ...overrides, payload };
      await store.appendEvent(request);
      await store.appendEvent(source);
      await assert.rejects(
        () => validateEvidenceItem(buildG0A3CalibrationObservation(source), store),
        DomainInvariantError,
      );
    });
  }
  await t.test("wrong E1 proposition", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store);
    const invalid = {
      ...buildG0A3CalibrationObservation(history.intention),
      proposition: {
        subjectRef: lenoseedId,
        predicate: "selected_calibration_configuration",
        value: "B",
        context: { protocol: "G0-A3", episodeKey },
      },
    };
    await assert.rejects(() => validateEvidenceItem(invalid, store), DomainInvariantError);
  });
});

test("G0-A3 E2 and E3 builders preserve exact testimony provenance", async () => {
  const store = await createStore();
  const history = await appendInitialHistory(store);
  const e2 = buildG0A3CalibrationFailureTestimony(history.failure);
  const e3 = buildG0A3InitialFailureCauseTestimony(history.initialExplanation);
  assert.deepEqual(e2, {
    id: `EV-G0A3-TESTIMONY-${history.failure.id}-outcome`,
    lenoseedId,
    kind: "testimony",
    proposition: {
      subjectRef: operatorActorRef,
      predicate: "reported_calibration_outcome",
      value: "failure",
      context: { protocol: "G0-A3", episodeKey },
    },
    sourceId: operatorSourceId,
    eventIds: [history.failure.id],
    grounding: { kind: "text_excerpt", eventId: history.failure.id, supportingExcerpt: failureText },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "lenoseed-g0a3-testimony-v1",
    createdAt: history.failure.occurredAt,
  });
  assert.deepEqual(e3, {
    id: `EV-G0A3-TESTIMONY-${history.initialExplanation.id}-cause`,
    lenoseedId,
    kind: "testimony",
    proposition: {
      subjectRef: operatorActorRef,
      predicate: "attributed_calibration_failure_cause",
      value: "configuration_a_sensor_incompatibility",
      context: { protocol: "G0-A3", episodeKey },
    },
    sourceId: operatorSourceId,
    eventIds: [history.initialExplanation.id],
    grounding: {
      kind: "text_excerpt",
      eventId: history.initialExplanation.id,
      supportingExcerpt: initialExplanationText,
    },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "lenoseed-g0a3-testimony-v1",
    createdAt: history.initialExplanation.occurredAt,
  });
  assert.equal(await validateEvidenceItem(e2, store), null);
  assert.equal(await validateEvidenceItem(e3, store), null);
});

test("G0-A3 initial evidence rejects invalid human testimony fixtures", async (t) => {
  await t.test("wrong E2 text", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store, {
      failure: { payload: { text: "La calibration a réussi.", protocol: "G0-A3", episodeKey, fixtureKind: "calibration_failure_report" } },
    });
    await assert.rejects(() => materializeG0A3InitialCalibrationEvidence(initialInput(history), store), DomainInvariantError);
  });
  await t.test("falsified E2 supporting excerpt", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store);
    const e2 = buildG0A3CalibrationFailureTestimony(history.failure);
    const invalid = { ...e2, grounding: { ...e2.grounding, supportingExcerpt: "inexistant" } };
    assert.equal(await validateEvidenceItem(invalid, store), "supporting_excerpt_not_in_event_text");
  });
  await t.test("wrong E3 text", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store, {
      initialExplanation: { payload: { text: "Cause différente.", protocol: "G0-A3", episodeKey, fixtureKind: "initial_failure_explanation" } },
    });
    await assert.rejects(() => materializeG0A3InitialCalibrationEvidence(initialInput(history), store), DomainInvariantError);
  });
  await t.test("non-human source for E2 and E3", async () => {
    for (const fixture of ["failure", "initialExplanation"]) {
      const store = await createStore();
      const history = await appendInitialHistory(store, { [fixture]: { sourceId: systemSourceId } });
      await assert.rejects(() => materializeG0A3InitialCalibrationEvidence(initialInput(history), store), DomainInvariantError);
    }
  });
});

test("G0-A3 initial materialization rejects non-canonical fixture identities", async (t) => {
  const cases = [
    ["request id", "request", { id: "E-FORGED-request" }],
    ["request idempotencyKey", "request", { idempotencyKey: "g0a3:forged:request" }],
    ["intention id", "intention", { id: "E-FORGED-intention" }],
    ["intention idempotencyKey", "intention", { idempotencyKey: "g0a3:forged:intention" }],
    ["failure id", "failure", { id: "E-FORGED-failure" }],
    ["failure idempotencyKey", "failure", { idempotencyKey: "g0a3:forged:failure" }],
    ["initial explanation id", "initialExplanation", { id: "E-FORGED-initial-explanation" }],
    ["initial explanation idempotencyKey", "initialExplanation", { idempotencyKey: "g0a3:forged:initial-explanation" }],
  ];
  for (const [name, fixture, override] of cases) {
    await t.test(name, async () => {
      const store = await createStore();
      const history = await appendInitialHistory(store, { [fixture]: override });
      await assert.rejects(
        () => materializeG0A3InitialCalibrationEvidence(initialInput(history), store),
        DomainInvariantError,
      );
      assert.equal(await store.getStateVersion(lenoseedId), 0);
      for (const evidence of [
        buildG0A3CalibrationObservation(history.intention),
        buildG0A3CalibrationFailureTestimony(history.failure),
        buildG0A3InitialFailureCauseTestimony(history.initialExplanation),
      ]) assert.equal(await store.readEvidenceItem(lenoseedId, evidence.id), null);
    });
  }
});

test("G0-A3 initial materialization commits exactly E1, E2 and E3 atomically", async () => {
  const store = await createStore();
  const history = await appendInitialHistory(store);
  const result = await materializeG0A3InitialCalibrationEvidence(initialInput(history), store);
  const e1 = buildG0A3CalibrationObservation(history.intention);
  const e2 = buildG0A3CalibrationFailureTestimony(history.failure);
  const e3 = buildG0A3InitialFailureCauseTestimony(history.initialExplanation);
  assert.equal(e1.id, `EV-G0A3-OBS-E-G0A3-${lenoseedId}-calibration-01-intention`);
  assert.equal(e2.id, `EV-G0A3-TESTIMONY-E-G0A3-${lenoseedId}-calibration-01-failure-outcome`);
  assert.equal(
    e3.id,
    `EV-G0A3-TESTIMONY-E-G0A3-${lenoseedId}-calibration-01-initial-explanation-cause`,
  );
  assert.deepEqual(result, {
    evidenceItemIds: [e1.id, e2.id, e3.id],
    previousStateVersion: 0,
    newStateVersion: 1,
    changed: true,
    replayed: false,
  });
  assert.deepEqual(await store.readEvidenceItem(lenoseedId, e1.id), e1);
  assert.deepEqual(await store.readEvidenceItem(lenoseedId, e2.id), e2);
  assert.deepEqual(await store.readEvidenceItem(lenoseedId, e3.id), e3);
  assert.deepEqual(
    await store.readMemoryHistoryByKey(lenoseedId, buildG0A3MemoryKey(lenoseedId, episodeKey)),
    [],
  );
  assert.equal(await store.getStateVersion(lenoseedId), 1);
  assert.equal(
    initialCommitIdempotencyKey(lenoseedId),
    `g0a3:${lenoseedId}:${episodeKey}:evidence:initial:commit`,
  );
});

test("G0-A3 initial materialization replays without another state increment", async () => {
  const store = await createStore();
  const history = await appendInitialHistory(store);
  const input = initialInput(history);
  const first = await materializeG0A3InitialCalibrationEvidence(input, store);
  const replay = await materializeG0A3InitialCalibrationEvidence(input, store);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.evidenceItemIds, first.evidenceItemIds);
  assert.equal(await store.getStateVersion(lenoseedId), 1);
});

test("G0-A3 correction requires E3 and a later canonical correction", async (t) => {
  await t.test("before E3", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store);
    const correction = correctionEvent();
    await store.appendEvent(correction);
    await assert.rejects(() => materializeG0A3CorrectionEvidence(correctionInput(history, correction), store), DomainInvariantError);
  });
  await t.test("wrong correction event", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store);
    await materializeG0A3InitialCalibrationEvidence(initialInput(history), store);
    const correction = correctionEvent({ payload: { text: "Correction différente.", protocol: "G0-A3", episodeKey, fixtureKind: "failure_explanation_correction" } });
    await store.appendEvent(correction);
    await assert.rejects(() => materializeG0A3CorrectionEvidence(correctionInput(history, correction), store), DomainInvariantError);
  });
  await t.test("correction not after initial explanation", async () => {
    const store = await createStore();
    const request = requestEvent();
    const intention = intentionEvent(request);
    const failure = failureEvent();
    const correction = correctionEvent({ sequence: 5 });
    const initialExplanation = initialExplanationEvent({ sequence: 6 });
    for (const item of [request, intention, failure, correction, initialExplanation]) await store.appendEvent(item);
    const history = { request, intention, failure, initialExplanation };
    await materializeG0A3InitialCalibrationEvidence(initialInput(history), store);
    await assert.rejects(() => materializeG0A3CorrectionEvidence(correctionInput(history, correction), store), DomainInvariantError);
  });
});

test("G0-A3 correction materialization commits exact E4 and E5 without mutating E3", async () => {
  const store = await createStore();
  const history = await appendInitialHistory(store);
  await materializeG0A3InitialCalibrationEvidence(initialInput(history), store);
  const e3 = buildG0A3InitialFailureCauseTestimony(history.initialExplanation);
  const correction = correctionEvent();
  await store.appendEvent(correction);
  const result = await materializeG0A3CorrectionEvidence(correctionInput(history, correction), store);
  const e4 = buildG0A3ConfigurationCompatibilityTestimony(correction);
  const e5 = buildG0A3CorrectedFailureCauseTestimony(correction, e3.id);
  assert.equal(
    e4.id,
    `EV-G0A3-TESTIMONY-E-G0A3-${lenoseedId}-calibration-01-correction-compatibility`,
  );
  assert.equal(
    e5.id,
    `EV-G0A3-TESTIMONY-E-G0A3-${lenoseedId}-calibration-01-correction-cause`,
  );
  assert.deepEqual(result, {
    evidenceItemIds: [e4.id, e5.id],
    previousStateVersion: 1,
    newStateVersion: 2,
    changed: true,
    replayed: false,
  });
  assert.deepEqual(e4.proposition, {
    subjectRef: operatorActorRef,
    predicate: "reported_configuration_compatibility",
    value: "compatible",
    context: { protocol: "G0-A3", episodeKey, configuration: "A" },
  });
  assert.deepEqual(e5.proposition, {
    subjectRef: operatorActorRef,
    predicate: "attributed_calibration_failure_cause",
    value: "cable_c_disconnected",
    context: { protocol: "G0-A3", episodeKey },
  });
  assert.equal(e4.id, `EV-G0A3-TESTIMONY-${correction.id}-compatibility`);
  assert.deepEqual(e4.grounding, {
    kind: "text_excerpt",
    eventId: correction.id,
    supportingExcerpt: "la configuration A était compatible",
  });
  assert.equal(e4.extractorVersion, "lenoseed-g0a3-testimony-v1");
  assert.equal(e4.createdAt, correction.occurredAt);
  assert.equal(e5.id, `EV-G0A3-TESTIMONY-${correction.id}-cause`);
  assert.deepEqual(e5.grounding, {
    kind: "text_excerpt",
    eventId: correction.id,
    supportingExcerpt: "L’échec venait du câble C, qui était débranché.",
  });
  assert.equal(e5.extractorVersion, "lenoseed-g0a3-testimony-v1");
  assert.equal(e5.createdAt, correction.occurredAt);
  assert.equal(e5.supersedesId, e3.id);
  assert.deepEqual(await store.readEvidenceItem(lenoseedId, e4.id), e4);
  assert.deepEqual(await store.readEvidenceItem(lenoseedId, e5.id), e5);
  assert.deepEqual(await store.readEvidenceItem(lenoseedId, e3.id), e3);
  assert.deepEqual(
    await store.readMemoryHistoryByKey(lenoseedId, buildG0A3MemoryKey(lenoseedId, episodeKey)),
    [],
  );
  assert.equal(
    correctionCommitIdempotencyKey(lenoseedId),
    `g0a3:${lenoseedId}:${episodeKey}:evidence:correction:commit`,
  );
});

test("G0-A3 correction materialization rejects a non-canonical correction identity", async (t) => {
  for (const [name, override] of [
    ["id", { id: "E-FORGED-correction" }],
    ["idempotencyKey", { idempotencyKey: "g0a3:forged:correction" }],
  ]) {
    await t.test(name, async () => {
      const store = await createStore();
      const history = await appendInitialHistory(store);
      await materializeG0A3InitialCalibrationEvidence(initialInput(history), store);
      const correction = correctionEvent(override);
      await store.appendEvent(correction);
      await assert.rejects(
        () => materializeG0A3CorrectionEvidence(correctionInput(history, correction), store),
        DomainInvariantError,
      );
      assert.equal(await store.getStateVersion(lenoseedId), 1);
      assert.equal(
        await store.readEvidenceItem(lenoseedId, `EV-G0A3-TESTIMONY-${correction.id}-compatibility`),
        null,
      );
      assert.equal(
        await store.readEvidenceItem(lenoseedId, `EV-G0A3-TESTIMONY-${correction.id}-cause`),
        null,
      );
    });
  }
});

test("G0-A3 correction materialization replays without another state increment", async () => {
  const store = await createStore();
  const history = await appendInitialHistory(store);
  await materializeG0A3InitialCalibrationEvidence(initialInput(history), store);
  const correction = correctionEvent();
  await store.appendEvent(correction);
  const input = correctionInput(history, correction);
  await materializeG0A3CorrectionEvidence(input, store);
  const replay = await materializeG0A3CorrectionEvidence(input, store);
  assert.equal(replay.replayed, true);
  assert.equal(await store.getStateVersion(lenoseedId), 2);
});

test("G0-A3 evidence materialization failure injection remains atomic", async (t) => {
  await t.test("initial E1/E2/E3", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store);
    store.failNextAtomicCommitForTests(new Error("initial evidence failure"));
    await assert.rejects(
      () => materializeG0A3InitialCalibrationEvidence(initialInput(history), store),
      /initial evidence failure/,
    );
    assert.equal(await store.getStateVersion(lenoseedId), 0);
    for (const evidence of [
      buildG0A3CalibrationObservation(history.intention),
      buildG0A3CalibrationFailureTestimony(history.failure),
      buildG0A3InitialFailureCauseTestimony(history.initialExplanation),
    ]) assert.equal(await store.readEvidenceItem(lenoseedId, evidence.id), null);
  });
  await t.test("correction E4/E5", async () => {
    const store = await createStore();
    const history = await appendInitialHistory(store);
    await materializeG0A3InitialCalibrationEvidence(initialInput(history), store);
    const correction = correctionEvent();
    await store.appendEvent(correction);
    store.failNextAtomicCommitForTests(new Error("correction evidence failure"));
    await assert.rejects(
      () => materializeG0A3CorrectionEvidence(correctionInput(history, correction), store),
      /correction evidence failure/,
    );
    assert.equal(await store.getStateVersion(lenoseedId), 1);
    assert.equal(await store.readEvidenceItem(lenoseedId, `EV-G0A3-TESTIMONY-${correction.id}-compatibility`), null);
    assert.equal(await store.readEvidenceItem(lenoseedId, `EV-G0A3-TESTIMONY-${correction.id}-cause`), null);
  });
});
