/**
 * src/engine/buildCost.js
 * Station construction materials and credit cost estimation engine.
 */

import buildCostsCatalog from '../data/macro_costs.json' with { type: 'json' };
import crissianCostsCatalog from '../data/crissian_build_costs.json' with { type: 'json' };
import { getWareUnitPrice } from './prices.js';

// Combine catalogs so all 343+ game macros are covered
const mergedCostsCatalog = { ...crissianCostsCatalog, ...buildCostsCatalog };

/**
 * Calculates aggregate construction resources and estimated credits for planned modules.
 * 
 * @param {Object} modules - { [macroName]: count } or blueprint object
 * @param {string} [constructionMethod='commonwealth'] - 'commonwealth' | 'terran' | 'boron'
 * @param {'min'|'avg'|'max'} [priceType='avg'] - Credit price evaluation tier
 * @param {Object} [priceOverrides={}] - Custom prices per ware { [wareId]: pricePerUnit }
 * @returns {Object} Detailed material list with unit & total credit breakdowns
 */
export function calculateBuildCosts(
  modules = {}, 
  constructionMethod = 'commonwealth', 
  priceType = 'avg',
  priceOverrides = {}
) {
  // Support passing blueprint object or rawMacros directly
  const moduleMap = modules?.rawMacros || modules?.modules || modules || {};
  const method = (constructionMethod || 'commonwealth').toLowerCase();
  const resourceBreakdown = {};
  let totalWareUnits = 0;
  let totalCredits = 0;

  for (const [macro, count] of Object.entries(moduleMap)) {
    if (!count || count <= 0) continue;

    const moduleRecipe = mergedCostsCatalog[macro] || buildCostsCatalog[macro];
    if (!moduleRecipe) continue;

    const wareRecipe = (moduleRecipe[method] || moduleRecipe['commonwealth']) 
      ? (moduleRecipe[method] || moduleRecipe['commonwealth']) 
      : moduleRecipe;

    for (const [ware, qtyPerModule] of Object.entries(wareRecipe)) {
      if (typeof qtyPerModule !== 'number' || qtyPerModule <= 0) continue;
      const totalQty = qtyPerModule * count;
      const unitPrice = getWareUnitPrice(ware, priceType, priceOverrides);
      const subtotalCredits = totalQty * unitPrice;

      if (!resourceBreakdown[ware]) {
        resourceBreakdown[ware] = {
          quantity: 0,
          unitPrice,
          totalCredits: 0,
        };
      }

      resourceBreakdown[ware].quantity += totalQty;
      resourceBreakdown[ware].totalCredits += subtotalCredits;

      totalWareUnits += totalQty;
      totalCredits += subtotalCredits;
    }
  }

  return {
    resources: resourceBreakdown, // { [wareId]: { quantity, unitPrice, totalCredits } }
    totals: {
      totalWareUnits,
      totalCredits,
    },
    priceType,
    constructionMethod: method,
  };
}
