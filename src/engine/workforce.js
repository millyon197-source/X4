import { WARES_DB, mapMacroToWare, getFriendlyModuleName, getWareHourlyRatePerModule } from '../data/wares.js';
import { state } from '../state/store.js';
import MODULES_WORKFORCE from '../data/modules_workforce.json' with { type: 'json' };
import { getPrimaryMacroForWare } from './calculator.js';

// ============================================================================
// src/engine/workforce.js - Workforce Scaling & Habitat Capacity Engine
// ============================================================================

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

  // Life Support Calculations (Food Rations & Medical Supplies)
  // X4 Standard Argon Consumption: 400 workers consume 450 Food Rations and 270 Medical Supplies per hour
  const FOOD_RATIONS_CONSUMPTION = 450 / 400; // 1.125 units/worker/hr
  const MED_SUPPLIES_CONSUMPTION = 270 / 400;  // 0.675 units/worker/hr

  let totalFoodRationsProd = 0;
  let totalArgMedSuppliesProd = 0;
  let totalAllMedSuppliesProd = 0;
  let foodRationsModuleCount = 0;
  let medSuppliesModuleCount = 0;

  const currentWfBonus = typeof workforceBonus === 'number' ? workforceBonus : 0;

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
