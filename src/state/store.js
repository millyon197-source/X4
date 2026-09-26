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
let savedPriceType = 'avg';
let savedShowConstructionBudget = true;
let savedWfCollapsed = false;
let savedNcCollapsed = false;

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
    const priceStr = localStorage.getItem('x4_price_type');
    if (priceStr && ['min', 'avg', 'max'].includes(priceStr)) {
      savedPriceType = priceStr;
    }
    const budgetStr = localStorage.getItem('x4_show_construction_budget');
    if (budgetStr !== null) {
      savedShowConstructionBudget = budgetStr === 'true';
    }
    const wfColStr = localStorage.getItem('x4_wf_summary_collapsed');
    if (wfColStr !== null) {
      savedWfCollapsed = wfColStr === 'true';
    }
    const ncColStr = localStorage.getItem('x4_nc_modules_collapsed');
    if (ncColStr !== null) {
      savedNcCollapsed = ncColStr === 'true';
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

export const DEFAULT_STATE = {
  modules: {},           // { [macroName]: count }
  workforceCount: 0,     // Total active workers
  sunlightPct: 100,      // Sector sunlight percentage (e.g. 100%, 150%)
  constructionMethod: 'commonwealth', // 'commonwealth' | 'terran' | 'boron'
  activeTab: 'matrix',   // 'matrix' | 'planned'
  priceType: 'avg',      // 'min' | 'avg' | 'max'
  showConstructionBudget: true,
  workforceSummaryCollapsed: false,
  nonContributingCollapsed: false,
};

export const state = {
  modules: {},
  workforceCount: 0,
  sunlightPct: 100,
  constructionMethod: 'commonwealth',
  priceType: savedPriceType || 'avg',
  showConstructionBudget: savedShowConstructionBudget !== undefined ? savedShowConstructionBudget : true,
  workforceSummaryCollapsed: savedWfCollapsed !== undefined ? savedWfCollapsed : false,
  nonContributingCollapsed: savedNcCollapsed !== undefined ? savedNcCollapsed : false,
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

export const STORAGE_KEY = 'x4_station_planner_state_v1';

// Reactive StationStore with EventTarget and pub/sub listener pattern
export class StationStore extends EventTarget {
  constructor(initialState = state) {
    super();
    this.state = initialState;
    this.listeners = new Set();
  }

  /**
   * Returns a copy of the current state.
   */
  getState() {
    return this.state;
  }

  /**
   * Updates state slice and notifies all subscribers.
   */
  setState(updater) {
    const nextSlice = typeof updater === 'function' ? updater(this.state) : updater;
    Object.assign(this.state, nextSlice);
    this._saveState();
    this._notify();
  }

  /* --- Module Operations --- */

  setModuleCount(macro, count) {
    const validCount = Math.max(0, parseInt(count, 10) || 0);
    if (!this.state.modules) this.state.modules = {};
    if (validCount > 0) {
      this.state.modules[macro] = validCount;
    } else {
      delete this.state.modules[macro];
    }

    if (this.state.activeBlueprint) {
      if (!this.state.activeBlueprint.rawMacros) this.state.activeBlueprint.rawMacros = {};
      if (validCount > 0) {
        this.state.activeBlueprint.rawMacros[macro] = validCount;
      } else {
        delete this.state.activeBlueprint.rawMacros[macro];
      }
      this.state.activeBlueprint.totalModules = Object.values(this.state.activeBlueprint.rawMacros).reduce((s, n) => s + n, 0);
    }

    this._saveState();
    this._notify();
  }

  addModule(macro, delta = 1) {
    const current = (this.state.modules && this.state.modules[macro]) ||
                    (this.state.activeBlueprint?.rawMacros && this.state.activeBlueprint.rawMacros[macro]) || 0;
    this.setModuleCount(macro, current + delta);
  }

  importBlueprint(importedModulesMap) {
    const rawMacros = { ...importedModulesMap };
    this.state.modules = { ...rawMacros };
    if (!this.state.activeBlueprint) {
      this.state.activeBlueprint = {
        name: 'Imported Plan',
        modules: {},
        rawMacros: { ...rawMacros },
        rootMacros: { ...rawMacros },
        totalModules: Object.values(rawMacros).reduce((s, n) => s + n, 0),
        sector: this.state.selectedSector,
        workforceBonus: this.state.workforceBonus,
        ppStates: {}
      };
    } else {
      this.state.activeBlueprint.rawMacros = { ...rawMacros };
      this.state.activeBlueprint.rootMacros = { ...rawMacros };
      this.state.activeBlueprint.totalModules = Object.values(rawMacros).reduce((s, n) => s + n, 0);
    }
    this._saveState();
    this._notify();
  }

  reset() {
    clearBlueprintInternalStorage();
    this.state.modules = {};
    this.state.workforceCount = 0;
    this.state.sunlightPct = 100;
    this._saveState();
    this._notify();
  }

  /* --- Sector & Faction Settings --- */

  setSunlight(pct) {
    this.state.sunlightPct = Math.max(0, Number(pct) || 100);
    this._saveState();
    this._notify();
  }

  setConstructionMethod(method) {
    this.state.constructionMethod = method;
    this.state.factionConstructionMethod = method;
    this._saveState();
    this._notify();
  }

  setPriceType(priceType, silent = false) {
    const valid = ['min', 'avg', 'max'].includes(priceType) ? priceType : 'avg';
    this.state.priceType = valid;
    state.priceType = valid;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('x4_price_type', valid);
      } catch (e) {}
    }
    this._saveState();
    try {
      this.dispatchEvent(new CustomEvent('price:updated', { detail: { priceType: valid } }));
    } catch (e) {}
    if (!silent) {
      this._notify();
    }
  }

  setShowConstructionBudget(show) {
    const bool = Boolean(show);
    this.state.showConstructionBudget = bool;
    state.showConstructionBudget = bool;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('x4_show_construction_budget', String(bool));
      } catch (e) {}
    }
    this._saveState();
  }

  /* --- Subscription System --- */

  subscribe(callback) {
    const handler = (e) => {
      const detail = e.detail && e.detail.state ? e.detail.state : (e.detail || this.getState());
      callback(detail);
    };
    this.addEventListener('stateChange', handler);
    this.listeners.add(callback);
    return () => {
      this.removeEventListener('stateChange', handler);
      this.listeners.delete(callback);
    };
  }

  notify(event = 'stateChange', payload = null) {
    this.listeners.forEach(fn => {
      try {
        fn(this.state, event, payload);
      } catch (err) {
        console.error('Error in StationStore listener:', err);
      }
    });
    try {
      this.dispatchEvent(
        new CustomEvent('stateChange', { detail: { state: this.getState(), event, payload } })
      );
    } catch (e) {}
  }

  _notify() {
    this.notify('stateChange', this.getState());
  }

  _loadState() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
      }
    } catch (err) {
      console.warn('Failed to load station state from localStorage:', err);
    }
    return { ...DEFAULT_STATE };
  }

  _saveState() {
    try {
      saveActiveBlueprintToStorage();
      if (typeof window !== 'undefined' && window.localStorage) {
        const snapshot = {
          modules: this.state.modules || (this.state.activeBlueprint?.rawMacros) || {},
          workforceCount: this.state.workforceCount || 0,
          sunlightPct: this.state.sunlightPct || 100,
          constructionMethod: this.state.constructionMethod || this.state.factionConstructionMethod || 'commonwealth',
          priceType: this.state.priceType || 'avg',
          showConstructionBudget: this.state.showConstructionBudget !== undefined ? this.state.showConstructionBudget : true,
          activeTab: this.state.activeTab || 'matrix'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      }
    } catch (err) {
      console.error('Failed to save station state to localStorage:', err);
    }
  }

  save() {
    this._saveState();
    this.notify('STORAGE_SAVED');
  }

  clear() {
    clearBlueprintInternalStorage();
    this.notify('STORAGE_CLEARED');
  }
}

export const store = new StationStore(state);

