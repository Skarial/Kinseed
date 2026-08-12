import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem, EvidenceLink } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import {
  planInitialG0A2SelfHypothesisConsolidation,
  type G0A2InitialConsolidationPlan,
} from "../domain/g0a2-self-hypothesis-consolidation.js";
import { propositionEquals, type Proposition } from "../domain/proposition.js";
import type { EntityId, ScalarValue, SerializableValue, StateVersion } from "../domain/primitives.js";
import { type SelfHypothesis } from "../domain/self-hypothesis.js";
import type { AtomicCommitResult, PersistencePort } from "../ports/persistence.js";
import { validateEvidenceItem } from "./validate-evidence.js";

const SCOPE = "self_hypothesis_consolidation";

export interface ConsolidateG0A2SelfHypothesisInput {
  readonly kinseedId: EntityId;
  readonly consolidationId: string;
  readonly systemSourceId: EntityId;
  readonly candidateProposition: Proposition;
  readonly evidenceItemIds: readonly EntityId[];
  readonly engineVersion: string;
}

export interface ConsolidateG0A2SelfHypothesisResult {
  readonly outcome: "create" | "no_change";
  readonly selfHypothesisId: EntityId | null;
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
  readonly changed: boolean;
  readonly replayed: boolean;
}

export async function consolidateInitialG0A2SelfHypothesis(
  input: ConsolidateG0A2SelfHypothesisInput,
  persistence: PersistencePort,
): Promise<ConsolidateG0A2SelfHypothesisResult> {
  const source = await persistence.readSource(input.systemSourceId);
  if (source?.kind !== "system") throw new DomainInvariantError("G0-A2 consolidation requires a system source");
  const events = await persistence.readEventsInSequence(input.kinseedId);
  const checkpoint = findCheckpoint(events, input.consolidationId);
  const completion = findCompletion(events, input.consolidationId);
  if (completion !== null && checkpoint === null) {
    throw new DomainInvariantError(`G0-A2 consolidation ${input.consolidationId} completed without checkpoint`);
  }

  let plan: G0A2InitialConsolidationPlan;
  let checkpointEvent: Event;
  if (checkpoint !== null) {
    plan = parseCheckpoint(checkpoint, input);
    checkpointEvent = checkpoint;
  } else {
    const observations = await readObservations(input, persistence);
    const existing = await persistence.readSelfHypothesisHistoryByKey(
      input.kinseedId,
      planKey(input.candidateProposition),
    );
    if (existing.length !== 0) {
      throw new DomainInvariantError("G0-A2 initial consolidation cannot follow existing SelfHypothesis history");
    }
    plan = planInitialG0A2SelfHypothesisConsolidation({
      kinseedId: input.kinseedId,
      consolidationId: input.consolidationId,
      candidateProposition: input.candidateProposition,
      observations,
    });
    checkpointEvent = await appendCheckpoint(input, plan, observations.map((item) => item.sourceEvent), persistence);
  }

  if (completion !== null) {
    const result = validateCompletion(completion, checkpointEvent, plan, input);
    await validateDurableSnapshots(input.kinseedId, plan, persistence);
    return {
      outcome: plan.outcome,
      selfHypothesisId: plan.nextHypothesisSnapshot?.id ?? null,
      ...result,
      replayed: true,
    };
  }

  const commit = await persistence.atomicCommit(
    input.kinseedId,
    checkpointEvent.observedStateVersion,
    {
      evidenceItems: [],
      evidenceLinks: plan.linkSnapshots,
      beliefs: [],
      selfHypotheses: plan.nextHypothesisSnapshot === null ? [] : [plan.nextHypothesisSnapshot],
    },
    commitKey(input),
  );
  await appendCompletion(input, checkpointEvent, plan, commit, persistence);
  return {
    outcome: plan.outcome,
    selfHypothesisId: plan.nextHypothesisSnapshot?.id ?? null,
    previousStateVersion: commit.previousStateVersion,
    newStateVersion: commit.newStateVersion,
    changed: commit.applied,
    replayed: false,
  };
}

