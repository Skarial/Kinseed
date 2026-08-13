import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { buildG0A2S5DecisionContext } from "../../dist/application/build-g0a2-s5-decision-context.js";
import { consolidateInitialG0A2SelfHypothesis } from "../../dist/application/consolidate-g0a2-self-hypothesis.js";
import {
  buildG0A2BehavioralObservationId,
  materializeG0A2BehavioralObservations,
} from "../../dist/application/materialize-g0a2-behavioral-observations.js";
import { selectG0A2S5Intention } from "../../dist/application/select-g0a2-s5-intention.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";
import { selectG0A2S5Intention as selectFromSnapshot } from "../../dist/domain/g0a2-s5-selector.js";
import { buildSelfHypothesisKey } from "../../dist/domain/self-hypothesis.js";

const SYSTEM_SOURCE_ID = "SRC-G0A2-S5-SYSTEM";
const HUMAN_SOURCE_ID = "SRC-G0A2-S5-HUMAN";
const ENGINE_VERSION = "g0a2-s5-decision-context-test";
const S5_TEXT = "Jâ€™ai deux options possibles mais il manque une information importante pour savoir laquelle est correcte. Que fais-tu ?";
const ASK = "ask_clarification";
const USE = "respond_with_available_information_under_uncertainty";

async function setupHistory(lenoSeedId, kinds, candidateValue = null) {
  const store = new InMemoryStore();
  const humanActorRef = `H-${lenoSeedId}`;
  await store.registerSource({ id: SYSTEM_SOURCE_ID, kind: "system", actorRef: null, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.registerSource({ id: HUMAN_SOURCE_ID, kind: "human", actorRef: humanActorRef, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.appendEvent({ id: `E-${lenoSeedId}-created`, lenoSeedId, sequence: 1, type: "lenoseed_created", occurredAt: "2026-08-13T10:00:00.000Z", turnId: null, sourceId: SYSTEM_SOURCE_ID, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1, engineVersion: ENGINE_VERSION, idempotencyKey: `${lenoSeedId}:created` });

  const fixtureEvents = [];
  for (const [index, kind] of kinds.entries()) {
    const situationId = `S${index + 1}`;
    const event = { id: `E-${lenoSeedId}-${situationId}`, lenoSeedId, sequence: index + 2, type: "intention_selected", occurredAt: `2026-08-13T10:00:0${index + 1}.000Z`, turnId: null, sourceId: SYSTEM_SOURCE_ID, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { intentionId: `I-${lenoSeedId}-${situationId}`, kind, motivation: "fixture", situationId, triggerSelfHypothesisIds: [] }, payloadSchemaVersion: 2, engineVersion: ENGINE_VERSION, idempotencyKey: `${lenoSeedId}:${situationId}` };
    await store.appendEvent(event);
    fixtureEvents.push(event);
  }
  await materializeG0A2BehavioralObservations({ lenoSeedId, historyId: "history", systemSourceId: SYSTEM_SOURCE_ID, intentionEventIds: fixtureEvents.map((event) => event.id), engineVersion: ENGINE_VERSION }, store);

  const evidenceItemIds = fixtureEvents.map((event) => buildG0A2BehavioralObservationId(event.id));
  let hypothesis = null;
  if (candidateValue !== null) {
    const consolidation = await consolidateInitialG0A2SelfHypothesis({ lenoSeedId, consolidationId: "initial", systemSourceId: SYSTEM_SOURCE_ID, candidateProposition: { subjectRef: lenoSeedId, predicate: "decision_style_under_uncertainty", value: candidateValue, context: { protocol: "G0-A2" } }, evidenceItemIds, engineVersion: ENGINE_VERSION }, store);
    hypothesis = await store.readSelfHypothesis(lenoSeedId, consolidation.selfHypothesisId);
    assert.ok(hypothesis);
  }
  return { store, humanActorRef, fixtureEvents, evidenceItemIds, hypothesis };
}

async function appendS5Situation(store, lenoSeedId, humanActorRef, turnId = `TURN-${lenoSeedId}`) {
  const events = await store.readEventsInSequence(lenoSeedId);
  const event = {
    id: `E-${turnId}-input`, lenoSeedId, sequence: (events.at(-1)?.sequence ?? 0) + 1,
    type: "human_message_received", occurredAt: "2026-08-13T10:01:00.000Z", turnId,
    sourceId: HUMAN_SOURCE_ID, actorRef: humanActorRef, causedByEventIds: [],
    observedStateVersion: await store.getStateVersion(lenoSeedId),
    payload: { text: S5_TEXT, protocol: "G0-A2", situationId: "S5", decisionAxis: "decision_style_under_uncertainty" },
    payloadSchemaVersion: 2, engineVersion: ENGINE_VERSION, idempotencyKey: `${turnId}:input`,
  };
  await store.appendEvent(event);
  return event;
}

function s5Input(lenoSeedId, humanActorRef, turnId = `TURN-${lenoSeedId}`) {
  return { lenoSeedId, turnId, humanSourceId: HUMAN_SOURCE_ID, humanActorRef, systemSourceId: SYSTEM_SOURCE_ID, text: S5_TEXT, occurredAt: "2026-08-13T10:01:00.000Z", engineVersion: ENGINE_VERSION };
}

function hypothesisKey(lenoSeedId) {
  return buildSelfHypothesisKey({ subjectRef: lenoSeedId, predicate: "decision_style_under_uncertainty", value: "seek_clarification", context: { protocol: "G0-A2" } });
}

function proxyThatRejectsHistoricalReads(store) {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (["readEvidenceItem", "readEvidenceLink", "readSelfHypothesisHistoryByKey"].includes(property)) {
        return async () => { throw new Error(`S5 decision must not call ${property}`); };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("G0-A2 S5 decision-context builder validates its bounded snapshot", async (t) => {
  const activeSetup = await setupHistory("K-S5-CONTEXT-ACTIVE", [ASK, ASK, ASK, USE], "seek_clarification");
  const activeSituation = await appendS5Situation(activeSetup.store, "K-S5-CONTEXT-ACTIVE", activeSetup.humanActorRef);
  const emptySetup = await setupHistory("K-S5-CONTEXT-EMPTY", [ASK, ASK, ASK, USE]);
  const emptySituation = await appendS5Situation(emptySetup.store, "K-S5-CONTEXT-EMPTY", emptySetup.humanActorRef);

  await t.test("includes exactly the active SelfHypothesis when requested", async () => {
    const context = await buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-CONTEXT-ACTIVE", situationEvent: activeSituation, includeSelfHypotheses: true }, activeSetup.store);
    assert.deepEqual(context.activeSelfHypotheses, [activeSetup.hypothesis]);
  });
  await t.test("returns an empty snapshot when no hypothesis exists", async () => {
    const context = await buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-CONTEXT-EMPTY", situationEvent: emptySituation, includeSelfHypotheses: true }, emptySetup.store);
    assert.deepEqual(context.activeSelfHypotheses, []);
  });
  await t.test("ablates a durable hypothesis without reading it", async () => {
    const persistence = new Proxy(activeSetup.store, {
      get(target, property, receiver) {
        if (property === "readActiveSelfHypothesisByKey") return async () => { throw new Error("ablation must not read active hypotheses"); };
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const context = await buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-CONTEXT-ACTIVE", situationEvent: activeSituation, includeSelfHypotheses: false }, persistence);
    assert.deepEqual(context, { situationEvent: activeSituation, activeSelfHypotheses: [] });
  });
  await t.test("rejects a situation for another LenoSeed", async () => {
    await assert.rejects(() => buildG0A2S5DecisionContext({ lenoSeedId: "K-OTHER", situationEvent: activeSituation, includeSelfHypotheses: true }, activeSetup.store), DomainInvariantError);
  });
  await t.test("rejects an invalid S5 event", async () => {
    await assert.rejects(() => buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-CONTEXT-ACTIVE", situationEvent: { ...activeSituation, payload: { ...activeSituation.payload, situationId: "S4" } }, includeSelfHypotheses: true }, activeSetup.store), DomainInvariantError);
  });
  await t.test("rejects an ambiguous durable snapshot", async () => {
    await assert.rejects(() => buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-CONTEXT-EMPTY", situationEvent: { ...emptySituation, observedStateVersion: 0 }, includeSelfHypotheses: true }, emptySetup.store), DomainInvariantError);
  });
});

test("G0-A2 C1 keeps divergent histories without consolidating a SelfHypothesis", async () => {
  const historyA = await setupHistory("K-S5-C1-A", [ASK, ASK, ASK, USE]);
  const historyB = await setupHistory("K-S5-C1-B", [ASK, USE, USE, USE]);
  const beforeA = await historyA.store.readEventsInSequence("K-S5-C1-A");
  const beforeB = await historyB.store.readEventsInSequence("K-S5-C1-B");

  assert.equal(await historyA.store.getStateVersion("K-S5-C1-A"), 1);
  assert.equal(await historyB.store.getStateVersion("K-S5-C1-B"), 1);
  assert.notDeepEqual(historyA.fixtureEvents.map((event) => event.payload.kind), historyB.fixtureEvents.map((event) => event.payload.kind));
  for (const history of [historyA, historyB]) {
    for (const evidenceItemId of history.evidenceItemIds) {
      const observation = await history.store.readEvidenceItem(
        history === historyA ? "K-S5-C1-A" : "K-S5-C1-B",
        evidenceItemId,
      );
      assert.equal(observation?.grounding?.kind, "structured_event");
    }
  }
  assert.equal((await historyA.store.readSelfHypothesisHistoryByKey("K-S5-C1-A", hypothesisKey("K-S5-C1-A"))).length, 0);
  assert.equal((await historyB.store.readSelfHypothesisHistoryByKey("K-S5-C1-B", hypothesisKey("K-S5-C1-B"))).length, 0);
  assert.equal(beforeA.some((event) => event.type === "validation_decision_recorded"), false);
  assert.equal(beforeB.some((event) => event.type === "validation_decision_recorded"), false);

  const selectedA = await selectG0A2S5Intention(s5Input("K-S5-C1-A", historyA.humanActorRef), proxyThatRejectsHistoricalReads(historyA.store));
  const selectedB = await selectG0A2S5Intention(s5Input("K-S5-C1-B", historyB.humanActorRef), proxyThatRejectsHistoricalReads(historyB.store));

  assert.deepEqual(selectedA.situationEvent.payload, selectedB.situationEvent.payload);
  assert.deepEqual(selectedA.selection, selectedB.selection);
  assert.deepEqual(selectedA.selection, { eligibleKinds: [ASK, USE], favoredKind: null, selectedKind: USE, triggerSelfHypothesisIds: [], neutralTieBreakApplied: true });
  assert.deepEqual(
    { kind: selectedA.intention.kind, motivation: selectedA.intention.motivation, triggerSelfHypothesisIds: selectedA.intention.triggerSelfHypothesisIds, observedStateVersion: selectedA.intention.observedStateVersion },
    { kind: selectedB.intention.kind, motivation: selectedB.intention.motivation, triggerSelfHypothesisIds: selectedB.intention.triggerSelfHypothesisIds, observedStateVersion: selectedB.intention.observedStateVersion },
  );
  assert.equal(selectedA.intention.motivation, "apply_neutral_g0a2_policy");
  assert.equal(selectedB.intention.motivation, "apply_neutral_g0a2_policy");
  assert.equal(selectedA.stateVersion, 1);
  assert.equal(selectedB.stateVersion, 1);
  assert.equal(await historyA.store.getStateVersion("K-S5-C1-A"), 1);
  assert.equal(await historyB.store.getStateVersion("K-S5-C1-B"), 1);
  assert.equal((await historyA.store.readEventsInSequence("K-S5-C1-A")).length, beforeA.length + 2);
  assert.equal((await historyB.store.readEventsInSequence("K-S5-C1-B")).length, beforeB.length + 2);
});

test("G0-A2 S5 causal ablation removes only SelfHypothesis consumption", async () => {
  const historyA = await setupHistory("K-S5-ABLATION-A", [ASK, ASK, ASK, USE], "seek_clarification");
  const historyB = await setupHistory("K-S5-ABLATION-B", [ASK, USE, USE, USE], "use_available_information");
  const situationA = await appendS5Situation(historyA.store, "K-S5-ABLATION-A", historyA.humanActorRef);
  const situationB = await appendS5Situation(historyB.store, "K-S5-ABLATION-B", historyB.humanActorRef);

  const normalA = selectFromSnapshot(await buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-ABLATION-A", situationEvent: situationA, includeSelfHypotheses: true }, historyA.store));
  const normalB = selectFromSnapshot(await buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-ABLATION-B", situationEvent: situationB, includeSelfHypotheses: true }, historyB.store));
  assert.deepEqual(normalA, { eligibleKinds: [ASK, USE], favoredKind: ASK, selectedKind: ASK, triggerSelfHypothesisIds: [historyA.hypothesis.id], neutralTieBreakApplied: false });
  assert.deepEqual(normalB, { eligibleKinds: [ASK, USE], favoredKind: USE, selectedKind: USE, triggerSelfHypothesisIds: [historyB.hypothesis.id], neutralTieBreakApplied: false });

  const snapshotsBefore = await Promise.all([historyA, historyB].map(async (history, index) => {
    const lenoSeedId = index === 0 ? "K-S5-ABLATION-A" : "K-S5-ABLATION-B";
    return {
      stateVersion: await history.store.getStateVersion(lenoSeedId),
      hypothesis: await history.store.readSelfHypothesis(lenoSeedId, history.hypothesis.id),
      history: await history.store.readSelfHypothesisHistoryByKey(lenoSeedId, history.hypothesis.hypothesisKey),
      eventCount: (await history.store.readEventsInSequence(lenoSeedId)).length,
    };
  }));
  assert.equal(snapshotsBefore[0].hypothesis?.status, "active");
  assert.equal(snapshotsBefore[1].hypothesis?.status, "active");

  const ablatedA = selectFromSnapshot(await buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-ABLATION-A", situationEvent: situationA, includeSelfHypotheses: false }, new Proxy(historyA.store, { get(target, property, receiver) { if (property === "readActiveSelfHypothesisByKey") return async () => { throw new Error("ablation must not read active hypotheses"); }; const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value; } })));
  const ablatedBContext = await buildG0A2S5DecisionContext({ lenoSeedId: "K-S5-ABLATION-B", situationEvent: situationB, includeSelfHypotheses: false }, new Proxy(historyB.store, { get(target, property, receiver) { if (property === "readActiveSelfHypothesisByKey") return async () => { throw new Error("ablation must not read active hypotheses"); }; const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value; } }));
  const ablatedB = selectFromSnapshot(ablatedBContext);
  const neutral = { eligibleKinds: [ASK, USE], favoredKind: null, selectedKind: USE, triggerSelfHypothesisIds: [], neutralTieBreakApplied: true };
  assert.deepEqual(ablatedA, neutral);
  assert.deepEqual(ablatedB, neutral);
  assert.deepEqual(ablatedBContext.activeSelfHypotheses, []);
  assert.notDeepEqual(normalB, ablatedB);

  for (const [index, history] of [historyA, historyB].entries()) {
    const lenoSeedId = index === 0 ? "K-S5-ABLATION-A" : "K-S5-ABLATION-B";
    const before = snapshotsBefore[index];
    assert.equal(await history.store.getStateVersion(lenoSeedId), before.stateVersion);
    assert.deepEqual(await history.store.readSelfHypothesis(lenoSeedId, history.hypothesis.id), before.hypothesis);
    assert.deepEqual(await history.store.readSelfHypothesisHistoryByKey(lenoSeedId, history.hypothesis.hypothesisKey), before.history);
    assert.equal((await history.store.readEventsInSequence(lenoSeedId)).length, before.eventCount);
  }
});
