import type { Belief } from "../domain/belief.js";
import {
  DomainInvariantError,
  IdempotencyConflictError,
  NotFoundError,
  StateVersionConflictError,
} from "../domain/errors.js";
import type { EvidenceItem, EvidenceLink } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import { propositionEquals } from "../domain/proposition.js";
import type { EntityId, StateVersion, TurnId } from "../domain/primitives.js";
import type { Source } from "../domain/source.js";
import type {
  AtomicCommitResult,
  CommitMutations,
  PersistencePort,
} from "../ports/persistence.js";

interface KinseedBucket {
  stateVersion: StateVersion;
  readonly events: Event[];
  readonly eventsById: Map<EntityId, Event>;
  readonly eventIdempotency: Map<string, EntityId>;
  readonly evidenceItems: Map<EntityId, EvidenceItem>;
  readonly evidenceLinks: Map<EntityId, EvidenceLink>;
  readonly beliefs: Map<EntityId, Belief>;
  readonly commitResults: Map<string, AtomicCommitResult>;
}

export class InMemoryStore implements PersistencePort {
  private readonly sources = new Map<EntityId, Source>();
  private readonly kinseeds = new Map<EntityId, KinseedBucket>();

  async registerSource(source: Source): Promise<void> {
    const existing = this.sources.get(source.id);
    if (existing !== undefined) {
      if (JSON.stringify(existing) === JSON.stringify(source)) {
        return;
      }
      throw new DomainInvariantError(`Source ${source.id} already exists with different content`);
    }
    this.sources.set(source.id, source);
  }

  async readSource(sourceId: EntityId): Promise<Source | null> {
    return this.sources.get(sourceId) ?? null;
  }

  async getStateVersion(kinseedId: EntityId): Promise<StateVersion> {
    return this.getBucket(kinseedId).stateVersion;
  }

  async appendEvent(event: Event): Promise<void> {
    let bucket = this.kinseeds.get(event.kinseedId);

    if (bucket === undefined) {
      if (event.type !== "kinseed_created") {
        throw new NotFoundError(`Kinseed ${event.kinseedId} has not been created`);
      }
      bucket = this.createBucket();
      this.kinseeds.set(event.kinseedId, bucket);
    }

    const existingForKey = bucket.eventIdempotency.get(event.idempotencyKey);
    if (existingForKey !== undefined) {
      if (existingForKey === event.id) {
        return;
      }
      throw new IdempotencyConflictError(event.idempotencyKey);
    }

    if (bucket.eventsById.has(event.id)) {
      throw new DomainInvariantError(`Event ${event.id} already exists`);
    }

    const lastEvent = bucket.events.at(-1);
    if (lastEvent !== undefined && event.sequence <= lastEvent.sequence) {
      throw new DomainInvariantError(
        `Event sequence must increase: last=${lastEvent.sequence}, next=${event.sequence}`,
      );
    }

    if ((await this.readSource(event.sourceId)) === null) {
      throw new DomainInvariantError(`Event ${event.id} references unknown source ${event.sourceId}`);
    }

    bucket.events.push(event);
    bucket.eventsById.set(event.id, event);
    bucket.eventIdempotency.set(event.idempotencyKey, event.id);
  }

  async readEventById(kinseedId: EntityId, eventId: EntityId): Promise<Event | null> {
    return this.getBucket(kinseedId).eventsById.get(eventId) ?? null;
  }

  async readEventsInSequence(kinseedId: EntityId): Promise<readonly Event[]> {
    return [...this.getBucket(kinseedId).events];
  }

  async readEventsByTurn(kinseedId: EntityId, turnId: TurnId): Promise<readonly Event[]> {
    return this.getBucket(kinseedId).events.filter((event) => event.turnId === turnId);
  }

  async readEvidenceItem(
    kinseedId: EntityId,
    evidenceItemId: EntityId,
  ): Promise<EvidenceItem | null> {
    return this.getBucket(kinseedId).evidenceItems.get(evidenceItemId) ?? null;
  }

