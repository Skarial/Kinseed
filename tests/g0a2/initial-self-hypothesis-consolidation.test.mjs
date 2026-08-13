import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { materializeG0A2BehavioralObservations, buildG0A2BehavioralObservationId } from "../../dist/application/materialize-g0a2-behavioral-observations.js";
import { consolidateInitialG0A2SelfHypothesis } from "../../dist/application/consolidate-g0a2-self-hypothesis.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";

const systemSourceId = "SRC-G0A2-CONS";
const engineVersion = "g0a2-consolidation-test";

async function scenario(lenoseedId, kinds) {
  const store = new InMemoryStore();
  await store.registerSource({ id: systemSourceId, kind: "system", actorRef: null, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.appendEvent({ id: `E-${lenoseedId}-created`, lenoseedId, sequence: 1, type: "lenoseed_created", occurredAt: "2026-08-13T10:00:00.000Z", turnId: null, sourceId: systemSourceId, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1, engineVersion, idempotencyKey: `${lenoseedId}:created` });
  const events = [];
  for (const [index, kind] of kinds.entries()) {
    const situationId = `S${index + 1}`;
    const event = { id: `E-${lenoseedId}-${situationId}`, lenoseedId, sequence: index + 2, type: "intention_selected", occurredAt: `2026-08-13T10:00:0${index + 1}.000Z`, turnId: null, sourceId: systemSourceId, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { intentionId: `I-${situationId}`, kind, motivation: "fixture", situationId, triggerSelfHypothesisIds: [] }, payloadSchemaVersion: 2, engineVersion, idempotencyKey: `${lenoseedId}:${situationId}` };
    await store.appendEvent(event); events.push(event);
  }
  await materializeG0A2BehavioralObservations({ lenoseedId, historyId: "history", systemSourceId, intentionEventIds: events.map((event) => event.id), engineVersion }, store);
  return { store, events, evidenceItemIds: events.map((event) => buildG0A2BehavioralObservationId(event.id)) };
}

function input(lenoseedId, evidenceItemIds, consolidationId = "initial", value = "seek_clarification") {
  return { lenoseedId, consolidationId, systemSourceId, candidateProposition: { subjectRef: lenoseedId, predicate: "decision_style_under_uncertainty", value, context: { protocol: "G0-A2" } }, evidenceItemIds, engineVersion };
}

async function checkpointedScenario(lenoseedId, kinds = ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]) {
  const setup = await scenario(lenoseedId, kinds);
  const request = input(lenoseedId, setup.evidenceItemIds);
  setup.store.failNextAtomicCommitForTests();
  await assert.rejects(() => consolidateInitialG0A2SelfHypothesis(request, setup.store));
  const checkpoint = (await setup.store.readEventsInSequence(lenoseedId)).find(
    (event) => event.type === "validation_decision_recorded" && event.payload.scope === "self_hypothesis_consolidation",
  );
  assert.ok(checkpoint);
  return { ...setup, request, checkpoint };
}

function persistenceWithCheckpoint(store, replacement) {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readEventsInSequence") {
        return async (lenoseedId) => (await target.readEventsInSequence(lenoseedId)).map(
          (event) => event.id === replacement.id ? replacement : event,
        );
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("G0-A2 initial consolidation creates the 3/1 hypothesis for history A", async () => {
  const lenoseedId = "K-CONS-A";
  const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
  const result = await consolidateInitialG0A2SelfHypothesis(input(lenoseedId, evidenceItemIds), store);
  assert.deepEqual({ outcome: result.outcome, changed: result.changed, previous: result.previousStateVersion, next: result.newStateVersion }, { outcome: "create", changed: true, previous: 1, next: 2 });
  const hypothesis = await store.readSelfHypothesis(lenoseedId, result.selfHypothesisId);
  assert.equal(hypothesis?.status, "active"); assert.equal(hypothesis?.confidence, "moderate");
  assert.equal((await store.readActiveSelfHypothesisByKey(lenoseedId, hypothesis?.hypothesisKey))?.id, hypothesis?.id);
  assert.equal(hypothesis?.supportLinkIds.length, 3); assert.equal(hypothesis?.againstLinkIds.length, 1);
  const links = await Promise.all([...(hypothesis?.supportLinkIds ?? []), ...(hypothesis?.againstLinkIds ?? [])].map((id) => store.readEvidenceLink(lenoseedId, id)));
  assert.deepEqual(links.map((link) => link?.independenceGroup), ["g0a2:S1", "g0a2:S2", "g0a2:S3", "g0a2:S4"]);
  const events = await store.readEventsInSequence(lenoseedId);
  const checkpoint = events.find((event) => event.type === "validation_decision_recorded" && event.payloadSchemaVersion === 3);
  const completed = events.find((event) => event.type === "state_commit_completed" && event.payload.scope === "self_hypothesis_consolidation");
  assert.ok(checkpoint); assert.ok(completed); assert.deepEqual(completed?.causedByEventIds, [checkpoint?.id]);
});

test("G0-A2 initial consolidation canonicalizes checkpoint evidence order", async () => {
  const lenoseedId = "K-CONS-ORDER";
  const kinds = ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"];
  const { store, events, evidenceItemIds } = await scenario(lenoseedId, kinds);
  const shuffled = [evidenceItemIds[2], evidenceItemIds[0], evidenceItemIds[3], evidenceItemIds[1]];
  const result = await consolidateInitialG0A2SelfHypothesis(input(lenoseedId, shuffled), store);
  assert.equal(result.outcome, "create");
  const recorded = await store.readEventsInSequence(lenoseedId);
  const checkpoint = recorded.find((event) => event.type === "validation_decision_recorded" && event.payload.scope === "self_hypothesis_consolidation");
  assert.deepEqual(checkpoint?.payload.inputEvidenceItemIds, evidenceItemIds);
  assert.deepEqual(checkpoint?.causedByEventIds, events.map((event) => event.id));

  const orderedSetup = await scenario(lenoseedId, kinds);
  await consolidateInitialG0A2SelfHypothesis(
    input(lenoseedId, orderedSetup.evidenceItemIds),
    orderedSetup.store,
  );
  const orderedCheckpoint = (await orderedSetup.store.readEventsInSequence(lenoseedId)).find(
    (event) => event.type === "validation_decision_recorded" && event.payload.scope === "self_hypothesis_consolidation",
  );
  assert.deepEqual(checkpoint?.payload, orderedCheckpoint?.payload);

  const eventCount = recorded.length;
  const replay = await consolidateInitialG0A2SelfHypothesis(
    input(lenoseedId, [evidenceItemIds[3], evidenceItemIds[1], evidenceItemIds[0], evidenceItemIds[2]]),
    store,
  );
  assert.equal(replay.replayed, true);
  assert.equal((await store.readEventsInSequence(lenoseedId)).length, eventCount);
});

test("G0-A2 initial consolidation mirrors history B", async () => {
  const lenoseedId = "K-CONS-B";
  const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty"]);
  const result = await consolidateInitialG0A2SelfHypothesis(input(lenoseedId, evidenceItemIds, "initial", "use_available_information"), store);
  const hypothesis = await store.readSelfHypothesis(lenoseedId, result.selfHypothesisId);
  assert.equal(result.outcome, "create"); assert.equal(hypothesis?.supportLinkIds.length, 3); assert.equal(hypothesis?.againstLinkIds.length, 1);
});

test("G0-A2 initial consolidation checkpoints no_change without durable links", async (t) => {
  for (const [name, kinds, candidate] of [
    ["two two", ["ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty"], "seek_clarification"],
    ["four zero", ["ask_clarification", "ask_clarification", "ask_clarification", "ask_clarification"], "seek_clarification"],
    ["minority", ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"], "use_available_information"],
  ]) await t.test(name, async () => {
    const lenoseedId = `K-CONS-NO-${name}`; const { store, evidenceItemIds } = await scenario(lenoseedId, kinds);
    const result = await consolidateInitialG0A2SelfHypothesis(input(lenoseedId, evidenceItemIds, "initial", candidate), store);
    assert.equal(result.outcome, "no_change"); assert.equal(result.changed, false); assert.equal(result.previousStateVersion, 1); assert.equal(result.newStateVersion, 1); assert.equal(result.selfHypothesisId, null);
    const events = await store.readEventsInSequence(lenoseedId); assert.ok(events.some((event) => event.payload.scope === "self_hypothesis_consolidation" && event.type === "validation_decision_recorded")); assert.ok(events.some((event) => event.payload.scope === "self_hypothesis_consolidation" && event.type === "state_commit_completed"));
  });
});

test("G0-A2 consolidation recovers checkpoint, commit and completion boundaries", async () => {
  const lenoseedId = "K-CONS-REC"; const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]); const request = input(lenoseedId, evidenceItemIds);
  store.failNextAtomicCommitForTests();
  await assert.rejects(() => consolidateInitialG0A2SelfHypothesis(request, store));
  assert.equal((await store.readEventsInSequence(lenoseedId)).filter((event) => event.type === "validation_decision_recorded" && event.payloadSchemaVersion === 3).length, 1);
  const first = await consolidateInitialG0A2SelfHypothesis(request, store); assert.equal(first.outcome, "create"); assert.equal(await store.getStateVersion(lenoseedId), 2);
  const eventCount = (await store.readEventsInSequence(lenoseedId)).length;
  const replay = await consolidateInitialG0A2SelfHypothesis(request, store); assert.equal(replay.replayed, true); assert.equal((await store.readEventsInSequence(lenoseedId)).length, eventCount);
});

test("G0-A2 recovery preserves historical no_change without redeciding", async () => {
  const setup = await checkpointedScenario("K-CONS-NO-REDECIDE");
  const historical = clone(setup.checkpoint);
  historical.payload.outcome = "no_change";
  historical.payload.linkSnapshots = [];
  historical.payload.nextHypothesisSnapshot = null;
  const recovered = await consolidateInitialG0A2SelfHypothesis(
    setup.request,
    persistenceWithCheckpoint(setup.store, historical),
  );
  assert.equal(recovered.outcome, "no_change");
  assert.equal(recovered.selfHypothesisId, null);
  assert.equal(await setup.store.getStateVersion(setup.request.lenoseedId), 1);
});

test("G0-A2 consolidation recovers an applied commit whose completion failed", async () => {
  const lenoseedId = "K-CONS-APP"; const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]); const request = input(lenoseedId, evidenceItemIds);
  let fail = true; const persistence = new Proxy(store, { get(target, property, receiver) { if (property === "appendEvent") return async (event) => { if (fail && event.type === "state_commit_completed" && event.payload.scope === "self_hypothesis_consolidation") { fail = false; throw new Error("completion failed"); } return target.appendEvent(event); }; const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value; } });
  await assert.rejects(() => consolidateInitialG0A2SelfHypothesis(request, persistence)); assert.equal(await store.getStateVersion(lenoseedId), 2);
  const recovered = await consolidateInitialG0A2SelfHypothesis(request, persistence); assert.equal(recovered.changed, true); assert.equal(await store.getStateVersion(lenoseedId), 2); assert.equal((await store.readEventsInSequence(lenoseedId)).filter((event) => event.payload.scope === "self_hypothesis_consolidation" && event.type === "state_commit_completed").length, 1);
});

