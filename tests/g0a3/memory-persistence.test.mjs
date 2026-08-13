import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { DomainInvariantError, IdempotencyConflictError } from "../../dist/domain/errors.js";
import { buildG0A3MemoryId, buildG0A3MemoryKey } from "../../dist/domain/memory.js";

const lenoseedId = "K-G0A3-MEMORY";
const systemSourceId = "SRC-G0A3-SYSTEM";
const createdAt = "2026-08-13T10:00:00.000Z";
const episodeKey = "EP-CONTROLLED-MEMORY";

async function createStore() {
  const store = new InMemoryStore();
  await store.registerSource({
    id: systemSourceId,
    kind: "system",
    actorRef: null,
    channel: "test",
    createdAt,
  });
  await store.appendEvent({
    id: "E-CREATED",
    lenoseedId,
    sequence: 1,
    type: "lenoseed_created",
    occurredAt: createdAt,
    turnId: null,
    sourceId: systemSourceId,
    actorRef: null,
    causedByEventIds: [],
    observedStateVersion: 0,
    payload: { generation: 0 },
    payloadSchemaVersion: 1,
    engineVersion: "g0a3-memory-persistence-test",
    idempotencyKey: "g0a3-memory:created",
  });
  return store;
}

function evidence(id = "EV-MEMORY-1") {
  return {
    id,
    lenoseedId,
    kind: "system_record",
    proposition: {
      subjectRef: lenoseedId,
      predicate: "controlled_memory_fixture",
      value: "recorded",
      context: { protocol: "G0-A3-test" },
    },
    sourceId: systemSourceId,
    eventIds: ["E-CREATED"],
    grounding: null,
    extractionConfidence: "high",
    status: "active",
    supersedesId: null,
    extractorVersion: "g0a3-memory-persistence-test",
    createdAt,
  };
}

function memory(version = 1, overrides = {}) {
  return {
    id: buildG0A3MemoryId(lenoseedId, episodeKey, version),
    lenoseedId,
    memoryKey: buildG0A3MemoryKey(lenoseedId, episodeKey),
    episodeKey,
    version,
    eventIds: ["E-CREATED"],
    evidenceItemIds: ["EV-MEMORY-1"],
    gist: "Controlled memory fixture.",
    createdAt,
    salience: "high",
    confidence: "high",
    status: "active",
    revisionOf: version === 1 ? null : buildG0A3MemoryId(lenoseedId, episodeKey, version - 1),
    lastRecalledAt: null,
    ...overrides,
  };
}

function mutations(memories, evidenceItems = []) {
  return {
    evidenceItems,
    evidenceLinks: [],
    beliefs: [],
    selfHypotheses: [],
    memories,
  };
}

async function commitV1(store, key = "memory:v1") {
  const candidate = memory();
  const result = await store.atomicCommit(lenoseedId, 0, mutations([candidate], [evidence()]), key);
  return { candidate, result };
}

test("G0-A3 Memory builders are deterministic and reject invalid identities", () => {
  assert.equal(
    buildG0A3MemoryKey("K-1", "EP-1"),
    "g0a3:K-1:EP-1",
  );
  assert.equal(
    buildG0A3MemoryId("K-1", "EP-1", 2),
    "MEM-G0A3-K-1-EP-1-v2",
  );
  for (const [id, episode, version] of [["", "EP-1", 1], ["K-1", "", 1], ["K-1", "EP:1", 1], ["K-1", "EP-1", 0], ["K-1", "EP-1", 1.5]]) {
    assert.throws(() => buildG0A3MemoryId(id, episode, version), DomainInvariantError);
  }
  assert.throws(() => buildG0A3MemoryKey("", "EP-1"), DomainInvariantError);
});

test("G0-A3 Memory persists, reads by id and key, and reads do not mutate state", async () => {
  const store = await createStore();
  const { candidate, result } = await commitV1(store);
  assert.deepEqual(result, { applied: true, previousStateVersion: 0, newStateVersion: 1 });
  assert.deepEqual(await store.readMemory(lenoseedId, candidate.id), candidate);
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, candidate.memoryKey), candidate);
  assert.deepEqual(await store.readMemoryHistoryByKey(lenoseedId, candidate.memoryKey), [candidate]);
  assert.equal(await store.getStateVersion(lenoseedId), 1);
  assert.equal((await store.readMemory(lenoseedId, candidate.id))?.lastRecalledAt, null);
  assert.equal(await store.getStateVersion(lenoseedId), 1);
});