async function readObservations(
  input: ConsolidateG0A2SelfHypothesisInput,
  persistence: PersistencePort,
) {
  if (input.evidenceItemIds.length !== 4 || new Set(input.evidenceItemIds).size !== 4) {
    throw new DomainInvariantError("G0-A2 initial consolidation requires four distinct EvidenceItems");
  }
  const observations = [];
  for (const evidenceId of input.evidenceItemIds) {
    const evidenceItem = await persistence.readEvidenceItem(input.kinseedId, evidenceId);
    if (evidenceItem === null || evidenceItem.kinseedId !== input.kinseedId || evidenceItem.kind !== "behavioral_observation" || evidenceItem.status !== "active") {
      throw new DomainInvariantError(`G0-A2 consolidation has invalid observation ${evidenceId}`);
    }
    await validateEvidenceItem(evidenceItem, persistence);
    if (evidenceItem.grounding?.kind !== "structured_event") {
      throw new DomainInvariantError(`G0-A2 consolidation observation ${evidenceId} has invalid grounding`);
    }
    const sourceEvent = await persistence.readEventById(input.kinseedId, evidenceItem.grounding.eventId);
    if (
      sourceEvent === null ||
      sourceEvent.type !== "intention_selected" ||
      sourceEvent.payloadSchemaVersion !== 2 ||
      !Array.isArray(sourceEvent.payload.triggerSelfHypothesisIds) ||
      sourceEvent.payload.triggerSelfHypothesisIds.length !== 0
    ) {
      throw new DomainInvariantError(`G0-A2 consolidation observation ${evidenceId} has invalid source history`);
    }
    observations.push({ evidenceItem, sourceEvent });
  }
  return observations;
}

async function appendCheckpoint(
  input: ConsolidateG0A2SelfHypothesisInput,
  plan: G0A2InitialConsolidationPlan,
  sourceEvents: readonly Event[],
  persistence: PersistencePort,
): Promise<Event> {
  const events = await persistence.readEventsInSequence(input.kinseedId);
  const orderedSources = [...sourceEvents].sort((left, right) => left.sequence - right.sequence);
  const event: Event = {
    id: checkpointId(input), kinseedId: input.kinseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    type: "validation_decision_recorded", occurredAt: plan.timestamp, turnId: null,
    sourceId: input.systemSourceId, actorRef: null,
    causedByEventIds: orderedSources.map((source) => source.id),
    observedStateVersion: await persistence.getStateVersion(input.kinseedId),
    payload: serializePlan(input, plan), payloadSchemaVersion: 3,
    engineVersion: input.engineVersion, idempotencyKey: decisionKey(input),
  };
  await persistence.appendEvent(event);
  return event;
}

async function appendCompletion(
  input: ConsolidateG0A2SelfHypothesisInput,
  checkpoint: Event,
  plan: G0A2InitialConsolidationPlan,
  commit: AtomicCommitResult,
  persistence: PersistencePort,
): Promise<void> {
  const events = await persistence.readEventsInSequence(input.kinseedId);
  await persistence.appendEvent({
    id: completionId(input), kinseedId: input.kinseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    type: "state_commit_completed", occurredAt: plan.timestamp, turnId: null,
    sourceId: input.systemSourceId, actorRef: null, causedByEventIds: [checkpoint.id],
    observedStateVersion: commit.previousStateVersion,
    payload: { scope: SCOPE, consolidationId: input.consolidationId, previousStateVersion: commit.previousStateVersion, newStateVersion: commit.newStateVersion, changed: commit.applied },
    payloadSchemaVersion: 2, engineVersion: input.engineVersion, idempotencyKey: completedKey(input),
  });
}

function findCheckpoint(events: readonly Event[], consolidationId: string): Event | null {
  const matches = events.filter((event) => event.type === "validation_decision_recorded" && event.payloadSchemaVersion === 3 && event.payload.scope === SCOPE && event.payload.consolidationId === consolidationId);
  if (matches.length > 1) throw new DomainInvariantError(`G0-A2 consolidation ${consolidationId} has multiple checkpoints`);
  return matches[0] ?? null;
}

function findCompletion(events: readonly Event[], consolidationId: string): Event | null {
  const matches = events.filter((event) => event.type === "state_commit_completed" && event.payloadSchemaVersion === 2 && event.payload.scope === SCOPE && event.payload.consolidationId === consolidationId);
  if (matches.length > 1) throw new DomainInvariantError(`G0-A2 consolidation ${consolidationId} has multiple completions`);
  return matches[0] ?? null;
}

