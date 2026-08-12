import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import {
  buildG0A2BehavioralObservationId,
  materializeG0A2BehavioralObservations,
} from "../../dist/application/materialize-g0a2-behavioral-observations.js";
import { DomainInvariantError, IdempotencyConflictError } from "../../dist/domain/errors.js";
import { buildSelfHypothesisKey } from "../../dist/domain/self-hypothesis.js";

const systemSourceId = "SRC-G0A2-MATERIALIZER";
const engineVersion = "g0a2-materialization-test";

function styleValue(kind) {
  return kind === "ask_clarification" ? "seek_clarification" : "use_available_information";
}

async function createScenario(kinseedId = "K-G0A2-MAT") {
  const store = new InMemoryStore();
  await store.registerSource({
    id: systemSourceId,
    kind: "system",
    actorRef: null,
    channel: "internal",
    createdAt: "2026-08-12T10:00:00.000Z",
  });
  await store.appendEvent({
    id: `E-${kinseedId}-CREATED`,
    kinseedId,
    sequence: 1,
    type: "kinseed_created",
    occurredAt: "2026-08-12T10:00:00.000Z",
    turnId: null,
    sourceId: systemSourceId,
    actorRef: null,
    causedByEventIds: [],
    observedStateVersion: 0,
    payload: { generation: 0 },
    payloadSchemaVersion: 1,
    engineVersion,
    idempotencyKey: `${kinseedId}:created`,
  });
  return store;
}

async function registerSource(store, id, kind) {
  await store.registerSource({
    id,
    kind,
    actorRef: kind === "human" ? "H-G0A2-MAT" : null,
    channel: "test",
    createdAt: "2026-08-12T10:00:00.000Z",
  });
}

async function appendFixtures(store, kinseedId, kinds, overrides = {}) {
  const situations = overrides.situations ?? ["S1", "S2", "S3", "S4"];
  const events = [];
  for (const [index, kind] of kinds.entries()) {
    const event = {
      id: overrides.ids?.[index] ?? `E-${kinseedId}-${situations[index]}`,
      kinseedId,
      sequence: overrides.sequences?.[index] ?? index + 2,
      type: overrides.types?.[index] ?? "intention_selected",
      occurredAt: `2026-08-12T10:00:0${index + 1}.000Z`,
      turnId: null,
      sourceId: overrides.sourceIds?.[index] ?? systemSourceId,
      actorRef: null,
      causedByEventIds: [],
      observedStateVersion: 0,
      payload: {
        ...(overrides.omitIntentionIds?.[index] ? {} : { intentionId: `I-${kinseedId}-${situations[index]}` }),
        kind,
        ...(overrides.omitMotivations?.[index] ? {} : { motivation: "controlled_historical_fixture" }),
        situationId: situations[index],
        triggerSelfHypothesisIds: overrides.triggers?.[index] ?? [],
      },
      payloadSchemaVersion: overrides.schemaVersions?.[index] ?? 2,
      engineVersion,
      idempotencyKey: overrides.idempotencyKeys?.[index] ?? `fixture:${kinseedId}:${situations[index]}:${index}`,
    };
    await store.appendEvent(event);
    events.push(event);
  }
  return events;
}

function input(kinseedId, historyId, fixtures) {
  return {
    kinseedId,
    historyId,
    systemSourceId,
    intentionEventIds: fixtures.map((fixture) => fixture.id),
    engineVersion,
  };
}

async function expectNoMaterialization(store, kinseedId, fixtures) {
  assert.equal(await store.getStateVersion(kinseedId), 0);
  for (const fixture of fixtures) {
    assert.equal(await store.readEvidenceItem(kinseedId, buildG0A2BehavioralObservationId(fixture.id)), null);
  }
  const events = await store.readEventsInSequence(kinseedId);
  assert.equal(
    events.some((event) => event.type === "state_commit_completed" && event.payload.scope === "behavioral_observation_materialization"),
    false,
  );
}

async function assertHistory(store, kinseedId, historyId, expectedKinds) {
  const fixtures = await store.readEventsInSequence(kinseedId);
  const observations = await Promise.all(
    fixtures
      .filter((event) => event.type === "intention_selected")
      .map((event) => store.readEvidenceItem(kinseedId, buildG0A2BehavioralObservationId(event.id))),
  );
  assert.equal(observations.length, 4);
  assert.deepEqual(observations.map((observation) => observation?.proposition.value), expectedKinds.map(styleValue));
  for (const [index, observation] of observations.entries()) {
    const source = fixtures.filter((event) => event.type === "intention_selected")[index];
    assert.equal(observation?.grounding?.kind, "structured_event");
    assert.equal(observation?.grounding?.eventId, source?.id);
    assert.equal(observation?.createdAt, source?.occurredAt);
    assert.equal(observation?.extractorVersion, "kinseed-g0a2-behavioral-observation-v1");
    assert.equal(observation?.proposition.context.situationId, source?.payload.situationId);
  }
  assert.equal(
    await store.readActiveSelfHypothesisByKey(
      kinseedId,
      buildSelfHypothesisKey({
        subjectRef: kinseedId,
        predicate: "decision_style_under_uncertainty",
        value: "seek_clarification",
        context: { protocol: "G0-A2" },
      }),
    ),
    null,
  );
  const completion = fixtures.find(
    (event) => event.type === "state_commit_completed" && event.payload.materializationId === historyId,
  );
  assert.ok(completion);
  assert.equal(completion.payloadSchemaVersion, 2);
  assert.deepEqual(completion.causedByEventIds, fixtures.filter((event) => event.type === "intention_selected").map((event) => event.id));
  assert.deepEqual(completion.payload, {
    scope: "behavioral_observation_materialization",
    materializationId: historyId,
    previousStateVersion: 0,
    newStateVersion: 1,
    changed: true,
  });
}

