import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem, EvidenceLink } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import {
  planG0A2SelfHypothesisDispute,
  type G0A2DisputeObservation,
  type G0A2DisputePlan,
} from "../domain/g0a2-self-hypothesis-dispute.js";
import type { EntityId, SerializableValue, StateVersion } from "../domain/primitives.js";
import type { SelfHypothesis } from "../domain/self-hypothesis.js";
import { buildSelfHypothesisKey } from "../domain/self-hypothesis.js";
import type { AtomicCommitResult, PersistencePort } from "../ports/persistence.js";
import { validateEvidenceItem } from "./validate-evidence.js";

const SCOPE = "self_hypothesis_consolidation";
const KEY_PREFIX = "g0a2";
const AXIS = "decision_style_under_uncertainty";

export interface ConsolidateG0A2SelfHypothesisDisputeInput {
  readonly kinseedId: EntityId;
  readonly consolidationId: string;
  readonly systemSourceId: EntityId;
  readonly evidenceItemIds: readonly EntityId[];
  readonly engineVersion: string;
}
export interface ConsolidateG0A2SelfHypothesisDisputeResult {
  readonly outcome: "dispute" | "no_change";
  readonly selfHypothesisId: EntityId | null;
  readonly previousStateVersion: StateVersion;
  readonly newStateVersion: StateVersion;
  readonly changed: boolean;
  readonly replayed: boolean;
}

/** Executes the deliberately bounded first contradiction transition, independently of initial consolidation. */
export async function consolidateG0A2SelfHypothesisDispute(
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  persistence: PersistencePort,
): Promise<ConsolidateG0A2SelfHypothesisDisputeResult> {
  if ((await persistence.readSource(input.systemSourceId))?.kind !== "system") {
    throw new DomainInvariantError("G0-A2 dispute requires a system source");
  }
  const events = await persistence.readEventsInSequence(input.kinseedId);
  let checkpoint = findCheckpoint(events, input);
  let plan: G0A2DisputePlan;
  let prior: SelfHypothesis | null;
  if (checkpoint !== null) {
    plan = await parseCheckpoint(checkpoint, input, persistence);
    prior = plan.supersededHypothesisId === null ? null : await persistence.readSelfHypothesis(input.kinseedId, plan.supersededHypothesisId);
    if (plan.outcome === "dispute" && prior === null) throw new DomainInvariantError("G0-A2 dispute checkpoint lost v1");
  } else {
    prior = await readCurrentV1(input.kinseedId, persistence);
    const formation = await readFormationBoundary(input.kinseedId, prior, persistence);
    const observations = await readObservations(input, persistence);
    await validateSnapshotAgainstV1(observations, prior, persistence);
    validateRevisionBoundary(observations, formation.completed);
    plan = planG0A2SelfHypothesisDispute({ kinseedId: input.kinseedId, consolidationId: input.consolidationId, currentHypothesis: prior, observations });
    checkpoint = await appendCheckpoint(input, plan, prior, observations, formation.checkpoint, persistence);
  }
  const allEvents = await persistence.readEventsInSequence(input.kinseedId);
  const completion = findCompletion(allEvents, input);
  if (completion !== null) {
    const result = validateCompletion(completion, checkpoint, plan, input);
    await validateDurable(plan, prior, input.kinseedId, persistence);
    return { outcome: plan.outcome, selfHypothesisId: plan.nextHypothesisSnapshot?.id ?? null, ...result, replayed: true };
  }
  const expected = checkpoint.observedStateVersion;
  const superseded = plan.outcome === "dispute" && prior !== null
    ? { ...prior, status: "superseded" as const, updatedAt: plan.timestamp } : null;
  const commit = await persistence.atomicCommit(input.kinseedId, expected, {
    evidenceItems: [], evidenceLinks: plan.linkSnapshots, beliefs: [],
    selfHypotheses: superseded === null || plan.nextHypothesisSnapshot === null ? [] : [superseded, plan.nextHypothesisSnapshot],
  }, commitKey(input));
  await appendCompletion(input, checkpoint, plan, commit, persistence);
  return { outcome: plan.outcome, selfHypothesisId: plan.nextHypothesisSnapshot?.id ?? null, previousStateVersion: commit.previousStateVersion, newStateVersion: commit.newStateVersion, changed: commit.applied, replayed: false };
}

