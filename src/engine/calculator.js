import { WARES_DB, DEPENDENCIES, PRESET_BLUEPRINTS, getWareHourlyRatePerModule, getWareCycleYield, mapMacroToWare, MACRO_TO_WARE, isTerranWare, isBlueprintTerran, NO_PP_WARES, getFriendlyModuleName } from '../data/wares.js';
import { state, saveActiveBlueprintToStorage } from './state.js';
import { getSectorSunlight, calculateSolarOutput } from '../data/sectors.js';
import MODULES_WORKFORCE from '../data/modules_workforce.json' with { type: 'json' };

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

export function accumulateRawMiningRates() {
  const demand = state.calculatedDemand;
  const rawTotals = {
    Ore: 0,
    Silicon: 0,
    Methane: 0,
    Hydrogen: 0,
    Helium: 0,
    Ice: 0,
    RawScrap: 0,
    RawKhaakScrap: 0,
    Protectyon: 0
  };

  if (state.activeBlueprint) {
    // In Blueprint Mode: Calculate raw extraction from actual active blueprint modules
    const bpModules = state.activeBlueprint.modules || {};
    Object.entries(bpModules).forEach(([wareId, count]) => {
      const ware = WARES_DB[wareId];
      if (!ware || !ware.recipe || count <= 0 || ware.level === 4) return;

      Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
        if (inputId === 'RawScrap' && (wareId === 'ScrapMetal' || wareId === 'TerScrapMetal' || wareId === 'ScrapProc')) {
          return; // Dynamically handled below
        }
        if (rawTotals[inputId] !== undefined) {
          rawTotals[inputId] += count * inputQty;
        }
      });
    });
  } else {
    // Single Target Mode: Calculate from chain modulesNeeded
    Object.entries(demand).forEach(([wareId, calc]) => {
      const ware = WARES_DB[wareId];
      if (!ware || !ware.recipe || !calc || ware.level === 4) return;
      const count = calc.modulesNeeded || 0;
      if (count <= 0) return;

      Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
        if (inputId === 'RawScrap' && (wareId === 'ScrapMetal' || wareId === 'TerScrapMetal' || wareId === 'ScrapProc')) {
          return; // Dynamically handled below
        }
        if (rawTotals[inputId] !== undefined) {
          rawTotals[inputId] += count * inputQty;
        }
      });
    });
  }

  // Calculate dynamic Scrap Metal demand of Raw Scrap (recycler modules * downstream demand)
  const scrapRaw = calculateScrapMetalRawScrapDemand();
  state.scrapRawDemand = scrapRaw;
  rawTotals['RawScrap'] = scrapRaw.totalRawScrapDemand;

  // Calculate dynamic Raw Kha'ak Scrap demand from Allographyne Fragments & Scrap Processor
  const fragCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneFragments']) || 0;
  const alloProcCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneScrapProc']) || 0;
  const alloProcDemand = (demand['AllographyneScrapProc'] && demand['AllographyneScrapProc'].rateNeeded > 0) ? demand['AllographyneScrapProc'].rateNeeded : (fragCount * 450);
  if (fragCount > 0 || alloProcCount > 0 || alloProcDemand > 0) {
    rawTotals['RawKhaakScrap'] = alloProcCount > 0 ? Math.max(alloProcCount * 18000, alloProcDemand) : alloProcDemand;
  }

  if (demand['Protectyon'] && demand['Protectyon'].rateNeeded > 0 && rawTotals['Protectyon'] === 0) {
    rawTotals['Protectyon'] = demand['Protectyon'].rateNeeded;
  }

  state.rawDemand = rawTotals;

  // Also assign rawTotals to state.calculatedDemand so all L0 cards and Inspector use the exact planned extraction rate!
  Object.entries(rawTotals).forEach(([rawId, rate]) => {
    if (!state.calculatedDemand[rawId]) {
      state.calculatedDemand[rawId] = { rateNeeded: 0, modulesNeeded: 0 };
    }
    state.calculatedDemand[rawId].rateNeeded = rate;
  });
}

