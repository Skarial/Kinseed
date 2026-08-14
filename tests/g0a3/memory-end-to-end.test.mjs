import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { consolidateG0A3Memory } from "../../dist/application/consolidate-g0a3-memory.js";
import { reviseG0A3Memory } from "../../dist/application/revise-g0a3-memory.js";
import { selectG0A3MemoryIntention } from "../../dist/application/select-g0a3-memory-intention.js";
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
import { initialIds, revisedIds } from "../../dist/application/validate-g0a3-memory.js";
import { buildG0A3MemoryKey } from "../../dist/domain/memory.js";

const lenoseedId = "K-G0A3-END-TO-END";
const episodeKey = G0A3_CALIBRATION_EPISODE_KEY;
const createdAt = "2026-08-14T12:00:00.000Z";
const engineVersion = "lenoseed-g0a3-end-to-end-v1";

function event(overrides) {
  return {
    id: overrides.id,
    lenoseedId,
    sequence: overrides.sequence,
    type: overrides.type,
    occurredAt: overrides.occurredAt,
    turnId: overrides.turnId ?? null,
    sourceId: overrides.sourceId,
    actorRef: overrides.actorRef ?? null,
    causedByEventIds: overrides.causedByEventIds ?? [],
    observedStateVersion: overrides.observedStateVersion ?? 0,
    payload: overrides.payload,
    payloadSchemaVersion: overrides.payloadSchemaVersion,
    engineVersion,
    idempotencyKey: overrides.idempotencyKey ?? overrides.id,
  };
}

function fixtureIdentity(suffix) {
  return {
    id: buildG0A3CalibrationFixtureEventId(lenoseedId, suffix),
    idempotencyKey: buildG0A3CalibrationFixtureEventIdempotencyKey(lenoseedId, suffix),
  };
}

function humanFixture(suffix, sequence, occurredAt, fixtureKind, text) {
  return event({
    ...fixtureIdentity(suffix),
    sequence,
    occurredAt,
    type: "human_message_received",
    sourceId: G0A3_OPERATOR_SOURCE_ID,
    actorRef: G0A3_OPERATOR_ACTOR_REF,
    payload: { text, protocol: "G0-A3", episodeKey, fixtureKind },
    payloadSchemaVersion: 3,
  });
}

async function nextSequence(store) {
  return ((await store.readEventsInSequence(lenoseedId)).at(-1)?.sequence ?? 0) + 1;
}

function consolidationInput(expectedStateVersion) {
  const ids = initialIds(lenoseedId);
  return {
    lenoseedId,
    episodeKey,
    systemSourceId: G0A3_SYSTEM_SOURCE_ID,
    evidenceItemIds: [ids.e1Id, ids.e2Id, ids.e3Id],
    expectedStateVersion,
    engineVersion,
  };
}

function revisionInput(expectedStateVersion) {
  const ids = revisedIds(lenoseedId);
  return {
    lenoseedId,
    episodeKey,
    systemSourceId: G0A3_SYSTEM_SOURCE_ID,
    evidenceItemIds: [ids.e1Id, ids.e2Id, ids.e4Id, ids.e5Id],
    expectedStateVersion,
    engineVersion,
  };
}

function decisionInput(turnId, occurredAt) {
  return {
    lenoseedId,
    turnId,
    humanSourceId: G0A3_OPERATOR_SOURCE_ID,
    humanActorRef: G0A3_OPERATOR_ACTOR_REF,
    systemSourceId: G0A3_SYSTEM_SOURCE_ID,
    occurredAt,
    engineVersion,
    includeMemory: true,
  };
}

