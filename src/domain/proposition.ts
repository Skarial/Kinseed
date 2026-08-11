import type { EntityId, ScalarValue } from "./primitives.js";

export type PropositionContext = Readonly<Record<string, ScalarValue>>;

export interface Proposition {
  readonly subjectRef: EntityId;
  readonly predicate: string;
  readonly value: ScalarValue;
  readonly context: PropositionContext;
}

export function buildBeliefKey(proposition: Proposition): string {
  const orderedContext = Object.entries(proposition.context).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return JSON.stringify([
    proposition.subjectRef,
    proposition.predicate,
    orderedContext,
  ]);
}

export function propositionEquals(left: Proposition, right: Proposition): boolean {
  return (
    left.subjectRef === right.subjectRef &&
    left.predicate === right.predicate &&
    Object.is(left.value, right.value) &&
    JSON.stringify(Object.entries(left.context).sort()) ===
      JSON.stringify(Object.entries(right.context).sort())
  );
}
