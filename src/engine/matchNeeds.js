import { state, saveActiveBlueprintToStorage } from '../state/store.js';
import { WARES_DB, MACRO_TO_WARE, mapMacroToWare, isBlueprintTerran } from '../data/wares.js';
import { rebuildBlueprintFromMacros, reloadActiveBlueprint } from './xmlParser.js';
import { getPrimaryMacroForWare, calculateFactoryRequirements } from './calculator.js';

export function getMatchNeedsStatus() {
  if (!state.activeBlueprint) {
    return {
      isAllSynced: false,
      hasExceeded: false,
      hasDeficit: false,
      matchNeedsLabel: 'Match Needs',
      matchNeedsTitle: "When checked, updates each module's Plan value to its calculated Needed count and recalculates"
    };
  }

  const liveDemand = state.calculatedDemand || (state.activeBlueprint && state.activeBlueprint.baselineDemand) || {};
  let hasExceeded = false;
  let hasDeficit = false;

  Object.keys(WARES_DB).forEach(wId => {
    const ware = WARES_DB[wId];
    if (ware.level === 0) return; // Level 0 (raw resources and solar EC/TerEC) are not part of L1-L3 production matching
    if (ware.level === 4) return;
    if (wId === 'ScrapMetal' || wId === 'TerScrapMetal' || wId === 'ScrapProc' || wId === 'AllographyneScrapProc') return;

    const inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wId]) || 0;
    const optimum = liveDemand[wId] ? (liveDemand[wId].modulesNeeded || 0) : 0;

    if (inPlan > optimum) {
      hasExceeded = true;
    } else if (inPlan < optimum) {
      hasDeficit = true;
    }
  });

  const liveLt = state.layerTotals || (state.activeBlueprint && state.activeBlueprint.baselineLayerTotals) || {};
  const terLoaded = (liveLt.inPlanTerSolarCount || 0) > 0;
  const genLoaded = (liveLt.inPlanSolarCount || 0) > 0;
  const isTerran = state.activeBlueprint && (isBlueprintTerran(state.activeBlueprint) || state.factionConstructionMethod === 'terran');
  const isPureTerranSolar = (terLoaded && !genLoaded) || (!terLoaded && !genLoaded && isTerran);

  if (isPureTerranSolar) {
    if ((liveLt.terSolarModulesNeeded || 0) > 0) {
      hasDeficit = true;
    }
  } else {
    if ((liveLt.solarModulesNeeded || 0) > 0) {
      hasDeficit = true;
    }
  }

  const isAllSynced = !hasDeficit;
  const matchNeedsLabel = hasExceeded ? 'Match Needs<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : 'Match Needs';
  const matchNeedsTitle = hasExceeded
    ? "When checked, updates each module's Plan value to its calculated Needed count (preserving higher Plan values) and recalculates (* indicates one or more Plan values exceed Needs)"
    : "When checked, updates each module's Plan value to its calculated Needed count and recalculates";

  return { isAllSynced, hasExceeded, hasDeficit, matchNeedsLabel, matchNeedsTitle };
}

