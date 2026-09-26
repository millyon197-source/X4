import { mapMacroToWare, PRESET_BLUEPRINTS, isBlueprintTerran, WARES_DB } from '../data/wares.js';
import { state, store, saveActiveBlueprintToStorage, isHostedMode, clearBlueprintInternalStorage } from '../state/store.js';

export function rebuildBlueprintFromMacros() {
  if (!state.activeBlueprint) return;

  if (state.activeBlueprint.name === 'Prod Max' && (!state.activeBlueprint.rawMacros || Object.keys(state.activeBlueprint.rawMacros).length === 0)) {
    if (PRESET_BLUEPRINTS && PRESET_BLUEPRINTS['prod_max']) {
      state.activeBlueprint.rawMacros = { ...PRESET_BLUEPRINTS['prod_max'].rawMacros };
      state.activeBlueprint.modules = { ...PRESET_BLUEPRINTS['prod_max'].modules };
      state.activeBlueprint.totalModules = PRESET_BLUEPRINTS['prod_max'].totalModules;
      return;
    }
  }

  if (state.activeBlueprint.rawMacros && Object.keys(state.activeBlueprint.rawMacros).length > 0) {
    const moduleCounts = {};
    let totalEntries = 0;

    Object.entries(state.activeBlueprint.rawMacros).forEach(([macro, count]) => {
      totalEntries += count;
      const lowerMacro = macro.toLowerCase();
      const isRecycler = (lowerMacro.includes('scraprecycler') || lowerMacro.includes('scrap_recycler')) && !lowerMacro.includes('khaak');
      if (isRecycler) {
        if (lowerMacro.includes('ter')) {
          moduleCounts['TerCompSubstrate'] = (moduleCounts['TerCompSubstrate'] || 0) + count;
          moduleCounts['TerSilCarbide'] = (moduleCounts['TerSilCarbide'] || 0) + count;
          moduleCounts['TerScrapMetal'] = (moduleCounts['TerScrapMetal'] || 0) + count;
        } else {
          moduleCounts['ScrapHullParts'] = (moduleCounts['ScrapHullParts'] || 0) + count;
          moduleCounts['ScrapClaytronics'] = (moduleCounts['ScrapClaytronics'] || 0) + count;
          moduleCounts['ScrapMetal'] = (moduleCounts['ScrapMetal'] || 0) + count;
        }
        return;
      }
      const wareId = mapMacroToWare(macro);
      if (wareId) {
        moduleCounts[wareId] = (moduleCounts[wareId] || 0) + count;
      }
    });

    state.activeBlueprint.totalModules = totalEntries;
    state.activeBlueprint.modules = moduleCounts;
  } else if (state.activeBlueprint.modules) {
    Object.entries(state.activeBlueprint.modules).forEach(([k, v]) => {
      const wareId = mapMacroToWare(k);
      if (wareId && wareId !== k) {
        state.activeBlueprint.modules[wareId] = (state.activeBlueprint.modules[wareId] || 0) + v;
      }
    });
  }

  if (state.activeBlueprint.modules && state.activeBlueprint.modules['RawScrap'] && !state.activeBlueprint.modules['ScrapProc']) {
    state.activeBlueprint.modules['ScrapProc'] = state.activeBlueprint.modules['RawScrap'];
    delete state.activeBlueprint.modules['RawScrap'];
  }

  if (!state.activeBlueprint.ppStates) state.activeBlueprint.ppStates = {};
  delete state.activeBlueprint.ppStates['ScrapHullParts'];
  delete state.activeBlueprint.ppStates['ScrapClaytronics'];
  delete state.activeBlueprint.ppStates['TerCompSubstrate'];
  delete state.activeBlueprint.ppStates['TerSilCarbide'];

  // Rule: If any inputs to Hull Parts has 0 module count, then check PP for Hull Part
  const bpModules = state.activeBlueprint.modules || {};
  const hullWare = WARES_DB['HullParts'];
  if (hullWare && hullWare.recipe) {
    const anyInputZero = Object.keys(hullWare.recipe).some(inpId => {
      if (inpId === 'EC' || inpId === 'TerEC') {
        return ((bpModules['EC'] || 0) + (bpModules['TerEC'] || 0)) === 0;
      }
      return (bpModules[inpId] || 0) === 0;
    });

    if (anyInputZero) {
      if (!state.activeBlueprint._manualHullPartsPP) {
        state.activeBlueprint.ppStates['HullParts'] = true;
        state.activeBlueprint._autoHullPartsPP = true;
      }
    } else if (state.activeBlueprint._autoHullPartsPP) {
      delete state.activeBlueprint.ppStates['HullParts'];
      delete state.activeBlueprint._autoHullPartsPP;
      delete state.activeBlueprint._manualHullPartsPP;
    }
  }

  const telWare = WARES_DB['TelParts'];
  if (telWare && telWare.recipe && bpModules['TelParts'] !== undefined) {
    const anyTelInputZero = Object.keys(telWare.recipe).some(inpId => {
      if (inpId === 'EC' || inpId === 'TerEC') {
        return ((bpModules['EC'] || 0) + (bpModules['TerEC'] || 0)) === 0;
      }
      return (bpModules[inpId] || 0) === 0;
    });

    if (anyTelInputZero) {
      if (!state.activeBlueprint._manualTelPartsPP) {
        state.activeBlueprint.ppStates['TelParts'] = true;
        state.activeBlueprint._autoTelPartsPP = true;
      }
    } else if (state.activeBlueprint._autoTelPartsPP) {
      delete state.activeBlueprint.ppStates['TelParts'];
      delete state.activeBlueprint._autoTelPartsPP;
      delete state.activeBlueprint._manualTelPartsPP;
    }
  }

  // Rule: If any inputs to Claytronics has 0 module count, then check PP for Claytronics
  const clayWare = WARES_DB['Claytronics'];
  if (clayWare && clayWare.recipe) {
    const anyClayInputZero = Object.keys(clayWare.recipe).some(inpId => {
      if (inpId === 'EC' || inpId === 'TerEC') {
        return ((bpModules['EC'] || 0) + (bpModules['TerEC'] || 0)) === 0;
      }
      return (bpModules[inpId] || 0) === 0;
    });

    if (anyClayInputZero) {
      if (!state.activeBlueprint._manualClaytronicsPP) {
        state.activeBlueprint.ppStates['Claytronics'] = true;
        state.activeBlueprint._autoClaytronicsPP = true;
      }
    } else if (state.activeBlueprint._autoClaytronicsPP) {
      delete state.activeBlueprint.ppStates['Claytronics'];
      delete state.activeBlueprint._autoClaytronicsPP;
      delete state.activeBlueprint._manualClaytronicsPP;
    }
  }
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

    if (isHostedMode()) {
      clearBlueprintInternalStorage();
    }

    state.originalBlueprint = {
      name: planName,
      rawMacros: { ...rawMacroCounts }
    };

    state.activeBlueprint = {
      name: planName,
      totalModules: 0,
      modules: {},
      rawMacros: { ...rawMacroCounts },
      rootMacros: { ...rawMacroCounts },
      sector: null,
      workforceBonus: 0,
      ppStates: {},
      baselineDemand: null,
      baselineLayerTotals: null
    };

    state.selectedSector = null;
    state.workforceBonus = 0;

    rebuildBlueprintFromMacros();

    if (isHostedMode()) {
      state.loadedBlueprints = [{
        name: planName,
        totalModules: state.activeBlueprint.totalModules,
        modules: { ...state.activeBlueprint.modules },
        rawMacros: { ...state.activeBlueprint.rawMacros },
        rootMacros: { ...state.activeBlueprint.rootMacros },
        sector: null,
        workforceBonus: 0,
        ppStates: {}
      }];
    } else {
      // Shift previous blueprints to the right by adding new blueprint at the front (index 0)
      if (!state.loadedBlueprints) state.loadedBlueprints = [];
      state.loadedBlueprints = state.loadedBlueprints.filter(b => b.name !== planName);
      state.loadedBlueprints.unshift({
        name: planName,
        totalModules: state.activeBlueprint.totalModules,
        modules: { ...state.activeBlueprint.modules },
        rawMacros: { ...state.activeBlueprint.rawMacros },
        rootMacros: { ...state.activeBlueprint.rootMacros },
        sector: null,
        workforceBonus: 0,
        ppStates: {}
      });
    }

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
  if (!state.activeBlueprint) {
    state.workforceBonus = 0;
    return;
  }

  const currentLb = (state.loadedBlueprints || []).find(b => b && b.name === state.activeBlueprint.name);
  const preservedSector = (currentLb && currentLb.sector) || state.activeBlueprint.sector || null;
  const preservedWf = (currentLb && typeof currentLb.workforceBonus === 'number')
    ? currentLb.workforceBonus
    : (typeof state.activeBlueprint.workforceBonus === 'number' ? state.activeBlueprint.workforceBonus : 0);
  const preservedPP = (currentLb && currentLb.ppStates) || state.activeBlueprint.ppStates || {};

  state.selectedSector = preservedSector;
  state.workforceBonus = preservedWf;

  if (state.currentPreset && PRESET_BLUEPRINTS[state.currentPreset]) {
    const p = PRESET_BLUEPRINTS[state.currentPreset];
    state.activeBlueprint = {
      name: p.name,
      totalModules: p.totalModules,
      modules: { ...p.modules },
      rawMacros: { ...(p.rawMacros || {}) },
      rootMacros: { ...(p.rawMacros || {}) },
      sector: preservedSector,
      workforceBonus: preservedWf,
      ppStates: { ...preservedPP },
      baselineDemand: null,
      baselineLayerTotals: null
    };
  } else if (state.originalBlueprint && state.originalBlueprint.rawMacros) {
    state.activeBlueprint = {
      name: state.originalBlueprint.name,
      totalModules: 0,
      modules: {},
      rawMacros: { ...state.originalBlueprint.rawMacros },
      rootMacros: { ...state.originalBlueprint.rawMacros },
      sector: preservedSector,
      workforceBonus: preservedWf,
      ppStates: { ...preservedPP },
      baselineDemand: null,
      baselineLayerTotals: null
    };
    rebuildBlueprintFromMacros();
  } else if (state.activeBlueprint.rawMacros) {
    state.activeBlueprint.rootMacros = { ...(state.activeBlueprint.rawMacros || {}) };
    state.activeBlueprint.baselineDemand = null;
    state.activeBlueprint.baselineLayerTotals = null;
    state.activeBlueprint.sector = preservedSector;
    state.activeBlueprint.workforceBonus = preservedWf;
    state.activeBlueprint.ppStates = { ...preservedPP };
    rebuildBlueprintFromMacros();
  }

  state.selectedWareId = null;
  state.calculatedDemand = {};
  state.searchQuery = '';
  state.subdueEcCalc = true;
  state.subdueLevel4 = true;
  state.previousBlueprint = null;
  state.previousPreset = null;

  saveActiveBlueprintToStorage();

  if (typeof onRender === 'function') onRender();
}