async function readCurrentV1(kinseedId: EntityId, persistence: PersistencePort): Promise<SelfHypothesis> {
  const key = buildSelfHypothesisKey({ subjectRef: kinseedId, predicate: AXIS, value: "seek_clarification", context: { protocol: "G0-A2" } });
  const history = await persistence.readSelfHypothesisHistoryByKey(kinseedId, key);
  if (history.length !== 1) throw new DomainInvariantError("G0-A2 dispute requires exactly one v1 history");
  const current = history[0];
  if (current === undefined || current.version !== 1 || current.status !== "active" || current.confidence !== "moderate" || current.stage !== "hypothesis") throw new DomainInvariantError("G0-A2 dispute requires active moderate v1");
  return current;
}

async function readFormationBoundary(kinseedId: EntityId, v1: SelfHypothesis, persistence: PersistencePort): Promise<{ checkpoint: Event; completed: Event }> {
  const events = await persistence.readEventsInSequence(kinseedId);
  const checkpoints = events.filter((event) => event.type === "validation_decision_recorded" && event.payloadSchemaVersion === 3 && event.payload.scope === SCOPE && snapshotId(event.payload.nextHypothesisSnapshot) === v1.id);
  if (checkpoints.length !== 1) throw new DomainInvariantError("G0-A2 dispute cannot identify a unique v1 formation checkpoint");
  const checkpoint = checkpoints[0];
  if (checkpoint === undefined || checkpoint.payload.outcome !== "create" || checkpoint.payload.hypothesisKey !== v1.hypothesisKey || JSON.stringify(checkpoint.payload.nextHypothesisSnapshot) !== JSON.stringify(v1)) throw new DomainInvariantError("G0-A2 dispute v1 formation checkpoint is incoherent");
  const completions = events.filter((event) => event.type === "state_commit_completed" && event.payloadSchemaVersion === 2 && event.payload.scope === SCOPE && event.payload.consolidationId === checkpoint.payload.consolidationId && event.causedByEventIds.length === 1 && event.causedByEventIds[0] === checkpoint.id && event.payload.changed === true);
  if (completions.length !== 1) throw new DomainInvariantError("G0-A2 dispute cannot identify v1 durable completion");
  return { checkpoint, completed: completions[0] as Event };
}

async function readObservations(input: ConsolidateG0A2SelfHypothesisDisputeInput, persistence: PersistencePort): Promise<readonly G0A2DisputeObservation[]> {
  if (input.evidenceItemIds.length < 5 || input.evidenceItemIds.length > 7 || new Set(input.evidenceItemIds).size !== input.evidenceItemIds.length) throw new DomainInvariantError("G0-A2 dispute requires five to seven distinct observations");
  const observations: G0A2DisputeObservation[] = [];
  for (const id of input.evidenceItemIds) {
    const evidenceItem = await persistence.readEvidenceItem(input.kinseedId, id);
    if (evidenceItem === null || evidenceItem.kinseedId !== input.kinseedId || evidenceItem.kind !== "behavioral_observation" || evidenceItem.status !== "active" || evidenceItem.grounding?.kind !== "structured_event") throw new DomainInvariantError(`G0-A2 dispute observation ${id} is invalid`);
    if (await validateEvidenceItem(evidenceItem, persistence) !== null) throw new DomainInvariantError(`G0-A2 dispute observation ${id} failed grounding`);
    const sourceEvent = await persistence.readEventById(input.kinseedId, evidenceItem.grounding.eventId);
    if (sourceEvent === null || sourceEvent.type !== "intention_selected" || sourceEvent.payloadSchemaVersion !== 2 || !Array.isArray(sourceEvent.payload.triggerSelfHypothesisIds) || !sourceEvent.payload.triggerSelfHypothesisIds.every((value) => typeof value === "string")) throw new DomainInvariantError(`G0-A2 dispute observation ${id} source is invalid`);
    const triggerHypothesisKeys: string[] = [];
    for (const triggerId of sourceEvent.payload.triggerSelfHypothesisIds) {
      const trigger = await persistence.readSelfHypothesis(input.kinseedId, triggerId);
      if (trigger === null) throw new DomainInvariantError(`G0-A2 dispute observation ${id} has unknown trigger`);
      triggerHypothesisKeys.push(trigger.hypothesisKey);
    }
    observations.push({ evidenceItem, sourceEvent, triggerHypothesisKeys });
  }
  return observations.sort((a, b) => a.sourceEvent.sequence - b.sourceEvent.sequence);
}

