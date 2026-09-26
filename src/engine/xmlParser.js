import { mapMacroToWare, PRESET_BLUEPRINTS, isBlueprintTerran, WARES_DB } from '../data/wares.js';
import { state, store, saveActiveBlueprintToStorage, isHostedMode, clearBlueprintInternalStorage } from '../state/store.js';
import macroCatalog from '../data/macro_names.json' with { type: 'json' };

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
    console.info(`Loaded XML Blueprint: "${planName}" (${state.activeBlueprint.totalModules} total modules scanned!)`);
  } catch (err) {
    console.error('Failed to parse XML file:', err);
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
 * Parses raw X4 station blueprint XML content into a structured module count map.
 * 
 * @param {string} xmlString - Raw XML string from uploaded .xml file
 * @param {Object} [knownMacros=macroCatalog] - Catalog of recognized module macros
 * @returns {Object} Standardized parse result contract
 */
export function parseBlueprintXML(xmlString, knownMacros = macroCatalog) {
  const result = {
    success: false,
    modules: {},
    unrecognizedMacros: [],
    metadata: {
      entriesParsed: 0,
      totalModulesCount: 0,
      name: 'Custom Station Plan',
      id: 'unnamed_plan'
    },
    error: null,
  };

  if (!xmlString || typeof xmlString !== 'string' || !xmlString.trim()) {
    result.error = 'Empty or invalid XML content provided.';
    return result;
  }

  try {
    let entries = [];
    let planName = 'Custom Station Plan';
    let planId = 'unnamed_plan';

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Check for DOMParser syntax error tags
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        result.error = `XML Syntax Error: ${parserError.textContent.split('\n')[0]}`;
        return result;
      }

      // Extract root <plan> or <blueprint> metadata
      const planNode = xmlDoc.querySelector('plan') || xmlDoc.querySelector('blueprint') || xmlDoc.documentElement;
      if (planNode) {
        planName = planNode.getAttribute('name') || planName;
        planId = planNode.getAttribute('id') || planId;
      }

      const entryNodes = xmlDoc.querySelectorAll('entry');
      entryNodes.forEach((node) => {
        const macro = node.getAttribute('macro');
        const countAttr = node.getAttribute('count');
        const count = countAttr ? parseInt(countAttr, 10) : 1;
        entries.push({ macro, count: isNaN(count) || count <= 0 ? 1 : count });
      });
    } else {
      // Fallback regex parser for Node.js / non-browser test environments
      const nameMatch = xmlString.match(/<(?:plan|blueprint)[^>]*?\bname="([^"]*)"/i);
      const idMatch = xmlString.match(/<(?:plan|blueprint)[^>]*?\bid="([^"]*)"/i);
      if (nameMatch) planName = nameMatch[1];
      if (idMatch) planId = idMatch[1];

      const entryRegex = /<entry\b[^>]*?\bmacro="([^"]*)"(?:[^>]*?\bcount="([^"]*)")?[^>]*?>/gi;
      let match;
      while ((match = entryRegex.exec(xmlString)) !== null) {
        const macro = match[1];
        const count = match[2] ? parseInt(match[2], 10) : 1;
        entries.push({ macro, count: isNaN(count) || count <= 0 ? 1 : count });
      }
    }

    result.metadata.name = planName;
    result.metadata.id = planId;
    result.metadata.entriesParsed = entries.length;

    const catalogKeys = knownMacros ? (Array.isArray(knownMacros) ? new Set(knownMacros) : (knownMacros instanceof Set ? knownMacros : new Set(Object.keys(knownMacros)))) : null;

    for (const { macro, count } of entries) {
      if (!macro) continue;

      result.metadata.totalModulesCount += count;
      result.modules[macro] = (result.modules[macro] || 0) + count;

      if (catalogKeys && !catalogKeys.has(macro) && !catalogKeys.has(macro.toLowerCase())) {
        if (!result.unrecognizedMacros.includes(macro)) {
          result.unrecognizedMacros.push(macro);
        }
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.error = err.message || 'Unknown error parsing blueprint XML.';
    return result;
  }
}

