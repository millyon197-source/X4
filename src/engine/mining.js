import { WARES_DB } from '../data/wares.js';
import { state } from '../state/store.js';

// ============================================================================
// src/engine/mining.js - Raw Harvesting & Scrap Extraction Engine
// ============================================================================

/**
 * Calculates scrap metal demand of raw scrap wrecks per hour.
 * Evaluates Commonwealth (ScrapMetal) and Terran (TerScrapMetal) recycling requirements.
 *
 * @param {Object} [blueprint] - Station blueprint with rawMacros or modules
 * @param {string} [selectedWareId] - Active single target ware ID
 * @param {Object} [calculatedDemand] - Map of calculated demands
 * @returns {Object} Detailed scrap raw demand breakdown
 */
export function calculateScrapMetalRawScrapDemand(
  blueprint = (typeof state !== 'undefined' ? state.activeBlueprint : null),
  selectedWareId = (typeof state !== 'undefined' ? state.selectedWareId : null),
  calculatedDemand = (typeof state !== 'undefined' && state.calculatedDemand ? state.calculatedDemand : {})
) {
  let genRecyclers = 0;
  let terRecyclers = 0;
  let procModules = 0;
  let genHullMods = 0;
  let genClayMods = 0;
  let terCompMods = 0;
  let terCarbMods = 0;

  if (blueprint) {
    const rawMacros = blueprint.rawMacros || {};
    const modules = blueprint.modules || {};

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
    const selId = selectedWareId;
    if (selId === 'ScrapClaytronics') {
      genClayMods = (calculatedDemand[selId] && calculatedDemand[selId].modulesNeeded) || 1;
      genRecyclers = genClayMods;
    } else if (selId === 'ScrapHullParts') {
      genHullMods = (calculatedDemand[selId] && calculatedDemand[selId].modulesNeeded) || 1;
      genRecyclers = genHullMods;
    } else if (selId === 'TerCompSubstrate') {
      terCompMods = (calculatedDemand[selId] && calculatedDemand[selId].modulesNeeded) || 1;
      terRecyclers = terCompMods;
    } else if (selId === 'TerSilCarbide') {
      terCarbMods = (calculatedDemand[selId] && calculatedDemand[selId].modulesNeeded) || 1;
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
  } else if (procModules > 0 && (!blueprint || blueprint.modules?.['ScrapMetal'])) {
    genRawScrapDemand = procModules * 9000;
  }

  // Terran Scrap Metal demand of Raw Scrap:
  // Computronic Substrate (TER) recipe: 6,000 Scrap Metal per module
  // Silicon Carbide (TER) recipe: 1,500 Scrap Metal per module
  let terRawScrapDemand = 0;
  if (terRecyclers > 0 || terCompMods > 0 || terCarbMods > 0) {
    terRawScrapDemand = (terCompMods * 6000) + (terCarbMods * 1500);
  } else if (procModules > 0 && blueprint?.modules?.['TerScrapMetal']) {
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

/**
 * Calculates Energy Cell demand for scrap recycling and scrap processing modules.
 *
 * @param {Object} [blueprint] - Station blueprint
 * @param {string} [selectedWareId] - Active single target ware ID
 * @param {Object} [calculatedDemand] - Map of calculated demands
 * @returns {Object} Energy Cell demand breakdown for scrap operations
 */
export function calculateScrapMetalEcDemand(
  blueprint = (typeof state !== 'undefined' ? state.activeBlueprint : null),
  selectedWareId = (typeof state !== 'undefined' ? state.selectedWareId : null),
  calculatedDemand = (typeof state !== 'undefined' && state.calculatedDemand ? state.calculatedDemand : {})
) {
  let genRecyclers = 0;
  let terRecyclers = 0;
  let procModules = 0;

  if (blueprint) {
    const rawMacros = blueprint.rawMacros || {};
    const modules = blueprint.modules || {};

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
    const selId = selectedWareId;
    if (selId === 'ScrapClaytronics' || selId === 'ScrapHullParts') {
      genRecyclers = (calculatedDemand[selId] && calculatedDemand[selId].modulesNeeded) || 1;
    } else if (selId === 'TerCompSubstrate' || selId === 'TerSilCarbide') {
      terRecyclers = (calculatedDemand[selId] && calculatedDemand[selId].modulesNeeded) || 1;
    } else if (selId === 'ScrapMetal') {
      genRecyclers = 0;
    } else if (selId === 'TerScrapMetal') {
      terRecyclers = 0;
    }

    const smRate = ((calculatedDemand['ScrapMetal'] && calculatedDemand['ScrapMetal'].rateNeeded) || 0) +
                   ((calculatedDemand['TerScrapMetal'] && calculatedDemand['TerScrapMetal'].rateNeeded) || 0);
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

/**
 * Accumulates raw resource mining and harvesting rates across solid minerals,
 * atmospheric gases, Raw Scrap, Raw Kha'ak Scrap, and Protectyon.
 *
 * @param {Object} [blueprint] - Station blueprint
 * @param {Object} [demand] - Map of calculated demands
 * @returns {Object} Dictionary of raw commodity hourly mining rates
 */
export function accumulateRawMiningRates(
  blueprint = (typeof state !== 'undefined' ? state.activeBlueprint : null),
  demand = (typeof state !== 'undefined' && state.calculatedDemand ? state.calculatedDemand : {})
) {
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

  if (blueprint) {
    // In Blueprint Mode: Calculate raw extraction from actual active blueprint modules
    const bpModules = blueprint.modules || {};
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
  const selWareId = typeof state !== 'undefined' ? state.selectedWareId : null;
  const scrapRaw = calculateScrapMetalRawScrapDemand(blueprint, selWareId, demand);
  if (typeof state !== 'undefined' && state) {
    state.scrapRawDemand = scrapRaw;
  }
  rawTotals['RawScrap'] = scrapRaw.totalRawScrapDemand;

  // Calculate dynamic Raw Kha'ak Scrap demand from Allographyne Fragments & Scrap Processor
  const fragCount = (blueprint && blueprint.modules && blueprint.modules['AllographyneFragments']) || 0;
  const alloProcCount = (blueprint && blueprint.modules && blueprint.modules['AllographyneScrapProc']) || 0;
  const alloProcDemand = (demand['AllographyneScrapProc'] && demand['AllographyneScrapProc'].rateNeeded > 0)
    ? demand['AllographyneScrapProc'].rateNeeded
    : (fragCount * 450);
  if (fragCount > 0 || alloProcCount > 0 || alloProcDemand > 0) {
    rawTotals['RawKhaakScrap'] = alloProcCount > 0 ? Math.max(alloProcCount * 18000, alloProcDemand) : alloProcDemand;
  }

  if (demand['Protectyon'] && demand['Protectyon'].rateNeeded > 0 && rawTotals['Protectyon'] === 0) {
    rawTotals['Protectyon'] = demand['Protectyon'].rateNeeded;
  }

  if (typeof state !== 'undefined' && state) {
    state.rawDemand = rawTotals;

    // Also assign rawTotals to state.calculatedDemand so all L0 cards and Inspector use the exact planned extraction rate!
    if (!state.calculatedDemand) {
      state.calculatedDemand = {};
    }
    Object.entries(rawTotals).forEach(([rawId, rate]) => {
      if (!state.calculatedDemand[rawId]) {
        state.calculatedDemand[rawId] = { rateNeeded: 0, modulesNeeded: 0 };
      }
      state.calculatedDemand[rawId].rateNeeded = rate;
    });
  }

  return rawTotals;
}

export const RAW_MINERAL_WARES = new Set([
  'ore',
  'silicon',
  'ice',
  'hydrogen',
  'helium',
  'methane',
]);

/**
 * Evaluates net hourly raw resource harvesting demand from net production deficits.
 * @param {Object} netWareBalance - Net balance per ware per hour { [wareId]: netAmountPerHour }
 * @returns {Object} Raw extraction requirements { [wareId]: hourlyHarvestRate }
 */
export function calculateMiningRequirements(netWareBalance = {}) {
  const rawRequirements = {};

  for (const ware of RAW_MINERAL_WARES) {
    const pascal = ware.charAt(0).toUpperCase() + ware.slice(1);
    const balance = netWareBalance[ware] !== undefined ? netWareBalance[ware] : (netWareBalance[pascal] || 0);
    // Deficit (negative net balance) indicates required raw extraction
    rawRequirements[ware] = balance < 0 ? Math.abs(balance) : 0;
    if (pascal !== ware) {
      rawRequirements[pascal] = rawRequirements[ware];
    }
  }

  return rawRequirements;
}

/**
 * Calculates Energy Cell production for solar modules based on sector sunlight percentage.
 * @param {number} baseEnergyOutput - Base solar module output per hour
 * @param {number} sunlightPct - Sector sunlight percentage (e.g., 100, 150)
 * @returns {number} Adjusted hourly Energy Cell output
 */
export function calculateSolarOutput(baseEnergyOutput, sunlightPct = 100) {
  const effectiveSunlight = Math.max(0, Number(sunlightPct) || 100) / 100;
  return baseEnergyOutput * effectiveSunlight;
}

