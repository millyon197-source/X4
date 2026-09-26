import { mapMacroToWare, PRESET_BLUEPRINTS, WARES_DB } from '../data/wares.js';

// ============================================================================
// X4 Station Analyzer: Consolidated Reactive State Store & Persistence
// ============================================================================

export function isHostedMode() {
  try {
    if (typeof window !== 'undefined' && typeof window.__IS_HOSTED__ !== 'undefined') {
      return Boolean(window.__IS_HOSTED__);
    }
    return typeof __IS_HOSTED__ !== 'undefined' && Boolean(__IS_HOSTED__);
  } catch (e) {
    return false;
  }
}

export function clearBlueprintInternalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('x4_active_blueprint');
      localStorage.removeItem('x4_original_blueprint');
      localStorage.removeItem('x4_loaded_blueprints');
      localStorage.removeItem('x4_selected_sector');
      localStorage.removeItem('x4_workforce_bonus');
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('x4_previous_blueprint');
      sessionStorage.removeItem('x4_previous_preset');
      sessionStorage.removeItem('x4_last_focused_ware');
    }
  } catch (e) {
    console.error('Error clearing blueprint storage', e);
  }
  state.loadedBlueprints = [];
  state.activeBlueprint = null;
  state.originalBlueprint = null;
  state.previousBlueprint = null;
  state.previousPreset = null;
  state.selectedSector = null;
  state.workforceBonus = 0;
  state.selectedWareId = null;
  state.lastFocusedWareId = null;
  state.ppStates = {};
  state.calculatedDemand = {};
}

let savedBlueprint = null;
let savedOriginalBlueprint = null;
let savedLoadedBlueprints = [];
let savedPreset = 'all';

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const bpStr = localStorage.getItem('x4_active_blueprint');
    if (bpStr) {
      savedBlueprint = JSON.parse(bpStr);
    }
    const origStr = localStorage.getItem('x4_original_blueprint');
    if (origStr) {
      savedOriginalBlueprint = JSON.parse(origStr);
    }
    const loadedStr = localStorage.getItem('x4_loaded_blueprints');
    if (loadedStr) {
      savedLoadedBlueprints = JSON.parse(loadedStr);
    }
    const presetStr = localStorage.getItem('x4_current_preset');
    if (presetStr) {
      savedPreset = presetStr;
    }
  }
} catch (e) {
  console.error('Error loading initial state from localStorage', e);
}

if (isHostedMode()) {
  // In hosted mode, internal storage of multiple blueprints is not allowed.
  // At most one blueprint is stored at a time.
  if (Array.isArray(savedLoadedBlueprints) && savedLoadedBlueprints.length > 1) {
    savedLoadedBlueprints = savedBlueprint
      ? [savedBlueprint]
      : (savedLoadedBlueprints.length > 0 ? [savedLoadedBlueprints[0]] : []);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('x4_loaded_blueprints', JSON.stringify(savedLoadedBlueprints));
      }
    } catch (e) {}
  }
}

