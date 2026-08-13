import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { createInitialBelief, reviseBelief } from "../../dist/domain/belief.js";
import { buildBeliefKey } from "../../dist/domain/proposition.js";
import {
  DomainInvariantError,
  IdempotencyConflictError,
  StateVersionConflictError,
} from "../../dist/domain/errors.js";
import { validateEvidenceItem } from "../../dist/application/validate-evidence.js";

const lenoseedId = "K-TEST-001";
const humanId = "H-TEST-001";
const humanSourceId = "SRC-HUMAN-001";
const systemSourceId = "SRC-SYSTEM-001";

function proposition(year) {
  return {
    subjectRef: humanId,
    predicate: "employment_start_year",
    value: year,
    context: { organisation: "Atelier Nova" },
  };
}

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
    payload: overrides.payload ?? {},
    payloadSchemaVersion: 1,
    engineVersion: "g0a1-test",
    idempotencyKey: overrides.idempotencyKey,
  };
}

async function createStore() {
  const store = new InMemoryStore();
  await store.registerSource({
    id: systemSourceId,
    kind: "system",
    actorRef: null,
    channel: "internal",
    createdAt: "2026-08-11T08:00:00.000Z",
  });
  await store.registerSource({
    id: humanSourceId,
    kind: "human",
    actorRef: humanId,
    channel: "test",
    createdAt: "2026-08-11T08:00:00.000Z",
  });
  await store.appendEvent(
    event({
      id: "E-001",
      sequence: 1,
      type: "lenoseed_created",
      occurredAt: "2026-08-11T08:00:01.000Z",
      sourceId: systemSourceId,
      payload: { generation: 0 },
      idempotencyKey: "create:K-TEST-001",
    }),
  );
  return store;
}

test("G0-A1: a testimony becomes a traceable active belief", async () => {
  const store = await createStore();
  const firstMessage = event({
    id: "E-002",
    sequence: 2,
    type: "human_message_received",
    occurredAt: "2026-08-11T08:01:00.000Z",
    turnId: "T-001",
    sourceId: humanSourceId,
    actorRef: humanId,
    payload: { text: "J'ai commencé chez Atelier Nova en 2022." },
    idempotencyKey: "T-001:input",
  });
  await store.appendEvent(firstMessage);

  const evidence2022 = {
    id: "EV-001",
    lenoseedId,
    kind: "testimony",
    proposition: proposition(2022),
    sourceId: humanSourceId,
    eventIds: [firstMessage.id],
    grounding: { kind: "text_excerpt", eventId: firstMessage.id, supportingExcerpt: "2022" },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:01:01.000Z",
  };
  await validateEvidenceItem(evidence2022, store);

  const support2022 = {
    id: "EL-001",
    lenoseedId,
    evidenceItemId: evidence2022.id,
    targetType: "belief", targetId: "B-001",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-001",
    causalContamination: "none",
    weightClass: "high",
    createdAt: "2026-08-11T08:01:02.000Z",
  };
  const belief2022 = createInitialBelief({
    id: "B-001",
    lenoseedId,
    proposition: proposition(2022),
    evidenceForLinkId: support2022.id,
    confidence: "high",
    now: "2026-08-11T08:01:02.000Z",
  });

  const commit = await store.atomicCommit(
    lenoseedId,
    0,
    {
      evidenceItems: [evidence2022],
      evidenceLinks: [support2022],
      beliefs: [belief2022],
      selfHypotheses: [],
      memories: [],
    },
    "T-001:commit",
  );

  assert.equal(commit.newStateVersion, 1);
  const active = await store.readActiveBeliefByKey(lenoseedId, buildBeliefKey(proposition(2022)));
  assert.equal(active?.proposition.value, 2022);

  const link = await store.readEvidenceLink(lenoseedId, active.evidenceForLinkIds[0]);
  const evidence = await store.readEvidenceItem(lenoseedId, link.evidenceItemId);
  const sourceEvent = await store.readEventById(lenoseedId, evidence.eventIds[0]);
  const source = await store.readSource(evidence.sourceId);

  assert.equal(sourceEvent.id, "E-002");
  assert.equal(source.id, humanSourceId);
});

