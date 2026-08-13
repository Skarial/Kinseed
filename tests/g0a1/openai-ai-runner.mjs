import assert from "node:assert/strict";

import { InMemoryStore } from "../../dist/adapters/in-memory-store.js";
import { OpenAIAIEngine } from "../../dist/adapters/openai-ai-engine.js";
import { processTurn } from "../../dist/application/process-turn.js";
import { buildBeliefKey } from "../../dist/domain/proposition.js";

const lenoSeedId = "K-TEST-001";
const humanId = "H-TEST-001";
const humanSourceId = "SRC-HUMAN-001";
const systemSourceId = "SRC-SYSTEM-001";
const engineVersion = "g0a1-openai-integration-v1";
const messages = [
  "J’ai commencé à travailler à l’Atelier Nova en 2022.",
  "En quelle année t’ai-je dit avoir commencé à l’Atelier Nova ?",
  "Correction : je m’étais trompé. J’ai commencé en 2021, pas en 2022.",
  "En quelle année ai-je commencé à l’Atelier Nova ?",
  "Est-ce que je t’avais donné une autre année auparavant ?",
  "Non, je ne t’ai jamais dit 2022. Tu inventes.",
  "Quelle est ta conclusion actuelle sur mon année de début à l’Atelier Nova, et pourquoi ?",
];

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required: npm run test:ai never falls back to FakeAIEngine.");
}

const runs = readRunCount(process.env.G0A1_AI_RUNS);
const reports = [];
for (let run = 1; run <= runs; run += 1) {
  reports.push(await executeRun(run));
}
console.log(JSON.stringify({ reports }, null, 2));

async function executeRun(run) {
  const engine = new OpenAIAIEngine();
  try {
    await assertExtraction(engine, "EXTRACT-T1", messages[0], "employment_start_year", 2022);
    await assertExtraction(engine, "EXTRACT-T3", messages[2], "employment_start_year", 2021);
    await assertExtraction(
      engine,
      "EXTRACT-T6",
      messages[5],
      "denies_prior_employment_start_year_testimony",
      2022,
    );

    const store = await createStore();
    const key = buildBeliefKey(proposition(2022));
    const responses = [];
    for (const [index, message] of messages.entries()) {
      responses.push((await runTurn(store, engine, `T${index + 1}`, message, index + 1)).response);
    }

    assert.match(responses[1], /2022/);
    assert.match(responses[3], /2021/);
    assert.match(responses[4], /2022/);
    assert.match(responses[4], /2021/);
    assert.match(responses[5], /2022/);
    assert.match(responses[5], /2021/);
    assert.match(responses[6], /2021/);
    assert.match(responses[6], /2022/);

    const history = await store.readBeliefHistoryByKey(lenoSeedId, key);
    assert.deepEqual(
      history.map((belief) => [belief.status, belief.proposition.value]),
      [["superseded", 2022], ["active", 2021]],
    );

    const controls = await Promise.all(
      [messages[1], messages[3], messages[4], messages[6]].map((question, index) =>
        engine.runControlQuestion(`C0-${index + 1}`, question),
      ),
    );
    const c0 = controls.some((response) => /\b(2021|2022)\b/.test(response))
      ? "INCONCLUSIVE"
      : "PASS";
    return {
      run,
      status: "PASS",
      c0,
      responses,
      controls,
      trace: engine.readTrace(),
      calls: engine.readTrace().length,
    };
  } catch (error) {
    return {
      run,
      status: "FAIL",
      cause: error instanceof Error ? error.message : "Unknown error",
      trace: engine.readTrace(),
      calls: engine.readTrace().length,
    };
  }
}

async function assertExtraction(engine, turnId, message, predicate, value) {
  const candidates = await engine.extractEvidence({
    turnId,
    message,
    sourceId: humanSourceId,
    eventId: `E-${turnId}-input`,
    allowedContext: {},
  });
  if (candidates.length !== 1) {
    assert.fail(
      `Expected exactly one extraction candidate for ${turnId}; received ${JSON.stringify(
        candidates.map((candidate) => ({
          kind: candidate.kind,
          predicate: candidate.proposition.predicate,
          value: candidate.proposition.value,
          context: candidate.proposition.context,
        })),
      )}`,
    );
  }
  assert.deepEqual(candidates[0]?.proposition, proposition(value, predicate));
  assert.ok(candidates[0]?.supportingExcerpt.trim().length > 0);
  assert.ok(message.includes(candidates[0]?.supportingExcerpt));
  assert.match(candidates[0]?.supportingExcerpt, new RegExp(`(?<!\\d)${value}(?!\\d)`));
}

async function createStore() {
  const store = new InMemoryStore();
  await store.registerSource({ id: systemSourceId, kind: "system", actorRef: null, channel: "internal", createdAt: "2026-08-11T08:00:00.000Z" });
  await store.registerSource({ id: humanSourceId, kind: "human", actorRef: humanId, channel: "test", createdAt: "2026-08-11T08:00:00.000Z" });
  await store.appendEvent({
    id: "E-000", lenoSeedId, sequence: 1, type: "lenoseed_created",
    occurredAt: "2026-08-11T08:00:01.000Z", turnId: null, sourceId: systemSourceId,
    actorRef: null, causedByEventIds: [], observedStateVersion: 0, payload: { generation: 0 },
    payloadSchemaVersion: 1, engineVersion, idempotencyKey: "create:K-TEST-001",
  });
  return store;
}

function runTurn(store, engine, turnId, message, second) {
  return processTurn({
    lenoSeedId, turnId, humanSourceId, humanActorRef: humanId, systemSourceId, message,
    occurredAt: `2026-08-11T08:${String(second).padStart(2, "0")}:00.000Z`, engineVersion,
  }, store, engine);
}

function proposition(value, predicate = "employment_start_year") {
  return { subjectRef: humanId, predicate, value, context: { organisation: "Atelier Nova" } };
}

function readRunCount(value) {
  const count = Number.parseInt(value ?? "1", 10);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("G0A1_AI_RUNS must be a positive integer");
  }
  return count;
}