function rebuildModulesFromRawMacros(bp) {
  if (!bp) return;

  // If bp is Prod Max and missing rawMacros, restore from PRESET_BLUEPRINTS
  if (bp.name === 'Prod Max' && (!bp.rawMacros || Object.keys(bp.rawMacros).length === 0)) {
    if (PRESET_BLUEPRINTS && PRESET_BLUEPRINTS['prod_max']) {
      bp.rawMacros = { ...PRESET_BLUEPRINTS['prod_max'].rawMacros };
      bp.modules = { ...PRESET_BLUEPRINTS['prod_max'].modules };
      bp.totalModules = PRESET_BLUEPRINTS['prod_max'].totalModules;
      return;
    }
  }

  if (!bp.rawMacros || Object.keys(bp.rawMacros).length === 0) return;
  const newModules = {};
  let total = 0;
  Object.entries(bp.rawMacros).forEach(([macro, count]) => {
    total += count;
    const lowerMacro = macro.toLowerCase();
    const isRecycler = (lowerMacro.includes('scraprecycler') || lowerMacro.includes('scrap_recycler')) && !lowerMacro.includes('khaak');
    if (isRecycler) {
      if (lowerMacro.includes('ter')) {
        newModules['TerCompSubstrate'] = (newModules['TerCompSubstrate'] || 0) + count;
        newModules['TerSilCarbide'] = (newModules['TerSilCarbide'] || 0) + count;
        newModules['TerScrapMetal'] = (newModules['TerScrapMetal'] || 0) + count;
      } else {
        newModules['ScrapHullParts'] = (newModules['ScrapHullParts'] || 0) + count;
        newModules['ScrapClaytronics'] = (newModules['ScrapClaytronics'] || 0) + count;
        newModules['ScrapMetal'] = (newModules['ScrapMetal'] || 0) + count;
      }
      return;
    }
    const wareId = mapMacroToWare(macro);
    if (wareId) {
      newModules[wareId] = (newModules[wareId] || 0) + count;
    }
  });
  bp.totalModules = total;
  bp.modules = newModules;

  if (!bp.ppStates) bp.ppStates = {};
  delete bp.ppStates['ScrapHullParts'];
  delete bp.ppStates['ScrapClaytronics'];
  delete bp.ppStates['TerCompSubstrate'];
  delete bp.ppStates['TerSilCarbide'];

  // Rule: If any inputs to Hull Parts has 0 module count, then check PP for Hull Part
  const hullWare = WARES_DB['HullParts'];
  if (hullWare && hullWare.recipe) {
    const anyInputZero = Object.keys(hullWare.recipe).some(inpId => {
      if (inpId === 'EC' || inpId === 'TerEC') {
        return ((bp.modules['EC'] || 0) + (bp.modules['TerEC'] || 0)) === 0;
      }
      return (bp.modules[inpId] || 0) === 0;
    });

    if (anyInputZero) {
      if (!bp._manualHullPartsPP) {
        bp.ppStates['HullParts'] = true;
        bp._autoHullPartsPP = true;
      }
    } else if (bp._autoHullPartsPP) {
      delete bp.ppStates['HullParts'];
      delete bp._autoHullPartsPP;
      delete bp._manualHullPartsPP;
    }
  }

  const telWare = WARES_DB['TelParts'];
  if (telWare && telWare.recipe && bp.modules['TelParts'] !== undefined) {
    const anyTelInputZero = Object.keys(telWare.recipe).some(inpId => {
      if (inpId === 'EC' || inpId === 'TerEC') {
        return ((bp.modules['EC'] || 0) + (bp.modules['TerEC'] || 0)) === 0;
      }
      return (bp.modules[inpId] || 0) === 0;
    });

    if (anyTelInputZero) {
      if (!bp._manualTelPartsPP) {
        bp.ppStates['TelParts'] = true;
        bp._autoTelPartsPP = true;
      }
    } else if (bp._autoTelPartsPP) {
      delete bp.ppStates['TelParts'];
      delete bp._autoTelPartsPP;
      delete bp._manualTelPartsPP;
    }
  }

  // Rule: If any inputs to Claytronics has 0 module count, then check PP for Claytronics
  const clayWare = WARES_DB['Claytronics'];
  if (clayWare && clayWare.recipe) {
    const anyClayInputZero = Object.keys(clayWare.recipe).some(inpId => {
      if (inpId === 'EC' || inpId === 'TerEC') {
        return ((bp.modules['EC'] || 0) + (bp.modules['TerEC'] || 0)) === 0;
      }
      return (bp.modules[inpId] || 0) === 0;
    });

    if (anyClayInputZero) {
      if (!bp._manualClaytronicsPP) {
        bp.ppStates['Claytronics'] = true;
        bp._autoClaytronicsPP = true;
      }
    } else if (bp._autoClaytronicsPP) {
      delete bp.ppStates['Claytronics'];
      delete bp._autoClaytronicsPP;
      delete bp._manualClaytronicsPP;
    }
  }
}

let savedSector = null;
let savedWorkforceBonus = 0;
let savedPlannedScroll = 0;
let savedActiveTab = 'matrix';

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const secStr = localStorage.getItem('x4_selected_sector');
    if (secStr) {
      savedSector = secStr;
    }
    const wfStr = localStorage.getItem('x4_workforce_bonus');
    if (wfStr !== null && wfStr !== undefined) {
      const parsedWf = parseInt(wfStr, 10);
      if (!isNaN(parsedWf) && parsedWf >= 0 && parsedWf <= 100) {
        savedWorkforceBonus = parsedWf;
      }
    }
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const scrollStr = sessionStorage.getItem('x4_planned_scroll');
    if (scrollStr) {
      savedPlannedScroll = parseInt(scrollStr, 10) || 0;
    }
    const tabStr = sessionStorage.getItem('x4_active_tab');
    if (tabStr === 'matrix' || tabStr === 'planned') {
      savedActiveTab = tabStr;
    }
  }
} catch (e) {}

