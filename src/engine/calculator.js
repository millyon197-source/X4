import { WARES_DB, DEPENDENCIES, PRESET_BLUEPRINTS, getWareHourlyRatePerModule, getWareCycleYield, mapMacroToWare, MACRO_TO_WARE, isTerranWare, isBlueprintTerran, NO_PP_WARES } from '../data/wares.js';
import { state, saveActiveBlueprintToStorage } from '../state/store.js';
import { getSectorSunlight, calculateSolarOutput } from '../data/sectors.js';
import { calculateBlueprintWorkforce, calculateRequiredWorkforce, calculateWorkforceEfficiency } from './workforce.js';
import { accumulateRawMiningRates, calculateScrapMetalEcDemand, calculateScrapMetalRawScrapDemand, calculateMiningRequirements, calculateSolarOutput as calculateSolarYield, RAW_MINERAL_WARES } from './mining.js';

export { calculateBlueprintWorkforce, calculateRequiredWorkforce, calculateWorkforceEfficiency };
export { accumulateRawMiningRates, calculateScrapMetalEcDemand, calculateScrapMetalRawScrapDemand, calculateMiningRequirements, RAW_MINERAL_WARES };
export { WARE_PRICES, getWareUnitPrice } from './prices.js';
export { calculateBuildCosts } from './buildCost.js';

export function getPPDownstreamWares() {
  const suppressedSet = new Set();
  
  const isDirectlyChecked = (id) => {
    const ware = WARES_DB[id];
    if (!ware || ware.level < 1 || ware.level > 3) return false;
    if (state.activeBlueprint && state.activeBlueprint.ppStates) {
      return Boolean(state.activeBlueprint.ppStates[id]);
    }
    return Boolean(state.ppStates && state.ppStates[id]);
  };

  const checkedWares = Object.keys(WARES_DB).filter(isDirectlyChecked);

  function traverseDown(currId) {
    const directConsumers = new Set();
    DEPENDENCIES.filter(d => d.from === currId).forEach(d => directConsumers.add(d.to));
    Object.entries(WARES_DB).forEach(([toId, toWare]) => {
      if (toWare.recipe && toWare.recipe[currId]) {
        directConsumers.add(toId);
      }
    });

    const fromWare = WARES_DB[currId];
    directConsumers.forEach(toId => {
      const toWare = WARES_DB[toId];
      if (toWare && fromWare && toId !== currId && (toWare.level > fromWare.level || (toWare.level === fromWare.level && (currId === 'ScrapMetal' || currId === 'TerScrapMetal')))) {
        if (!suppressedSet.has(toId)) {
          suppressedSet.add(toId);
          traverseDown(toId);
        }
      }
    });
  }

  checkedWares.forEach(id => {
    traverseDown(id);
  });

  return suppressedSet;
}

