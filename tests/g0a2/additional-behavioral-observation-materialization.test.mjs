import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { consolidateInitialG0A2SelfHypothesis } from "../../dist/application/consolidate-g0a2-self-hypothesis.js";
import {
  materializeG0A2AdditionalBehavioralObservations,
} from "../../dist/application/materialize-g0a2-additional-behavioral-observations.js";
import {
  buildG0A2BehavioralObservationId,
  materializeG0A2BehavioralObservations,
} from "../../dist/application/materialize-g0a2-behavioral-observations.js";
import { selectG0A2S5Intention } from "../../dist/application/select-g0a2-s5-intention.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";

const SYSTEM_SOURCE_ID = "SRC-G0A2-POST-SYSTEM";
const HUMAN_SOURCE_ID = "SRC-G0A2-POST-HUMAN";
const ENGINE_VERSION = "g0a2-post-observation-test";
const ASK = "ask_clarification";
const USE = "respond_with_available_information_under_uncertainty";
const S5_TEXT = "Jâ€™ai deux options possibles mais il manque une information importante pour savoir laquelle est correcte. Que fais-tu ?";

async function setupInitialHypothesis(kinseedId, kinds, candidateValue, store = new InMemoryStore()) {
  const humanActorRef = "H-G0A2-POST";
  await store.registerSource({ id: SYSTEM_SOURCE_ID, kind: "system", actorRef: null, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.registerSource({ id: HUMAN_SOURCE_ID, kind: "human", actorRef: humanActorRef, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.appendEvent({ id: `E-${kinseedId}-created`, kinseedId, sequence: 1, type: "kinseed_created", occurredAt: "2026-08-13T10:00:00.000Z", turnId: null, sourceId: SYSTEM_SOURCE_ID, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1, engineVersion: ENGINE_VERSION, idempotencyKey: `${kinseedId}:created` });
  const initialEvents = [];
  for (const [index, kind] of kinds.entries()) {
    const situationId = `S${index + 1}`;
    const event = await appendIntention(store, kinseedId, { situationId, kind, id: `E-${kinseedId}-${situationId}`, intentionId: `I-${kinseedId}-${situationId}`, motivation: "controlled_initial_fixture" });
    initialEvents.push(event);
  }
  await materializeG0A2BehavioralObservations({ kinseedId, historyId: "initial-history", systemSourceId: SYSTEM_SOURCE_ID, intentionEventIds: initialEvents.map((event) => event.id), engineVersion: ENGINE_VERSION }, store);
  const consolidation = await consolidateInitialG0A2SelfHypothesis({ kinseedId, consolidationId: "initial", systemSourceId: SYSTEM_SOURCE_ID, candidateProposition: { subjectRef: kinseedId, predicate: "decision_style_under_uncertainty", value: candidateValue, context: { protocol: "G0-A2" } }, evidenceItemIds: initialEvents.map((event) => buildG0A2BehavioralObservationId(event.id)), engineVersion: ENGINE_VERSION }, store);
  const hypothesis = await store.readSelfHypothesis(kinseedId, consolidation.selfHypothesisId);
  const checkpoint = (await store.readEventsInSequence(kinseedId)).find((event) => event.type === "validation_decision_recorded" && event.payload.scope === "self_hypothesis_consolidation");
  assert.ok(hypothesis); assert.ok(checkpoint); assert.equal(await store.getStateVersion(kinseedId), 2);
  return { store, humanActorRef, hypothesis, checkpoint, initialEvents };
}

async function appendIntention(store, kinseedId, options) {
  const events = await store.readEventsInSequence(kinseedId);
  const sequence = options.sequence ?? (events.at(-1)?.sequence ?? 0) + 1;
  const event = {
    id: options.id ?? `E-${kinseedId}-${options.situationId}-${sequence}`,
    kinseedId: options.kinseedId ?? kinseedId,
    sequence,
    type: options.type ?? "intention_selected",
    occurredAt: options.occurredAt ?? `2026-08-13T10:10:${String(sequence).padStart(2, "0")}.000Z`,
    turnId: null,
    sourceId: options.sourceId ?? SYSTEM_SOURCE_ID,
    actorRef: null,
    causedByEventIds: [],
    observedStateVersion: await store.getStateVersion(kinseedId),
    payload: {
      ...(options.omitIntentionId ? {} : { intentionId: options.intentionId ?? `I-${kinseedId}-${options.situationId}-${sequence}` }),
      kind: options.kind ?? USE,
      ...(options.omitMotivation ? {} : { motivation: options.motivation ?? "controlled_g0a2_revision_fixture" }),
      situationId: options.situationId,
      triggerSelfHypothesisIds: options.triggers ?? [],
    },
    payloadSchemaVersion: options.schemaVersion ?? 2,
    engineVersion: ENGINE_VERSION,
    idempotencyKey: options.idempotencyKey ?? `fixture:${kinseedId}:${options.situationId}:${sequence}`,
  };
  await store.appendEvent(event);
  return event;
}

function additionalInput(kinseedId, materializationId, events) {
  return { kinseedId, materializationId, systemSourceId: SYSTEM_SOURCE_ID, intentionEventIds: events.map((event) => event.id), engineVersion: ENGINE_VERSION };
}

async function assertObservation(store, kinseedId, event, expectedValue) {
  const observation = await store.readEvidenceItem(kinseedId, buildG0A2BehavioralObservationId(event.id));
  assert.deepEqual(observation, {
    id: buildG0A2BehavioralObservationId(event.id), kinseedId, kind: "behavioral_observation",
    proposition: { subjectRef: kinseedId, predicate: "selected_decision_style_under_uncertainty", value: expectedValue, context: { protocol: "G0-A2", situationId: event.payload.situationId } },
    sourceId: SYSTEM_SOURCE_ID, eventIds: [event.id], grounding: { kind: "structured_event", eventId: event.id },
    extractionConfidence: "high", status: "active", supersedesId: null,
    extractorVersion: "kinseed-g0a2-behavioral-observation-v1", createdAt: event.occurredAt,
  });
}

test("G0-A2 materializes clean R1-R3 observations after the initial SelfHypothesis", async () => {
  const kinseedId = "K-G0A2-POST-R";
  const { store, hypothesis, checkpoint } = await setupInitialHypothesis(kinseedId, [ASK, ASK, ASK, USE], "seek_clarification");
  const r1 = await appendIntention(store, kinseedId, { situationId: "R1", kind: USE });
  const r2 = await appendIntention(store, kinseedId, { situationId: "R2", kind: USE });
  const r3 = await appendIntention(store, kinseedId, { situationId: "R3", kind: USE });
  assert.ok(r1.sequence > checkpoint.sequence && r2.sequence > checkpoint.sequence && r3.sequence > checkpoint.sequence);
  const result = await materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "revision-r", [r3, r1, r2]), store);
  assert.deepEqual(result, { evidenceItemIds: [r1, r2, r3].map((event) => buildG0A2BehavioralObservationId(event.id)), previousStateVersion: 2, newStateVersion: 3, changed: true, replayed: false });
  for (const event of [r1, r2, r3]) await assertObservation(store, kinseedId, event, "use_available_information");
  assert.equal(await store.getStateVersion(kinseedId), 3);
  assert.equal((await store.readSelfHypothesis(kinseedId, hypothesis.id))?.status, "active");
  const completion = (await store.readEventsInSequence(kinseedId)).find((event) => event.type === "state_commit_completed" && event.payload.materializationId === "revision-r");
  assert.deepEqual(completion?.causedByEventIds, [r1.id, r2.id, r3.id]);
});

test("G0-A2 additional materialization mirrors the controlled orientation", async () => {
  const kinseedId = "K-G0A2-POST-MIRROR";
  const { store } = await setupInitialHypothesis(kinseedId, [ASK, USE, USE, USE], "use_available_information");
  const r1 = await appendIntention(store, kinseedId, { situationId: "R1", kind: ASK });
  await materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "mirror-r1", [r1]), store);
  await assertObservation(store, kinseedId, r1, "seek_clarification");
});

