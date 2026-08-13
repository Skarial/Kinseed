import type { EntityId, StateVersion } from "./primitives.js";

export interface LenoSeedState {
  readonly lenoSeedId: EntityId;
  readonly stateVersion: StateVersion;
}
