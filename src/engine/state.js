import { mapMacroToWare, PRESET_BLUEPRINTS, WARES_DB } from '../data/wares.js';

// Application Reactive State Management

let savedBlueprint = null;
let savedOriginalBlueprint = null;
let savedLoadedBlueprints = [];
let savedPreset = 'all';

try {
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
} catch (e) {
  console.error('Error loading initial state from localStorage', e);
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

if (savedBlueprint) {
  if (!savedBlueprint.modules) savedBlueprint.modules = {};
  if (!savedBlueprint.rawMacros) savedBlueprint.rawMacros = {};
  if (!savedBlueprint.ppStates) savedBlueprint.ppStates = {};
  rebuildModulesFromRawMacros(savedBlueprint);
  savedBlueprint.baselineDemand = null;
  savedBlueprint.baselineLayerTotals = null;
  if (!savedOriginalBlueprint) {
    savedOriginalBlueprint = {
      name: savedBlueprint.name,
      totalModules: savedBlueprint.totalModules,
      modules: { ...savedBlueprint.modules },
      rawMacros: { ...savedBlueprint.rawMacros }
    };
  }
}
if (savedOriginalBlueprint) {
  if (!savedOriginalBlueprint.modules) savedOriginalBlueprint.modules = {};
  if (!savedOriginalBlueprint.rawMacros) savedOriginalBlueprint.rawMacros = {};
  rebuildModulesFromRawMacros(savedOriginalBlueprint);
}
if (!Array.isArray(savedLoadedBlueprints)) savedLoadedBlueprints = [];

if (Array.isArray(savedLoadedBlueprints)) {
  savedLoadedBlueprints.forEach(b => {
    if (b) {
      if (!b.modules) b.modules = {};
      if (!b.rawMacros) b.rawMacros = {};
      if (!b.ppStates) b.ppStates = {};
      rebuildModulesFromRawMacros(b);
    }
  });
}

// Ensure savedBlueprint is at least in loadedBlueprints
if (savedBlueprint && !savedLoadedBlueprints.some(b => b.name === savedBlueprint.name)) {
  savedLoadedBlueprints.unshift({
    name: savedBlueprint.name,
    totalModules: savedBlueprint.totalModules || 0,
    modules: { ...(savedBlueprint.modules || {}) },
    rawMacros: { ...(savedBlueprint.rawMacros || {}) },
    sector: savedBlueprint.sector || null,
    workforceBonus: typeof savedBlueprint.workforceBonus === 'number' ? savedBlueprint.workforceBonus : 0,
    ppStates: { ...(savedBlueprint.ppStates || {}) }
  });
}

let savedSector = null;
let savedWorkforceBonus = 0;
try {
  const wfStr = localStorage.getItem('x4_workforce_bonus');
  if (wfStr !== null) {
    savedWorkforceBonus = parseInt(wfStr) || 0;
  }
} catch (e) {}

if (savedBlueprint) {
  const lb = (savedLoadedBlueprints || []).find(b => b && b.name === savedBlueprint.name);
  savedSector = (lb && lb.sector) || savedBlueprint.sector || null;
  if (lb && typeof lb.workforceBonus === 'number') {
    savedWorkforceBonus = lb.workforceBonus;
  } else if (typeof savedBlueprint.workforceBonus === 'number') {
    savedWorkforceBonus = savedBlueprint.workforceBonus;
  }
}

let savedPlannedScroll = {
  wrapperTop: 0,
  wrapperLeft: 0,
  tableTop: 0,
  tableLeft: 0,
  winX: 0,
  winY: 0,
  lastFocusedId: null,
  lastFocusedMacro: null,
  lastFocusedField: null,
  cursorStart: null,
  cursorEnd: null
};

try {
  const pScrollStr = sessionStorage.getItem('x4_planned_scroll');
  if (pScrollStr) {
    savedPlannedScroll = { ...savedPlannedScroll, ...JSON.parse(pScrollStr) };
  }
} catch (e) {}

let savedActiveTab = 'matrix';
try {
  const tabStr = sessionStorage.getItem('x4_active_tab');
  if (tabStr === 'matrix' || tabStr === 'planned') {
    savedActiveTab = tabStr;
  }
} catch (e) {}

let savedPreviousBlueprint = null;
let savedPreviousPreset = null;
let savedLastFocusedWare = null;
let savedBpLevelCollapsed = { 1: true, 2: true, 3: true };
try {
  const prevBpStr = sessionStorage.getItem('x4_previous_blueprint');
  if (prevBpStr) savedPreviousBlueprint = JSON.parse(prevBpStr);
  const prevPrStr = sessionStorage.getItem('x4_previous_preset');
  if (prevPrStr) savedPreviousPreset = prevPrStr;
  const lastFocStr = sessionStorage.getItem('x4_last_focused_ware');
  if (lastFocStr) savedLastFocusedWare = lastFocStr;
  const collapsedStr = sessionStorage.getItem('x4_bp_level_collapsed');
  if (collapsedStr) savedBpLevelCollapsed = JSON.parse(collapsedStr);
} catch (e) {}

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
  try {
    if (state.activeBlueprint) {
      state.activeBlueprint.workforceBonus = (typeof state.workforceBonus === 'number') ? state.workforceBonus : 0;
      localStorage.setItem('x4_active_blueprint', JSON.stringify(state.activeBlueprint));
      localStorage.setItem('x4_current_preset', state.currentPreset);
      if (state.originalBlueprint) {
        localStorage.setItem('x4_original_blueprint', JSON.stringify(state.originalBlueprint));
      }
    } else {
      localStorage.removeItem('x4_active_blueprint');
      localStorage.removeItem('x4_original_blueprint');
      localStorage.setItem('x4_current_preset', state.currentPreset);
    }
    if (state.selectedSector) {
      localStorage.setItem('x4_selected_sector', state.selectedSector);
    } else {
      localStorage.removeItem('x4_selected_sector');
    }
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
    if (state.lastFocusedWareId) {
      sessionStorage.setItem('x4_last_focused_ware', state.lastFocusedWareId);
    } else {
      sessionStorage.removeItem('x4_last_focused_ware');
    }
  } catch (e) {
    console.error('Error saving state to localStorage', e);
  }
}