export function getFactionModuleCountForWare(wareId) {
  if (!state.activeBlueprint) return 0;
  
  const rawMacros = state.activeBlueprint.rawMacros || {};
  let factionCount = 0;

  Object.entries(rawMacros).forEach(([macro, count]) => {
    if (count <= 0) return;
    const mapped = mapMacroToWare(macro);
    if (mapped === wareId) {
      const lower = macro.toLowerCase();
      const isFactionMacro = lower.startsWith('prod_arg_') ||
                            lower.startsWith('prod_tel_') ||
                            lower.startsWith('prod_par_') ||
                            lower.startsWith('prod_split_') ||
                            lower.startsWith('prod_spl_') ||
                            lower.startsWith('prod_bor_') ||
                            lower.startsWith('prod_ter_') ||
                            lower.startsWith('prod_ava_') ||
                            lower.startsWith('buildmodule_arg_') ||
                            lower.startsWith('buildmodule_tel_') ||
                            lower.startsWith('buildmodule_par_') ||
                            lower.startsWith('buildmodule_split_') ||
                            lower.startsWith('buildmodule_bor_') ||
                            lower.startsWith('buildmodule_ter_');

      const isFactionWare = ['FoodRations', 'Meat', 'Wheat', 'Spacefuel', 
                             'NostropOil', 'SunriseFlowers', 'SwampPlant', 'Spaceweed',
                             'TelMet', 'TelParts', 'TelArray', 'TelEngParts', 'TelAdvComp',
                             'SojaHusk', 'SojaBeans', 'MajaSnails', 'MajaDust',
                              'BoFu', 'BoGas', 'Plankton',
                             'TerranMRE', 'TerMedicalSupplies', 'ProtPaste', 'Stimulants',
                             'ScruffinFruit', 'MetMicrolatt', 'TerMetMicrolatt', 'CompSubstrate', 'TerCompSubstrate', 'SilCarbide', 'TerSilCarbide'].includes(wareId);

      if (isFactionMacro || isFactionWare) {
        factionCount += count;
      }
    }
  });

  const inPlan = (state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
  if (factionCount === 0 && inPlan > 0) {
    const isFactionWare = ['FoodRations', 'Meat', 'Wheat', 'Spacefuel', 
                           'NostropOil', 'SunriseFlowers', 'SwampPlant', 'Spaceweed',
                           'TelMet', 'TelParts', 'TelArray', 'TelEngParts', 'TelAdvComp',
                           'SojaHusk', 'SojaBeans', 'MajaSnails', 'MajaDust',
                           'BoFu', 'BoGas', 'Plankton',
                           'TerranMRE', 'TerMedicalSupplies', 'ProtPaste', 'Stimulants',
                           'ScruffinFruit', 'MetMicrolatt', 'TerMetMicrolatt', 'CompSubstrate', 'TerCompSubstrate', 'SilCarbide', 'TerSilCarbide'].includes(wareId);
    if (isFactionWare) factionCount = inPlan;
  }

  return Math.min(factionCount, inPlan);
}

export function getScrapRecyclerCycleYield(wareId, workforceBonus = 0) {
  const wf = typeof workforceBonus === 'number' ? workforceBonus : 0;
  if (wareId === 'ScrapHullParts') {
    const baseBatch = 200;
    const maxWf = 0.33;
    const gained = (wf / 100) * maxWf;
    const yieldPerCycle = baseBatch + Math.floor(baseBatch * gained);
    return { baseBatch, yieldPerCycle, cyclesPerHr: 6, maxWf };
  }
  if (wareId === 'ScrapClaytronics') {
    const baseBatch = 60;
    const maxWf = 0.318;
    const gained = (wf / 100) * maxWf;
    const yieldPerCycle = baseBatch + Math.floor(baseBatch * gained);
    return { baseBatch, yieldPerCycle, cyclesPerHr: 6, maxWf };
  }
  return null;
}

export function calculateLiveOutputRate(wareId, inPlanCount, optimumRate) {
  const ware = WARES_DB[wareId];
  if (!ware) return 0;

  if (wareId === 'ScrapProc') {
    return inPlanCount * 9000;
  }
  if (wareId === 'ScrapMetal') {
    const scrapRaw = state.scrapRawDemand || calculateScrapMetalRawScrapDemand();
    if (scrapRaw && (scrapRaw.genRecyclers > 0 || scrapRaw.genHullMods > 0 || scrapRaw.genClayMods > 0)) {
      return scrapRaw.genRawScrapDemand;
    }
  }
  if (wareId === 'TerScrapMetal') {
    const scrapRaw = state.scrapRawDemand || calculateScrapMetalRawScrapDemand();
    if (scrapRaw && (scrapRaw.terRecyclers > 0 || scrapRaw.terCompMods > 0 || scrapRaw.terCarbMods > 0)) {
      return scrapRaw.terRawScrapDemand;
    }
  }
  if (wareId === 'ScrapHullParts' || wareId === 'ScrapClaytronics') {
    const scrapYield = getScrapRecyclerCycleYield(wareId, state.workforceBonus);
    if (scrapYield) {
      return Math.floor(inPlanCount * scrapYield.yieldPerCycle * scrapYield.cyclesPerHr);
    }
  }
  if (wareId === 'EC' || wareId === 'TerEC') {
    const isTer = wareId === 'TerEC';
    const baseOutput = ware.baseRate || (isTer ? 3000 : 10500);
    const moduleMaxBonus = isTer ? 0.0 : 0.43;
    const activeSector = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
    return calculateSolarOutput(activeSector || 100, state.workforceBonus, inPlanCount, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60);
  }

  const hourlyPerMod = getWareHourlyRatePerModule(wareId, state.workforceBonus);
  return inPlanCount * hourlyPerMod;
}

export function computeLayerTotals() {
  // Determine the active sector where the blueprint or factory is located
  let activeSector = state.selectedSector;
  if (!activeSector && state.activeBlueprint && state.activeBlueprint.sector) {
    activeSector = state.activeBlueprint.sector;
  }

  const sectorSunlight = activeSector ? getSectorSunlight(activeSector) : 100;
  const ecWare = WARES_DB['EC'];
  const ecBaseRate = (ecWare && typeof ecWare.baseRate === 'number') ? ecWare.baseRate : 10500;
  const ecSolarPerModule = calculateSolarOutput(sectorSunlight, state.workforceBonus, 1, ecBaseRate, 0.43);

  const terEcWare = WARES_DB['TerEC'];
  const terEcBaseRate = (terEcWare && typeof terEcWare.baseRate === 'number') ? terEcWare.baseRate : 3000;
  const terSolarPerModule = calculateSolarOutput(sectorSunlight, state.workforceBonus, 1, terEcBaseRate, 0.0);

  const totals = {
    L1: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L2: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L3: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    sector: activeSector || null,
    sunlight: sectorSunlight,
    solarOutputPerPanel: ecSolarPerModule,
    terSolarOutputPerPanel: terSolarPerModule,
    totalECNeeded: 0,
    solarModulesNeeded: 0,
    terSolarModulesNeeded: 0
  };

  const ppDownstreamWares = getPPDownstreamWares();

  Object.entries(state.calculatedDemand).forEach(([wareId, calc]) => {
    const ware = WARES_DB[wareId];
    if (!ware || !calc || ware.level === 0 || ware.level === 4) return;

    const level = ware.level;
    const modCount = state.activeBlueprint 
      ? Math.max(((state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0), (calc.modulesNeeded || 0))
      : (calc.modulesNeeded || 0);
    if (modCount <= 0) return;

    const layerKey = `L${level}`;
    if (totals[layerKey]) {
      totals[layerKey].activeModules += modCount;

      // Hourly Production Rate
      const inPlanCount = state.activeBlueprint ? (state.activeBlueprint.modules[wareId] || 0) : modCount;
      const baselineCalc = (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[wareId]) || calc;
      const optimumRate = (baselineCalc && baselineCalc.rateNeeded > 0) 
        ? baselineCalc.rateNeeded 
        : (modCount * getWareHourlyRatePerModule(wareId, state.workforceBonus));
      let prodRate = calculateLiveOutputRate(wareId, inPlanCount > 0 ? inPlanCount : modCount, optimumRate);
      const isPPChecked = (ware.level >= 1 && ware.level <= 3) && Boolean(
        (state.activeBlueprint && state.activeBlueprint.ppStates && state.activeBlueprint.ppStates[wareId]) ||
        (!state.activeBlueprint && state.ppStates && state.ppStates[wareId])
      );
      if (isPPChecked || ppDownstreamWares.has(wareId)) {
        prodRate = 0;
      }
      totals[layerKey].totalProd += prodRate;

      // Hourly Recipe Consumption
      if (ware.recipe) {
        Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
          let consRate = modCount * inputQty;
          if (inputId === 'EC') {
            if (isPPChecked) {
              consRate = 0;
            }
            // Recycler products and scrap metal wares have their EC dynamically calculated
            if (wareId === 'ScrapMetal' || wareId === 'TerScrapMetal' || NO_PP_WARES.has(wareId)) {
              return;
            }
            totals[layerKey].ecConsumed += consRate;
            totals.totalECNeeded += consRate;
          } else {
            totals[layerKey].totalCons += consRate;
          }
        });
      }
    }
  });

  // Calculate Scrap Metal EC demand (dynamic rule based on highest downstream ware + processor EC)
  const scrapEc = calculateScrapMetalEcDemand();
  state.scrapMetalEc = scrapEc;
  if (scrapEc.totalDemand > 0) {
    totals.L1.ecConsumed += scrapEc.totalDemand;
    totals.totalECNeeded += scrapEc.totalDemand;
  }

  let inPlanSolarCount = state.activeBlueprint ? (state.activeBlueprint.modules['EC'] || 0) : 0;
  let inPlanTerSolarCount = state.activeBlueprint ? (state.activeBlueprint.modules['TerEC'] || 0) : 0;

  if (inPlanTerSolarCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
      if (mapMacroToWare(m) === 'TerEC') inPlanTerSolarCount += count;
    });
  }
  if (inPlanSolarCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
      if (mapMacroToWare(m) === 'EC') inPlanSolarCount += count;
    });
  }

  totals.inPlanSolarCount = inPlanSolarCount;
  totals.inPlanTerSolarCount = inPlanTerSolarCount;
  totals.totalECProduced = (inPlanSolarCount * ecSolarPerModule) + (inPlanTerSolarCount * terSolarPerModule);
  totals.ecBalance = totals.totalECProduced - totals.totalECNeeded;

  const remainingECNeeded = Math.max(0, totals.totalECNeeded - totals.totalECProduced);
  totals.solarModulesNeeded = remainingECNeeded > 0 ? Math.ceil(remainingECNeeded / ecSolarPerModule) : 0;
  totals.terSolarModulesNeeded = remainingECNeeded > 0 ? Math.ceil(remainingECNeeded / terSolarPerModule) : 0;

  if (state.activeBlueprint) {
    if (inPlanTerSolarCount > 0 && inPlanSolarCount === 0) {
      // Station blueprint uses Terran solar
      state.calculatedDemand['TerEC'] = { modulesNeeded: totals.terSolarModulesNeeded, rateNeeded: totals.totalECNeeded };
      state.calculatedDemand['EC'] = { modulesNeeded: 0, rateNeeded: 0 };
    } else if (inPlanSolarCount > 0 && inPlanTerSolarCount === 0) {
      // Station blueprint uses Commonwealth solar
      state.calculatedDemand['EC'] = { modulesNeeded: totals.solarModulesNeeded, rateNeeded: totals.totalECNeeded };
      state.calculatedDemand['TerEC'] = { modulesNeeded: 0, rateNeeded: 0 };
    } else if (inPlanSolarCount > 0 && inPlanTerSolarCount > 0) {
      // Mixed solar station (e.g. Prod Max)
      state.calculatedDemand['EC'] = { modulesNeeded: totals.solarModulesNeeded, rateNeeded: inPlanSolarCount * ecSolarPerModule };
      state.calculatedDemand['TerEC'] = { modulesNeeded: 0, rateNeeded: inPlanTerSolarCount * terSolarPerModule };
    } else {
      // Neither solar module installed yet in blueprint
      if (isBlueprintTerran(state.activeBlueprint) || state.factionConstructionMethod === 'terran') {
        state.calculatedDemand['TerEC'] = { modulesNeeded: totals.terSolarModulesNeeded, rateNeeded: totals.totalECNeeded };
        state.calculatedDemand['EC'] = { modulesNeeded: 0, rateNeeded: 0 };
      } else {
        state.calculatedDemand['EC'] = { modulesNeeded: totals.solarModulesNeeded, rateNeeded: totals.totalECNeeded };
        state.calculatedDemand['TerEC'] = { modulesNeeded: 0, rateNeeded: 0 };
      }
    }
  } else {
    // Single Target Mode
    if (state.selectedWareId === 'TerEC') {
      totals.terSolarModulesNeeded = 1;
      totals.totalECProduced = terSolarPerModule;
      state.calculatedDemand['TerEC'] = { modulesNeeded: 1, rateNeeded: terSolarPerModule };
      state.calculatedDemand['EC'] = { modulesNeeded: 0, rateNeeded: 0 };
    } else if (state.selectedWareId === 'EC') {
      totals.solarModulesNeeded = 1;
      totals.totalECProduced = ecSolarPerModule;
      state.calculatedDemand['EC'] = { modulesNeeded: 1, rateNeeded: ecSolarPerModule };
      state.calculatedDemand['TerEC'] = { modulesNeeded: 0, rateNeeded: 0 };
    } else if (state.selectedWareId && isTerranWare(state.selectedWareId) && WARES_DB[state.selectedWareId] && WARES_DB[state.selectedWareId].level !== 4) {
      state.calculatedDemand['TerEC'] = { modulesNeeded: totals.terSolarModulesNeeded, rateNeeded: totals.totalECNeeded };
      state.calculatedDemand['EC'] = { modulesNeeded: 0, rateNeeded: 0 };
    } else if (state.selectedWareId && totals.totalECNeeded > 0) {
      state.calculatedDemand['EC'] = { modulesNeeded: totals.solarModulesNeeded, rateNeeded: totals.totalECNeeded };
      state.calculatedDemand['TerEC'] = { modulesNeeded: 0, rateNeeded: 0 };
    } else {
      state.calculatedDemand['EC'] = { modulesNeeded: 0, rateNeeded: 0 };
      state.calculatedDemand['TerEC'] = { modulesNeeded: 0, rateNeeded: 0 };
    }
  }
  state.layerTotals = totals;
  state.workforceSummary = calculateBlueprintWorkforce(state.activeBlueprint);
  totals.workforce = state.workforceSummary;
}

