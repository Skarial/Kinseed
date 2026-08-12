import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { validateEvidenceItem } from "../../dist/application/validate-evidence.js";
import { DomainInvariantError, IdempotencyConflictError } from "../../dist/domain/errors.js";
import { buildSelfHypothesisKey } from "../../dist/domain/self-hypothesis.js";

const kinseedId = "K-G0A2-001";
const systemSourceId = "SRC-G0A2-SYSTEM";
const occurredAt = "2026-08-12T09:00:00.000Z";

function selfProposition(value = "seek_clarification") {
  return {
    subjectRef: kinseedId,
    predicate: "decision_style_under_uncertainty",
    value,
    context: { protocol: "G0-A2" },
  };
}

function observationProposition(situationId = "S1", value = "seek_clarification") {
  return {
    subjectRef: kinseedId,
    predicate: "selected_decision_style_under_uncertainty",
    value,
    context: { protocol: "G0-A2", situationId },
  };
}

function event(overrides) {
  return {
    id: overrides.id,
    kinseedId: overrides.kinseedId ?? kinseedId,
    sequence: overrides.sequence,
    type: overrides.type,
    occurredAt: overrides.occurredAt ?? occurredAt,
    turnId: overrides.turnId ?? null,
    sourceId: overrides.sourceId ?? systemSourceId,
    actorRef: null,
    causedByEventIds: [],
    observedStateVersion: 0,
    payload: overrides.payload ?? {},
    payloadSchemaVersion: overrides.payloadSchemaVersion ?? 1,
    engineVersion: "g0a2-domain-test",
    idempotencyKey: overrides.idempotencyKey ?? overrides.id,
  };
}

async function createStore() {
  const store = new InMemoryStore();
  await store.registerSource({
    id: systemSourceId,
    kind: "system",
    actorRef: null,
    channel: "internal",
    createdAt: occurredAt,
  });
  await store.appendEvent(event({
    id: "E-CREATED",
    sequence: 1,
    type: "kinseed_created",
    payload: { generation: 0 },
  }));
  return store;
}

async function appendIntention(store, overrides = {}) {
  const source = event({
    id: overrides.id ?? "E-S1",
    sequence: overrides.sequence ?? 2,
    type: overrides.type ?? "intention_selected",
    occurredAt: overrides.occurredAt ?? occurredAt,
    payloadSchemaVersion: overrides.payloadSchemaVersion ?? 2,
    payload: overrides.payload ?? {
      intentionId: "I-S1",
      kind: "ask_clarification",
      motivation: "controlled_historical_fixture",
      situationId: "S1",
      triggerSelfHypothesisIds: [],
    },
  });
  await store.appendEvent(source);
  return source;
}

function observation(sourceEvent, overrides = {}) {
  const situationId = overrides.situationId ?? sourceEvent.payload.situationId;
  const value = overrides.value ?? "seek_clarification";
  return {
    id: overrides.id ?? `EV-${sourceEvent.id}`,
    kinseedId: overrides.kinseedId ?? kinseedId,
    kind: "behavioral_observation",
    proposition: overrides.proposition ?? observationProposition(situationId, value),
    sourceId: overrides.sourceId ?? systemSourceId,
    eventIds: overrides.eventIds ?? [sourceEvent.id],
    grounding: overrides.grounding ?? { kind: "structured_event", eventId: sourceEvent.id },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "kinseed-g0a2-behavioral-observation-v1",
    createdAt: overrides.createdAt ?? sourceEvent.occurredAt,
  };
}

function hypothesis(id, proposition = selfProposition(), overrides = {}) {
  return {
    id,
    kinseedId,
    hypothesisKey: overrides.hypothesisKey ?? buildSelfHypothesisKey(proposition),
    version: overrides.version ?? 1,
    proposition,
    stage: "hypothesis",
    supportLinkIds: overrides.supportLinkIds ?? [],
    againstLinkIds: overrides.againstLinkIds ?? [],
    confidence: overrides.confidence ?? "moderate",
    status: overrides.status ?? "active",
    previousVersionId: overrides.previousVersionId ?? null,
    createdAt: overrides.createdAt ?? occurredAt,
    updatedAt: overrides.updatedAt ?? occurredAt,
  };
}

function selfLink(id, evidenceItemId, targetId, relation = "supports") {
  return {
    id,
    kinseedId,
    evidenceItemId,
    targetType: "self_hypothesis",
    targetId,
    relation,
    sourceAuthority: "high",
    independenceGroup: "g0a2:S1",
    causalContamination: "none",
    weightClass: "high",
    createdAt: occurredAt,
  };
}

function mutations(overrides = {}) {
  return {
    evidenceItems: overrides.evidenceItems ?? [],
    evidenceLinks: overrides.evidenceLinks ?? [],
    beliefs: overrides.beliefs ?? [],
    selfHypotheses: overrides.selfHypotheses ?? [],
  };
}