async function validateSnapshotAgainstV1(observations: readonly G0A2DisputeObservation[], v1: SelfHypothesis, persistence: PersistencePort): Promise<void> {
  const historicalIds = new Set<EntityId>();
  for (const linkId of [...v1.supportLinkIds, ...v1.againstLinkIds]) {
    const link = await persistence.readEvidenceLink(v1.kinseedId, linkId);
    if (link === null || link.targetId !== v1.id) throw new DomainInvariantError("G0-A2 dispute v1 links are incoherent");
    historicalIds.add(link.evidenceItemId);
  }
  const initial = observations.filter((observation) => ["S1", "S2", "S3", "S4"].includes(observation.evidenceItem.proposition.context.situationId as string)).map((observation) => observation.evidenceItem.id);
  if (initial.length !== 4 || initial.some((id) => !historicalIds.has(id)) || historicalIds.size !== 4) throw new DomainInvariantError("G0-A2 dispute initial observations do not match v1 history");
}

function validateRevisionBoundary(observations: readonly G0A2DisputeObservation[], completed: Event): void {
  for (const observation of observations) {
    const situation = observation.evidenceItem.proposition.context.situationId;
    if (situation === "R1" || situation === "R2") {
      const triggers = observation.sourceEvent.payload.triggerSelfHypothesisIds;
      if (observation.sourceEvent.sequence <= completed.sequence || !Array.isArray(triggers) || triggers.length !== 0) throw new DomainInvariantError("G0-A2 dispute R observations must be clean and post-formation");
    }
  }
}

async function appendCheckpoint(input: ConsolidateG0A2SelfHypothesisDisputeInput, plan: G0A2DisputePlan, current: SelfHypothesis, observations: readonly G0A2DisputeObservation[], formation: Event, persistence: PersistencePort): Promise<Event> {
  const events = await persistence.readEventsInSequence(input.kinseedId);
  const orderedCauseIds = [...observations].sort((a, b) => a.sourceEvent.sequence - b.sourceEvent.sequence).map((observation) => observation.sourceEvent.id);
  if (!orderedCauseIds.includes(formation.id)) orderedCauseIds.push(formation.id);
  const event: Event = { id: checkpointId(input), kinseedId: input.kinseedId, sequence: (events.at(-1)?.sequence ?? 0) + 1, type: "validation_decision_recorded", occurredAt: plan.timestamp, turnId: null, sourceId: input.systemSourceId, actorRef: null, causedByEventIds: orderedCauseIds, observedStateVersion: await persistence.getStateVersion(input.kinseedId), payload: serializePlan(input, plan, current), payloadSchemaVersion: 3, engineVersion: input.engineVersion, idempotencyKey: decisionKey(input) };
  await persistence.appendEvent(event); return event;
}

async function appendCompletion(input: ConsolidateG0A2SelfHypothesisDisputeInput, checkpoint: Event, plan: G0A2DisputePlan, commit: AtomicCommitResult, persistence: PersistencePort): Promise<void> {
  const events = await persistence.readEventsInSequence(input.kinseedId);
  await persistence.appendEvent({ id: completionId(input), kinseedId: input.kinseedId, sequence: (events.at(-1)?.sequence ?? 0) + 1, type: "state_commit_completed", occurredAt: plan.timestamp, turnId: null, sourceId: input.systemSourceId, actorRef: null, causedByEventIds: [checkpoint.id], observedStateVersion: commit.previousStateVersion, payload: { scope: SCOPE, consolidationId: input.consolidationId, previousStateVersion: commit.previousStateVersion, newStateVersion: commit.newStateVersion, changed: commit.applied }, payloadSchemaVersion: 2, engineVersion: input.engineVersion, idempotencyKey: completedKey(input) });
}

