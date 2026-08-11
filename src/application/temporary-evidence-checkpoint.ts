import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceKind, EvidenceWeight } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import type { Proposition, PropositionContext } from "../domain/proposition.js";
import type { EntityId, ScalarValue, SerializableValue, TurnId } from "../domain/primitives.js";
import type { CandidateEvidenceItem } from "../ports/ai-engine.js";

export interface TemporaryEvidenceCheckpoint {
  readonly event: Event;
  readonly outcomes: readonly TemporaryEvidenceOutcome[];
}

export type TemporaryEvidenceOutcome =
  | {
      readonly candidateId: EntityId;
      readonly decision: "accept";
      readonly candidate: CandidateEvidenceItem;
    }
  | {
      readonly candidateId: EntityId;
      readonly decision: "reject";
      readonly reasonCodes: readonly string[];
    };

export function buildTemporaryEvidencePayload(
  outcomes: readonly TemporaryEvidenceOutcome[],
): Readonly<Record<string, SerializableValue>> {
  return {
    scope: "temporary_evidence",
    completed: true,
    outcomes: outcomes.map(serializeOutcome),
  };
}

export function findTemporaryEvidenceCheckpoint(
  events: readonly Event[],
  turnId: TurnId,
  inputEventId: EntityId,
): TemporaryEvidenceCheckpoint | null {
  const checkpointId = `E-${turnId}-temporary-evidence`;
  const checkpointKey = `${turnId}:temporary-evidence`;
  const candidates = events.filter(
    (event) =>
      event.id === checkpointId ||
      event.idempotencyKey === checkpointKey ||
      (event.type === "validation_decision_recorded" &&
        event.payloadSchemaVersion === 2 &&
        event.payload.scope === "temporary_evidence"),
  );
  if (candidates.length === 0) return null;
  if (candidates.length !== 1) {
    throw new DomainInvariantError(`Turn ${turnId} has more than one temporary evidence checkpoint`);
  }
  const event = candidates[0];
  if (event === undefined) throw new DomainInvariantError("Missing temporary evidence checkpoint");
  if (
    event.id !== checkpointId ||
    event.idempotencyKey !== checkpointKey ||
    event.type !== "validation_decision_recorded" ||
    event.payloadSchemaVersion !== 2 ||
    event.causedByEventIds.length !== 1 ||
    event.causedByEventIds[0] !== inputEventId
  ) {
    throw new DomainInvariantError(`Temporary evidence checkpoint ${event.id} is malformed`);
  }
  return { event, outcomes: parseOutcomes(event.payload, turnId) };
}

export function acceptedCandidatesFromCheckpoint(
  checkpoint: TemporaryEvidenceCheckpoint,
): readonly CandidateEvidenceItem[] {
  return checkpoint.outcomes.flatMap((outcome) =>
    outcome.decision === "accept" ? [outcome.candidate] : [],
  );
}

function serializeOutcome(outcome: TemporaryEvidenceOutcome): SerializableValue {
  if (outcome.decision === "reject") {
    return {
      candidateId: outcome.candidateId,
      decision: "reject",
      reasonCodes: [...outcome.reasonCodes],
    };
  }
  return {
    candidateId: outcome.candidateId,
    decision: "accept",
    candidateSnapshot: {
      kind: outcome.candidate.kind,
      proposition: {
        subjectRef: outcome.candidate.proposition.subjectRef,
        predicate: outcome.candidate.proposition.predicate,
        value: outcome.candidate.proposition.value,
        context: { ...outcome.candidate.proposition.context },
      },
      supportingExcerpt: outcome.candidate.supportingExcerpt,
      extractionConfidence: outcome.candidate.extractionConfidence,
      extractorVersion: outcome.candidate.extractorVersion,
    },
  };
}