test("G0-A2: logical keys exclude value and order context", () => {
  const left = {
    subjectRef: kinseedId,
    predicate: "decision_style_under_uncertainty",
    value: "seek_clarification",
    context: { protocol: "G0-A2", scope: "test" },
  };
  const right = {
    subjectRef: kinseedId,
    predicate: "decision_style_under_uncertainty",
    value: "use_available_information",
    context: { scope: "test", protocol: "G0-A2" },
  };
  assert.equal(buildSelfHypothesisKey(left), buildSelfHypothesisKey(right));
});

test("G0-A2: behavioral observation validation accepts the schema-v2 source", async () => {
  const store = await createStore();
  const source = await appendIntention(store);
  await assert.doesNotReject(() => validateEvidenceItem(observation(source), store));
});

test("G0-A2: behavioral observation rejects invalid source, payload, mapping and grounding", async (t) => {
  await t.test("wrong event type", async () => {
    const store = await createStore();
    const source = await appendIntention(store, { type: "kinseed_message_emitted" });
    await assert.rejects(() => validateEvidenceItem(observation(source), store), DomainInvariantError);
  });
  await t.test("wrong payload schema", async () => {
    const store = await createStore();
    const source = await appendIntention(store, { payloadSchemaVersion: 1 });
    await assert.rejects(() => validateEvidenceItem(observation(source), store), DomainInvariantError);
  });
  await t.test("wrong intention to proposition mapping", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    await assert.rejects(
      () => validateEvidenceItem(observation(source, { value: "use_available_information" }), store),
      DomainInvariantError,
    );
  });
  await t.test("wrong situation", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    await assert.rejects(
      () => validateEvidenceItem(observation(source, { situationId: "S2" }), store),
      DomainInvariantError,
    );
  });
  await t.test("text grounding", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    await assert.rejects(
      () => validateEvidenceItem(observation(source, {
        grounding: { kind: "text_excerpt", eventId: source.id, supportingExcerpt: "ask" },
      }), store),
      DomainInvariantError,
    );
  });
  await t.test("createdAt differs from source", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    await assert.rejects(
      () => validateEvidenceItem(observation(source, { createdAt: "2026-08-12T09:01:00.000Z" }), store),
      DomainInvariantError,
    );
  });
});

test("G0-A2: testimony rejects structured grounding", async () => {
  const store = await createStore();
  const source = event({
    id: "E-HUMAN",
    sequence: 2,
    type: "human_message_received",
    sourceId: systemSourceId,
    payload: { text: "2022" },
  });
  await store.appendEvent(source);
  await assert.rejects(
    () => validateEvidenceItem({
      id: "EV-TEXT-WRONG",
      kinseedId,
      kind: "testimony",
      proposition: { subjectRef: "H-001", predicate: "employment_start_year", value: 2022, context: {} },
      sourceId: systemSourceId,
      eventIds: [source.id],
      grounding: { kind: "structured_event", eventId: source.id },
      extractionConfidence: "high",
      status: "active",
      supersedesId: null,
      extractorVersion: "test",
      createdAt: occurredAt,
    }, store),
    DomainInvariantError,
  );
});

test("G0-A2: store validates behavioral observations and deterministic createdAt", async () => {
  const store = await createStore();
  const source = await appendIntention(store);
  const valid = observation(source);
  await store.atomicCommit(kinseedId, 0, mutations({ evidenceItems: [valid] }), "OBS:valid");
  assert.equal((await store.readEvidenceItem(kinseedId, valid.id))?.createdAt, source.occurredAt);

  const invalidStore = await createStore();
  const invalidSource = await appendIntention(invalidStore);
  await assert.rejects(
    () => invalidStore.atomicCommit(
      kinseedId,
      0,
      mutations({ evidenceItems: [observation(invalidSource, { createdAt: "2026-08-12T09:01:00.000Z" })] }),
      "OBS:bad-created-at",
    ),
    DomainInvariantError,
  );
  assert.equal(await invalidStore.getStateVersion(kinseedId), 0);
});

test("G0-A2: EvidenceLink accepts a belief target with the generalized fields", async () => {
  const store = await createStore();
  const belief = {
    id: "B-1", kinseedId, beliefKey: "belief-key", version: 1,
    proposition: { subjectRef: "H-1", predicate: "fact", value: "value", context: {} },
    status: "active", confidence: "high", evidenceForLinkIds: ["EL-BELIEF"], evidenceAgainstLinkIds: [],
    previousVersionId: null, createdAt: occurredAt, updatedAt: occurredAt,
  };
  const evidence = {
    id: "EV-SYSTEM", kinseedId, kind: "system_record", proposition: belief.proposition,
    sourceId: systemSourceId, eventIds: ["E-CREATED"], grounding: null, extractionConfidence: "high",
    status: "active", supersedesId: null, extractorVersion: "test", createdAt: occurredAt,
  };
  const link = {
    id: "EL-BELIEF", kinseedId, evidenceItemId: evidence.id, targetType: "belief", targetId: belief.id,
    relation: "supports", sourceAuthority: "high", independenceGroup: "system", causalContamination: "none",
    weightClass: "high", createdAt: occurredAt,
  };
  await assert.doesNotReject(() => store.atomicCommit(
    kinseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], beliefs: [belief] }), "BELIEF:link",
  ));
});