test("G0-A2 consolidation rejects a conflicting identity", async () => {
  const lenoseedId = "K-CONS-ID"; const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
  await consolidateInitialG0A2SelfHypothesis(input(lenoseedId, evidenceItemIds), store);
  await assert.rejects(() => consolidateInitialG0A2SelfHypothesis(input(lenoseedId, evidenceItemIds, "initial", "use_available_information"), store), DomainInvariantError);
  await assert.rejects(
    () => consolidateInitialG0A2SelfHypothesis(
      input(lenoseedId, [...evidenceItemIds.slice(0, 3), "EV-OTHER-SET"]),
      store,
    ),
    DomainInvariantError,
  );
});

test("G0-A2 consolidation rejects malformed historical checkpoint snapshots", async (t) => {
  const cases = [
    {
      name: "causedByEventIds are incoherent",
      mutate(checkpoint) { checkpoint.causedByEventIds.reverse(); },
    },
    {
      name: "checkpoint timestamp is incoherent",
      mutate(checkpoint) { checkpoint.occurredAt = "2026-08-13T10:00:03.000Z"; },
    },
    {
      name: "hypothesis proposition differs from candidate",
      mutate(checkpoint) { checkpoint.payload.nextHypothesisSnapshot.proposition.value = "use_available_information"; },
    },
    {
      name: "hypothesis key is incoherent",
      mutate(checkpoint) { checkpoint.payload.nextHypothesisSnapshot.hypothesisKey = "forged-key"; },
    },
    {
      name: "hypothesis id is not deterministic",
      mutate(checkpoint) { checkpoint.payload.nextHypothesisSnapshot.id = "SH-FORGED"; },
    },
    {
      name: "link targets another hypothesis",
      mutate(checkpoint) { checkpoint.payload.linkSnapshots[0].targetId = "SH-FORGED"; },
    },
    {
      name: "link duplicates an EvidenceItem",
      mutate(checkpoint) { checkpoint.payload.linkSnapshots[1].evidenceItemId = checkpoint.payload.linkSnapshots[0].evidenceItemId; },
    },
    {
      name: "supportLinkIds are incoherent",
      mutate(checkpoint) { checkpoint.payload.nextHypothesisSnapshot.supportLinkIds.pop(); },
    },
    {
      name: "counted groups are incoherent",
      mutate(checkpoint) { checkpoint.payload.countedSupportGroups[1] = checkpoint.payload.countedSupportGroups[0]; },
    },
    {
      name: "supersededHypothesisId is not null",
      mutate(checkpoint) { checkpoint.payload.supersededHypothesisId = "SH-OLD"; },
    },
    {
      name: "ignoredContaminatedLinkIds is not empty",
      mutate(checkpoint) { checkpoint.payload.ignoredContaminatedLinkIds = ["EL-IGNORED"]; },
    },
    {
      name: "no_change contains a link snapshot",
      kinds: ["ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty", "respond_with_available_information_under_uncertainty"],
      mutate(checkpoint) {
        checkpoint.payload.linkSnapshots = [{
          id: "EL-FORGED-NO-CHANGE",
          lenoseedId: checkpoint.lenoseedId,
          evidenceItemId: checkpoint.payload.inputEvidenceItemIds[0],
          targetType: "self_hypothesis",
          targetId: "SH-FORGED-NO-CHANGE",
          relation: "supports",
          sourceAuthority: "high",
          independenceGroup: "g0a2:S1",
          causalContamination: "none",
          weightClass: "high",
          createdAt: "2026-08-13T10:00:01.000Z",
        }];
      },
    },
  ];

  for (const [index, fixture] of cases.entries()) {
    await t.test(fixture.name, async () => {
      const setup = await checkpointedScenario(`K-CONS-BAD-${index}`, fixture.kinds);
      const malformed = clone(setup.checkpoint);
      fixture.mutate(malformed);
      await assert.rejects(
        () => consolidateInitialG0A2SelfHypothesis(
          setup.request,
          persistenceWithCheckpoint(setup.store, malformed),
        ),
        DomainInvariantError,
      );
    });
  }
});

