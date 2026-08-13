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

  getStateVersion(lenoSeedId: EntityId): Promise<StateVersion>;

  appendEvent(event: Event): Promise<void>;
  readEventById(lenoSeedId: EntityId, eventId: EntityId): Promise<Event | null>;
  readEventsInSequence(lenoSeedId: EntityId): Promise<readonly Event[]>;
  readEventsByTurn(lenoSeedId: EntityId, turnId: TurnId): Promise<readonly Event[]>;

  readEvidenceItem(lenoSeedId: EntityId, evidenceItemId: EntityId): Promise<EvidenceItem | null>;
  readEvidenceLink(lenoSeedId: EntityId, evidenceLinkId: EntityId): Promise<EvidenceLink | null>;

  readActiveBeliefByKey(lenoSeedId: EntityId, beliefKey: string): Promise<Belief | null>;
  readBeliefHistoryByKey(lenoSeedId: EntityId, beliefKey: string): Promise<readonly Belief[]>;
  readSelfHypothesis(lenoSeedId: EntityId, selfHypothesisId: EntityId): Promise<SelfHypothesis | null>;
  readActiveSelfHypothesisByKey(
    lenoSeedId: EntityId,
    hypothesisKey: string,
  ): Promise<SelfHypothesis | null>;
  readSelfHypothesisHistoryByKey(
    lenoSeedId: EntityId,
    hypothesisKey: string,
  ): Promise<readonly SelfHypothesis[]>;

  atomicCommit(
    lenoSeedId: EntityId,
    expectedStateVersion: StateVersion,
    mutations: CommitMutations,
    idempotencyKey: string,
  ): Promise<AtomicCommitResult>;

  checkIdempotencyKey(lenoSeedId: EntityId, idempotencyKey: string): Promise<boolean>;
}
