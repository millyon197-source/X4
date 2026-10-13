/**
 * src/engine/buildCost.js
 * Station construction materials and credit cost estimation engine.
 */

import buildCostsCatalog from '../data/macro_costs.json' with { type: 'json' };
import crissianCostsCatalog from '../data/crissian_build_costs.json' with { type: 'json' };
import blueprintsCatalog from '../data/blueprints_catalog.json' with { type: 'json' };
import { MACRO_TO_WARE, getConstructionMethodForFaction, getFriendlyModuleName } from '../data/wares.js';
import { getWareUnitPrice } from './prices.js';
import { escapeHtml } from '../html.js';
import { showUndefinedModuleDlcPopup, checkModuleDlcStatus, searchCuckooExtensionsTable } from './cuckooDlcLookup.js';

// Combine catalogs so all 343+ game macros are covered
const mergedCostsCatalog = { ...crissianCostsCatalog, ...buildCostsCatalog };

// Merge equipment and additional costs from blueprints_catalog.json
if (blueprintsCatalog && Array.isArray(blueprintsCatalog.blueprints)) {
  blueprintsCatalog.blueprints.forEach(b => {
    if (b.macro && b.cost && Object.keys(b.cost).length > 0) {
      if (!mergedCostsCatalog[b.macro]) {
        mergedCostsCatalog[b.macro] = b.cost;
      }
      const lower = b.macro.toLowerCase();
      if (!mergedCostsCatalog[lower]) {
        mergedCostsCatalog[lower] = b.cost;
      }
    }
  });
}

// Explicit fallback recipes for turrets and shields (Terran and Commonwealth)
mergedCostsCatalog['turret_ter_fallback_macro'] = { computronicsubstrate: 2, metallicmicrolattice: 8, energycells: 10 };
mergedCostsCatalog['turret_gen_fallback_macro'] = { turretcomponents: 10, advancedcomposites: 5, energycells: 10 };
mergedCostsCatalog['shield_ter_fallback_macro'] = { computronicsubstrate: 2, metallicmicrolattice: 8, energycells: 10 };
mergedCostsCatalog['shield_gen_fallback_macro'] = { shieldcomponents: 10, energycells: 10 };

// Explicit build costs for Protectyon / Avarice collector & production modules
mergedCostsCatalog['struct_ava_protectyon_collector_macro'] = { claytronics: 250, hullparts: 600, energycells: 600, protectyon: 50 };
mergedCostsCatalog['prod_ava_protectyon_macro'] = { claytronics: 250, hullparts: 600, energycells: 600, protectyon: 50 };

function resolveMacroKey(key) {
  if (mergedCostsCatalog[key] || buildCostsCatalog[key]) return key;
  const lowerKey = key.toLowerCase();
  if (mergedCostsCatalog[lowerKey] || buildCostsCatalog[lowerKey]) return lowerKey;

  // Protectyon / Avarice collector & shielding modules
  if (lowerKey.includes('protectyon') || lowerKey.includes('ava_') || lowerKey.includes('condensate')) {
    return 'struct_ava_protectyon_collector_macro';
  }

  // Scrap recycling and processing normalization
  if (lowerKey.includes('scrapprocessor') || lowerKey.includes('scrapworks') || lowerKey.includes('scrapproc')) {
    if (lowerKey.includes('ter')) return 'proc_ter_scrapworks_macro';
    if (lowerKey.includes('bor')) return 'proc_bor_scrapworks_macro';
    return 'proc_gen_scrapworks_macro';
  }
  if (lowerKey.includes('scraprecycler') || lowerKey.includes('scrap_recycler') || lowerKey.includes('allographyne')) {
    if (lowerKey.includes('khaak') || lowerKey.includes('allographyne')) return 'prod_gen_scrap_recyclerkhaak_macro';
    if (lowerKey.includes('ter')) return 'prod_ter_scrap_recycler_macro';
    if (lowerKey.includes('bor')) return 'prod_bor_scrap_recycler_macro';
    return 'prod_gen_scrap_recycler_macro';
  }

  // Specific fallbacks for capital / specialty station structures
  if (lowerKey.includes('shipyard') || lowerKey.includes('ships_xl')) {
    if (lowerKey.includes('ter')) return 'buildmodule_ter_ships_xl_macro';
    if (lowerKey.includes('bor')) return 'buildmodule_bor_ships_xl_macro';
    return 'buildmodule_gen_ships_xl_macro';
  }
  if (lowerKey.includes('wharf') || lowerKey.includes('ships_l') || lowerKey.includes('ships_s') || lowerKey.includes('ships_m')) {
    if (lowerKey.includes('ter')) return 'buildmodule_ter_ships_l_macro';
    if (lowerKey.includes('bor')) return 'buildmodule_bor_ships_l_macro';
    return 'buildmodule_gen_ships_l_macro';
  }
  if (lowerKey.includes('sanctuary')) {
    return 'struct_par_cross_01_macro';
  }
  if (lowerKey.includes('casino') || lowerKey.includes('gamblinghall') || lowerKey.includes('welfare')) {
    if (lowerKey.includes('ter')) return 'welfare_ter_gamblinghall_01_macro';
    if (lowerKey.includes('bor')) return 'welfare_bor_gamblinghall_01_macro';
    return 'welfare_gen_gamblinghall_01_macro';
  }
  if (lowerKey.includes('artacademy')) {
    return 'welfare_bor_artacademy_01_macro';
  }
  if (lowerKey.includes('admin') || lowerKey.includes('claim')) {
    if (lowerKey.includes('ter')) return 'struct_ter_admin_01_macro';
    if (lowerKey.includes('bor')) return 'struct_bor_admin_01_macro';
    if (lowerKey.includes('par')) return 'struct_par_admin_01_macro';
    if (lowerKey.includes('tel')) return 'struct_tel_admin_01_macro';
    if (lowerKey.includes('spl') || lowerKey.includes('split')) return 'struct_split_admin_01_macro';
    return 'struct_arg_admin_01_macro';
  }

  // Split / food / medical variations
  if (lowerKey.includes('scruffin')) return 'prod_spl_scruffinfruit_macro';
  if (lowerKey.includes('chelt')) return 'prod_spl_cheltmeat_macro';
  if (lowerKey.includes('spacefuel')) return 'prod_arg_spacefuel_macro';
  if (lowerKey.includes('terranmre') || lowerKey.includes('mre')) return 'prod_ter_mre_macro';
  if (lowerKey.includes('medical')) {
    if (lowerKey.includes('ter')) return 'prod_ter_medicalsupplies_macro';
    if (lowerKey.includes('bor')) return 'prod_bor_medicalsupplies_macro';
    if (lowerKey.includes('par')) return 'prod_par_medicalsupplies_macro';
    if (lowerKey.includes('tel')) return 'prod_tel_medicalsupplies_macro';
    if (lowerKey.includes('spl') || lowerKey.includes('split')) return 'prod_spl_medicalsupplies_macro';
    return 'prod_arg_medicalsupplies_macro';
  }
  if (lowerKey.includes('computronicsubstrate')) return 'prod_ter_computronicsubstrate_macro';
  if (lowerKey.includes('siliconcarbide')) return 'prod_ter_siliconcarbide_macro';

  const found = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === key && (mergedCostsCatalog[m] || buildCostsCatalog[m]));
  if (found) return found;

  // Faction to generic fallbacks for production and structural modules
  const genProdVariant = lowerKey.replace(/^prod_(bor|ter|par|tel|spl|split|arg)_/, 'prod_gen_');
  if (mergedCostsCatalog[genProdVariant] || buildCostsCatalog[genProdVariant]) return genProdVariant;

  const genStructVariant = lowerKey.replace(/^struct_(bor|ter|par|tel|spl|split|arg)_/, 'struct_arg_');
  if (mergedCostsCatalog[genStructVariant] || buildCostsCatalog[genStructVariant]) return genStructVariant;

  for (const m of Object.keys(mergedCostsCatalog)) {
    if (m.toLowerCase().includes(lowerKey)) return m;
  }

  // Dynamic turret and shield fallback resolution for upgrades
  if (lowerKey.startsWith('turret_')) {
    return lowerKey.includes('_ter_') ? 'turret_ter_fallback_macro' : 'turret_gen_fallback_macro';
  }
  if (lowerKey.startsWith('shield_')) {
    return lowerKey.includes('_ter_') ? 'shield_ter_fallback_macro' : 'shield_gen_fallback_macro';
  }

  return key;
}

