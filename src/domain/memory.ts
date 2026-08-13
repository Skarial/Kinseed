import { DomainInvariantError } from "./errors.js";
import type { EntityId, Timestamp } from "./primitives.js";

export type MemorySalience = "low" | "medium" | "high";
export type MemoryConfidence = "low" | "moderate" | "moderate_high" | "high";
export type MemoryStatus = "active" | "revised";

export interface Memory {
  readonly id: EntityId;
  readonly lenoseedId: EntityId;
  readonly memoryKey: string;
  readonly episodeKey: string;
  readonly version: number;
  readonly eventIds: readonly EntityId[];
  readonly evidenceItemIds: readonly EntityId[];
  readonly gist: string;
  readonly createdAt: Timestamp;
  readonly salience: MemorySalience;
  readonly confidence: MemoryConfidence;
  readonly status: MemoryStatus;
  readonly revisionOf: EntityId | null;
  readonly lastRecalledAt: Timestamp | null;
}

export function buildG0A3MemoryKey(lenoseedId: EntityId, episodeKey: string): string {
  assertG0A3MemoryIdentityInputs(lenoseedId, episodeKey);
  return `g0a3:${lenoseedId}:${episodeKey}`;
}

export function buildG0A3MemoryId(
  lenoseedId: EntityId,
  episodeKey: string,
  version: number,
): EntityId {
  assertG0A3MemoryIdentityInputs(lenoseedId, episodeKey);
  if (!Number.isInteger(version) || version < 1) {
    throw new DomainInvariantError("G0-A3 Memory version must be an integer greater than or equal to 1");
  }
  return `MEM-G0A3-${lenoseedId}-${episodeKey}-v${version}`;
}

function assertG0A3MemoryIdentityInputs(lenoseedId: EntityId, episodeKey: string): void {
  if (lenoseedId.length === 0) {
    throw new DomainInvariantError("G0-A3 Memory lenoseedId must not be empty");
  }
  if (episodeKey.length === 0) {
    throw new DomainInvariantError("G0-A3 Memory episodeKey must not be empty");
  }
  if (episodeKey.includes(":")) {
    throw new DomainInvariantError("G0-A3 Memory episodeKey must not contain ':'");
  }
}