test("G0-A2 additional materialization makes an influenced S5 observation available without contamination", async () => {
  const kinseedId = "K-G0A2-POST-S5";
  const { store, hypothesis, humanActorRef } = await setupInitialHypothesis(kinseedId, [ASK, ASK, ASK, USE], "seek_clarification");
  const selected = await selectG0A2S5Intention({ kinseedId, turnId: "TURN-POST-S5", humanSourceId: HUMAN_SOURCE_ID, humanActorRef, systemSourceId: SYSTEM_SOURCE_ID, text: S5_TEXT, occurredAt: "2026-08-13T10:20:00.000Z", engineVersion: ENGINE_VERSION }, store);
  const intentionEvent = (await store.readEventsByTurn(kinseedId, "TURN-POST-S5")).find((event) => event.type === "intention_selected");
  assert.ok(intentionEvent);
  assert.deepEqual(intentionEvent.payload.triggerSelfHypothesisIds, [hypothesis.id]);
  await materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "s5-influenced", [intentionEvent]), store);
  await assertObservation(store, kinseedId, intentionEvent, "seek_clarification");
  const observation = await store.readEvidenceItem(kinseedId, buildG0A2BehavioralObservationId(intentionEvent.id));
  assert.equal("causalContamination" in observation, false);
  assert.equal(selected.intention.kind, ASK);
});

