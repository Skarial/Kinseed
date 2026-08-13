import { DomainInvariantError } from "./errors.js";
import type { EvidenceItem, EvidenceLink } from "./evidence.js";
import type { Event } from "./event.js";
import type { EntityId, Timestamp } from "./primitives.js";
import type { SelfHypothesis } from "./self-hypothesis.js";
import { buildG0A2SelfHypothesisLinkId } from "./g0a2-self-hypothesis-consolidation.js";

export type G0A2DisputeOutcome = "dispute" | "no_change";

export interface G0A2DisputeObservation {
  readonly evidenceItem: EvidenceItem;
  readonly sourceEvent: Event;
  readonly triggerHypothesisKeys: readonly string[];
}

export interface G0A2DisputePlan {
  readonly outcome: G0A2DisputeOutcome;
  readonly hypothesisKey: string;
  readonly inputEvidenceItemIds: readonly EntityId[];
  readonly countedSupportGroups: readonly string[];
  readonly countedAgainstGroups: readonly string[];
  readonly ignoredContaminatedLinkIds: readonly EntityId[];
  readonly linkSnapshots: readonly EvidenceLink[];
  readonly nextHypothesisSnapshot: SelfHypothesis | null;
  readonly supersededHypothesisId: EntityId | null;
  readonly timestamp: Timestamp;
}

/** Plans only the bounded G0-A2 v1 -> v2 disputed transition. */
export function planG0A2SelfHypothesisDispute(input: {
  readonly lenoseedId: EntityId;
  readonly consolidationId: string;
  readonly currentHypothesis: SelfHypothesis;
  readonly observations: readonly G0A2DisputeObservation[];
}): G0A2DisputePlan {
  const current = input.currentHypothesis;
  if (
    current.lenoseedId !== input.lenoseedId || current.version !== 1 ||
    current.status !== "active" || current.confidence !== "moderate" ||
    current.stage !== "hypothesis"
  ) throw new DomainInvariantError("G0-A2 dispute requires an active moderate v1 hypothesis");

  const ordered = [...input.observations].sort((a, b) => a.sourceEvent.sequence - b.sourceEvent.sequence);
  const situations = new Set<string>();
  for (const observation of ordered) {
    const situation = observation.evidenceItem.proposition.context.situationId;
    if (
      observation.evidenceItem.kind !== "behavioral_observation" ||
      observation.evidenceItem.status !== "active" || typeof situation !== "string" ||
      !["S1", "S2", "S3", "S4", "R1", "R2", "S5"].includes(situation) ||
      situations.has(situation)
    ) throw new DomainInvariantError("G0-A2 dispute observations are outside the bounded snapshot");
    situations.add(situation);
  }
  if (["S1", "S2", "S3", "S4", "R1"].some((situation) => !situations.has(situation))) {
    throw new DomainInvariantError("G0-A2 dispute requires S1-S4 and R1 exactly once");
  }
  const timestamp = ordered.at(-1)?.sourceEvent.occurredAt;
  if (timestamp === undefined) throw new DomainInvariantError("G0-A2 dispute has no timestamp");

  const v2Id = buildDisputedG0A2SelfHypothesisId(input.lenoseedId, input.consolidationId);
  const links = ordered.map((observation) => {
    const situation = observation.evidenceItem.proposition.context.situationId as string;
    const relation = observation.evidenceItem.proposition.value === current.proposition.value
      ? "supports" as const : "contradicts" as const;
    const contaminated = observation.triggerHypothesisKeys.includes(current.hypothesisKey);
    return {
      id: buildG0A2SelfHypothesisLinkId(input.consolidationId, observation.evidenceItem.id, v2Id, relation),
      lenoseedId: input.lenoseedId, evidenceItemId: observation.evidenceItem.id,
      targetType: "self_hypothesis" as const, targetId: v2Id, relation,
      sourceAuthority: "high" as const, independenceGroup: `g0a2:${situation}`,
      causalContamination: contaminated ? "influenced_by_target" as const : "none" as const,
      weightClass: contaminated ? "low" as const : "high" as const,
      createdAt: observation.sourceEvent.occurredAt,
    };
  });
  const ignored = links.filter((link) => link.causalContamination !== "none").map((link) => link.id);
  const counted = countGroups(links);
  const cleanContradictoryRevisionGroups = new Set(links.filter((link) =>
    link.causalContamination === "none" && link.relation === "contradicts" &&
    (link.independenceGroup === "g0a2:R1" || link.independenceGroup === "g0a2:R2"),
  ).map((link) => link.independenceGroup));
  const outcome: G0A2DisputeOutcome = cleanContradictoryRevisionGroups.size >= 2 ? "dispute" : "no_change";
  if (outcome === "no_change") return {
    outcome, hypothesisKey: current.hypothesisKey, inputEvidenceItemIds: ordered.map((entry) => entry.evidenceItem.id),
    countedSupportGroups: counted.support, countedAgainstGroups: counted.against,
    ignoredContaminatedLinkIds: ignored, linkSnapshots: [], nextHypothesisSnapshot: null,
    supersededHypothesisId: null, timestamp,
  };
  const next: SelfHypothesis = {
    id: v2Id, lenoseedId: input.lenoseedId, hypothesisKey: current.hypothesisKey, version: 2,
    proposition: current.proposition, stage: "hypothesis",
    supportLinkIds: links.filter((link) => link.relation === "supports").map((link) => link.id),
    againstLinkIds: links.filter((link) => link.relation === "contradicts").map((link) => link.id),
    confidence: "low", status: "disputed", previousVersionId: current.id,
    createdAt: timestamp, updatedAt: timestamp,
  };
  return {
    outcome, hypothesisKey: current.hypothesisKey, inputEvidenceItemIds: ordered.map((entry) => entry.evidenceItem.id),
    countedSupportGroups: counted.support, countedAgainstGroups: counted.against,
    ignoredContaminatedLinkIds: ignored, linkSnapshots: links, nextHypothesisSnapshot: next,
    supersededHypothesisId: current.id, timestamp,
  };
}

export function buildDisputedG0A2SelfHypothesisId(lenoseedId: EntityId, consolidationId: string): EntityId {
  return `SH-G0A2-${lenoseedId}-${consolidationId}-v2`;
}

function countGroups(links: readonly EvidenceLink[]): { support: string[]; against: string[] } {
  const relations = new Map<string, Set<string>>();
  for (const link of links) {
    if (link.causalContamination !== "none") continue;
    const values = relations.get(link.independenceGroup) ?? new Set<string>();
    values.add(link.relation); relations.set(link.independenceGroup, values);
  }
  const support: string[] = []; const against: string[] = [];
  for (const [group, values] of relations) {
    if (values.size !== 1) continue;
    if (values.has("supports")) support.push(group); else against.push(group);
  }
  return { support, against };
}
