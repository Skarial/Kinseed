import type { Belief } from "../domain/belief.js";
import {
  DomainInvariantError,
  IdempotencyConflictError,
  NotFoundError,
  StateVersionConflictError,
} from "../domain/errors.js";
import type { EvidenceItem, EvidenceLink } from "../domain/evidence.js";
import {
  validateBehavioralObservationGrounding,
  validateTextEvidenceGrounding,
} from "../domain/evidence-grounding.js";
import type { Event } from "../domain/event.js";
import { propositionEquals } from "../domain/proposition.js";
import type { EntityId, StateVersion, TurnId } from "../domain/primitives.js";
import { buildSelfHypothesisKey, type SelfHypothesis } from "../domain/self-hypothesis.js";
import type { Source } from "../domain/source.js";
import type {
  AtomicCommitResult,
  CommitMutations,
  PersistencePort,
} from "../ports/persistence.js";

interface LenoseedBucket {
  stateVersion: StateVersion;
  readonly events: Event[];
  readonly eventsById: Map<EntityId, Event>;
  readonly eventIdempotency: Map<string, EntityId>;
  readonly evidenceItems: Map<EntityId, EvidenceItem>;
  readonly evidenceLinks: Map<EntityId, EvidenceLink>;
  readonly beliefs: Map<EntityId, Belief>;
  readonly selfHypotheses: Map<EntityId, SelfHypothesis>;
  readonly commitResults: Map<string, { readonly result: AtomicCommitResult; readonly fingerprint: string }>;
}

export class InMemoryStore implements PersistencePort {
  private readonly sources = new Map<EntityId, Source>();
  private readonly lenoseeds = new Map<EntityId, LenoseedBucket>();
  private nextAtomicCommitFailure: Error | null = null;

  failNextAtomicCommitForTests(error = new Error("Injected atomic commit failure")): void {
    this.nextAtomicCommitFailure = error;
  }

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

  async getStateVersion(lenoseedId: EntityId): Promise<StateVersion> {
    return this.getBucket(lenoseedId).stateVersion;
  }