test("G0-A2 additional materialization rejects invalid post-hypothesis intentions", async (t) => {
  const cases = [
    ["wrong event type", { situationId: "R1", type: "kinseed_message_emitted" }],
    ["schema v1", { situationId: "R1", schemaVersion: 1 }],
    ["non-system source", { situationId: "R1", sourceId: HUMAN_SOURCE_ID }],
    ["invalid kind", { situationId: "R1", kind: "unknown" }],
    ["invalid situation", { situationId: "Q1" }],
    ["revision trigger", { situationId: "R1", triggers: ["SH-ANY"] }],
    ["S5 multiple triggers", { situationId: "S5", triggers: ["SH-A", "SH-B"] }],
    ["S5 unknown trigger", { situationId: "S5", triggers: ["SH-UNKNOWN"] }],
  ];
  for (const [name, options] of cases) await t.test(name, async () => {
    const kinseedId = `K-G0A2-POST-BAD-${name.replaceAll(" ", "-")}`;
    const { store } = await setupInitialHypothesis(kinseedId, [ASK, ASK, ASK, USE], "seek_clarification");
    const event = await appendIntention(store, kinseedId, options);
    await assert.rejects(() => materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "bad", [event]), store), DomainInvariantError);
    assert.equal(await store.getStateVersion(kinseedId), 2);
  });
  await t.test("another Kinseed event", async () => {
    const { store } = await setupInitialHypothesis("K-G0A2-POST-OWNER", [ASK, ASK, ASK, USE], "seek_clarification");
    await store.appendEvent({ id: "E-OTHER-created", kinseedId: "K-G0A2-POST-OTHER", sequence: 1, type: "kinseed_created", occurredAt: "2026-08-13T10:00:00.000Z", turnId: null, sourceId: SYSTEM_SOURCE_ID, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1, engineVersion: ENGINE_VERSION, idempotencyKey: "other:created" });
    const other = await appendIntention(store, "K-G0A2-POST-OTHER", { situationId: "R1", kind: USE });
    await assert.rejects(() => materializeG0A2AdditionalBehavioralObservations(additionalInput("K-G0A2-POST-OWNER", "bad-owner", [other]), store), DomainInvariantError);
  });
  await t.test("S5 trigger from another Kinseed", async () => {
    const store = new InMemoryStore();
    const own = await setupInitialHypothesis("K-G0A2-POST-TRIGGER-OWN", [ASK, ASK, ASK, USE], "seek_clarification", store);
    const other = await setupInitialHypothesis("K-G0A2-POST-TRIGGER-OTHER", [ASK, USE, USE, USE], "use_available_information", store);
    const s5 = await appendIntention(store, "K-G0A2-POST-TRIGGER-OWN", { situationId: "S5", kind: ASK, triggers: [other.hypothesis.id] });
    await assert.rejects(() => materializeG0A2AdditionalBehavioralObservations(additionalInput("K-G0A2-POST-TRIGGER-OWN", "bad-trigger-owner", [s5]), store), DomainInvariantError);
    assert.equal((await store.readSelfHypothesis("K-G0A2-POST-TRIGGER-OWN", own.hypothesis.id))?.status, "active");
  });
  await t.test("duplicate event ID and revision situation", async () => {
    const kinseedId = "K-G0A2-POST-DUP";
    const { store } = await setupInitialHypothesis(kinseedId, [ASK, ASK, ASK, USE], "seek_clarification");
    const r1 = await appendIntention(store, kinseedId, { situationId: "R1", kind: USE });
    const r1Other = await appendIntention(store, kinseedId, { situationId: "R1", kind: USE });
    await assert.rejects(() => materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "dup-event", [r1, r1]), store), DomainInvariantError);
    await assert.rejects(() => materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "dup-situation", [r1, r1Other]), store), DomainInvariantError);
  });
});

