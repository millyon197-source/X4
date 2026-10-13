import { WARES_DB, mapMacroToWare, getFriendlyModuleName, getWareHourlyRatePerModule } from '../data/wares.js';
import { state, store, saveActiveBlueprintToStorage } from '../state/store.js';
import MODULES_WORKFORCE from '../data/modules_workforce.json' with { type: 'json' };
import blueprintsCatalog from '../data/blueprints_catalog.json' with { type: 'json' };
import { getPrimaryMacroForWare, calculateFactoryRequirements } from './calculator.js';
import { rebuildBlueprintFromMacros } from './xmlParser.js';

// ============================================================================
// src/engine/workforce.js - Workforce Scaling & Habitat Capacity Engine
// ============================================================================

export const ALL_FOOD_MED_MACROS = new Set([
  'prod_arg_foodrations_macro', 'prod_arg_medicalsupplies_macro',
  'prod_ter_mre_macro', 'prod_ter_medicalsupplies_macro',
  'prod_bor_bofu_macro', 'prod_bor_medicalsupplies_macro',
  'prod_tel_nostropoil_macro', 'prod_tel_medicalsupplies_macro',
  'prod_par_sojahusk_macro', 'prod_par_medicalsupplies_macro',
  'prod_spl_cheltmeat_macro', 'prod_spl_medicalsupplies_macro'
]);

