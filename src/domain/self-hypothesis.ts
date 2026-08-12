import type { Confidence } from "./belief.js";
import { buildBeliefKey, type Proposition } from "./proposition.js";
import type { EntityId, Timestamp } from "./primitives.js";

export type SelfHypothesisStage = "hypothesis";
export type SelfHypothesisStatus = "active" | "disputed" | "superseded";

export interface SelfHypothesis {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly hypothesisKey: string;
  readonly version: number;
  readonly proposition: Proposition;
  readonly stage: SelfHypothesisStage;
  readonly supportLinkIds: readonly EntityId[];
  readonly againstLinkIds: readonly EntityId[];
  readonly confidence: Confidence;
  readonly status: SelfHypothesisStatus;
  readonly previousVersionId: EntityId | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * G0-A2 uses the same logical-key semantics as a Belief: value is deliberately
 * excluded so opposite orientations share one revision history.
 */
export function buildSelfHypothesisKey(proposition: Proposition): string {
  return buildBeliefKey(proposition);
}