test("G0-A2 additional materialization recovers commit and completion idempotently", async () => {
  const kinseedId = "K-G0A2-POST-RECOVERY";
  const { store } = await setupInitialHypothesis(kinseedId, [ASK, ASK, ASK, USE], "seek_clarification");
  const r1 = await appendIntention(store, kinseedId, { situationId: "R1", kind: USE });
  const r2 = await appendIntention(store, kinseedId, { situationId: "R2", kind: USE });
  let failCompletion = true;
  const persistence = new Proxy(store, { get(target, property, receiver) {
    if (property === "appendEvent") return async (event) => {
      if (failCompletion && event.type === "state_commit_completed" && event.payload.materializationId === "recovery") { failCompletion = false; throw new Error("completion failure"); }
      return target.appendEvent(event);
    };
    const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value;
  } });
  const request = additionalInput(kinseedId, "recovery", [r2, r1]);
  await assert.rejects(() => materializeG0A2AdditionalBehavioralObservations(request, persistence));
  assert.equal(await store.getStateVersion(kinseedId), 3);
  assert.equal((await store.readEventsInSequence(kinseedId)).filter((event) => event.payload.materializationId === "recovery").length, 0);
  const recovered = await materializeG0A2AdditionalBehavioralObservations(request, persistence);
  assert.deepEqual(recovered, { evidenceItemIds: [r1, r2].map((event) => buildG0A2BehavioralObservationId(event.id)), previousStateVersion: 2, newStateVersion: 3, changed: true, replayed: false });
  assert.equal(await store.getStateVersion(kinseedId), 3);
  assert.equal((await store.readEventsInSequence(kinseedId)).filter((event) => event.payload.materializationId === "recovery").length, 1);
  const replay = await materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "recovery", [r1, r2]), persistence);
  assert.equal(replay.replayed, true);
  assert.equal((await store.readEventsInSequence(kinseedId)).filter((event) => event.payload.materializationId === "recovery").length, 1);
  const r3 = await appendIntention(store, kinseedId, { situationId: "R3", kind: USE });
  await assert.rejects(
    () => materializeG0A2AdditionalBehavioralObservations(additionalInput(kinseedId, "recovery", [r1, r3]), persistence),
    DomainInvariantError,
  );
});