test("G0-A1: an explicit correction creates a new belief version without erasing history", async () => {
  const store = await createStore();

  const firstMessage = event({
    id: "E-002",
    sequence: 2,
    type: "human_message_received",
    occurredAt: "2026-08-11T08:01:00.000Z",
    turnId: "T-001",
    sourceId: humanSourceId,
    actorRef: humanId,
    payload: { text: "J'ai commencé chez Atelier Nova en 2022." },
    idempotencyKey: "T-001:input",
  });
  await store.appendEvent(firstMessage);

  const evidence2022 = {
    id: "EV-001",
    lenoseedId,
    kind: "testimony",
    proposition: proposition(2022),
    sourceId: humanSourceId,
    eventIds: [firstMessage.id],
    grounding: { kind: "text_excerpt", eventId: firstMessage.id, supportingExcerpt: "2022" },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:01:01.000Z",
  };
  await validateEvidenceItem(evidence2022, store);
  const support2022 = {
    id: "EL-001",
    lenoseedId,
    evidenceItemId: evidence2022.id,
    targetType: "belief", targetId: "B-001",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-001",
    causalContamination: "none",
    weightClass: "high",
    createdAt: "2026-08-11T08:01:02.000Z",
  };
  const belief2022 = createInitialBelief({
    id: "B-001",
    lenoseedId,
    proposition: proposition(2022),
    evidenceForLinkId: support2022.id,
    confidence: "high",
    now: "2026-08-11T08:01:02.000Z",
  });
  await store.atomicCommit(
    lenoseedId,
    0,
    { evidenceItems: [evidence2022], evidenceLinks: [support2022], beliefs: [belief2022], selfHypotheses: [], memories: [] },
    "T-001:commit",
  );

  const correctionMessage = event({
    id: "E-003",
    sequence: 3,
    type: "human_message_received",
    occurredAt: "2026-08-11T08:05:00.000Z",
    turnId: "T-002",
    sourceId: humanSourceId,
    actorRef: humanId,
    observedStateVersion: 1,
    payload: { text: "Je me suis trompé : c'était en 2021, pas en 2022." },
    idempotencyKey: "T-002:input",
  });
  await store.appendEvent(correctionMessage);

  const evidence2021 = {
    id: "EV-002",
    lenoseedId,
    kind: "testimony",
    proposition: proposition(2021),
    sourceId: humanSourceId,
    eventIds: [correctionMessage.id],
    grounding: { kind: "text_excerpt", eventId: correctionMessage.id, supportingExcerpt: "2021" },
    extractionConfidence: "high",
    status: "active",
    supersedesId: evidence2022.id,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:05:01.000Z",
  };
  await validateEvidenceItem(evidence2021, store);

  const contradictPrevious = {
    id: "EL-002",
    lenoseedId,
    evidenceItemId: evidence2021.id,
    targetType: "belief", targetId: belief2022.id,
    relation: "contradicts",
    sourceAuthority: "high",
    independenceGroup: "T-002",
    causalContamination: "none",
    weightClass: "high",
    createdAt: "2026-08-11T08:05:02.000Z",
  };
  const support2021 = {
    id: "EL-003",
    lenoseedId,
    evidenceItemId: evidence2021.id,
    targetType: "belief", targetId: "B-002",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-002",
    causalContamination: "none",
    weightClass: "high",
    createdAt: "2026-08-11T08:05:02.000Z",
  };

  const revision = reviseBelief({
    current: belief2022,
    nextId: "B-002",
    nextProposition: proposition(2021),
    supportingLinkId: support2021.id,
    contradictingPreviousLinkId: contradictPrevious.id,
    confidence: "high",
    now: "2026-08-11T08:05:02.000Z",
  });

  const commit = await store.atomicCommit(
    lenoseedId,
    1,
    {
      evidenceItems: [evidence2021],
      evidenceLinks: [contradictPrevious, support2021],
      beliefs: [revision.supersededPrevious, revision.next],
      selfHypotheses: [],
      memories: [],
    },
    "T-002:commit",
  );

  assert.equal(commit.newStateVersion, 2);
  const key = buildBeliefKey(proposition(2021));
  const active = await store.readActiveBeliefByKey(lenoseedId, key);
  assert.equal(active?.id, "B-002");
  assert.equal(active?.proposition.value, 2021);

  const history = await store.readBeliefHistoryByKey(lenoseedId, key);
  assert.deepEqual(
    history.map((belief) => [belief.id, belief.version, belief.status, belief.proposition.value]),
    [
      ["B-001", 1, "superseded", 2022],
      ["B-002", 2, "active", 2021],
    ],
  );

  const events = await store.readEventsInSequence(lenoseedId);
  assert.equal(events.find((entry) => entry.id === "E-002")?.payload.text, "J'ai commencé chez Atelier Nova en 2022.");
  assert.equal(events.find((entry) => entry.id === "E-003")?.payload.text, "Je me suis trompé : c'était en 2021, pas en 2022.");
});