let savedPreviousBlueprint = null;
let savedPreviousPreset = null;
let savedLastFocusedWare = null;
let savedBpLevelCollapsed = { 1: true, 2: true, 3: true };
try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const prevBpStr = sessionStorage.getItem('x4_previous_blueprint');
    if (prevBpStr) savedPreviousBlueprint = JSON.parse(prevBpStr);
    const prevPrStr = sessionStorage.getItem('x4_previous_preset');
    if (prevPrStr) savedPreviousPreset = prevPrStr;
    const lastFocStr = sessionStorage.getItem('x4_last_focused_ware');
    if (lastFocStr) savedLastFocusedWare = lastFocStr;
    const collapsedStr = sessionStorage.getItem('x4_bp_level_collapsed');
    if (collapsedStr) savedBpLevelCollapsed = JSON.parse(collapsedStr);
  }
} catch (e) {}

if (savedPreset === 'all' && savedBlueprint && !savedPreviousBlueprint) {
  savedPreviousBlueprint = savedBlueprint;
  savedBlueprint = null;
}

export const state = {
  activeTab: savedActiveTab, // 'matrix' or 'planned'
  activeBlueprint: savedBlueprint,
  originalBlueprint: savedOriginalBlueprint,
  loadedBlueprints: savedLoadedBlueprints,
  previousBlueprint: savedPreviousBlueprint,
  previousPreset: savedPreviousPreset,
  selectedWareId: null,
  lastFocusedWareId: savedLastFocusedWare,
  selectedSector: savedSector,
  currentPreset: savedPreset,
  searchQuery: '',
  workforceBonus: savedWorkforceBonus,
  subdueZeroX: false,
  subdueEcCalc: savedBlueprint ? true : false,
  subdueLevel4: savedBlueprint ? true : false,
  inspectorSingle: false,
  macroSortAsc: true,
  factionConstructionMethod: 'commonwealth',
  hideFoodAgriPlanned: false,
  filterWaresPlanned: false,
  filterStructuresPlanned: false,
  populateMatrix: false,
  bpSortField: 'level',
  bpSortAsc: true,
  bpLevelCollapsed: savedBpLevelCollapsed || { 1: true, 2: true, 3: true },
  plannedScroll: savedPlannedScroll,
  ppStates: {},
  calculatedDemand: {},
  layerTotals: {
    L1: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L2: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L3: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    totalECNeeded: 0,
    solarModulesNeeded: 0
  }
};

