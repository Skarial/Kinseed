import type { EntityId, Timestamp } from "./primitives.js";

export type SourceKind = "human" | "system" | "llm";

export interface Source {
  readonly id: EntityId;
  readonly kind: SourceKind;
  readonly actorRef: EntityId | null;
  readonly channel: string;
  readonly createdAt: Timestamp;
}