test("G0-A1: commit retries are idempotent and stale state versions are rejected", async () => {
  const store = await createStore();
  const message = event({
    id: "E-002",
    sequence: 2,
    type: "human_message_received",
    occurredAt: "2026-08-11T08:01:00.000Z",
    turnId: "T-001",
    sourceId: humanSourceId,
    actorRef: humanId,
    payload: { text: "J'ai commencé chez Atelier Nova en 2022." },
    idempotencyKey: "T-001:input",
  });
  await store.appendEvent(message);

  const evidence2022 = {
    id: "EV-001",
    lenoseedId,
    kind: "testimony",
    proposition: proposition(2022),
    sourceId: humanSourceId,
    eventIds: [message.id],
    grounding: { kind: "text_excerpt", eventId: message.id, supportingExcerpt: "2022" },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:01:01.000Z",
  };
  const link = {
    id: "EL-001",
    lenoseedId,
    evidenceItemId: evidence2022.id,
    targetType: "belief", targetId: "B-001",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-001",
    causalContamination: "none",
    weightClass: "high",
    createdAt: "2026-08-11T08:01:02.000Z",
  };
  const belief = createInitialBelief({
    id: "B-001",
    lenoseedId,
    proposition: proposition(2022),
    evidenceForLinkId: link.id,
    confidence: "high",
    now: "2026-08-11T08:01:02.000Z",
  });

  const mutations = { evidenceItems: [evidence2022], evidenceLinks: [link], beliefs: [belief], selfHypotheses: [], memories: [] };
  const first = await store.atomicCommit(lenoseedId, 0, mutations, "T-001:commit");
  const retry = await store.atomicCommit(lenoseedId, 0, mutations, "T-001:commit");

  assert.deepEqual(retry, first);
  assert.equal(await store.getStateVersion(lenoseedId), 1);

  await assert.rejects(
    () => store.atomicCommit(lenoseedId, 0, { evidenceItems: [], evidenceLinks: [], beliefs: [], selfHypotheses: [], memories: [] }, "T-002:commit"),
    StateVersionConflictError,
  );
});

test("G0-A1: the store rejects evidence whose provenance event does not exist", async () => {
  const store = await createStore();
  const invalidEvidence = {
    id: "EV-BAD",
    lenoseedId,
    kind: "testimony",
    proposition: proposition(2022),
    sourceId: humanSourceId,
    eventIds: ["E-MISSING"],
    grounding: { kind: "text_excerpt", eventId: "E-MISSING", supportingExcerpt: "2022" },
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:01:01.000Z",
  };
  const link = {
    id: "EL-BAD",
    lenoseedId,
    evidenceItemId: invalidEvidence.id,
    targetType: "belief", targetId: "B-BAD",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-BAD",
    causalContamination: "none",
    weightClass: "high",
    createdAt: "2026-08-11T08:01:02.000Z",
  };
  const belief = createInitialBelief({
    id: "B-BAD",
    lenoseedId,
    proposition: proposition(2022),
    evidenceForLinkId: link.id,
    confidence: "high",
    now: "2026-08-11T08:01:02.000Z",
  });

  await assert.rejects(
    () =>
      store.atomicCommit(
        lenoseedId,
        0,
        { evidenceItems: [invalidEvidence], evidenceLinks: [link], beliefs: [belief], selfHypotheses: [], memories: [] },
        "T-BAD:commit",
      ),
    DomainInvariantError,
  );
  assert.equal(await store.getStateVersion(lenoseedId), 0);
});

