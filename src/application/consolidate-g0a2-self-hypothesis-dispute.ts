import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem, EvidenceLink } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import {
  buildDisputedG0A2SelfHypothesisId,
  planG0A2SelfHypothesisDispute,
  type G0A2DisputeObservation,
  type G0A2DisputePlan,
} from "../domain/g0a2-self-hypothesis-dispute.js";
import { buildG0A2SelfHypothesisLinkId } from "../domain/g0a2-self-hypothesis-consolidation.js";
import { propositionEquals, type Proposition } from "../domain/proposition.js";
import type { EntityId, ScalarValue, SerializableValue, StateVersion } from "../domain/primitives.js";
import type { SelfHypothesis } from "../domain/self-hypothesis.js";
import { buildSelfHypothesisKey } from "../domain/self-hypothesis.js";
import type { AtomicCommitResult, PersistencePort } from "../ports/persistence.js";
import { validateEvidenceItem } from "./validate-evidence.js";

const SCOPE = "self_hypothesis_consolidation";
const KEY_PREFIX = "g0a2";
const AXIS = "decision_style_under_uncertainty";
const SNAPSHOT_SITUATIONS = ["S1", "S2", "S3", "S4", "R1", "R2", "S5"] as const;
const INITIAL_SITUATIONS = ["S1", "S2", "S3", "S4"] as const;

