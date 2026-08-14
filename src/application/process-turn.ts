import { createInitialBelief, reviseBelief, type Belief } from "../domain/belief.js";
import { DomainInvariantError } from "../domain/errors.js";
import type { EvidenceItem, EvidenceLink } from "../domain/evidence.js";
import type { Event } from "../domain/event.js";
import type { Intention, IntentionKind } from "../domain/intention.js";
import type { EntityId, StateVersion, Timestamp, TurnId } from "../domain/primitives.js";
import { buildBeliefKey, propositionEquals, type Proposition } from "../domain/proposition.js";
import type {
  AIEngine,
  BeliefSnapshot,
  CandidateEvidenceItem,
  FormulationContext,
} from "../ports/ai-engine.js";
import type {
  AtomicCommitResult,
  CommitMutations,
  PersistencePort,
} from "../ports/persistence.js";
import { validateEvidenceItem } from "./validate-evidence.js";
import {
  acceptedCandidatesFromCheckpoint,
  buildTemporaryEvidencePayload,
  findTemporaryEvidenceCheckpoint,
  type TemporaryEvidenceOutcome,
} from "./temporary-evidence-checkpoint.js";

const EMPLOYMENT_START_YEAR = "employment_start_year";
const HISTORY_DENIAL = "denies_prior_employment_start_year_testimony";

export interface ProcessTurnInput {
  readonly lenoseedId: EntityId;
  readonly turnId: TurnId;
  readonly humanSourceId: EntityId;
  readonly humanActorRef: EntityId;
  readonly systemSourceId: EntityId;
  readonly message: string;
  readonly occurredAt: Timestamp;
  readonly engineVersion: string;
}

export interface ProcessTurnResult {
  readonly response: string;
  readonly stateVersion: StateVersion;
  readonly replayed: boolean;
}

