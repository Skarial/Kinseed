import { DomainInvariantError } from "../domain/errors.js";
import {
  type GroundingRejectionCode,
  validateTextEvidenceGrounding,
} from "../domain/evidence-grounding.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import type { PersistencePort } from "../ports/persistence.js";

export async function validateEvidenceItem(
  candidate: EvidenceItem,
  persistence: PersistencePort,
): Promise<GroundingRejectionCode | null> {
  const source = await persistence.readSource(candidate.sourceId);
  if (source === null) {
    throw new DomainInvariantError(`Unknown source ${candidate.sourceId}`);
  }

  if (candidate.eventIds.length === 0) {
    throw new DomainInvariantError(`EvidenceItem ${candidate.id} must reference at least one event`);
  }

  let groundingEvent: Event | null = null;
  for (const eventId of candidate.eventIds) {
    const event = await persistence.readEventById(candidate.kinseedId, eventId);
    if (event === null) {
      throw new DomainInvariantError(`EvidenceItem ${candidate.id} references unknown event ${eventId}`);
    }

    if (event.sourceId !== candidate.sourceId) {
      throw new DomainInvariantError(
        `EvidenceItem ${candidate.id} source does not match event ${eventId} source`,
      );
    }

    if (candidate.kind === "testimony" && event.type !== "human_message_received") {
      throw new DomainInvariantError(
        `Testimony ${candidate.id} must originate from a human_message_received event`,
      );
    }
    if (candidate.grounding?.eventId === eventId) groundingEvent = event;
  }

  if (candidate.kind !== "testimony") return null;
  if (groundingEvent === null) {
    throw new DomainInvariantError(`Testimony ${candidate.id} grounding event is unavailable`);
  }
  return validateTextEvidenceGrounding(candidate, groundingEvent);
}
