// ============================================================================
// src/engine/state.js - (DEPRECATED) Re-export Bridge to Unified Reactive State Store
// ============================================================================
/**
 * @deprecated
 * State management and persistence have been consolidated into `src/state/store.js`.
 * Direct imports from `src/engine/state.js` are deprecated.
 * This file is maintained strictly as a backwards-compatibility re-export shim.
 */

export {
  state,
  store,
  StationStore,
  DEFAULT_STATE,
  STORAGE_KEY,
  isHostedMode,
  clearBlueprintInternalStorage,
  saveActiveBlueprintToStorage
} from '../state/store.js';