/**
 * Displays a popup warning when an undefined module is encountered.
 * Searches cuckoo_extensions_table for the module key, checks DLC status,
 * and presents the popup with the DLC inclusion status message.
 * Relies on the close button for dismissal.
 * 
 * @param {string} macroOrWare - Undefined module identifier
 * @param {Object} [options]
 */
export function showUndefinedModuleWarningPopup(macroOrWare, options = {}) {
  return showUndefinedModuleDlcPopup(macroOrWare, options);
}

export { showUndefinedModuleDlcPopup, checkModuleDlcStatus, searchCuckooExtensionsTable };

if (typeof window !== 'undefined') {
  window.showUndefinedModuleWarningPopup = showUndefinedModuleWarningPopup;
  window.showUndefinedModuleDlcPopup = showUndefinedModuleDlcPopup;
  window.checkModuleDlcStatus = checkModuleDlcStatus;
  window.searchCuckooExtensionsTable = searchCuckooExtensionsTable;
}

/**
 * Calculates aggregate construction resources and estimated credits for planned modules.
 * 
 * @param {Object} modules - { [macroName]: count } or blueprint object
 * @param {string} [constructionMethod='commonwealth'] - 'commonwealth' | 'terran' | 'boron' or faction key
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
  // Support passing blueprint object, rawMacros, or direct module mapping
  const moduleMap = (modules?.rawMacros && Object.keys(modules.rawMacros).length > 0)
    ? modules.rawMacros
    : (modules?.modules && Object.keys(modules.modules).length > 0)
      ? modules.modules
      : (typeof modules === 'string' ? { [modules]: 1 } : (modules || {}));
  const method = getConstructionMethodForFaction(constructionMethod);
  const resourceBreakdown = {};
  let totalWareUnits = 0;
  let totalCredits = 0;

  for (const [macroOrWare, count] of Object.entries(moduleMap)) {
    if (!count || count <= 0) continue;

    let macro = resolveMacroKey(macroOrWare);
    if (method === 'terran' && macro.includes('_gen_')) {
      const ter = macro.replace('_gen_', '_ter_');
      if (mergedCostsCatalog[ter] || buildCostsCatalog[ter]) macro = ter;
    } else if (method === 'boron' && macro.includes('_gen_')) {
      const bor = macro.replace('_gen_', '_bor_');
      if (mergedCostsCatalog[bor] || buildCostsCatalog[bor]) macro = bor;
    } else if (method === 'commonwealth' && macro.includes('_ter_')) {
      const gen = macro.replace('_ter_', '_gen_');
      if (mergedCostsCatalog[gen] || buildCostsCatalog[gen]) macro = gen;
    }

    const moduleRecipe = mergedCostsCatalog[macro] || buildCostsCatalog[macro];
    if (!moduleRecipe) {
      showUndefinedModuleWarningPopup(macroOrWare);
      continue;
    }

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

// Singular alias matching user specification
export const calculateBuildCost = calculateBuildCosts;

