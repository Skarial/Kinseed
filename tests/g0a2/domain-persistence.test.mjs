import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { validateEvidenceItem } from "../../dist/application/validate-evidence.js";
import { DomainInvariantError, IdempotencyConflictError } from "../../dist/domain/errors.js";
import { buildSelfHypothesisKey } from "../../dist/domain/self-hypothesis.js";

const lenoseedId = "K-G0A2-001";
const systemSourceId = "SRC-G0A2-SYSTEM";
const occurredAt = "2026-08-12T09:00:00.000Z";

function selfProposition(value = "seek_clarification") {
  return {
    subjectRef: lenoseedId,
    predicate: "decision_style_under_uncertainty",
    value,
    context: { protocol: "G0-A2" },
  };
}

function observationProposition(situationId = "S1", value = "seek_clarification") {
  return {
    subjectRef: lenoseedId,
    predicate: "selected_decision_style_under_uncertainty",
    value,
    context: { protocol: "G0-A2", situationId },
  };
}

function event(overrides) {
  return {
    id: overrides.id,
    lenoseedId: overrides.lenoseedId ?? lenoseedId,
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
  await registerSource(store, systemSourceId, "system");
  await store.appendEvent(event({
    id: "E-CREATED",
    sequence: 1,
    type: "lenoseed_created",
    payload: { generation: 0 },
  }));
  return store;
}

async function registerSource(store, id, kind) {
  await store.registerSource({
    id,
    kind,
    actorRef: kind === "human" ? "H-G0A2-001" : null,
    channel: "internal",
    createdAt: occurredAt,
  });
}

async function appendIntention(store, overrides = {}) {
  const source = event({
    id: overrides.id ?? "E-S1",
    sequence: overrides.sequence ?? 2,
    type: overrides.type ?? "intention_selected",
    sourceId: overrides.sourceId ?? systemSourceId,
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
    lenoseedId: overrides.lenoseedId ?? lenoseedId,
    kind: "behavioral_observation",
    proposition: overrides.proposition ?? observationProposition(situationId, value),
    sourceId: overrides.sourceId ?? systemSourceId,
    eventIds: overrides.eventIds ?? [sourceEvent.id],
    grounding: overrides.grounding ?? { kind: "structured_event", eventId: sourceEvent.id },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "lenoseed-g0a2-behavioral-observation-v1",
    createdAt: overrides.createdAt ?? sourceEvent.occurredAt,
  };
}

function hypothesis(id, proposition = selfProposition(), overrides = {}) {
  return {
    id,
    lenoseedId,
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
    lenoseedId,
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
    memories: overrides.memories ?? [],
  };
}

async function activeHypothesisFoundation(label) {
  const store = await createStore();
  const targetId = `SH-${label}`;
  const evidenceItems = [];
  const evidenceLinks = [];
  for (let index = 0; index < 4; index += 1) {
    const situationId = `S${index + 1}`;
    const supports = index < 3;
    const source = await appendIntention(store, {
      id: `E-${label}-${situationId}`,
      sequence: index + 2,
      occurredAt: `2026-08-12T09:00:0${index + 1}.000Z`,
      payload: {
        intentionId: `I-${label}-${situationId}`,
        kind: supports ? "ask_clarification" : "respond_with_available_information_under_uncertainty",
        motivation: "controlled_historical_fixture",
        situationId,
        triggerSelfHypothesisIds: [],
      },
    });
    const evidence = observation(source, {
      id: `EV-${label}-${situationId}`,
      value: supports ? "seek_clarification" : "use_available_information",
    });
    const relation = supports ? "supports" : "contradicts";
    const link = {
      id: `EL-${label}-${situationId}`,
      lenoseedId,
      evidenceItemId: evidence.id,
      targetType: "self_hypothesis",
      targetId,
      relation,
      sourceAuthority: "high",
      independenceGroup: `g0a2:${situationId}`,
      causalContamination: "none",
      weightClass: "high",
      createdAt: source.occurredAt,
    };
    evidenceItems.push(evidence);
    evidenceLinks.push(link);
  }
  const target = hypothesis(targetId, selfProposition(), {
    supportLinkIds: evidenceLinks.filter((link) => link.relation === "supports").map((link) => link.id),
    againstLinkIds: evidenceLinks.filter((link) => link.relation === "contradicts").map((link) => link.id),
    createdAt: "2026-08-12T09:00:04.000Z",
    updatedAt: "2026-08-12T09:00:04.000Z",
  });
  await store.atomicCommit(
    lenoseedId,
    0,
    mutations({ evidenceItems, evidenceLinks, selfHypotheses: [target] }),
    `SH:${label}:foundation`,
  );
  return { store, target };
}

async function triggeredObservation(store, label, triggerSelfHypothesisIds, situationId = "R1") {
  const source = await appendIntention(store, {
    id: `E-${label}-${situationId}`,
    sequence: 6,
    occurredAt: "2026-08-12T09:00:05.000Z",
    payload: {
      intentionId: `I-${label}-${situationId}`,
      kind: "ask_clarification",
      motivation: "hypothesis_influenced_decision",
      situationId,
      triggerSelfHypothesisIds,
    },
  });
  return { source, evidence: observation(source, { id: `EV-${label}-${situationId}` }) };
}

function triggeredLink(label, source, evidence, target, overrides = {}) {
  return {
    id: `EL-${label}-${source.payload.situationId}`,
    lenoseedId,
    evidenceItemId: evidence.id,
    targetType: "self_hypothesis",
    targetId: target.id,
    relation: evidence.proposition.value === target.proposition.value ? "supports" : "contradicts",
    sourceAuthority: "high",
    independenceGroup: `g0a2:${source.payload.situationId}`,
    causalContamination: overrides.causalContamination ?? "influenced_by_target",
    weightClass: overrides.weightClass ?? "low",
    createdAt: source.occurredAt,
  };
}

test("G0-A2: logical keys exclude value and order context", () => {
  const left = {
    subjectRef: lenoseedId,
    predicate: "decision_style_under_uncertainty",
    value: "seek_clarification",
    context: { protocol: "G0-A2", scope: "test" },
  };
  const right = {
    subjectRef: lenoseedId,
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
    const source = await appendIntention(store, { type: "lenoseed_message_emitted" });
    await assert.rejects(() => validateEvidenceItem(observation(source), store), DomainInvariantError);
  });
  await t.test("wrong payload schema", async () => {
    const store = await createStore();
    const source = await appendIntention(store, { payloadSchemaVersion: 1 });
    await assert.rejects(() => validateEvidenceItem(observation(source), store), DomainInvariantError);
  });
  await t.test("missing intentionId", async () => {
    const store = await createStore();
    const source = await appendIntention(store, {
      payload: {
        kind: "ask_clarification",
        motivation: "controlled_historical_fixture",
        situationId: "S1",
        triggerSelfHypothesisIds: [],
      },
    });
    await assert.rejects(() => validateEvidenceItem(observation(source), store), DomainInvariantError);
  });
  await t.test("missing motivation", async () => {
    const store = await createStore();
    const source = await appendIntention(store, {
      payload: {
        intentionId: "I-S1",
        kind: "ask_clarification",
        situationId: "S1",
        triggerSelfHypothesisIds: [],
      },
    });
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
  await t.test("proposition subjectRef differs from Lenoseed", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    await assert.rejects(
      () => validateEvidenceItem(observation(source, {
        proposition: {
          ...observationProposition(),
          subjectRef: "K-G0A2-OTHER",
        },
      }), store),
      DomainInvariantError,
    );
  });
});

test("G0-A2: behavioral observations require a system source", async (t) => {
  await t.test("human source is rejected by validation and the store", async () => {
    const store = await createStore();
    const sourceId = "SRC-G0A2-HUMAN";
    await registerSource(store, sourceId, "human");
    const source = await appendIntention(store, { id: "E-HUMAN-S1", sourceId });
    const candidate = observation(source, { sourceId });
    await assert.rejects(() => validateEvidenceItem(candidate, store), DomainInvariantError);
    await assert.rejects(
      () => store.atomicCommit(lenoseedId, 0, mutations({ evidenceItems: [candidate] }), "OBS:human"),
      DomainInvariantError,
    );
  });
  await t.test("llm source is rejected", async () => {
    const store = await createStore();
    const sourceId = "SRC-G0A2-LLM";
    await registerSource(store, sourceId, "llm");
    const source = await appendIntention(store, { id: "E-LLM-S1", sourceId });
    await assert.rejects(
      () => validateEvidenceItem(observation(source, { sourceId }), store),
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
      lenoseedId,
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
  await store.atomicCommit(lenoseedId, 0, mutations({ evidenceItems: [valid] }), "OBS:valid");
  assert.equal((await store.readEvidenceItem(lenoseedId, valid.id))?.createdAt, source.occurredAt);

  const invalidStore = await createStore();
  const invalidSource = await appendIntention(invalidStore);
  await assert.rejects(
    () => invalidStore.atomicCommit(
      lenoseedId,
      0,
      mutations({ evidenceItems: [observation(invalidSource, { createdAt: "2026-08-12T09:01:00.000Z" })] }),
      "OBS:bad-created-at",
    ),
    DomainInvariantError,
  );
  assert.equal(await invalidStore.getStateVersion(lenoseedId), 0);
});

test("G0-A2: EvidenceLink accepts a belief target with the generalized fields", async () => {
  const store = await createStore();
  const belief = {
    id: "B-1", lenoseedId, beliefKey: "belief-key", version: 1,
    proposition: { subjectRef: "H-1", predicate: "fact", value: "value", context: {} },
    status: "active", confidence: "high", evidenceForLinkIds: ["EL-BELIEF"], evidenceAgainstLinkIds: [],
    previousVersionId: null, createdAt: occurredAt, updatedAt: occurredAt,
  };
  const evidence = {
    id: "EV-SYSTEM", lenoseedId, kind: "system_record", proposition: belief.proposition,
    sourceId: systemSourceId, eventIds: ["E-CREATED"], grounding: null, extractionConfidence: "high",
    status: "active", supersedesId: null, extractorVersion: "test", createdAt: occurredAt,
  };
  const link = {
    id: "EL-BELIEF", lenoseedId, evidenceItemId: evidence.id, targetType: "belief", targetId: belief.id,
    relation: "supports", sourceAuthority: "high", independenceGroup: "system", causalContamination: "none",
    weightClass: "high", createdAt: occurredAt,
  };
  await assert.doesNotReject(() => store.atomicCommit(
    lenoseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], beliefs: [belief] }), "BELIEF:link",
  ));
});

test("G0-A2: EvidenceLink and SelfHypothesis provenance invariants are enforced", async (t) => {
  await t.test("valid self hypothesis link", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    const evidence = observation(source);
    const value = hypothesis("SH-1", selfProposition(), { status: "disputed", confidence: "low", supportLinkIds: ["EL-SH-1"] });
    const link = selfLink("EL-SH-1", evidence.id, value.id);
    await assert.doesNotReject(() => store.atomicCommit(
      lenoseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [value] }), "SH:link",
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
      lenoseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [value] }), "SH:wrong-type",
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
      lenoseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [first, second] }), "SH:wrong-support",
    ), DomainInvariantError);
  });
  await t.test("against link has a support relation", async () => {
    const store = await createStore();
    const source = await appendIntention(store);
    const evidence = observation(source);
    const value = hypothesis("SH-1", selfProposition(), { againstLinkIds: ["EL-SH-1"] });
    const link = selfLink("EL-SH-1", evidence.id, value.id, "supports");
    await assert.rejects(() => store.atomicCommit(
      lenoseedId, 0, mutations({ evidenceItems: [evidence], evidenceLinks: [link], selfHypotheses: [value] }), "SH:wrong-against",
    ), DomainInvariantError);
  });
});