export interface ConsolidateG0A2SelfHypothesisDisputeInput {
  readonly lenoseedId: EntityId;
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

/** A read-only, fully validated historical boundary for a disputed v2. */
export interface ValidatedG0A2DisputeBoundary {
  readonly v1: SelfHypothesis;
  readonly v2: SelfHypothesis;
  readonly checkpoint: Event;
  readonly completion: Event;
}

/**
 * Validates the historical dispute that formed a specific v2 without
 * re-deciding its outcome. Consumers can safely use the returned boundary as
 * a causal predecessor.
 */
export async function readValidatedG0A2DisputeBoundary(
  lenoseedId: EntityId,
  v2: SelfHypothesis,
  persistence: PersistencePort,
): Promise<ValidatedG0A2DisputeBoundary> {
  if (v2.lenoseedId !== lenoseedId) {
    throw new DomainInvariantError("G0-A2 dispute boundary v2 belongs to another Lenoseed");
  }
  const events = await persistence.readEventsInSequence(lenoseedId);
  const checkpoints = events.filter((event) =>
    event.type === "validation_decision_recorded" &&
    event.payloadSchemaVersion === 3 &&
    event.payload.scope === SCOPE &&
    event.payload.outcome === "dispute" &&
    snapshotId(event.payload.nextHypothesisSnapshot) === v2.id,
  );
  if (checkpoints.length !== 1) {
    throw new DomainInvariantError("G0-A2 revision cannot identify a unique dispute checkpoint");
  }
  const checkpoint = checkpoints[0] as Event;
  if (typeof checkpoint.engineVersion !== "string" || (await persistence.readSource(checkpoint.sourceId))?.kind !== "system") {
    throw new DomainInvariantError("G0-A2 dispute boundary checkpoint source is incoherent");
  }
  const payload = record(checkpoint.payload, "historical checkpoint");
  const input: ConsolidateG0A2SelfHypothesisDisputeInput = {
    lenoseedId,
    consolidationId: string(payload.consolidationId, "historical consolidationId"),
    systemSourceId: checkpoint.sourceId,
    evidenceItemIds: strings(payload.inputEvidenceItemIds, "historical inputEvidenceItemIds"),
    engineVersion: checkpoint.engineVersion,
  };
  const { plan, prior } = await parseCheckpoint(checkpoint, input, persistence);
  if (
    plan.outcome !== "dispute" ||
    plan.nextHypothesisSnapshot === null ||
    !sameHypothesisImmutable(v2, plan.nextHypothesisSnapshot)
  ) {
    throw new DomainInvariantError("G0-A2 dispute boundary v2 snapshot is incoherent");
  }
  const completion = findCompletion(events, input);
  if (completion === null) {
    throw new DomainInvariantError("G0-A2 revision cannot identify dispute completion");
  }
  validateCompletion(completion, checkpoint, plan, input);
  await validateDurable(plan, prior, input, persistence);
  return { v1: prior, v2, checkpoint, completion };
}

/** Executes the bounded v1 active -> v2 disputed transition. */
export async function consolidateG0A2SelfHypothesisDispute(
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  persistence: PersistencePort,
): Promise<ConsolidateG0A2SelfHypothesisDisputeResult> {
  if ((await persistence.readSource(input.systemSourceId))?.kind !== "system") {
    throw new DomainInvariantError("G0-A2 dispute requires a system source");
  }
  const events = await persistence.readEventsInSequence(input.lenoseedId);
  let checkpoint = findCheckpoint(events, input);
  let plan: G0A2DisputePlan;
  let prior: SelfHypothesis;

  if (checkpoint !== null) {
    ({ plan, prior } = await parseCheckpoint(checkpoint, input, persistence));
  } else {
    prior = await readCurrentV1(input.lenoseedId, persistence);
    const formation = await readFormationBoundary(input.lenoseedId, prior, persistence);
    const observations = await readObservations(input, persistence);
    await validateBoundedSnapshot(observations, prior, formation.completed, persistence);
    plan = planG0A2SelfHypothesisDispute({
      lenoseedId: input.lenoseedId,
      consolidationId: input.consolidationId,
      currentHypothesis: prior,
      observations,
    });
    checkpoint = await appendCheckpoint(input, plan, prior, observations, formation.checkpoint, persistence);
  }

  const completion = findCompletion(await persistence.readEventsInSequence(input.lenoseedId), input);
  if (completion !== null) {
    const result = validateCompletion(completion, checkpoint, plan, input);
    await validateDurable(plan, prior, input, persistence);
    return {
      outcome: plan.outcome,
      selfHypothesisId: plan.nextHypothesisSnapshot?.id ?? null,
      ...result,
      replayed: true,
    };
  }

  const superseded = plan.outcome === "dispute"
    ? { ...prior, status: "superseded" as const, updatedAt: plan.timestamp }
    : null;
  const commit = await persistence.atomicCommit(input.lenoseedId, checkpoint.observedStateVersion, {
    evidenceItems: [],
    evidenceLinks: plan.linkSnapshots,
    beliefs: [],
    selfHypotheses: superseded === null || plan.nextHypothesisSnapshot === null
      ? []
      : [superseded, plan.nextHypothesisSnapshot],
    memories: [],
  }, commitKey(input));
  await appendCompletion(input, checkpoint, plan, commit, persistence);
  return {
    outcome: plan.outcome,
    selfHypothesisId: plan.nextHypothesisSnapshot?.id ?? null,
    previousStateVersion: commit.previousStateVersion,
    newStateVersion: commit.newStateVersion,
    changed: commit.applied,
    replayed: false,
  };
}

async function readCurrentV1(lenoseedId: EntityId, persistence: PersistencePort): Promise<SelfHypothesis> {
  const key = expectedHypothesisKey(lenoseedId);
  const history = await persistence.readSelfHypothesisHistoryByKey(lenoseedId, key);
  if (history.length !== 1) throw new DomainInvariantError("G0-A2 dispute requires exactly one v1 history");
  const current = history[0];
  if (current === undefined || !isCoherentV1(current, key) || current.status !== "active") {
    throw new DomainInvariantError("G0-A2 dispute requires an active moderate v1 hypothesis");
  }
  return current;
}

async function readFormationBoundary(
  lenoseedId: EntityId,
  v1: SelfHypothesis,
  persistence: PersistencePort,
): Promise<{ checkpoint: Event; completed: Event }> {
  const events = await persistence.readEventsInSequence(lenoseedId);
  const checkpoints = events.filter((event) =>
    event.type === "validation_decision_recorded" &&
    event.payloadSchemaVersion === 3 &&
    event.payload.scope === SCOPE &&
    snapshotId(event.payload.nextHypothesisSnapshot) === v1.id,
  );
  if (checkpoints.length !== 1) {
    throw new DomainInvariantError("G0-A2 dispute cannot identify a unique v1 formation checkpoint");
  }
  const checkpoint = checkpoints[0];
  if (checkpoint === undefined || checkpoint.payload.outcome !== "create") {
    throw new DomainInvariantError("G0-A2 dispute v1 formation checkpoint is incoherent");
  }
  const historicalV1 = parseHypothesis(checkpoint.payload.nextHypothesisSnapshot, "formation v1");
  if (!sameInitialV1Snapshot(historicalV1, v1)) {
    throw new DomainInvariantError("G0-A2 dispute v1 formation snapshot is incoherent");
  }
  const completions = events.filter((event) =>
    event.type === "state_commit_completed" &&
    event.payloadSchemaVersion === 2 &&
    event.payload.scope === SCOPE &&
    event.payload.consolidationId === checkpoint.payload.consolidationId &&
    sameList(event.causedByEventIds, [checkpoint.id]) &&
    event.payload.changed === true,
  );
  if (completions.length !== 1) {
    throw new DomainInvariantError("G0-A2 dispute cannot identify v1 durable completion");
  }
  return { checkpoint, completed: completions[0] as Event };
}

async function readObservations(
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  persistence: PersistencePort,
): Promise<readonly G0A2DisputeObservation[]> {
  if (
    input.evidenceItemIds.length < 5 ||
    input.evidenceItemIds.length > 7 ||
    new Set(input.evidenceItemIds).size !== input.evidenceItemIds.length
  ) throw new DomainInvariantError("G0-A2 dispute requires five to seven distinct observations");

  const observations: G0A2DisputeObservation[] = [];
  for (const evidenceId of input.evidenceItemIds) {
    const evidenceItem = await persistence.readEvidenceItem(input.lenoseedId, evidenceId);
    if (
      evidenceItem === null || evidenceItem.lenoseedId !== input.lenoseedId ||
      evidenceItem.kind !== "behavioral_observation" || evidenceItem.status !== "active" ||
      evidenceItem.grounding?.kind !== "structured_event"
    ) throw new DomainInvariantError(`G0-A2 dispute observation ${evidenceId} is invalid`);
    if (await validateEvidenceItem(evidenceItem, persistence) !== null) {
      throw new DomainInvariantError(`G0-A2 dispute observation ${evidenceId} failed grounding`);
    }
    const sourceEvent = await persistence.readEventById(input.lenoseedId, evidenceItem.grounding.eventId);
    if (
      sourceEvent === null || sourceEvent.type !== "intention_selected" ||
      sourceEvent.payloadSchemaVersion !== 2 ||
      !Array.isArray(sourceEvent.payload.triggerSelfHypothesisIds) ||
      !sourceEvent.payload.triggerSelfHypothesisIds.every((value) => typeof value === "string")
    ) throw new DomainInvariantError(`G0-A2 dispute observation ${evidenceId} source is invalid`);
    const triggerHypothesisKeys: string[] = [];
    for (const triggerId of sourceEvent.payload.triggerSelfHypothesisIds) {
      const trigger = await persistence.readSelfHypothesis(input.lenoseedId, triggerId);
      if (trigger === null) throw new DomainInvariantError(`G0-A2 dispute observation ${evidenceId} has unknown trigger`);
      triggerHypothesisKeys.push(trigger.hypothesisKey);
    }
    observations.push({ evidenceItem, sourceEvent, triggerHypothesisKeys });
  }
  return observations.sort((left, right) => left.sourceEvent.sequence - right.sourceEvent.sequence);
}

async function validateBoundedSnapshot(
  observations: readonly G0A2DisputeObservation[],
  v1: SelfHypothesis,
  formationCompletion: Event,
  persistence: PersistencePort,
): Promise<void> {
  const situations = new Set<string>();
  for (const observation of observations) {
    const situation = observation.evidenceItem.proposition.context.situationId;
    if (
      typeof situation !== "string" ||
      !SNAPSHOT_SITUATIONS.includes(situation as (typeof SNAPSHOT_SITUATIONS)[number]) ||
      situations.has(situation)
    ) throw new DomainInvariantError("G0-A2 dispute observations are outside the bounded snapshot");
    situations.add(situation);
    if (situation === "R1" || situation === "R2") {
      const triggers = observation.sourceEvent.payload.triggerSelfHypothesisIds;
      if (
        observation.sourceEvent.sequence <= formationCompletion.sequence ||
        !Array.isArray(triggers) || triggers.length !== 0
      ) throw new DomainInvariantError("G0-A2 dispute R observations must be clean and post-formation");
    }
  }
  if ([...INITIAL_SITUATIONS, "R1"].some((situation) => !situations.has(situation))) {
    throw new DomainInvariantError("G0-A2 dispute requires S1-S4 and R1 exactly once");
  }
  const v1EvidenceIds = new Set<EntityId>();
  for (const linkId of [...v1.supportLinkIds, ...v1.againstLinkIds]) {
    const link = await persistence.readEvidenceLink(v1.lenoseedId, linkId);
    if (link === null || link.targetType !== "self_hypothesis" || link.targetId !== v1.id) {
      throw new DomainInvariantError("G0-A2 dispute v1 links are incoherent");
    }
    v1EvidenceIds.add(link.evidenceItemId);
  }
  const initialIds = observations.filter((observation) =>
    INITIAL_SITUATIONS.includes(observation.evidenceItem.proposition.context.situationId as (typeof INITIAL_SITUATIONS)[number]),
  ).map((observation) => observation.evidenceItem.id);
  if (
    initialIds.length !== 4 || v1EvidenceIds.size !== 4 ||
    initialIds.some((id) => !v1EvidenceIds.has(id))
  ) throw new DomainInvariantError("G0-A2 dispute initial observations do not match v1 history");
}

async function appendCheckpoint(
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  plan: G0A2DisputePlan,
  current: SelfHypothesis,
  observations: readonly G0A2DisputeObservation[],
  formation: Event,
  persistence: PersistencePort,
): Promise<Event> {
  const events = await persistence.readEventsInSequence(input.lenoseedId);
  const causedByEventIds = observations.map((observation) => observation.sourceEvent.id);
  if (causedByEventIds.includes(formation.id)) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint causes must be distinct");
  }
  causedByEventIds.push(formation.id);
  const event: Event = {
    id: checkpointId(input), lenoseedId: input.lenoseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    type: "validation_decision_recorded", occurredAt: plan.timestamp, turnId: null,
    sourceId: input.systemSourceId, actorRef: null, causedByEventIds,
    observedStateVersion: await persistence.getStateVersion(input.lenoseedId),
    payload: serializePlan(input, plan, current), payloadSchemaVersion: 3,
    engineVersion: input.engineVersion, idempotencyKey: decisionKey(input),
  };
  await persistence.appendEvent(event);
  return event;
}

