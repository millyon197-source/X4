// Data calculations for the single-ware inspector, extracted from renderWareInspector (Stage 4, step 10b).
// Each function only reads the state object it is given.
import { DEPENDENCIES, NO_PP_WARES, WARES_DB, getWareHourlyRatePerModule } from '../../data/wares.js';
import { calculateLiveOutputRate, calculateScrapMetalRawScrapDemand, getPPDownstreamWares } from '../../engine/calculator.js';
import { calculateSolarOutput, getSectorSunlight } from '../../data/sectors.js';

// Upstream requirements strictly for the selected card and its direct/upstream recipe inputs down to Level 0.
// Returns what the inspector shows for the selected ware: the demand map, total raw extraction and EC demand.
export function computeWareUpstreamDemand(state, id, ware, effectiveCount) {
  const activeDemand = {};
  const sQueue = [];

  if (ware.level === 4) {
    if (ware.recipe) {
      Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
        const reqQty = inpQty * effectiveCount;
        activeDemand[inpId] = { rateNeeded: reqQty, modulesNeeded: 0 };
        const inpW = WARES_DB[inpId];
        if (inpW && inpW.level > 0) {
          activeDemand[inpId].modulesNeeded = Math.ceil(reqQty / getWareHourlyRatePerModule(inpId, state.workforceBonus));
        }
        sQueue.push({ id: inpId, requiredRate: reqQty });
      });
    }
  } else if (ware.level > 0) {
    const targetOut = (id === 'ScrapHullParts' || id === 'ScrapClaytronics')
      ? calculateLiveOutputRate(id, effectiveCount, 0)
      : (effectiveCount * getWareHourlyRatePerModule(id, state.workforceBonus));
    activeDemand[id] = { rateNeeded: targetOut, modulesNeeded: effectiveCount };

    if (id === 'ScrapProc') {
      const scrapRaw = state.scrapRawDemand || calculateScrapMetalRawScrapDemand();
      const smTotalDemand = scrapRaw ? ((scrapRaw.genRawScrapDemand || 0) + (scrapRaw.terRawScrapDemand || 0)) : 0;
      if (smTotalDemand > 0 && !state.inspectorSingle) {
        const procBaseRate = (WARES_DB['ScrapProc'] && WARES_DB['ScrapProc'].baseRate) || 9000;
        const procNeeds = Math.ceil(smTotalDemand / procBaseRate);
        activeDemand['ScrapProc'] = {
          rateNeeded: smTotalDemand,
          modulesNeeded: procNeeds
        };
      }
    }

    if (ware.recipe) {
      Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
        let inpRate = effectiveCount * inpQty;
        if ((id === 'ScrapMetal' || id === 'TerScrapMetal') && inpId === 'EC') {
          inpRate = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : inpRate;
        }
        if (id === 'ScrapProc' && inpId === 'EC') {
          inpRate = state.scrapMetalEc ? state.scrapMetalEc.processorEc : inpRate;
        }
        if (id === 'ScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          inpRate = state.scrapRawDemand ? state.scrapRawDemand.genRawScrapDemand : inpRate;
        }
        if (id === 'TerScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          inpRate = state.scrapRawDemand ? state.scrapRawDemand.terRawScrapDemand : inpRate;
        }
        if (id === 'ScrapProc' && inpId === 'RawScrap') {
          inpRate = state.scrapRawDemand ? state.scrapRawDemand.totalRawScrapDemand : inpRate;
        }
        if (NO_PP_WARES.has(id) && inpId === 'EC') {
          return;
        }
        activeDemand[inpId] = { rateNeeded: inpRate, modulesNeeded: 0 };
        const inpW = WARES_DB[inpId];
        if (inpW && inpW.level > 0) {
          activeDemand[inpId].modulesNeeded = Math.ceil(inpRate / getWareHourlyRatePerModule(inpId, state.workforceBonus));
        }
        sQueue.push({ id: inpId, requiredRate: inpRate });
      });
    }
  } else if (ware.level === 0) {
    let rawRateNeeded = (state.calculatedDemand[id] && state.calculatedDemand[id].rateNeeded > 0) ? state.calculatedDemand[id].rateNeeded : (ware.baseRate || 1);
    if (id === 'RawScrap') {
      const scrapRaw = state.scrapRawDemand || calculateScrapMetalRawScrapDemand();
      if (scrapRaw && scrapRaw.convertedPerHr > 0) {
        rawRateNeeded = scrapRaw.convertedPerHr;
      }
    } else if (id === 'EC' || id === 'TerEC') {
      const isTer = id === 'TerEC';
      const baseOutput = ware.baseRate || (isTer ? 3000 : 10500);
      const moduleMaxBonus = isTer ? 0.0 : 0.43;
      const activeSector = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
      const sunlightVal = activeSector ? getSectorSunlight(activeSector) : 100;
      rawRateNeeded = calculateSolarOutput(sunlightVal, state.workforceBonus, effectiveCount, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60);
    }
    activeDemand[id] = { rateNeeded: rawRateNeeded, modulesNeeded: effectiveCount };
  }

  while (sQueue.length > 0) {
    const { id: currId, requiredRate } = sQueue.shift();
    const currWare = WARES_DB[currId];
    if (currWare && currWare.recipe && currWare.level > 0) {
      const currModRate = (currId === 'ScrapHullParts' || currId === 'ScrapClaytronics')
        ? calculateLiveOutputRate(currId, 1, 0)
        : getWareHourlyRatePerModule(currId, state.workforceBonus);
      Object.entries(currWare.recipe).forEach(([inpId, inpQty]) => {
        if (NO_PP_WARES.has(currId) && inpId === 'EC') {
          return;
        }
        const ratePerUnit = inpQty / currModRate;
        let totalInputRateNeeded = requiredRate * ratePerUnit;
        if ((currId === 'ScrapMetal' || currId === 'TerScrapMetal') && inpId === 'EC') {
          totalInputRateNeeded = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : totalInputRateNeeded;
        }
        if (currId === 'ScrapProc' && inpId === 'EC') {
          totalInputRateNeeded = state.scrapMetalEc ? state.scrapMetalEc.processorEc : totalInputRateNeeded;
        }
        if (currId === 'ScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          totalInputRateNeeded = state.scrapRawDemand ? state.scrapRawDemand.genRawScrapDemand : totalInputRateNeeded;
        }
        if (currId === 'TerScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          totalInputRateNeeded = state.scrapRawDemand ? state.scrapRawDemand.terRawScrapDemand : totalInputRateNeeded;
        }
        if (currId === 'ScrapProc' && inpId === 'RawScrap') {
          totalInputRateNeeded = state.scrapRawDemand ? state.scrapRawDemand.totalRawScrapDemand : totalInputRateNeeded;
        }

        if (!activeDemand[inpId]) {
          activeDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
        }
        activeDemand[inpId].rateNeeded += totalInputRateNeeded;

        const inputWare = WARES_DB[inpId];
        if (inputWare && inputWare.level > 0) {
          activeDemand[inpId].modulesNeeded = Math.ceil(activeDemand[inpId].rateNeeded / getWareHourlyRatePerModule(inpId, state.workforceBonus));
        }
        sQueue.push({ id: inpId, requiredRate: totalInputRateNeeded });
      });
    }
  }

  const rawList = [
    { name: 'Ore', rate: activeDemand['Ore'] ? activeDemand['Ore'].rateNeeded : 0 },
    { name: 'Silicon', rate: activeDemand['Silicon'] ? activeDemand['Silicon'].rateNeeded : 0 },
    { name: 'Methane', rate: activeDemand['Methane'] ? activeDemand['Methane'].rateNeeded : 0 },
    { name: 'Hydrogen', rate: activeDemand['Hydrogen'] ? activeDemand['Hydrogen'].rateNeeded : 0 },
    { name: 'Helium', rate: activeDemand['Helium'] ? activeDemand['Helium'].rateNeeded : 0 },
    { name: 'Ice', rate: activeDemand['Ice'] ? activeDemand['Ice'].rateNeeded : 0, color: '#38bdf8' },
    { name: 'Raw Scrap Fragments', rate: activeDemand['RawScrap'] ? activeDemand['RawScrap'].rateNeeded : 0, color: '#34d399' },
    { name: 'Raw Kha\'ak Salvage', rate: activeDemand['RawKhaakScrap'] ? activeDemand['RawKhaakScrap'].rateNeeded : 0, color: '#c084fc' },
    { name: 'Protectyon (Condensate)', rate: activeDemand['Protectyon'] ? activeDemand['Protectyon'].rateNeeded : 0, color: '#f472b6' }
  ];

  const activeRawList = rawList.filter(item => item.rate > 0);
  const totalRaw = activeRawList.reduce((sum, item) => sum + item.rate, 0);
  const ecTotal = activeDemand['EC'] ? activeDemand['EC'].rateNeeded : 0;
  return { activeDemand, totalRaw, ecTotal };
}

