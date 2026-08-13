import type {
  EntityId,
  Sequence,
  SerializableValue,
  StateVersion,
  Timestamp,
  TurnId,
} from "./primitives.js";

export type EventType =
  | "lenoseed_created"
  | "human_message_received"
  | "intention_selected"
  | "lenoseed_message_emitted"
  | "validation_decision_recorded"
  | "state_commit_completed"
  | "processing_failure_recorded";

export interface Event {
  readonly id: EntityId;
  readonly lenoSeedId: EntityId;
  readonly sequence: Sequence;
  readonly type: EventType;
  readonly occurredAt: Timestamp;
  readonly turnId: TurnId | null;
  readonly sourceId: EntityId;
  readonly actorRef: EntityId | null;
  readonly causedByEventIds: readonly EntityId[];
  readonly observedStateVersion: StateVersion;
  readonly payload: Readonly<Record<string, SerializableValue>>;
  readonly payloadSchemaVersion: number;
  readonly engineVersion: string;
  readonly idempotencyKey: string;
}