function findCheckpoint(events: readonly Event[], input: ConsolidateG0A2SelfHypothesisDisputeInput): Event | null { const matches = events.filter((event) => event.id === checkpointId(input) || event.idempotencyKey === decisionKey(input)); if (matches.length > 1) throw new DomainInvariantError("G0-A2 dispute has multiple checkpoints"); return matches[0] ?? null; }
function findCompletion(events: readonly Event[], input: ConsolidateG0A2SelfHypothesisDisputeInput): Event | null { const matches = events.filter((event) => event.id === completionId(input) || event.idempotencyKey === completedKey(input)); if (matches.length > 1) throw new DomainInvariantError("G0-A2 dispute has multiple completions"); return matches[0] ?? null; }

async function parseCheckpoint(event: Event, input: ConsolidateG0A2SelfHypothesisDisputeInput, persistence: PersistencePort): Promise<G0A2DisputePlan> {
  if (event.id !== checkpointId(input) || event.idempotencyKey !== decisionKey(input) || event.kinseedId !== input.kinseedId || event.type !== "validation_decision_recorded" || event.payloadSchemaVersion !== 3 || event.sourceId !== input.systemSourceId || event.turnId !== null) throw new DomainInvariantError("G0-A2 dispute checkpoint identity is incoherent");
  const payload = event.payload as Record<string, unknown>;
  if (payload.scope !== SCOPE || payload.consolidationId !== input.consolidationId || !sameSet(asStrings(payload.inputEvidenceItemIds), input.evidenceItemIds)) throw new DomainInvariantError("G0-A2 dispute checkpoint conflicts with requested input");
  const outcome = payload.outcome;
  if (outcome !== "dispute" && outcome !== "no_change") throw new DomainInvariantError("G0-A2 dispute checkpoint outcome is invalid");
  const links = asLinks(payload.linkSnapshots);
  const next = payload.nextHypothesisSnapshot === null ? null : asHypothesis(payload.nextHypothesisSnapshot);
  const superseded = payload.supersededHypothesisId === null ? null : asString(payload.supersededHypothesisId);
  const timestamp = event.occurredAt;
  if (outcome === "no_change" && (next !== null || links.length !== 0 || superseded !== null)) throw new DomainInvariantError("G0-A2 no_change checkpoint contains durable snapshots");
  if (outcome === "dispute" && (next === null || superseded === null || next.status !== "disputed" || next.confidence !== "low" || next.version !== 2 || next.previousVersionId !== superseded)) throw new DomainInvariantError("G0-A2 dispute checkpoint snapshots are invalid");
  const observations = await readObservations(input, persistence);
  const expectedCause = [...observations].sort((a, b) => a.sourceEvent.sequence - b.sourceEvent.sequence).map((observation) => observation.sourceEvent.id);
  if (event.causedByEventIds.length !== expectedCause.length + 1 || expectedCause.some((id, index) => event.causedByEventIds[index] !== id)) throw new DomainInvariantError("G0-A2 dispute checkpoint causality is incoherent");
  return { outcome, hypothesisKey: asString(payload.hypothesisKey), inputEvidenceItemIds: observations.map((o) => o.evidenceItem.id), countedSupportGroups: asStrings(payload.countedSupportGroups), countedAgainstGroups: asStrings(payload.countedAgainstGroups), ignoredContaminatedLinkIds: asStrings(payload.ignoredContaminatedLinkIds), linkSnapshots: links, nextHypothesisSnapshot: next, supersededHypothesisId: superseded, timestamp };
}

