import type { Confidence } from "../domain/belief.js";
import type { EvidenceKind, EvidenceWeight } from "../domain/evidence.js";
import type { Intention } from "../domain/intention.js";
import type { EntityId, StateVersion, TurnId } from "../domain/primitives.js";
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
  readonly turnId: TurnId;
  readonly message: string;
  readonly sourceId: EntityId;
  readonly eventId: EntityId;
  readonly allowedContext: Readonly<Record<string, never>>;
}

export interface FormulationContext {
  readonly stateVersion: StateVersion;
  readonly currentBelief: BeliefSnapshot | null;
  readonly beliefHistory: readonly BeliefSnapshot[];
  readonly turnEvidence: readonly {
    readonly predicate: string;
    readonly value: Proposition["value"];
  }[];
}

export interface AIEngineTrace {
  readonly provider: string;
  readonly model: string;
  readonly engineVersion: string;
  readonly promptPolicyVersion: string;
  readonly operation: "extraction" | "formulation" | "control";
  readonly turnId: TurnId;
  readonly suppliedStateIds: readonly EntityId[];
  readonly usage: { readonly inputTokens: number | null; readonly outputTokens: number | null };
}

export interface AIEngine {
  extractEvidence(input: ExtractionInput): Promise<readonly CandidateEvidenceItem[]>;
  formulate(input: {
    readonly turnId: TurnId;
    readonly intention: Intention;
    readonly context: FormulationContext;
  }): Promise<string>;
  readTrace(): readonly AIEngineTrace[];
}