export async function processTurn(
  input: ProcessTurnInput,
  persistence: PersistencePort,
  aiEngine: AIEngine,
): Promise<ProcessTurnResult> {
  const existingEvents = await persistence.readEventsByTurn(input.lenoseedId, input.turnId);
  const existingInputEvent = existingEvents.find((event) => event.type === "human_message_received");
  const existingIntentionEvent = existingEvents.find((event) => event.type === "intention_selected");
  const emittedEvent = existingEvents.find((event) => event.type === "lenoseed_message_emitted");
  const commitCompletedEvent = existingEvents.find(
    (event) => event.type === "state_commit_completed",
  );

  if (commitCompletedEvent !== undefined && emittedEvent === undefined) {
    const error = new DomainInvariantError(
      `Turn ${input.turnId} has state_commit_completed without lenoseed_message_emitted`,
    );
    await recordFailureIfAbsent(
      input,
      persistence,
      "state_commit",
      existingInputEvent === undefined ? [] : [existingInputEvent.id],
      error,
    );
    throw error;
  }

  if (emittedEvent !== undefined && existingIntentionEvent === undefined) {
    const error = new DomainInvariantError(
      `Turn ${input.turnId} has lenoseed_message_emitted without intention_selected`,
    );
    await recordFailureIfAbsent(
      input,
      persistence,
      "language_generation",
      existingInputEvent === undefined ? [emittedEvent.id] : [existingInputEvent.id, emittedEvent.id],
      error,
    );
    throw error;
  }

  if (emittedEvent !== undefined && commitCompletedEvent !== undefined) {
    return {
      response: readTextPayload(emittedEvent),
      stateVersion: await persistence.getStateVersion(input.lenoseedId),
      replayed: true,
    };
  }

  const observedStateVersion = await persistence.getStateVersion(input.lenoseedId);
  const inputEvent =
    existingInputEvent ??
    (await appendEvent(
      persistence,
      input.lenoseedId,
      {
        id: `E-${input.turnId}-input`,
        type: "human_message_received",
        occurredAt: input.occurredAt,
        turnId: input.turnId,
        sourceId: input.humanSourceId,
        actorRef: input.humanActorRef,
        causedByEventIds: [],
        observedStateVersion,
        payload: { text: input.message },
        engineVersion: input.engineVersion,
        idempotencyKey: `${input.turnId}:input`,
      },
    ));

  let checkpoint;
  try {
    checkpoint = findTemporaryEvidenceCheckpoint(existingEvents, input.turnId, inputEvent.id);
  } catch (error) {
    await recordFailureIfAbsent(input, persistence, "evidence_validation", [inputEvent.id], error);
    throw error;
  }

  if (checkpoint === null && (existingIntentionEvent !== undefined || emittedEvent !== undefined)) {
    const error = new DomainInvariantError(
      `Turn ${input.turnId} has downstream events without a temporary evidence checkpoint`,
    );
    await recordFailureIfAbsent(input, persistence, "evidence_validation", [inputEvent.id], error);
    throw error;
  }

  let acceptedCandidates: readonly CandidateEvidenceItem[];
  let noValidGroundedEvidence: boolean;
  if (checkpoint !== null) {
    try {
      acceptedCandidates = acceptedCandidatesFromCheckpoint(checkpoint);
      noValidGroundedEvidence = checkpoint.outcomes.length > 0 && acceptedCandidates.length === 0;
    } catch (error) {
      await recordFailureIfAbsent(input, persistence, "evidence_validation", [inputEvent.id], error);
      throw error;
    }
  } else {
    let rawCandidates: readonly CandidateEvidenceItem[];
    try {
      rawCandidates = await aiEngine.extractEvidence({
        turnId: input.turnId,
        message: input.message,
        sourceId: input.humanSourceId,
        eventId: inputEvent.id,
        allowedContext: {},
      });
    } catch (error) {
      await recordFailureIfAbsent(input, persistence, "evidence_extraction", [inputEvent.id], error);
      throw error;
    }

    try {
      const validation = await validateTemporaryCandidates(input, inputEvent, rawCandidates, persistence);
      const stateVersion = await persistence.getStateVersion(input.lenoseedId);
      const checkpointEvent = await appendEvent(persistence, input.lenoseedId, {
        id: `E-${input.turnId}-temporary-evidence`,
        type: "validation_decision_recorded",
        occurredAt: input.occurredAt,
        turnId: input.turnId,
        sourceId: input.systemSourceId,
        actorRef: null,
        causedByEventIds: [inputEvent.id],
        observedStateVersion: stateVersion,
        payload: buildTemporaryEvidencePayload(validation.outcomes),
        payloadSchemaVersion: 2,
        engineVersion: input.engineVersion,
        idempotencyKey: `${input.turnId}:temporary-evidence`,
      });
      checkpoint = findTemporaryEvidenceCheckpoint([checkpointEvent], input.turnId, inputEvent.id);
      if (checkpoint === null) {
        throw new DomainInvariantError(`Turn ${input.turnId} did not persist its temporary evidence checkpoint`);
      }
      acceptedCandidates = acceptedCandidatesFromCheckpoint(checkpoint);
      noValidGroundedEvidence = checkpoint.outcomes.length > 0 && acceptedCandidates.length === 0;
    } catch (error) {
      await recordFailureIfAbsent(input, persistence, "evidence_validation", [inputEvent.id], error);
      throw error;
    }
  }

  const stateVersion = await persistence.getStateVersion(input.lenoseedId);
  const beliefContext = await readBeliefContext(
    persistence,
    input.lenoseedId,
    input.humanActorRef,
    stateVersion,
  );
  const intention =
    existingIntentionEvent === undefined
      ? selectIntention(
          input,
          inputEvent.id,
          acceptedCandidates,
          beliefContext.currentBelief,
          stateVersion,
          noValidGroundedEvidence,
        )
      : reconstructHistoricalIntention(input, inputEvent.id, existingIntentionEvent, beliefContext.currentBelief);
  const formulationContext: FormulationContext = {
    ...beliefContext,
    stateVersion,
    turnEvidence: acceptedCandidates.map((candidate) => ({
      predicate: candidate.proposition.predicate,
      value: candidate.proposition.value,
    })),
  };

  const intentionEvent =
    existingIntentionEvent ??
    (await appendEvent(persistence, input.lenoseedId, {
      id: `E-${input.turnId}-intention`,
      type: "intention_selected",
      occurredAt: input.occurredAt,
      turnId: input.turnId,
      sourceId: input.systemSourceId,
      actorRef: null,
      causedByEventIds: [inputEvent.id],
      observedStateVersion: stateVersion,
      payload: {
        intentionId: intention.id,
        kind: intention.kind,
        motivation: intention.motivation,
      },
      engineVersion: input.engineVersion,
      idempotencyKey: `${input.turnId}:intention`,
    }));

  let response: string;
  let responseEvent: Event;
  if (emittedEvent !== undefined) {
    response = readTextPayload(emittedEvent);
    responseEvent = emittedEvent;
  } else {
    try {
      response = await aiEngine.formulate({
        turnId: input.turnId,
        intention,
        context: formulationContext,
      });
    } catch (error) {
      await recordFailureIfAbsent(
        input,
        persistence,
        "language_generation",
        [inputEvent.id, intentionEvent.id],
        error,
      );
      throw error;
    }

    responseEvent = await appendEvent(persistence, input.lenoseedId, {
      id: `E-${input.turnId}-emitted`,
      type: "lenoseed_message_emitted",
      occurredAt: input.occurredAt,
      turnId: input.turnId,
      sourceId: input.systemSourceId,
      actorRef: null,
      causedByEventIds: [inputEvent.id, intentionEvent.id],
      observedStateVersion: stateVersion,
      payload: { text: response, intentionId: intention.id },
      engineVersion: input.engineVersion,
      idempotencyKey: `${input.turnId}:response`,
    });
  }

  const commitKey = `${input.turnId}:commit`;
  let commit: AtomicCommitResult;
  try {
    const commitAlreadyApplied = await persistence.checkIdempotencyKey(input.lenoseedId, commitKey);
    commit = commitAlreadyApplied
      ? recoverAppliedCommit(checkpoint.event.observedStateVersion, await persistence.getStateVersion(input.lenoseedId))
      : await commitTurn(
          input,
          inputEvent,
          acceptedCandidates,
          stateVersion,
          persistence,
          commitKey,
        );
  } catch (error) {
    await recordFailureIfAbsent(
      input,
      persistence,
      "state_commit",
      [inputEvent.id, intentionEvent.id, responseEvent.id],
      error,
    );
    throw error;
  }

  await appendEvent(persistence, input.lenoseedId, {
    id: `E-${input.turnId}-commit`,
    type: "state_commit_completed",
    occurredAt: input.occurredAt,
    turnId: input.turnId,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: [responseEvent.id],
    observedStateVersion: checkpoint.event.observedStateVersion,
    payload: {
      previousStateVersion: commit.previousStateVersion,
      newStateVersion: commit.newStateVersion,
      changed: commit.applied,
    },
    engineVersion: input.engineVersion,
    idempotencyKey: `${input.turnId}:state_commit`,
  });

  return { response, stateVersion: commit.newStateVersion, replayed: false };
}