async function appendCompletion(
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  checkpoint: Event,
  plan: G0A2DisputePlan,
  commit: AtomicCommitResult,
  persistence: PersistencePort,
): Promise<void> {
  const events = await persistence.readEventsInSequence(input.lenoseedId);
  await persistence.appendEvent({
    id: completionId(input), lenoseedId: input.lenoseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    type: "state_commit_completed", occurredAt: plan.timestamp, turnId: null,
    sourceId: input.systemSourceId, actorRef: null, causedByEventIds: [checkpoint.id],
    observedStateVersion: commit.previousStateVersion,
    payload: {
      scope: SCOPE, consolidationId: input.consolidationId,
      previousStateVersion: commit.previousStateVersion,
      newStateVersion: commit.newStateVersion,
      changed: commit.applied,
    },
    payloadSchemaVersion: 2, engineVersion: input.engineVersion,
    idempotencyKey: completedKey(input),
  });
}

function findCheckpoint(
  events: readonly Event[],
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
): Event | null {
  const matches = events.filter((event) =>
    event.id === checkpointId(input) ||
    event.idempotencyKey === decisionKey(input) ||
    (event.type === "validation_decision_recorded" &&
      event.payloadSchemaVersion === 3 &&
      event.payload.scope === SCOPE &&
      event.payload.consolidationId === input.consolidationId),
  );
  if (matches.length > 1) throw new DomainInvariantError("G0-A2 dispute has multiple checkpoints");
  return matches[0] ?? null;
}