export function switchLoadedBlueprint(name, onRender) {
  if (isHostedMode()) return;
  if (!state.loadedBlueprints || state.loadedBlueprints.length === 0) return;
  const targetBp = state.loadedBlueprints.find(b => b.name === name);
  if (!targetBp) return;

  const targetSector = targetBp.sector || null;
  const targetWf = typeof targetBp.workforceBonus === 'number' ? targetBp.workforceBonus : 0;
  const targetPP = targetBp.ppStates || {};

  state.activeBlueprint = {
    name: targetBp.name,
    totalModules: targetBp.totalModules,
    modules: { ...targetBp.modules },
    rawMacros: { ...(targetBp.rootMacros || targetBp.rawMacros) },
    rootMacros: { ...(targetBp.rootMacros || targetBp.rawMacros) },
    sector: targetSector,
    workforceBonus: targetWf,
    ppStates: { ...targetPP },
    baselineDemand: null,
    baselineLayerTotals: null
  };
  state.originalBlueprint = {
    name: targetBp.name,
    rawMacros: { ...targetBp.rawMacros }
  };

  // If a load of a blueprint has no internalStorage used to allow switching between already loaded blueprints,
  // targetSector will be null. This sets state.selectedSector to null, returning the dropdown to "-- Select Sector --"
  // and flashing the needle indicator between red and green head.
  state.selectedSector = targetSector;
  state.workforceBonus = targetWf;

  rebuildBlueprintFromMacros();

  // Move switched blueprint to front (index 0) so other previous blueprints are to the right
  state.loadedBlueprints = state.loadedBlueprints.filter(b => b.name !== name);
  state.loadedBlueprints.unshift(targetBp);

  state.currentPreset = 'blueprint';
  state.selectedWareId = null;
  state.calculatedDemand = {};
  state.searchQuery = '';
  state.subdueEcCalc = true;
  state.subdueLevel4 = true;
  state.previousBlueprint = null;
  state.previousPreset = null;

  saveActiveBlueprintToStorage();
  if (typeof onRender === 'function') onRender();
}