test("G0-A2 materializes controlled history A deterministically", async () => {
  const kinseedId = "K-G0A2-A";
  const store = await createScenario(kinseedId);
  const kinds = [
    "ask_clarification",
    "ask_clarification",
    "ask_clarification",
    "respond_with_available_information_under_uncertainty",
  ];
  const fixtures = await appendFixtures(store, kinseedId, kinds);
  const result = await materializeG0A2BehavioralObservations(input(kinseedId, "history-a", fixtures), store);

  assert.deepEqual(result, {
    evidenceItemIds: fixtures.map((fixture) => buildG0A2BehavioralObservationId(fixture.id)),
    previousStateVersion: 0,
    newStateVersion: 1,
    changed: true,
    replayed: false,
  });
  assert.equal(await store.getStateVersion(kinseedId), 1);
  await assertHistory(store, kinseedId, "history-a", kinds);
});

test("G0-A2 materializes controlled history B without consolidation", async () => {
  const kinseedId = "K-G0A2-B";
  const store = await createScenario(kinseedId);
  const kinds = [
    "ask_clarification",
    "respond_with_available_information_under_uncertainty",
    "respond_with_available_information_under_uncertainty",
    "respond_with_available_information_under_uncertainty",
  ];
  const fixtures = await appendFixtures(store, kinseedId, kinds);
  await materializeG0A2BehavioralObservations(input(kinseedId, "history-b", fixtures), store);
  await assertHistory(store, kinseedId, "history-b", kinds);
});

test("G0-A2 materialization rejects invalid fixtures before mutation", async (t) => {
  const validKinds = [
    "ask_clarification",
    "ask_clarification",
    "ask_clarification",
    "respond_with_available_information_under_uncertainty",
  ];
  const cases = [
    ["only three fixtures", validKinds.slice(0, 3), {}],
    ["S1 twice and S4 absent", validKinds, {
      situations: ["S1", "S1", "S2", "S3"],
      ids: ["E-DUP-S1-A", "E-DUP-S1-B", "E-DUP-S2", "E-DUP-S3"],
    }],
    ["wrong event type", validKinds, { types: ["kinseed_message_emitted", "intention_selected", "intention_selected", "intention_selected"] }],
    ["schema v1", validKinds, { schemaVersions: [1, 2, 2, 2] }],
    ["missing intentionId", validKinds, { omitIntentionIds: [true, false, false, false] }],
    ["missing motivation", validKinds, { omitMotivations: [true, false, false, false] }],
    ["invalid intention kind", ["unknown", ...validKinds.slice(1)], {}],
    ["SelfHypothesis trigger", validKinds, { triggers: [["SH-1"], [], [], []] }],
    ["invalid situation", validKinds, { situations: ["S0", "S2", "S3", "S4"] }],
  ];
  for (const [name, kinds, overrides] of cases) {
    await t.test(name, async () => {
      const kinseedId = `K-G0A2-INVALID-${name.replaceAll(" ", "-")}`;
      const store = await createScenario(kinseedId);
      const fixtures = await appendFixtures(store, kinseedId, kinds, overrides);
      await assert.rejects(
        () => materializeG0A2BehavioralObservations(input(kinseedId, "invalid", fixtures), store),
        DomainInvariantError,
      );
      await expectNoMaterialization(store, kinseedId, fixtures);
    });
  }

  await t.test("non-system source", async () => {
    const kinseedId = "K-G0A2-INVALID-SOURCE";
    const store = await createScenario(kinseedId);
    const humanSourceId = "SRC-G0A2-HUMAN-FIXTURE";
    await registerSource(store, humanSourceId, "human");
    const fixtures = await appendFixtures(store, kinseedId, validKinds, { sourceIds: [humanSourceId, systemSourceId, systemSourceId, systemSourceId] });
    await assert.rejects(
      () => materializeG0A2BehavioralObservations(input(kinseedId, "invalid-source", fixtures), store),
      DomainInvariantError,
    );
    await expectNoMaterialization(store, kinseedId, fixtures);
  });

  await t.test("event of another Kinseed", async () => {
    const kinseedId = "K-G0A2-INVALID-OWNER";
    const store = await createScenario(kinseedId);
    const fixtures = await appendFixtures(store, kinseedId, validKinds.slice(0, 3));
    const otherKinseedId = "K-G0A2-OTHER";
    await store.appendEvent({
      id: `E-${otherKinseedId}-CREATED`, kinseedId: otherKinseedId, sequence: 1, type: "kinseed_created",
      occurredAt: "2026-08-12T10:00:00.000Z", turnId: null, sourceId: systemSourceId, actorRef: null,
      causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 }, payloadSchemaVersion: 1,
      engineVersion, idempotencyKey: `${otherKinseedId}:created`,
    });
    const [otherFixture] = await appendFixtures(store, otherKinseedId, ["respond_with_available_information_under_uncertainty"]);
    const supplied = [...fixtures, otherFixture];
    await assert.rejects(
      () => materializeG0A2BehavioralObservations(input(kinseedId, "invalid-owner", supplied), store),
      DomainInvariantError,
    );
    await expectNoMaterialization(store, kinseedId, fixtures);
  });
});