export function calculateFactoryRequirements(blueprint = state.activeBlueprint, options = {}) {
  state.calculatedDemand = {};

  const activeBp = blueprint !== undefined ? blueprint : state.activeBlueprint;
  if (options.selectedSector !== undefined) state.selectedSector = options.selectedSector;
  if (options.workforceBonus !== undefined) state.workforceBonus = options.workforceBonus;
  if (options.ppStates !== undefined && activeBp) activeBp.ppStates = options.ppStates;

  // CASE 1: Full Station Blueprint loaded (always use blueprint modules for all totals)
  if (activeBp) {
    if (!activeBp.modules) activeBp.modules = {};
    if (!activeBp.rawMacros) activeBp.rawMacros = {};
    const bpModules = activeBp.modules;

    if (!activeBp.ppStates) activeBp.ppStates = {};
    delete activeBp.ppStates['ScrapHullParts'];
    delete activeBp.ppStates['ScrapClaytronics'];
    delete activeBp.ppStates['TerCompSubstrate'];
    delete activeBp.ppStates['TerSilCarbide'];

    // Rule: If any inputs to Hull Parts has 0 module count, then check PP for Hull Part
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

    // Initialize all wares in calculatedDemand
    Object.keys(WARES_DB).forEach(id => {
      state.calculatedDemand[id] = { rateNeeded: 0, modulesNeeded: 0 };
    });

    // 1. Process Level 3 (propagates to Level 2, Level 1, Level 0) - excluding Level 4
    Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 3).forEach(id => {
      const ware = WARES_DB[id];
      const planned = bpModules[id] || 0;

      if (planned > 0 && ware.recipe) {
        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (!state.calculatedDemand[inpId]) state.calculatedDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
          state.calculatedDemand[inpId].rateNeeded += planned * inpQty;
        });
      }
    });

    // 2. Process Level 2 (propagates to Level 1, Level 0)
    Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 2).forEach(id => {
      const ware = WARES_DB[id];
      const planned = bpModules[id] || 0;
      const modRate = getWareHourlyRatePerModule(id, state.workforceBonus);
      const neededFromL3 = state.calculatedDemand[id] && state.calculatedDemand[id].rateNeeded > 0 ? Math.ceil(state.calculatedDemand[id].rateNeeded / modRate) : 0;
      const activeModCount = planned > 0 ? Math.max(planned, neededFromL3) : (state.populateMatrix ? neededFromL3 : 0);

      if (activeModCount > 0 && ware.recipe) {
        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (!state.calculatedDemand[inpId]) state.calculatedDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
          state.calculatedDemand[inpId].rateNeeded += activeModCount * inpQty;
        });
      }
    });

    // 3. Process Level 1 (propagates to Level 1 ScrapMetal/TerScrapMetal, and to Level 0 raw & EC)
    const level1Wares = Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 1);
    const isScrapProcessorWare = id => id === 'ScrapMetal' || id === 'TerScrapMetal' || id === 'ScrapProc' || id === 'AllographyneScrapProc';
    const sortedLevel1 = level1Wares.sort((a, b) => (isScrapProcessorWare(a) ? 1 : (isScrapProcessorWare(b) ? -1 : 0)));
    sortedLevel1.forEach(id => {
      const ware = WARES_DB[id];
      const planned = bpModules[id] || 0;
      const modRate = getWareHourlyRatePerModule(id, state.workforceBonus);
      const neededFromL23 = state.calculatedDemand[id] && state.calculatedDemand[id].rateNeeded > 0 ? Math.ceil(state.calculatedDemand[id].rateNeeded / modRate) : 0;
      const isAlloProc = id === 'AllographyneScrapProc';
      const hasAlloFrag = Boolean(bpModules['AllographyneFragments'] > 0);
      const activeModCount = planned > 0 ? Math.max(planned, neededFromL23) : ((state.populateMatrix || (isAlloProc && hasAlloFrag)) ? neededFromL23 : 0);

      if (activeModCount > 0 && ware.recipe) {
        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if ((id === 'ScrapMetal' || id === 'TerScrapMetal' || id === 'ScrapProc') && (inpId === 'RawScrap' || inpId === 'ScrapProc' || inpId === 'EC')) {
            return; // Dynamically handled
          }
          if (!state.calculatedDemand[inpId]) state.calculatedDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
          state.calculatedDemand[inpId].rateNeeded += activeModCount * inpQty;
        });
      }
    });

    // 4. Calculate modulesNeeded strictly for Level 1-3 wares
    Object.entries(state.calculatedDemand).forEach(([inputId, data]) => {
      const inputWare = WARES_DB[inputId];
      if (inputWare && inputWare.level > 0 && inputWare.level <= 3) {
        const modRate = (inputId === 'ScrapHullParts' || inputId === 'ScrapClaytronics')
          ? calculateLiveOutputRate(inputId, 1, 0)
          : getWareHourlyRatePerModule(inputId, state.workforceBonus);
        const neededFromDownstream = data.rateNeeded > 0 ? Math.ceil(data.rateNeeded / modRate) : 0;
        const planned = bpModules[inputId] || 0;

        const isAlloProc = inputId === 'AllographyneScrapProc';
        const hasAlloFrag = Boolean(bpModules['AllographyneFragments'] > 0);
        data.modulesNeeded = planned > 0 ? Math.max(planned, neededFromDownstream) : ((state.populateMatrix || (isAlloProc && hasAlloFrag)) ? neededFromDownstream : 0);
      }
    });

    const scrapRaw = calculateScrapMetalRawScrapDemand();
    state.scrapRawDemand = scrapRaw;
    const smTotalDemand = (scrapRaw.genRawScrapDemand || 0) + (scrapRaw.terRawScrapDemand || 0);
    const procBaseRate = (WARES_DB['ScrapProc'] && WARES_DB['ScrapProc'].baseRate) || 9000;
    const procNeeds = smTotalDemand > 0 ? Math.ceil(smTotalDemand / procBaseRate) : 0;

    if (!state.calculatedDemand['ScrapProc']) {
      state.calculatedDemand['ScrapProc'] = { rateNeeded: 0, modulesNeeded: 0 };
    }
    state.calculatedDemand['ScrapProc'].rateNeeded = smTotalDemand;
    state.calculatedDemand['ScrapProc'].modulesNeeded = procNeeds;

    // Allographyne Scrap Processor demand when Allographyne Fragments is in blueprint
    const fragMods = bpModules['AllographyneFragments'] || 0;
    const alloProcDemand = state.calculatedDemand['AllographyneScrapProc'] ? state.calculatedDemand['AllographyneScrapProc'].rateNeeded : (fragMods * 450);
    const alloProcBaseRate = (WARES_DB['AllographyneScrapProc'] && WARES_DB['AllographyneScrapProc'].baseRate) || 18000;
    const plannedAlloProc = bpModules['AllographyneScrapProc'] || 0;
    const alloProcNeeds = (fragMods > 0 || alloProcDemand > 0) ? Math.ceil(alloProcDemand / alloProcBaseRate) : 0;
    const alloProcCount = plannedAlloProc > 0 ? Math.max(plannedAlloProc, alloProcNeeds) : alloProcNeeds;

    if (fragMods > 0 || alloProcCount > 0 || alloProcDemand > 0) {
      if (!state.calculatedDemand['AllographyneScrapProc']) {
        state.calculatedDemand['AllographyneScrapProc'] = { rateNeeded: 0, modulesNeeded: 0 };
      }
      state.calculatedDemand['AllographyneScrapProc'].rateNeeded = alloProcDemand > 0 ? alloProcDemand : (alloProcCount * alloProcBaseRate);
      state.calculatedDemand['AllographyneScrapProc'].modulesNeeded = alloProcCount;
    }

    accumulateRawMiningRates();
    computeLayerTotals();

    if (activeBp && !activeBp.baselineDemand) {
      activeBp.baselineDemand = JSON.parse(JSON.stringify(state.calculatedDemand));
      activeBp.baselineLayerTotals = JSON.parse(JSON.stringify(state.layerTotals));
    }
    return {
      demand: state.calculatedDemand,
      layerTotals: state.layerTotals,
      workforceSummary: state.workforceSummary
    };
  }

  // CASE 2: Single Target Mode with a specific card selected
  if (state.selectedWareId && WARES_DB[state.selectedWareId]) {
    const selectedWare = WARES_DB[state.selectedWareId];

    if (selectedWare.level === 4) {
      // Level 4 cards are application/build sinks and never impose upstream demands
      Object.keys(WARES_DB).forEach(id => {
        state.calculatedDemand[id] = { rateNeeded: 0, modulesNeeded: 0 };
      });
      accumulateRawMiningRates();
      computeLayerTotals();
      return {
        demand: state.calculatedDemand,
        layerTotals: state.layerTotals,
        workforceSummary: state.workforceSummary
      };
    } else {
      // Level 1, 2, 3 selected target or Level 0 EC/TerEC
      const isTargetEC = state.selectedWareId === 'EC' || state.selectedWareId === 'TerEC';
      const targetOutputRate = (isTargetEC || state.selectedWareId === 'ScrapHullParts' || state.selectedWareId === 'ScrapClaytronics')
        ? calculateLiveOutputRate(state.selectedWareId, 1, 0)
        : getWareHourlyRatePerModule(state.selectedWareId, state.workforceBonus);

      state.calculatedDemand[state.selectedWareId] = {
        rateNeeded: targetOutputRate,
        modulesNeeded: 1
      };

      let queue = [{ id: state.selectedWareId, requiredRate: targetOutputRate }];

      while (queue.length > 0) {
        const { id, requiredRate } = queue.shift();
        const ware = WARES_DB[id];

        if (ware && ware.recipe) {
          const wareModRate = (id === 'ScrapHullParts' || id === 'ScrapClaytronics')
            ? calculateLiveOutputRate(id, 1, 0)
            : getWareHourlyRatePerModule(id, state.workforceBonus);

          Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
            const inputRatePerMod = inputQty;
            const ratePerUnit = inputRatePerMod / wareModRate;
            const totalInputRateNeeded = requiredRate * ratePerUnit;

            if (!state.calculatedDemand[inputId]) {
              state.calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
            }

            state.calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

            const inputWare = WARES_DB[inputId];
            if (inputWare && inputWare.level > 0) {
              const modRate = (inputId === 'ScrapHullParts' || inputId === 'ScrapClaytronics')
                ? calculateLiveOutputRate(inputId, 1, 0)
                : getWareHourlyRatePerModule(inputId, state.workforceBonus);
              state.calculatedDemand[inputId].modulesNeeded = Math.ceil(state.calculatedDemand[inputId].rateNeeded / modRate);
            }

            queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
          });
        }
      }
    }

    if (!state.ppStates) state.ppStates = {};
    delete state.ppStates['ScrapHullParts'];
    delete state.ppStates['ScrapClaytronics'];
    delete state.ppStates['TerCompSubstrate'];
    delete state.ppStates['TerSilCarbide'];

    // Rule: If any inputs to Hull Parts has 0 module count, then check PP for Hull Part
    const hullWare = WARES_DB['HullParts'];
    if (hullWare && hullWare.recipe) {
      const anyInputZero = Object.keys(hullWare.recipe).some(inpId => {
        if (inpId === 'EC' || inpId === 'TerEC') {
          const ecCalc = state.calculatedDemand['EC'];
          const terEcCalc = state.calculatedDemand['TerEC'];
          const ecCount = ((ecCalc && ecCalc.modulesNeeded) || 0) + ((terEcCalc && terEcCalc.modulesNeeded) || 0);
          return ecCount === 0;
        }
        const inpCalc = state.calculatedDemand[inpId];
        return !inpCalc || (inpCalc.modulesNeeded || 0) === 0;
      });

      if (anyInputZero) {
        if (!state._manualHullPartsPP) {
          state.ppStates['HullParts'] = true;
          state._autoHullPartsPP = true;
        }
      } else if (state._autoHullPartsPP) {
        delete state.ppStates['HullParts'];
        delete state._autoHullPartsPP;
        delete state._manualHullPartsPP;
      }
    }

    // Rule: If any inputs to Claytronics has 0 module count, then check PP for Claytronics
    const clayWare = WARES_DB['Claytronics'];
    if (clayWare && clayWare.recipe) {
      const anyClayInputZero = Object.keys(clayWare.recipe).some(inpId => {
        if (inpId === 'EC' || inpId === 'TerEC') {
          const ecCalc = state.calculatedDemand['EC'];
          const terEcCalc = state.calculatedDemand['TerEC'];
          const ecCount = ((ecCalc && ecCalc.modulesNeeded) || 0) + ((terEcCalc && terEcCalc.modulesNeeded) || 0);
          return ecCount === 0;
        }
        const inpCalc = state.calculatedDemand[inpId];
        return !inpCalc || (inpCalc.modulesNeeded || 0) === 0;
      });

      if (anyClayInputZero) {
        if (!state._manualClaytronicsPP) {
          state.ppStates['Claytronics'] = true;
          state._autoClaytronicsPP = true;
        }
      } else if (state._autoClaytronicsPP) {
        delete state.ppStates['Claytronics'];
        delete state._autoClaytronicsPP;
        delete state._manualClaytronicsPP;
      }
    }

    const scrapRaw = calculateScrapMetalRawScrapDemand();
    state.scrapRawDemand = scrapRaw;
    const smTotalDemand = (scrapRaw.genRawScrapDemand || 0) + (scrapRaw.terRawScrapDemand || 0);
    const procBaseRate = (WARES_DB['ScrapProc'] && WARES_DB['ScrapProc'].baseRate) || 9000;
    const procNeeds = smTotalDemand > 0 ? Math.ceil(smTotalDemand / procBaseRate) : 0;

    if (smTotalDemand > 0) {
      if (!state.calculatedDemand['ScrapProc']) {
        state.calculatedDemand['ScrapProc'] = { rateNeeded: 0, modulesNeeded: 0 };
      }
      state.calculatedDemand['ScrapProc'].rateNeeded = smTotalDemand;
      state.calculatedDemand['ScrapProc'].modulesNeeded = procNeeds;
    }

    accumulateRawMiningRates();
    computeLayerTotals();
    return {
      demand: state.calculatedDemand,
      layerTotals: state.layerTotals,
      workforceSummary: state.workforceSummary
    };
  }

  computeLayerTotals();
  return {
    demand: state.calculatedDemand,
    layerTotals: state.layerTotals,
    workforceSummary: state.workforceSummary
  };
}