test("G0-A1: the store rejects testimony without valid lexical grounding", async () => {
  const store = await createStore();
  const message = event({
    id: "E-GROUNDING",
    sequence: 2,
    type: "human_message_received",
    occurredAt: "2026-08-11T08:01:00.000Z",
    turnId: "T-GROUNDING",
    sourceId: humanSourceId,
    actorRef: humanId,
    payload: { text: "J'ai commencé chez Atelier Nova en 2022." },
    idempotencyKey: "T-GROUNDING:input",
  });
  await store.appendEvent(message);

  for (const [id, grounding] of [
    ["EV-NO-GROUNDING", null],
    ["EV-BAD-GROUNDING", {
      kind: "text_excerpt",
      eventId: message.id,
      supportingExcerpt: "20212021",
    }],
  ]) {
    await assert.rejects(
      () =>
        store.atomicCommit(
          lenoseedId,
          0,
          {
            evidenceItems: [{
              id,
              lenoseedId,
              kind: "testimony",
              proposition: proposition(2022),
              sourceId: humanSourceId,
              eventIds: [message.id],
              grounding,
              extractionConfidence: "high",
              status: "active",
              supersedesId: null,
              extractorVersion: "stub-v1",
              createdAt: "2026-08-11T08:01:01.000Z",
            }],
            evidenceLinks: [],
            beliefs: [],
            selfHypotheses: [],
            memories: [],
          },
          `${id}:commit`,
        ),
      DomainInvariantError,
    );
  }
  assert.equal(await store.getStateVersion(lenoseedId), 0);
  assert.equal(await store.readEvidenceItem(lenoseedId, "EV-NO-GROUNDING"), null);
  assert.equal(await store.readEvidenceItem(lenoseedId, "EV-BAD-GROUNDING"), null);
});

test("G0-A1: the store rejects an active belief without supporting provenance", async () => {
  const store = await createStore();
  const unsupportedActiveBelief = {
    id: "B-UNSUPPORTED",
    lenoseedId,
    beliefKey: buildBeliefKey(proposition(2022)),
    version: 1,
    proposition: proposition(2022),
    status: "active",
    confidence: "high",
    evidenceForLinkIds: [],
    evidenceAgainstLinkIds: [],
    previousVersionId: null,
    createdAt: "2026-08-11T08:01:02.000Z",
    updatedAt: "2026-08-11T08:01:02.000Z",
  };

  await assert.rejects(
    () =>
      store.atomicCommit(
        lenoseedId,
        0,
        { evidenceItems: [], evidenceLinks: [], beliefs: [unsupportedActiveBelief], selfHypotheses: [], memories: [] },
        "T-UNSUPPORTED:commit",
      ),
    DomainInvariantError,
  );
  assert.equal(await store.getStateVersion(lenoseedId), 0);
});

test("G0-A1: reusing an idempotency key with different content is rejected", async () => {
  const store = await createStore();
  const original = event({
    id: "E-002",
    sequence: 2,
    type: "human_message_received",
    occurredAt: "2026-08-11T08:01:00.000Z",
    turnId: "T-001",
    sourceId: humanSourceId,
    actorRef: humanId,
    payload: { text: "Version A" },
    idempotencyKey: "T-001:input",
  });
  await store.appendEvent(original);

  await assert.rejects(
    () =>
      store.appendEvent({
        ...original,
        payload: { text: "Version B" },
      }),
    IdempotencyConflictError,
  );
});
