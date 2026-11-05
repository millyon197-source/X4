// Blueprint data gathering extracted from the blueprint overview (Stage 4, step 8b).
// Both functions only read the state object they are given.
import { WARES_DB, getFriendlyModuleName, mapMacroToWare } from '../../data/wares.js';
import { getPrimaryMacroForWare } from '../../engine/calculator.js';
import { isMacroBlueprintOwned, isWareModuleOwned } from '../../engine/blueprintOwnership.js';
import { getModuleCategoryLabel, getModuleCategoryOrder } from './moduleCategory.js';

// Blueprint modules the player has not unlocked, sorted by category then name.
export function gatherUnownedModules(state) {
  const unownedModules = [];
  let totalUnownedCount = 0;

  if (state.activeBlueprint && state.serverModules) {
    const rawMacros = state.activeBlueprint.rawMacros || {};
    const handledWares = new Set();

    Object.entries(rawMacros).forEach(([macro, count]) => {
      if (count > 0 && !isMacroBlueprintOwned(macro, state.serverModules)) {
        const friendly = getFriendlyModuleName(macro, state.factionConstructionMethod);
        const wareId = mapMacroToWare(macro);
        const ware = wareId ? WARES_DB[wareId] : null;
        if (wareId) handledWares.add(wareId);
        unownedModules.push({
          macro,
          count,
          friendly,
          wareId,
          ware,
          category: ware ? `Level ${ware.level} ${ware.cat}` : getModuleCategoryLabel(macro, friendly),
          catOrder: getModuleCategoryOrder(macro, friendly)
        });
        totalUnownedCount += count;
      }
    });

    if (state.activeBlueprint.modules) {
      Object.entries(state.activeBlueprint.modules).forEach(([wId, count]) => {
        if (count > 0 && !handledWares.has(wId) && WARES_DB[wId]) {
          const ownership = isWareModuleOwned(wId, state.serverModules, { factionMethod: state.factionConstructionMethod });
          if (ownership.hasModule && !ownership.isOwned) {
            const ware = WARES_DB[wId];
            const primaryMacro = getPrimaryMacroForWare(wId) || wId;
            const friendly = ware.name;
            unownedModules.push({
              macro: primaryMacro,
              count,
              friendly,
              wareId: wId,
              ware,
              category: `Level ${ware.level} ${ware.cat}`,
              catOrder: 0
            });
            totalUnownedCount += count;
          }
        }
      });
    }
  }

  unownedModules.sort((a, b) => {
    if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
    return a.friendly.localeCompare(b.friendly);
  });
  return { unownedModules, totalUnownedCount };
}

// Blueprint modules that do not map to any ware, grouped by friendly name.
export function gatherNonContributing(state) {
  const nonContributingMap = {};
  let totalNonContributingCount = 0;

  if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([macro, count]) => {
      if (!mapMacroToWare(macro) && count > 0) {
        const friendly = getFriendlyModuleName(macro);
        const catOrder = getModuleCategoryOrder(macro, friendly);
        if (!nonContributingMap[friendly]) {
          nonContributingMap[friendly] = { count: 0, catOrder, name: friendly, macro };
        }
        nonContributingMap[friendly].count += count;
        totalNonContributingCount += count;
      }
    });
  }
  return { nonContributingMap, totalNonContributingCount };
}

// Level 1-3 wares shown in the blueprint overview's production table, as [wareId, demand] pairs,
// ordered by state.bpSortField / state.bpSortAsc. liveDemand is the demand map the view is using;
// smOutputNonZero forces the scrap-recycling rows in.
export function buildSortedProductionEntries(state, liveDemand, smOutputNonZero) {
  const dbOrder = Object.keys(WARES_DB);
  const bpEntriesMap = {};
  
  // 1. Add all Level 1-3 modules in active blueprint
  if (state.activeBlueprint && state.activeBlueprint.modules) {
    Object.entries(state.activeBlueprint.modules).forEach(([wId, count]) => {
      if (count > 0 && WARES_DB[wId] && WARES_DB[wId].level >= 1 && WARES_DB[wId].level <= 3) {
        const calc = liveDemand[wId] || (state.calculatedDemand && state.calculatedDemand[wId]) || { modulesNeeded: count, rateNeeded: 0 };
        bpEntriesMap[wId] = calc;
      }
    });
  }

  // 2. Add all Level 1-3 wares in liveDemand with rateNeeded > 0
  Object.entries(liveDemand).forEach(([wId, calc]) => {
    if (calc && calc.rateNeeded > 0 && WARES_DB[wId] && WARES_DB[wId].level >= 1 && WARES_DB[wId].level <= 3) {
      bpEntriesMap[wId] = calc;
    }
  });

  // 3. Add all Level 1-3 wares in calculatedDemand with rateNeeded > 0
  if (state.calculatedDemand) {
    Object.entries(state.calculatedDemand).forEach(([wId, calc]) => {
      if (calc && calc.rateNeeded > 0 && WARES_DB[wId] && WARES_DB[wId].level >= 1 && WARES_DB[wId].level <= 3) {
        if (!bpEntriesMap[wId]) bpEntriesMap[wId] = calc;
      }
    });
  }

  if (smOutputNonZero) {
    bpEntriesMap['ScrapClaytronics'] = liveDemand['ScrapClaytronics'] || (state.calculatedDemand && state.calculatedDemand['ScrapClaytronics']) || { modulesNeeded: 0, rateNeeded: 0 };
    if (liveDemand['ScrapProc'] || (state.calculatedDemand && state.calculatedDemand['ScrapProc'])) {
      bpEntriesMap['ScrapProc'] = liveDemand['ScrapProc'] || state.calculatedDemand['ScrapProc'];
    }
  }

  const sortedEntries = Object.entries(bpEntriesMap)
    .sort(([idA, calcA], [idB, calcB]) => {
      const wareA = WARES_DB[idA];
      const wareB = WARES_DB[idB];
      if (state.bpSortField === 'needed') {
        const neededA = calcA.modulesNeeded || 0;
        const neededB = calcB.modulesNeeded || 0;
        if (neededA !== neededB) {
          return state.bpSortAsc ? neededA - neededB : neededB - neededA;
        }
        return wareA.level !== wareB.level ? wareA.level - wareB.level : (dbOrder.indexOf(idA) - dbOrder.indexOf(idB));
      } else if (state.bpSortField === 'component') {
        const compComp = wareA.name.localeCompare(wareB.name);
        return state.bpSortAsc ? compComp : -compComp;
      } else {
        // Default: Sort by level (L1 -> L2 -> L3 -> L4), then by card display order in matrix
        if (wareA.level !== wareB.level) {
          return state.bpSortAsc ? wareA.level - wareB.level : wareB.level - wareA.level;
        }
        const orderDiff = dbOrder.indexOf(idA) - dbOrder.indexOf(idB);
        return state.bpSortAsc ? orderDiff : -orderDiff;
      }
    });
  return sortedEntries;
}