// Downstream (Level+1)-L4 components that take the selected ware as an input, with how much of it each consumes
// in the active blueprint and at the calculated optimum. Also reports whether this ware's own output is suppressed.
export function computeWareConsumers(state, id, ware) {
  // Compute Output Consumers for the selected ware (downstream (Level+1)–L3 components that require this ware in their recipe)
  const minConsumerLevel = (ware.level !== undefined ? ware.level : 0) + 1;
  const consumers = [];
  let totalBpConsumption = 0;
  let totalOptimumConsumption = 0;

  const ppDownstreamWares = getPPDownstreamWares();
  const isPPCheckedForInspector = (ware.level >= 1 && ware.level <= 3 && !NO_PP_WARES.has(id)) && Boolean(
    (state.activeBlueprint && state.activeBlueprint.ppStates && state.activeBlueprint.ppStates[id]) ||
    (!state.activeBlueprint && state.ppStates && state.ppStates[id])
  );
  const isInspectorOutputSuppressed = isPPCheckedForInspector || ppDownstreamWares.has(id);

  Object.entries(WARES_DB).forEach(([cId, cWare]) => {
    const isDirectRecipeInput = cWare.recipe && (
      (cWare.recipe[id] !== undefined && cWare.recipe[id] > 0) ||
      (id === 'TerEC' && cWare.recipe['EC'] !== undefined && cWare.recipe['EC'] > 0)
    );
    const isTelPartsAlternative = (id === 'TelParts') && cWare.recipe && cWare.recipe['HullParts'] !== undefined && cWare.recipe['HullParts'] > 0;
    const isScrapPartsAlternative = (id === 'ScrapHullParts') && cWare.recipe && cWare.recipe['HullParts'] !== undefined && cWare.recipe['HullParts'] > 0;
    const isScrapClaytronicsAlternative = (id === 'ScrapClaytronics') && cWare.recipe && cWare.recipe['Claytronics'] !== undefined && cWare.recipe['Claytronics'] > 0;
    const isTelArrayAlternative = (id === 'TelArray') && cWare.recipe && cWare.recipe['ScanArray'] !== undefined && cWare.recipe['ScanArray'] > 0;
    const isTelEngPartsAlternative = (id === 'TelEngParts') && cWare.recipe && cWare.recipe['EngParts'] !== undefined && cWare.recipe['EngParts'] > 0;
    const isTelAdvCompAlternative = (id === 'TelAdvComp') && cWare.recipe && cWare.recipe['AdvComp'] !== undefined && cWare.recipe['AdvComp'] > 0;
    const isMedicalAlternative = id.endsWith('MedicalSupplies') && cWare.recipe && cWare.recipe['MedicalSupplies'] !== undefined && cWare.recipe['MedicalSupplies'] > 0;
    const isSilCarbideAlternative = (id === 'SilCarbide') && cWare.recipe && cWare.recipe['TerSilCarbide'] !== undefined && cWare.recipe['TerSilCarbide'] > 0;
    const isExplicitDep = DEPENDENCIES.some(d => d.from === id && d.to === cId);

    if (cId !== id && cWare.level >= ((id === 'ScrapMetal' || id === 'TerScrapMetal' || id === 'ScrapProc') ? 1 : minConsumerLevel) && cWare.level <= 4 && (isDirectRecipeInput || isTelPartsAlternative || isScrapPartsAlternative || isScrapClaytronicsAlternative || isTelArrayAlternative || isTelEngPartsAlternative || isTelAdvCompAlternative || isMedicalAlternative || isSilCarbideAlternative || isExplicitDep)) {
      if ((id === 'EC' || id === 'TerEC') && NO_PP_WARES.has(cId)) {
        return;
      }
      if ((id === 'EC' || id === 'TerEC') && cId === 'TerScrapMetal' && state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapMetal']) {
        return;
      }

      let baseInputQty = 0;
      if (isDirectRecipeInput) {
        baseInputQty = (id === 'TerEC') ? cWare.recipe['EC'] : cWare.recipe[id];
      } else if (isTelPartsAlternative || isScrapPartsAlternative) {
        baseInputQty = cWare.recipe['HullParts'];
      } else if (isScrapClaytronicsAlternative) {
        baseInputQty = cWare.recipe['Claytronics'];
      } else if (isTelArrayAlternative) {
        baseInputQty = cWare.recipe['ScanArray'];
      } else if (isTelEngPartsAlternative) {
        baseInputQty = cWare.recipe['EngParts'];
      } else if (isTelAdvCompAlternative) {
        baseInputQty = cWare.recipe['AdvComp'];
      } else if (isMedicalAlternative) {
        baseInputQty = cWare.recipe['MedicalSupplies'];
      } else if (isSilCarbideAlternative) {
        baseInputQty = cWare.recipe['TerSilCarbide'];
      } else if (cWare.recipe && cWare.recipe[id]) {
        baseInputQty = cWare.recipe[id];
      } else {
        baseInputQty = 1;
      }

      let inputPerMod = baseInputQty;
      let cInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[cId]) || 0;
      let cCalc = state.calculatedDemand[cId] ? (state.calculatedDemand[cId].modulesNeeded || 0) : 0;

      const smInPlan = (state.activeBlueprint && state.activeBlueprint.modules && ((state.activeBlueprint.modules['ScrapMetal'] || 0) + (state.activeBlueprint.modules['TerScrapMetal'] || 0) + (state.activeBlueprint.modules['ScrapProc'] || 0))) || 0;
      const smCalc = state.calculatedDemand && (state.calculatedDemand['ScrapMetal'] || state.calculatedDemand['TerScrapMetal'] || state.calculatedDemand['ScrapProc']);
      const smOutputNonZero = smInPlan > 0 || (smCalc && (smCalc.rateNeeded > 0 || smCalc.modulesNeeded > 0)) || (state.selectedWareId === 'ScrapMetal' || state.selectedWareId === 'TerScrapMetal' || state.selectedWareId === 'ScrapProc' || state.selectedWareId === 'RawScrap');

      if (cId === 'ScrapClaytronics' && smOutputNonZero && !state.activeBlueprint) {
        cCalc = Math.max(cCalc, 1);
      }

      const isL4Consumer = cWare.level === 4;
      let bpConsumption = isL4Consumer ? 0 : cInPlan * inputPerMod;
      let optConsumption = isL4Consumer ? 0 : cCalc * inputPerMod;

      if (!isL4Consumer) {
        if ((id === 'EC' || id === 'TerEC') && (cId === 'ScrapMetal' || cId === 'TerScrapMetal') && state.scrapMetalEc && state.scrapMetalEc.totalDemand > 0) {
          inputPerMod = state.scrapMetalEc.totalDemand;
          bpConsumption = state.scrapMetalEc.totalDemand;
          optConsumption = state.scrapMetalEc.totalDemand;
        }

        if (id === 'RawScrap' && cId === 'ScrapProc') {
          inputPerMod = 9000;
          bpConsumption = (cInPlan > 0 ? cInPlan : 1) * 9000;
          optConsumption = 9000;
        }

        if (id === 'ScrapProc') {
          if (cId === 'ScrapMetal' && state.scrapRawDemand) {
            inputPerMod = state.scrapRawDemand.genRecyclers > 0 ? Math.round(state.scrapRawDemand.genRawScrapDemand / state.scrapRawDemand.genRecyclers) : 2250;
            bpConsumption = state.scrapRawDemand.genRawScrapDemand;
            optConsumption = state.scrapRawDemand.genRawScrapDemand;
          } else if (cId === 'TerScrapMetal' && state.scrapRawDemand) {
            inputPerMod = state.scrapRawDemand.terRecyclers > 0 ? Math.round(state.scrapRawDemand.terRawScrapDemand / state.scrapRawDemand.terRecyclers) : 7500;
            bpConsumption = state.scrapRawDemand.terRawScrapDemand;
            optConsumption = state.scrapRawDemand.terRawScrapDemand;
          }
        }

        const isConsumerSuppressed = isInspectorOutputSuppressed || ppDownstreamWares.has(cId) || (
          (cWare.level >= 1 && cWare.level <= 3 && !NO_PP_WARES.has(cId)) && Boolean(
            (state.activeBlueprint && state.activeBlueprint.ppStates && state.activeBlueprint.ppStates[cId]) ||
            (!state.activeBlueprint && state.ppStates && state.ppStates[cId])
          )
        );

        if (isConsumerSuppressed) {
          bpConsumption = 0;
          optConsumption = 0;
        }

        totalBpConsumption += bpConsumption;
        totalOptimumConsumption += optConsumption;
      }

      consumers.push({
        id: cId,
        ware: cWare,
        inputPerMod,
        inPlan: cInPlan,
        calcNeeded: cCalc,
        bpConsumption,
        optConsumption
      });
    }
  });

  // Sort consumers: active in blueprint first, then by level, then alphabetically
  consumers.sort((a, b) => {
    if (state.activeBlueprint) {
      if ((a.inPlan > 0) !== (b.inPlan > 0)) {
        return a.inPlan > 0 ? -1 : 1;
      }
    }
    if (a.ware.level !== b.ware.level) return a.ware.level - b.ware.level;
    return a.ware.name.localeCompare(b.ware.name);
  });
  return { consumers, totalBpConsumption, totalOptimumConsumption, isInspectorOutputSuppressed };
}