  async readEvidenceLink(
    kinseedId: EntityId,
    evidenceLinkId: EntityId,
  ): Promise<EvidenceLink | null> {
    return this.getBucket(kinseedId).evidenceLinks.get(evidenceLinkId) ?? null;
  }

  async readActiveBeliefByKey(kinseedId: EntityId, beliefKey: string): Promise<Belief | null> {
    const matches = [...this.getBucket(kinseedId).beliefs.values()].filter(
      (belief) => belief.beliefKey === beliefKey && belief.status === "active",
    );

    if (matches.length > 1) {
      throw new DomainInvariantError(`More than one active belief for key ${beliefKey}`);
    }

    return matches[0] ?? null;
  }

  async readBeliefHistoryByKey(kinseedId: EntityId, beliefKey: string): Promise<readonly Belief[]> {
    return [...this.getBucket(kinseedId).beliefs.values()]
      .filter((belief) => belief.beliefKey === beliefKey)
      .sort((left, right) => left.version - right.version);
  }

  async atomicCommit(
    kinseedId: EntityId,
    expectedStateVersion: StateVersion,
    mutations: CommitMutations,
    idempotencyKey: string,
  ): Promise<AtomicCommitResult> {
    const bucket = this.getBucket(kinseedId);
    const previousResult = bucket.commitResults.get(idempotencyKey);
    if (previousResult !== undefined) {
      return previousResult;
    }

    if (bucket.stateVersion !== expectedStateVersion) {
      throw new StateVersionConflictError(expectedStateVersion, bucket.stateVersion);
    }

    const nextEvidenceItems = new Map(bucket.evidenceItems);
    const nextEvidenceLinks = new Map(bucket.evidenceLinks);
    const nextBeliefs = new Map(bucket.beliefs);

    for (const evidenceItem of mutations.evidenceItems) {
      this.assertSameKinseed(kinseedId, evidenceItem.kinseedId, evidenceItem.id);
      if (nextEvidenceItems.has(evidenceItem.id)) {
        throw new DomainInvariantError(`EvidenceItem ${evidenceItem.id} already exists`);
      }
      nextEvidenceItems.set(evidenceItem.id, evidenceItem);
    }

    for (const belief of mutations.beliefs) {
      this.assertSameKinseed(kinseedId, belief.kinseedId, belief.id);
      const existing = nextBeliefs.get(belief.id);
      if (existing !== undefined) {
        this.assertBeliefReplacementIsSafe(existing, belief);
      }
      nextBeliefs.set(belief.id, belief);
    }

    for (const evidenceLink of mutations.evidenceLinks) {
      this.assertSameKinseed(kinseedId, evidenceLink.kinseedId, evidenceLink.id);
      if (nextEvidenceLinks.has(evidenceLink.id)) {
        throw new DomainInvariantError(`EvidenceLink ${evidenceLink.id} already exists`);
      }
      nextEvidenceLinks.set(evidenceLink.id, evidenceLink);
    }

    this.validateResultingState(nextEvidenceItems, nextEvidenceLinks, nextBeliefs);

    const changed =
      mutations.evidenceItems.length > 0 ||
      mutations.evidenceLinks.length > 0 ||
      mutations.beliefs.length > 0;

    bucket.evidenceItems.clear();
    for (const [id, item] of nextEvidenceItems) bucket.evidenceItems.set(id, item);
    bucket.evidenceLinks.clear();
    for (const [id, link] of nextEvidenceLinks) bucket.evidenceLinks.set(id, link);
    bucket.beliefs.clear();
    for (const [id, belief] of nextBeliefs) bucket.beliefs.set(id, belief);

    const previousStateVersion = bucket.stateVersion;
    if (changed) {
      bucket.stateVersion += 1;
    }

    const result: AtomicCommitResult = {
      applied: changed,
      previousStateVersion,
      newStateVersion: bucket.stateVersion,
    };
    bucket.commitResults.set(idempotencyKey, result);
    return result;
  }

  async checkIdempotencyKey(kinseedId: EntityId, idempotencyKey: string): Promise<boolean> {
    const bucket = this.getBucket(kinseedId);
    return (
      bucket.eventIdempotency.has(idempotencyKey) || bucket.commitResults.has(idempotencyKey)
    );
  }