function recoverAppliedCommit(
  previousStateVersion: StateVersion,
  newStateVersion: StateVersion,
): AtomicCommitResult {
  const difference = newStateVersion - previousStateVersion;
  if (difference !== 0 && difference !== 1) {
    throw new DomainInvariantError(
      `Recovered commit has incoherent state transition ${previousStateVersion} -> ${newStateVersion}`,
    );
  }
  return {
    applied: difference === 1,
    previousStateVersion,
    newStateVersion,
  };
}

async function commitTurn(
  input: ProcessTurnInput,
  inputEvent: Event,
  candidates: readonly CandidateEvidenceItem[],
  stateVersion: StateVersion,
  persistence: PersistencePort,
  commitKey: string,
) {
  const evidenceItems: EvidenceItem[] = [];
  const evidenceLinks: EvidenceLink[] = [];
  const beliefs: Belief[] = [];

  for (const candidate of candidates) {
    const current = await persistence.readActiveBeliefByKey(
      input.lenoseedId,
      buildBeliefKey(candidate.proposition),
    );
    const evidenceItem = await createEvidenceItem(input, inputEvent, candidate, current, persistence);
    const groundingRejection = await validateEvidenceItem(evidenceItem, persistence);
    if (groundingRejection !== null) {
      throw new DomainInvariantError(
        `Accepted candidate ${evidenceItem.id} failed grounding: ${groundingRejection}`,
      );
    }
    evidenceItems.push(evidenceItem);

    if (candidate.proposition.predicate !== EMPLOYMENT_START_YEAR) {
      continue;
    }

    if (current === null) {
      const beliefId = "B-START-v1";
      const support = createEvidenceLink(
        input.lenoseedId,
        evidenceItem.id,
        beliefId,
        "supports",
        input.occurredAt,
      );
      const belief = createInitialBelief({
        id: beliefId,
        lenoseedId: input.lenoseedId,
        proposition: candidate.proposition,
        evidenceForLinkId: support.id,
        confidence: "moderate_high",
        now: input.occurredAt,
      });
      evidenceLinks.push(support);
      beliefs.push(belief);
      continue;
    }

    if (!propositionEquals(current.proposition, candidate.proposition)) {
      const nextBeliefId = `B-START-v${current.version + 1}`;
      const contradicts = createEvidenceLink(
        input.lenoseedId,
        evidenceItem.id,
        current.id,
        "contradicts",
        input.occurredAt,
      );
      const supports = createEvidenceLink(
        input.lenoseedId,
        evidenceItem.id,
        nextBeliefId,
        "supports",
        input.occurredAt,
      );
      const revision = reviseBelief({
        current,
        nextId: nextBeliefId,
        nextProposition: candidate.proposition,
        supportingLinkId: supports.id,
        contradictingPreviousLinkId: contradicts.id,
        confidence: "moderate_high",
        now: input.occurredAt,
      });
      evidenceLinks.push(contradicts, supports);
      beliefs.push(revision.supersededPrevious, revision.next);
    }
  }

  const mutations: CommitMutations = { evidenceItems, evidenceLinks, beliefs, selfHypotheses: [], memories: [] };
  return persistence.atomicCommit(input.lenoseedId, stateVersion, mutations, commitKey);
}

