import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import {
  G0A3_RELEVANT_EPISODE_KEY,
  validateG0A3FutureSituationEvent,
  type G0A3MemoryDecisionContext,
  type G0A3MemoryDecisionSnapshot,
} from "../domain/g0a3-memory-selector.js";
import { buildG0A3MemoryKey, type Memory } from "../domain/memory.js";
import type { EntityId } from "../domain/primitives.js";
import type { Source } from "../domain/source.js";
import type { PersistencePort } from "../ports/persistence.js";
import { initialIds, validateG0A3Memory } from "./validate-g0a3-memory.js";

export interface BuildG0A3MemoryDecisionContextInput {
  readonly lenoseedId: EntityId;
  readonly situationEvent: Event;
  readonly relevantEpisodeKey: "EP-G0A3-CALIBRATION-01";
  readonly includeMemory: boolean;
}

export async function buildG0A3MemoryDecisionContext(
  input: BuildG0A3MemoryDecisionContextInput,
  persistence: PersistencePort,
): Promise<G0A3MemoryDecisionContext> {
  validateG0A3FutureSituationEvent(input.situationEvent);
  if (input.situationEvent.lenoseedId !== input.lenoseedId) {
    throw new DomainInvariantError(
      `G0-A3 situation ${input.situationEvent.id} belongs to another Lenoseed`,
    );
  }
  if (
    input.relevantEpisodeKey !== G0A3_RELEVANT_EPISODE_KEY ||
    input.situationEvent.payload.relevantEpisodeKey !== input.relevantEpisodeKey
  ) {
    throw new DomainInvariantError("G0-A3 situation has an invalid relevant episode key");
  }
  const stateVersion = await persistence.getStateVersion(input.lenoseedId);
  if (stateVersion !== input.situationEvent.observedStateVersion) {
    throw new DomainInvariantError(
      `G0-A3 situation ${input.situationEvent.id} has an ambiguous durable snapshot`,
    );
  }
  if (!input.includeMemory) {
    return { situationEvent: input.situationEvent, memorySnapshot: null };
  }

  const activeMemory = await persistence.readActiveMemoryByKey(
    input.lenoseedId,
    buildG0A3MemoryKey(input.lenoseedId, input.relevantEpisodeKey),
  );
  if (activeMemory === null) {
    return { situationEvent: input.situationEvent, memorySnapshot: null };
  }
  if (activeMemory.version !== 1 || activeMemory.status !== "active") {
    throw new DomainInvariantError("G0-A3 Memory decision retrieval supports only active version 1");
  }

  const { evidenceItemsById, eventsById, sourcesById } = await readV1Provenance(
    input.lenoseedId,
    activeMemory,
    persistence,
  );
  validateG0A3Memory(activeMemory, {
    evidenceItemsById,
    eventsById,
    sourcesById,
    memoryHistory: [activeMemory],
  });
  return {
    situationEvent: input.situationEvent,
    memorySnapshot: buildV1Snapshot(activeMemory, evidenceItemsById),
  };
}

async function readV1Provenance(
  lenoseedId: EntityId,
  memory: Memory,
  persistence: PersistencePort,
): Promise<{
  readonly evidenceItemsById: ReadonlyMap<EntityId, EvidenceItem>;
  readonly eventsById: ReadonlyMap<EntityId, Event>;
  readonly sourcesById: ReadonlyMap<EntityId, Source>;
}> {
  const ids = initialIds(lenoseedId);
  const eventIds = [
    ids.requestEventId,
    ids.intentionEventId,
    ids.failureEventId,
    ids.initialExplanationEventId,
  ];
  const evidenceIds = [ids.e1Id, ids.e2Id, ids.e3Id];
  const events = await Promise.all(eventIds.map((id) => requiredRead(persistence.readEventById(lenoseedId, id), "Event", id)));
  const evidence = await Promise.all(evidenceIds.map((id) => requiredRead(persistence.readEvidenceItem(lenoseedId, id), "EvidenceItem", id)));
  const sourceIds = [...new Set(events.map((event) => event.sourceId))];
  const sources = await Promise.all(sourceIds.map((id) => requiredRead(persistence.readSource(id), "Source", id)));
  return {
    eventsById: new Map(events.map((event) => [event.id, event])),
    evidenceItemsById: new Map(evidence.map((item) => [item.id, item])),
    sourcesById: new Map(sources.map((source) => [source.id, source])),
  };
}

async function requiredRead<T>(promise: Promise<T | null>, kind: string, id: EntityId): Promise<T> {
  const value = await promise;
  if (value === null) throw new DomainInvariantError(`G0-A3 Memory requires ${kind} ${id}`);
  return value;
}

function buildV1Snapshot(
  memory: Memory,
  evidenceItemsById: ReadonlyMap<EntityId, EvidenceItem>,
): G0A3MemoryDecisionSnapshot {
  const ids = initialIds(memory.lenoseedId);
  const selectedConfiguration = evidenceItemsById.get(ids.e1Id)?.proposition.value;
  const reportedOutcome = evidenceItemsById.get(ids.e2Id)?.proposition.value;
  const currentFailureAttribution = evidenceItemsById.get(ids.e3Id)?.proposition.value;
  if (
    selectedConfiguration !== "A" ||
    reportedOutcome !== "failure" ||
    currentFailureAttribution !== "configuration_a_sensor_incompatibility"
  ) {
    throw new DomainInvariantError("G0-A3 Memory v1 evidence does not support a decision snapshot");
  }
  return {
    memory,
    selectedConfiguration,
    reportedOutcome,
    currentFailureAttribution,
    configurationACompatibility: "unknown",
  };
}
