import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { materializeG0A2BehavioralObservations, buildG0A2BehavioralObservationId } from "../../dist/application/materialize-g0a2-behavioral-observations.js";
import { consolidateInitialG0A2SelfHypothesis } from "../../dist/application/consolidate-g0a2-self-hypothesis.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";

const systemSourceId = "SRC-G0A2-CONS";
const engineVersion = "g0a2-consolidation-test";

async function scenario(kinseedId, kinds) {
  const store = new InMemoryStore();
  await store.registerSource({ id: systemSourceId, kind: "system", actorRef: null, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.appendEvent({ id: `E-${kinseedId}-created`, kinseedId, sequence: 1, type: "kinseed_created", occurredAt: "2026-08-13T10:00:00.000Z", turnId: null, sourceId: systemSourceId, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1, engineVersion, idempotencyKey: `${kinseedId}:created` });
  const events = [];
  for (const [index, kind] of kinds.entries()) {
    const situationId = `S${index + 1}`;
    const event = { id: `E-${kinseedId}-${situationId}`, kinseedId, sequence: index + 2, type: "intention_selected", occurredAt: `2026-08-13T10:00:0${index + 1}.000Z`, turnId: null, sourceId: systemSourceId, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { intentionId: `I-${situationId}`, kind, motivation: "fixture", situationId, triggerSelfHypothesisIds: [] }, payloadSchemaVersion: 2, engineVersion, idempotencyKey: `${kinseedId}:${situationId}` };
    await store.appendEvent(event); events.push(event);
  }
  await materializeG0A2BehavioralObservations({ kinseedId, historyId: "history", systemSourceId, intentionEventIds: events.map((event) => event.id), engineVersion }, store);
  return { store, events, evidenceItemIds: events.map((event) => buildG0A2BehavioralObservationId(event.id)) };
}

function input(kinseedId, evidenceItemIds, consolidationId = "initial", value = "seek_clarification") {
  return { kinseedId, consolidationId, systemSourceId, candidateProposition: { subjectRef: kinseedId, predicate: "decision_style_under_uncertainty", value, context: { protocol: "G0-A2" } }, evidenceItemIds, engineVersion };
}

test("G0-A2 initial consolidation creates the 3/1 hypothesis for history A", async () => {
  const kinseedId = "K-CONS-A";
  const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
  const result = await consolidateInitialG0A2SelfHypothesis(input(kinseedId, evidenceItemIds), store);
  assert.deepEqual({ outcome: result.outcome, changed: result.changed, previous: result.previousStateVersion, next: result.newStateVersion }, { outcome: "create", changed: true, previous: 1, next: 2 });
  const hypothesis = await store.readSelfHypothesis(kinseedId, result.selfHypothesisId);
  assert.equal(hypothesis?.status, "active"); assert.equal(hypothesis?.confidence, "moderate");
  assert.equal((await store.readActiveSelfHypothesisByKey(kinseedId, hypothesis?.hypothesisKey))?.id, hypothesis?.id);
  assert.equal(hypothesis?.supportLinkIds.length, 3); assert.equal(hypothesis?.againstLinkIds.length, 1);
  const links = await Promise.all([...(hypothesis?.supportLinkIds ?? []), ...(hypothesis?.againstLinkIds ?? [])].map((id) => store.readEvidenceLink(kinseedId, id)));
  assert.deepEqual(links.map((link) => link?.independenceGroup), ["g0a2:S1", "g0a2:S2", "g0a2:S3", "g0a2:S4"]);
  const events = await store.readEventsInSequence(kinseedId);
  const checkpoint = events.find((event) => event.type === "validation_decision_recorded" && event.payloadSchemaVersion === 3);
  const completed = events.find((event) => event.type === "state_commit_completed" && event.payload.scope === "self_hypothesis_consolidation");
  assert.ok(checkpoint); assert.ok(completed); assert.deepEqual(completed?.causedByEventIds, [checkpoint?.id]);
});

test("G0-A2 initial consolidation mirrors history B", async () => {
  const kinseedId = "K-CONS-B";
  const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty"]);
  const result = await consolidateInitialG0A2SelfHypothesis(input(kinseedId, evidenceItemIds, "initial", "use_available_information"), store);
  const hypothesis = await store.readSelfHypothesis(kinseedId, result.selfHypothesisId);
  assert.equal(result.outcome, "create"); assert.equal(hypothesis?.supportLinkIds.length, 3); assert.equal(hypothesis?.againstLinkIds.length, 1);
});

test("G0-A2 initial consolidation checkpoints no_change without durable links", async (t) => {
  for (const [name, kinds, candidate] of [
    ["two two", ["ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty"], "seek_clarification"],
    ["four zero", ["ask_clarification", "ask_clarification", "ask_clarification", "ask_clarification"], "seek_clarification"],
    ["minority", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "use_available_information"],
  ]) await t.test(name, async () => {
    const kinseedId = `K-CONS-NO-${name}`; const { store, evidenceItemIds } = await scenario(kinseedId, kinds);
    const result = await consolidateInitialG0A2SelfHypothesis(input(kinseedId, evidenceItemIds, "initial", candidate), store);
    assert.equal(result.outcome, "no_change"); assert.equal(result.changed, false); assert.equal(result.previousStateVersion, 1); assert.equal(result.newStateVersion, 1); assert.equal(result.selfHypothesisId, null);
    const events = await store.readEventsInSequence(kinseedId); assert.ok(events.some((event) => event.payload.scope === "self_hypothesis_consolidation" && event.type === "validation_decision_recorded")); assert.ok(events.some((event) => event.payload.scope === "self_hypothesis_consolidation" && event.type === "state_commit_completed"));
  });
});

test("G0-A2 consolidation recovers checkpoint, commit and completion boundaries", async () => {
  const kinseedId = "K-CONS-REC"; const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]); const request = input(kinseedId, evidenceItemIds);
  store.failNextAtomicCommitForTests();
  await assert.rejects(() => consolidateInitialG0A2SelfHypothesis(request, store));
  assert.equal((await store.readEventsInSequence(kinseedId)).filter((event) => event.type === "validation_decision_recorded" && event.payloadSchemaVersion === 3).length, 1);
  const first = await consolidateInitialG0A2SelfHypothesis(request, store); assert.equal(first.outcome, "create"); assert.equal(await store.getStateVersion(kinseedId), 2);
  const eventCount = (await store.readEventsInSequence(kinseedId)).length;
  const replay = await consolidateInitialG0A2SelfHypothesis(request, store); assert.equal(replay.replayed, true); assert.equal((await store.readEventsInSequence(kinseedId)).length, eventCount);
});