async function validateTemporaryCandidates(
  input: ProcessTurnInput,
  inputEvent: Event,
  candidates: readonly CandidateEvidenceItem[],
  persistence: PersistencePort,
): Promise<{
  readonly outcomes: readonly TemporaryEvidenceOutcome[];
}> {
  const outcomes: TemporaryEvidenceOutcome[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const candidateId = `CAND-${input.turnId}-${index + 1}`;
    const groundingRejection = await validateEvidenceItem(
      {
        id: candidateId,
        lenoseedId: input.lenoseedId,
        kind: candidate.kind,
        proposition: candidate.proposition,
        sourceId: input.humanSourceId,
        eventIds: [inputEvent.id],
        grounding: {
          kind: "text_excerpt",
          eventId: inputEvent.id,
          supportingExcerpt: candidate.supportingExcerpt,
        },
        extractionConfidence: candidate.extractionConfidence,
        status: "active",
        supersedesId: null,
        extractorVersion: candidate.extractorVersion,
        createdAt: input.occurredAt,
      },
      persistence,
    );
    if (groundingRejection === null) {
      outcomes.push({ candidateId, decision: "accept", candidate });
    } else {
      outcomes.push({ candidateId, decision: "reject", reasonCodes: [groundingRejection] });
    }
  }
  return { outcomes };
}

async function createEvidenceItem(
  input: ProcessTurnInput,
  inputEvent: Event,
  candidate: CandidateEvidenceItem,
  current: Belief | null,
  persistence: PersistencePort,
): Promise<EvidenceItem> {
  const supersedesId =
    current !== null &&
    candidate.proposition.predicate === EMPLOYMENT_START_YEAR &&
    !propositionEquals(current.proposition, candidate.proposition)
      ? await currentSupportingEvidenceId(input.lenoseedId, current, persistence)
      : null;

  return {
    id:
      candidate.proposition.predicate === EMPLOYMENT_START_YEAR
        ? `EV-START-${candidate.proposition.value}`
        : `EV-${input.turnId}`,
    lenoseedId: input.lenoseedId,
    kind: candidate.kind,
    proposition: candidate.proposition,
    sourceId: input.humanSourceId,
    eventIds: [inputEvent.id],
    grounding: {
      kind: "text_excerpt",
      eventId: inputEvent.id,
      supportingExcerpt: candidate.supportingExcerpt,
    },
    extractionConfidence: candidate.extractionConfidence,
    status: "active",
    supersedesId,
    extractorVersion: candidate.extractorVersion,
    createdAt: input.occurredAt,
  };
}

