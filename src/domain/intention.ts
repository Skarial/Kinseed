import type { EntityId, StateVersion, Timestamp } from "./primitives.js";

export type IntentionKind =
  | "answer_question"
  | "acknowledge_correction"
  | "report_record_conflict"
  | "ask_clarification"
  | "respond_with_available_information_under_uncertainty";

export type IntentionStatus = "candidate" | "selected" | "expressed" | "completed" | "aborted";

export interface Intention {
  readonly id: EntityId;
  readonly lenoSeedId: EntityId;
  readonly kind: IntentionKind;
  readonly target: EntityId;
  readonly triggerEventIds: readonly EntityId[];
  readonly triggerEvidenceItemIds: readonly EntityId[];
  readonly triggerBeliefIds: readonly EntityId[];
  readonly triggerSelfHypothesisIds: readonly EntityId[];
  readonly motivation: string;
  readonly observedStateVersion: StateVersion;
  readonly status: IntentionStatus;
  readonly createdAt: Timestamp;
}