// What the selected ware currently produces (EC from solar panels, scrap from recyclers, everything else from modules in
// the plan), its net balance against blueprint consumption, and the level range its consumers span.
export function computeWareProduction(state, id, ware, inPlanCount, totalBpConsumption, isInspectorOutputSuppressed) {
  const isGenEC = id === 'EC';
  const isTerEC = id === 'TerEC';
  const isEC = isGenEC || isTerEC;
  const lt = state.layerTotals || {};
  const ecPerMod = isTerEC 
    ? (lt.terSolarOutputPerPanel || (WARES_DB['TerEC'] ? WARES_DB['TerEC'].baseRate : 3000)) 
    : (lt.solarOutputPerPanel || (WARES_DB['EC'] ? WARES_DB['EC'].baseRate : 10500));
  const ecNeeded = isTerEC ? (lt.terSolarModulesNeeded || 0) : (lt.solarModulesNeeded || 0);
  let currentProd = isEC 
    ? (state.activeBlueprint ? (inPlanCount * ecPerMod) : (ecNeeded * ecPerMod))
    : (id === 'ScrapProc'
      ? (inPlanCount * 9000)
      : (id === 'ScrapHullParts' || id === 'ScrapClaytronics'
        ? calculateLiveOutputRate(id, inPlanCount, 0)
        : (inPlanCount * getWareHourlyRatePerModule(id, state.workforceBonus))));
  if (isInspectorOutputSuppressed) {
    currentProd = 0;
  }

  const netBpBalance = currentProd - totalBpConsumption;

  const nextLvl = (ware.level !== undefined ? ware.level : 0) + 1;
  let rangeTag = '';
  if (id === 'ScrapMetal' || id === 'TerScrapMetal' || id === 'ScrapProc') {
    rangeTag = '(L1–L4)';
  } else if (ware.level === 4) {
    rangeTag = '(End Application)';
  } else if (ware.level === 3) {
    rangeTag = '(L4 Applications)';
  } else if (nextLvl === 1) {
    rangeTag = '(L1–L4)';
  } else if (nextLvl === 2) {
    rangeTag = '(L2–L4)';
  } else if (nextLvl === 3) {
    rangeTag = '(L3–L4)';
  }
  return { currentProd, netBpBalance, rangeTag };
}