export function applyMatchNeeds(checked, onRender) {
  if (!checked) {
    state.populateMatrix = false;
    reloadActiveBlueprint(onRender);
    if (typeof onRender !== 'function') {
      calculateFactoryRequirements();
    }
    return;
  }

  if (!state.activeBlueprint) return;
  if (!state.activeBlueprint.modules) state.activeBlueprint.modules = {};
  if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};

  const liveDemand = state.calculatedDemand || (state.activeBlueprint && state.activeBlueprint.baselineDemand) || {};

  const allWares = new Set([
    'EC',
    'TerEC',
    ...Object.keys(WARES_DB).filter(w => WARES_DB[w].level >= 1 && WARES_DB[w].level <= 3),
    ...Object.keys(liveDemand || {})
  ]);

  allWares.forEach(wId => {
    const ware = WARES_DB[wId];
    if (!ware) return;
    if (ware.level === 0 && wId !== 'EC' && wId !== 'TerEC') return;
    if (ware.level === 4) return;

    let optimum = 0;
    if (wId === 'EC' || wId === 'TerEC') {
      optimum = (liveDemand[wId] ? liveDemand[wId].modulesNeeded : 0) || 0;
    } else if (liveDemand[wId]) {
      optimum = liveDemand[wId].modulesNeeded || 0;
    }

    const currentPlan = (state.activeBlueprint.modules && state.activeBlueprint.modules[wId]) || 0;

    // If Plan value exceeds Needs value, do not update Plan value to Needs value (preserve higher Plan count)
    if (currentPlan > optimum) {
      return;
    }

    // Solar panels (EC and TerEC) installed in station blueprint are preserved and not overridden
    if (wId === 'EC' || wId === 'TerEC') {
      return;
    }

    // Raw scrap infrastructure (ScrapMetal, Processors) are preserved and not overridden by Match Needs
    if (wId === 'ScrapMetal' || wId === 'TerScrapMetal' || wId === 'ScrapProc' || wId === 'AllographyneScrapProc') {
      return;
    }

    if (wId === 'ScrapClaytronics' || wId === 'ScrapHullParts') {
      const macroKey = state.activeBlueprint.rawMacros['prod_gen_scraprecycler_macro'] !== undefined
        ? 'prod_gen_scraprecycler_macro'
        : 'prod_gen_scrap_recycler_macro';
      if (optimum > 0) {
        state.activeBlueprint.modules[wId] = optimum;
        state.activeBlueprint.modules['ScrapMetal'] = Math.max(state.activeBlueprint.modules['ScrapClaytronics'] || 0, state.activeBlueprint.modules['ScrapHullParts'] || 0);
        state.activeBlueprint.rawMacros[macroKey] = Math.max(state.activeBlueprint.rawMacros[macroKey] || 0, optimum);
        if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = Math.max(state.activeBlueprint.rootMacros[macroKey] || 0, optimum);
      } else {
        delete state.activeBlueprint.modules[wId];
        const otherId = wId === 'ScrapClaytronics' ? 'ScrapHullParts' : 'ScrapClaytronics';
        if (!state.activeBlueprint.modules[otherId]) {
          delete state.activeBlueprint.modules['ScrapMetal'];
          delete state.activeBlueprint.rawMacros[macroKey];
          if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
        } else {
          state.activeBlueprint.modules['ScrapMetal'] = state.activeBlueprint.modules[otherId];
        }
      }
      return;
    }

    if (wId === 'TerCompSubstrate' || wId === 'TerSilCarbide') {
      const hasStdMacro = (wId === 'TerCompSubstrate' && state.activeBlueprint.rawMacros['prod_ter_computronicsubstrate_macro'] !== undefined) ||
                          (wId === 'TerSilCarbide' && state.activeBlueprint.rawMacros['prod_ter_siliconcarbide_macro'] !== undefined);
      if (!hasStdMacro && (state.activeBlueprint.rawMacros['prod_ter_scraprecycler_macro'] !== undefined || state.activeBlueprint.rawMacros['prod_ter_scrap_recycler_macro'] !== undefined)) {
        const macroKey = state.activeBlueprint.rawMacros['prod_ter_scraprecycler_macro'] !== undefined
          ? 'prod_ter_scraprecycler_macro'
          : 'prod_ter_scrap_recycler_macro';
        if (optimum > 0) {
          state.activeBlueprint.modules[wId] = optimum;
          state.activeBlueprint.modules['TerScrapMetal'] = Math.max(state.activeBlueprint.modules['TerCompSubstrate'] || 0, state.activeBlueprint.modules['TerSilCarbide'] || 0);
          state.activeBlueprint.rawMacros[macroKey] = Math.max(state.activeBlueprint.rawMacros[macroKey] || 0, optimum);
          if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = Math.max(state.activeBlueprint.rootMacros[macroKey] || 0, optimum);
        } else {
          delete state.activeBlueprint.modules[wId];
          const otherId = wId === 'TerCompSubstrate' ? 'TerSilCarbide' : 'TerCompSubstrate';
          if (!state.activeBlueprint.modules[otherId]) {
            delete state.activeBlueprint.modules['TerScrapMetal'];
            delete state.activeBlueprint.rawMacros[macroKey];
            if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
          } else {
            state.activeBlueprint.modules['TerScrapMetal'] = state.activeBlueprint.modules[otherId];
          }
        }
        return;
      }
    }

    // Clean up all existing macros for this ware to prevent double counting
    const matchingMacros = Object.keys(state.activeBlueprint.rawMacros).filter(m => {
      const lower = m.toLowerCase();
      if (lower.includes('scraprecycler') || lower.includes('scrap_recycler')) return false;
      return mapMacroToWare(m) === wId;
    });
    matchingMacros.forEach(m => {
      delete state.activeBlueprint.rawMacros[m];
      if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[m];
    });

    // Determine primary macro name
    let primaryMacro = matchingMacros[0];
    if (wId === 'ScrapProc') {
      primaryMacro = getPrimaryMacroForWare('ScrapProc');
    } else if (!primaryMacro) {
      primaryMacro = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wId);
    }
    if (!primaryMacro) {
      primaryMacro = `prod_gen_${wId.toLowerCase()}_macro`;
    }

    if (optimum > 0) {
      state.activeBlueprint.modules[wId] = optimum;
      state.activeBlueprint.rawMacros[primaryMacro] = optimum;
      if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[primaryMacro] = optimum;
    } else {
      delete state.activeBlueprint.modules[wId];
    }
  });

  delete state.activeBlueprint.modules['RawScrap'];

  // Recalculate to determine the new EC demand with the newly matched L1-L3 production modules
  rebuildBlueprintFromMacros();
  calculateFactoryRequirements();

  // Increment the EC solar module count in Planned Modules by the needed EC count reflected in Plans vs Needs
  const liveLt = state.layerTotals || (state.activeBlueprint && state.activeBlueprint.baselineLayerTotals) || {};
  const terLoaded = (liveLt.inPlanTerSolarCount || 0) > 0;
  const genLoaded = (liveLt.inPlanSolarCount || 0) > 0;
  const isTerran = state.activeBlueprint && (isBlueprintTerran(state.activeBlueprint) || state.factionConstructionMethod === 'terran');
  const isPureTerranSolar = (terLoaded && !genLoaded) || (!terLoaded && !genLoaded && isTerran);

  if (isPureTerranSolar) {
    const needed = liveLt.terSolarModulesNeeded || 0;
    if (needed > 0) {
      let macroKey = Object.keys(state.activeBlueprint.rawMacros).find(m => mapMacroToWare(m) === 'TerEC');
      if (!macroKey) macroKey = 'prod_ter_energycells_macro';
      const currentQty = state.activeBlueprint.rawMacros[macroKey] || 0;
      const newQty = currentQty + needed;
      state.activeBlueprint.rawMacros[macroKey] = newQty;
      if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = newQty;
    }
  } else {
    const needed = liveLt.solarModulesNeeded || 0;
    if (needed > 0) {
      let macroKey = Object.keys(state.activeBlueprint.rawMacros).find(m => mapMacroToWare(m) === 'EC');
      if (!macroKey) macroKey = 'prod_gen_energycells_macro';
      const currentQty = state.activeBlueprint.rawMacros[macroKey] || 0;
      const newQty = currentQty + needed;
      state.activeBlueprint.rawMacros[macroKey] = newQty;
      if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = newQty;
    }
  }

  state.populateMatrix = true;
  rebuildBlueprintFromMacros();
  saveActiveBlueprintToStorage();
  calculateFactoryRequirements();

  if (typeof onRender === 'function') {
    onRender();
  }
}
