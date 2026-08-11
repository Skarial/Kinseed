import { DomainInvariantError } from "./errors.js";
import { buildBeliefKey, propositionEquals, type Proposition } from "./proposition.js";
import type { EntityId, Timestamp } from "./primitives.js";

export type BeliefStatus = "active" | "uncertain" | "superseded" | "rejected";
export type Confidence = "low" | "moderate" | "moderate_high" | "high";

export interface Belief {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly beliefKey: string;
  readonly version: number;
  readonly proposition: Proposition;
  readonly status: BeliefStatus;
  readonly confidence: Confidence;
  readonly evidenceForLinkIds: readonly EntityId[];
  readonly evidenceAgainstLinkIds: readonly EntityId[];
  readonly previousVersionId: EntityId | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface CreateInitialBeliefInput {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly proposition: Proposition;
  readonly evidenceForLinkId: EntityId;
  readonly confidence: Confidence;
  readonly now: Timestamp;
}

export function createInitialBelief(input: CreateInitialBeliefInput): Belief {
  return {
    id: input.id,
    kinseedId: input.kinseedId,
    beliefKey: buildBeliefKey(input.proposition),
    version: 1,
    proposition: input.proposition,
    status: "active",
    confidence: input.confidence,
    evidenceForLinkIds: [input.evidenceForLinkId],
    evidenceAgainstLinkIds: [],
    previousVersionId: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export interface ReviseBeliefInput {
  readonly current: Belief;
  readonly nextId: EntityId;
  readonly nextProposition: Proposition;
  readonly supportingLinkId: EntityId;
  readonly contradictingPreviousLinkId: EntityId;
  readonly confidence: Confidence;
  readonly now: Timestamp;
}

export interface BeliefRevision {
  readonly supersededPrevious: Belief;
  readonly next: Belief;
}

export function reviseBelief(input: ReviseBeliefInput): BeliefRevision {
  if (input.current.status !== "active" && input.current.status !== "uncertain") {
    throw new DomainInvariantError(
      `Belief ${input.current.id} cannot be revised from status ${input.current.status}`,
    );
  }

  const nextBeliefKey = buildBeliefKey(input.nextProposition);
  if (nextBeliefKey !== input.current.beliefKey) {
    throw new DomainInvariantError("A belief revision must keep the same beliefKey");
  }

  if (propositionEquals(input.current.proposition, input.nextProposition)) {
    throw new DomainInvariantError("A belief revision must change the proposition value");
  }

  const supersededPrevious: Belief = {
    ...input.current,
    status: "superseded",
    evidenceAgainstLinkIds: [
      ...input.current.evidenceAgainstLinkIds,
      input.contradictingPreviousLinkId,
    ],
    updatedAt: input.now,
  };

  const next: Belief = {
    id: input.nextId,
    kinseedId: input.current.kinseedId,
    beliefKey: input.current.beliefKey,
    version: input.current.version + 1,
    proposition: input.nextProposition,
    status: "active",
    confidence: input.confidence,
    evidenceForLinkIds: [input.supportingLinkId],
    evidenceAgainstLinkIds: [],
    previousVersionId: input.current.id,
    createdAt: input.now,
    updatedAt: input.now,
  };

  return { supersededPrevious, next };
}