export const FACTION_FOOD_MED = {
  commonwealth: {
    name: 'Commonwealth',
    race: 'argon',
    foodWare: 'FoodRations',
    foodName: 'Food Rations',
    foodMacro: 'prod_arg_foodrations_macro',
    foodRatePerWorker: 450 / 400, // 1.125 units/worker/hr
    medWare: 'ArgMedicalSupplies',
    medName: 'Medical Supplies',
    medMacro: 'prod_arg_medicalsupplies_macro',
    medRatePerWorker: 270 / 400   // 0.675 units/worker/hr
  },
  argon: {
    name: 'Argon Federation',
    race: 'argon',
    foodWare: 'FoodRations',
    foodName: 'Food Rations',
    foodMacro: 'prod_arg_foodrations_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'ArgMedicalSupplies',
    medName: 'Medical Supplies',
    medMacro: 'prod_arg_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  antigone: {
    name: 'Antigone Republic',
    race: 'argon',
    foodWare: 'FoodRations',
    foodName: 'Food Rations',
    foodMacro: 'prod_arg_foodrations_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'ArgMedicalSupplies',
    medName: 'Medical Supplies',
    medMacro: 'prod_arg_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  terran: {
    name: 'Terran Protectorate',
    race: 'terran',
    foodWare: 'TerranMRE',
    foodName: 'Terran MRE',
    foodMacro: 'prod_ter_mre_macro',
    foodRatePerWorker: 250 / 319, // ~0.7837 units/worker/hr
    medWare: 'TerMedicalSupplies',
    medName: 'TER Medical Supplies',
    medMacro: 'prod_ter_medicalsupplies_macro',
    medRatePerWorker: 270 / 400   // 0.675 units/worker/hr
  },
  pioneers: {
    name: 'Segaris Pioneers',
    race: 'terran',
    foodWare: 'TerranMRE',
    foodName: 'Terran MRE',
    foodMacro: 'prod_ter_mre_macro',
    foodRatePerWorker: 250 / 319,
    medWare: 'TerMedicalSupplies',
    medName: 'TER Medical Supplies',
    medMacro: 'prod_ter_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  boron: {
    name: 'Boron Kingdom',
    race: 'boron',
    foodWare: 'BoFu',
    foodName: 'BoFu',
    foodMacro: 'prod_bor_bofu_macro',
    foodRatePerWorker: 450 / 400, // 1.125 units/worker/hr
    medWare: 'BorMedicalSupplies',
    medName: 'BOR Medical Supplies',
    medMacro: 'prod_bor_medicalsupplies_macro',
    medRatePerWorker: 270 / 400   // 0.675 units/worker/hr
  },
  teladi: {
    name: 'Teladi Company',
    race: 'teladi',
    foodWare: 'NostropOil',
    foodName: 'Nostrop Oil',
    foodMacro: 'prod_tel_nostropoil_macro',
    foodRatePerWorker: 50 / 57,   // ~0.8772 units/worker/hr
    medWare: 'TelMedicalSupplies',
    medName: 'TEL Medical Supplies',
    medMacro: 'prod_tel_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  ministry: {
    name: 'Ministry of Finance',
    race: 'teladi',
    foodWare: 'NostropOil',
    foodName: 'Nostrop Oil',
    foodMacro: 'prod_tel_nostropoil_macro',
    foodRatePerWorker: 50 / 57,
    medWare: 'TelMedicalSupplies',
    medName: 'TEL Medical Supplies',
    medMacro: 'prod_tel_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  paranid: {
    name: 'Godrealm of the Paranid',
    race: 'paranid',
    foodWare: 'SojaHusk',
    foodName: 'Soja Husk',
    foodMacro: 'prod_par_sojahusk_macro',
    foodRatePerWorker: 50 / 57,   // ~0.8772 units/worker/hr
    medWare: 'ParMedicalSupplies',
    medName: 'PAR Medical Supplies',
    medMacro: 'prod_par_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  holyorder: {
    name: 'Holy Order of the Pontifex',
    race: 'paranid',
    foodWare: 'SojaHusk',
    foodName: 'Soja Husk',
    foodMacro: 'prod_par_sojahusk_macro',
    foodRatePerWorker: 50 / 57,
    medWare: 'ParMedicalSupplies',
    medName: 'PAR Medical Supplies',
    medMacro: 'prod_par_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  split: {
    name: 'Zyarth Patriarchy',
    race: 'split',
    foodWare: 'CheltMeat',
    foodName: 'Chelt Meat',
    foodMacro: 'prod_spl_cheltmeat_macro',
    foodRatePerWorker: 450 / 400, // 1.125 units/worker/hr
    medWare: 'SplMedicalSupplies',
    medName: 'SPL Medical Supplies',
    medMacro: 'prod_spl_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  freefamilies: {
    name: 'Free Families',
    race: 'split',
    foodWare: 'CheltMeat',
    foodName: 'Chelt Meat',
    foodMacro: 'prod_spl_cheltmeat_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'SplMedicalSupplies',
    medName: 'SPL Medical Supplies',
    medMacro: 'prod_spl_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  hatikvah: {
    name: 'Hatikvah Free League',
    race: 'argon',
    foodWare: 'FoodRations',
    foodName: 'Food Rations',
    foodMacro: 'prod_arg_foodrations_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'ArgMedicalSupplies',
    medName: 'Medical Supplies',
    medMacro: 'prod_arg_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  ali: {
    name: 'Alliance of the Word',
    race: 'argon',
    foodWare: 'FoodRations',
    foodName: 'Food Rations',
    foodMacro: 'prod_arg_foodrations_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'ArgMedicalSupplies',
    medName: 'Medical Supplies',
    medMacro: 'prod_arg_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  rip: {
    name: 'Riptide Rakers',
    race: 'argon',
    foodWare: 'FoodRations',
    foodName: 'Food Rations',
    foodMacro: 'prod_arg_foodrations_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'ArgMedicalSupplies',
    medName: 'Medical Supplies',
    medMacro: 'prod_arg_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  vigor: {
    name: 'Vigor Syndicate',
    race: 'argon',
    foodWare: 'FoodRations',
    foodName: 'Food Rations',
    foodMacro: 'prod_arg_foodrations_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'ArgMedicalSupplies',
    medName: 'Medical Supplies',
    medMacro: 'prod_arg_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  scaleplate: {
    name: 'Scale Plate Pact',
    race: 'teladi',
    foodWare: 'NostropOil',
    foodName: 'Nostrop Oil',
    foodMacro: 'prod_tel_nostropoil_macro',
    foodRatePerWorker: 50 / 57,
    medWare: 'TelMedicalSupplies',
    medName: 'TEL Medical Supplies',
    medMacro: 'prod_tel_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  yaki: {
    name: 'Yaki',
    race: 'terran',
    foodWare: 'TerranMRE',
    foodName: 'Terran MRE',
    foodMacro: 'prod_ter_mre_macro',
    foodRatePerWorker: 250 / 319,
    medWare: 'TerMedicalSupplies',
    medName: 'TER Medical Supplies',
    medMacro: 'prod_ter_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  buc: {
    name: "Duke's Buccaneers",
    race: 'paranid',
    foodWare: 'SojaHusk',
    foodName: 'Soja Husk',
    foodMacro: 'prod_par_sojahusk_macro',
    foodRatePerWorker: 50 / 57,
    medWare: 'ParMedicalSupplies',
    medName: 'PAR Medical Supplies',
    medMacro: 'prod_par_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  },
  faf: {
    name: 'Fallen Families',
    race: 'split',
    foodWare: 'CheltMeat',
    foodName: 'Chelt Meat',
    foodMacro: 'prod_spl_cheltmeat_macro',
    foodRatePerWorker: 450 / 400,
    medWare: 'SplMedicalSupplies',
    medName: 'SPL Medical Supplies',
    medMacro: 'prod_spl_medicalsupplies_macro',
    medRatePerWorker: 270 / 400
  }
};

/**
 * Checks whether a given station macro is a workforce structure (habitat, spire, etc.).
 * @param {string} macro - Macro identifier
 * @returns {boolean}
 */
export function isWorkforceStructure(macro) {
  if (!macro) return false;
  let data = MODULES_WORKFORCE[macro];
  if (!data) {
    const alt1 = macro.replace('_scraprecycler_', '_scrap_recycler_');
    const alt2 = macro.replace('_scrap_recycler_', '_scraprecycler_');
    data = MODULES_WORKFORCE[alt1] || MODULES_WORKFORCE[alt2];
  }
  if (!data) {
    data = MODULES_WORKFORCE[macro.toLowerCase()];
  }
  return Boolean(data && data.capacity && data.capacity > 0);
}

/**
 * Returns workforce habitation capacity for a single instance of a module macro.
 * @param {string} macro - Macro identifier
 * @returns {number}
 */
export function getModuleWorkforceCapacity(macro) {
  if (!macro) return 0;
  let data = MODULES_WORKFORCE[macro];
  if (!data) {
    const alt1 = macro.replace('_scraprecycler_', '_scrap_recycler_');
    const alt2 = macro.replace('_scrap_recycler_', '_scraprecycler_');
    data = MODULES_WORKFORCE[alt1] || MODULES_WORKFORCE[alt2];
  }
  if (!data) {
    data = MODULES_WORKFORCE[macro.toLowerCase()];
  }
  return (data && data.capacity && data.capacity > 0) ? data.capacity : 0;
}

/**
 * Checks if a blueprint contains any workforce structures with quantity > 0.
 * @param {Object} blueprint - Station blueprint
 * @returns {boolean}
 */
export function hasWorkforceStructures(blueprint) {
  if (!blueprint) return false;
  const rawMacros = blueprint.rawMacros || {};
  return Object.entries(rawMacros).some(([macro, count]) => count > 0 && isWorkforceStructure(macro));
}

/**
 * Calculates required Food and Medicine modules for the station's workforce
 * using the selected faction's supply chain, and inserts or adjusts modules
 * into the blueprint to ensure 100% life support coverage.
 *
 * @param {Object} [blueprint=state.activeBlueprint] - Active blueprint
 * @param {string} [factionMethod=state.factionConstructionMethod] - Selected faction
 * @returns {Object|null}
 */
export function autoSupportWorkforceWithFoodAndMedicine(
  blueprint = (typeof state !== 'undefined' ? state.activeBlueprint : null),
  factionMethod = (typeof state !== 'undefined' ? state.factionConstructionMethod : 'commonwealth'),
  replaceOtherFactions = false
) {
  if (!blueprint) return null;
  if (!blueprint.rawMacros) blueprint.rawMacros = {};
  if (!blueprint.rootMacros) blueprint.rootMacros = { ...blueprint.rawMacros };

  let totalCapacity = 0;
  Object.entries(blueprint.rawMacros).forEach(([m, count]) => {
    if (count > 0 && isWorkforceStructure(m)) {
      totalCapacity += getModuleWorkforceCapacity(m) * count;
    }
  });

  if (totalCapacity <= 0) return null;

  const factionKey = (factionMethod || 'commonwealth').toLowerCase();
  const cfg = FACTION_FOOD_MED[factionKey] || FACTION_FOOD_MED.commonwealth;

  if (replaceOtherFactions) {
    for (const m of ALL_FOOD_MED_MACROS) {
      if (m !== cfg.foodMacro && m !== cfg.medMacro) {
        if (blueprint.rawMacros[m]) delete blueprint.rawMacros[m];
        if (blueprint.rootMacros && blueprint.rootMacros[m]) delete blueprint.rootMacros[m];
      }
    }
  }

  const currentWfBonus = (typeof state !== 'undefined' && typeof state.workforceBonus === 'number') ? state.workforceBonus : 0;
  const foodBaseRate = getWareHourlyRatePerModule(cfg.foodWare, currentWfBonus) || (WARES_DB[cfg.foodWare] && WARES_DB[cfg.foodWare].baseRate) || 1;
  const medBaseRate = getWareHourlyRatePerModule(cfg.medWare, currentWfBonus) || (WARES_DB[cfg.medWare] && WARES_DB[cfg.medWare].baseRate) || 1;

  let changed = false;
  let neededFoodModules = 0;
  let neededMedModules = 0;
  let finalWfBasis = totalCapacity;

  // Convergence loop to account for self-workforce requirements of the life support factories
  for (let iter = 0; iter < 5; iter++) {
    const wfSummary = calculateBlueprintWorkforce(blueprint, currentWfBonus, factionMethod);
    finalWfBasis = Math.max(totalCapacity, wfSummary.totalOptimalWorkforce || 0);

    const foodRateNeeded = finalWfBasis * cfg.foodRatePerWorker;
    const medRateNeeded = finalWfBasis * cfg.medRatePerWorker;

    neededFoodModules = Math.max(1, Math.ceil(foodRateNeeded / foodBaseRate));
    neededMedModules = Math.max(1, Math.ceil(medRateNeeded / medBaseRate));

    const curFood = blueprint.rawMacros[cfg.foodMacro] || 0;
    const curMed = blueprint.rawMacros[cfg.medMacro] || 0;

    let iterChanged = false;
    if (replaceOtherFactions || curFood < neededFoodModules) {
      if (blueprint.rawMacros[cfg.foodMacro] !== neededFoodModules) {
        blueprint.rawMacros[cfg.foodMacro] = neededFoodModules;
        blueprint.rootMacros[cfg.foodMacro] = neededFoodModules;
        changed = true;
        iterChanged = true;
      }
    }
    if (replaceOtherFactions || curMed < neededMedModules) {
      if (blueprint.rawMacros[cfg.medMacro] !== neededMedModules) {
        blueprint.rawMacros[cfg.medMacro] = neededMedModules;
        blueprint.rootMacros[cfg.medMacro] = neededMedModules;
        changed = true;
        iterChanged = true;
      }
    }

    if (!iterChanged) break;
  }

  return {
    changed,
    totalCapacity,
    wfBasis: finalWfBasis,
    faction: factionKey,
    foodWare: cfg.foodWare,
    foodMacro: cfg.foodMacro,
    neededFoodModules,
    medWare: cfg.medWare,
    medMacro: cfg.medMacro,
    neededMedModules
  };
}

/**
 * Determines the most prominent faction in a station blueprint based on module frequencies.
 * Maps factions to one of the standard FACTION_FOOD_MED keys:
 * 'commonwealth' (Argon), 'terran', 'boron', 'teladi', 'paranid', 'split'.
 *
 * @param {Object} blueprint - Station blueprint
 * @returns {string} Prominent faction key
 */
export function getMostProminentFaction(blueprint) {
  if (!blueprint) return (typeof state !== 'undefined' && state.factionConstructionMethod) ? state.factionConstructionMethod.toLowerCase() : 'commonwealth';

  const rawMacros = blueprint.rawMacros || {};
  const factionScores = {
    terran: 0,
    boron: 0,
    teladi: 0,
    paranid: 0,
    split: 0,
    argon: 0
  };

  const scoreMacro = (macro, count) => {
    if (!macro || count <= 0) return;
    const lower = macro.toLowerCase();
    if (lower.includes('_ter_') || lower.includes('_terran_')) {
      factionScores.terran += count;
    } else if (lower.includes('_bor_') || lower.includes('_boron_')) {
      factionScores.boron += count;
    } else if (lower.includes('_tel_') || lower.includes('_teladi_')) {
      factionScores.teladi += count;
    } else if (lower.includes('_par_') || lower.includes('_paranid_')) {
      factionScores.paranid += count;
    } else if (lower.includes('_spl_') || lower.includes('_split_')) {
      factionScores.split += count;
    } else if (lower.includes('_arg_') || lower.includes('_argon_') || lower.includes('_pir_') || lower.includes('_antigone_') || lower.includes('antigonespire') || lower.includes('antigonepillar')) {
      factionScores.argon += count;
    } else if (lower.includes('_gen_')) {
      // General modules in X4 belong to Commonwealth / Argon standard
      factionScores.argon += count * 0.5;
    }
  };

  if (Object.keys(rawMacros).length > 0) {
    Object.entries(rawMacros).forEach(([m, count]) => scoreMacro(m, count));
  } else if (blueprint.modules && Object.keys(blueprint.modules).length > 0) {
    Object.entries(blueprint.modules).forEach(([wId, count]) => {
      const pm = getPrimaryMacroForWare(wId);
      if (pm) scoreMacro(pm, count);
    });
  }

  let prominentFaction = 'commonwealth';
  let maxScore = 0;
  for (const [faction, score] of Object.entries(factionScores)) {
    if (score > maxScore) {
      maxScore = score;
      prominentFaction = faction;
    }
  }

  if (maxScore === 0) {
    if (typeof state !== 'undefined' && state.factionConstructionMethod) {
      return state.factionConstructionMethod.toLowerCase();
    }
    return 'commonwealth';
  }

  if (prominentFaction === 'argon') return 'commonwealth';
  return prominentFaction;
}

/**
 * Looks at owned modules and returns the largest habitat module macro
 * for the specified faction to provide workforce capacity.
 * Considers both standard L/M/S habitats and _spire habs (e.g. Argon XL Housing Spire).
 *
 * @param {string} factionKey - Faction key ('commonwealth', 'terran', 'boron', 'teladi', 'paranid', 'split', etc.)
 * @returns {{ macro: string, capacity: number, name: string, race: string, isSpire: boolean, isOwned: boolean }}
 */
export function getLargestOwnedHabitatMacro(factionKey = 'commonwealth') {
  const normKey = (factionKey || 'commonwealth').toLowerCase();
  const cfg = FACTION_FOOD_MED[normKey] || FACTION_FOOD_MED.commonwealth;
  const targetRace = cfg.race; // 'argon', 'terran', 'boron', 'teladi', 'paranid', 'split'

  let dynamicOwnedSet = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('x4_owned_blueprints');
      if (stored) dynamicOwnedSet = new Set(JSON.parse(stored));
    }
  } catch (e) {}

  const isMacroOwned = (macro) => {
    if (dynamicOwnedSet) {
      if (dynamicOwnedSet.has(macro) || dynamicOwnedSet.has(macro.toLowerCase())) return true;
    }
    const catEntry = blueprintsCatalog?.blueprints?.find(b => b.macro === macro || b.id === macro);
    if (catEntry && catEntry.unlocked) return true;
    return false;
  };

  const candidates = [];
  for (const [macro, data] of Object.entries(MODULES_WORKFORCE)) {
    if (!data || !data.capacity || data.capacity <= 0) continue;
    if (data.race !== targetRace) continue;

    const isSpire = macro.includes('spire') || macro.includes('pillar');
    const isStandardHab = macro.startsWith('hab_');
    if (!isStandardHab && !isSpire) continue;

    const catEntry = blueprintsCatalog?.blueprints?.find(b => b.macro === macro || b.id === macro);
    const friendlyName = catEntry?.name || getFriendlyModuleName(macro, normKey) || macro;
    const owned = isMacroOwned(macro);

    candidates.push({
      macro,
      capacity: data.capacity,
      name: friendlyName,
      race: targetRace,
      isSpire,
      isOwned: owned
    });
  }

  // Sort descending by capacity (2000 > 1000 > 500 > 250 > 100)
  candidates.sort((a, b) => b.capacity - a.capacity);

  // Consider _spire habs (e.g. landmarks_arg_antigonespire_01_macro, capacity 2000)
  const ownedCandidates = candidates.filter(c => c.isOwned || c.isSpire);
  if (ownedCandidates.length > 0) {
    return ownedCandidates[0];
  }

  if (candidates.length > 0) {
    return candidates[0];
  }

  const defaultHab = targetRace === 'terran' ? 'hab_ter_l_01_macro' : `hab_${targetRace.slice(0,3)}_l_01_macro`;
  return {
    macro: defaultHab,
    capacity: MODULES_WORKFORCE[defaultHab]?.capacity || 1000,
    name: getFriendlyModuleName(defaultHab, normKey) || 'L Habitat',
    race: targetRace,
    isSpire: false,
    isOwned: false
  };
}