function parseOutcomes(
  payload: Readonly<Record<string, SerializableValue>>,
  turnId: TurnId,
): readonly TemporaryEvidenceOutcome[] {
  if (payload.scope !== "temporary_evidence" || payload.completed !== true || !Array.isArray(payload.outcomes)) {
    throw new DomainInvariantError("Temporary evidence checkpoint payload is malformed");
  }
  const candidateIds = new Set<string>();
  return payload.outcomes.map((value, index) => {
    const record = object(value, "Temporary evidence outcome");
    const candidateId = string(record.candidateId, "Temporary evidence candidateId");
    const expectedCandidateId = `CAND-${turnId}-${index + 1}`;
    if (candidateId !== expectedCandidateId) {
      throw new DomainInvariantError(
        `Temporary evidence candidate ${candidateId} is not ordered as ${expectedCandidateId}`,
      );
    }
    if (candidateIds.has(candidateId)) {
      throw new DomainInvariantError(`Temporary evidence candidate ${candidateId} is duplicated`);
    }
    candidateIds.add(candidateId);
    if (record.decision === "accept") {
      return { candidateId, decision: "accept", candidate: parseCandidate(record.candidateSnapshot) };
    }
    if (record.decision === "reject") {
      if (!Array.isArray(record.reasonCodes) || record.reasonCodes.length === 0) {
        throw new DomainInvariantError(`Temporary evidence rejection ${candidateId} has no reason code`);
      }
      return {
        candidateId,
        decision: "reject",
        reasonCodes: record.reasonCodes.map((reason) => string(reason, "Temporary evidence reason code")),
      };
    }
    throw new DomainInvariantError(`Temporary evidence candidate ${candidateId} has an invalid decision`);
  });
}

function parseCandidate(value: SerializableValue | undefined): CandidateEvidenceItem {
  const snapshot = object(value, "Temporary evidence candidate snapshot");
  if (Object.hasOwn(snapshot, "eventId") || Object.hasOwn(snapshot, "sourceId")) {
    throw new DomainInvariantError("Temporary evidence candidate snapshot must not contain provenance ids");
  }
  const kind = string(snapshot.kind, "Temporary evidence kind");
  if (kind !== "testimony" && kind !== "system_record") {
    throw new DomainInvariantError(`Temporary evidence kind ${kind} is invalid`);
  }
  const extractionConfidence = string(snapshot.extractionConfidence, "Temporary evidence confidence");
  if (!["low", "medium", "high"].includes(extractionConfidence)) {
    throw new DomainInvariantError(`Temporary evidence confidence ${extractionConfidence} is invalid`);
  }
  return {
    kind: kind as EvidenceKind,
    proposition: parseProposition(snapshot.proposition),
    supportingExcerpt: string(snapshot.supportingExcerpt, "Temporary evidence supporting excerpt"),
    extractionConfidence: extractionConfidence as EvidenceWeight,
    extractorVersion: string(snapshot.extractorVersion, "Temporary evidence extractor version"),
  };
}

function parseProposition(value: SerializableValue | undefined): Proposition {
  const proposition = object(value, "Temporary evidence proposition");
  const context = object(proposition.context, "Temporary evidence proposition context");
  const parsedContext: Record<string, ScalarValue> = {};
  for (const [key, contextValue] of Object.entries(context)) {
    if (!isScalar(contextValue)) {
      throw new DomainInvariantError("Temporary evidence proposition context must be scalar");
    }
    parsedContext[key] = contextValue;
  }
  const propositionValue = proposition.value;
  if (propositionValue === undefined || !isScalar(propositionValue)) {
    throw new DomainInvariantError("Temporary evidence proposition value must be scalar");
  }
  return {
    subjectRef: string(proposition.subjectRef, "Temporary evidence subjectRef"),
    predicate: string(proposition.predicate, "Temporary evidence predicate"),
    value: propositionValue,
    context: parsedContext as PropositionContext,
  };
}

function object(value: SerializableValue | undefined, label: string): Readonly<Record<string, SerializableValue>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainInvariantError(`${label} is malformed`);
  }
  return value as Readonly<Record<string, SerializableValue>>;
}

function string(value: SerializableValue | undefined, label: string): string {
  if (typeof value !== "string") throw new DomainInvariantError(`${label} is malformed`);
  return value;
}

function isScalar(value: SerializableValue): value is ScalarValue {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
