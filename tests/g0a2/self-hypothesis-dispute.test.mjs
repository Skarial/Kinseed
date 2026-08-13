import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { materializeG0A2BehavioralObservations, buildG0A2BehavioralObservationId } from "../../dist/application/materialize-g0a2-behavioral-observations.js";
import { materializeG0A2AdditionalBehavioralObservations } from "../../dist/application/materialize-g0a2-additional-behavioral-observations.js";
import { consolidateInitialG0A2SelfHypothesis } from "../../dist/application/consolidate-g0a2-self-hypothesis.js";
import { consolidateG0A2SelfHypothesisDispute } from "../../dist/application/consolidate-g0a2-self-hypothesis-dispute.js";
import { consolidateG0A2SelfHypothesisRevision } from "../../dist/application/consolidate-g0a2-self-hypothesis-revision.js";
import { selectG0A2S5Intention } from "../../dist/application/select-g0a2-s5-intention.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";

const SYSTEM = "SRC-DISPUTE-SYSTEM"; const HUMAN = "SRC-DISPUTE-HUMAN"; const ENGINE = "g0a2-dispute-test";
const ASK = "ask_clarification"; const USE = "respond_with_available_information_under_uncertainty";

async function setup(lenoSeedId, initial = [ASK, ASK, ASK, USE], value = "seek_clarification") {
  const store = new InMemoryStore();
  await store.registerSource({ id: SYSTEM, kind: "system", actorRef: null, channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.registerSource({ id: HUMAN, kind: "human", actorRef: "H-DISPUTE", channel: "test", createdAt: "2026-08-13T10:00:00.000Z" });
  await store.appendEvent({ id: `E-${lenoSeedId}-created`, lenoSeedId, sequence: 1, type: "lenoseed_created", occurredAt: "2026-08-13T10:00:00.000Z", turnId: null, sourceId: SYSTEM, actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1, engineVersion: ENGINE, idempotencyKey: `${lenoSeedId}:created` });
  const initialEvents = [];
  for (const [i, kind] of initial.entries()) initialEvents.push(await append(store, lenoSeedId, `S${i + 1}`, kind));
  await materializeG0A2BehavioralObservations({ lenoSeedId, historyId: "history", systemSourceId: SYSTEM, intentionEventIds: initialEvents.map((e) => e.id), engineVersion: ENGINE }, store);
  const initialResult = await consolidateInitialG0A2SelfHypothesis({ lenoSeedId, consolidationId: "initial", systemSourceId: SYSTEM, candidateProposition: { subjectRef: lenoSeedId, predicate: "decision_style_under_uncertainty", value, context: { protocol: "G0-A2" } }, evidenceItemIds: initialEvents.map((e) => buildG0A2BehavioralObservationId(e.id)), engineVersion: ENGINE }, store);
  const v1 = await store.readSelfHypothesis(lenoSeedId, initialResult.selfHypothesisId);
  return { store, v1, initialEvents };
}
async function append(store, lenoSeedId, situationId, kind) {
  const events = await store.readEventsInSequence(lenoSeedId); const sequence = (events.at(-1)?.sequence ?? 0) + 1;
  const event = { id: `E-${lenoSeedId}-${situationId}-${sequence}`, lenoSeedId, sequence, type: "intention_selected", occurredAt: `2026-08-13T10:20:${String(sequence).padStart(2, "0")}.000Z`, turnId: null, sourceId: SYSTEM, actorRef: null, causedByEventIds: [], observedStateVersion: await store.getStateVersion(lenoSeedId), payload: { intentionId: `I-${lenoSeedId}-${situationId}-${sequence}`, kind, motivation: "fixture", situationId, triggerSelfHypothesisIds: [] }, payloadSchemaVersion: 2, engineVersion: ENGINE, idempotencyKey: `fixture:${lenoSeedId}:${situationId}:${sequence}` };
  await store.appendEvent(event); return event;
}
async function materializeR(store, lenoSeedId, events, id = "rs") { await materializeG0A2AdditionalBehavioralObservations({ lenoSeedId, materializationId: id, systemSourceId: SYSTEM, intentionEventIds: events.map((event) => event.id), engineVersion: ENGINE }, store); }
function disputeInput(lenoSeedId, initial, more, consolidationId = "dispute") { return { lenoSeedId, consolidationId, systemSourceId: SYSTEM, evidenceItemIds: [...initial, ...more].map((event) => buildG0A2BehavioralObservationId(event.id)), engineVersion: ENGINE }; }
function revisionInput(lenoSeedId, initial, revisions, consolidationId = "revision") { return { lenoSeedId, consolidationId, systemSourceId: SYSTEM, evidenceItemIds: [...initial, ...revisions].map((event) => buildG0A2BehavioralObservationId(event.id)), engineVersion: ENGINE }; }

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function persistenceWithEvents(store, replacements, rejectAppend = false) {
  return new Proxy(store, { get(target, property, receiver) {
    if (property === "readEventsInSequence") return async (lenoSeedId) => (await target.readEventsInSequence(lenoSeedId)).map((event) => replacements.get(event.id) ?? event);
    if (property === "appendEvent" && rejectAppend) return async () => { throw new Error("must not append after a conceptual collision"); };
    const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value;
  } });
}
function persistenceWithForgedEvidenceLink(store, evidenceLinkId, mutate) {
  return new Proxy(store, { get(target, property, receiver) {
    if (property === "readEvidenceLink") return async (lenoSeedId, id) => {
      const link = await target.readEvidenceLink(lenoSeedId, id);
      return id === evidenceLinkId ? mutate(clone(link)) : link;
    };
    const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value;
  } });
}
async function completedDispute(lenoSeedId, includeS5 = false) {
  const scenario = await setup(lenoSeedId);
  const { store, initialEvents } = scenario;
  const more = [];
  if (includeS5) {
    const selected = await selectG0A2S5Intention({ lenoSeedId, turnId: `${lenoSeedId}-S5`, humanSourceId: HUMAN, humanActorRef: "H-DISPUTE", systemSourceId: SYSTEM, text: "s5", occurredAt: "2026-08-13T11:00:00.000Z", engineVersion: ENGINE }, store);
    const event = (await store.readEventsByTurn(lenoSeedId, `${lenoSeedId}-S5`)).find((item) => item.type === "intention_selected");
    await materializeR(store, lenoSeedId, [event], "s5"); more.push(event);
    assert.equal(selected.replayed, false);
  }
  const r1 = await append(store, lenoSeedId, "R1", USE); const r2 = await append(store, lenoSeedId, "R2", USE);
  await materializeR(store, lenoSeedId, [r1, r2], "rs"); more.push(r1, r2);
  const request = disputeInput(lenoSeedId, initialEvents, more);
  await consolidateG0A2SelfHypothesisDispute(request, store);
  const events = await store.readEventsInSequence(lenoSeedId);
  const checkpoint = events.find((event) => event.type === "validation_decision_recorded" && event.payload.consolidationId === "dispute");
  const completion = events.find((event) => event.type === "state_commit_completed" && event.payload.consolidationId === "dispute");
  assert.ok(checkpoint); assert.ok(completion);
  return { ...scenario, request, more, checkpoint, completion };
}

test("G0-A2 dispute supersedes v1 and creates disputed v2 from two clean contradictions", async () => {
  const lenoSeedId = "K-DISPUTE-MAIN"; const { store, v1, initialEvents } = await setup(lenoSeedId);
  const r1 = await append(store, lenoSeedId, "R1", USE); const r2 = await append(store, lenoSeedId, "R2", USE); await materializeR(store, lenoSeedId, [r1, r2]);
  const result = await consolidateG0A2SelfHypothesisDispute(disputeInput(lenoSeedId, initialEvents, [r1, r2]), store);
  assert.deepEqual({ outcome: result.outcome, previous: result.previousStateVersion, next: result.newStateVersion }, { outcome: "dispute", previous: 3, next: 4 });
  const history = await store.readSelfHypothesisHistoryByKey(lenoSeedId, v1.hypothesisKey); assert.equal(history.length, 2);
  const [old, next] = history; assert.equal(old.status, "superseded"); assert.equal(old.confidence, "moderate"); assert.deepEqual(old.supportLinkIds, v1.supportLinkIds); assert.deepEqual(old.againstLinkIds, v1.againstLinkIds);
  assert.deepEqual({ version: next.version, status: next.status, confidence: next.confidence, previous: next.previousVersionId, value: next.proposition.value }, { version: 2, status: "disputed", confidence: "low", previous: v1.id, value: "seek_clarification" });
  const links = await Promise.all([...next.supportLinkIds, ...next.againstLinkIds].map((id) => store.readEvidenceLink(lenoSeedId, id))); assert.equal(links.length, 6); assert.ok(links.every((link) => link?.targetId === next.id)); assert.equal(await store.readActiveSelfHypothesisByKey(lenoSeedId, v1.hypothesisKey), null);
  const completion = (await store.readEventsInSequence(lenoSeedId)).find((event) => event.type === "state_commit_completed" && event.payload.consolidationId === "dispute"); assert.equal(completion?.payload.newStateVersion, 4);
});

test("G0-A2 dispute mirrors the orientation and no_change preserves v1", async () => {
  const mirror = await setup("K-DISPUTE-MIRROR", [ASK, USE, USE, USE], "use_available_information");
  const mr1 = await append(mirror.store, "K-DISPUTE-MIRROR", "R1", ASK); const mr2 = await append(mirror.store, "K-DISPUTE-MIRROR", "R2", ASK); await materializeR(mirror.store, "K-DISPUTE-MIRROR", [mr1, mr2]);
  const mirrored = await consolidateG0A2SelfHypothesisDispute(disputeInput("K-DISPUTE-MIRROR", mirror.initialEvents, [mr1, mr2]), mirror.store); assert.equal(mirrored.outcome, "dispute"); assert.equal((await mirror.store.readSelfHypothesis("K-DISPUTE-MIRROR", mirrored.selfHypothesisId))?.proposition.value, "use_available_information");
  const no = await setup("K-DISPUTE-NO"); const r1 = await append(no.store, "K-DISPUTE-NO", "R1", USE); await materializeR(no.store, "K-DISPUTE-NO", [r1]); const result = await consolidateG0A2SelfHypothesisDispute(disputeInput("K-DISPUTE-NO", no.initialEvents, [r1], "no-change"), no.store); assert.equal(result.outcome, "no_change"); assert.equal(result.changed, false); assert.equal(await no.store.getStateVersion("K-DISPUTE-NO"), 3); assert.equal((await no.store.readSelfHypothesis("K-DISPUTE-NO", no.v1.id))?.status, "active");
  const mixed = await setup("K-DISPUTE-MIXED"); const xr1 = await append(mixed.store, "K-DISPUTE-MIXED", "R1", USE); const xr2 = await append(mixed.store, "K-DISPUTE-MIXED", "R2", ASK); await materializeR(mixed.store, "K-DISPUTE-MIXED", [xr1, xr2]); const mixedResult = await consolidateG0A2SelfHypothesisDispute(disputeInput("K-DISPUTE-MIXED", mixed.initialEvents, [xr1, xr2], "mixed"), mixed.store); assert.equal(mixedResult.outcome, "no_change"); assert.equal(mixedResult.changed, false);
});

test("G0-A2 no_change replays its checkpoint without creating deterministic v2", async () => {
  const lenoSeedId = "K-DISPUTE-NO-REPLAY"; const state = await setup(lenoSeedId);
  const r1 = await append(state.store, lenoSeedId, "R1", USE); await materializeR(state.store, lenoSeedId, [r1]);
  const request = disputeInput(lenoSeedId, state.initialEvents, [r1], "no-replay");
  const first = await consolidateG0A2SelfHypothesisDispute(request, state.store);
  const replay = await consolidateG0A2SelfHypothesisDispute(request, state.store);
  assert.deepEqual({ outcome: first.outcome, changed: first.changed, replayed: replay.replayed, version: await state.store.getStateVersion(lenoSeedId) }, { outcome: "no_change", changed: false, replayed: true, version: 3 });
  assert.equal(await state.store.readSelfHypothesis(lenoSeedId, `SH-G0A2-${lenoSeedId}-no-replay-v2`), null);
});

test("G0-A2 S5 is neutral after dispute while an earlier influenced S5 replays causally", async () => {
  const lenoSeedId = "K-DISPUTE-S5"; const { store, v1, initialEvents } = await setup(lenoSeedId);
  const oldS5 = await selectG0A2S5Intention({ lenoSeedId, turnId: "TURN-OLD", humanSourceId: HUMAN, humanActorRef: "H-DISPUTE", systemSourceId: SYSTEM, text: "s5", occurredAt: "2026-08-13T11:00:00.000Z", engineVersion: ENGINE }, store); assert.deepEqual(oldS5.intention.triggerSelfHypothesisIds, [v1.id]);
  const oldS5Event = (await store.readEventsByTurn(lenoSeedId, "TURN-OLD")).find((event) => event.type === "intention_selected"); await materializeR(store, lenoSeedId, [oldS5Event], "s5");
  const r1 = await append(store, lenoSeedId, "R1", USE); const r2 = await append(store, lenoSeedId, "R2", USE); await materializeR(store, lenoSeedId, [r1, r2], "rs");
  const request = disputeInput(lenoSeedId, initialEvents, [r1, r2, oldS5Event]); const dispute = await consolidateG0A2SelfHypothesisDispute(request, store); assert.equal(dispute.outcome, "dispute");
  const checkpoint = (await store.readEventsInSequence(lenoSeedId)).find((event) => event.type === "validation_decision_recorded" && event.payload.consolidationId === "dispute"); const s5Link = checkpoint.payload.linkSnapshots.find((link) => link.evidenceItemId === buildG0A2BehavioralObservationId(oldS5Event.id)); assert.deepEqual({ contamination: s5Link.causalContamination, weight: s5Link.weightClass, ignored: checkpoint.payload.ignoredContaminatedLinkIds.includes(s5Link.id) }, { contamination: "influenced_by_target", weight: "low", ignored: true });
  const replay = await selectG0A2S5Intention({ lenoSeedId, turnId: "TURN-OLD", humanSourceId: HUMAN, humanActorRef: "H-DISPUTE", systemSourceId: SYSTEM, text: "s5", occurredAt: "2026-08-13T11:00:00.000Z", engineVersion: ENGINE }, store); assert.equal(replay.replayed, true); assert.deepEqual(replay.intention.triggerSelfHypothesisIds, [v1.id]);
  const next = await selectG0A2S5Intention({ lenoSeedId, turnId: "TURN-NEW", humanSourceId: HUMAN, humanActorRef: "H-DISPUTE", systemSourceId: SYSTEM, text: "s5 new", occurredAt: "2026-08-13T12:00:00.000Z", engineVersion: ENGINE }, store); assert.deepEqual(next.selection, { eligibleKinds: [ASK, USE], favoredKind: null, selectedKind: USE, triggerSelfHypothesisIds: [], neutralTieBreakApplied: true }); assert.equal(next.intention.motivation, "apply_neutral_g0a2_policy"); assert.equal(await store.getStateVersion(lenoSeedId), 5);
});

test("G0-A2 store rejects unsafe SelfHypothesis replacements and disputed moderate confidence", async () => {
  const lenoSeedId = "K-DISPUTE-STORE"; const { store, v1 } = await setup(lenoSeedId);
  for (const [name, replacement] of [["confidence", { ...v1, confidence: "low" }], ["support", { ...v1, supportLinkIds: [] }], ["against", { ...v1, againstLinkIds: [] }], ["in-place disputed", { ...v1, status: "disputed", confidence: "low" }]]) {
    await assert.rejects(() => store.atomicCommit(lenoSeedId, 2, { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [replacement] }, `forged:${name}`), DomainInvariantError);
  }
  const superseded = { ...v1, status: "superseded", updatedAt: "2026-08-13T12:00:00.000Z" };
  await store.atomicCommit(lenoSeedId, 2, { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [superseded] }, "valid:supersede");
  await assert.rejects(() => store.atomicCommit(lenoSeedId, 3, { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [{ ...superseded, updatedAt: "2026-08-13T12:00:01.000Z" }] }, "forged:resupersede"), DomainInvariantError);
  const fresh = await setup("K-DISPUTE-STORE-LOW");
  const forged = { ...fresh.v1, id: "SH-FORGED-DISPUTED", version: 1, status: "disputed", confidence: "moderate", supportLinkIds: [], againstLinkIds: [], previousVersionId: null };
  await assert.rejects(() => fresh.store.atomicCommit("K-DISPUTE-STORE-LOW", 2, { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [forged] }, "forged:moderate-disputed"), DomainInvariantError);
});

test("G0-A2 dispute recovers both durable commit boundaries without a second state change", async () => {
  for (const [lenoSeedId, failure] of [["K-DISPUTE-REC-BEFORE", "commit"], ["K-DISPUTE-REC-AFTER", "completion"]]) {
    const { store, initialEvents } = await setup(lenoSeedId); const r1 = await append(store, lenoSeedId, "R1", USE); const r2 = await append(store, lenoSeedId, "R2", USE); await materializeR(store, lenoSeedId, [r1, r2]);
    let fail = true;
    const persistence = new Proxy(store, { get(target, property, receiver) {
      if (property === "atomicCommit" && failure === "commit") return async (...args) => { if (fail) { fail = false; throw new Error("commit failure"); } return target.atomicCommit(...args); };
      if (property === "appendEvent" && failure === "completion") return async (event) => { if (fail && event.type === "state_commit_completed" && event.payload.consolidationId === "dispute") { fail = false; throw new Error("completion failure"); } return target.appendEvent(event); };
      const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value;
    } });
    const request = disputeInput(lenoSeedId, initialEvents, [r1, r2]);
    await assert.rejects(() => consolidateG0A2SelfHypothesisDispute(request, persistence));
    assert.equal(await store.getStateVersion(lenoSeedId), failure === "commit" ? 3 : 4);
    const recovered = await consolidateG0A2SelfHypothesisDispute(request, persistence); assert.equal(recovered.outcome, "dispute"); assert.equal(await store.getStateVersion(lenoSeedId), 4);
    const replay = await consolidateG0A2SelfHypothesisDispute(request, persistence); assert.equal(replay.replayed, true);
    const events = await store.readEventsInSequence(lenoSeedId); assert.equal(events.filter((event) => event.payload.consolidationId === "dispute" && event.type === "state_commit_completed").length, 1);
  }
});

test("G0-A2 dispute recovery rejects falsified checkpoint snapshots", async (t) => {
  const cases = [
    ["candidate proposition", (checkpoint) => { checkpoint.payload.candidateProposition.value = "use_available_information"; }],
    ["hypothesis key", (checkpoint) => { checkpoint.payload.hypothesisKey = "forged-key"; }],
    ["formation cause", (checkpoint) => { checkpoint.causedByEventIds[checkpoint.causedByEventIds.length - 1] = "E-FORGED-FORMATION"; }],
    ["missing link", (checkpoint) => { checkpoint.payload.linkSnapshots.pop(); }],
    ["link target", (checkpoint) => { checkpoint.payload.linkSnapshots[0].targetId = "SH-FORGED"; }],
    ["counted against groups", (checkpoint) => { checkpoint.payload.countedAgainstGroups = ["g0a2:S4"]; }],
    ["next status", (checkpoint) => { checkpoint.payload.nextHypothesisSnapshot.status = "active"; }],
    ["support links", (checkpoint) => { checkpoint.payload.nextHypothesisSnapshot.supportLinkIds.pop(); }],
    ["against links", (checkpoint) => { checkpoint.payload.nextHypothesisSnapshot.againstLinkIds.pop(); }],
    ["checkpoint timestamp", (checkpoint) => { checkpoint.occurredAt = "2026-08-13T00:00:00.000Z"; }],
  ];
  for (const [index, [name, mutate]] of cases.entries()) await t.test(name, async () => {
    const setup = await completedDispute(`K-DISPUTE-CP-${index}`); const forged = clone(setup.checkpoint); mutate(forged);
    await assert.rejects(() => consolidateG0A2SelfHypothesisDispute(setup.request, persistenceWithEvents(setup.store, new Map([[setup.checkpoint.id, forged]]))), DomainInvariantError);
  });
  await t.test("S5 contamination and ignored links", async () => {
    const setup = await completedDispute("K-DISPUTE-CP-S5", true); const forged = clone(setup.checkpoint);
    const s5 = forged.payload.linkSnapshots.find((link) => link.independenceGroup === "g0a2:S5");
    s5.causalContamination = "none"; s5.weightClass = "high";
    await assert.rejects(() => consolidateG0A2SelfHypothesisDispute(setup.request, persistenceWithEvents(setup.store, new Map([[setup.checkpoint.id, forged]]))), DomainInvariantError);
    const ignored = clone(setup.checkpoint); ignored.payload.ignoredContaminatedLinkIds = [];
    await assert.rejects(() => consolidateG0A2SelfHypothesisDispute(setup.request, persistenceWithEvents(setup.store, new Map([[setup.checkpoint.id, ignored]]))), DomainInvariantError);
  });
});

test("G0-A2 dispute recovery rejects falsified completion snapshots", async (t) => {
  const cases = [
    ["event type", (completion) => { completion.type = "validation_decision_recorded"; }],
    ["schema", (completion) => { completion.payloadSchemaVersion = 3; }],
    ["scope", (completion) => { completion.payload.scope = "forged"; }],
    ["consolidation", (completion) => { completion.payload.consolidationId = "other"; }],
    ["causes", (completion) => { completion.causedByEventIds = ["E-FORGED"]; }],
    ["observed version", (completion) => { completion.observedStateVersion = 99; }],
    ["timestamp", (completion) => { completion.occurredAt = "2026-08-13T00:00:00.000Z"; }],
    ["changed", (completion) => { completion.payload.changed = false; }],
    ["new version", (completion) => { completion.payload.newStateVersion = 99; }],
    ["idempotency key", (completion) => { completion.idempotencyKey = "forged"; }],
  ];
  for (const [index, [name, mutate]] of cases.entries()) await t.test(name, async () => {
    const setup = await completedDispute(`K-DISPUTE-COM-${index}`); const forged = clone(setup.completion); mutate(forged);
    await assert.rejects(() => consolidateG0A2SelfHypothesisDispute(setup.request, persistenceWithEvents(setup.store, new Map([[setup.completion.id, forged]]))), DomainInvariantError);
  });
});

test("G0-A2 dispute discovers conceptual checkpoint and completion collisions before append", async () => {
  const checkpointSetup = await completedDispute("K-DISPUTE-CONCEPT-CP"); const forgedCheckpoint = clone(checkpointSetup.checkpoint);
  forgedCheckpoint.id = "E-WRONG-CHECKPOINT"; forgedCheckpoint.idempotencyKey = "wrong:checkpoint";
  await assert.rejects(() => consolidateG0A2SelfHypothesisDispute(checkpointSetup.request, persistenceWithEvents(checkpointSetup.store, new Map([[checkpointSetup.checkpoint.id, forgedCheckpoint]]), true)), DomainInvariantError);
  const completionSetup = await completedDispute("K-DISPUTE-CONCEPT-COM"); const forgedCompletion = clone(completionSetup.completion);
  forgedCompletion.id = "E-WRONG-COMPLETION"; forgedCompletion.idempotencyKey = "wrong:completion";
  await assert.rejects(() => consolidateG0A2SelfHypothesisDispute(completionSetup.request, persistenceWithEvents(completionSetup.store, new Map([[completionSetup.completion.id, forgedCompletion]]), true)), DomainInvariantError);
});

test("G0-A2 revision turns disputed v2 into active opposite v3", async () => {
  const lenoSeedId = "K-REV-MAIN"; const state = await setup(lenoSeedId);
  const r1 = await append(state.store, lenoSeedId, "R1", USE); const r2 = await append(state.store, lenoSeedId, "R2", USE); await materializeR(state.store, lenoSeedId, [r1, r2], "r12");
  const disputed = await consolidateG0A2SelfHypothesisDispute(disputeInput(lenoSeedId, state.initialEvents, [r1, r2]), state.store); const v2 = await state.store.readSelfHypothesis(lenoSeedId, disputed.selfHypothesisId);
  const r3 = await append(state.store, lenoSeedId, "R3", USE); await materializeR(state.store, lenoSeedId, [r3], "r3");
  const revised = await consolidateG0A2SelfHypothesisRevision(revisionInput(lenoSeedId, state.initialEvents, [r1, r2, r3]), state.store);
  assert.deepEqual({ outcome: revised.outcome, previous: revised.previousStateVersion, next: revised.newStateVersion }, { outcome: "revise", previous: 5, next: 6 });
  const history = await state.store.readSelfHypothesisHistoryByKey(lenoSeedId, state.v1.hypothesisKey); const [v1, prior, v3] = history;
  assert.deepEqual({ v1: v1.status, v2: prior.status, v3: v3.status, value: v3.proposition.value, confidence: v3.confidence, previous: v3.previousVersionId }, { v1: "superseded", v2: "superseded", v3: "active", value: "use_available_information", confidence: "moderate", previous: v2.id });
  assert.deepEqual(prior.supportLinkIds, v2.supportLinkIds); assert.deepEqual(prior.againstLinkIds, v2.againstLinkIds);
  const links = await Promise.all([...v3.supportLinkIds, ...v3.againstLinkIds].map((id) => state.store.readEvidenceLink(lenoSeedId, id))); assert.equal(links.length, 7); assert.ok(links.every((link) => link.targetId === v3.id)); assert.equal(v3.supportLinkIds.length, 4); assert.equal(v3.againstLinkIds.length, 3);
  const s5 = await selectG0A2S5Intention({ lenoSeedId, turnId: "REV-S5", humanSourceId: HUMAN, humanActorRef: "H-DISPUTE", systemSourceId: SYSTEM, text: "s5", occurredAt: "2026-08-13T13:00:00.000Z", engineVersion: ENGINE }, state.store); assert.deepEqual(s5.intention.triggerSelfHypothesisIds, [v3.id]); assert.equal(s5.intention.motivation, "apply_active_self_hypothesis_under_uncertainty");
});

test("G0-A2 revision mirrors orientation and keeps v2 disputed on no_change", async () => {
  const mirror = await setup("K-REV-MIRROR", [ASK, USE, USE, USE], "use_available_information"); const mr1 = await append(mirror.store, "K-REV-MIRROR", "R1", ASK); const mr2 = await append(mirror.store, "K-REV-MIRROR", "R2", ASK); await materializeR(mirror.store, "K-REV-MIRROR", [mr1, mr2], "r12"); await consolidateG0A2SelfHypothesisDispute(disputeInput("K-REV-MIRROR", mirror.initialEvents, [mr1, mr2]), mirror.store); const mr3 = await append(mirror.store, "K-REV-MIRROR", "R3", ASK); await materializeR(mirror.store, "K-REV-MIRROR", [mr3], "r3"); const revised = await consolidateG0A2SelfHypothesisRevision(revisionInput("K-REV-MIRROR", mirror.initialEvents, [mr1, mr2, mr3]), mirror.store); assert.equal((await mirror.store.readSelfHypothesis("K-REV-MIRROR", revised.selfHypothesisId))?.proposition.value, "seek_clarification");
  const no = await setup("K-REV-NO"); const r1 = await append(no.store, "K-REV-NO", "R1", USE); const r2 = await append(no.store, "K-REV-NO", "R2", USE); await materializeR(no.store, "K-REV-NO", [r1, r2], "r12"); const dispute = await consolidateG0A2SelfHypothesisDispute(disputeInput("K-REV-NO", no.initialEvents, [r1, r2]), no.store); const r3 = await append(no.store, "K-REV-NO", "R3", ASK); await materializeR(no.store, "K-REV-NO", [r3], "r3"); const unchanged = await consolidateG0A2SelfHypothesisRevision(revisionInput("K-REV-NO", no.initialEvents, [r1, r2, r3], "no-change"), no.store); assert.equal(unchanged.outcome, "no_change"); assert.equal(await no.store.getStateVersion("K-REV-NO"), 5); assert.equal((await no.store.readSelfHypothesis("K-REV-NO", dispute.selfHypothesisId))?.status, "disputed");
});

test("G0-A2 revision retains an S5 observation contaminated by v1", async () => {
  const lenoSeedId = "K-REV-S5"; const state = await setup(lenoSeedId); const old = await selectG0A2S5Intention({ lenoSeedId, turnId: "REV-OLD", humanSourceId: HUMAN, humanActorRef: "H-DISPUTE", systemSourceId: SYSTEM, text: "s5", occurredAt: "2026-08-13T11:00:00.000Z", engineVersion: ENGINE }, state.store); const s5 = (await state.store.readEventsByTurn(lenoSeedId, "REV-OLD")).find((event) => event.type === "intention_selected"); await materializeR(state.store, lenoSeedId, [s5], "s5"); const r1 = await append(state.store, lenoSeedId, "R1", USE); const r2 = await append(state.store, lenoSeedId, "R2", USE); await materializeR(state.store, lenoSeedId, [r1, r2], "r12"); await consolidateG0A2SelfHypothesisDispute(disputeInput(lenoSeedId, state.initialEvents, [s5, r1, r2]), state.store); const r3 = await append(state.store, lenoSeedId, "R3", USE); await materializeR(state.store, lenoSeedId, [r3], "r3"); await consolidateG0A2SelfHypothesisRevision(revisionInput(lenoSeedId, state.initialEvents, [s5, r1, r2, r3]), state.store); const checkpoint = (await state.store.readEventsInSequence(lenoSeedId)).find((event) => event.type === "validation_decision_recorded" && event.payload.consolidationId === "revision"); const link = checkpoint.payload.linkSnapshots.find((item) => item.independenceGroup === "g0a2:S5"); assert.deepEqual({ contamination: link.causalContamination, weight: link.weightClass, ignored: checkpoint.payload.ignoredContaminatedLinkIds.includes(link.id), trigger: old.intention.triggerSelfHypothesisIds.length }, { contamination: "influenced_by_target", weight: "low", ignored: true, trigger: 1 });
});

test("G0-A2 revision recovers before and after its atomic commit", async () => {
  for (const [lenoSeedId, mode] of [["K-REV-REC-BEFORE", "commit"], ["K-REV-REC-AFTER", "completion"]]) {
    const state = await setup(lenoSeedId); const r1 = await append(state.store, lenoSeedId, "R1", USE); const r2 = await append(state.store, lenoSeedId, "R2", USE); await materializeR(state.store, lenoSeedId, [r1, r2], "r12"); await consolidateG0A2SelfHypothesisDispute(disputeInput(lenoSeedId, state.initialEvents, [r1, r2]), state.store); const r3 = await append(state.store, lenoSeedId, "R3", USE); await materializeR(state.store, lenoSeedId, [r3], "r3"); const request = revisionInput(lenoSeedId, state.initialEvents, [r1, r2, r3]); let fail = true;
    const persistence = new Proxy(state.store, { get(target, property, receiver) { if (property === "atomicCommit" && mode === "commit") return async (...args) => { if (fail) { fail = false; throw new Error("commit failed"); } return target.atomicCommit(...args); }; if (property === "appendEvent" && mode === "completion") return async (event) => { if (fail && event.type === "state_commit_completed" && event.payload.consolidationId === "revision") { fail = false; throw new Error("completion failed"); } return target.appendEvent(event); }; const value = Reflect.get(target, property, receiver); return typeof value === "function" ? value.bind(target) : value; } });
    await assert.rejects(() => consolidateG0A2SelfHypothesisRevision(request, persistence)); assert.equal(await state.store.getStateVersion(lenoSeedId), mode === "commit" ? 5 : 6); const recovered = await consolidateG0A2SelfHypothesisRevision(request, persistence); assert.equal(recovered.outcome, "revise"); assert.equal(await state.store.getStateVersion(lenoSeedId), 6); assert.equal((await consolidateG0A2SelfHypothesisRevision(request, persistence)).replayed, true);
  }
});

test("G0-A2 revision recovery rejects falsified historical snapshots", async (t) => {
  for (const [index, [name, mutate]] of [
    ["candidate", (checkpoint) => { checkpoint.payload.candidateProposition.value = "seek_clarification"; }],
    ["hypothesis key", (checkpoint) => { checkpoint.payload.hypothesisKey = "forged"; }],
    ["dispute cause", (checkpoint) => { checkpoint.causedByEventIds[checkpoint.causedByEventIds.length - 1] = "E-FORGED"; }],
    ["missing link", (checkpoint) => { checkpoint.payload.linkSnapshots.pop(); }],
    ["v3 target", (checkpoint) => { checkpoint.payload.linkSnapshots[0].targetId = "SH-FORGED"; }],
    ["groups", (checkpoint) => { checkpoint.payload.countedSupportGroups = []; }],
    ["previous version", (checkpoint) => { checkpoint.payload.nextHypothesisSnapshot.previousVersionId = "SH-FORGED"; }],
  ].entries()) await t.test(name, async () => {
    const lenoSeedId = `K-REV-FORGE-${index}`; const state = await setup(lenoSeedId); const r1 = await append(state.store, lenoSeedId, "R1", USE); const r2 = await append(state.store, lenoSeedId, "R2", USE); await materializeR(state.store, lenoSeedId, [r1, r2], "r12"); await consolidateG0A2SelfHypothesisDispute(disputeInput(lenoSeedId, state.initialEvents, [r1, r2]), state.store); const r3 = await append(state.store, lenoSeedId, "R3", USE); await materializeR(state.store, lenoSeedId, [r3], "r3"); const request = revisionInput(lenoSeedId, state.initialEvents, [r1, r2, r3]); await consolidateG0A2SelfHypothesisRevision(request, state.store); const checkpoint = (await state.store.readEventsInSequence(lenoSeedId)).find((event) => event.type === "validation_decision_recorded" && event.payload.consolidationId === "revision"); const forged = clone(checkpoint); mutate(forged); await assert.rejects(() => consolidateG0A2SelfHypothesisRevision(request, persistenceWithEvents(state.store, new Map([[checkpoint.id, forged]]))), DomainInvariantError);
  });
});

test("G0-A2 revision rejects falsified dispute predecessor boundaries before v3 checkpoint", async (t) => {
  const cases = [
    ["candidate proposition", ({ checkpoint }) => { checkpoint.payload.candidateProposition.value = "use_available_information"; }],
    ["hypothesis key", ({ checkpoint }) => { checkpoint.payload.hypothesisKey = "forged-key"; }],
    ["v2 previous version", ({ checkpoint }) => { checkpoint.payload.nextHypothesisSnapshot.previousVersionId = "SH-FORGED"; }],
    ["link target", ({ checkpoint }) => { checkpoint.payload.linkSnapshots[0].targetId = "SH-FORGED"; }],
    ["contamination", ({ checkpoint }) => { checkpoint.payload.linkSnapshots[0].causalContamination = "influenced_by_target"; checkpoint.payload.linkSnapshots[0].weightClass = "low"; }],
    ["formation cause", ({ checkpoint }) => { checkpoint.causedByEventIds[checkpoint.causedByEventIds.length - 1] = "E-FORGED-FORMATION"; }],
    ["checkpoint timestamp", ({ checkpoint }) => { checkpoint.occurredAt = "2026-08-13T00:00:00.000Z"; }],
    ["completion scope", ({ completion }) => { completion.payload.scope = "forged"; }],
    ["completion observed state version", ({ completion }) => { completion.observedStateVersion = 99; }],
    ["completion changed and new state version", ({ completion }) => { completion.payload.changed = false; completion.payload.newStateVersion = 99; }],
  ];
  for (const [index, [name, mutate]] of cases.entries()) await t.test(name, async () => {
    const lenoSeedId = `K-REV-PREDECESSOR-${index}`; const state = await setup(lenoSeedId);
    const r1 = await append(state.store, lenoSeedId, "R1", USE); const r2 = await append(state.store, lenoSeedId, "R2", USE); await materializeR(state.store, lenoSeedId, [r1, r2], "r12");
    await consolidateG0A2SelfHypothesisDispute(disputeInput(lenoSeedId, state.initialEvents, [r1, r2]), state.store);
    const r3 = await append(state.store, lenoSeedId, "R3", USE); await materializeR(state.store, lenoSeedId, [r3], "r3");
    const events = await state.store.readEventsInSequence(lenoSeedId);
    const checkpoint = clone(events.find((event) => event.type === "validation_decision_recorded" && event.payload.consolidationId === "dispute"));
    const completion = clone(events.find((event) => event.type === "state_commit_completed" && event.payload.consolidationId === "dispute"));
    mutate({ checkpoint, completion });
    await assert.rejects(() => consolidateG0A2SelfHypothesisRevision(
      revisionInput(lenoSeedId, state.initialEvents, [r1, r2, r3]),
      persistenceWithEvents(state.store, new Map([[checkpoint.id, checkpoint], [completion.id, completion]])),
    ), DomainInvariantError);
    assert.equal(await state.store.getStateVersion(lenoSeedId), 5);
    assert.equal((await state.store.readEventsInSequence(lenoSeedId)).filter((event) => event.type === "validation_decision_recorded" && event.payload.consolidationId === "revision").length, 0);
  });
});

test("G0-A2 revision rejects a falsified durable dispute EvidenceLink before v3 checkpoint", async () => {
  const lenoSeedId = "K-REV-DURABLE-LINK"; const state = await setup(lenoSeedId);
  const r1 = await append(state.store, lenoSeedId, "R1", USE); const r2 = await append(state.store, lenoSeedId, "R2", USE); await materializeR(state.store, lenoSeedId, [r1, r2], "r12");
  const dispute = await consolidateG0A2SelfHypothesisDispute(disputeInput(lenoSeedId, state.initialEvents, [r1, r2]), state.store);
  const v2 = await state.store.readSelfHypothesis(lenoSeedId, dispute.selfHypothesisId); assert.ok(v2);
  const r3 = await append(state.store, lenoSeedId, "R3", USE); await materializeR(state.store, lenoSeedId, [r3], "r3");
  const forgedLinkId = v2.supportLinkIds[0]; assert.ok(forgedLinkId);
  const persistence = persistenceWithForgedEvidenceLink(state.store, forgedLinkId, (link) => ({ ...link, targetId: "SH-FORGED" }));
  await assert.rejects(() => consolidateG0A2SelfHypothesisRevision(revisionInput(lenoSeedId, state.initialEvents, [r1, r2, r3]), persistence), DomainInvariantError);
  assert.equal(await state.store.getStateVersion(lenoSeedId), 5);
  assert.equal((await state.store.readEventsInSequence(lenoSeedId)).filter((event) => event.type === "validation_decision_recorded" && event.payload.consolidationId === "revision").length, 0);
});
