import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { PersistencePort } from "../ports/persistence.js";

export async function validateEvidenceItem(
  candidate: EvidenceItem,
  persistence: PersistencePort,
): Promise<void> {
  const source = await persistence.readSource(candidate.sourceId);
  if (source === null) {
    throw new DomainInvariantError(`Unknown source ${candidate.sourceId}`);
  }

  if (candidate.eventIds.length === 0) {
    throw new DomainInvariantError(`EvidenceItem ${candidate.id} must reference at least one event`);
  }

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
  }
}