test("G0-A2: EvidenceLink contamination is derived from intention provenance", async (t) => {
  await t.test("same-key trigger rejects contamination none", async () => {
    const { store, target } = await activeHypothesisFoundation("CONTAM-NONE");
    const { source, evidence } = await triggeredObservation(store, "CONTAM-NONE", [target.id]);
    const link = triggeredLink("CONTAM-NONE", source, evidence, target, {
      causalContamination: "none",
      weightClass: "high",
    });
    await assert.rejects(
      () => store.atomicCommit(
        lenoseedId,
        1,
        mutations({ evidenceItems: [evidence], evidenceLinks: [link] }),
        "SH:contamination:none",
      ),
      DomainInvariantError,
    );
  });

  await t.test("same-key trigger rejects high contaminated weight", async () => {
    const { store, target } = await activeHypothesisFoundation("CONTAM-HIGH");
    const { source, evidence } = await triggeredObservation(store, "CONTAM-HIGH", [target.id]);
    const link = triggeredLink("CONTAM-HIGH", source, evidence, target, { weightClass: "high" });
    await assert.rejects(
      () => store.atomicCommit(
        lenoseedId,
        1,
        mutations({ evidenceItems: [evidence], evidenceLinks: [link] }),
        "SH:contamination:high",
      ),
      DomainInvariantError,
    );
  });

  await t.test("same-key trigger accepts influenced low-weight audit link", async () => {
    const { store, target } = await activeHypothesisFoundation("CONTAM-LOW");
    const { source, evidence } = await triggeredObservation(store, "CONTAM-LOW", [target.id]);
    const link = triggeredLink("CONTAM-LOW", source, evidence, target);
    await assert.doesNotReject(() => store.atomicCommit(
      lenoseedId,
      1,
      mutations({ evidenceItems: [evidence], evidenceLinks: [link] }),
      "SH:contamination:low",
    ));
  });

  await t.test("different-key trigger requires contamination none", async () => {
    const { store, target: trigger } = await activeHypothesisFoundation("CONTAM-OTHER");
    const otherProposition = {
      ...selfProposition(),
      context: { protocol: "G0-A2", dimension: "other" },
    };
    const target = hypothesis("SH-CONTAM-OTHER-TARGET", otherProposition, {
      status: "disputed",
      confidence: "low",
    });
    await store.atomicCommit(
      lenoseedId,
      1,
      mutations({ selfHypotheses: [target] }),
      "SH:contamination:other-target",
    );
    const { source, evidence } = await triggeredObservation(store, "CONTAM-OTHER", [trigger.id]);
    const link = triggeredLink("CONTAM-OTHER", source, evidence, target, {
      causalContamination: "none",
      weightClass: "high",
    });
    await assert.doesNotReject(() => store.atomicCommit(
      lenoseedId,
      2,
      mutations({ evidenceItems: [evidence], evidenceLinks: [link] }),
      "SH:contamination:other-key",
    ));
  });

  await t.test("unknown trigger hypothesis is rejected", async () => {
    const { store, target } = await activeHypothesisFoundation("CONTAM-UNKNOWN");
    const { source, evidence } = await triggeredObservation(store, "CONTAM-UNKNOWN", ["SH-UNKNOWN"]);
    const link = triggeredLink("CONTAM-UNKNOWN", source, evidence, target, {
      causalContamination: "none",
      weightClass: "high",
    });
    await assert.rejects(
      () => store.atomicCommit(
        lenoseedId,
        1,
        mutations({ evidenceItems: [evidence], evidenceLinks: [link] }),
        "SH:contamination:unknown",
      ),
      DomainInvariantError,
    );
  });
});

