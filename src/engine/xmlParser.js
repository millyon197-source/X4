import { mapMacroToWare, PRESET_BLUEPRINTS } from '../data/wares.js';
import { state, saveActiveBlueprintToStorage } from './state.js';

export function rebuildBlueprintFromMacros() {
  if (!state.activeBlueprint || !state.activeBlueprint.rawMacros) return;

  const moduleCounts = {};
  let totalEntries = 0;

  Object.entries(state.activeBlueprint.rawMacros).forEach(([macro, count]) => {
    totalEntries += count;
    const wareId = mapMacroToWare(macro);
    if (wareId) {
      moduleCounts[wareId] = (moduleCounts[wareId] || 0) + count;
    }
  });

  state.activeBlueprint.totalModules = totalEntries;
  state.activeBlueprint.modules = moduleCounts;
}

export function parseXMLBlueprint(xmlText, fileName, onRender) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const planEl = doc.querySelector('plan');
    const planName = planEl ? (planEl.getAttribute('name') || fileName) : fileName;

    const entries = doc.querySelectorAll('entry');
    const rawMacroCounts = {};

    entries.forEach(entry => {
      const macro = entry.getAttribute('macro');
      if (macro) {
        rawMacroCounts[macro] = (rawMacroCounts[macro] || 0) + 1;
      }
    });

    state.originalBlueprint = {
      name: planName,
      rawMacros: { ...rawMacroCounts }
    };

    state.activeBlueprint = {
      name: planName,
      totalModules: 0,
      modules: {},
      rawMacros: { ...rawMacroCounts }
    };

    rebuildBlueprintFromMacros();

    // Shift previous blueprints to the right by adding new blueprint at the front (index 0)
    if (!state.loadedBlueprints) state.loadedBlueprints = [];
    state.loadedBlueprints = state.loadedBlueprints.filter(b => b.name !== planName);
    state.loadedBlueprints.unshift({
      name: planName,
      totalModules: state.activeBlueprint.totalModules,
      modules: { ...state.activeBlueprint.modules },
      rawMacros: { ...state.activeBlueprint.rawMacros }
    });

    state.currentPreset = 'blueprint';
    state.selectedWareId = null;
    state.calculatedDemand = {};
    state.subdueEcCalc = true;
    state.subdueLevel4 = true;

    saveActiveBlueprintToStorage();

    if (typeof onRender === 'function') onRender();
    alert(`Loaded XML Blueprint: "${planName}" (${state.activeBlueprint.totalModules} total modules scanned!)`);
  } catch (err) {
    alert('Failed to parse XML file.');
    console.error(err);
  }
}

export function reloadActiveBlueprint(onRender) {
  if (!state.activeBlueprint) return;

  if (state.currentPreset && PRESET_BLUEPRINTS[state.currentPreset]) {
    const p = PRESET_BLUEPRINTS[state.currentPreset];
    state.activeBlueprint = {
      name: p.name,
      totalModules: p.totalModules,
      modules: { ...p.modules },
      rawMacros: { ...(p.rawMacros || {}) }
    };
  } else if (state.originalBlueprint && state.originalBlueprint.rawMacros) {
    state.activeBlueprint = {
      name: state.originalBlueprint.name,
      totalModules: 0,
      modules: {},
      rawMacros: { ...state.originalBlueprint.rawMacros }
    };
    rebuildBlueprintFromMacros();
  } else if (state.activeBlueprint.rawMacros) {
    rebuildBlueprintFromMacros();
  }

  state.selectedWareId = null;
  state.calculatedDemand = {};
  state.searchQuery = '';
  state.subdueEcCalc = true;
  state.subdueLevel4 = true;

  saveActiveBlueprintToStorage();

  if (typeof onRender === 'function') onRender();
}

export function switchLoadedBlueprint(name, onRender) {
  if (!state.loadedBlueprints || state.loadedBlueprints.length === 0) return;
  const targetBp = state.loadedBlueprints.find(b => b.name === name);
  if (!targetBp) return;

  state.activeBlueprint = {
    name: targetBp.name,
    totalModules: targetBp.totalModules,
    modules: { ...targetBp.modules },
    rawMacros: { ...targetBp.rawMacros }
  };
  state.originalBlueprint = {
    name: targetBp.name,
    rawMacros: { ...targetBp.rawMacros }
  };

  // Move switched blueprint to front (index 0) so other previous blueprints are to the right
  state.loadedBlueprints = state.loadedBlueprints.filter(b => b.name !== name);
  state.loadedBlueprints.unshift(targetBp);

  state.currentPreset = 'blueprint';
  state.selectedWareId = null;
  state.calculatedDemand = {};
  state.searchQuery = '';
  state.subdueEcCalc = true;
  state.subdueLevel4 = true;

  saveActiveBlueprintToStorage();
  if (typeof onRender === 'function') onRender();
}

export function removeLoadedBlueprint(name, onRender) {
  if (!state.loadedBlueprints) state.loadedBlueprints = [];
  const wasActive = state.activeBlueprint && state.activeBlueprint.name === name;
  state.loadedBlueprints = state.loadedBlueprints.filter(b => b.name !== name);

  if (wasActive) {
    if (state.loadedBlueprints.length > 0) {
      const nextBp = state.loadedBlueprints[0];
      state.activeBlueprint = {
        name: nextBp.name,
        totalModules: nextBp.totalModules,
        modules: { ...nextBp.modules },
        rawMacros: { ...nextBp.rawMacros }
      };
      state.originalBlueprint = {
        name: nextBp.name,
        rawMacros: { ...nextBp.rawMacros }
      };
      state.currentPreset = 'blueprint';
      state.subdueEcCalc = true;
      state.subdueLevel4 = true;
    } else {
      state.activeBlueprint = null;
      state.originalBlueprint = null;
      state.currentPreset = 'all';
    }
    state.selectedWareId = null;
    state.calculatedDemand = {};
  }

  saveActiveBlueprintToStorage();
  if (typeof onRender === 'function') onRender();
}

export function removeActiveBlueprint(onRender) {
  if (state.activeBlueprint) {
    const activeName = state.activeBlueprint.name;
    removeLoadedBlueprint(activeName, onRender);
  } else {
    state.activeBlueprint = null;
    state.originalBlueprint = null;
    state.currentPreset = 'all';
    state.selectedWareId = null;
    state.calculatedDemand = {};
    saveActiveBlueprintToStorage();
    if (typeof onRender === 'function') onRender();
  }
}