test("G0-A2 materialization replays completed history without new mutations", async () => {
  const kinseedId = "K-G0A2-REPLAY";
  const store = await createScenario(kinseedId);
  const kinds = ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"];
  const fixtures = await appendFixtures(store, kinseedId, kinds);
  const materializationInput = input(kinseedId, "history-replay", fixtures);
  await materializeG0A2BehavioralObservations(materializationInput, store);
  const eventsBefore = await store.readEventsInSequence(kinseedId);
  const replay = await materializeG0A2BehavioralObservations(materializationInput, store);
  assert.equal(replay.replayed, true);
  assert.equal(replay.previousStateVersion, 0);
  assert.equal(replay.newStateVersion, 1);
  assert.equal(await store.getStateVersion(kinseedId), 1);
  assert.equal((await store.readEventsInSequence(kinseedId)).length, eventsBefore.length);
});

test("G0-A2 recovers when the commit was applied but completion was absent", async () => {
  const kinseedId = "K-G0A2-RECOVERY";
  const store = await createScenario(kinseedId);
  const kinds = ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"];
  const fixtures = await appendFixtures(store, kinseedId, kinds);
  let failCompletion = true;
  const persistence = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "appendEvent") {
        return async (event) => {
          if (failCompletion && event.type === "state_commit_completed") {
            failCompletion = false;
            throw new Error("injected completion failure");
          }
          return target.appendEvent(event);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const materializationInput = input(kinseedId, "history-recovery", fixtures);

  await assert.rejects(() => materializeG0A2BehavioralObservations(materializationInput, persistence));
  assert.equal(await store.getStateVersion(kinseedId), 1);
  assert.equal((await store.readEventsInSequence(kinseedId)).filter((event) => event.type === "state_commit_completed").length, 0);
  for (const fixture of fixtures) {
    assert.ok(await store.readEvidenceItem(kinseedId, buildG0A2BehavioralObservationId(fixture.id)));
  }

  const recovered = await materializeG0A2BehavioralObservations(materializationInput, persistence);
  assert.deepEqual(recovered, {
    evidenceItemIds: fixtures.map((fixture) => buildG0A2BehavioralObservationId(fixture.id)),
    previousStateVersion: 0,
    newStateVersion: 1,
    changed: true,
    replayed: false,
  });
  assert.equal(await store.getStateVersion(kinseedId), 1);
  assert.equal((await store.readEventsInSequence(kinseedId)).filter((event) => event.type === "state_commit_completed").length, 1);
});

test("G0-A2 refuses a different source set for the same unfinished history", async () => {
  const kinseedId = "K-G0A2-FINGERPRINT";
  const store = await createScenario(kinseedId);
  const firstKinds = ["ask_clarification", "ask_clarification", "ask_clarification", "respond_with_available_information_under_uncertainty"];
  const firstFixtures = await appendFixtures(store, kinseedId, firstKinds);
  let failCompletion = true;
  const persistence = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "appendEvent") {
        return async (event) => {
          if (failCompletion && event.type === "state_commit_completed") {
            failCompletion = false;
            throw new Error("injected completion failure");
          }
          return target.appendEvent(event);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => materializeG0A2BehavioralObservations(input(kinseedId, "history-fingerprint", firstFixtures), persistence));

  const alternateFixtures = await appendFixtures(store, kinseedId, firstKinds, {
    ids: ["E-ALT-S1", "E-ALT-S2", "E-ALT-S3", "E-ALT-S4"],
    sequences: [6, 7, 8, 9],
    idempotencyKeys: ["fixture:alternate:S1", "fixture:alternate:S2", "fixture:alternate:S3", "fixture:alternate:S4"],
  });
  await assert.rejects(
    () => materializeG0A2BehavioralObservations(input(kinseedId, "history-fingerprint", alternateFixtures), persistence),
    IdempotencyConflictError,
  );
  assert.equal(await store.getStateVersion(kinseedId), 1);
});