test("G0-A3 end-to-end keeps causal Memory influence across correction and revision", async () => {
  const store = new InMemoryStore();
  await store.registerSource({
    id: G0A3_SYSTEM_SOURCE_ID,
    kind: "system",
    actorRef: null,
    channel: "test",
    createdAt,
  });
  await store.registerSource({
    id: G0A3_OPERATOR_SOURCE_ID,
    kind: "human",
    actorRef: G0A3_OPERATOR_ACTOR_REF,
    channel: "test",
    createdAt,
  });

  await store.appendEvent(event({
    id: `E-${lenoseedId}-created`,
    sequence: 1,
    occurredAt: "2026-08-14T12:00:01.000Z",
    type: "lenoseed_created",
    sourceId: G0A3_SYSTEM_SOURCE_ID,
    payload: { generation: 0 },
    payloadSchemaVersion: 1,
  }));

  const request = humanFixture(
    "calibration-01-request",
    2,
    "2026-08-14T12:00:02.000Z",
    "configuration_request",
    G0A3_CONFIGURATION_REQUEST_TEXT,
  );
  const historicalIntention = event({
    ...fixtureIdentity("calibration-01-intention"),
    sequence: 3,
    occurredAt: "2026-08-14T12:00:03.000Z",
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
    payloadSchemaVersion: 3,
  });
  const failure = humanFixture(
    "calibration-01-failure",
    4,
    "2026-08-14T12:00:04.000Z",
    "calibration_failure_report",
    G0A3_CALIBRATION_FAILURE_TEXT,
  );
  const explanation = humanFixture(
    "calibration-01-initial-explanation",
    5,
    "2026-08-14T12:00:05.000Z",
    "initial_failure_explanation",
    G0A3_INITIAL_EXPLANATION_TEXT,
  );
  for (const item of [request, historicalIntention, failure, explanation]) {
    await store.appendEvent(item);
  }

  await materializeG0A3InitialCalibrationEvidence(
    {
      lenoseedId,
      configurationRequestEventId: request.id,
      intentionEventId: historicalIntention.id,
      failureEventId: failure.id,
      initialExplanationEventId: explanation.id,
    },
    store,
  );

  const v1 = (await consolidateG0A3Memory(
    consolidationInput(await store.getStateVersion(lenoseedId)),
    store,
  )).memory;

  const stateBeforeFirstDecision = await store.getStateVersion(lenoseedId);
  const firstDecisionInput = decisionInput(
    "T-G0A3-END-TO-END-BEFORE-CORRECTION",
    "2026-08-14T12:01:00.000Z",
  );
  const firstDecision = await selectG0A3MemoryIntention(firstDecisionInput, store);
  assert.equal(firstDecision.intention.kind, "use_configuration_b");
  assert.deepEqual(firstDecision.intention.triggerMemoryIds, [v1.id]);
  assert.equal(await store.getStateVersion(lenoseedId), stateBeforeFirstDecision);

  const correction = humanFixture(
    "calibration-01-correction",
    await nextSequence(store),
    "2026-08-14T12:02:00.000Z",
    "failure_explanation_correction",
    G0A3_CORRECTION_TEXT,
  );
  await store.appendEvent(correction);
  await materializeG0A3CorrectionEvidence(
    {
      lenoseedId,
      initialExplanationEventId: explanation.id,
      correctionEventId: correction.id,
    },
    store,
  );

  const v2 = (await reviseG0A3Memory(
    revisionInput(await store.getStateVersion(lenoseedId)),
    store,
  )).memory;

  const history = await store.readMemoryHistoryByKey(
    lenoseedId,
    buildG0A3MemoryKey(lenoseedId, episodeKey),
  );
  assert.deepEqual(
    history.map((memory) => [memory.id, memory.status]),
    [[v1.id, "revised"], [v2.id, "active"]],
  );

  const stateBeforeSecondDecision = await store.getStateVersion(lenoseedId);
  const secondDecision = await selectG0A3MemoryIntention(
    decisionInput("T-G0A3-END-TO-END-AFTER-CORRECTION", "2026-08-14T12:03:00.000Z"),
    store,
  );
  assert.equal(secondDecision.intention.kind, "use_configuration_a_after_checking_cable_c");
  assert.deepEqual(secondDecision.intention.triggerMemoryIds, [v2.id]);
  assert.equal(await store.getStateVersion(lenoseedId), stateBeforeSecondDecision);

  const replay = await selectG0A3MemoryIntention(firstDecisionInput, store);
  assert.equal(replay.replayed, true);
  assert.equal(replay.intention.kind, "use_configuration_b");
  assert.deepEqual(replay.intention.triggerMemoryIds, [v1.id]);
  assert.deepEqual(replay.intentionEvent, firstDecision.intentionEvent);
});