function serializePlan(input: ConsolidateG0A2SelfHypothesisDisputeInput, plan: G0A2DisputePlan, current: SelfHypothesis): Readonly<Record<string, SerializableValue>> { const candidate = current.proposition; return { scope: SCOPE, consolidationId: input.consolidationId, hypothesisKey: plan.hypothesisKey, candidateProposition: { subjectRef: candidate.subjectRef, predicate: candidate.predicate, value: candidate.value, context: { ...candidate.context } }, inputEvidenceItemIds: [...plan.inputEvidenceItemIds], countedSupportGroups: [...plan.countedSupportGroups], countedAgainstGroups: [...plan.countedAgainstGroups], ignoredContaminatedLinkIds: [...plan.ignoredContaminatedLinkIds], outcome: plan.outcome, linkSnapshots: plan.linkSnapshots.map((link) => ({ ...link })), nextHypothesisSnapshot: plan.nextHypothesisSnapshot === null ? null : { ...plan.nextHypothesisSnapshot, proposition: { subjectRef: plan.nextHypothesisSnapshot.proposition.subjectRef, predicate: plan.nextHypothesisSnapshot.proposition.predicate, value: plan.nextHypothesisSnapshot.proposition.value, context: { ...plan.nextHypothesisSnapshot.proposition.context } }, supportLinkIds: [...plan.nextHypothesisSnapshot.supportLinkIds], againstLinkIds: [...plan.nextHypothesisSnapshot.againstLinkIds] }, supersededHypothesisId: plan.supersededHypothesisId }; }
function validateCompletion(event: Event, checkpoint: Event, plan: G0A2DisputePlan, input: ConsolidateG0A2SelfHypothesisDisputeInput): Omit<ConsolidateG0A2SelfHypothesisDisputeResult, "outcome" | "selfHypothesisId" | "replayed"> { const payload = event.payload; if (event.id !== completionId(input) || event.idempotencyKey !== completedKey(input) || event.sourceId !== input.systemSourceId || event.causedByEventIds.length !== 1 || event.causedByEventIds[0] !== checkpoint.id || typeof payload.previousStateVersion !== "number" || typeof payload.newStateVersion !== "number" || typeof payload.changed !== "boolean" || payload.changed !== (plan.outcome === "dispute") || payload.newStateVersion !== payload.previousStateVersion + (payload.changed ? 1 : 0)) throw new DomainInvariantError("G0-A2 dispute completion is incoherent"); return { previousStateVersion: payload.previousStateVersion, newStateVersion: payload.newStateVersion, changed: payload.changed }; }
async function validateDurable(plan: G0A2DisputePlan, prior: SelfHypothesis | null, kinseedId: EntityId, persistence: PersistencePort): Promise<void> { if (plan.outcome === "no_change") return; if (prior === null || prior.status !== "superseded" || prior.updatedAt !== plan.timestamp) throw new DomainInvariantError("G0-A2 dispute durable v1 is incoherent"); if (JSON.stringify(await persistence.readSelfHypothesis(kinseedId, plan.nextHypothesisSnapshot?.id as EntityId)) !== JSON.stringify(plan.nextHypothesisSnapshot)) throw new DomainInvariantError("G0-A2 dispute durable v2 is incoherent"); for (const link of plan.linkSnapshots) if (JSON.stringify(await persistence.readEvidenceLink(kinseedId, link.id)) !== JSON.stringify(link)) throw new DomainInvariantError("G0-A2 dispute durable links are incoherent"); }
function snapshotId(value: unknown): string | null { return value !== null && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null; }
function asString(value: unknown): string { if (typeof value !== "string") throw new DomainInvariantError("G0-A2 dispute checkpoint is malformed"); return value; }
function asStrings(value: unknown): readonly string[] { if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) throw new DomainInvariantError("G0-A2 dispute checkpoint is malformed"); return value as string[]; }
function asLinks(value: unknown): readonly EvidenceLink[] { if (!Array.isArray(value)) throw new DomainInvariantError("G0-A2 dispute checkpoint links are malformed"); return value as EvidenceLink[]; }
function asHypothesis(value: unknown): SelfHypothesis { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new DomainInvariantError("G0-A2 dispute checkpoint hypothesis is malformed"); return value as SelfHypothesis; }
function sameSet(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && new Set(left).size === left.length && left.every((item) => right.includes(item)); }
function checkpointId(input: ConsolidateG0A2SelfHypothesisDisputeInput): EntityId { return `E-G0A2-${input.kinseedId}-${input.consolidationId}-decision`; }
function completionId(input: ConsolidateG0A2SelfHypothesisDisputeInput): EntityId { return `E-G0A2-${input.kinseedId}-${input.consolidationId}-completed`; }
function decisionKey(input: ConsolidateG0A2SelfHypothesisDisputeInput): string { return `${KEY_PREFIX}:${input.kinseedId}:${input.consolidationId}:decision`; }
function commitKey(input: ConsolidateG0A2SelfHypothesisDisputeInput): string { return `${KEY_PREFIX}:${input.kinseedId}:${input.consolidationId}:commit`; }
function completedKey(input: ConsolidateG0A2SelfHypothesisDisputeInput): string { return `${KEY_PREFIX}:${input.kinseedId}:${input.consolidationId}:completed`; }
