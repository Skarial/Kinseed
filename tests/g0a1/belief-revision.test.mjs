import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { createInitialBelief, reviseBelief } from "../../dist/domain/belief.js";
import { buildBeliefKey } from "../../dist/domain/proposition.js";
import { StateVersionConflictError } from "../../dist/domain/errors.js";
import { validateEvidenceItem } from "../../dist/application/validate-evidence.js";

const kinseedId = "K-TEST-001";
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
    kinseedId,
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
      type: "kinseed_created",
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
    kinseedId,
    kind: "testimony",
    proposition: proposition(2022),
    sourceId: humanSourceId,
    eventIds: [firstMessage.id],
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:01:01.000Z",
  };
  await validateEvidenceItem(evidence2022, store);

  const support2022 = {
    id: "EL-001",
    kinseedId,
    evidenceItemId: evidence2022.id,
    targetBeliefId: "B-001",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-001",
    weightClass: "high",
    createdAt: "2026-08-11T08:01:02.000Z",
  };
  const belief2022 = createInitialBelief({
    id: "B-001",
    kinseedId,
    proposition: proposition(2022),
    evidenceForLinkId: support2022.id,
    confidence: "high",
    now: "2026-08-11T08:01:02.000Z",
  });

  const commit = await store.atomicCommit(
    kinseedId,
    0,
    {
      evidenceItems: [evidence2022],
      evidenceLinks: [support2022],
      beliefs: [belief2022],
    },
    "T-001:commit",
  );

  assert.equal(commit.newStateVersion, 1);
  const active = await store.readActiveBeliefByKey(kinseedId, buildBeliefKey(proposition(2022)));
  assert.equal(active?.proposition.value, 2022);

  const link = await store.readEvidenceLink(kinseedId, active.evidenceForLinkIds[0]);
  const evidence = await store.readEvidenceItem(kinseedId, link.evidenceItemId);
  const sourceEvent = await store.readEventById(kinseedId, evidence.eventIds[0]);
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
    kinseedId,
    kind: "testimony",
    proposition: proposition(2022),
    sourceId: humanSourceId,
    eventIds: [firstMessage.id],
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:01:01.000Z",
  };
  await validateEvidenceItem(evidence2022, store);
  const support2022 = {
    id: "EL-001",
    kinseedId,
    evidenceItemId: evidence2022.id,
    targetBeliefId: "B-001",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-001",
    weightClass: "high",
    createdAt: "2026-08-11T08:01:02.000Z",
  };
  const belief2022 = createInitialBelief({
    id: "B-001",
    kinseedId,
    proposition: proposition(2022),
    evidenceForLinkId: support2022.id,
    confidence: "high",
    now: "2026-08-11T08:01:02.000Z",
  });
  await store.atomicCommit(
    kinseedId,
    0,
    { evidenceItems: [evidence2022], evidenceLinks: [support2022], beliefs: [belief2022] },
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
    kinseedId,
    kind: "testimony",
    proposition: proposition(2021),
    sourceId: humanSourceId,
    eventIds: [correctionMessage.id],
    extractionConfidence: "high",
    status: "active",
    supersedesId: evidence2022.id,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:05:01.000Z",
  };
  await validateEvidenceItem(evidence2021, store);

  const contradictPrevious = {
    id: "EL-002",
    kinseedId,
    evidenceItemId: evidence2021.id,
    targetBeliefId: belief2022.id,
    relation: "contradicts",
    sourceAuthority: "high",
    independenceGroup: "T-002",
    weightClass: "high",
    createdAt: "2026-08-11T08:05:02.000Z",
  };
  const support2021 = {
    id: "EL-003",
    kinseedId,
    evidenceItemId: evidence2021.id,
    targetBeliefId: "B-002",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-002",
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
    kinseedId,
    1,
    {
      evidenceItems: [evidence2021],
      evidenceLinks: [contradictPrevious, support2021],
      beliefs: [revision.supersededPrevious, revision.next],
    },
    "T-002:commit",
  );

  assert.equal(commit.newStateVersion, 2);
  const key = buildBeliefKey(proposition(2021));
  const active = await store.readActiveBeliefByKey(kinseedId, key);
  assert.equal(active?.id, "B-002");
  assert.equal(active?.proposition.value, 2021);

  const history = await store.readBeliefHistoryByKey(kinseedId, key);
  assert.deepEqual(
    history.map((belief) => [belief.id, belief.version, belief.status, belief.proposition.value]),
    [
      ["B-001", 1, "superseded", 2022],
      ["B-002", 2, "active", 2021],
    ],
  );

  const events = await store.readEventsInSequence(kinseedId);
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
    kinseedId,
    kind: "testimony",
    proposition: proposition(2022),
    sourceId: humanSourceId,
    eventIds: [message.id],
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "stub-v1",
    createdAt: "2026-08-11T08:01:01.000Z",
  };
  const link = {
    id: "EL-001",
    kinseedId,
    evidenceItemId: evidence2022.id,
    targetBeliefId: "B-001",
    relation: "supports",
    sourceAuthority: "high",
    independenceGroup: "T-001",
    weightClass: "high",
    createdAt: "2026-08-11T08:01:02.000Z",
  };
  const belief = createInitialBelief({
    id: "B-001",
    kinseedId,
    proposition: proposition(2022),
    evidenceForLinkId: link.id,
    confidence: "high",
    now: "2026-08-11T08:01:02.000Z",
  });

  const mutations = { evidenceItems: [evidence2022], evidenceLinks: [link], beliefs: [belief] };
  const first = await store.atomicCommit(kinseedId, 0, mutations, "T-001:commit");
  const retry = await store.atomicCommit(kinseedId, 0, mutations, "T-001:commit");

  assert.deepEqual(retry, first);
  assert.equal(await store.getStateVersion(kinseedId), 1);

  await assert.rejects(
    () => store.atomicCommit(kinseedId, 0, { evidenceItems: [], evidenceLinks: [], beliefs: [] }, "T-002:commit"),
    StateVersionConflictError,
  );
});
