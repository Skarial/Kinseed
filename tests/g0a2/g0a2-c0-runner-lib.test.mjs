import test from "node:test";
import assert from "node:assert/strict";

import {
  G0A2_C0_DECISION_SCHEMA,
  G0A2_C0_SYSTEM_PROMPT,
  G0A2_C0_USER_PROMPT,
  buildG0A2C0Report,
  buildG0A2C0Request,
  classifyG0A2C0Campaign,
  measureG0A2C0Pair,
  parseG0A2C0Decision,
  readG0A2C0RunCount,
  usageFromResponse,
} from "./g0a2-c0-runner-lib.mjs";

test("G0-A2 C0 accepts only one to five configured pairs", () => {
  assert.equal(readG0A2C0RunCount("1"), 1); assert.equal(readG0A2C0RunCount("5"), 5);
  for (const value of [undefined, "0", "6", "one", "1.5", "-1"]) {
    assert.throws(() => readG0A2C0RunCount(value));
  }
});

test("G0-A2 C0 measures every decision combination", () => {
  assert.deepEqual(measureG0A2C0Pair("seek_clarification", "use_available_information"), { decisionA: "seek_clarification", decisionB: "use_available_information", reproducesLenoSeedPattern: true, sameDecision: false, reversedPattern: false });
  assert.equal(measureG0A2C0Pair("use_available_information", "seek_clarification").reversedPattern, true);
  assert.equal(measureG0A2C0Pair("seek_clarification", "seek_clarification").sameDecision, true);
  assert.equal(measureG0A2C0Pair("use_available_information", "use_available_information").sameDecision, true);
});

test("G0-A2 C0 classifies official and smoke campaigns exactly", () => {
  assert.equal(classifyG0A2C0Campaign(5, 0), "PASS"); assert.equal(classifyG0A2C0Campaign(5, 1), "PASS"); assert.equal(classifyG0A2C0Campaign(5, 2), "PASS");
  assert.equal(classifyG0A2C0Campaign(5, 3), "INCONCLUSIVE"); assert.equal(classifyG0A2C0Campaign(5, 4), "FAIL"); assert.equal(classifyG0A2C0Campaign(5, 5), "FAIL");
  for (const pairCount of [1, 2, 3, 4]) assert.equal(classifyG0A2C0Campaign(pairCount, 0), "SMOKE_ONLY");
});

test("G0-A2 C0 builds identical unlabeled stateless requests", () => {
  const requestA = buildG0A2C0Request("gpt-test"); const requestB = buildG0A2C0Request("gpt-test");
  assert.deepEqual(requestA, requestB); assert.equal(requestA.store, false);
  const serialized = JSON.stringify(requestA); assert.equal(serialized.includes("C0-A"), false); assert.equal(serialized.includes("C0-B"), false);
  assert.equal(requestA.input[0].content, G0A2_C0_SYSTEM_PROMPT); assert.equal(requestA.input[1].content, G0A2_C0_USER_PROMPT);
  assert.equal(G0A2_C0_DECISION_SCHEMA.additionalProperties, false); assert.deepEqual(G0A2_C0_DECISION_SCHEMA.properties.decision.enum, ["seek_clarification", "use_available_information"]);
});

test("G0-A2 C0 parses only the exact structured decision", () => {
  assert.equal(parseG0A2C0Decision('{"decision":"seek_clarification"}'), "seek_clarification");
  assert.equal(parseG0A2C0Decision('{"decision":"use_available_information"}'), "use_available_information");
  for (const text of ["not json", '{"decision":"other"}', '{"decision":"seek_clarification","extra":true}']) assert.throws(() => parseG0A2C0Decision(text));
});

test("G0-A2 C0 reports exactly two logical calls per pair", () => {
  const pairs = [
    { pair: 1, ...measureG0A2C0Pair("seek_clarification", "seek_clarification"), usage: { a: { inputTokens: 1, outputTokens: 2 }, b: { inputTokens: 3, outputTokens: 4 } } },
    { pair: 2, ...measureG0A2C0Pair("seek_clarification", "use_available_information"), usage: { a: { inputTokens: 5, outputTokens: 6 }, b: { inputTokens: 7, outputTokens: 8 } } },
  ];
  const report = buildG0A2C0Report({ executedAt: "2026-08-13T00:00:00.000Z", model: "gpt-test", pairs });
  assert.equal(report.callCount, 4); assert.equal(report.status, "SMOKE_ONLY"); assert.equal(report.reproductionCount, 1);
  assert.deepEqual(report.usage, { inputTokens: 16, outputTokens: 20 }); assert.equal(report.durableLenoSeedDataSupplied, false);
});

test("G0-A2 C0 preserves unavailable usage as null", () => {
  assert.deepEqual(usageFromResponse({}), { inputTokens: null, outputTokens: null });
});