test("G0-A2: hypotheses persist, sort by version, and omit disputed state from active reads", async () => {
  const store = await createStore();
  const key = buildSelfHypothesisKey(selfProposition());
  const first = hypothesis("SH-1", selfProposition(), { status: "superseded" });
  const second = hypothesis("SH-2", selfProposition("use_available_information"), {
    version: 2, previousVersionId: first.id, status: "disputed", confidence: "low",
  });
  await store.atomicCommit(
    lenoseedId, 0, mutations({ selfHypotheses: [second, first] }), "SH:history",
  );
  assert.equal((await store.readSelfHypothesis(lenoseedId, second.id))?.id, second.id);
  assert.deepEqual(
    (await store.readSelfHypothesisHistoryByKey(lenoseedId, key)).map((item) => item.id),
    [first.id, second.id],
  );
  assert.equal(await store.readActiveSelfHypothesisByKey(lenoseedId, key), null);

  const disputedStore = await createStore();
  const disputed = hypothesis("SH-DISPUTED", selfProposition(), { status: "disputed", confidence: "low" });
  await disputedStore.atomicCommit(lenoseedId, 0, mutations({ selfHypotheses: [disputed] }), "SH:disputed");
  assert.equal(await disputedStore.readActiveSelfHypothesisByKey(lenoseedId, key), null);
});