  async appendEvent(event: Event): Promise<void> {
    let bucket = this.lenoseeds.get(event.lenoseedId);

    if (bucket === undefined) {
      if (event.type !== "lenoseed_created") {
        throw new NotFoundError(`Lenoseed ${event.lenoseedId} has not been created`);
      }
      bucket = this.createBucket();
      this.lenoseeds.set(event.lenoseedId, bucket);
    }

    const existingForKey = bucket.eventIdempotency.get(event.idempotencyKey);
    if (existingForKey !== undefined) {
      const existingEvent = bucket.eventsById.get(existingForKey);
      if (existingForKey === event.id && JSON.stringify(existingEvent) === JSON.stringify(event)) {
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

  async readEventById(lenoseedId: EntityId, eventId: EntityId): Promise<Event | null> {
    return this.getBucket(lenoseedId).eventsById.get(eventId) ?? null;
  }

  async readEventsInSequence(lenoseedId: EntityId): Promise<readonly Event[]> {
    return [...this.getBucket(lenoseedId).events];
  }

  async readEventsByTurn(lenoseedId: EntityId, turnId: TurnId): Promise<readonly Event[]> {
    return this.getBucket(lenoseedId).events.filter((event) => event.turnId === turnId);
  }

  async readEvidenceItem(
    lenoseedId: EntityId,
    evidenceItemId: EntityId,
  ): Promise<EvidenceItem | null> {
    return this.getBucket(lenoseedId).evidenceItems.get(evidenceItemId) ?? null;
  }

  async readEvidenceLink(
    lenoseedId: EntityId,
    evidenceLinkId: EntityId,
  ): Promise<EvidenceLink | null> {
    return this.getBucket(lenoseedId).evidenceLinks.get(evidenceLinkId) ?? null;
  }

  async readActiveBeliefByKey(lenoseedId: EntityId, beliefKey: string): Promise<Belief | null> {
    const matches = [...this.getBucket(lenoseedId).beliefs.values()].filter(
      (belief) => belief.beliefKey === beliefKey && belief.status === "active",
    );

    if (matches.length > 1) {
      throw new DomainInvariantError(`More than one active belief for key ${beliefKey}`);
    }

    return matches[0] ?? null;
  }

  async readBeliefHistoryByKey(lenoseedId: EntityId, beliefKey: string): Promise<readonly Belief[]> {
    return [...this.getBucket(lenoseedId).beliefs.values()]
      .filter((belief) => belief.beliefKey === beliefKey)
      .sort((left, right) => left.version - right.version);
  }

  async readSelfHypothesis(
    lenoseedId: EntityId,
    selfHypothesisId: EntityId,
  ): Promise<SelfHypothesis | null> {
    return this.getBucket(lenoseedId).selfHypotheses.get(selfHypothesisId) ?? null;
  }

  async readActiveSelfHypothesisByKey(
    lenoseedId: EntityId,
    hypothesisKey: string,
  ): Promise<SelfHypothesis | null> {
    const matches = [...this.getBucket(lenoseedId).selfHypotheses.values()].filter(
      (hypothesis) => hypothesis.hypothesisKey === hypothesisKey && hypothesis.status === "active",
    );
    if (matches.length > 1) {
      throw new DomainInvariantError(`More than one active SelfHypothesis for key ${hypothesisKey}`);
    }
    return matches[0] ?? null;
  }

  async readSelfHypothesisHistoryByKey(
    lenoseedId: EntityId,
    hypothesisKey: string,
  ): Promise<readonly SelfHypothesis[]> {
    return [...this.getBucket(lenoseedId).selfHypotheses.values()]
      .filter((hypothesis) => hypothesis.hypothesisKey === hypothesisKey)
      .sort((left, right) => left.version - right.version);
  }

  async atomicCommit(
    lenoseedId: EntityId,
    expectedStateVersion: StateVersion,
    mutations: CommitMutations,
    idempotencyKey: string,
  ): Promise<AtomicCommitResult> {
    const bucket = this.getBucket(lenoseedId);
    const fingerprint = JSON.stringify(mutations);
    const previousCommit = bucket.commitResults.get(idempotencyKey);
    if (previousCommit !== undefined) {
      if (previousCommit.fingerprint !== fingerprint) {
        throw new IdempotencyConflictError(idempotencyKey);
      }
      return previousCommit.result;
    }

    if (bucket.stateVersion !== expectedStateVersion) {
      throw new StateVersionConflictError(expectedStateVersion, bucket.stateVersion);
    }

    const nextEvidenceItems = new Map(bucket.evidenceItems);
    const nextEvidenceLinks = new Map(bucket.evidenceLinks);
    const nextBeliefs = new Map(bucket.beliefs);
    const nextSelfHypotheses = new Map(bucket.selfHypotheses);

    for (const evidenceItem of mutations.evidenceItems) {
      this.assertSameLenoseed(lenoseedId, evidenceItem.lenoseedId, evidenceItem.id);
      if (nextEvidenceItems.has(evidenceItem.id)) {
        throw new DomainInvariantError(`EvidenceItem ${evidenceItem.id} already exists`);
      }
      nextEvidenceItems.set(evidenceItem.id, evidenceItem);
    }

    for (const belief of mutations.beliefs) {
      this.assertSameLenoseed(lenoseedId, belief.lenoseedId, belief.id);
      const existing = nextBeliefs.get(belief.id);
      if (existing !== undefined) {
        this.assertBeliefReplacementIsSafe(existing, belief);
      }
      nextBeliefs.set(belief.id, belief);
    }

    for (const hypothesis of mutations.selfHypotheses) {
      this.assertSameLenoseed(lenoseedId, hypothesis.lenoseedId, hypothesis.id);
      const existing = nextSelfHypotheses.get(hypothesis.id);
      if (existing !== undefined) {
        this.assertSelfHypothesisReplacementIsSafe(existing, hypothesis);
      }
      nextSelfHypotheses.set(hypothesis.id, hypothesis);
    }

    for (const evidenceLink of mutations.evidenceLinks) {
      this.assertSameLenoseed(lenoseedId, evidenceLink.lenoseedId, evidenceLink.id);
      if (nextEvidenceLinks.has(evidenceLink.id)) {
        throw new DomainInvariantError(`EvidenceLink ${evidenceLink.id} already exists`);
      }
      nextEvidenceLinks.set(evidenceLink.id, evidenceLink);
    }

    this.validateResultingState(
      bucket.eventsById,
      nextEvidenceItems,
      nextEvidenceLinks,
      nextBeliefs,
      nextSelfHypotheses,
    );

    if (this.nextAtomicCommitFailure !== null) {
      const error = this.nextAtomicCommitFailure;
      this.nextAtomicCommitFailure = null;
      throw error;
    }

    const changed =
      mutations.evidenceItems.length > 0 ||
      mutations.evidenceLinks.length > 0 ||
      mutations.beliefs.length > 0 ||
      mutations.selfHypotheses.length > 0;

    bucket.evidenceItems.clear();
    for (const [id, item] of nextEvidenceItems) bucket.evidenceItems.set(id, item);
    bucket.evidenceLinks.clear();
    for (const [id, link] of nextEvidenceLinks) bucket.evidenceLinks.set(id, link);
    bucket.beliefs.clear();
    for (const [id, belief] of nextBeliefs) bucket.beliefs.set(id, belief);
    bucket.selfHypotheses.clear();
    for (const [id, hypothesis] of nextSelfHypotheses) bucket.selfHypotheses.set(id, hypothesis);

    const previousStateVersion = bucket.stateVersion;
    if (changed) {
      bucket.stateVersion += 1;
    }

    const result: AtomicCommitResult = {
      applied: changed,
      previousStateVersion,
      newStateVersion: bucket.stateVersion,
    };
    bucket.commitResults.set(idempotencyKey, { result, fingerprint });
    return result;
  }

  async checkIdempotencyKey(lenoseedId: EntityId, idempotencyKey: string): Promise<boolean> {
    const bucket = this.getBucket(lenoseedId);
    return (
      bucket.eventIdempotency.has(idempotencyKey) || bucket.commitResults.has(idempotencyKey)
    );
  }

  private createBucket(): LenoseedBucket {
    return {
      stateVersion: 0,
      events: [],
      eventsById: new Map(),
      eventIdempotency: new Map(),
      evidenceItems: new Map(),
      evidenceLinks: new Map(),
      beliefs: new Map(),
      selfHypotheses: new Map(),
      commitResults: new Map(),
    };
  }

  private getBucket(lenoseedId: EntityId): LenoseedBucket {
    const bucket = this.lenoseeds.get(lenoseedId);
    if (bucket === undefined) {
      throw new NotFoundError(`Unknown Lenoseed ${lenoseedId}`);
    }
    return bucket;
  }

  private assertSameLenoseed(expected: EntityId, actual: EntityId, entityId: EntityId): void {
    if (expected !== actual) {
      throw new DomainInvariantError(
        `Entity ${entityId} belongs to ${actual}, expected Lenoseed ${expected}`,
      );
    }
  }

  private assertBeliefReplacementIsSafe(existing: Belief, replacement: Belief): void {
    if (
      existing.id !== replacement.id ||
      existing.lenoseedId !== replacement.lenoseedId ||
      existing.beliefKey !== replacement.beliefKey ||
      existing.version !== replacement.version ||
      !propositionEquals(existing.proposition, replacement.proposition) ||
      existing.previousVersionId !== replacement.previousVersionId ||
      existing.createdAt !== replacement.createdAt
    ) {
      throw new DomainInvariantError(`Belief ${existing.id} immutable fields cannot be rewritten`);
    }
  }

  private assertSelfHypothesisReplacementIsSafe(
    existing: SelfHypothesis,
    replacement: SelfHypothesis,
  ): void {
    if (
      existing.id !== replacement.id ||
      existing.lenoseedId !== replacement.lenoseedId ||
      existing.hypothesisKey !== replacement.hypothesisKey ||
      existing.version !== replacement.version ||
      !propositionEquals(existing.proposition, replacement.proposition) ||
      existing.stage !== replacement.stage ||
      existing.previousVersionId !== replacement.previousVersionId ||
      existing.createdAt !== replacement.createdAt
    ) {
      throw new DomainInvariantError(
        `SelfHypothesis ${existing.id} immutable fields cannot be rewritten`,
      );
    }
    if (
      existing.confidence !== replacement.confidence ||
      JSON.stringify(existing.supportLinkIds) !== JSON.stringify(replacement.supportLinkIds) ||
      JSON.stringify(existing.againstLinkIds) !== JSON.stringify(replacement.againstLinkIds) ||
      existing.status === "superseded" ||
      (existing.status !== "active" && existing.status !== "disputed") ||
      replacement.status !== "superseded"
    ) {
      throw new DomainInvariantError(
        `SelfHypothesis ${existing.id} replacement may only supersede the current historical version`,
      );
    }
  }

  private validateResultingState(
    eventsById: ReadonlyMap<EntityId, Event>,
    evidenceItems: ReadonlyMap<EntityId, EvidenceItem>,
    evidenceLinks: ReadonlyMap<EntityId, EvidenceLink>,
    beliefs: ReadonlyMap<EntityId, Belief>,
    selfHypotheses: ReadonlyMap<EntityId, SelfHypothesis>,
  ): void {
    for (const evidenceItem of evidenceItems.values()) {
      if (!this.sources.has(evidenceItem.sourceId)) {
        throw new DomainInvariantError(
          `EvidenceItem ${evidenceItem.id} references unknown source ${evidenceItem.sourceId}`,
        );
      }

      if (evidenceItem.eventIds.length === 0) {
        throw new DomainInvariantError(
          `EvidenceItem ${evidenceItem.id} must reference at least one event`,
        );
      }

      for (const eventId of evidenceItem.eventIds) {
        const event = eventsById.get(eventId);
        if (event === undefined) {
          throw new DomainInvariantError(
            `EvidenceItem ${evidenceItem.id} references unknown event ${eventId}`,
          );
        }
        if (event.sourceId !== evidenceItem.sourceId) {
          throw new DomainInvariantError(
            `EvidenceItem ${evidenceItem.id} source does not match event ${eventId} source`,
          );
        }
        if (evidenceItem.kind === "testimony" && event.type !== "human_message_received") {
          throw new DomainInvariantError(
            `Testimony ${evidenceItem.id} must originate from a human_message_received event`,
          );
        }
      }

      if (evidenceItem.kind === "testimony") {
        if (evidenceItem.grounding === null) {
          throw new DomainInvariantError(`Testimony ${evidenceItem.id} must have grounding`);
        }
        const groundingEvent = eventsById.get(evidenceItem.grounding.eventId);
        if (groundingEvent === undefined) {
          throw new DomainInvariantError(
            `EvidenceItem ${evidenceItem.id} references unknown grounding event ${evidenceItem.grounding.eventId}`,
          );
        }
        const groundingRejection = validateTextEvidenceGrounding(evidenceItem, groundingEvent);
        if (groundingRejection !== null) {
          throw new DomainInvariantError(
            `EvidenceItem ${evidenceItem.id} failed grounding: ${groundingRejection}`,
          );
        }
      }

      if (evidenceItem.kind === "behavioral_observation") {
        const source = this.sources.get(evidenceItem.sourceId);
        if (source?.kind !== "system") {
          throw new DomainInvariantError(
            `Behavioral observation ${evidenceItem.id} must use a system source`,
          );
        }
        if (evidenceItem.grounding === null) {
          throw new DomainInvariantError(`Behavioral observation ${evidenceItem.id} must have grounding`);
        }
        const groundingEvent = eventsById.get(evidenceItem.grounding.eventId);
        if (groundingEvent === undefined) {
          throw new DomainInvariantError(
            `EvidenceItem ${evidenceItem.id} references unknown grounding event ${evidenceItem.grounding.eventId}`,
          );
        }
        validateBehavioralObservationGrounding(evidenceItem, groundingEvent);
      }

      if (evidenceItem.supersedesId !== null) {
        const superseded = evidenceItems.get(evidenceItem.supersedesId);
        if (superseded === undefined || superseded.id === evidenceItem.id) {
          throw new DomainInvariantError(
            `EvidenceItem ${evidenceItem.id} has invalid supersedesId ${evidenceItem.supersedesId}`,
          );
        }
      }
    }

    for (const link of evidenceLinks.values()) {
      if (!evidenceItems.has(link.evidenceItemId)) {
        throw new DomainInvariantError(
          `EvidenceLink ${link.id} references unknown EvidenceItem ${link.evidenceItemId}`,
        );
      }
      if (link.targetType !== "belief" && link.targetType !== "self_hypothesis") {
        throw new DomainInvariantError(`EvidenceLink ${link.id} has invalid targetType`);
      }
      if (
        link.causalContamination !== "none" &&
        link.causalContamination !== "influenced_by_target"
      ) {
        throw new DomainInvariantError(`EvidenceLink ${link.id} has invalid causalContamination`);
      }
      if (link.targetType === "belief" && !beliefs.has(link.targetId)) {
        throw new DomainInvariantError(
          `EvidenceLink ${link.id} references unknown Belief ${link.targetId}`,
        );
      }
      if (link.targetType === "self_hypothesis" && !selfHypotheses.has(link.targetId)) {
        throw new DomainInvariantError(
          `EvidenceLink ${link.id} references unknown SelfHypothesis ${link.targetId}`,
        );
      }
      if (link.targetType === "self_hypothesis") {
        const evidenceItem = evidenceItems.get(link.evidenceItemId);
        const hypothesis = selfHypotheses.get(link.targetId);
        if (evidenceItem === undefined || hypothesis === undefined || evidenceItem.kind !== "behavioral_observation") {
          throw new DomainInvariantError(`EvidenceLink ${link.id} must target SelfHypothesis from behavioral observation`);
        }
        const situationId = evidenceItem.proposition.context.situationId;
        if (typeof situationId !== "string" || link.independenceGroup !== `g0a2:${situationId}`) {
          throw new DomainInvariantError(`EvidenceLink ${link.id} has forged independenceGroup`);
        }
        const expectedRelation = evidenceItem.proposition.value === hypothesis.proposition.value
          ? "supports"
          : "contradicts";
        if (link.relation !== expectedRelation) {
          throw new DomainInvariantError(`EvidenceLink ${link.id} has relation inconsistent with observation`);
        }
        const sourceEvent = evidenceItem.grounding === null
          ? undefined
          : eventsById.get(evidenceItem.grounding.eventId);
        if (sourceEvent === undefined) {
          throw new DomainInvariantError(`EvidenceLink ${link.id} has invalid behavioral provenance`);
        }
        validateBehavioralObservationGrounding(evidenceItem, sourceEvent);
        const triggerIds = sourceEvent.payload.triggerSelfHypothesisIds;
        if (!Array.isArray(triggerIds) || !triggerIds.every((id) => typeof id === "string")) {
          throw new DomainInvariantError(`EvidenceLink ${link.id} has invalid causal provenance`);
        }
        const triggerHypotheses = triggerIds.map((triggerId) => {
          const trigger = selfHypotheses.get(triggerId);
          if (trigger === undefined) {
            throw new DomainInvariantError(
              `EvidenceLink ${link.id} references unknown trigger SelfHypothesis ${triggerId}`,
            );
          }
          return trigger;
        });
        const influencedByTarget = triggerHypotheses.some(
          (trigger) => trigger.hypothesisKey === hypothesis.hypothesisKey,
        );
        const expectedContamination = influencedByTarget ? "influenced_by_target" : "none";
        const expectedWeight = influencedByTarget ? "low" : "high";
        if (
          link.causalContamination !== expectedContamination ||
          link.sourceAuthority !== "high" ||
          link.weightClass !== expectedWeight
        ) {
          throw new DomainInvariantError(`EvidenceLink ${link.id} has weight inconsistent with causal provenance`);
        }
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
          link.targetType !== "belief" ||
          link.targetId !== belief.id ||
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
          link.targetType !== "belief" ||
          link.targetId !== belief.id ||
          link.relation !== "contradicts"
        ) {
          throw new DomainInvariantError(
            `Belief ${belief.id} has invalid contradicting EvidenceLink ${linkId}`,
          );
        }
      }

      if (belief.status === "active") {
        if (belief.evidenceForLinkIds.length === 0) {
          throw new DomainInvariantError(
            `Active belief ${belief.id} must have at least one supporting EvidenceLink`,
          );
        }

        const existingActive = activeByKey.get(belief.beliefKey);
        if (existingActive !== undefined) {
          throw new DomainInvariantError(
            `Beliefs ${existingActive} and ${belief.id} are both active for ${belief.beliefKey}`,
          );
        }
        activeByKey.set(belief.beliefKey, belief.id);
      }
    }

    const selfHypothesesByKey = new Map<string, SelfHypothesis[]>();
    for (const hypothesis of selfHypotheses.values()) {
      if (hypothesis.hypothesisKey !== buildSelfHypothesisKey(hypothesis.proposition)) {
        throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has inconsistent hypothesisKey`);
      }
      if (
        hypothesis.proposition.subjectRef !== hypothesis.lenoseedId ||
        hypothesis.proposition.predicate !== "decision_style_under_uncertainty" ||
        hypothesis.proposition.context.protocol !== "G0-A2" ||
        (hypothesis.proposition.value !== "seek_clarification" &&
          hypothesis.proposition.value !== "use_available_information")
      ) {
        throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid G0-A2 proposition`);
      }
      if (hypothesis.stage !== "hypothesis") {
        throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid stage`);
      }
      if (
        hypothesis.status !== "active" &&
        hypothesis.status !== "disputed" &&
        hypothesis.status !== "superseded"
      ) {
        throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid status`);
      }
      if (hypothesis.confidence !== "low" && hypothesis.confidence !== "moderate") {
        throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid G0-A2 confidence`);
      }
      if (!Number.isInteger(hypothesis.version) || hypothesis.version < 1) {
        throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid version`);
      }
      if (hypothesis.version === 1 && hypothesis.previousVersionId !== null) {
        throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} version 1 must not have predecessor`);
      }
      if (hypothesis.version > 1) {
        if (hypothesis.previousVersionId === null) {
          throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} must have predecessor`);
        }
        const previous = selfHypotheses.get(hypothesis.previousVersionId);
        if (
          previous === undefined ||
          previous.hypothesisKey !== hypothesis.hypothesisKey ||
          previous.version !== hypothesis.version - 1
        ) {
          throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid predecessor`);
        }
      }
      for (const linkId of hypothesis.supportLinkIds) {
        const link = evidenceLinks.get(linkId);
        if (
          link === undefined ||
          link.targetType !== "self_hypothesis" ||
          link.targetId !== hypothesis.id ||
          link.relation !== "supports"
        ) {
          throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid supporting EvidenceLink ${linkId}`);
        }
      }
      for (const linkId of hypothesis.againstLinkIds) {
        const link = evidenceLinks.get(linkId);
        if (
          link === undefined ||
          link.targetType !== "self_hypothesis" ||
          link.targetId !== hypothesis.id ||
          link.relation !== "contradicts"
        ) {
          throw new DomainInvariantError(`SelfHypothesis ${hypothesis.id} has invalid contradicting EvidenceLink ${linkId}`);
        }
      }
      if (hypothesis.status === "active") {
        if (hypothesis.confidence !== "moderate") {
          throw new DomainInvariantError(`Active SelfHypothesis ${hypothesis.id} must have moderate confidence`);
        }
        const supportGroups = new Set<string>();
        const againstGroups = new Set<string>();
        for (const linkId of hypothesis.supportLinkIds) {
          const link = evidenceLinks.get(linkId);
          if (link?.causalContamination === "none") supportGroups.add(link.independenceGroup);
        }
        for (const linkId of hypothesis.againstLinkIds) {
          const link = evidenceLinks.get(linkId);
          if (link?.causalContamination === "none") againstGroups.add(link.independenceGroup);
        }
        for (const group of [...supportGroups]) {
          if (againstGroups.has(group)) {
            supportGroups.delete(group);
            againstGroups.delete(group);
          }
        }
        if (supportGroups.size < 3 || againstGroups.size < 1) {
          throw new DomainInvariantError(`Active SelfHypothesis ${hypothesis.id} does not satisfy G0-A2 threshold`);
        }
      }
      if (hypothesis.status === "disputed" && hypothesis.confidence !== "low") {
        throw new DomainInvariantError(`Disputed SelfHypothesis ${hypothesis.id} must have low confidence`);
      }
      const history = selfHypothesesByKey.get(hypothesis.hypothesisKey) ?? [];
      history.push(hypothesis);
      selfHypothesesByKey.set(hypothesis.hypothesisKey, history);
    }

    for (const [hypothesisKey, history] of selfHypothesesByKey) {
      const byVersion = new Map<number, SelfHypothesis>();
      let current: SelfHypothesis | null = null;
      let highestVersion = 0;

      for (const hypothesis of history) {
        if (byVersion.has(hypothesis.version)) {
          throw new DomainInvariantError(
            `SelfHypotheses for ${hypothesisKey} duplicate version ${hypothesis.version}`,
          );
        }
        byVersion.set(hypothesis.version, hypothesis);
        highestVersion = Math.max(highestVersion, hypothesis.version);

        if (hypothesis.status === "active" || hypothesis.status === "disputed") {
          if (current !== null) {
            throw new DomainInvariantError(
              `SelfHypotheses ${current.id} and ${hypothesis.id} are both current for ${hypothesisKey}`,
            );
          }
          current = hypothesis;
        }
      }

      for (let version = 2; version <= highestVersion; version += 1) {
        const hypothesis = byVersion.get(version);
        const previous = byVersion.get(version - 1);
        if (
          hypothesis === undefined ||
          previous === undefined ||
          hypothesis.previousVersionId !== previous.id
        ) {
          throw new DomainInvariantError(
            `SelfHypotheses for ${hypothesisKey} must form a continuous linear history`,
          );
        }
      }

      if (current !== null) {
        if (current.version !== highestVersion) {
          throw new DomainInvariantError(
            `Current SelfHypothesis ${current.id} must be the highest version for ${hypothesisKey}`,
          );
        }
        for (const hypothesis of history) {
          if (hypothesis.version < current.version && hypothesis.status !== "superseded") {
            throw new DomainInvariantError(
              `Earlier SelfHypothesis ${hypothesis.id} must be superseded`,
            );
          }
        }
      }
    }
  }
}