test("G0-A2 consolidation recovers an applied commit whose completion failed", async () => {
  const kinseedId = "K-CONS-APP"; const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]); const request = input(kinseedId, evidenceItemIds);
  let fail = true; const persistence = new Proxy(store, { get(target, property, receiver) { if (property === "appendEvent") return async (event) => { if (fail && event.type === "state_commit_completed" && event.payload.scope === "self_hypothesis_consolidation") { fail = false; throw new Error("completion failed"); } return target.appendEvent(event); }; const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value; } });
  await assert.rejects(() => consolidateInitialG0A2SelfHypothesis(request, persistence)); assert.equal(await store.getStateVersion(kinseedId), 2);
  const recovered = await consolidateInitialG0A2SelfHypothesis(request, persistence); assert.equal(recovered.changed, true); assert.equal(await store.getStateVersion(kinseedId), 2); assert.equal((await store.readEventsInSequence(kinseedId)).filter((event) => event.payload.scope === "self_hypothesis_consolidation" && event.type === "state_commit_completed").length, 1);
});

test("G0-A2 consolidation rejects a conflicting identity", async () => {
  const kinseedId = "K-CONS-ID"; const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
  await consolidateInitialG0A2SelfHypothesis(input(kinseedId, evidenceItemIds), store);
  await assert.rejects(() => consolidateInitialG0A2SelfHypothesis(input(kinseedId, evidenceItemIds, "initial", "use_available_information"), store), DomainInvariantError);
});