test("G0-A3 Memory rejects incompatible ownership, references, identity and first version", async (t) => {
  const invalidCases = [
    ["other Lenoseed", memory(1, { lenoseedId: "K-OTHER", memoryKey: buildG0A3MemoryKey("K-OTHER", episodeKey), id: buildG0A3MemoryId("K-OTHER", episodeKey, 1) }), [evidence()]],
    ["missing event", memory(1, { eventIds: ["E-MISSING"] }), [evidence()]],
    ["missing EvidenceItem", memory(1, { evidenceItemIds: ["EV-MISSING"] }), [evidence()]],
    ["wrong memoryKey", memory(1, { memoryKey: "g0a3:wrong:key" }), [evidence()]],
    ["wrong deterministic id", memory(1, { id: "MEM-FORGED" }), [evidence()]],
    ["v1 predecessor", memory(1, { revisionOf: "MEM-OLDER" }), [evidence()]],
    ["initial version is not v1", memory(2, { revisionOf: null }), [evidence()]],
    ["last recalled mutation", memory(1, { lastRecalledAt: "2026-08-13T10:01:00.000Z" }), [evidence()]],
  ];
  for (const [name, candidate, evidenceItems] of invalidCases) {
    await t.test(name, async () => {
      const store = await createStore();
      await assert.rejects(
        () => store.atomicCommit(lenoseedId, 0, mutations([candidate], evidenceItems), `invalid:${name}`),
        DomainInvariantError,
      );
      assert.equal(await store.getStateVersion(lenoseedId), 0);
    });
  }
});

test("G0-A3 Memory rejects impossible histories", async (t) => {
  const first = memory(1, { status: "revised" });
  const second = memory(2, { status: "active" });
  const cases = [
    ["two active", [memory(), memory(2, { revisionOf: memory().id })]],
    ["version jump", [memory(1, { status: "revised" }), memory(3, { revisionOf: buildG0A3MemoryId(lenoseedId, episodeKey, 2) })]],
    ["wrong revisionOf", [first, { ...second, revisionOf: "MEM-FORGED" }]],
  ];
  for (const [name, memories] of cases) {
    await t.test(name, async () => {
      const store = await createStore();
      await assert.rejects(
        () => store.atomicCommit(lenoseedId, 0, mutations(memories, [evidence()]), `history:${name}`),
        DomainInvariantError,
      );
      assert.equal(await store.getStateVersion(lenoseedId), 0);
    });
  }
});

test("G0-A3 Memory accepts atomic active-to-revised v1 to active v2", async () => {
  const store = await createStore();
  const { candidate: v1 } = await commitV1(store);
  const revisedV1 = { ...v1, status: "revised" };
  const v2 = memory(2, { gist: "Controlled memory fixture, revised." });
  const result = await store.atomicCommit(lenoseedId, 1, mutations([revisedV1, v2]), "memory:v2");
  assert.deepEqual(result, { applied: true, previousStateVersion: 1, newStateVersion: 2 });
  assert.deepEqual(
    (await store.readMemoryHistoryByKey(lenoseedId, v1.memoryKey)).map((item) => [item.id, item.status]),
    [[v1.id, "revised"], [v2.id, "active"]],
  );
  assert.deepEqual(await store.readActiveMemoryByKey(lenoseedId, v1.memoryKey), v2);
  assert.deepEqual(await store.readMemory(lenoseedId, v1.id), revisedV1);
});

test("G0-A3 Memory rejects historical rewrites and a second revision of v1", async () => {
  const store = await createStore();
  const { candidate: v1 } = await commitV1(store);
  await assert.rejects(
    () => store.atomicCommit(lenoseedId, 1, mutations([{ ...v1, gist: "Forged.", status: "revised" }]), "memory:forged-gist"),
    DomainInvariantError,
  );
  const revisedV1 = { ...v1, status: "revised" };
  const v2 = memory(2);
  await store.atomicCommit(lenoseedId, 1, mutations([revisedV1, v2]), "memory:v2");
  await assert.rejects(
    () => store.atomicCommit(lenoseedId, 2, mutations([{ ...revisedV1 }]), "memory:revised-rewrite"),
    DomainInvariantError,
  );
});

test("G0-A3 Memory commits are idempotent and reject a different fingerprint", async () => {
  const store = await createStore();
  const candidate = memory();
  const original = mutations([candidate], [evidence()]);
  const first = await store.atomicCommit(lenoseedId, 0, original, "memory:retry");
  const replay = await store.atomicCommit(lenoseedId, 0, original, "memory:retry");
  assert.deepEqual(replay, first);
  assert.equal(await store.getStateVersion(lenoseedId), 1);
  await assert.rejects(
    () => store.atomicCommit(lenoseedId, 0, mutations([{ ...candidate, gist: "Different." }], [evidence()]), "memory:retry"),
    IdempotencyConflictError,
  );
});

test("G0-A3 Memory failure injection leaves state untouched", async () => {
  const store = await createStore();
  const candidate = memory();
  store.failNextAtomicCommitForTests(new Error("memory failure"));
  await assert.rejects(
    () => store.atomicCommit(lenoseedId, 0, mutations([candidate], [evidence()]), "memory:failure"),
    /memory failure/,
  );
  assert.equal(await store.getStateVersion(lenoseedId), 0);
  assert.equal(await store.readMemory(lenoseedId, candidate.id), null);
  assert.equal(await store.readEvidenceItem(lenoseedId, "EV-MEMORY-1"), null);
});
