import { WARES_DB, mapMacroToWare } from '../data/wares.js';
import { getPrimaryMacroForWare } from './calculator.js';

/**
 * Raw gathered or extracted resources that do not have station production module blueprints.
 * Mined or gathered in space by ships/tugs; never flagged as "Not Owned".
 */
export const RAW_MINED_WARES = new Set([
  'Ore',
  'Silicon',
  'Methane',
  'Hydrogen',
  'Helium',
  'Ice',
  'Protectyon',
  'RawScrap',
  'RawKhaakScrap'
]);

/**
 * Abstract application concepts or categories that do not correspond to standalone station module blueprints.
 */
export const ABSTRACT_APP_WARES = new Set([
  'StationConst',
  'ShipWeapons',
  'ShipShields',
  'FleetConsumables',
  'WelfareHub',
  'BoronArtAcademy',
  'AllographyneScrapProc',
  'AllographyneFragments',
  'Allographyne'
]);

/**
 * Returns all station module blueprints from serverModules matching the given wareId.
 * @param {string} wareId
 * @param {Array<Object>} serverModules
 * @returns {Array<Object>}
 */
export function getModuleBlueprintsForWare(wareId, serverModules) {
  if (!serverModules || !Array.isArray(serverModules) || serverModules.length === 0) {
    return [];
  }
  if (RAW_MINED_WARES.has(wareId) || ABSTRACT_APP_WARES.has(wareId)) {
    return [];
  }

  const primaryMacro = getPrimaryMacroForWare(wareId);
  const matches = [];

  for (const m of serverModules) {
    const macro = m.macro || m.id || '';
    const macroLower = macro.toLowerCase();

    // 1. Direct macro match with primary macro
    if (primaryMacro && macro === primaryMacro) {
      matches.push(m);
      continue;
    }

    // 2. Direct mapping via mapMacroToWare
    const mappedWare = mapMacroToWare(macro);
    if (mappedWare === wareId) {
      matches.push(m);
      continue;
    }

    // 3. Scrap processor variants (Commonwealth, Terran, Boron)
    if (wareId === 'ScrapProc' && (macroLower.includes('scrapworks') || macroLower.includes('scrapprocessor'))) {
      matches.push(m);
      continue;
    }

    // 4. Terran Scrap Recycler
    if (wareId === 'TerScrapMetal' && (macroLower.includes('scraprecycler') || macroLower.includes('scrap_recycler')) && macroLower.includes('ter')) {
      matches.push(m);
      continue;
    }

    // 5. Commonwealth Scrap Recycler (outputs ScrapMetal, ScrapHullParts, ScrapClaytronics)
    if ((wareId === 'ScrapMetal' || wareId === 'ScrapHullParts' || wareId === 'ScrapClaytronics') &&
        (macroLower.includes('scraprecycler') || macroLower.includes('scrap_recycler')) &&
        !macroLower.includes('ter') && !macroLower.includes('khaak')) {
      matches.push(m);
      continue;
    }

    // 6. Terran High-Tech production modules
    if (wareId === 'CompSubstrate' && (macroLower.includes('computronicsubstrate') || macroLower.includes('computronic_substrate'))) {
      matches.push(m);
      continue;
    }
    if (wareId === 'SilCarbide' && (macroLower.includes('siliconcarbide') || macroLower.includes('silicon_carbide'))) {
      matches.push(m);
      continue;
    }
    if (wareId === 'TerCompSubstrate' && (macroLower.includes('computronic') || (macroLower.includes('ter') && (macroLower.includes('scraprecycler') || macroLower.includes('scrap_recycler'))))) {
      matches.push(m);
      continue;
    }
    if (wareId === 'TerSilCarbide' && (macroLower.includes('siliconcarbide') || (macroLower.includes('ter') && (macroLower.includes('scraprecycler') || macroLower.includes('scrap_recycler'))))) {
      matches.push(m);
      continue;
    }

    // 7. Administrative Centres (Argon, Paranid, Teladi, Split, Terran, Boron)
    if (wareId === 'AdminClaim' && (macroLower.includes('claim') || macroLower.includes('admin'))) {
      matches.push(m);
      continue;
    }

    // 8. Commonwealth Shipyards / Wharves
    if (wareId === 'ShipChassis' && (
      macroLower.startsWith('buildmodule_gen') ||
      macroLower.startsWith('buildmodule_arg') ||
      macroLower.startsWith('buildmodule_tel') ||
      macroLower.startsWith('buildmodule_par') ||
      macroLower.startsWith('buildmodule_split') ||
      macroLower.startsWith('buildmodule_spl') ||
      macroLower.startsWith('buildmodule_bor')
    )) {
      matches.push(m);
      continue;
    }

    // 9. Terran Shipyards / Wharves
    if (wareId === 'TerranShipyard' && macroLower.startsWith('buildmodule_ter')) {
      matches.push(m);
      continue;
    }
  }

  // Deduplicate matched modules by macro/id
  const seen = new Set();
  return matches.filter(m => {
    const key = m.macro || m.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Determines whether the station module for a given ware is owned (unlocked).
 * @param {string} wareId
 * @param {Array<Object>|null} serverModules - List of module blueprints from server
 * @param {Object} [options]
 * @param {string} [options.factionMethod] - Current faction construction method
 * @param {string} [options.activeBlueprintMacro] - Specific macro used in active blueprint
 * @returns {{ hasModule: boolean, isOwned: boolean, matchingBps: Array<Object> }}
 */
export function isWareModuleOwned(wareId, serverModules, options = {}) {
  // If server modules have not yet been obtained, don't flag as unowned
  if (!serverModules || !Array.isArray(serverModules) || serverModules.length === 0) {
    return { hasModule: false, isOwned: true, matchingBps: [] };
  }

  const matchingBps = getModuleBlueprintsForWare(wareId, serverModules);
  if (matchingBps.length === 0) {
    return { hasModule: false, isOwned: true, matchingBps: [] };
  }

  const { activeBlueprintMacro, factionMethod } = options;

  // 1. If an active blueprint specifies a concrete macro for this ware, check that specific blueprint
  if (activeBlueprintMacro) {
    const specificBp = matchingBps.find(b => (b.macro === activeBlueprintMacro || b.id === activeBlueprintMacro));
    if (specificBp) {
      return { hasModule: true, isOwned: Boolean(specificBp.unlocked), matchingBps };
    }
  }

  // 2. If a specific faction method is active and a faction-specific variant exists
  if (factionMethod) {
    const methodLower = factionMethod.toLowerCase();
    const factionBp = matchingBps.find(b => {
      const f = (b.faction || '').toLowerCase();
      const m = (b.macro || '').toLowerCase();
      if (methodLower === 'terran') return f.includes('ter') || m.includes('_ter_');
      if (methodLower === 'paranid') return f.includes('par') || m.includes('_par_');
      if (methodLower === 'teladi') return f.includes('tel') || m.includes('_tel_');
      if (methodLower === 'split') return f.includes('spl') || m.includes('_spl_') || m.includes('_split_');
      if (methodLower === 'boron') return f.includes('bor') || m.includes('_bor_');
      return false;
    });
    if (factionBp) {
      return { hasModule: true, isOwned: Boolean(factionBp.unlocked), matchingBps };
    }
  }

  // 3. General check: owned if any matching blueprint is unlocked
  const isOwned = matchingBps.some(b => Boolean(b.unlocked));
  return { hasModule: true, isOwned, matchingBps };
}

/**
 * Determines whether a specific station module macro blueprint is owned.
 * @param {string} macro
 * @param {Array<Object>|null} serverModules - List of module blueprints from server
 * @returns {boolean}
 */
export function isMacroBlueprintOwned(macro, serverModules) {
  if (!serverModules || !Array.isArray(serverModules) || serverModules.length === 0) {
    return true; // Before server data is loaded, do not flag as unowned
  }
  if (!macro) return true;

  const macroLower = macro.toLowerCase();

  // 1. Direct match by macro or id
  const direct = serverModules.find(m => {
    const mMacro = (m.macro || '').toLowerCase();
    const mId = (m.id || '').toLowerCase();
    return mMacro === macroLower || mId === macroLower;
  });
  if (direct) {
    return Boolean(direct.unlocked);
  }

  // 2. Direct match by sanitized macro (e.g. without _macro suffix)
  const cleanM = macroLower.replace(/_macro$/, '');
  const cleanMatch = serverModules.find(m => {
    const cleanServer = (m.macro || m.id || '').toLowerCase().replace(/_macro$/, '');
    return cleanServer === cleanM;
  });
  if (cleanMatch) {
    return Boolean(cleanMatch.unlocked);
  }

  // 3. Fallback via ware mapping if available
  const wareId = mapMacroToWare(macro);
  if (wareId) {
    const bps = getModuleBlueprintsForWare(wareId, serverModules);
    if (bps.length > 0) {
      return bps.some(b => Boolean(b.unlocked));
    }
  }

  // If the macro is unknown or not unlocked in the catalog, treat as unowned
  return false;
}