function findCompletion(
  events: readonly Event[],
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
): Event | null {
  const matches = events.filter((event) =>
    event.id === completionId(input) ||
    event.idempotencyKey === completedKey(input) ||
    (event.type === "state_commit_completed" &&
      event.payloadSchemaVersion === 2 &&
      event.payload.scope === SCOPE &&
      event.payload.consolidationId === input.consolidationId),
  );
  if (matches.length > 1) throw new DomainInvariantError("G0-A2 dispute has multiple completions");
  return matches[0] ?? null;
}

async function parseCheckpoint(
  event: Event,
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  persistence: PersistencePort,
): Promise<{ plan: G0A2DisputePlan; prior: SelfHypothesis }> {
  if (
    event.id !== checkpointId(input) || event.lenoseedId !== input.lenoseedId ||
    event.type !== "validation_decision_recorded" || event.payloadSchemaVersion !== 3 ||
    event.idempotencyKey !== decisionKey(input) || event.turnId !== null ||
    event.sourceId !== input.systemSourceId || event.actorRef !== null ||
    event.engineVersion !== input.engineVersion || !stateVersion(event.observedStateVersion)
  ) throw new DomainInvariantError("G0-A2 dispute checkpoint identity is incoherent");

  const payload = record(event.payload, "checkpoint");
  if (
    string(payload.scope, "scope") !== SCOPE ||
    string(payload.consolidationId, "consolidationId") !== input.consolidationId
  ) throw new DomainInvariantError("G0-A2 dispute checkpoint scope is incoherent");
  const candidate = parseProposition(payload.candidateProposition, "candidateProposition");
  const hypothesisKey = string(payload.hypothesisKey, "hypothesisKey");
  const inputEvidenceIds = strings(payload.inputEvidenceItemIds, "inputEvidenceItemIds");
  if (!sameSet(inputEvidenceIds, input.evidenceItemIds)) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint conflicts with requested input");
  }
  const outcome = string(payload.outcome, "outcome");
  if (outcome !== "dispute" && outcome !== "no_change") {
    throw new DomainInvariantError("G0-A2 dispute checkpoint outcome is invalid");
  }

  const prior = await readHistoricalV1(input.lenoseedId, candidate, payload.supersededHypothesisId, outcome, persistence);
  if (
    !propositionEquals(candidate, prior.proposition) ||
    buildSelfHypothesisKey(candidate) !== hypothesisKey ||
    hypothesisKey !== prior.hypothesisKey
  ) throw new DomainInvariantError("G0-A2 dispute checkpoint candidate is incoherent");
  const formation = await readFormationBoundary(input.lenoseedId, prior, persistence);
  const observations = await readObservations(input, persistence);
  await validateBoundedSnapshot(observations, prior, formation.completed, persistence);
  const canonicalEvidenceIds = observations.map((observation) => observation.evidenceItem.id);
  if (!sameList(inputEvidenceIds, canonicalEvidenceIds)) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint evidence order is incoherent");
  }
  const expectedCauseIds = [...observations.map((observation) => observation.sourceEvent.id), formation.checkpoint.id];
  if (
    new Set(expectedCauseIds).size !== expectedCauseIds.length ||
    !sameList(event.causedByEventIds, expectedCauseIds)
  ) throw new DomainInvariantError("G0-A2 dispute checkpoint causality is incoherent");
  const timestamp = observations.at(-1)?.sourceEvent.occurredAt;
  if (timestamp === undefined || event.occurredAt !== timestamp) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint timestamp is incoherent");
  }

  const parsedLinks = parseLinks(payload.linkSnapshots);
  const countedSupportGroups = strings(payload.countedSupportGroups, "countedSupportGroups");
  const countedAgainstGroups = strings(payload.countedAgainstGroups, "countedAgainstGroups");
  const ignoredContaminatedLinkIds = strings(payload.ignoredContaminatedLinkIds, "ignoredContaminatedLinkIds");
  const next = payload.nextHypothesisSnapshot === null
    ? null
    : parseHypothesis(payload.nextHypothesisSnapshot, "nextHypothesisSnapshot");
  const supersededId = payload.supersededHypothesisId === null
    ? null
    : string(payload.supersededHypothesisId, "supersededHypothesisId");

  const structuralLinks = buildStructuralLinks(
    input,
    observations,
    prior.hypothesisKey,
    candidate,
    buildDisputedG0A2SelfHypothesisId(input.lenoseedId, input.consolidationId),
  );
  const counted = countGroups(outcome === "dispute" ? structuralLinks : structuralLinks);
  if (
    !sameList(countedSupportGroups, counted.support) ||
    !sameList(countedAgainstGroups, counted.against) ||
    !sameList(ignoredContaminatedLinkIds, structuralLinks.filter((link) => link.causalContamination !== "none").map((link) => link.id))
  ) throw new DomainInvariantError("G0-A2 dispute checkpoint counted groups are incoherent");

  if (outcome === "no_change") {
    if (next !== null || parsedLinks.length !== 0 || supersededId !== null) {
      throw new DomainInvariantError("G0-A2 no_change checkpoint contains durable snapshots");
    }
    return {
      prior,
      plan: {
        outcome, hypothesisKey, inputEvidenceItemIds: canonicalEvidenceIds,
        countedSupportGroups, countedAgainstGroups, ignoredContaminatedLinkIds,
        linkSnapshots: [], nextHypothesisSnapshot: null, supersededHypothesisId: null, timestamp,
      },
    };
  }

  const expectedV2Id = buildDisputedG0A2SelfHypothesisId(input.lenoseedId, input.consolidationId);
  if (supersededId !== prior.id || next === null || !sameLinks(parsedLinks, structuralLinks)) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint links are incoherent");
  }
  const expectedNext = buildExpectedV2(prior, candidate, expectedV2Id, structuralLinks, timestamp);
  if (!sameHypothesis(next, expectedNext)) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint v2 snapshot is incoherent");
  }
  const cleanContradictions = new Set(structuralLinks.filter((link) =>
    link.causalContamination === "none" && link.relation === "contradicts" &&
    (link.independenceGroup === "g0a2:R1" || link.independenceGroup === "g0a2:R2"),
  ).map((link) => link.independenceGroup));
  if (cleanContradictions.size !== 2) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint lacks its historical contradiction threshold");
  }
  return {
    prior,
    plan: {
      outcome, hypothesisKey, inputEvidenceItemIds: canonicalEvidenceIds,
      countedSupportGroups, countedAgainstGroups, ignoredContaminatedLinkIds,
      linkSnapshots: parsedLinks, nextHypothesisSnapshot: next,
      supersededHypothesisId: supersededId, timestamp,
    },
  };
}

