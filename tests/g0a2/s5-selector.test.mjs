import test from "node:test";
import assert from "node:assert/strict";
import { selectG0A2S5Intention } from "../../dist/domain/g0a2-s5-selector.js";
import { DomainInvariantError } from "../../dist/domain/errors.js";

const lenoSeedId = "K-S5-SELECTOR";

function situation(overrides = {}) {
  return {
    id: "E-S5-input",
    lenoSeedId,
    sequence: 1,
    type: "human_message_received",
    occurredAt: "2026-08-13T11:00:00.000Z",
    turnId: "TURN-S5",
    sourceId: "SRC-HUMAN",
    actorRef: "H-S5",
    causedByEventIds: [],
    observedStateVersion: 2,
    payload: {
      text: "Il manque une information importante. Que fais-tu ?",
      protocol: "G0-A2",
      situationId: "S5",
      decisionAxis: "decision_style_under_uncertainty",
    },
    payloadSchemaVersion: 2,
    engineVersion: "test",
    idempotencyKey: "TURN-S5:input",
    ...overrides,
  };
}

function hypothesis(id, value, overrides = {}) {
  return {
    id,
    lenoSeedId,
    hypothesisKey: "decision-key",
    version: 1,
    proposition: {
      subjectRef: lenoSeedId,
      predicate: "decision_style_under_uncertainty",
      value,
      context: { protocol: "G0-A2" },
    },
    stage: "hypothesis",
    supportLinkIds: [],
    againstLinkIds: [],
    confidence: "moderate",
    status: "active",
    previousVersionId: null,
    createdAt: "2026-08-13T10:00:00.000Z",
    updatedAt: "2026-08-13T10:00:00.000Z",
    ...overrides,
  };
}

test("G0-A2 S5 selector applies the neutral deterministic tie-break", () => {
  const result = selectG0A2S5Intention({ situationEvent: situation(), activeSelfHypotheses: [] });
  assert.deepEqual(result, {
    eligibleKinds: ["ask_clarification", "respond_with_available_information_under_uncertainty"],
    favoredKind: null,
    selectedKind: "respond_with_available_information_under_uncertainty",
    triggerSelfHypothesisIds: [],
    neutralTieBreakApplied: true,
  });
});

test("G0-A2 S5 selector consumes active seek_clarification", () => {
  const result = selectG0A2S5Intention({
    situationEvent: situation(),
    activeSelfHypotheses: [hypothesis("SH-SEEK", "seek_clarification")],
  });
  assert.equal(result.favoredKind, "ask_clarification");
  assert.equal(result.selectedKind, "ask_clarification");
  assert.deepEqual(result.triggerSelfHypothesisIds, ["SH-SEEK"]);
  assert.equal(result.neutralTieBreakApplied, false);
});

test("G0-A2 S5 selector distinguishes active use_available_information from tie-break", () => {
  const result = selectG0A2S5Intention({
    situationEvent: situation(),
    activeSelfHypotheses: [hypothesis("SH-USE", "use_available_information")],
  });
  assert.equal(result.favoredKind, "respond_with_available_information_under_uncertainty");
  assert.equal(result.selectedKind, "respond_with_available_information_under_uncertainty");
  assert.deepEqual(result.triggerSelfHypothesisIds, ["SH-USE"]);
  assert.equal(result.neutralTieBreakApplied, false);
});

test("G0-A2 S5 selector ignores disputed and superseded hypotheses", () => {
  for (const status of ["disputed", "superseded"]) {
    const result = selectG0A2S5Intention({
      situationEvent: situation(),
      activeSelfHypotheses: [hypothesis(`SH-${status}`, "seek_clarification", { status })],
    });
    assert.equal(result.favoredKind, null);
    assert.equal(result.neutralTieBreakApplied, true);
  }
});

test("G0-A2 S5 selector rejects invalid snapshots and situations", async (t) => {
  await t.test("another LenoSeed", () => assert.throws(
    () => selectG0A2S5Intention({
      situationEvent: situation(),
      activeSelfHypotheses: [hypothesis("SH-OTHER", "seek_clarification", { lenoSeedId: "K-OTHER" })],
    }),
    DomainInvariantError,
  ));
  await t.test("two active eligible hypotheses", () => assert.throws(
    () => selectG0A2S5Intention({
      situationEvent: situation(),
      activeSelfHypotheses: [
        hypothesis("SH-1", "seek_clarification"),
        hypothesis("SH-2", "use_available_information"),
      ],
    }),
    DomainInvariantError,
  ));
  for (const [name, event] of [
    ["wrong EventType", situation({ type: "intention_selected" })],
    ["schema v1", situation({ payloadSchemaVersion: 1 })],
    ["wrong protocol", situation({ payload: { ...situation().payload, protocol: "G0-A1" } })],
    ["wrong situationId", situation({ payload: { ...situation().payload, situationId: "S4" } })],
    ["wrong decisionAxis", situation({ payload: { ...situation().payload, decisionAxis: "other" } })],
    ["null turnId", situation({ turnId: null })],
    ["non-string text", situation({ payload: { ...situation().payload, text: 7 } })],
  ]) {
    await t.test(name, () => assert.throws(
      () => selectG0A2S5Intention({ situationEvent: event, activeSelfHypotheses: [] }),
      DomainInvariantError,
    ));
  }
});
