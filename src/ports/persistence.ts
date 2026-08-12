import type { Belief } from "../domain/belief.js";
import type { EvidenceItem, EvidenceLink } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import type { SelfHypothesis } from "../domain/self-hypothesis.js";
import type { EntityId, StateVersion, TurnId } from "../domain/primitives.js";
import type { Source } from "../domain/source.js";

export interface CommitMutations {
  readonly evidenceItems: readonly EvidenceItem[];
  readonly evidenceLinks: readonly EvidenceLink[];
  readonly beliefs: readonly Belief[];
  readonly selfHypotheses: readonly SelfHypothesis[];
}

export interface AtomicCommitResult {
  readonly applied: boolean;
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
}

export interface PersistencePort {
  registerSource(source: Source): Promise<void>;
  readSource(sourceId: EntityId): Promise<Source | null>;

  getStateVersion(kinseedId: EntityId): Promise<StateVersion>;

  appendEvent(event: Event): Promise<void>;
  readEventById(kinseedId: EntityId, eventId: EntityId): Promise<Event | null>;
  readEventsInSequence(kinseedId: EntityId): Promise<readonly Event[]>;
  readEventsByTurn(kinseedId: EntityId, turnId: TurnId): Promise<readonly Event[]>;

  readEvidenceItem(kinseedId: EntityId, evidenceItemId: EntityId): Promise<EvidenceItem | null>;
  readEvidenceLink(kinseedId: EntityId, evidenceLinkId: EntityId): Promise<EvidenceLink | null>;

  readActiveBeliefByKey(kinseedId: EntityId, beliefKey: string): Promise<Belief | null>;
  readBeliefHistoryByKey(kinseedId: EntityId, beliefKey: string): Promise<readonly Belief[]>;
  readSelfHypothesis(kinseedId: EntityId, selfHypothesisId: EntityId): Promise<SelfHypothesis | null>;
  readActiveSelfHypothesisByKey(
    kinseedId: EntityId,
    hypothesisKey: string,
  ): Promise<SelfHypothesis | null>;
  readSelfHypothesisHistoryByKey(
    kinseedId: EntityId,
    hypothesisKey: string,
  ): Promise<readonly SelfHypothesis[]>;

  atomicCommit(
    kinseedId: EntityId,
    expectedStateVersion: StateVersion,
    mutations: CommitMutations,
    idempotencyKey: string,
  ): Promise<AtomicCommitResult>;

  checkIdempotencyKey(kinseedId: EntityId, idempotencyKey: string): Promise<boolean>;
}