async function readHistoricalV1(
  lenoseedId: EntityId,
  candidate: Proposition,
  supersededValue: SerializableValue | undefined,
  outcome: "dispute" | "no_change",
  persistence: PersistencePort,
): Promise<SelfHypothesis> {
  const key = buildSelfHypothesisKey(candidate);
  let v1: SelfHypothesis | null = null;
  if (outcome === "dispute") {
    const id = string(supersededValue, "supersededHypothesisId");
    v1 = await persistence.readSelfHypothesis(lenoseedId, id);
  } else {
    if (supersededValue !== null) throw new DomainInvariantError("G0-A2 no_change checkpoint supersedes v1");
    const history = await persistence.readSelfHypothesisHistoryByKey(lenoseedId, key);
    v1 = history.find((hypothesis) => hypothesis.version === 1) ?? null;
  }
  if (v1 === null || !isCoherentV1(v1, key) || !propositionEquals(v1.proposition, candidate)) {
    throw new DomainInvariantError("G0-A2 dispute checkpoint v1 is incoherent");
  }
  return v1;
}

function buildStructuralLinks(
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  observations: readonly G0A2DisputeObservation[],
  hypothesisKey: string,
  candidate: Proposition,
  targetId: EntityId,
): readonly EvidenceLink[] {
  return observations.map((observation) => {
    const situation = observation.evidenceItem.proposition.context.situationId as string;
    const relation = observation.evidenceItem.proposition.value === candidate.value ? "supports" as const : "contradicts" as const;
    const contaminated = observation.triggerHypothesisKeys.includes(hypothesisKey);
    return {
      id: buildG0A2SelfHypothesisLinkId(input.consolidationId, observation.evidenceItem.id, targetId, relation),
      lenoseedId: input.lenoseedId, evidenceItemId: observation.evidenceItem.id,
      targetType: "self_hypothesis" as const, targetId, relation,
      sourceAuthority: "high" as const, independenceGroup: `g0a2:${situation}`,
      causalContamination: contaminated ? "influenced_by_target" as const : "none" as const,
      weightClass: contaminated ? "low" as const : "high" as const,
      createdAt: observation.sourceEvent.occurredAt,
    };
  });
}