test("G0-A2: EvidenceLink and SelfHypothesis provenance invariants are enforced", async (t) => {
  await t.test("valid self hypothesis link", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    const evidence = observation(source);
    const value = hypothesis("SH-1", selfProposition(), { supportLinkIds: ["EL-SH-1"] });
    const link = selfLink("EL-SH-1", evidence.id, value.id);
    await assert.doesNotReject(() => store.atomicCommit(
      kinseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [value] }), "SH:link",
    ));
  });
  await t.test("link targets wrong type", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    const evidence = observation(source);
    const value = hypothesis("SH-1");
    const link = selfLink("EL-SH-1", evidence.id, value.id);
    link.targetType = "belief";
    await assert.rejects(() => store.atomicCommit(
      kinseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [value] }), "SH:wrong-type",
    ), DomainInvariantError);
  });
  await t.test("support link targets another hypothesis", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    const evidence = observation(source);
    const first = hypothesis("SH-1", selfProposition(), { status: "superseded" });
    const second = hypothesis("SH-2", selfProposition(), {
      version: 2, previousVersionId: first.id, supportLinkIds: ["EL-SH-1"],
    });
    const link = selfLink("EL-SH-1", evidence.id, first.id);
    await assert.rejects(() => store.atomicCommit(
      kinseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [first, second] }), "SH:wrong-support",
    ), DomainInvariantError);
  });
  await t.test("against link has a support relation", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    const evidence = observation(source);
    const value = hypothesis("SH-1", selfProposition(), { againstLinkIds: ["EL-SH-1"] });
    const link = selfLink("EL-SH-1", evidence.id, value.id, "supports");
    await assert.rejects(() => store.atomicCommit(
      kinseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [value] }), "SH:wrong-against",
    ), DomainInvariantError);
  });
});

test("G0-A2: hypotheses persist, sort by version, and expose only active state", async () => {
  const store = await createStore();
  const key = buildSelfHypothesisKey(selfProposition());
  const first = hypothesis("SH-1", selfProposition(), { status: "superseded" });
  const second = hypothesis("SH-2", selfProposition("use_available_information"), {
    version: 2, previousVersionId: first.id,
  });
  await store.atomicCommit(
    kinseedId, 0, mutations({ selfHypotheses: [second, first] }), "SH:history",
  );
  assert.equal((await store.readSelfHypothesis(kinseedId, second.id))?.id, second.id);
  assert.deepEqual(
    (await store.readSelfHypothesisHistoryByKey(kinseedId, key)).map((item) => item.id),
    [first.id, second.id],
  );
  assert.equal((await store.readActiveSelfHypothesisByKey(kinseedId, key))?.id, second.id);

  const disputedStore = await createStore();
  const disputed = hypothesis("SH-DISPUTED", selfProposition(), { status: "disputed" });
  await disputedStore.atomicCommit(kinseedId, 0, mutations({ selfHypotheses: [disputed] }), "SH:disputed");
  assert.equal(await disputedStore.readActiveSelfHypothesisByKey(kinseedId, key), null);
});

test("G0-A2: duplicate current hypotheses and invalid atomic mutations are rejected", async () => {
  const store = await createStore();
  const first = hypothesis("SH-1", selfProposition());
  const second = hypothesis("SH-2", selfProposition("use_available_information"), {
    version: 2, previousVersionId: first.id,
  });
  await assert.rejects(
    () => store.atomicCommit(kinseedId, 0, mutations({ selfHypotheses: [first, second] }), "SH:two-active"),
    DomainInvariantError,
  );
  assert.equal(await store.getStateVersion(kinseedId), 0);
  assert.equal(await store.readSelfHypothesis(kinseedId, first.id), null);
});

test("G0-A2: SelfHypothesis commits are idempotent and reject a different fingerprint", async () => {
  const store = await createStore();
  const value = hypothesis("SH-1");
  const original = mutations({ selfHypotheses: [value] });
  const first = await store.atomicCommit(kinseedId, 0, original, "SH:retry");
  const retry = await store.atomicCommit(kinseedId, 0, original, "SH:retry");
  assert.deepEqual(retry, first);
  assert.equal(await store.getStateVersion(kinseedId), 1);

  await assert.rejects(
    () => store.atomicCommit(
      kinseedId,
      0,
      mutations({ selfHypotheses: [{ ...value, updatedAt: "2026-08-12T09:01:00.000Z" }] }),
      "SH:retry",
    ),
    IdempotencyConflictError,
  );
});
