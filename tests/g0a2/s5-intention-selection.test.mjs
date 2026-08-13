import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { selectG0A2S5Intention } from "../../dist/application/select-g0a2-s5-intention.js";
import { materializeG0A2BehavioralObservations, buildG0A2BehavioralObservationId } from "../../dist/application/materialize-g0a2-behavioral-observations.js";
import { consolidateInitialG0A2SelfHypothesis } from "../../dist/application/consolidate-g0a2-self-hypothesis.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";

const systemSourceId = "SRC-S5-SYSTEM";
const humanSourceId = "SRC-S5-HUMAN";
const humanActorRef = "H-S5";
const engineVersion = "g0a2-s5-test";
const s5Text = "J’ai deux options possibles mais il manque une information importante pour savoir laquelle est correcte. Que fais-tu ?";

async function setupHistory(kinseedId, kinds, candidateValue) {
  const store = new InMemoryStore();
  await store.registerSource({ id: systemSourceId, kind: "system", actorRef: null, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.registerSource({ id: humanSourceId, kind: "human", actorRef: humanActorRef, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.appendEvent({ id: `E-${kinseedId}-created`, kinseedId, sequence: 1, type: "kinseed_created", occurredAt: "2026-08-13T10:00:00.000Z", turnId: null, sourceId: systemSourceId, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1, engineVersion, idempotencyKey: `${kinseedId}:created` });
  const fixtures = [];
  for (const [index, kind] of kinds.entries()) {
    const situationId = `S${index + 1}`;
    const event = { id: `E-${kinseedId}-${situationId}`, kinseedId, sequence: index + 2, type: "intention_selected", occurredAt: `2026-08-13T10:00:0${index + 1}.000Z`, turnId: null, sourceId: systemSourceId, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { intentionId: `I-${kinseedId}-${situationId}`, kind, motivation: "fixture", situationId, triggerSelfHypothesisIds: [] }, payloadSchemaVersion: 2, engineVersion, idempotencyKey: `${kinseedId}:${situationId}` };
    await store.appendEvent(event);
    fixtures.push(event);
  }
  await materializeG0A2BehavioralObservations({ kinseedId, historyId: "history", systemSourceId, intentionEventIds: fixtures.map((event) => event.id), engineVersion }, store);
  const result = await consolidateInitialG0A2SelfHypothesis({ kinseedId, consolidationId: "initial", systemSourceId, candidateProposition: { subjectRef: kinseedId, predicate: "decision_style_under_uncertainty", value: candidateValue, context: { protocol: "G0-A2" } }, evidenceItemIds: fixtures.map((event) => buildG0A2BehavioralObservationId(event.id)), engineVersion }, store);
  const hypothesis = await store.readSelfHypothesis(kinseedId, result.selfHypothesisId);
  assert.ok(hypothesis);
  assert.equal(await store.getStateVersion(kinseedId), 2);
  return { store, hypothesis };
}

function input(kinseedId, turnId = `TURN-${kinseedId}`, text = s5Text) {
  return { kinseedId, turnId, humanSourceId, humanActorRef, systemSourceId, text, occurredAt: "2026-08-13T10:01:00.000Z", engineVersion };
}

function withEvents(store, mutate) {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readEventsByTurn") {
        return async (kinseedId, turnId) => mutate(await target.readEventsByTurn(kinseedId, turnId));
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("G0-A2 S5 selects divergent structured intentions for histories A and B", async () => {
  const historyA = await setupHistory("K-S5-A", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
  const historyB = await setupHistory("K-S5-B", ["ask_clarification", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty"], "use_available_information");
  const selectedA = await selectG0A2S5Intention(input("K-S5-A"), historyA.store);
  const selectedB = await selectG0A2S5Intention(input("K-S5-B"), historyB.store);

  assert.deepEqual(selectedA.situationEvent.payload, selectedB.situationEvent.payload);
  assert.equal(selectedA.selection.favoredKind, "ask_clarification");
  assert.equal(selectedA.intention.kind, "ask_clarification");
  assert.deepEqual(selectedA.selection.triggerSelfHypothesisIds, [historyA.hypothesis.id]);
  assert.equal(selectedA.selection.neutralTieBreakApplied, false);
  assert.equal(selectedA.intention.motivation, "apply_active_self_hypothesis_under_uncertainty");

  assert.equal(selectedB.selection.favoredKind, "respond_with_available_information_under_uncertainty");
  assert.equal(selectedB.intention.kind, "respond_with_available_information_under_uncertainty");
  assert.deepEqual(selectedB.selection.triggerSelfHypothesisIds, [historyB.hypothesis.id]);
  assert.equal(selectedB.selection.neutralTieBreakApplied, false);
  assert.equal(selectedB.intention.motivation, "apply_active_self_hypothesis_under_uncertainty");

  for (const [store, result] of [[historyA.store, selectedA], [historyB.store, selectedB]]) {
    const events = await store.readEventsByTurn(result.intention.kinseedId, result.situationEvent.turnId);
    const intentionEvent = events.find((event) => event.type === "intention_selected");
    assert.ok(intentionEvent);
    assert.ok(result.situationEvent.sequence < intentionEvent.sequence);
    assert.deepEqual(intentionEvent.causedByEventIds, [result.situationEvent.id]);
    assert.equal(intentionEvent.payloadSchemaVersion, 2);
    assert.equal(events.some((event) => event.type === "kinseed_message_emitted"), false);
    assert.equal(await store.getStateVersion(result.intention.kinseedId), 2);
  }
});

test("G0-A2 S5 validates sources before writing its input", async () => {
  const { store } = await setupHistory("K-S5-SOURCES", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
  await assert.rejects(
    () => selectG0A2S5Intention({ ...input("K-S5-SOURCES"), humanActorRef: "H-OTHER" }, store),
    DomainInvariantError,
  );
  assert.equal((await store.readEventsByTurn("K-S5-SOURCES", "TURN-K-S5-SOURCES")).length, 0);
});

test("G0-A2 S5 replays the historical intention without reading the current active hypothesis", async () => {
  const { store } = await setupHistory("K-S5-REPLAY", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
  const request = input("K-S5-REPLAY");
  const first = await selectG0A2S5Intention(request, store);
  const eventCount = (await store.readEventsInSequence(request.kinseedId)).length;
  const replayPort = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readActiveSelfHypothesisByKey") return async () => { throw new Error("must not read active hypothesis on replay"); };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const replay = await selectG0A2S5Intention(request, replayPort);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.intention, first.intention);
  assert.deepEqual(replay.selection, first.selection);
  assert.equal((await store.readEventsInSequence(request.kinseedId)).length, eventCount);
  assert.equal(await store.getStateVersion(request.kinseedId), 2);
});

test("G0-A2 S5 rejects replay and historical incoherence", async (t) => {
  await t.test("same turn with different text", async () => {
    const { store } = await setupHistory("K-S5-TEXT", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
    await selectG0A2S5Intention(input("K-S5-TEXT"), store);
    await assert.rejects(() => selectG0A2S5Intention(input("K-S5-TEXT", "TURN-K-S5-TEXT", "other text"), store), DomainInvariantError);
  });
  await t.test("intention without input", async () => {
    const { store } = await setupHistory("K-S5-NO-INPUT", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
    const request = input("K-S5-NO-INPUT");
    await store.appendEvent({ id: `E-${request.turnId}-intention`, kinseedId: request.kinseedId, sequence: 9, type: "intention_selected", occurredAt: request.occurredAt, turnId: request.turnId, sourceId: systemSourceId, actorRef: null, causedByEventIds: [], observedStateVersion: 2, payload: {}, payloadSchemaVersion: 2, engineVersion, idempotencyKey: `${request.turnId}:intention` });
    await assert.rejects(() => selectG0A2S5Intention(request, store), DomainInvariantError);
  });
  await t.test("malformed existing S5 input", async () => {
    const { store } = await setupHistory("K-S5-BAD-INPUT", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
    const request = input("K-S5-BAD-INPUT");
    await store.appendEvent({ id: `E-${request.turnId}-input`, kinseedId: request.kinseedId, sequence: 9, type: "human_message_received", occurredAt: request.occurredAt, turnId: request.turnId, sourceId: humanSourceId, actorRef: humanActorRef, causedByEventIds: [], observedStateVersion: 2, payload: { text: request.text }, payloadSchemaVersion: 1, engineVersion, idempotencyKey: `${request.turnId}:input` });
    await assert.rejects(() => selectG0A2S5Intention(request, store), DomainInvariantError);
  });
  await t.test("historical favoredKind incoherence", async () => {
    const { store } = await setupHistory("K-S5-BAD-FAVORED", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
    const request = input("K-S5-BAD-FAVORED");
    await selectG0A2S5Intention(request, store);
    const port = withEvents(store, (events) => events.map((event) => event.type === "intention_selected" ? { ...event, payload: { ...event.payload, favoredKind: "respond_with_available_information_under_uncertainty" } } : event));
    await assert.rejects(() => selectG0A2S5Intention(request, port), DomainInvariantError);
  });
  await t.test("historical trigger incoherence", async () => {
    const { store } = await setupHistory("K-S5-BAD-TRIGGER", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
    const request = input("K-S5-BAD-TRIGGER");
    await selectG0A2S5Intention(request, store);
    const port = withEvents(store, (events) => events.map((event) => event.type === "intention_selected" ? { ...event, payload: { ...event.payload, triggerSelfHypothesisIds: [] } } : event));
    await assert.rejects(() => selectG0A2S5Intention(request, port), DomainInvariantError);
  });
});

test("G0-A2 S5 retry after intention append failure reuses its input event", async () => {
  const { store } = await setupHistory("K-S5-APPEND", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "seek_clarification");
  const request = input("K-S5-APPEND");
  let fail = true;
  const flaky = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "appendEvent") return async (event) => {
        if (fail && event.type === "intention_selected") { fail = false; throw new Error("injected intention append failure"); }
        return target.appendEvent(event);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => selectG0A2S5Intention(request, flaky));
  assert.equal((await store.readEventsByTurn(request.kinseedId, request.turnId)).filter((event) => event.type === "human_message_received").length, 1);
  const retried = await selectG0A2S5Intention(request, flaky);
  assert.equal(retried.replayed, false);
  assert.equal((await store.readEventsByTurn(request.kinseedId, request.turnId)).length, 2);
  assert.equal(await store.getStateVersion(request.kinseedId), 2);
});