export function calculateScrapMetalEcDemand() {
  let genRecyclers = 0;
  let terRecyclers = 0;
  let procModules = 0;

  if (state.activeBlueprint) {
    const rawMacros = state.activeBlueprint.rawMacros || {};
    const modules = state.activeBlueprint.modules || {};

    // Count Processors from macros
    Object.entries(rawMacros).forEach(([macro, count]) => {
      const lower = macro.toLowerCase();
      if (lower.includes('scrapprocessor') || lower.includes('scrapworks')) {
        procModules += count;
      }
    });
    // Fallback to modules['RawScrap'] if rawMacros not populated
    if (procModules === 0) {
      procModules = modules['ScrapProc'] || modules['RawScrap'] || 0;
    }

    // Count Recyclers from macros
    Object.entries(rawMacros).forEach(([macro, count]) => {
      const lower = macro.toLowerCase();
      const isRecycler = (lower.includes('scraprecycler') || lower.includes('scrap_recycler')) && !lower.includes('khaak');
      if (isRecycler) {
        if (lower.includes('ter')) {
          terRecyclers += count;
        } else {
          genRecyclers += count;
        }
      }
    });

    // Fallback to modules if rawMacros not populated
    if (genRecyclers === 0 && modules['ScrapMetal']) {
      genRecyclers = modules['ScrapMetal'];
    }
    if (terRecyclers === 0 && modules['TerScrapMetal']) {
      terRecyclers = modules['TerScrapMetal'];
    }
  } else {
    // Single Target Mode
    const selId = state.selectedWareId;
    if (selId === 'ScrapClaytronics' || selId === 'ScrapHullParts') {
      genRecyclers = (state.calculatedDemand[selId] && state.calculatedDemand[selId].modulesNeeded) || 1;
    } else if (selId === 'TerCompSubstrate' || selId === 'TerSilCarbide') {
      terRecyclers = (state.calculatedDemand[selId] && state.calculatedDemand[selId].modulesNeeded) || 1;
    } else if (selId === 'ScrapMetal') {
      genRecyclers = 0;
    } else if (selId === 'TerScrapMetal') {
      terRecyclers = 0;
    }

    const smRate = ((state.calculatedDemand['ScrapMetal'] && state.calculatedDemand['ScrapMetal'].rateNeeded) || 0) +
                   ((state.calculatedDemand['TerScrapMetal'] && state.calculatedDemand['TerScrapMetal'].rateNeeded) || 0);
    if (smRate > 0) {
      procModules = Math.ceil(smRate / 9000);
    } else if (selId === 'RawScrap') {
      procModules = 1;
    }
  }

  // 1 processor = 90k EC/hr
  const processorEc = procModules * 90000;

  // Downstream candidate demands
  // Per module rates: Claytronics: 72,000 EC/hr, Hull Parts: 21,000 EC/hr,
  // Computronic Substrate: 72,000 EC/hr, Silicon Carbide: 48,000 EC/hr
  const candidates = [
    { id: 'ScrapClaytronics', name: 'Claytronics (Scrap)', ratePerMod: 72000, count: genRecyclers, demand: genRecyclers * 72000 },
    { id: 'ScrapHullParts', name: 'Hull Parts (Scrap)', ratePerMod: 21000, count: genRecyclers, demand: genRecyclers * 21000 },
    { id: 'TerCompSubstrate', name: 'Computronic Substrate (TER)', ratePerMod: 72000, count: terRecyclers, demand: terRecyclers * 72000 },
    { id: 'TerSilCarbide', name: 'Silicon Carbide (TER)', ratePerMod: 48000, count: terRecyclers, demand: terRecyclers * 48000 }
  ];

  // Find downstream ware with highest EC demand
  let highestCandidate = null;
  for (const c of candidates) {
    if (c.count > 0) {
      if (!highestCandidate || c.demand > highestCandidate.demand) {
        highestCandidate = c;
      }
    }
  }

  const establishedRatePerRecycler = highestCandidate ? highestCandidate.ratePerMod : 0;
  const totalRecyclers = genRecyclers + terRecyclers;
  const totalRecyclerEc = totalRecyclers * establishedRatePerRecycler;
  const totalDemand = totalRecyclerEc + processorEc;

  return {
    genRecyclers,
    terRecyclers,
    totalRecyclers,
    procModules,
    processorEc,
    candidates,
    highestCandidate,
    establishedRatePerRecycler,
    totalRecyclerEc,
    totalDemand
  };
}