export function saveActiveBlueprintToStorage() {
  const hosted = isHostedMode();
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    const bpToSave = state.activeBlueprint || state.previousBlueprint;
    if (bpToSave) {
      if (state.activeBlueprint) {
        state.activeBlueprint.workforceBonus = (typeof state.workforceBonus === 'number') ? state.workforceBonus : 0;
      }
      localStorage.setItem('x4_active_blueprint', JSON.stringify(bpToSave));
      localStorage.setItem('x4_current_preset', state.currentPreset);
      const origToSave = state.originalBlueprint || (state.previousBlueprint ? { name: state.previousBlueprint.name, rawMacros: state.previousBlueprint.rawMacros } : null);
      if (origToSave) {
        localStorage.setItem('x4_original_blueprint', JSON.stringify(origToSave));
      }
    } else {
      localStorage.removeItem('x4_active_blueprint');
      localStorage.removeItem('x4_original_blueprint');
      localStorage.setItem('x4_current_preset', state.currentPreset);
    }

    const sectorToSave = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || (state.previousBlueprint && state.previousBlueprint.sector) || null;
    if (sectorToSave) {
      localStorage.setItem('x4_selected_sector', sectorToSave);
    } else if (!state.previousBlueprint) {
      localStorage.removeItem('x4_selected_sector');
    }

    const wfToSave = (typeof state.workforceBonus === 'number' && state.workforceBonus > 0)
      ? state.workforceBonus
      : (state.previousBlueprint && typeof state.previousBlueprint.workforceBonus === 'number' ? state.previousBlueprint.workforceBonus : 0);
    if (wfToSave > 0) {
      localStorage.setItem('x4_workforce_bonus', String(wfToSave));
    } else if (!state.previousBlueprint) {
      localStorage.removeItem('x4_workforce_bonus');
    }

    if (hosted) {
      // In hosted mode, internal storage of multiple blueprints is not allowed.
      // Just one blueprint is active at a time.
      const singleBp = state.activeBlueprint || state.previousBlueprint;
      if (singleBp) {
        state.loadedBlueprints = [{
          name: singleBp.name,
          totalModules: singleBp.totalModules,
          modules: { ...(singleBp.modules || {}) },
          rawMacros: { ...(singleBp.rawMacros || {}) },
          rootMacros: { ...(singleBp.rootMacros || {}) },
          sector: singleBp.sector || sectorToSave || null,
          workforceBonus: (typeof singleBp.workforceBonus === 'number') ? singleBp.workforceBonus : wfToSave,
          ppStates: { ...(singleBp.ppStates || {}) }
        }];
        localStorage.setItem('x4_loaded_blueprints', JSON.stringify(state.loadedBlueprints));
      } else {
        state.loadedBlueprints = [];
        localStorage.removeItem('x4_loaded_blueprints');
      }

      if (window.sessionStorage) {
        if (state.previousBlueprint) {
          sessionStorage.setItem('x4_previous_blueprint', JSON.stringify(state.previousBlueprint));
          if (state.previousPreset) {
            sessionStorage.setItem('x4_previous_preset', state.previousPreset);
          } else {
            sessionStorage.removeItem('x4_previous_preset');
          }
        } else {
          sessionStorage.removeItem('x4_previous_blueprint');
          sessionStorage.removeItem('x4_previous_preset');
        }
      }
    } else {
      if (state.loadedBlueprints && state.loadedBlueprints.length > 0) {
        if (state.activeBlueprint) {
          const currentLb = state.loadedBlueprints.find(b => b && b.name === state.activeBlueprint.name);
          if (currentLb) {
            currentLb.sector = state.activeBlueprint.sector || state.selectedSector || null;
            currentLb.workforceBonus = (typeof state.workforceBonus === 'number') ? state.workforceBonus : 0;
            currentLb.ppStates = { ...(state.activeBlueprint.ppStates || {}) };
            currentLb.rawMacros = { ...(state.activeBlueprint.rawMacros || {}) };
            currentLb.rootMacros = { ...(state.activeBlueprint.rootMacros || {}) };
            currentLb.modules = { ...(state.activeBlueprint.modules || {}) };
            currentLb.totalModules = state.activeBlueprint.totalModules;
          }
        }
        localStorage.setItem('x4_loaded_blueprints', JSON.stringify(state.loadedBlueprints));
      } else {
        localStorage.removeItem('x4_loaded_blueprints');
      }
      if (window.sessionStorage) {
        if (state.previousBlueprint) {
          sessionStorage.setItem('x4_previous_blueprint', JSON.stringify(state.previousBlueprint));
          if (state.previousPreset) {
            sessionStorage.setItem('x4_previous_preset', state.previousPreset);
          } else {
            sessionStorage.removeItem('x4_previous_preset');
          }
        } else {
          sessionStorage.removeItem('x4_previous_blueprint');
          sessionStorage.removeItem('x4_previous_preset');
        }
      }
    }
    if (window.sessionStorage) {
      if (state.lastFocusedWareId) {
        sessionStorage.setItem('x4_last_focused_ware', state.lastFocusedWareId);
      } else {
        sessionStorage.removeItem('x4_last_focused_ware');
      }
    }
  } catch (e) {
    console.error('Error saving state to localStorage', e);
  }
}

// Reactive StationStore with pub/sub listener pattern
export class StationStore {
  constructor(initialState = state) {
    this.state = initialState;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, payload = null) {
    this.listeners.forEach(fn => {
      try {
        fn(this.state, event, payload);
      } catch (err) {
        console.error('Error in StationStore listener:', err);
      }
    });
  }

  save() {
    saveActiveBlueprintToStorage();
    this.notify('STORAGE_SAVED');
  }

  clear() {
    clearBlueprintInternalStorage();
    this.notify('STORAGE_CLEARED');
  }
}

export const store = new StationStore(state);
