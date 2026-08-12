import { DomainInvariantError } from "./errors.js";
import type { EvidenceItem, EvidenceLink } from "./evidence.js";
import type { Event } from "./event.js";
import type { Proposition } from "./proposition.js";
import type { EntityId, Timestamp } from "./primitives.js";
import { buildSelfHypothesisKey, type SelfHypothesis } from "./self-hypothesis.js";

export type G0A2ConsolidationOutcome = "create" | "no_change";

export interface G0A2ConsolidationObservation {
  readonly evidenceItem: EvidenceItem;
  readonly sourceEvent: Event;
}

export interface G0A2InitialConsolidationPlan {
  readonly outcome: G0A2ConsolidationOutcome;
  readonly hypothesisKey: string;
  readonly countedSupportGroups: readonly string[];
  readonly countedAgainstGroups: readonly string[];
  readonly ignoredContaminatedLinkIds: readonly EntityId[];
  readonly linkSnapshots: readonly EvidenceLink[];
  readonly nextHypothesisSnapshot: SelfHypothesis | null;
  readonly timestamp: Timestamp;
}

export function planInitialG0A2SelfHypothesisConsolidation(input: {
  readonly kinseedId: EntityId;
  readonly consolidationId: string;
  readonly candidateProposition: Proposition;
  readonly observations: readonly G0A2ConsolidationObservation[];
}): G0A2InitialConsolidationPlan {
  validateCandidate(input.kinseedId, input.candidateProposition);
  if (input.observations.length !== 4) {
    throw new DomainInvariantError("G0-A2 initial consolidation requires four observations");
  }
  const ordered = [...input.observations].sort(
    (left, right) => left.sourceEvent.sequence - right.sourceEvent.sequence,
  );
  const hypothesisKey = buildSelfHypothesisKey(input.candidateProposition);
  const hypothesisId = buildInitialG0A2SelfHypothesisId(
    input.kinseedId,
    input.consolidationId,
  );
  const timestamp = ordered.at(-1)?.sourceEvent.occurredAt;
  if (timestamp === undefined) throw new DomainInvariantError("G0-A2 consolidation has no timestamp");

  const seenSituations = new Set<string>();
  const classified = ordered.map(({ evidenceItem, sourceEvent }) => {
    const situationId = evidenceItem.proposition.context.situationId;
    if (
      evidenceItem.kind !== "behavioral_observation" ||
      evidenceItem.status !== "active" ||
      typeof situationId !== "string" ||
      !["S1", "S2", "S3", "S4"].includes(situationId) ||
      seenSituations.has(situationId)
    ) {
      throw new DomainInvariantError("G0-A2 consolidation observations must cover S1 through S4 once");
    }
    seenSituations.add(situationId);
    const relation = evidenceItem.proposition.value === input.candidateProposition.value
      ? "supports"
      : "contradicts";
    return {
      evidenceItem,
      sourceEvent,
      situationId,
      relation,
      independenceGroup: `g0a2:${situationId}`,
    } as const;
  });
  if (seenSituations.size !== 4) {
    throw new DomainInvariantError("G0-A2 consolidation observations must cover S1 through S4 once");
  }

  const supportGroups = classified
    .filter((entry) => entry.relation === "supports")
    .map((entry) => entry.independenceGroup);
  const againstGroups = classified
    .filter((entry) => entry.relation === "contradicts")
    .map((entry) => entry.independenceGroup);
  const outcome: G0A2ConsolidationOutcome =
    supportGroups.length >= 3 && againstGroups.length >= 1 ? "create" : "no_change";
  if (outcome === "no_change") {
    return {
      outcome,
      hypothesisKey,
      countedSupportGroups: supportGroups,
      countedAgainstGroups: againstGroups,
      ignoredContaminatedLinkIds: [],
      linkSnapshots: [],
      nextHypothesisSnapshot: null,
      timestamp,
    };
  }

  const links = classified.map(({ evidenceItem, sourceEvent, relation, independenceGroup }) => ({
    id: buildG0A2SelfHypothesisLinkId(input.consolidationId, evidenceItem.id, hypothesisId, relation),
    kinseedId: input.kinseedId,
    evidenceItemId: evidenceItem.id,
    targetType: "self_hypothesis" as const,
    targetId: hypothesisId,
    relation,
    sourceAuthority: "high" as const,
    independenceGroup,
    causalContamination: "none" as const,
    weightClass: "high" as const,
    createdAt: sourceEvent.occurredAt,
  }));
  const hypothesis: SelfHypothesis = {
    id: hypothesisId,
    kinseedId: input.kinseedId,
    hypothesisKey,
    version: 1,
    proposition: input.candidateProposition,
    stage: "hypothesis",
    supportLinkIds: links.filter((link) => link.relation === "supports").map((link) => link.id),
    againstLinkIds: links.filter((link) => link.relation === "contradicts").map((link) => link.id),
    confidence: "moderate",
    status: "active",
    previousVersionId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    outcome,
    hypothesisKey,
    countedSupportGroups: supportGroups,
    countedAgainstGroups: againstGroups,
    ignoredContaminatedLinkIds: [],
    linkSnapshots: links,
    nextHypothesisSnapshot: hypothesis,
    timestamp,
  };
}

export function buildInitialG0A2SelfHypothesisId(
  kinseedId: EntityId,
  consolidationId: string,
): EntityId {
  return `SH-G0A2-${kinseedId}-${consolidationId}-v1`;
}

export function buildG0A2SelfHypothesisLinkId(
  consolidationId: string,
  evidenceItemId: EntityId,
  hypothesisId: EntityId,
  relation: "supports" | "contradicts",
): EntityId {
  return `EL-G0A2-${consolidationId}-${evidenceItemId}-${hypothesisId}-${relation}`;
}

function validateCandidate(kinseedId: EntityId, proposition: Proposition): void {
  if (
    proposition.subjectRef !== kinseedId ||
    proposition.predicate !== "decision_style_under_uncertainty" ||
    proposition.context.protocol !== "G0-A2" ||
    (proposition.value !== "seek_clarification" && proposition.value !== "use_available_information")
  ) {
    throw new DomainInvariantError("G0-A2 initial consolidation has invalid candidate proposition");
  }
}
