// ============================================================================
// src/engine/state.js - Re-export Bridge to Unified Reactive State Store
// ============================================================================
// State management has been consolidated into `src/state/store.js`.
// This module provides full backward-compatibility for existing imports.

export {
  state,
  store,
  StationStore,
  isHostedMode,
  clearBlueprintInternalStorage,
  saveActiveBlueprintToStorage
} from '../state/store.js';