async function currentSupportingEvidenceId(
  lenoseedId: EntityId,
  belief: Belief,
  persistence: PersistencePort,
): Promise<EntityId> {
  const linkId = belief.evidenceForLinkIds[0];
  if (linkId === undefined) {
    throw new DomainInvariantError(`Active belief ${belief.id} has no supporting EvidenceLink`);
  }
  const link = await persistence.readEvidenceLink(lenoseedId, linkId);
  if (link === null) {
    throw new DomainInvariantError(`Belief ${belief.id} references unknown EvidenceLink ${linkId}`);
  }
  return link.evidenceItemId;
}

function createEvidenceLink(
  lenoseedId: EntityId,
  evidenceItemId: EntityId,
  targetId: EntityId,
  relation: "supports" | "contradicts",
  createdAt: Timestamp,
): EvidenceLink {
  return {
    id: `EL-${evidenceItemId}-${targetId}-${relation}`,
    lenoseedId,
    evidenceItemId,
    targetType: "belief",
    targetId,
    relation,
    sourceAuthority: "high",
    independenceGroup: evidenceItemId,
    causalContamination: "none",
    weightClass: "high",
    createdAt,
  };
}

async function readBeliefContext(
  persistence: PersistencePort,
  lenoseedId: EntityId,
  humanActorRef: EntityId,
  stateVersion: StateVersion,
): Promise<FormulationContext> {
  const key = buildBeliefKey(employmentStartProposition(humanActorRef, 0));
  const history = await persistence.readBeliefHistoryByKey(lenoseedId, key);
  const snapshots: BeliefSnapshot[] = [];
  for (const belief of history) {
    if (belief.status !== "active" && belief.status !== "superseded") {
      continue;
    }
    snapshots.push({
      id: belief.id,
      version: belief.version,
      value: belief.proposition.value,
      confidence: belief.confidence,
      status: belief.status,
    });
  }
  const current = snapshots.find((belief) => belief.status === "active") ?? null;
  return { currentBelief: current, beliefHistory: snapshots, turnEvidence: [], stateVersion };
}

function selectIntention(
  input: ProcessTurnInput,
  inputEventId: EntityId,
  candidates: readonly CandidateEvidenceItem[],
  currentBelief: FormulationContext["currentBelief"],
  stateVersion: StateVersion,
  noValidGroundedEvidence: boolean,
): Intention {
  const hasHistoryDenial = candidates.some(
    (candidate) => candidate.proposition.predicate === HISTORY_DENIAL,
  );
  const correction = candidates.some(
    (candidate) =>
      candidate.proposition.predicate === EMPLOYMENT_START_YEAR &&
      currentBelief !== null &&
      !Object.is(candidate.proposition.value, currentBelief.value),
  );
  const kind: IntentionKind = hasHistoryDenial
    ? "report_record_conflict"
    : correction
      ? "acknowledge_correction"
      : "answer_question";

  return {
    id: `I-${input.turnId}`,
    lenoseedId: input.lenoseedId,
    kind,
    target: input.humanActorRef,
    triggerEventIds: [inputEventId],
    triggerEvidenceItemIds: [],
    triggerBeliefIds: currentBelief === null ? [] : [currentBelief.id],
    triggerSelfHypothesisIds: [],
    triggerMemoryIds: [],
    motivation: noValidGroundedEvidence
      ? "no_valid_grounded_evidence"
      : motivationFor(input.message, kind),
    observedStateVersion: stateVersion,
    status: "selected",
    createdAt: input.occurredAt,
  };
}