function parseCheckpoint(event: Event, input: ConsolidateG0A2SelfHypothesisInput): G0A2InitialConsolidationPlan {
  if (event.id !== checkpointId(input) || event.idempotencyKey !== decisionKey(input) || event.turnId !== null || event.sourceId !== input.systemSourceId) {
    throw new DomainInvariantError("G0-A2 consolidation checkpoint identity is incoherent");
  }
  const payload = record(event.payload, "checkpoint");
  const candidate = parseProposition(payload.candidateProposition);
  const evidenceIds = strings(payload.inputEvidenceItemIds, "inputEvidenceItemIds");
  if (!propositionEquals(candidate, input.candidateProposition) || planKey(candidate) !== string(payload.hypothesisKey, "hypothesisKey") || !sameSet(evidenceIds, input.evidenceItemIds)) {
    throw new DomainInvariantError("G0-A2 consolidation checkpoint conflicts with requested identity");
  }
  const outcome = string(payload.outcome, "outcome");
  if (outcome !== "create" && outcome !== "no_change") throw new DomainInvariantError("G0-A2 consolidation checkpoint outcome is invalid");
  const links = parseLinks(payload.linkSnapshots);
  const hypothesis = payload.nextHypothesisSnapshot === null ? null : parseHypothesis(payload.nextHypothesisSnapshot);
  if ((outcome === "create") !== (hypothesis !== null) || (outcome === "create") !== (links.length === 4)) {
    throw new DomainInvariantError("G0-A2 consolidation checkpoint snapshots are incoherent");
  }
  const timestamp = event.occurredAt;
  return {
    outcome, hypothesisKey: planKey(candidate),
    countedSupportGroups: strings(payload.countedSupportGroups, "countedSupportGroups"),
    countedAgainstGroups: strings(payload.countedAgainstGroups, "countedAgainstGroups"),
    ignoredContaminatedLinkIds: strings(payload.ignoredContaminatedLinkIds, "ignoredContaminatedLinkIds"),
    linkSnapshots: links, nextHypothesisSnapshot: hypothesis, timestamp,
  };
}

function serializePlan(input: ConsolidateG0A2SelfHypothesisInput, plan: G0A2InitialConsolidationPlan): Readonly<Record<string, SerializableValue>> {
  return {
    scope: SCOPE, consolidationId: input.consolidationId, hypothesisKey: plan.hypothesisKey,
    candidateProposition: serializeProposition(input.candidateProposition),
    inputEvidenceItemIds: [...input.evidenceItemIds],
    countedSupportGroups: [...plan.countedSupportGroups], countedAgainstGroups: [...plan.countedAgainstGroups],
    ignoredContaminatedLinkIds: [...plan.ignoredContaminatedLinkIds], outcome: plan.outcome,
    linkSnapshots: plan.linkSnapshots.map(serializeLink),
    nextHypothesisSnapshot: plan.nextHypothesisSnapshot === null ? null : serializeHypothesis(plan.nextHypothesisSnapshot),
    supersededHypothesisId: null,
  };
}

function serializeProposition(value: Proposition): SerializableValue { return { subjectRef: value.subjectRef, predicate: value.predicate, value: value.value, context: { ...value.context } }; }
function serializeLink(value: EvidenceLink): SerializableValue { return { ...value }; }
function serializeHypothesis(value: SelfHypothesis): SerializableValue { return { ...value, proposition: serializeProposition(value.proposition), supportLinkIds: [...value.supportLinkIds], againstLinkIds: [...value.againstLinkIds] }; }

function parseLinks(value: SerializableValue | undefined): readonly EvidenceLink[] {
  if (!Array.isArray(value)) throw new DomainInvariantError("G0-A2 consolidation linkSnapshots are malformed");
  return value.map((item) => {
    const link = record(item, "linkSnapshot");
    const relation = string(link.relation, "relation");
    const targetType = string(link.targetType, "targetType");
    const contamination = string(link.causalContamination, "causalContamination");
    if ((relation !== "supports" && relation !== "contradicts") || targetType !== "self_hypothesis" || (contamination !== "none" && contamination !== "influenced_by_target")) throw new DomainInvariantError("G0-A2 consolidation linkSnapshot is invalid");
    return { id: string(link.id, "id"), kinseedId: string(link.kinseedId, "kinseedId"), evidenceItemId: string(link.evidenceItemId, "evidenceItemId"), targetType, targetId: string(link.targetId, "targetId"), relation, sourceAuthority: weight(link.sourceAuthority), independenceGroup: string(link.independenceGroup, "independenceGroup"), causalContamination: contamination, weightClass: weight(link.weightClass), createdAt: string(link.createdAt, "createdAt") };
  });
}

function parseHypothesis(value: SerializableValue | undefined): SelfHypothesis {
  const h = record(value, "nextHypothesisSnapshot");
  const status = string(h.status, "status"); const confidence = string(h.confidence, "confidence");
  if (status !== "active" || confidence !== "moderate" || h.version !== 1 || h.previousVersionId !== null || h.stage !== "hypothesis") throw new DomainInvariantError("G0-A2 consolidation hypothesis snapshot is invalid");
  return { id: string(h.id, "id"), kinseedId: string(h.kinseedId, "kinseedId"), hypothesisKey: string(h.hypothesisKey, "hypothesisKey"), version: 1, proposition: parseProposition(h.proposition), stage: "hypothesis", supportLinkIds: strings(h.supportLinkIds, "supportLinkIds"), againstLinkIds: strings(h.againstLinkIds, "againstLinkIds"), confidence: "moderate", status: "active", previousVersionId: null, createdAt: string(h.createdAt, "createdAt"), updatedAt: string(h.updatedAt, "updatedAt") };
}