  private createBucket(): KinseedBucket {
    return {
      stateVersion: 0,
      events: [],
      eventsById: new Map(),
      eventIdempotency: new Map(),
      evidenceItems: new Map(),
      evidenceLinks: new Map(),
      beliefs: new Map(),
      commitResults: new Map(),
    };
  }

  private getBucket(kinseedId: EntityId): KinseedBucket {
    const bucket = this.kinseeds.get(kinseedId);
    if (bucket === undefined) {
      throw new NotFoundError(`Unknown Kinseed ${kinseedId}`);
    }
    return bucket;
  }

  private assertSameKinseed(expected: EntityId, actual: EntityId, entityId: EntityId): void {
    if (expected !== actual) {
      throw new DomainInvariantError(
        `Entity ${entityId} belongs to ${actual}, expected Kinseed ${expected}`,
      );
    }
  }

  private assertBeliefReplacementIsSafe(existing: Belief, replacement: Belief): void {
    if (
      existing.id !== replacement.id ||
      existing.kinseedId !== replacement.kinseedId ||
      existing.beliefKey !== replacement.beliefKey ||
      existing.version !== replacement.version ||
      !propositionEquals(existing.proposition, replacement.proposition) ||
      existing.previousVersionId !== replacement.previousVersionId ||
      existing.createdAt !== replacement.createdAt
    ) {
      throw new DomainInvariantError(`Belief ${existing.id} immutable fields cannot be rewritten`);
    }
  }

  private validateResultingState(
    evidenceItems: ReadonlyMap<EntityId, EvidenceItem>,
    evidenceLinks: ReadonlyMap<EntityId, EvidenceLink>,
    beliefs: ReadonlyMap<EntityId, Belief>,
  ): void {
    for (const evidenceItem of evidenceItems.values()) {
      if (evidenceItem.eventIds.length === 0) {
        throw new DomainInvariantError(
          `EvidenceItem ${evidenceItem.id} must reference at least one event`,
        );
      }
    }

    for (const link of evidenceLinks.values()) {
      if (!evidenceItems.has(link.evidenceItemId)) {
        throw new DomainInvariantError(
          `EvidenceLink ${link.id} references unknown EvidenceItem ${link.evidenceItemId}`,
        );
      }
      if (!beliefs.has(link.targetBeliefId)) {
        throw new DomainInvariantError(
          `EvidenceLink ${link.id} references unknown Belief ${link.targetBeliefId}`,
        );
      }
    }

    const activeByKey = new Map<string, EntityId>();
    for (const belief of beliefs.values()) {
      if (belief.previousVersionId !== null) {
        const previous = beliefs.get(belief.previousVersionId);
        if (previous === undefined || previous.beliefKey !== belief.beliefKey) {
          throw new DomainInvariantError(
            `Belief ${belief.id} has invalid previousVersionId ${belief.previousVersionId}`,
          );
        }
      }

      for (const linkId of belief.evidenceForLinkIds) {
        const link = evidenceLinks.get(linkId);
        if (
          link === undefined ||
          link.targetBeliefId !== belief.id ||
          link.relation !== "supports"
        ) {
          throw new DomainInvariantError(
            `Belief ${belief.id} has invalid supporting EvidenceLink ${linkId}`,
          );
        }
      }

      for (const linkId of belief.evidenceAgainstLinkIds) {
        const link = evidenceLinks.get(linkId);
        if (
          link === undefined ||
          link.targetBeliefId !== belief.id ||
          link.relation !== "contradicts"
        ) {
          throw new DomainInvariantError(
            `Belief ${belief.id} has invalid contradicting EvidenceLink ${linkId}`,
          );
        }
      }

      if (belief.status === "active") {
        const existingActive = activeByKey.get(belief.beliefKey);
        if (existingActive !== undefined) {
          throw new DomainInvariantError(
            `Beliefs ${existingActive} and ${belief.id} are both active for ${belief.beliefKey}`,
          );
        }
        activeByKey.set(belief.beliefKey, belief.id);
      }
    }
  }
}
