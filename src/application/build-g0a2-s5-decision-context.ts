import { DomainInvariantError } from "../domain/errors.js";
import type { Event } from "../domain/event.js";
import {
  validateS5SituationEvent,
  type G0A2DecisionContext,
} from "../domain/g0a2-s5-selector.js";
import type { EntityId } from "../domain/primitives.js";
import { buildSelfHypothesisKey } from "../domain/self-hypothesis.js";
import type { PersistencePort } from "../ports/persistence.js";

const DECISION_STYLE_UNDER_UNCERTAINTY = "decision_style_under_uncertainty";

export interface BuildG0A2S5DecisionContextInput {
  readonly kinseedId: EntityId;
  readonly situationEvent: Event;
  readonly includeSelfHypotheses: boolean;
}

export async function buildG0A2S5DecisionContext(
  input: BuildG0A2S5DecisionContextInput,
  persistence: PersistencePort,
): Promise<G0A2DecisionContext> {
  validateS5SituationEvent(input.situationEvent);
  if (input.situationEvent.kinseedId !== input.kinseedId) {
    throw new DomainInvariantError(
      `G0-A2 S5 situation ${input.situationEvent.id} belongs to another Kinseed`,
    );
  }
  const stateVersion = await persistence.getStateVersion(input.kinseedId);
  if (stateVersion !== input.situationEvent.observedStateVersion) {
    throw new DomainInvariantError(
      `G0-A2 S5 situation ${input.situationEvent.id} has an ambiguous durable snapshot`,
    );
  }
  if (!input.includeSelfHypotheses) {
    return {
      situationEvent: input.situationEvent,
      activeSelfHypotheses: [],
    };
  }
  const active = await persistence.readActiveSelfHypothesisByKey(
    input.kinseedId,
    buildSelfHypothesisKey({
      subjectRef: input.kinseedId,
      predicate: DECISION_STYLE_UNDER_UNCERTAINTY,
      value: "seek_clarification",
      context: { protocol: "G0-A2" },
    }),
  );
  return {
    situationEvent: input.situationEvent,
    activeSelfHypotheses: active === null ? [] : [active],
  };
}