function parseProposition(value: SerializableValue | undefined): Proposition {
  const p = record(value, "proposition"); const context = record(p.context, "context"); const result: Record<string, ScalarValue> = {};
  for (const [key, item] of Object.entries(context)) { if (!scalar(item)) throw new DomainInvariantError("G0-A2 consolidation context is invalid"); result[key] = item; }
  if (!scalar(p.value)) throw new DomainInvariantError("G0-A2 consolidation proposition value is invalid");
  return { subjectRef: string(p.subjectRef, "subjectRef"), predicate: string(p.predicate, "predicate"), value: p.value, context: result };
}
function validateCompletion(event: Event, checkpoint: Event, plan: G0A2InitialConsolidationPlan, input: ConsolidateG0A2SelfHypothesisInput): Omit<ConsolidateG0A2SelfHypothesisResult, "outcome" | "selfHypothesisId" | "replayed"> {
  if (event.id !== completionId(input) || event.idempotencyKey !== completedKey(input) || event.sourceId !== input.systemSourceId || event.turnId !== null || event.occurredAt !== plan.timestamp || event.causedByEventIds.length !== 1 || event.causedByEventIds[0] !== checkpoint.id) throw new DomainInvariantError("G0-A2 consolidation completion is incoherent");
  const p = event.payload; if (typeof p.previousStateVersion !== "number" || typeof p.newStateVersion !== "number" || typeof p.changed !== "boolean" || event.observedStateVersion !== p.previousStateVersion || p.changed !== (plan.outcome === "create") || p.newStateVersion !== p.previousStateVersion + (p.changed ? 1 : 0)) throw new DomainInvariantError("G0-A2 consolidation completion result is incoherent");
  return { previousStateVersion: p.previousStateVersion, newStateVersion: p.newStateVersion, changed: p.changed };
}
async function validateDurableSnapshots(kinseedId: EntityId, plan: G0A2InitialConsolidationPlan, persistence: PersistencePort): Promise<void> {
  if (plan.nextHypothesisSnapshot !== null) { const actual = await persistence.readSelfHypothesis(kinseedId, plan.nextHypothesisSnapshot.id); if (JSON.stringify(actual) !== JSON.stringify(plan.nextHypothesisSnapshot)) throw new DomainInvariantError("G0-A2 consolidation durable hypothesis is incoherent"); }
  for (const link of plan.linkSnapshots) { const actual = await persistence.readEvidenceLink(kinseedId, link.id); if (JSON.stringify(actual) !== JSON.stringify(link)) throw new DomainInvariantError("G0-A2 consolidation durable link is incoherent"); }
}
function record(value: SerializableValue | undefined, label: string): Readonly<Record<string, SerializableValue>> { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new DomainInvariantError(`G0-A2 consolidation ${label} is malformed`); return value as Readonly<Record<string, SerializableValue>>; }
function string(value: SerializableValue | undefined, label: string): string { if (typeof value !== "string") throw new DomainInvariantError(`G0-A2 consolidation ${label} is malformed`); return value; }
function strings(value: SerializableValue | undefined, label: string): readonly string[] { if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new DomainInvariantError(`G0-A2 consolidation ${label} is malformed`); return value as readonly string[]; }
function scalar(value: SerializableValue | undefined): value is ScalarValue { return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"; }
function weight(value: SerializableValue | undefined): "low" | "medium" | "high" { const result = string(value, "weight"); if (result !== "low" && result !== "medium" && result !== "high") throw new DomainInvariantError("G0-A2 consolidation weight is invalid"); return result; }
function sameSet(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && new Set(left).size === left.length && left.every((item) => right.includes(item)); }
function planKey(proposition: Proposition): string { return JSON.stringify([proposition.subjectRef, proposition.predicate, Object.entries(proposition.context).sort(([a], [b]) => a.localeCompare(b))]); }
function checkpointId(input: ConsolidateG0A2SelfHypothesisInput): EntityId { return `E-G0A2-${input.kinseedId}-${input.consolidationId}-decision`; }
function completionId(input: ConsolidateG0A2SelfHypothesisInput): EntityId { return `E-G0A2-${input.kinseedId}-${input.consolidationId}-completed`; }
function decisionKey(input: ConsolidateG0A2SelfHypothesisInput): string { return `g0a2:${input.kinseedId}:${input.consolidationId}:decision`; }
function commitKey(input: ConsolidateG0A2SelfHypothesisInput): string { return `g0a2:${input.kinseedId}:${input.consolidationId}:commit`; }
function completedKey(input: ConsolidateG0A2SelfHypothesisInput): string { return `g0a2:${input.kinseedId}:${input.consolidationId}:completed`; }
