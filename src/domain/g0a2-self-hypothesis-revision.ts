import { DomainInvariantError } from "./errors.js";
import type { EvidenceItem, EvidenceLink } from "./evidence.js";
import type { Event } from "./event.js";
import { buildG0A2SelfHypothesisLinkId } from "./g0a2-self-hypothesis-consolidation.js";
import type { EntityId, Timestamp } from "./primitives.js";
import type { SelfHypothesis } from "./self-hypothesis.js";

export type G0A2RevisionOutcome = "revise" | "no_change";
export interface G0A2RevisionObservation { readonly evidenceItem: EvidenceItem; readonly sourceEvent: Event; readonly triggerHypothesisKeys: readonly string[]; }
export interface G0A2RevisionPlan {
  readonly outcome: G0A2RevisionOutcome; readonly hypothesisKey: string; readonly candidateProposition: SelfHypothesis["proposition"];
  readonly inputEvidenceItemIds: readonly EntityId[]; readonly countedSupportGroups: readonly string[]; readonly countedAgainstGroups: readonly string[];
  readonly ignoredContaminatedLinkIds: readonly EntityId[]; readonly linkSnapshots: readonly EvidenceLink[];
  readonly nextHypothesisSnapshot: SelfHypothesis | null; readonly supersededHypothesisId: EntityId | null; readonly timestamp: Timestamp;
}

export function planG0A2SelfHypothesisRevision(input: { readonly lenoseedId: EntityId; readonly consolidationId: string; readonly v2: SelfHypothesis; readonly observations: readonly G0A2RevisionObservation[]; }): G0A2RevisionPlan {
  const { v2 } = input;
  if (v2.lenoseedId !== input.lenoseedId || v2.version !== 2 || v2.status !== "disputed" || v2.confidence !== "low" || v2.stage !== "hypothesis") throw new DomainInvariantError("G0-A2 revision requires disputed v2");
  const candidate = { ...v2.proposition, value: opposite(v2.proposition.value) };
  const ordered = [...input.observations].sort((a, b) => a.sourceEvent.sequence - b.sourceEvent.sequence);
  const situations = new Set<string>();
  for (const item of ordered) { const s = item.evidenceItem.proposition.context.situationId; if (typeof s !== "string" || !["S1", "S2", "S3", "S4", "R1", "R2", "R3", "S5"].includes(s) || situations.has(s)) throw new DomainInvariantError("G0-A2 revision snapshot is invalid"); situations.add(s); }
  if (["S1", "S2", "S3", "S4", "R1", "R2", "R3"].some((s) => !situations.has(s))) throw new DomainInvariantError("G0-A2 revision requires S1-S4 and R1-R3");
  const timestamp = ordered.at(-1)?.sourceEvent.occurredAt; if (timestamp === undefined) throw new DomainInvariantError("G0-A2 revision has no timestamp");
  const v3Id = buildRevisedG0A2SelfHypothesisId(input.lenoseedId, input.consolidationId);
  const links = ordered.map((item) => {
    const s = item.evidenceItem.proposition.context.situationId as string; const relation = item.evidenceItem.proposition.value === candidate.value ? "supports" as const : "contradicts" as const; const contaminated = item.triggerHypothesisKeys.includes(v2.hypothesisKey);
    return { id: buildG0A2SelfHypothesisLinkId(input.consolidationId, item.evidenceItem.id, v3Id, relation), lenoseedId: input.lenoseedId, evidenceItemId: item.evidenceItem.id, targetType: "self_hypothesis" as const, targetId: v3Id, relation, sourceAuthority: "high" as const, independenceGroup: `g0a2:${s}`, causalContamination: contaminated ? "influenced_by_target" as const : "none" as const, weightClass: contaminated ? "low" as const : "high" as const, createdAt: item.sourceEvent.occurredAt };
  });
  const counted = countGroups(links); const ignored = links.filter((link) => link.causalContamination !== "none").map((link) => link.id);
  const revisionSupports = new Set(links.filter((link) => link.causalContamination === "none" && link.relation === "supports" && ["g0a2:R1", "g0a2:R2", "g0a2:R3"].includes(link.independenceGroup)).map((link) => link.independenceGroup));
  const outcome: G0A2RevisionOutcome = revisionSupports.size === 3 && counted.against.length >= 1 ? "revise" : "no_change";
  if (outcome === "no_change") return { outcome, hypothesisKey: v2.hypothesisKey, candidateProposition: candidate, inputEvidenceItemIds: ordered.map((i) => i.evidenceItem.id), countedSupportGroups: counted.support, countedAgainstGroups: counted.against, ignoredContaminatedLinkIds: ignored, linkSnapshots: [], nextHypothesisSnapshot: null, supersededHypothesisId: null, timestamp };
  const next: SelfHypothesis = { id: v3Id, lenoseedId: input.lenoseedId, hypothesisKey: v2.hypothesisKey, version: 3, proposition: candidate, stage: "hypothesis", supportLinkIds: links.filter((l) => l.relation === "supports").map((l) => l.id), againstLinkIds: links.filter((l) => l.relation === "contradicts").map((l) => l.id), confidence: "moderate", status: "active", previousVersionId: v2.id, createdAt: timestamp, updatedAt: timestamp };
  return { outcome, hypothesisKey: v2.hypothesisKey, candidateProposition: candidate, inputEvidenceItemIds: ordered.map((i) => i.evidenceItem.id), countedSupportGroups: counted.support, countedAgainstGroups: counted.against, ignoredContaminatedLinkIds: ignored, linkSnapshots: links, nextHypothesisSnapshot: next, supersededHypothesisId: v2.id, timestamp };
}
export function buildRevisedG0A2SelfHypothesisId(lenoseedId: EntityId, consolidationId: string): EntityId { return `SH-G0A2-${lenoseedId}-${consolidationId}-v3`; }
function opposite(value: unknown): "seek_clarification" | "use_available_information" { if (value === "seek_clarification") return "use_available_information"; if (value === "use_available_information") return "seek_clarification"; throw new DomainInvariantError("G0-A2 revision v2 orientation is invalid"); }
function countGroups(links: readonly EvidenceLink[]): { support: string[]; against: string[] } { const groups = new Map<string, Set<string>>(); for (const link of links) { if (link.causalContamination !== "none") continue; const set = groups.get(link.independenceGroup) ?? new Set<string>(); set.add(link.relation); groups.set(link.independenceGroup, set); } const support: string[] = []; const against: string[] = []; for (const [group, values] of groups) { if (values.size !== 1) continue; if (values.has("supports")) support.push(group); else against.push(group); } return { support, against }; }
