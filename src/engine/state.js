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

// Ensure savedBlueprint is at least in loadedBlueprints
if (savedBlueprint && !savedLoadedBlueprints.some(b => b.name === savedBlueprint.name)) {
  savedLoadedBlueprints.unshift({
    name: savedBlueprint.name,
    totalModules: savedBlueprint.totalModules || 0,
    modules: { ...(savedBlueprint.modules || {}) },
    rawMacros: { ...(savedBlueprint.rawMacros || {}) }
  });
}

export const state = {
  activeTab: 'matrix', // 'matrix' or 'planned'
  activeBlueprint: savedBlueprint,
  originalBlueprint: savedOriginalBlueprint,
  loadedBlueprints: savedLoadedBlueprints,
  selectedWareId: null,
  currentPreset: savedPreset,
  searchQuery: '',
  targetModules: 1,
  workforceBonus: 0,
  subdueZeroX: false,
  subdueEcCalc: savedBlueprint ? true : false,
  subdueLevel4: savedBlueprint ? true : false,
  inspectorSingle: false,
  macroSortAsc: true,
  factionConstructionMethod: 'commonwealth',
  hideFoodAgriPlanned: false,
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
    if (state.loadedBlueprints && state.loadedBlueprints.length > 0) {
      localStorage.setItem('x4_loaded_blueprints', JSON.stringify(state.loadedBlueprints));
    } else {
      localStorage.removeItem('x4_loaded_blueprints');
    }
  } catch (e) {
    console.error('Error saving state to localStorage', e);
  }
}