export function calculateScrapMetalRawScrapDemand() {
  let genRecyclers = 0;
  let terRecyclers = 0;
  let procModules = 0;
  let genHullMods = 0;
  let genClayMods = 0;
  let terCompMods = 0;
  let terCarbMods = 0;

  if (state.activeBlueprint) {
    const rawMacros = state.activeBlueprint.rawMacros || {};
    const modules = state.activeBlueprint.modules || {};

    // Count Processors from macros
    Object.entries(rawMacros).forEach(([macro, count]) => {
      const lower = macro.toLowerCase();
      if ((lower.includes('scrapprocessor') || lower.includes('scrapworks')) && !lower.includes('khaak')) {
        procModules += count;
      }
    });
    if (procModules === 0) {
      procModules = modules['ScrapProc'] || modules['RawScrap'] || 0;
    }

    // Count Recyclers from macros
    Object.entries(rawMacros).forEach(([macro, count]) => {
      const lower = macro.toLowerCase();
      const isRecycler = (lower.includes('scraprecycler') || lower.includes('scrap_recycler')) && !lower.includes('khaak');
      if (isRecycler) {
        if (lower.includes('ter')) {
          terRecyclers += count;
        } else {
          genRecyclers += count;
        }
      }
    });

    genHullMods = (modules['ScrapHullParts'] !== undefined) ? modules['ScrapHullParts'] : genRecyclers;
    genClayMods = (modules['ScrapClaytronics'] !== undefined) ? modules['ScrapClaytronics'] : genRecyclers;
    terCompMods = (modules['TerCompSubstrate'] !== undefined) ? modules['TerCompSubstrate'] : terRecyclers;
    terCarbMods = (modules['TerSilCarbide'] !== undefined) ? modules['TerSilCarbide'] : terRecyclers;
  } else {
    // Single Target Mode
    const selId = state.selectedWareId;
    if (selId === 'ScrapClaytronics') {
      genClayMods = (state.calculatedDemand[selId] && state.calculatedDemand[selId].modulesNeeded) || 1;
      genRecyclers = genClayMods;
    } else if (selId === 'ScrapHullParts') {
      genHullMods = (state.calculatedDemand[selId] && state.calculatedDemand[selId].modulesNeeded) || 1;
      genRecyclers = genHullMods;
    } else if (selId === 'TerCompSubstrate') {
      terCompMods = (state.calculatedDemand[selId] && state.calculatedDemand[selId].modulesNeeded) || 1;
      terRecyclers = terCompMods;
    } else if (selId === 'TerSilCarbide') {
      terCarbMods = (state.calculatedDemand[selId] && state.calculatedDemand[selId].modulesNeeded) || 1;
      terRecyclers = terCarbMods;
    } else if (selId === 'ScrapMetal') {
      procModules = 1;
    } else if (selId === 'TerScrapMetal') {
      procModules = 1;
    } else if (selId === 'ScrapProc') {
      procModules = 1;
    } else if (selId === 'RawScrap') {
      procModules = 1;
    }
  }

  // Scrap Metal demand of Raw Scrap:
  // "becomes the number of recycler modules times the downstream Scrap Metal demand modules of Hull Parts (Scrap) and Claytronics (Scrap)"
  // Hull Parts (Scrap) recipe: 450 Scrap Metal per module
  // Claytronics (Scrap) recipe: 1,800 Scrap Metal per module
  let genRawScrapDemand = 0;
  if (genRecyclers > 0 || genHullMods > 0 || genClayMods > 0) {
    genRawScrapDemand = (genHullMods * 450) + (genClayMods * 1800);
  } else if (procModules > 0 && (!state.activeBlueprint || state.activeBlueprint.modules?.['ScrapMetal'])) {
    genRawScrapDemand = procModules * 9000;
  }

  // Terran Scrap Metal demand of Raw Scrap:
  // Computronic Substrate (TER) recipe: 6,000 Scrap Metal per module
  // Silicon Carbide (TER) recipe: 1,500 Scrap Metal per module
  let terRawScrapDemand = 0;
  if (terRecyclers > 0 || terCompMods > 0 || terCarbMods > 0) {
    terRawScrapDemand = (terCompMods * 6000) + (terCarbMods * 1500);
  } else if (procModules > 0 && state.activeBlueprint?.modules?.['TerScrapMetal']) {
    terRawScrapDemand = procModules * 9000;
  }

  const totalRawScrapDemand = genRawScrapDemand + terRawScrapDemand;

  // Scrap Metal converted per hour is the number of processors times the ScrapMetal : RawScrap number
  const scrapMetalWare = WARES_DB['ScrapMetal'];
  const convRatio = (scrapMetalWare && scrapMetalWare.recipe && scrapMetalWare.recipe['RawScrap']) || 9000;
  const convertedPerHr = procModules * convRatio;

  return {
    genRecyclers,
    terRecyclers,
    procModules,
    convRatio,
    convertedPerHr,
    genHullMods,
    genClayMods,
    terCompMods,
    terCarbMods,
    genRawScrapDemand,
    terRawScrapDemand,
    totalRawScrapDemand
  };
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
    } else if (state.selectedWareId && isTerranWare(state.selectedWareId)) {
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

export function calculateFactoryRequirements() {
  state.calculatedDemand = {};

  // CASE 1: Full Station Blueprint loaded (always use blueprint modules for all totals)
  if (state.activeBlueprint) {
    if (!state.activeBlueprint.modules) state.activeBlueprint.modules = {};
    if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
    const bpModules = state.activeBlueprint.modules;

    if (!state.activeBlueprint.ppStates) state.activeBlueprint.ppStates = {};
    delete state.activeBlueprint.ppStates['ScrapHullParts'];
    delete state.activeBlueprint.ppStates['ScrapClaytronics'];
    delete state.activeBlueprint.ppStates['TerCompSubstrate'];
    delete state.activeBlueprint.ppStates['TerSilCarbide'];

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

    if (!state.activeBlueprint.baselineDemand) {
      state.activeBlueprint.baselineDemand = JSON.parse(JSON.stringify(state.calculatedDemand));
      state.activeBlueprint.baselineLayerTotals = JSON.parse(JSON.stringify(state.layerTotals));
    }
    return;
  }

  // CASE 2: Single Target Mode with a specific card selected
  if (state.selectedWareId && WARES_DB[state.selectedWareId]) {
    const selectedWare = WARES_DB[state.selectedWareId];

    if (selectedWare.level === 4) {
      // If "Subdue Level 4" is unchecked, do not recalculate any cards only highlight cards associated.
      computeLayerTotals();
      return;
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
    return;
  }

  computeLayerTotals();
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

export function calculateBlueprintWorkforce(blueprint = state.activeBlueprint) {
  if (!blueprint) {
    return {
      totalOptimalWorkforce: 0,
      totalHabitationCapacity: 0,
      surplusDeficit: 0,
      coveragePercent: 0,
      productionWorkforce: 0,
      shipyardWorkforce: 0,
      productionCount: 0,
      shipyardCount: 0,
      habitatCount: 0,
      consumersList: [],
      providersList: []
    };
  }

  let totalOptimalWorkforce = 0;
  let totalHabitationCapacity = 0;
  let productionWorkforce = 0;
  let shipyardWorkforce = 0;
  let productionCount = 0;
  let shipyardCount = 0;
  let habitatCount = 0;

  const consumersList = [];
  const providersList = [];

  const processMacro = (macro, count) => {
    if (!macro || count <= 0) return;

    let data = MODULES_WORKFORCE[macro];
    if (!data) {
      const alt1 = macro.replace('_scraprecycler_', '_scrap_recycler_');
      const alt2 = macro.replace('_scrap_recycler_', '_scraprecycler_');
      data = MODULES_WORKFORCE[alt1] || MODULES_WORKFORCE[alt2];
    }
    if (!data) {
      const lower = macro.toLowerCase();
      data = MODULES_WORKFORCE[lower];
    }
    if (!data && macro.startsWith('prod_')) {
      const genMacro = macro.replace(/^prod_[a-z]+_/, 'prod_gen_');
      data = MODULES_WORKFORCE[genMacro] || MODULES_WORKFORCE[genMacro.toLowerCase()];
    }
    if (!data) {
      const wareId = mapMacroToWare(macro);
      if (wareId) {
        const primaryMacro = getPrimaryMacroForWare(wareId);
        if (primaryMacro && primaryMacro !== macro) {
          data = MODULES_WORKFORCE[primaryMacro] || MODULES_WORKFORCE[primaryMacro.toLowerCase()];
        }
      }
    }
    if (!data && macro.startsWith('buildmodule_')) {
      if (macro.includes('wharf')) {
        data = { max: 800 };
      } else if (macro.includes('shipyard')) {
        data = { max: 1000 };
      } else if (macro.includes('ships_xl')) {
        data = { max: 700 };
      }
    }

    if (!data) return;

    const friendlyName = getFriendlyModuleName(macro, state.factionConstructionMethod);

    if (data.max && data.max > 0) {
      const total = data.max * count;
      totalOptimalWorkforce += total;

      const isShipyard = macro.startsWith('buildmodule_') || macro.includes('_dockarea_') || macro.includes('tradestation');
      if (isShipyard) {
        shipyardWorkforce += total;
        shipyardCount += count;
      } else {
        productionWorkforce += total;
        productionCount += count;
      }

      consumersList.push({
        macro,
        name: friendlyName,
        count,
        perModule: data.max,
        total,
        type: isShipyard ? 'shipyard' : 'production'
      });
    }

    if (data.capacity && data.capacity > 0) {
      const total = data.capacity * count;
      totalHabitationCapacity += total;
      habitatCount += count;

      providersList.push({
        macro,
        name: friendlyName,
        count,
        perModule: data.capacity,
        total,
        race: data.race || 'unknown'
      });
    }
  };

  if (blueprint.rawMacros && Object.keys(blueprint.rawMacros).length > 0) {
    Object.entries(blueprint.rawMacros).forEach(([macro, count]) => {
      processMacro(macro, count);
    });
  } else if (blueprint.modules && Object.keys(blueprint.modules).length > 0) {
    Object.entries(blueprint.modules).forEach(([wareId, count]) => {
      if (count <= 0) return;
      const primaryMacro = getPrimaryMacroForWare(wareId);
      if (primaryMacro) {
        processMacro(primaryMacro, count);
      }
    });
  }

  consumersList.sort((a, b) => b.total - a.total);
  providersList.sort((a, b) => b.total - a.total);

  const surplusDeficit = totalHabitationCapacity - totalOptimalWorkforce;
  const coveragePercent = totalOptimalWorkforce > 0
    ? Math.round((totalHabitationCapacity / totalOptimalWorkforce) * 100)
    : (totalHabitationCapacity > 0 ? 100 : 0);

  // Life Support Calculations (Food Rations & Medical Supplies)
  // X4 Standard Argon Consumption: 400 workers consume 450 Food Rations and 270 Medical Supplies per hour
  const FOOD_RATIONS_CONSUMPTION = 450 / 400; // 1.125 units/worker/hr
  const MED_SUPPLIES_CONSUMPTION = 270 / 400;  // 0.675 units/worker/hr

  let totalFoodRationsProd = 0;
  let totalArgMedSuppliesProd = 0;
  let totalAllMedSuppliesProd = 0;
  let foodRationsModuleCount = 0;
  let medSuppliesModuleCount = 0;

  const currentWfBonus = typeof state !== 'undefined' && typeof state.workforceBonus === 'number' ? state.workforceBonus : 0;

  const evalLifeSupportMacro = (macro, count) => {
    if (!macro || count <= 0) return;
    const wareId = mapMacroToWare(macro);
    const ware = WARES_DB[wareId];
    if (!ware) return;

    const hourlyProd = count * getWareHourlyRatePerModule(wareId, currentWfBonus);

    if (wareId === 'FoodRations') {
      totalFoodRationsProd += hourlyProd;
      foodRationsModuleCount += count;
    } else if (wareId === 'ArgMedicalSupplies') {
      totalArgMedSuppliesProd += hourlyProd;
      totalAllMedSuppliesProd += hourlyProd;
      medSuppliesModuleCount += count;
    } else if (wareId && wareId.endsWith('MedicalSupplies')) {
      totalAllMedSuppliesProd += hourlyProd;
      medSuppliesModuleCount += count;
    }
  };

  if (blueprint.rawMacros && Object.keys(blueprint.rawMacros).length > 0) {
    Object.entries(blueprint.rawMacros).forEach(([macro, count]) => {
      evalLifeSupportMacro(macro, count);
    });
  } else if (blueprint.modules && Object.keys(blueprint.modules).length > 0) {
    Object.entries(blueprint.modules).forEach(([wareId, count]) => {
      if (count <= 0) return;
      const primaryMacro = getPrimaryMacroForWare(wareId);
      if (primaryMacro) {
        evalLifeSupportMacro(primaryMacro, count);
      }
    });
  }

  const foodRationsDemand = totalOptimalWorkforce * FOOD_RATIONS_CONSUMPTION;
  const medicalSuppliesDemand = totalOptimalWorkforce * MED_SUPPLIES_CONSUMPTION;

  const workersSustainableByFood = totalFoodRationsProd > 0 ? Math.floor(totalFoodRationsProd / FOOD_RATIONS_CONSUMPTION) : 0;
  const workersSustainableByMed = totalArgMedSuppliesProd > 0
    ? Math.floor(totalArgMedSuppliesProd / MED_SUPPLIES_CONSUMPTION)
    : (totalAllMedSuppliesProd > 0 ? Math.floor(totalAllMedSuppliesProd / MED_SUPPLIES_CONSUMPTION) : 0);

  const rawSustainableWorkers = Math.min(workersSustainableByFood, workersSustainableByMed);
  // Sustainable workers can never exceed optimal workers
  const sustainableWorkers = Math.min(rawSustainableWorkers, totalOptimalWorkforce);
  const sustainableCoveragePercent = totalOptimalWorkforce > 0
    ? Math.min(100, Math.round((sustainableWorkers / totalOptimalWorkforce) * 100))
    : 0;

  return {
    totalOptimalWorkforce,
    totalHabitationCapacity,
    surplusDeficit,
    coveragePercent,
    productionWorkforce,
    shipyardWorkforce,
    productionCount,
    shipyardCount,
    habitatCount,
    consumersList,
    providersList,
    lifeSupport: {
      foodRationsModuleCount,
      medSuppliesModuleCount,
      totalFoodRationsProd,
      totalArgMedSuppliesProd,
      totalAllMedSuppliesProd,
      foodRationsDemand,
      medicalSuppliesDemand,
      foodBalance: totalFoodRationsProd - foodRationsDemand,
      medBalance: (totalArgMedSuppliesProd || totalAllMedSuppliesProd) - medicalSuppliesDemand,
      workersSustainableByFood,
      workersSustainableByMed,
      rawSustainableWorkers,
      sustainableWorkers,
      sustainableCoveragePercent
    }
  };
}
