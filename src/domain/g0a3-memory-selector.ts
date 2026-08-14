import { DomainInvariantError } from "./errors.js";
import type { Event } from "./event.js";
import type { Memory } from "./memory.js";
import type { EntityId } from "./primitives.js";

export const G0A3_FUTURE_SITUATION_ID = "S-G0A3-CALIBRATION-02";
export const G0A3_RELEVANT_EPISODE_KEY = "EP-G0A3-CALIBRATION-01";
export const G0A3_FUTURE_SITUATION_TEXT =
  "Une nouvelle calibration du même modèle de capteur doit être lancée.\n" +
  "Les configurations A et B sont disponibles.\n" +
  "Le câble C peut être vérifié avant le lancement.";

export interface G0A3MemoryDecisionSnapshot {
  readonly memory: Memory;
  readonly selectedConfiguration: "A";
  readonly reportedOutcome: "failure";
  readonly currentFailureAttribution:
    | "configuration_a_sensor_incompatibility"
    | "cable_c_disconnected";
  readonly configurationACompatibility: "unknown" | "compatible";
}

export interface G0A3MemoryDecisionContext {
  readonly situationEvent: Event;
  readonly memorySnapshot: G0A3MemoryDecisionSnapshot | null;
}

export interface G0A3MemorySelection {
  readonly selectedKind:
    | "use_configuration_a_after_checking_cable_c"
    | "use_configuration_b"
    | "request_new_diagnostic";
  readonly motivation:
    | "apply_active_g0a3_memory_avoid_reported_incompatibility"
    | "apply_active_g0a3_memory_check_corrected_cable_cause"
    | "apply_neutral_g0a3_policy_without_memory";
  readonly triggerMemoryIds: readonly EntityId[];
}

export function validateG0A3FutureSituationEvent(event: Event): void {
  const expectedPayload = {
    text: G0A3_FUTURE_SITUATION_TEXT,
    protocol: "G0-A3",
    situationId: G0A3_FUTURE_SITUATION_ID,
    relevantEpisodeKey: G0A3_RELEVANT_EPISODE_KEY,
    availableConfigurations: ["A", "B"],
    cableCanBeChecked: true,
  };
  if (
    event.type !== "human_message_received" ||
    event.payloadSchemaVersion !== 3 ||
    event.turnId === null ||
    !hasExactOwnKeys(event.payload, Object.keys(expectedPayload)) ||
    !jsonEquals(event.payload, expectedPayload)
  ) {
    throw new DomainInvariantError(`Event ${event.id} is not a valid G0-A3 future situation`);
  }
}

function hasExactOwnKeys(value: unknown, expectedKeys: readonly string[]): boolean {
  if (typeof value !== "object" || value === null) return false;
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === expectedKeys.length &&
    ownKeys.every(
      (key) =>
        typeof key === "string" &&
        expectedKeys.includes(key) &&
        Object.prototype.hasOwnProperty.call(value, key),
    )
  );
}

export function selectG0A3MemoryDecision(
  context: G0A3MemoryDecisionContext,
): G0A3MemorySelection {
  validateG0A3FutureSituationEvent(context.situationEvent);
  if (context.memorySnapshot === null) {
    return {
      selectedKind: "request_new_diagnostic",
      motivation: "apply_neutral_g0a3_policy_without_memory",
      triggerMemoryIds: [],
    };
  }

  const snapshot = context.memorySnapshot;
  if (
    snapshot.memory.lenoseedId !== context.situationEvent.lenoseedId ||
    snapshot.memory.status !== "active" ||
    snapshot.selectedConfiguration !== "A" ||
    snapshot.reportedOutcome !== "failure"
  ) {
    throw new DomainInvariantError("G0-A3 Memory decision snapshot is incoherent");
  }
  if (
    snapshot.memory.version === 1 &&
    snapshot.currentFailureAttribution === "configuration_a_sensor_incompatibility" &&
    snapshot.configurationACompatibility === "unknown"
  ) {
    return {
      selectedKind: "use_configuration_b",
      motivation: "apply_active_g0a3_memory_avoid_reported_incompatibility",
      triggerMemoryIds: [snapshot.memory.id],
    };
  }
  if (
    snapshot.memory.version === 2 &&
    snapshot.currentFailureAttribution === "cable_c_disconnected" &&
    snapshot.configurationACompatibility === "compatible"
  ) {
    return {
      selectedKind: "use_configuration_a_after_checking_cable_c",
      motivation: "apply_active_g0a3_memory_check_corrected_cable_cause",
      triggerMemoryIds: [snapshot.memory.id],
    };
  }
  throw new DomainInvariantError("G0-A3 Memory decision snapshot has no defined policy");
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}