/**
 * Checks if the blueprint currently has 100% workforce coverage with a positive surplus and no food/med shortages.
 *
 * @param {Object} blueprint - Active blueprint
 * @returns {boolean}
 */
export function isWorkforceFullySupported(blueprint) {
  if (!blueprint) return false;
  const wf = calculateBlueprintWorkforce(blueprint);
  if (wf.totalOptimalWorkforce <= 0 && wf.totalHabitationCapacity <= 0) return false;
  const hasSurplus = wf.surplusDeficit >= 0 && wf.coveragePercent >= 100;
  const hasFood = !wf.lifeSupport || wf.lifeSupport.foodBalance >= 0;
  const hasMed = !wf.lifeSupport || wf.lifeSupport.medBalance >= 0;
  return hasSurplus && hasFood && hasMed;
}

/**
 * Applies workforce support:
 * When checked:
 *   1. Determines the most prominent faction in the loaded blueprint.
 *   2. Selects the largest habitat module (looking at owned modules and considering _spire habs).
 *   3. Inserts modules needed to provide a minimum surplus of workers (surplus >= 0).
 *   4. Inserts the required Food and Medicine modules for the prominent faction with convergence.
 *   5. Tracks all auto-added modules so they can be reverted if unchecked.
 * When unchecked:
 *   Reverts the auto-added modules and recalculates.
 *
 * @param {boolean} checked - Checkbox state
 * @param {Function} [onRender] - Optional render callback
 */