test("G0-A2: duplicate current hypotheses and invalid atomic mutations are rejected", async () => {
  const store = await createStore();
  const first = hypothesis("SH-1", selfProposition());
  const second = hypothesis("SH-2", selfProposition("use_available_information"), {
    version: 2, previousVersionId: first.id,
  });
  await assert.rejects(
    () => store.atomicCommit(lenoseedId, 0, mutations({ selfHypotheses: [first, second] }), "SH:two-active"),
    DomainInvariantError,
  );
  assert.equal(await store.getStateVersion(lenoseedId), 0);
  assert.equal(await store.readSelfHypothesis(lenoseedId, first.id), null);
});

test("G0-A2: SelfHypothesis histories are linear and current only at the latest version", async (t) => {
  await t.test("duplicate version is rejected", async () => {
    const store = await createStore();
    const first = hypothesis("SH-1", selfProposition(), { status: "superseded" });
    const secondA = hypothesis("SH-2A", selfProposition("use_available_information"), {
      version: 2, previousVersionId: first.id, status: "active",
    });
    const secondB = hypothesis("SH-2B", selfProposition(), {
      version: 2, previousVersionId: first.id, status: "superseded",
    });
    await assert.rejects(
      () => store.atomicCommit(
        lenoseedId, 0, mutations({ selfHypotheses: [first, secondA, secondB] }), "SH:duplicate-version",
      ),
      DomainInvariantError,
    );
  });
  await t.test("a current version below the highest version is rejected", async () => {
    const store = await createStore();
    const first = hypothesis("SH-1", selfProposition(), { status: "active" });
    const second = hypothesis("SH-2", selfProposition("use_available_information"), {
      version: 2, previousVersionId: first.id, status: "superseded",
    });
    await assert.rejects(
      () => store.atomicCommit(
        lenoseedId, 0, mutations({ selfHypotheses: [first, second] }), "SH:old-current",
      ),
      DomainInvariantError,
    );
  });
  await t.test("an older active version beside a newer current version is rejected", async () => {
    const store = await createStore();
    const first = hypothesis("SH-1", selfProposition(), { status: "active" });
    const second = hypothesis("SH-2", selfProposition("use_available_information"), {
      version: 2, previousVersionId: first.id, status: "disputed", confidence: "low",
    });
    await assert.rejects(
      () => store.atomicCommit(
        lenoseedId, 0, mutations({ selfHypotheses: [first, second] }), "SH:two-current",
      ),
      DomainInvariantError,
    );
  });
  await t.test("v1 superseded to v2 disputed is accepted", async () => {
    const store = await createStore();
    const first = hypothesis("SH-1", selfProposition(), { status: "superseded" });
    const second = hypothesis("SH-2", selfProposition("use_available_information"), {
      version: 2, previousVersionId: first.id, status: "disputed", confidence: "low",
    });
    await assert.doesNotReject(() => store.atomicCommit(
      lenoseedId, 0, mutations({ selfHypotheses: [first, second] }), "SH:valid-active",
    ));
  });
  await t.test("v1 superseded to v2 superseded to v3 disputed is accepted", async () => {
    const store = await createStore();
    const first = hypothesis("SH-1", selfProposition(), { status: "superseded" });
    const second = hypothesis("SH-2", selfProposition("use_available_information"), {
      version: 2, previousVersionId: first.id, status: "superseded",
    });
    const third = hypothesis("SH-3", selfProposition(), {
      version: 3, previousVersionId: second.id, status: "disputed", confidence: "low",
    });
    await assert.doesNotReject(() => store.atomicCommit(
      lenoseedId, 0, mutations({ selfHypotheses: [first, second, third] }), "SH:valid-disputed",
    ));
  });
});

test("G0-A2: SelfHypothesis commits are idempotent and reject a different fingerprint", async () => {
  const store = await createStore();
  const value = hypothesis("SH-1", selfProposition(), { status: "disputed", confidence: "low" });
  const original = mutations({ selfHypotheses: [value] });
  const first = await store.atomicCommit(lenoseedId, 0, original, "SH:retry");
  const retry = await store.atomicCommit(lenoseedId, 0, original, "SH:retry");
  assert.deepEqual(retry, first);
  assert.equal(await store.getStateVersion(lenoseedId), 1);

  await assert.rejects(
    () => store.atomicCommit(
      lenoseedId,
      0,
      mutations({ selfHypotheses: [{ ...value, updatedAt: "2026-08-12T09:01:00.000Z" }] }),
      "SH:retry",
    ),
    IdempotencyConflictError,
  );
});
