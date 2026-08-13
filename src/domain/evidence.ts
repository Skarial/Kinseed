import type { EntityId, Timestamp } from "./primitives.js";
import type { Proposition } from "./proposition.js";

export type EvidenceKind = "testimony" | "system_record" | "behavioral_observation";
export type EvidenceStatus = "active" | "superseded" | "invalidated";
export type EvidenceRelation = "supports" | "contradicts";
export type EvidenceWeight = "low" | "medium" | "high";

export type EvidenceGrounding =
  | {
      readonly kind: "text_excerpt";
      readonly eventId: EntityId;
      readonly supportingExcerpt: string;
    }
  | {
      readonly kind: "structured_event";
      readonly eventId: EntityId;
    };

export interface EvidenceItem {
  readonly id: EntityId;
  readonly lenoseedId: EntityId;
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
  readonly lenoseedId: EntityId;
  readonly evidenceItemId: EntityId;
  readonly targetType: "belief" | "self_hypothesis";
  readonly targetId: EntityId;
  readonly relation: EvidenceRelation;
  readonly sourceAuthority: EvidenceWeight;
  readonly independenceGroup: string;
  readonly causalContamination: "none" | "influenced_by_target";
  readonly weightClass: EvidenceWeight;
  readonly createdAt: Timestamp;
}