/**
 * Calculates net hourly production/consumption across levels 0 through 4.
 * Coordinates workforce efficiency from workforce.js and mining from mining.js.
 *
 * @param {Object} [modulesState] - { [macroName]: count } or blueprint object
 * @param {Object} [options] - { workforceCount: number, sunlightPct: number, selectedSector: string }
 * @returns {Object} Comprehensive calculation matrix result
 */
export function calculateMatrix(modulesState = {}, options = {}) {
  const modules = (modulesState && typeof modulesState === 'object')
    ? (modulesState.modules ? modulesState.modules : modulesState)
    : (state.activeBlueprint?.modules || {});

  const { workforceCount = 0, sunlightPct = 100 } = options;

  const totalWorkforceNeeded = calculateRequiredWorkforce(modules);
  const efficiencyMultiplier = calculateWorkforceEfficiency(
    workforceCount,
    totalWorkforceNeeded
  );

  const wareProduction = {};
  const wareConsumption = {};

  // 1. Accumulate gross production and consumption across active modules
  for (const [macro, count] of Object.entries(modules)) {
    if (!macro || count <= 0) continue;
    const wareId = mapMacroToWare(macro) || macro;
    const wareInfo = WARES_DB[wareId] || WARES_DB[macro];
    if (!wareInfo) continue;

    // Apply workforce bonus and sector sunlight scaling where appropriate
    let productionMultiplier = efficiencyMultiplier;
    if (wareInfo.id === 'energycells' || wareId === 'EC' || wareId === 'TerEC') {
      productionMultiplier *= calculateSolarYield(1, sunlightPct);
    }

    const hourlyOutput = (wareInfo.yieldPerHour || getWareHourlyRatePerModule(wareId, (efficiencyMultiplier - 1.0) * 100) || 0) * count * productionMultiplier;
    const key = wareInfo.id || wareId;
    wareProduction[key] = (wareProduction[key] || 0) + hourlyOutput;

    // Accumulate upstream input requirements
    const inputs = wareInfo.recipe || wareInfo.inputs || {};
    for (const [inputWare, requiredRate] of Object.entries(inputs)) {
      wareConsumption[inputWare] = (wareConsumption[inputWare] || 0) + requiredRate * count;
    }
  }

  // 2. Compute net balances per ware
  const netBalance = {};
  const allWares = new Set([
    ...Object.keys(wareProduction),
    ...Object.keys(wareConsumption),
  ]);

  for (const ware of allWares) {
    const prod = wareProduction[ware] || 0;
    const cons = wareConsumption[ware] || 0;
    netBalance[ware] = prod - cons;
  }

  // 3. Delegate raw mineral mining demand calculation
  const rawDemand = calculateMiningRequirements(netBalance);

  // 4. Also calculate complete factory requirements for legacy and matrix consumers
  const bp = (modulesState && typeof modulesState === 'object' && modulesState.modules)
    ? modulesState
    : { modules, name: 'Ad-hoc Matrix' };
  const factoryReqs = calculateFactoryRequirements(bp, {
    ...options,
    workforceBonus: (efficiencyMultiplier - 1.0) * 100
  });

  return {
    production: wareProduction,
    consumption: wareConsumption,
    netBalance,
    rawDemand,
    workforce: {
      required: totalWorkforceNeeded,
      active: workforceCount,
      multiplier: efficiencyMultiplier,
    },
    demand: factoryReqs.demand,
    layerTotals: factoryReqs.layerTotals,
    workforceSummary: factoryReqs.workforceSummary
  };
}

