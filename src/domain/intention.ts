import type { EntityId, StateVersion, Timestamp } from "./primitives.js";

export type IntentionKind =
  | "answer_question"
  | "acknowledge_correction"
  | "report_record_conflict";

export type IntentionStatus = "candidate" | "selected" | "expressed" | "completed" | "aborted";

export interface Intention {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly kind: IntentionKind;
  readonly target: EntityId;
  readonly triggerEventIds: readonly EntityId[];
  readonly triggerEvidenceItemIds: readonly EntityId[];
  readonly triggerBeliefIds: readonly EntityId[];
  readonly motivation: string;
  readonly observedStateVersion: StateVersion;
  readonly status: IntentionStatus;
  readonly createdAt: Timestamp;
}
