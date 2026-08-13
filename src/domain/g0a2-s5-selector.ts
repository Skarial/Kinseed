import { DomainInvariantError } from "./errors.js";
import type { Event } from "./event.js";
import type { IntentionKind } from "./intention.js";
import type { SelfHypothesis } from "./self-hypothesis.js";

const ASK_CLARIFICATION: IntentionKind = "ask_clarification";
const USE_AVAILABLE_INFORMATION: IntentionKind =
  "respond_with_available_information_under_uncertainty";

export interface G0A2DecisionContext {
  readonly situationEvent: Event;
  readonly activeSelfHypotheses: readonly SelfHypothesis[];
}

export interface G0A2S5Selection {
  readonly eligibleKinds: readonly [IntentionKind, IntentionKind];
  readonly favoredKind: IntentionKind | null;
  readonly selectedKind: IntentionKind;
  readonly triggerSelfHypothesisIds: readonly string[];
  readonly neutralTieBreakApplied: boolean;
}

export function selectG0A2S5Intention(context: G0A2DecisionContext): G0A2S5Selection {
  validateS5SituationEvent(context.situationEvent);
  const eligible = context.activeSelfHypotheses.filter((hypothesis) => {
    if (hypothesis.lenoseedId !== context.situationEvent.lenoseedId) {
      throw new DomainInvariantError(
        `G0-A2 S5 selector received SelfHypothesis ${hypothesis.id} for another Lenoseed`,
      );
    }
    return (
      hypothesis.status === "active" &&
      hypothesis.proposition.subjectRef === context.situationEvent.lenoseedId &&
      hypothesis.proposition.predicate === "decision_style_under_uncertainty" &&
      hypothesis.proposition.context.protocol === "G0-A2"
    );
  });
  if (eligible.length > 1) {
    throw new DomainInvariantError("G0-A2 S5 selector received multiple active eligible SelfHypotheses");
  }

  const hypothesis = eligible[0];
  if (hypothesis === undefined) {
    return neutralSelection();
  }
  if (hypothesis.proposition.value === "seek_clarification") {
    return influencedSelection(hypothesis.id, ASK_CLARIFICATION);
  }
  if (hypothesis.proposition.value === "use_available_information") {
    return influencedSelection(hypothesis.id, USE_AVAILABLE_INFORMATION);
  }
  throw new DomainInvariantError(`G0-A2 S5 SelfHypothesis ${hypothesis.id} has invalid value`);
}

export function validateS5SituationEvent(event: Event): void {
  if (
    event.type !== "human_message_received" ||
    event.payloadSchemaVersion !== 2 ||
    event.turnId === null ||
    typeof event.payload.text !== "string" ||
    event.payload.protocol !== "G0-A2" ||
    event.payload.situationId !== "S5" ||
    event.payload.decisionAxis !== "decision_style_under_uncertainty"
  ) {
    throw new DomainInvariantError(`Event ${event.id} is not a valid G0-A2 S5 situation`);
  }
}

function neutralSelection(): G0A2S5Selection {
  return {
    eligibleKinds: [ASK_CLARIFICATION, USE_AVAILABLE_INFORMATION],
    favoredKind: null,
    selectedKind: USE_AVAILABLE_INFORMATION,
    triggerSelfHypothesisIds: [],
    neutralTieBreakApplied: true,
  };
}

function influencedSelection(
  hypothesisId: string,
  selectedKind: IntentionKind,
): G0A2S5Selection {
  return {
    eligibleKinds: [ASK_CLARIFICATION, USE_AVAILABLE_INFORMATION],
    favoredKind: selectedKind,
    selectedKind,
    triggerSelfHypothesisIds: [hypothesisId],
    neutralTieBreakApplied: false,
  };
}
