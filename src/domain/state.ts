import type { EntityId, StateVersion } from "./primitives.js";

export interface LenoseedState {
  readonly lenoseedId: EntityId;
  readonly stateVersion: StateVersion;
}
