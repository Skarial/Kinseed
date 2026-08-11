import type { Confidence } from "../domain/belief.js";
import type { EvidenceKind, EvidenceWeight } from "../domain/evidence.js";
import type { Intention } from "../domain/intention.js";
import type { EntityId } from "../domain/primitives.js";
import type { Proposition } from "../domain/proposition.js";

export interface CandidateEvidenceItem {
  readonly kind: EvidenceKind;
  readonly proposition: Proposition;
  readonly extractionConfidence: EvidenceWeight;
  readonly extractorVersion: string;
}

export interface BeliefSnapshot {
  readonly id: EntityId;
  readonly version: number;
  readonly value: Proposition["value"];
  readonly confidence: Confidence;
  readonly status: "active" | "superseded";
}

export interface ExtractionInput {
  readonly message: string;
  readonly sourceId: EntityId;
  readonly eventId: EntityId;
  readonly allowedContext: Readonly<Record<string, never>>;
}

export interface FormulationContext {
  readonly currentBelief: BeliefSnapshot | null;
  readonly beliefHistory: readonly BeliefSnapshot[];
  readonly turnEvidence: readonly {
    readonly predicate: string;
    readonly value: Proposition["value"];
  }[];
}

export interface AIEngine {
  extractEvidence(input: ExtractionInput): Promise<readonly CandidateEvidenceItem[]>;
  formulate(input: {
    readonly intention: Intention;
    readonly context: FormulationContext;
  }): Promise<string>;
}