function buildExpectedV2(
  v1: SelfHypothesis,
  candidate: Proposition,
  id: EntityId,
  links: readonly EvidenceLink[],
  timestamp: string,
): SelfHypothesis {
  return {
    id, lenoseedId: v1.lenoseedId, hypothesisKey: v1.hypothesisKey, version: 2,
    proposition: candidate, stage: "hypothesis",
    supportLinkIds: links.filter((link) => link.relation === "supports").map((link) => link.id),
    againstLinkIds: links.filter((link) => link.relation === "contradicts").map((link) => link.id),
    confidence: "low", status: "disputed", previousVersionId: v1.id,
    createdAt: timestamp, updatedAt: timestamp,
  };
}

function countGroups(links: readonly EvidenceLink[]): { support: string[]; against: string[] } {
  const relations = new Map<string, Set<"supports" | "contradicts">>();
  for (const link of links) {
    if (link.causalContamination !== "none") continue;
    const values = relations.get(link.independenceGroup) ?? new Set<"supports" | "contradicts">();
    values.add(link.relation); relations.set(link.independenceGroup, values);
  }
  const support: string[] = []; const against: string[] = [];
  for (const [group, relationsForGroup] of relations) {
    if (relationsForGroup.size !== 1) continue;
    if (relationsForGroup.has("supports")) support.push(group); else against.push(group);
  }
  return { support, against };
}

function serializePlan(
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  plan: G0A2DisputePlan,
  current: SelfHypothesis,
): Readonly<Record<string, SerializableValue>> {
  return {
    scope: SCOPE, consolidationId: input.consolidationId, hypothesisKey: plan.hypothesisKey,
    candidateProposition: serializeProposition(current.proposition),
    inputEvidenceItemIds: [...plan.inputEvidenceItemIds],
    countedSupportGroups: [...plan.countedSupportGroups],
    countedAgainstGroups: [...plan.countedAgainstGroups],
    ignoredContaminatedLinkIds: [...plan.ignoredContaminatedLinkIds], outcome: plan.outcome,
    linkSnapshots: plan.linkSnapshots.map(serializeLink),
    nextHypothesisSnapshot: plan.nextHypothesisSnapshot === null ? null : serializeHypothesis(plan.nextHypothesisSnapshot),
    supersededHypothesisId: plan.supersededHypothesisId,
  };
}

function validateCompletion(
  event: Event,
  checkpoint: Event,
  plan: G0A2DisputePlan,
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
): Omit<ConsolidateG0A2SelfHypothesisDisputeResult, "outcome" | "selfHypothesisId" | "replayed"> {
  const payload = record(event.payload, "completion");
  const previous = number(payload.previousStateVersion, "completion previousStateVersion");
  const next = number(payload.newStateVersion, "completion newStateVersion");
  const changed = payload.changed;
  if (
    event.id !== completionId(input) || event.lenoseedId !== input.lenoseedId ||
    event.type !== "state_commit_completed" || event.payloadSchemaVersion !== 2 ||
    event.turnId !== null || event.sourceId !== input.systemSourceId || event.actorRef !== null ||
    event.engineVersion !== input.engineVersion || event.idempotencyKey !== completedKey(input) ||
    !sameList(event.causedByEventIds, [checkpoint.id]) || event.occurredAt !== plan.timestamp ||
    event.observedStateVersion !== previous || !stateVersion(previous) || !stateVersion(next) ||
    typeof changed !== "boolean" || string(payload.scope, "completion scope") !== SCOPE ||
    string(payload.consolidationId, "completion consolidationId") !== input.consolidationId ||
    previous !== checkpoint.observedStateVersion ||
    changed !== (plan.outcome === "dispute") ||
    next !== previous + (changed ? 1 : 0)
  ) throw new DomainInvariantError("G0-A2 dispute completion is incoherent");
  return { previousStateVersion: previous, newStateVersion: next, changed };
}

async function validateDurable(
  plan: G0A2DisputePlan,
  prior: SelfHypothesis,
  input: ConsolidateG0A2SelfHypothesisDisputeInput,
  persistence: PersistencePort,
): Promise<void> {
  if (plan.outcome === "no_change") {
    const v2 = await persistence.readSelfHypothesis(
      input.lenoseedId,
      buildDisputedG0A2SelfHypothesisId(input.lenoseedId, input.consolidationId),
    );
    if (v2 !== null) throw new DomainInvariantError("G0-A2 no_change has a deterministic v2");
    return;
  }
  if (!isCoherentV1(prior, plan.hypothesisKey) || prior.status !== "superseded") {
    throw new DomainInvariantError("G0-A2 dispute durable v1 is incoherent");
  }
  const snapshot = plan.nextHypothesisSnapshot;
  if (snapshot === null) throw new DomainInvariantError("G0-A2 dispute has no durable v2 snapshot");
  const actual = await persistence.readSelfHypothesis(input.lenoseedId, snapshot.id);
  if (
    actual === null || !sameHypothesisImmutable(actual, snapshot) ||
    !((actual.status === "disputed" && actual.updatedAt === snapshot.updatedAt) || actual.status === "superseded")
  ) throw new DomainInvariantError("G0-A2 dispute durable v2 is incoherent");
  for (const link of plan.linkSnapshots) {
    if (!sameLink(await persistence.readEvidenceLink(input.lenoseedId, link.id), link)) {
      throw new DomainInvariantError("G0-A2 dispute durable links are incoherent");
    }
  }
}

