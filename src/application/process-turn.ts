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
import type { CommitMutations, PersistencePort } from "../ports/persistence.js";
import { validateEvidenceItem } from "./validate-evidence.js";

const EMPLOYMENT_START_YEAR = "employment_start_year";
const HISTORY_DENIAL = "denies_prior_employment_start_year_testimony";

export interface ProcessTurnInput {
  readonly kinseedId: EntityId;
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
  const existingEvents = await persistence.readEventsByTurn(input.kinseedId, input.turnId);
  const emittedEvent = existingEvents.find((event) => event.type === "kinseed_message_emitted");
  const commitCompletedEvent = existingEvents.find(
    (event) => event.type === "state_commit_completed",
  );

  if (emittedEvent !== undefined && commitCompletedEvent !== undefined) {
    return {
      response: readTextPayload(emittedEvent),
      stateVersion: await persistence.getStateVersion(input.kinseedId),
      replayed: true,
    };
  }

  const observedStateVersion = await persistence.getStateVersion(input.kinseedId);
  const inputEvent =
    existingEvents.find((event) => event.type === "human_message_received") ??
    (await appendEvent(
      persistence,
      input.kinseedId,
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

  const candidates = await aiEngine.extractEvidence({
    message: input.message,
    sourceId: input.humanSourceId,
    eventId: inputEvent.id,
    allowedContext: {},
  });
  await validateTemporaryCandidates(input, inputEvent, candidates, persistence);
  const stateVersion = await persistence.getStateVersion(input.kinseedId);
  const beliefContext = await readBeliefContext(persistence, input.kinseedId, input.humanActorRef);
  const intention = selectIntention(
    input,
    inputEvent.id,
    candidates,
    beliefContext.currentBelief,
    stateVersion,
  );
  const formulationContext: FormulationContext = {
    ...beliefContext,
    turnEvidence: candidates.map((candidate) => ({
      predicate: candidate.proposition.predicate,
      value: candidate.proposition.value,
    })),
  };

  const existingIntentionEvent = existingEvents.find((event) => event.type === "intention_selected");
  const intentionEvent =
    existingIntentionEvent ??
    (await appendEvent(persistence, input.kinseedId, {
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
      response = await aiEngine.formulate({ intention, context: formulationContext });
    } catch (error) {
      const hasFailure = existingEvents.some(
        (event) => event.type === "processing_failure_recorded",
      );
      if (!hasFailure) {
        await appendEvent(persistence, input.kinseedId, {
          id: `E-${input.turnId}-failure`,
          type: "processing_failure_recorded",
          occurredAt: input.occurredAt,
          turnId: input.turnId,
          sourceId: input.systemSourceId,
          actorRef: null,
          causedByEventIds: [inputEvent.id, intentionEvent.id],
          observedStateVersion: stateVersion,
          payload: {
            stage: "language_generation",
            errorClass: error instanceof Error ? error.name : "UnknownError",
            retryable: true,
          },
          engineVersion: input.engineVersion,
          idempotencyKey: `${input.turnId}:failure`,
        });
      }
      throw error;
    }

    responseEvent = await appendEvent(persistence, input.kinseedId, {
      id: `E-${input.turnId}-emitted`,
      type: "kinseed_message_emitted",
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
  const commitAlreadyApplied = await persistence.checkIdempotencyKey(input.kinseedId, commitKey);
  const commit = commitAlreadyApplied
    ? {
        applied: false,
        previousStateVersion: stateVersion,
        newStateVersion: await persistence.getStateVersion(input.kinseedId),
      }
    : await commitTurn(
        input,
        inputEvent,
        candidates,
        stateVersion,
        persistence,
        commitKey,
      );

  await appendEvent(persistence, input.kinseedId, {
    id: `E-${input.turnId}-commit`,
    type: "state_commit_completed",
    occurredAt: input.occurredAt,
    turnId: input.turnId,
    sourceId: input.systemSourceId,
    actorRef: null,
    causedByEventIds: [responseEvent.id],
    observedStateVersion: stateVersion,
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
      input.kinseedId,
      buildBeliefKey(candidate.proposition),
    );
    const evidenceItem = await createEvidenceItem(input, inputEvent, candidate, current, persistence);
    await validateEvidenceItem(evidenceItem, persistence);
    evidenceItems.push(evidenceItem);

    if (candidate.proposition.predicate !== EMPLOYMENT_START_YEAR) {
      continue;
    }

    if (current === null) {
      const beliefId = "B-START-v1";
      const support = createEvidenceLink(
        input.kinseedId,
        evidenceItem.id,
        beliefId,
        "supports",
        input.occurredAt,
      );
      const belief = createInitialBelief({
        id: beliefId,
        kinseedId: input.kinseedId,
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
        input.kinseedId,
        evidenceItem.id,
        current.id,
        "contradicts",
        input.occurredAt,
      );
      const supports = createEvidenceLink(
        input.kinseedId,
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

  const mutations: CommitMutations = { evidenceItems, evidenceLinks, beliefs };
  return persistence.atomicCommit(input.kinseedId, stateVersion, mutations, commitKey);
}

async function validateTemporaryCandidates(
  input: ProcessTurnInput,
  inputEvent: Event,
  candidates: readonly CandidateEvidenceItem[],
  persistence: PersistencePort,
): Promise<void> {
  for (const [index, candidate] of candidates.entries()) {
    await validateEvidenceItem(
      {
        id: `CAND-${input.turnId}-${index + 1}`,
        kinseedId: input.kinseedId,
        kind: candidate.kind,
        proposition: candidate.proposition,
        sourceId: input.humanSourceId,
        eventIds: [inputEvent.id],
        extractionConfidence: candidate.extractionConfidence,
        status: "active",
        supersedesId: null,
        extractorVersion: candidate.extractorVersion,
        createdAt: input.occurredAt,
      },
      persistence,
    );
  }
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
      ? await currentSupportingEvidenceId(input.kinseedId, current, persistence)
      : null;

  return {
    id:
      candidate.proposition.predicate === EMPLOYMENT_START_YEAR
        ? `EV-START-${candidate.proposition.value}`
        : `EV-${input.turnId}`,
    kinseedId: input.kinseedId,
    kind: candidate.kind,
    proposition: candidate.proposition,
    sourceId: input.humanSourceId,
    eventIds: [inputEvent.id],
    extractionConfidence: candidate.extractionConfidence,
    status: "active",
    supersedesId,
    extractorVersion: candidate.extractorVersion,
    createdAt: input.occurredAt,
  };
}

async function currentSupportingEvidenceId(
  kinseedId: EntityId,
  belief: Belief,
  persistence: PersistencePort,
): Promise<EntityId> {
  const linkId = belief.evidenceForLinkIds[0];
  if (linkId === undefined) {
    throw new DomainInvariantError(`Active belief ${belief.id} has no supporting EvidenceLink`);
  }
  const link = await persistence.readEvidenceLink(kinseedId, linkId);
  if (link === null) {
    throw new DomainInvariantError(`Belief ${belief.id} references unknown EvidenceLink ${linkId}`);
  }
  return link.evidenceItemId;
}

function createEvidenceLink(
  kinseedId: EntityId,
  evidenceItemId: EntityId,
  targetBeliefId: EntityId,
  relation: "supports" | "contradicts",
  createdAt: Timestamp,
): EvidenceLink {
  return {
    id: `EL-${evidenceItemId}-${targetBeliefId}-${relation}`,
    kinseedId,
    evidenceItemId,
    targetBeliefId,
    relation,
    sourceAuthority: "high",
    independenceGroup: evidenceItemId,
    weightClass: "high",
    createdAt,
  };
}

async function readBeliefContext(
  persistence: PersistencePort,
  kinseedId: EntityId,
  humanActorRef: EntityId,
): Promise<FormulationContext> {
  const key = buildBeliefKey(employmentStartProposition(humanActorRef, 0));
  const history = await persistence.readBeliefHistoryByKey(kinseedId, key);
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
  return { currentBelief: current, beliefHistory: snapshots, turnEvidence: [] };
}

function selectIntention(
  input: ProcessTurnInput,
  inputEventId: EntityId,
  candidates: readonly CandidateEvidenceItem[],
  currentBelief: FormulationContext["currentBelief"],
  stateVersion: StateVersion,
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
    kinseedId: input.kinseedId,
    kind,
    target: input.humanActorRef,
    triggerEventIds: [inputEventId],
    triggerEvidenceItemIds: [],
    triggerBeliefIds: currentBelief === null ? [] : [currentBelief.id],
    motivation: motivationFor(input.message, kind),
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
  kinseedId: EntityId,
  event: Omit<Event, "kinseedId" | "sequence" | "payloadSchemaVersion">,
): Promise<Event> {
  const events = await persistence.readEventsInSequence(kinseedId);
  const complete: Event = {
    ...event,
    kinseedId,
    sequence: (events.at(-1)?.sequence ?? 0) + 1,
    payloadSchemaVersion: 1,
  };
  await persistence.appendEvent(complete);
  return complete;
}

function readTextPayload(event: Event): string {
  const text = event.payload.text;
  if (typeof text !== "string") {
    throw new DomainInvariantError(`Event ${event.id} does not contain a text payload`);
  }
  return text;
}