test("G0-A2 store rejects forged initial active-hypothesis structures", async (t) => {
  await t.test("two supports and one counter-proof", async () => {
    const kinseedId = "K-CONS-STORE-21"; const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
    const result = await consolidateInitialG0A2SelfHypothesis(input(kinseedId, evidenceItemIds), store);
    const hypothesis = await store.readSelfHypothesis(kinseedId, result.selfHypothesisId);
    await assert.rejects(() => store.atomicCommit(kinseedId, 2, { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [{ ...hypothesis, supportLinkIds: hypothesis.supportLinkIds.slice(0, 2) }] }, "forged:2:1"), DomainInvariantError);
  });
  await t.test("four supports and no counter-proof", async () => {
    const kinseedId = "K-CONS-STORE-40"; const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "ask_clarification"]);
    const links = evidenceItemIds.map((evidenceItemId, index) => ({ id: `EL-40-${index}`, kinseedId, evidenceItemId, targetType: "self_hypothesis", targetId: "SH-40", relation: "supports", sourceAuthority: "high", independenceGroup: `g0a2:S${index + 1}`, causalContamination: "none", weightClass: "high", createdAt: `2026-08-13T10:00:0${index + 1}.000Z` }));
    const hypothesis = { id: "SH-40", kinseedId, hypothesisKey: JSON.stringify([kinseedId, "decision_style_under_uncertainty", [["protocol", "G0-A2"]]]), version: 1, proposition: { subjectRef: kinseedId, predicate: "decision_style_under_uncertainty", value: "seek_clarification", context: { protocol: "G0-A2" } }, stage: "hypothesis", supportLinkIds: links.map((link) => link.id), againstLinkIds: [], confidence: "moderate", status: "active", previousVersionId: null, createdAt: "2026-08-13T10:00:04.000Z", updatedAt: "2026-08-13T10:00:04.000Z" };
    await assert.rejects(() => store.atomicCommit(kinseedId, 1, { evidenceItems: [], evidenceLinks: links, beliefs: [], selfHypotheses: [hypothesis] }, "forged:4:0"), DomainInvariantError);
  });
  await t.test("system record and forged group cannot target the hypothesis", async () => {
    const kinseedId = "K-CONS-STORE-LINK"; const { store, evidenceItemIds } = await scenario(kinseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
    const result = await consolidateInitialG0A2SelfHypothesis(input(kinseedId, evidenceItemIds), store); const hypothesis = await store.readSelfHypothesis(kinseedId, result.selfHypothesisId);
    const systemEvidence = { id: "EV-SYSTEM-FORGED", kinseedId, kind: "system_record", proposition: hypothesis.proposition, sourceId: systemSourceId, eventIds: [`E-${kinseedId}-created`], grounding: null, extractionConfidence: "high", status: "active", supersedesId: null, extractorVersion: "test", createdAt: "2026-08-13T10:00:00.000Z" };
    const forgedSystemLink = { id: "EL-SYSTEM-FORGED", kinseedId, evidenceItemId: systemEvidence.id, targetType: "self_hypothesis", targetId: hypothesis.id, relation: "supports", sourceAuthority: "high", independenceGroup: "g0a2:S1", causalContamination: "none", weightClass: "high", createdAt: systemEvidence.createdAt };
    await assert.rejects(() => store.atomicCommit(kinseedId, 2, { evidenceItems: [systemEvidence], evidenceLinks: [forgedSystemLink], beliefs: [], selfHypotheses: [] }, "forged:system"), DomainInvariantError);
    const forgedGroup = { id: "EL-GROUP-FORGED", kinseedId, evidenceItemId: evidenceItemIds[0], targetType: "self_hypothesis", targetId: hypothesis.id, relation: "supports", sourceAuthority: "high", independenceGroup: "forged", causalContamination: "none", weightClass: "high", createdAt: "2026-08-13T10:00:01.000Z" };
    await assert.rejects(() => store.atomicCommit(kinseedId, 2, { evidenceItems: [], evidenceLinks: [forgedGroup], beliefs: [], selfHypotheses: [] }, "forged:group"), DomainInvariantError);
  });
});