function parseLinks(value: SerializableValue | undefined): readonly EvidenceLink[] {
  if (!Array.isArray(value)) throw new DomainInvariantError("G0-A2 dispute linkSnapshots are malformed");
  return value.map((item) => {
    const link = record(item, "linkSnapshot");
    const relation = string(link.relation, "link relation");
    const targetType = string(link.targetType, "link targetType");
    const contamination = string(link.causalContamination, "link causalContamination");
    if (
      (relation !== "supports" && relation !== "contradicts") || targetType !== "self_hypothesis" ||
      (contamination !== "none" && contamination !== "influenced_by_target")
    ) throw new DomainInvariantError("G0-A2 dispute linkSnapshot is invalid");
    return {
      id: string(link.id, "link id"), lenoseedId: string(link.lenoseedId, "link lenoseedId"),
      evidenceItemId: string(link.evidenceItemId, "link evidenceItemId"), targetType,
      targetId: string(link.targetId, "link targetId"), relation,
      sourceAuthority: weight(link.sourceAuthority), independenceGroup: string(link.independenceGroup, "link independenceGroup"),
      causalContamination: contamination, weightClass: weight(link.weightClass),
      createdAt: string(link.createdAt, "link createdAt"),
    };
  });
}

function parseHypothesis(value: SerializableValue | undefined, label: string): SelfHypothesis {
  const hypothesis = record(value, label);
  const status = string(hypothesis.status, `${label} status`);
  const confidence = string(hypothesis.confidence, `${label} confidence`);
  const stage = string(hypothesis.stage, `${label} stage`);
  const version = number(hypothesis.version, `${label} version`);
  if (
    (status !== "active" && status !== "disputed" && status !== "superseded") ||
    (confidence !== "low" && confidence !== "moderate") || stage !== "hypothesis" ||
    !Number.isInteger(version)
  ) throw new DomainInvariantError(`G0-A2 dispute ${label} is invalid`);
  const previous = hypothesis.previousVersionId;
  if (previous !== null && typeof previous !== "string") {
    throw new DomainInvariantError(`G0-A2 dispute ${label} previousVersionId is invalid`);
  }
  return {
    id: string(hypothesis.id, `${label} id`), lenoseedId: string(hypothesis.lenoseedId, `${label} lenoseedId`),
    hypothesisKey: string(hypothesis.hypothesisKey, `${label} hypothesisKey`), version,
    proposition: parseProposition(hypothesis.proposition, `${label} proposition`), stage,
    supportLinkIds: strings(hypothesis.supportLinkIds, `${label} supportLinkIds`),
    againstLinkIds: strings(hypothesis.againstLinkIds, `${label} againstLinkIds`),
    confidence, status, previousVersionId: previous,
    createdAt: string(hypothesis.createdAt, `${label} createdAt`),
    updatedAt: string(hypothesis.updatedAt, `${label} updatedAt`),
  };
}

function parseProposition(value: SerializableValue | undefined, label: string): Proposition {
  const proposition = record(value, label);
  const context = record(proposition.context, `${label} context`);
  const parsedContext: Record<string, ScalarValue> = {};
  for (const [key, contextValue] of Object.entries(context)) {
    if (contextValue === undefined || !scalar(contextValue)) throw new DomainInvariantError(`G0-A2 dispute ${label} context is invalid`);
    parsedContext[key] = contextValue;
  }
  const propositionValue = proposition.value;
  if (propositionValue === undefined || !scalar(propositionValue)) throw new DomainInvariantError(`G0-A2 dispute ${label} value is invalid`);
  return {
    subjectRef: string(proposition.subjectRef, `${label} subjectRef`),
    predicate: string(proposition.predicate, `${label} predicate`),
    value: propositionValue,
    context: parsedContext,
  };
}

function isCoherentV1(value: SelfHypothesis, key: string): boolean {
  return value.version === 1 && value.stage === "hypothesis" && value.confidence === "moderate" &&
    (value.status === "active" || value.status === "superseded") &&
    value.hypothesisKey === key && value.previousVersionId === null &&
    value.proposition.subjectRef === value.lenoseedId && value.proposition.predicate === AXIS &&
    value.proposition.context.protocol === "G0-A2" &&
    (value.proposition.value === "seek_clarification" || value.proposition.value === "use_available_information");
}

