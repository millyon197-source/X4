// Everything one ware card in the matrix grid needs before its markup: plan counts, visibility (omitted / ghost / search),
// output and EC rates, the module badge and ownership. Extracted from renderMatrixTabHTML (Stage 4, step 12b).
// Only reads the state object it is given.
import { FACTION_WARE_MAP, NO_PP_WARES, WARES_DB, isBlueprintTerran, isTerranWare, mapMacroToWare } from '../../data/wares.js';
import { calculateLiveOutputRate } from '../../engine/calculator.js';
import { calculateSolarOutput, getSectorSunlight } from '../../data/sectors.js';
import { isMacroBlueprintOwned, isWareModuleOwned } from '../../engine/blueprintOwnership.js';
import { isFactionWarePresentIn } from './factionVisibility.js';
import { getProductionMacroForWare } from './wareHelpers.js';

export function computeWareCardView(state, id, { lt, ppDownstreamWares, selectedDownstreamWares }) {
  const ware = WARES_DB[id];
  const calc = state.calculatedDemand[id];
  const isGenEC = id === 'EC';
  const isTerEC = id === 'TerEC';
  const isEC = isGenEC || isTerEC;
  let inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[id]) || 0;
  if (isTerEC && inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
      if (mapMacroToWare(m) === 'TerEC') inPlanCount += count;
    });
  }
  if (isGenEC && inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
      if (mapMacroToWare(m) === 'EC') inPlanCount += count;
    });
  }
  if (inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
      const lower = m.toLowerCase();
      const isRecycler = (lower.includes('scraprecycler') || lower.includes('scrap_recycler')) && !lower.includes('khaak');
      if (isRecycler) {
        if (lower.includes('ter')) {
          if (id === 'TerCompSubstrate' || id === 'TerSilCarbide' || id === 'TerScrapMetal') inPlanCount += count;
        } else {
          if (id === 'ScrapHullParts' || id === 'ScrapClaytronics' || id === 'ScrapMetal') inPlanCount += count;
        }
      } else if (mapMacroToWare(m) === id) {
        inPlanCount += count;
      }
    });
  }
  const smInPlan = (state.activeBlueprint && state.activeBlueprint.modules && ((state.activeBlueprint.modules['ScrapMetal'] || 0) + (state.activeBlueprint.modules['TerScrapMetal'] || 0) + (state.activeBlueprint.modules['ScrapProc'] || 0))) || 0;
  const smCalc = state.calculatedDemand && (state.calculatedDemand['ScrapMetal'] || state.calculatedDemand['TerScrapMetal'] || state.calculatedDemand['ScrapProc']);
  const smOutputNonZero = smInPlan > 0 || (smCalc && (smCalc.rateNeeded > 0 || smCalc.modulesNeeded > 0)) || (state.selectedWareId === 'ScrapMetal' || state.selectedWareId === 'TerScrapMetal' || state.selectedWareId === 'ScrapProc' || state.selectedWareId === 'RawScrap');

  let calcNeeded = calc ? (calc.modulesNeeded || 0) : 0;
  let hasDemand = calc ? (calc.rateNeeded > 0 || calc.modulesNeeded > 0) : false;
  if ((id === 'ScrapHullParts' || id === 'ScrapClaytronics') && smOutputNonZero) {
    if (!state.activeBlueprint) {
      calcNeeded = Math.max(calcNeeded, 1);
    }
    hasDemand = true;
  }
  const isTerranBp = state.activeBlueprint ? isBlueprintTerran(state.activeBlueprint) : false;
  const isGenECOmitted = isGenEC && (
    (state.activeBlueprint && (
      (lt.inPlanTerSolarCount > 0 && inPlanCount === 0) ||
      (lt.inPlanSolarCount === 0 && lt.inPlanTerSolarCount === 0 && isTerranBp)
    )) ||
    (!state.activeBlueprint && Boolean(state.selectedWareId) && isTerranWare(state.selectedWareId))
  );
  const isTerECOmitted = isTerEC && (
    (state.activeBlueprint && (
      (lt.inPlanSolarCount > 0 && inPlanCount === 0) ||
      (lt.inPlanSolarCount === 0 && lt.inPlanTerSolarCount === 0 && !isTerranBp)
    )) ||
    (!state.activeBlueprint && (!state.selectedWareId || !isTerranWare(state.selectedWareId)))
  );
  const activeSector = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
  const sunlightVal = activeSector ? getSectorSunlight(activeSector) : (lt.sunlight || 100);
  const baseOutput = ware.baseRate || (isTerEC ? 3000 : 10500);
  const moduleMaxBonus = isTerEC ? 0.0 : 0.43;
  const solarPerMod = isEC 
    ? calculateSolarOutput(sunlightVal, state.workforceBonus, 1, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60)
    : 0;
  const solarModsNeeded = isTerEC ? (lt.terSolarModulesNeeded || 0) : (lt.solarModulesNeeded || 0);

  let isZeroCountOrInput = false;
  const hasAlloFrag = Boolean(state.activeBlueprint && (
    (state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneFragments'] > 0) ||
    (state.calculatedDemand && state.calculatedDemand['AllographyneFragments'] && state.calculatedDemand['AllographyneFragments'].modulesNeeded > 0)
  ));
  const isL4Associated = ware.level === 4 && Boolean(
    state.selectedWareId && (id === state.selectedWareId || (selectedDownstreamWares && selectedDownstreamWares.has(id)))
  );

  if (state.activeBlueprint) {
    if (ware.level === 0) {
      if (isEC) {
        isZeroCountOrInput = inPlanCount <= 0;
      } else {
        const rawRate = (calc && calc.rateNeeded > 0) ? calc.rateNeeded : 0;
        isZeroCountOrInput = (id === 'RawKhaakScrap' && hasAlloFrag) ? false : (rawRate <= 0);
      }
    } else if (ware.level === 4) {
      if (state.selectedWareId) {
        isZeroCountOrInput = !isL4Associated && (state.subdueZeroX ? inPlanCount <= 0 : false);
      } else {
        isZeroCountOrInput = state.subdueZeroX ? inPlanCount <= 0 : false;
      }
    } else {
      if (id === 'AllographyneScrapProc' && hasAlloFrag) {
        isZeroCountOrInput = false;
      } else {
        isZeroCountOrInput = inPlanCount <= 0;
      }
    }
  } else if (state.selectedWareId) {
    if (ware.level === 0) {
      if (isEC) {
        isZeroCountOrInput = id === state.selectedWareId ? false : (solarModsNeeded <= 0);
      } else {
        const rawRate = (calc && calc.rateNeeded > 0) ? calc.rateNeeded : 0;
        isZeroCountOrInput = id === state.selectedWareId ? false : (rawRate <= 0);
      }
    } else if (ware.level === 4) {
      isZeroCountOrInput = !isL4Associated;
    } else {
      const isTarget = id === state.selectedWareId;
      const count = (calc && calc.modulesNeeded > 0) ? calc.modulesNeeded : (isTarget ? 1 : 0);
      isZeroCountOrInput = count <= 0;
    }
  }

  const isFactionOmitted = !isFactionWarePresentIn(state, id, inPlanCount, hasDemand);
  const isOmitted = isGenECOmitted || isTerECOmitted || isFactionOmitted || isZeroCountOrInput;

  const rawQ = (state.searchQuery || '').trim().toLowerCase();
  const isNegatedQ = rawQ.startsWith('!');
  const searchQ = isNegatedQ ? rawQ.slice(1).trim() : rawQ;
  const isSearchActive = Boolean(searchQ);
  let isMatchedBySearch = false;
  if (isSearchActive) {
    const faction = FACTION_WARE_MAP[id];
    const wareName = (ware.name || '').toLowerCase();
    const wareCat = (ware.cat || '').toLowerCase();
    const factionName = (faction || '').toLowerCase();
    const catWords = wareCat ? wareCat.split(/[\s/()]+/) : [];
    const catMatches = catWords.some(w => w.startsWith(searchQ)) || (wareCat.includes(searchQ) && searchQ.includes(' '));
    const contains = wareName.includes(searchQ) || catMatches || factionName.includes(searchQ);
    isMatchedBySearch = isNegatedQ ? !contains : contains;
  }

  const hasCalc = state.activeBlueprint 
    ? (inPlanCount > 0 || hasDemand || (isEC && !isOmitted && lt.totalECNeeded > 0) || ware.level === 4 || !state.subdueZeroX) 
    : true;
  const isGhost = state.activeBlueprint ? (state.subdueZeroX && inPlanCount === 0 && !hasDemand && ware.level !== 4) : false;

  let initialDisplay = isOmitted ? 'display:none;' : '';
  let initialGhost = isGhost;
  if (isSearchActive) {
    if (isMatchedBySearch) {
      initialDisplay = '';
      initialGhost = false;
    } else {
      if (isOmitted) {
        initialDisplay = 'display:none;';
      } else {
        initialDisplay = '';
        initialGhost = true;
      }
    }
  }

  let activeCount = isEC 
    ? (state.activeBlueprint 
        ? inPlanCount 
        : (state.selectedWareId === id ? 1 : (solarModsNeeded > 0 ? solarModsNeeded : 1))) 
    : (state.activeBlueprint 
        ? (inPlanCount > 0 ? inPlanCount : ((id === 'AllographyneScrapProc' && hasAlloFrag) ? (calcNeeded > 0 ? calcNeeded : 1) : 0)) 
        : (calcNeeded > 0 ? calcNeeded : 1));

  let prodOutputRate = 0;
  let ecConsRate = 0;
  let totalCompUnits = 0;
  let rawRate = 0;
  if (hasCalc) {
    if (ware.level === 4) {
      totalCompUnits = ware.recipe ? Object.entries(ware.recipe).filter(([k]) => k !== 'EC').reduce((sum, [_, v]) => sum + v, 0) : 0;
    } else if (isEC) {
      prodOutputRate = calculateSolarOutput(sunlightVal, state.workforceBonus, activeCount, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60);
    } else if (ware.level > 0) {
      const baselineCalc = (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[id]) || (state.calculatedDemand && state.calculatedDemand[id]);
      const optimumRate = baselineCalc ? (baselineCalc.rateNeeded || 0) : 0;
      prodOutputRate = calculateLiveOutputRate(id, activeCount, optimumRate);
    } else if (ware.level === 0) {
      rawRate = (calc && calc.rateNeeded > 0) ? calc.rateNeeded : 0;
    }
    if (ware.level !== 4 && ware.recipe && ware.recipe['EC']) {
      ecConsRate = activeCount * ware.recipe['EC'];
    }
  }
  const isRecyclerProduct = NO_PP_WARES.has(id);
  const isL1toL3 = ware.level >= 1 && ware.level <= 3 && !isRecyclerProduct;
  const isPPChecked = isL1toL3 && Boolean(
    (state.activeBlueprint && state.activeBlueprint.ppStates && state.activeBlueprint.ppStates[id]) ||
    (!state.activeBlueprint && state.ppStates && state.ppStates[id])
  );
  const isOutputSuppressed = isPPChecked || ppDownstreamWares.has(id);
  if (isOutputSuppressed) {
    prodOutputRate = 0;
  }
  if (isRecyclerProduct || isPPChecked) {
    ecConsRate = 0;
  }
  if (id === 'ScrapProc') {
    ecConsRate = state.scrapMetalEc ? state.scrapMetalEc.processorEc : (activeCount * 90000);
  } else if (id === 'ScrapMetal') {
    ecConsRate = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : 0;
  } else if (id === 'TerScrapMetal') {
    const hasGenSm = Boolean(state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapMetal']);
    if (!hasGenSm && state.scrapMetalEc && state.scrapMetalEc.totalDemand > 0) {
      ecConsRate = state.scrapMetalEc.totalDemand;
    } else {
      ecConsRate = 0;
    }
  }
  const hasEcBadge = hasCalc && !isEC && !state.subdueEcCalc && ecConsRate > 0;
  const hasSolarBadge = hasCalc && isEC;
  const prodMacro = getProductionMacroForWare(id);
  const showBottomPanel = hasSolarBadge || hasEcBadge || isL1toL3 || Boolean(prodMacro);

  const isScrapSubsetCard = id === 'ScrapMetal' || id === 'TerScrapMetal';

  const isL2orL3 = (ware.level === 2 || ware.level === 3);
  const customOutVal = (state.customOutputs && state.customOutputs[id] !== undefined && state.customOutputs[id] !== null && state.customOutputs[id] !== '')
    ? Number(state.customOutputs[id])
    : undefined;
  const hasCustomOut = customOutVal !== undefined;
  const displayOutRate = hasCustomOut ? customOutVal : Math.round(prodOutputRate);

  let moduleBadgeText = `${activeCount}x Modules`;
  let moduleBadgeStyle = '';
  let moduleBadgeTitle = '';

  if (ware.level === 4) {
    moduleBadgeText = ware.cat || 'Application';
    moduleBadgeStyle = 'background:rgba(167,139,250,0.15); color:#a78bfa; border-color:rgba(167,139,250,0.3);';
  } else if (ware.level > 0) {
    if (state.activeBlueprint) {
      const isDeficit = calcNeeded > inPlanCount;
      const isExceeded = inPlanCount > calcNeeded && calcNeeded > 0;
      if (isDeficit) {
        moduleBadgeText = `${inPlanCount}x Plan / ${calcNeeded}x Needs`;
        moduleBadgeStyle = 'background:rgba(239,68,68,0.2); color:#f87171; border-color:rgba(239,68,68,0.4); font-weight:700;';
        moduleBadgeTitle = `Deficit: ${inPlanCount}x in plan does not satisfy downstream demand. Needs ${calcNeeded}x modules.`;
      } else if (isExceeded) {
        moduleBadgeText = `${inPlanCount}x Plan / ${calcNeeded}x Needs*`;
        moduleBadgeStyle = 'background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3);';
        moduleBadgeTitle = `Surplus: ${inPlanCount}x in plan exceeds needed ${calcNeeded}x modules.`;
      } else if (inPlanCount > 0 && calcNeeded === inPlanCount) {
        moduleBadgeText = `${inPlanCount}x Plan / ${calcNeeded}x Needs`;
        moduleBadgeStyle = 'background:rgba(52,211,153,0.15); color:#34d399; border-color:rgba(52,211,153,0.3);';
        moduleBadgeTitle = `Satisfied: ${inPlanCount}x in plan matches ${calcNeeded}x needs.`;
      } else if (inPlanCount > 0) {
        moduleBadgeText = `${inPlanCount}x Modules`;
      } else if (calcNeeded > 0) {
        moduleBadgeText = `${calcNeeded}x Needs`;
        moduleBadgeStyle = 'background:rgba(245,158,11,0.2); color:#fbbf24; border-color:rgba(245,158,11,0.4); font-weight:700;';
        moduleBadgeTitle = `0x in plan. Needs ${calcNeeded}x modules to satisfy demand.`;
      } else {
        moduleBadgeText = `0x Modules`;
      }
    } else {
      if (calcNeeded > 0) {
        moduleBadgeText = `${calcNeeded}x Needs`;
        moduleBadgeStyle = 'background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3);';
      } else {
        moduleBadgeText = `${activeCount}x Modules`;
      }
    }
  } else {
    moduleBadgeText = (id === 'RawScrap' || id === 'RawKhaakScrap') ? 'Scrap' : 'Mining';
  }

  const plannedMacrosForWare = Object.entries(state.activeBlueprint?.rawMacros || {})
    .filter(([m, qty]) => qty > 0 && mapMacroToWare(m) === id);

  let isUnowned = false;
  if (plannedMacrosForWare.length > 0) {
    isUnowned = state.serverModules
      ? plannedMacrosForWare.some(([m]) => !isMacroBlueprintOwned(m, state.serverModules))
      : false;
  } else {
    const ownership = isWareModuleOwned(id, state.serverModules, {
      factionMethod: state.factionConstructionMethod
    });
    isUnowned = Boolean(ownership.hasModule && !ownership.isOwned);
  }
  return { ware, calc, isTerEC, isEC, inPlanCount, sunlightVal, solarPerMod, solarModsNeeded, isOmitted, hasCalc, initialDisplay, initialGhost, activeCount, prodOutputRate, ecConsRate, totalCompUnits, rawRate, isL1toL3, isPPChecked, hasEcBadge, prodMacro, showBottomPanel, isScrapSubsetCard, isL2orL3, hasCustomOut, displayOutRate, moduleBadgeText, moduleBadgeStyle, moduleBadgeTitle, plannedMacrosForWare, isUnowned };
}