export function removeLoadedBlueprint(name, onRender) {
  if (isHostedMode()) {
    clearBlueprintInternalStorage();
    state.activeBlueprint = null;
    state.originalBlueprint = null;
    state.currentPreset = 'all';
    state.selectedWareId = null;
    state.calculatedDemand = {};
    saveActiveBlueprintToStorage();
    if (typeof onRender === 'function') onRender();
    return;
  }

  if (!state.loadedBlueprints) state.loadedBlueprints = [];
  const wasActive = state.activeBlueprint && state.activeBlueprint.name === name;
  state.loadedBlueprints = state.loadedBlueprints.filter(b => b.name !== name);

  if (wasActive) {
    state.previousBlueprint = null;
    state.previousPreset = null;
    if (state.loadedBlueprints.length > 0) {
      const nextBp = state.loadedBlueprints[0];
      const nextSector = nextBp.sector || null;
      const nextWf = typeof nextBp.workforceBonus === 'number' ? nextBp.workforceBonus : 0;
      state.activeBlueprint = {
        name: nextBp.name,
        totalModules: nextBp.totalModules,
        modules: { ...nextBp.modules },
        rawMacros: { ...nextBp.rawMacros },
        sector: nextSector,
        workforceBonus: nextWf
      };
      state.originalBlueprint = {
        name: nextBp.name,
        rawMacros: { ...nextBp.rawMacros }
      };
      state.selectedSector = nextSector;
      state.workforceBonus = nextWf;
      state.currentPreset = 'blueprint';
      state.subdueEcCalc = true;
      state.subdueLevel4 = true;
    } else {
      state.activeBlueprint = null;
      state.originalBlueprint = null;
      state.selectedSector = null;
      state.workforceBonus = 0;
      state.currentPreset = 'all';
    }
    state.selectedWareId = null;
    state.calculatedDemand = {};
  }

  saveActiveBlueprintToStorage();
  if (typeof onRender === 'function') onRender();
}

