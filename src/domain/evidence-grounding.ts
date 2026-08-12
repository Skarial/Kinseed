import { DomainInvariantError } from "./errors.js";
import type { EvidenceItem } from "./evidence.js";
import type { Event } from "./event.js";

export type GroundingRejectionCode =
  | "supporting_excerpt_empty"
  | "supporting_excerpt_not_in_event_text"
  | "proposition_value_not_in_supporting_excerpt";

export function validateTextEvidenceGrounding(
  evidenceItem: EvidenceItem,
  event: Event,
): GroundingRejectionCode | null {
  if (evidenceItem.kind !== "testimony") return null;

  const grounding = evidenceItem.grounding;
  if (grounding === null) {
    throw new DomainInvariantError(`Testimony ${evidenceItem.id} must have grounding`);
  }
  if (grounding.kind !== "text_excerpt") {
    throw new DomainInvariantError(`Testimony ${evidenceItem.id} must use text_excerpt grounding`);
  }
  if (!evidenceItem.eventIds.includes(grounding.eventId)) {
    throw new DomainInvariantError(
      `EvidenceItem ${evidenceItem.id} grounding event must belong to eventIds`,
    );
  }
  if (event.id !== grounding.eventId) {
    throw new DomainInvariantError(
      `EvidenceItem ${evidenceItem.id} grounding event does not match supplied event`,
    );
  }
  if (event.type !== "human_message_received") {
    throw new DomainInvariantError(
      `Testimony ${evidenceItem.id} must originate from a human_message_received event`,
    );
  }

  const text = event.payload.text;
  if (typeof text !== "string") {
    throw new DomainInvariantError(
      `Testimony ${evidenceItem.id} grounding event must have text payload`,
    );
  }
  if (grounding.supportingExcerpt.trim().length === 0) {
    return "supporting_excerpt_empty";
  }
  if (!text.includes(grounding.supportingExcerpt)) {
    return "supporting_excerpt_not_in_event_text";
  }
  if (
    typeof evidenceItem.proposition.value === "number" &&
    !containsDistinctDecimal(grounding.supportingExcerpt, evidenceItem.proposition.value)
  ) {
    return "proposition_value_not_in_supporting_excerpt";
  }
  return null;
}

export function validateBehavioralObservationGrounding(
  evidenceItem: EvidenceItem,
  event: Event,
): void {
  if (evidenceItem.kind !== "behavioral_observation") return;

  const grounding = evidenceItem.grounding;
  if (grounding === null || grounding.kind !== "structured_event") {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} must use structured_event grounding`,
    );
  }
  if (evidenceItem.eventIds.length !== 1 || evidenceItem.eventIds[0] !== grounding.eventId) {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} must ground exactly one event`,
    );
  }
  if (event.id !== grounding.eventId || event.kinseedId !== evidenceItem.kinseedId) {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} grounding event is inconsistent`,
    );
  }
  if (event.sourceId !== evidenceItem.sourceId) {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} source does not match grounding event`,
    );
  }
  if (event.type !== "intention_selected" || event.payloadSchemaVersion !== 2) {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} must originate from intention_selected schema v2`,
    );
  }
  if (typeof event.payload.intentionId !== "string") {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} source intention has no intentionId`,
    );
  }
  if (typeof event.payload.motivation !== "string") {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} source intention has no motivation`,
    );
  }
  const situationId = event.payload.situationId;
  const intentionKind = event.payload.kind;
  if (typeof situationId !== "string") {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} source intention has no situationId`,
    );
  }
  const expectedValue = decisionStyleForIntentionKind(intentionKind);
  if (expectedValue === null) {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} source intention kind is invalid`,
    );
  }
  if (
    evidenceItem.proposition.subjectRef !== evidenceItem.kinseedId ||
    evidenceItem.proposition.predicate !== "selected_decision_style_under_uncertainty" ||
    evidenceItem.proposition.context.protocol !== "G0-A2" ||
    evidenceItem.proposition.context.situationId !== situationId ||
    evidenceItem.proposition.value !== expectedValue
  ) {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} proposition does not match source intention`,
    );
  }
  if (evidenceItem.createdAt !== event.occurredAt) {
    throw new DomainInvariantError(
      `Behavioral observation ${evidenceItem.id} createdAt must equal source event occurredAt`,
    );
  }
}

export function decisionStyleForIntentionKind(value: unknown): string | null {
  if (value === "ask_clarification") return "seek_clarification";
  if (value === "respond_with_available_information_under_uncertainty") {
    return "use_available_information";
  }
  return null;
}

function containsDistinctDecimal(text: string, value: number): boolean {
  const decimal = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\d)${decimal}(?!\\d)`).test(text);
}