function sameInitialV1Snapshot(historical: SelfHypothesis, actual: SelfHypothesis): boolean {
  return isCoherentV1(historical, actual.hypothesisKey) && historical.status === "active" &&
    sameHypothesisImmutable(historical, actual) &&
    sameList(historical.supportLinkIds, actual.supportLinkIds) &&
    sameList(historical.againstLinkIds, actual.againstLinkIds);
}

function sameHypothesis(left: SelfHypothesis, right: SelfHypothesis): boolean {
  return sameHypothesisImmutable(left, right) && left.status === right.status &&
    left.updatedAt === right.updatedAt;
}

function sameHypothesisImmutable(left: SelfHypothesis, right: SelfHypothesis): boolean {
  return left.id === right.id && left.lenoseedId === right.lenoseedId &&
    left.hypothesisKey === right.hypothesisKey && left.version === right.version &&
    propositionEquals(left.proposition, right.proposition) && left.stage === right.stage &&
    sameList(left.supportLinkIds, right.supportLinkIds) && sameList(left.againstLinkIds, right.againstLinkIds) &&
    left.confidence === right.confidence && left.previousVersionId === right.previousVersionId &&
    left.createdAt === right.createdAt;
}

function sameLinks(left: readonly EvidenceLink[], right: readonly EvidenceLink[]): boolean {
  return left.length === right.length && left.every((link, index) => {
    const expected = right[index];
    return expected !== undefined && sameLink(link, expected);
  });
}

function sameLink(left: EvidenceLink | null, right: EvidenceLink): boolean {
  return left !== null && left.id === right.id && left.lenoseedId === right.lenoseedId &&
    left.evidenceItemId === right.evidenceItemId && left.targetType === right.targetType &&
    left.targetId === right.targetId && left.relation === right.relation &&
    left.sourceAuthority === right.sourceAuthority && left.independenceGroup === right.independenceGroup &&
    left.causalContamination === right.causalContamination && left.weightClass === right.weightClass &&
    left.createdAt === right.createdAt;
}

function serializeProposition(value: Proposition): SerializableValue {
  return { subjectRef: value.subjectRef, predicate: value.predicate, value: value.value, context: { ...value.context } };
}
function serializeLink(value: EvidenceLink): SerializableValue { return { ...value }; }
function serializeHypothesis(value: SelfHypothesis): SerializableValue {
  return { ...value, proposition: serializeProposition(value.proposition), supportLinkIds: [...value.supportLinkIds], againstLinkIds: [...value.againstLinkIds] };
}
function record(value: SerializableValue | undefined, label: string): Readonly<Record<string, SerializableValue>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new DomainInvariantError(`G0-A2 dispute ${label} is malformed`);
  return value as Readonly<Record<string, SerializableValue>>;
}
function string(value: SerializableValue | undefined, label: string): string {
  if (typeof value !== "string") throw new DomainInvariantError(`G0-A2 dispute ${label} is malformed`);
  return value;
}
function strings(value: SerializableValue | undefined, label: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new DomainInvariantError(`G0-A2 dispute ${label} is malformed`);
  return value as readonly string[];
}
function number(value: SerializableValue | undefined, label: string): number {
  if (typeof value !== "number") throw new DomainInvariantError(`G0-A2 dispute ${label} is malformed`);
  return value;
}
function scalar(value: SerializableValue): value is ScalarValue {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function weight(value: SerializableValue | undefined): "low" | "medium" | "high" {
  const result = string(value, "weight");
  if (result !== "low" && result !== "medium" && result !== "high") throw new DomainInvariantError("G0-A2 dispute weight is invalid");
  return result;
}
function stateVersion(value: number): boolean { return Number.isInteger(value) && value >= 0; }
function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && new Set(left).size === left.length && left.every((item) => right.includes(item));
}
function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
function snapshotId(value: SerializableValue | undefined): string | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null;
}
function expectedHypothesisKey(lenoseedId: EntityId): string {
  return buildSelfHypothesisKey({ subjectRef: lenoseedId, predicate: AXIS, value: "seek_clarification", context: { protocol: "G0-A2" } });
}
function checkpointId(input: ConsolidateG0A2SelfHypothesisDisputeInput): EntityId { return `E-G0A2-${input.lenoseedId}-${input.consolidationId}-decision`; }
function completionId(input: ConsolidateG0A2SelfHypothesisDisputeInput): EntityId { return `E-G0A2-${input.lenoseedId}-${input.consolidationId}-completed`; }
function decisionKey(input: ConsolidateG0A2SelfHypothesisDisputeInput): string { return `${KEY_PREFIX}:${input.lenoseedId}:${input.consolidationId}:decision`; }
function commitKey(input: ConsolidateG0A2SelfHypothesisDisputeInput): string { return `${KEY_PREFIX}:${input.lenoseedId}:${input.consolidationId}:commit`; }
function completedKey(input: ConsolidateG0A2SelfHypothesisDisputeInput): string { return `${KEY_PREFIX}:${input.lenoseedId}:${input.consolidationId}:completed`; }