export function getPrimaryMacroForWare(wareId) {
  if (wareId === 'ScrapProc') {
    if (state.activeBlueprint) {
      if (state.activeBlueprint.rootMacros?.['proc_gen_scrapworks_macro'] || state.activeBlueprint.rawMacros?.['proc_gen_scrapworks_macro']) {
        return 'proc_gen_scrapworks_macro';
      }
      if (state.activeBlueprint.rootMacros?.['prod_gen_scrapprocessor_macro'] || state.activeBlueprint.rawMacros?.['prod_gen_scrapprocessor_macro']) {
        return 'prod_gen_scrapprocessor_macro';
      }
      if (state.activeBlueprint.rootMacros?.['proc_ter_scrapworks_macro'] || state.activeBlueprint.rawMacros?.['proc_ter_scrapworks_macro']) {
        return 'proc_ter_scrapworks_macro';
      }
      if (state.activeBlueprint.rootMacros?.['prod_ter_scrapprocessor_macro'] || state.activeBlueprint.rawMacros?.['prod_ter_scrapprocessor_macro']) {
        return 'prod_ter_scrapprocessor_macro';
      }
    }
    return 'proc_gen_scrapworks_macro';
  }
  if (wareId === 'TerScrapMetal') {
    return 'prod_ter_scrap_recycler_macro';
  }
  if (wareId === 'ScrapMetal') {
    return 'prod_gen_scrap_recycler_macro';
  }
  if (wareId === 'ScrapClaytronics' || wareId === 'ScrapHullParts') {
    return 'prod_gen_scrap_recycler_macro';
  }
  if (wareId === 'AllographyneScrapProc') {
    return 'proc_gen_scrapworkskhaak_macro';
  }
  if (wareId === 'AllographyneFragments') {
    return 'prod_gen_scrap_recyclerkhaak_macro';
  }
  if (wareId === 'Allographyne') {
    return 'prod_gen_allographyne_macro';
  }
  if (wareId === 'TerCompSubstrate') {
    return 'prod_ter_computronicsubstrate_macro';
  }
  if (wareId === 'TerSilCarbide') {
    return 'prod_ter_siliconcarbide_macro';
  }
  if (wareId === 'CompSubstrate') {
    return 'prod_gen_computronicsubstrate_macro';
  }
  if (wareId === 'SilCarbide') {
    return 'prod_gen_siliconcarbide_macro';
  }
  if (state.activeBlueprint) {
    if (state.activeBlueprint.rootMacros) {
      const existingRoot = Object.keys(state.activeBlueprint.rootMacros).find(m => mapMacroToWare(m) === wareId);
      if (existingRoot) return existingRoot;
    }
    if (state.activeBlueprint.rawMacros) {
      const existingRaw = Object.keys(state.activeBlueprint.rawMacros).find(m => mapMacroToWare(m) === wareId);
      if (existingRaw) return existingRaw;
    }
  }
  const found = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wareId && m.startsWith('prod_'));
  return found || `prod_gen_${wareId.toLowerCase()}_macro`;
}

