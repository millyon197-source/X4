import { mapMacroToWare, PRESET_BLUEPRINTS } from '../data/wares.js';

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

  // If bp is Prod Max and missing TerEC or rawMacros, restore from PRESET_BLUEPRINTS
  if (bp.name === 'Prod Max' && (!bp.modules || !bp.modules['TerEC'] || !bp.rawMacros || !bp.rawMacros['prod_ter_energycells_macro'])) {
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
    const wareId = mapMacroToWare(macro);
    if (wareId) {
      newModules[wareId] = (newModules[wareId] || 0) + count;
    }
  });
  bp.totalModules = total;
  bp.modules = newModules;
}

if (savedBlueprint) {
  if (!savedBlueprint.modules) savedBlueprint.modules = {};
  if (!savedBlueprint.rawMacros) savedBlueprint.rawMacros = {};
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
    rawMacros: { ...(savedBlueprint.rawMacros || {}) }
  });
}

let savedSector = "Nopileos' Fortune VI / Duke's Awakening";
try {
  const secStr = localStorage.getItem('x4_selected_sector');
  if (secStr) {
    savedSector = secStr;
  }
} catch (e) {}

export const state = {
  activeTab: 'matrix', // 'matrix' or 'planned'
  activeBlueprint: savedBlueprint,
  originalBlueprint: savedOriginalBlueprint,
  loadedBlueprints: savedLoadedBlueprints,
  selectedWareId: null,
  selectedSector: savedSector,
  currentPreset: savedPreset,
  searchQuery: '',
  workforceBonus: 0,
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
    }
    if (state.loadedBlueprints && state.loadedBlueprints.length > 0) {
      localStorage.setItem('x4_loaded_blueprints', JSON.stringify(state.loadedBlueprints));
    } else {
      localStorage.removeItem('x4_loaded_blueprints');
    }
  } catch (e) {
    console.error('Error saving state to localStorage', e);
  }
}