export function applySupportWorkforce(checked, onRender) {
  if (!state.activeBlueprint) return;
  if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
  if (!state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };

  const preservedFocus = state.focusedBiPanel || 'workforce-summary';

  if (!checked) {
    state.supportWorkforce = false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('x4_support_workforce', 'false');
      }
    } catch (e) {}

    // Revert auto-added modules
    if (state.activeBlueprint._autoWfAddedMacros) {
      for (const [m, count] of Object.entries(state.activeBlueprint._autoWfAddedMacros)) {
        if (state.activeBlueprint.rawMacros[m]) {
          state.activeBlueprint.rawMacros[m] = Math.max(0, (state.activeBlueprint.rawMacros[m] || 0) - count);
          if (state.activeBlueprint.rawMacros[m] <= 0) {
            delete state.activeBlueprint.rawMacros[m];
          }
        }
        if (state.activeBlueprint.rootMacros && state.activeBlueprint.rootMacros[m]) {
          state.activeBlueprint.rootMacros[m] = Math.max(0, (state.activeBlueprint.rootMacros[m] || 0) - count);
          if (state.activeBlueprint.rootMacros[m] <= 0) {
            delete state.activeBlueprint.rootMacros[m];
          }
        }
      }
      delete state.activeBlueprint._autoWfAddedMacros;
    }

    rebuildBlueprintFromMacros(state.activeBlueprint);
    calculateFactoryRequirements();
    saveActiveBlueprintToStorage();

    if (preservedFocus) state.focusedBiPanel = preservedFocus;
    if (typeof onRender === 'function') {
      onRender();
    } else if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
      window.renderApp();
    }
    if (store && typeof store.notify === 'function') {
      store.notify('WORKFORCE_SUPPORT_REVERTED');
    }
    return;
  }

  // --- CHECKED: Auto-Support Workforce ---
  state.supportWorkforce = true;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('x4_support_workforce', 'true');
    }
  } catch (e) {}

  // 1. Determine most prominent faction in loaded blueprint
  const prominentFaction = getMostProminentFaction(state.activeBlueprint);
  state.factionConstructionMethod = prominentFaction;
  const factionCfg = FACTION_FOOD_MED[prominentFaction] || FACTION_FOOD_MED.commonwealth;

  // 2. Determine largest owned habitat module (considering _spire habs)
  const largestHab = getLargestOwnedHabitatMacro(prominentFaction);
  const habMacro = largestHab.macro;
  const habCapacity = largestHab.capacity || 1000;

  // Track additions
  if (!state.activeBlueprint._autoWfAddedMacros) {
    state.activeBlueprint._autoWfAddedMacros = {};
  }
  const autoAdded = state.activeBlueprint._autoWfAddedMacros;

  const currentWfBonus = (typeof state !== 'undefined' && typeof state.workforceBonus === 'number') ? state.workforceBonus : 0;
  const foodBaseRate = getWareHourlyRatePerModule(factionCfg.foodWare, currentWfBonus) || (WARES_DB[factionCfg.foodWare]?.baseRate) || 1;
  const medBaseRate = getWareHourlyRatePerModule(factionCfg.medWare, currentWfBonus) || (WARES_DB[factionCfg.medWare]?.baseRate) || 1;

  // Convergence loop: Habitats + Food + Medicine
  for (let pass = 0; pass < 6; pass++) {
    const wfSummary = calculateBlueprintWorkforce(state.activeBlueprint, currentWfBonus, prominentFaction);
    const optimalWf = wfSummary.totalOptimalWorkforce || 0;
    const currentCap = wfSummary.totalHabitationCapacity || 0;

    let passChanged = false;

    // A. Ensure minimum surplus of workers: totalHabitationCapacity >= totalOptimalWorkforce
    if (currentCap < optimalWf) {
      const deficit = optimalWf - currentCap;
      const additionalHabsNeeded = Math.ceil(deficit / habCapacity);
      if (additionalHabsNeeded > 0) {
        state.activeBlueprint.rawMacros[habMacro] = (state.activeBlueprint.rawMacros[habMacro] || 0) + additionalHabsNeeded;
        state.activeBlueprint.rootMacros[habMacro] = (state.activeBlueprint.rootMacros[habMacro] || 0) + additionalHabsNeeded;
        autoAdded[habMacro] = (autoAdded[habMacro] || 0) + additionalHabsNeeded;
        passChanged = true;
      }
    }

    // Recalculate capacity after habitat addition
    const updatedCap = Object.entries(state.activeBlueprint.rawMacros).reduce((acc, [m, count]) => {
      return acc + (getModuleWorkforceCapacity(m) * count);
    }, 0);

    // B. Calculate Food and Medicine requirements to support optimal workforce and habitat capacity
    const effectiveBasis = Math.max(optimalWf, updatedCap);
    const hourlyFoodNeeded = effectiveBasis * factionCfg.foodRatePerWorker;
    const hourlyMedNeeded = effectiveBasis * factionCfg.medRatePerWorker;

    const neededFoodModules = Math.max(1, Math.ceil(hourlyFoodNeeded / foodBaseRate));
    const neededMedModules = Math.max(1, Math.ceil(hourlyMedNeeded / medBaseRate));

    const curFood = state.activeBlueprint.rawMacros[factionCfg.foodMacro] || 0;
    const curMed = state.activeBlueprint.rawMacros[factionCfg.medMacro] || 0;

    if (curFood < neededFoodModules) {
      const diff = neededFoodModules - curFood;
      state.activeBlueprint.rawMacros[factionCfg.foodMacro] = neededFoodModules;
      state.activeBlueprint.rootMacros[factionCfg.foodMacro] = neededFoodModules;
      autoAdded[factionCfg.foodMacro] = (autoAdded[factionCfg.foodMacro] || 0) + diff;
      passChanged = true;
    }

    if (curMed < neededMedModules) {
      const diff = neededMedModules - curMed;
      state.activeBlueprint.rawMacros[factionCfg.medMacro] = neededMedModules;
      state.activeBlueprint.rootMacros[factionCfg.medMacro] = neededMedModules;
      autoAdded[factionCfg.medMacro] = (autoAdded[factionCfg.medMacro] || 0) + diff;
      passChanged = true;
    }

    if (!passChanged) break;
  }

  // Also auto-reset filters in Planned tab if they would hide the new modules
  state.hideFoodAgriPlanned = false;
  state.filterStructuresPlanned = false;
  state.filterWaresPlanned = false;

  rebuildBlueprintFromMacros(state.activeBlueprint);
  calculateFactoryRequirements();
  saveActiveBlueprintToStorage();

  if (preservedFocus) state.focusedBiPanel = preservedFocus;
  if (typeof onRender === 'function') {
    onRender();
  } else if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
    window.renderApp();
  }
  if (store && typeof store.notify === 'function') {
    store.notify('WORKFORCE_SUPPORT_UPDATED');
  }
}