function extractModulesFromMacros(macrosMap) {
  const mods = {};
  Object.entries(macrosMap).forEach(([m, c]) => {
    const lowerMacro = m.toLowerCase();
    const isRecycler = (lowerMacro.includes('scraprecycler') || lowerMacro.includes('scrap_recycler')) && !lowerMacro.includes('khaak');
    if (isRecycler) {
      if (lowerMacro.includes('ter')) {
        mods['TerCompSubstrate'] = (mods['TerCompSubstrate'] || 0) + c;
        mods['TerSilCarbide'] = (mods['TerSilCarbide'] || 0) + c;
        mods['TerScrapMetal'] = (mods['TerScrapMetal'] || 0) + c;
      } else {
        mods['ScrapHullParts'] = (mods['ScrapHullParts'] || 0) + c;
        mods['ScrapClaytronics'] = (mods['ScrapClaytronics'] || 0) + c;
        mods['ScrapMetal'] = (mods['ScrapMetal'] || 0) + c;
      }
      return;
    }
    const w = mapMacroToWare(m);
    if (w) mods[w] = (mods[w] || 0) + c;
  });
  return mods;
}

export function syncPopulatedMatrix() {
  if (!state.activeBlueprint) return;
  if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
  if (!state.activeBlueprint.rootMacros) {
    state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };
  }

  if (!state.populateMatrix) {
    // Revert to rootMacros
    state.activeBlueprint.rawMacros = { ...state.activeBlueprint.rootMacros };
    state.activeBlueprint.modules = extractModulesFromMacros(state.activeBlueprint.rawMacros);
    state.activeBlueprint.totalModules = Object.values(state.activeBlueprint.rawMacros).reduce((s, n) => s + n, 0);
    saveActiveBlueprintToStorage();
    calculateFactoryRequirements();
    return;
  }

  // Start with rootMacros
  const newMacros = { ...state.activeBlueprint.rootMacros };
  const rootMods = extractModulesFromMacros(newMacros);

  // Calculate upstream requirements from all L2/L3 wares in rootMods
  const accumulatedDemand = {};

  // Step 1: L3 wares
  Object.keys(rootMods).filter(id => WARES_DB[id] && WARES_DB[id].level === 3).forEach(l3Id => {
    const l3Ware = WARES_DB[l3Id];
    const l3Count = rootMods[l3Id];
    if (l3Ware.recipe) {
      Object.entries(l3Ware.recipe).forEach(([inpId, inpQty]) => {
        accumulatedDemand[inpId] = (accumulatedDemand[inpId] || 0) + (l3Count * inpQty);
      });
    }
  });

  // Step 2: L2 wares
  Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 2).forEach(l2Id => {
    const l2Ware = WARES_DB[l2Id];
    const l2ModOutput = getWareHourlyRatePerModule(l2Id, state.workforceBonus);
    const demandFromL3 = accumulatedDemand[l2Id] || 0;
    const neededFromL3 = demandFromL3 > 0 ? Math.ceil(demandFromL3 / l2ModOutput) : 0;
    const rootCount = rootMods[l2Id] || 0;
    const totalL2Count = Math.max(rootCount, neededFromL3);

    if (totalL2Count > 0) {
      const macro = getPrimaryMacroForWare(l2Id);
      newMacros[macro] = Math.max(newMacros[macro] || 0, totalL2Count);

      if (l2Ware.recipe) {
        Object.entries(l2Ware.recipe).forEach(([l1Id, l1Qty]) => {
          accumulatedDemand[l1Id] = (accumulatedDemand[l1Id] || 0) + (totalL2Count * l1Qty);
        });
      }
    }
  });

  // Step 3: L1 wares
  Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 1).forEach(l1Id => {
    const l1Ware = WARES_DB[l1Id];
    const l1ModOutput = getWareHourlyRatePerModule(l1Id, state.workforceBonus);
    const demandRate = accumulatedDemand[l1Id] || 0;
    const needed = demandRate > 0 ? Math.ceil(demandRate / l1ModOutput) : 0;
    const rootCount = rootMods[l1Id] || 0;
    const totalL1Count = Math.max(rootCount, needed);

    if (totalL1Count > 0) {
      const macro = getPrimaryMacroForWare(l1Id);
      newMacros[macro] = Math.max(newMacros[macro] || 0, totalL1Count);
    }
  });

  state.activeBlueprint.rawMacros = newMacros;
  state.activeBlueprint.modules = extractModulesFromMacros(newMacros);
  state.activeBlueprint.totalModules = Object.values(newMacros).reduce((s, n) => s + n, 0);
  saveActiveBlueprintToStorage();
  calculateFactoryRequirements();
}