export function removeActiveBlueprint(onRender) {
  if (isHostedMode()) {
    clearBlueprintInternalStorage();
    state.activeBlueprint = null;
    state.originalBlueprint = null;
    state.currentPreset = 'all';
    state.selectedWareId = null;
    state.calculatedDemand = {};
    saveActiveBlueprintToStorage();
    if (typeof onRender === 'function') onRender();
    return;
  }

  if (state.activeBlueprint) {
    const activeName = state.activeBlueprint.name;
    removeLoadedBlueprint(activeName, onRender);
  } else {
    state.activeBlueprint = null;
    state.originalBlueprint = null;
    state.selectedSector = null;
    state.workforceBonus = 0;
    state.currentPreset = 'all';
    state.selectedWareId = null;
    state.calculatedDemand = {};
    saveActiveBlueprintToStorage();
    if (typeof onRender === 'function') onRender();
  }
}

/**
 * Parses an X4 XML station plan string.
 * @param {string} xmlString - The raw string content of an X4 blueprint .xml file.
 * @returns {{ id: string, name: string, modules: Map<string, number>, totalModules: number }}
 */
export function parseX4Blueprint(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Invalid XML content: Expected a non-empty string.');
  }

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for XML parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`XML Parsing Error: ${parseError.textContent}`);
    }

    // Extract root <plan> or <blueprint> metadata
    const planNode = xmlDoc.querySelector('plan') || xmlDoc.querySelector('blueprint') || xmlDoc.documentElement;
    const name = (planNode && planNode.getAttribute('name')) || 'Custom Station Plan';
    const id = (planNode && planNode.getAttribute('id')) || 'unnamed_plan';

    // Aggregate module macro counts
    const entries = xmlDoc.querySelectorAll('entry');
    const modulesMap = new Map();
    let totalModules = 0;

    entries.forEach((entry) => {
      const macro = entry.getAttribute('macro');
      if (!macro) return;

      const countAttr = entry.getAttribute('count');
      const count = countAttr ? parseInt(countAttr, 10) : 1;

      if (!isNaN(count) && count > 0) {
        const currentCount = modulesMap.get(macro) || 0;
        modulesMap.set(macro, currentCount + count);
        totalModules += count;
      }
    });

    return {
      id,
      name,
      modules: modulesMap,
      totalModules
    };
  }

  // Fallback regex parser for Node.js / non-browser test environments
  const nameMatch = xmlString.match(/<(?:plan|blueprint)[^>]*?\bname="([^"]*)"/i);
  const idMatch = xmlString.match(/<(?:plan|blueprint)[^>]*?\bid="([^"]*)"/i);
  const name = nameMatch ? nameMatch[1] : 'Custom Station Plan';
  const id = idMatch ? idMatch[1] : 'unnamed_plan';

  const entryRegex = /<entry\b[^>]*?\bmacro="([^"]*)"(?:[^>]*?\bcount="([^"]*)")?[^>]*?>/gi;
  const modulesMap = new Map();
  let totalModules = 0;
  let match;

  while ((match = entryRegex.exec(xmlString)) !== null) {
    const macro = match[1];
    const count = match[2] ? parseInt(match[2], 10) : 1;
    if (macro && !isNaN(count) && count > 0) {
      const currentCount = modulesMap.get(macro) || 0;
      modulesMap.set(macro, currentCount + count);
      totalModules += count;
    }
  }

  return {
    id,
    name,
    modules: modulesMap,
    totalModules
  };
}