test("G0-A2 store rejects forged initial active-hypothesis structures", async (t) => {
  await t.test("two supports and one counter-proof", async () => {
    const lenoseedId = "K-CONS-STORE-21"; const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
    const result = await consolidateInitialG0A2SelfHypothesis(input(lenoseedId, evidenceItemIds), store);
    const hypothesis = await store.readSelfHypothesis(lenoseedId, result.selfHypothesisId);
    await assert.rejects(() => store.atomicCommit(lenoseedId, 2, { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [{ ...hypothesis, supportLinkIds: hypothesis.supportLinkIds.slice(0, 2) }] }, "forged:2:1"), DomainInvariantError);
  });
  await t.test("four supports and no counter-proof", async () => {
    const lenoseedId = "K-CONS-STORE-40"; const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "ask_clarification"]);
    const links = evidenceItemIds.map((evidenceItemId, index) => ({ id: `EL-40-${index}`, lenoseedId, evidenceItemId, targetType: "self_hypothesis", targetId: "SH-40", relation: "supports", sourceAuthority: "high", independenceGroup: `g0a2:S${index + 1}`, causalContamination: "none", weightClass: "high", createdAt: `2026-08-13T10:00:0${index + 1}.000Z` }));
    const hypothesis = { id: "SH-40", lenoseedId, hypothesisKey: JSON.stringify([lenoseedId, "decision_style_under_uncertainty", [["protocol", "G0-A2"]]]), version: 1, proposition: { subjectRef: lenoseedId, predicate: "decision_style_under_uncertainty", value: "seek_clarification", context: { protocol: "G0-A2" } }, stage: "hypothesis", supportLinkIds: links.map((link) => link.id), againstLinkIds: [], confidence: "moderate", status: "active", previousVersionId: null, createdAt: "2026-08-13T10:00:04.000Z", updatedAt: "2026-08-13T10:00:04.000Z" };
    await assert.rejects(() => store.atomicCommit(lenoseedId, 1, { evidenceItems: [], evidenceLinks: links, beliefs: [], selfHypotheses: [hypothesis] }, "forged:4:0"), DomainInvariantError);
  });
  await t.test("system record and forged group cannot target the hypothesis", async () => {
    const lenoseedId = "K-CONS-STORE-LINK"; const { store, evidenceItemIds } = await scenario(lenoseedId, ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"]);
    const result = await consolidateInitialG0A2SelfHypothesis(input(lenoseedId, evidenceItemIds), store); const hypothesis = await store.readSelfHypothesis(lenoseedId, result.selfHypothesisId);
    const systemEvidence = { id: "EV-SYSTEM-FORGED", lenoseedId, kind: "system_record", proposition: hypothesis.proposition, sourceId: systemSourceId, eventIds: [`E-${lenoseedId}-created`], grounding: null, extractionConfidence: "high", status: "active", supersedesId: null, extractorVersion: "test", createdAt: "2026-08-13T10:00:00.000Z" };
    const forgedSystemLink = { id: "EL-SYSTEM-FORGED", lenoseedId, evidenceItemId: systemEvidence.id, targetType: "self_hypothesis", targetId: hypothesis.id, relation: "supports", sourceAuthority: "high", independenceGroup: "g0a2:S1", causalContamination: "none", weightClass: "high", createdAt: systemEvidence.createdAt };
    await assert.rejects(() => store.atomicCommit(lenoseedId, 2, { evidenceItems: [systemEvidence], evidenceLinks: [forgedSystemLink], beliefs: [], selfHypotheses: [] }, "forged:system"), DomainInvariantError);
    const forgedGroup = { id: "EL-GROUP-FORGED", lenoseedId, evidenceItemId: evidenceItemIds[0], targetType: "self_hypothesis", targetId: hypothesis.id, relation: "supports", sourceAuthority: "high", independenceGroup: "forged", causalContamination: "none", weightClass: "high", createdAt: "2026-08-13T10:00:01.000Z" };
    await assert.rejects(() => store.atomicCommit(lenoseedId, 2, { evidenceItems: [], evidenceLinks: [forgedGroup], beliefs: [], selfHypotheses: [] }, "forged:group"), DomainInvariantError);
  });
});