function motivationFor(message: string, kind: IntentionKind): string {
  if (kind === "acknowledge_correction") return "acknowledge_explicit_correction";
  if (kind === "report_record_conflict") return "preserve_recorded_message_history";
  if (message === "En quelle année t’ai-je dit avoir commencé à l’Atelier Nova ?") {
    return "recall_first_testimony";
  }
  if (message === "En quelle année ai-je commencé à l’Atelier Nova ?") {
    return "report_current_belief";
  }
  if (message === "Est-ce que je t’avais donné une autre année auparavant ?") {
    return "report_belief_history";
  }
  if (
    message ===
    "Quelle est ta conclusion actuelle sur mon année de début à l’Atelier Nova, et pourquoi ?"
  ) {
    return "report_current_belief_with_provenance";
  }
  return "record_first_testimony";
}

function employmentStartProposition(humanActorRef: EntityId, value: number): Proposition {
  return {
    subjectRef: humanActorRef,
    predicate: EMPLOYMENT_START_YEAR,
    value,
    context: { organisation: "Atelier Nova" },
  };
}

async function appendEvent(
  persistence: PersistencePort,
  lenoseedId: EntityId,
  event: Omit<Event, "lenoseedId" | "sequence" | "payloadSchemaVersion"> & {
    readonly payloadSchemaVersion?: number;
  },
): Promise<Event> {
  const events = await persistence.readEventsInSequence(lenoseedId);
  const complete: Event = {
    ...event,
    lenoseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    payloadSchemaVersion: event.payloadSchemaVersion ?? 1,
  };
  await persistence.appendEvent(complete);
  return complete;
}

type FailureStage =
  | "evidence_extraction"
  | "evidence_validation"
  | "language_generation"
  | "state_commit";

async function recordFailureIfAbsent(
  input: ProcessTurnInput,
  persistence: PersistencePort,
  stage: FailureStage,
  causedByEventIds: readonly EntityId[],
  error: unknown,
): Promise<void> {
  const events = await persistence.readEventsByTurn(input.lenoseedId, input.turnId);
  const alreadyRecorded = events.some(
    (event) => event.type === "processing_failure_recorded" && event.payload.stage === stage,
  );
  if (alreadyRecorded) return;
  try {
    await appendEvent(persistence, input.lenoseedId, {
      id: `E-${input.turnId}-failure-${stage.replaceAll("_", "-")}`,
      type: "processing_failure_recorded",
      occurredAt: input.occurredAt,
      turnId: input.turnId,
      sourceId: input.systemSourceId,
      actorRef: null,
      causedByEventIds,
      observedStateVersion: await persistence.getStateVersion(input.lenoseedId),
      payload: {
        stage,
        errorClass: error instanceof Error ? error.name : "UnknownError",
        retryable: true,
      },
      engineVersion: input.engineVersion,
      idempotencyKey: `${input.turnId}:failure:${stage}`,
    });
  } catch {
    // The original failure remains authoritative when persistence cannot record it.
  }
}

function reconstructHistoricalIntention(
  input: ProcessTurnInput,
  inputEventId: EntityId,
  event: Event,
  currentBelief: FormulationContext["currentBelief"],
): Intention {
  const intentionId = event.payload.intentionId;
  const kind = event.payload.kind;
  const motivation = event.payload.motivation;
  if (
    typeof intentionId !== "string" ||
    (kind !== "answer_question" && kind !== "acknowledge_correction" && kind !== "report_record_conflict") ||
    typeof motivation !== "string"
  ) {
    throw new DomainInvariantError(`Intention event ${event.id} cannot be reconstructed`);
  }
  return {
    id: intentionId,
    lenoseedId: input.lenoseedId,
    kind,
    target: input.humanActorRef,
    triggerEventIds: [inputEventId],
    triggerEvidenceItemIds: [],
    triggerBeliefIds: currentBelief === null ? [] : [currentBelief.id],
    triggerSelfHypothesisIds: [],
    triggerMemoryIds: [],
    motivation,
    observedStateVersion: event.observedStateVersion,
    status: "selected",
    createdAt: event.occurredAt,
  };
}

function readTextPayload(event: Event): string {
  const text = event.payload.text;
  if (typeof text !== "string") {
    throw new DomainInvariantError(`Event ${event.id} does not contain a text payload`);
  }
  return text;
}