/**
 * Parses a blueprint XML string and automatically updates the reactive StationStore.
 * @param {string} xmlString - The raw contents of an X4 blueprint .xml file.
 * @returns {{ id: string, name: string, totalModules: number }} Metadata summary.
 */
export function loadBlueprintIntoStore(xmlString, targetStore = store) {
  const parsed = parseX4Blueprint(xmlString);

  const rawMacros = {};
  parsed.modules.forEach((count, macro) => {
    rawMacros[macro] = count;
  });

  const appState = (targetStore && targetStore.state) ? targetStore.state : state;
  appState.originalBlueprint = {
    name: parsed.name,
    rawMacros: { ...rawMacros }
  };

  appState.activeBlueprint = {
    name: parsed.name,
    totalModules: parsed.totalModules,
    modules: {},
    rawMacros: { ...rawMacros },
    rootMacros: { ...rawMacros },
    sector: null,
    workforceBonus: 0,
    ppStates: {},
    baselineDemand: null,
    baselineLayerTotals: null
  };

  appState.activeModules = parsed.modules;
  appState.xmlMetadata = {
    id: parsed.id,
    name: parsed.name,
    totalModules: parsed.totalModules,
    loadedAt: new Date().toISOString()
  };

  rebuildBlueprintFromMacros();

  // Notify reactive subscribers (re-renders UI views)
  if (targetStore && typeof targetStore.notify === 'function') {
    targetStore.notify('BLUEPRINT_LOADED', parsed);
  }

  return {
    id: parsed.id,
    name: parsed.name,
    totalModules: parsed.totalModules
  };
}

/**
 * Helper to read a File object (from drag-and-drop or file input) and load it into store.
 * @param {File} file - HTML5 File object from dropzone or file picker.
 * @param {Object} [targetStore=store] - Target reactive store
 * @returns {Promise<{ id: string, name: string, totalModules: number }>}
 */
export function readAndLoadBlueprintFile(file, targetStore = store) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = loadBlueprintIntoStore(e.target.result, targetStore);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the blueprint file.'));
    reader.readAsText(file);
  });
}


