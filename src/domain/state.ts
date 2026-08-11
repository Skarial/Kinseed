import type { EntityId, StateVersion } from "./primitives.js";

export interface KinseedState {
  readonly kinseedId: EntityId;
  readonly stateVersion: StateVersion;
}