/**
 * Parses an X4 XML station plan string into Map format.
 * @param {string} xmlString - The raw string content of an X4 blueprint .xml file.
 * @returns {{ id: string, name: string, modules: Map<string, number>, totalModules: number, unrecognizedMacros: string[] }}
 */
export function parseX4Blueprint(xmlString) {
  const res = parseBlueprintXML(xmlString);
  if (!res.success) {
    throw new Error(res.error || 'Failed to parse X4 XML blueprint.');
  }

  const modulesMap = new Map();
  Object.entries(res.modules).forEach(([macro, count]) => {
    modulesMap.set(macro, count);
  });

  return {
    id: res.metadata.id,
    name: res.metadata.name,
    modules: modulesMap,
    totalModules: res.metadata.totalModulesCount,
    unrecognizedMacros: res.unrecognizedMacros
  };
}

/**
 * Parses a blueprint XML string and automatically updates the reactive StationStore.
 * @param {string} xmlString - The raw contents of an X4 blueprint .xml file.
 * @param {Object} [targetStore=store] - Target reactive station store
 * @returns {{ id: string, name: string, totalModules: number, unrecognizedMacros: string[] }} Metadata summary.
 */
export function loadBlueprintIntoStore(xmlString, targetStore = store) {
  const parsed = parseBlueprintXML(xmlString);
  if (!parsed.success) {
    throw new Error(parsed.error || 'Failed to parse blueprint XML into store.');
  }

  const rawMacros = { ...parsed.modules };

  const appState = (targetStore && targetStore.state) ? targetStore.state : state;
  appState.originalBlueprint = {
    name: parsed.metadata.name,
    rawMacros: { ...rawMacros }
  };

  appState.activeBlueprint = {
    name: parsed.metadata.name,
    totalModules: parsed.metadata.totalModulesCount,
    modules: {},
    rawMacros: { ...rawMacros },
    rootMacros: { ...rawMacros },
    sector: null,
    workforceBonus: 0,
    ppStates: {},
    baselineDemand: null,
    baselineLayerTotals: null
  };

  const modulesMap = new Map();
  Object.entries(rawMacros).forEach(([macro, count]) => {
    modulesMap.set(macro, count);
  });
  appState.activeModules = modulesMap;
  appState.xmlMetadata = {
    id: parsed.metadata.id,
    name: parsed.metadata.name,
    totalModules: parsed.metadata.totalModulesCount,
    unrecognizedMacros: parsed.unrecognizedMacros,
    loadedAt: new Date().toISOString()
  };

  rebuildBlueprintFromMacros();

  // Notify reactive subscribers (re-renders UI views)
  if (targetStore && typeof targetStore.notify === 'function') {
    targetStore.notify('BLUEPRINT_LOADED', parsed);
  }

  return {
    id: parsed.metadata.id,
    name: parsed.metadata.name,
    totalModules: parsed.metadata.totalModulesCount,
    unrecognizedMacros: parsed.unrecognizedMacros
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

/**
 * Asynchronously reads a File object and parses it via parseBlueprintXML.
 * Does not mutate store state directly, returning the standardized parse result.
 * @param {File} file - HTML5 File object
 * @param {Object} [knownMacros] - Optional custom macro catalog
 * @returns {Promise<Object>} Standardized parse result contract
 */
export function readAndParseBlueprintFile(file, knownMacros = macroCatalog) {
  return new Promise((resolve) => {
    if (!file) {
      resolve({
        success: false,
        modules: {},
        unrecognizedMacros: [],
        metadata: { entriesParsed: 0, totalModulesCount: 0, fileName: '' },
        error: 'No file provided.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseBlueprintXML(e.target.result, knownMacros);
      parsed.metadata.fileName = file.name || 'uploaded_plan.xml';
      resolve(parsed);
    };
    reader.onerror = () => {
      resolve({
        success: false,
        modules: {},
        unrecognizedMacros: [],
        metadata: { entriesParsed: 0, totalModulesCount: 0, fileName: file.name },
        error: 'Failed to read the blueprint file.'
      });
    };
    reader.readAsText(file);
  });
}