/**
 * Calculates optimal workforce, habitat capacity, housing coverage,
 * and life support provisions for a given station blueprint.
 *
 * @param {Object} blueprint - Station blueprint with rawMacros or modules
 * @param {number} workforceBonus - Current workforce efficiency bonus percentage (0-100)
 * @param {string} factionConstructionMethod - Selected faction construction method
 * @returns {Object} Comprehensive workforce summary and life support balances
 */
export function calculateBlueprintWorkforce(
  blueprint = (typeof state !== 'undefined' ? state.activeBlueprint : null),
  workforceBonus = (typeof state !== 'undefined' && typeof state.workforceBonus === 'number' ? state.workforceBonus : 0),
  factionConstructionMethod = (typeof state !== 'undefined' ? state.factionConstructionMethod : 'commonwealth')
) {
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

    const friendlyName = getFriendlyModuleName(macro, factionConstructionMethod);

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

  // Life Support Calculations (Faction Food & Medical Supplies)
  const prominent = blueprint ? getMostProminentFaction(blueprint) : null;
  const factionKey = (factionConstructionMethod || prominent || (typeof state !== 'undefined' ? state.factionConstructionMethod : 'commonwealth') || 'commonwealth').toLowerCase();
  const cfg = FACTION_FOOD_MED[factionKey] || FACTION_FOOD_MED.commonwealth;

  const FOOD_CONSUMPTION = cfg.foodRatePerWorker;
  const MED_CONSUMPTION = cfg.medRatePerWorker;

  let totalFactionFoodProd = 0;
  let totalAllFoodProd = 0;
  let totalFactionMedProd = 0;
  let totalAllMedSuppliesProd = 0;
  let foodModuleCount = 0;
  let medSuppliesModuleCount = 0;

  const currentWfBonus = typeof workforceBonus === 'number' ? workforceBonus : 0;

  const evalLifeSupportMacro = (macro, count) => {
    if (!macro || count <= 0) return;
    const wareId = mapMacroToWare(macro);
    const ware = WARES_DB[wareId];
    if (!ware) return;

    const hourlyProd = count * getWareHourlyRatePerModule(wareId, currentWfBonus);

    // Food production tracking
    if (wareId === cfg.foodWare) {
      totalFactionFoodProd += hourlyProd;
      foodModuleCount += count;
    }
    if (wareId === 'FoodRations' || wareId === 'TerranMRE' || wareId === 'BoFu' || wareId === 'NostropOil' || wareId === 'SojaHusk' || wareId === 'CheltMeat') {
      totalAllFoodProd += hourlyProd;
    }

    // Medical supplies tracking
    if (wareId === cfg.medWare) {
      totalFactionMedProd += hourlyProd;
      medSuppliesModuleCount += count;
    }
    if (wareId && wareId.endsWith('MedicalSupplies')) {
      totalAllMedSuppliesProd += hourlyProd;
      if (wareId !== cfg.medWare) {
        medSuppliesModuleCount += count;
      }
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

  const effectiveWorkforce = totalOptimalWorkforce > 0 ? totalOptimalWorkforce : totalHabitationCapacity;
  const foodDemand = effectiveWorkforce * FOOD_CONSUMPTION;
  const medicalSuppliesDemand = effectiveWorkforce * MED_CONSUMPTION;

  const totalFoodProd = totalFactionFoodProd > 0 ? totalFactionFoodProd : totalAllFoodProd;
  const totalMedProd = totalFactionMedProd > 0 ? totalFactionMedProd : totalAllMedSuppliesProd;

  const workersSustainableByFood = totalFoodProd > 0 ? Math.floor(totalFoodProd / FOOD_CONSUMPTION) : 0;
  const workersSustainableByMed = totalMedProd > 0 ? Math.floor(totalMedProd / MED_CONSUMPTION) : 0;

  const rawSustainableWorkers = Math.min(workersSustainableByFood, workersSustainableByMed);
  // Sustainable workers capped at workforce basis
  const sustainableWorkers = effectiveWorkforce > 0 ? Math.min(rawSustainableWorkers, effectiveWorkforce) : 0;
  const sustainableCoveragePercent = effectiveWorkforce > 0
    ? Math.min(100, Math.round((sustainableWorkers / effectiveWorkforce) * 100))
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
      foodName: cfg.foodName,
      medName: cfg.medName,
      foodRationsModuleCount: foodModuleCount,
      foodModuleCount,
      medSuppliesModuleCount,
      totalFoodProd,
      totalMedProd,
      totalFoodRationsProd: totalFoodProd,
      totalArgMedSuppliesProd: totalMedProd,
      totalAllMedSuppliesProd,
      foodDemand,
      foodRationsDemand: foodDemand,
      medicalSuppliesDemand,
      foodBalance: totalFoodProd - foodDemand,
      medBalance: totalMedProd - medicalSuppliesDemand,
      workersSustainableByFood,
      workersSustainableByMed,
      rawSustainableWorkers,
      sustainableWorkers,
      sustainableCoveragePercent
    }
  };
}

