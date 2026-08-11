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

function containsDistinctDecimal(text: string, value: number): boolean {
  const decimal = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\d)${decimal}(?!\\d)`).test(text);
}
