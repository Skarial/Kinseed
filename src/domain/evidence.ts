import type { EntityId, Timestamp } from "./primitives.js";
import type { Proposition } from "./proposition.js";

export type EvidenceKind = "testimony" | "system_record";
export type EvidenceStatus = "active" | "superseded" | "invalidated";
export type EvidenceRelation = "supports" | "contradicts";
export type EvidenceWeight = "low" | "medium" | "high";

export interface EvidenceGrounding {
  readonly eventId: EntityId;
  readonly supportingExcerpt: string;
}

export interface EvidenceItem {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly kind: EvidenceKind;
  readonly proposition: Proposition;
  readonly sourceId: EntityId;
  readonly eventIds: readonly EntityId[];
  readonly grounding: EvidenceGrounding | null;
  readonly extractionConfidence: EvidenceWeight;
  readonly status: EvidenceStatus;
  readonly supersedesId: EntityId | null;
  readonly extractorVersion: string;
  readonly createdAt: Timestamp;
}

export interface EvidenceLink {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly evidenceItemId: EntityId;
  readonly targetBeliefId: EntityId;
  readonly relation: EvidenceRelation;
  readonly sourceAuthority: EvidenceWeight;
  readonly independenceGroup: string;
  readonly weightClass: EvidenceWeight;
  readonly createdAt: Timestamp;
}