/**
 * Calculates total workforce required across all active station modules.
 * @param {Object} modules - Active module counts { [macroName]: count }
 * @returns {number} Total workforce capacity required
 */
export function calculateRequiredWorkforce(modules = {}) {
  let totalRequired = 0;
  for (const [macro, count] of Object.entries(modules)) {
    if (!macro || count <= 0) continue;
    let entry = MODULES_WORKFORCE[macro];
    if (!entry) {
      const alt1 = macro.replace('_scraprecycler_', '_scrap_recycler_');
      const alt2 = macro.replace('_scrap_recycler_', '_scraprecycler_');
      entry = MODULES_WORKFORCE[alt1] || MODULES_WORKFORCE[alt2];
    }
    if (!entry) {
      entry = MODULES_WORKFORCE[macro.toLowerCase()];
    }
    if (!entry && macro.startsWith('prod_')) {
      const genMacro = macro.replace(/^prod_[a-z]+_/, 'prod_gen_');
      entry = MODULES_WORKFORCE[genMacro] || MODULES_WORKFORCE[genMacro.toLowerCase()];
    }
    if (!entry) {
      const wareId = mapMacroToWare(macro);
      if (wareId) {
        const primaryMacro = getPrimaryMacroForWare(wareId);
        if (primaryMacro && primaryMacro !== macro) {
          entry = MODULES_WORKFORCE[primaryMacro] || MODULES_WORKFORCE[primaryMacro.toLowerCase()];
        }
      }
    }
    const requiredPerModule = typeof entry === 'number' ? entry : (entry?.max || 0);
    totalRequired += requiredPerModule * count;
  }
  return totalRequired;
}

/**
 * Calculates the workforce efficiency multiplier for a factory.
 * @param {number} currentWorkforce - Active worker population
 * @param {number} requiredWorkforce - Total required workforce across station
 * @param {number} maxBonus - Maximum workforce bonus ratio (default 1.0 = +100%)
 * @returns {number} Multiplier (1.0 = 100% normal output, 2.0 = 200% max output)
 */
export function calculateWorkforceEfficiency(currentWorkforce, requiredWorkforce, maxBonus = 1.0) {
  if (!requiredWorkforce || requiredWorkforce <= 0 || !currentWorkforce || currentWorkforce <= 0) {
    return 1.0; // Base efficiency without workforce
  }

  const fillRatio = Math.min(1.0, currentWorkforce / requiredWorkforce);
  return 1.0 + fillRatio * maxBonus;
}

