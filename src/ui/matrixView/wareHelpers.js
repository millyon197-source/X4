// Pure ware helpers extracted from matrixView.js (Stage 4, step 1). No DOM, no shared state.
import { WARES_DB, DEPENDENCIES } from '../../data/wares.js';
import { getPrimaryMacroForWare } from '../../engine/calculator.js';

export const SCRAP_WARE_IDS = new Set(['RawScrap', 'ScrapProc', 'ScrapMetal', 'TerScrapMetal', 'ScrapHullParts', 'ScrapClaytronics', 'TerCompSubstrate', 'TerSilCarbide']);

export function getProductionMacroForWare(wareId) {
  const ware = WARES_DB[wareId];
  if (!ware) return null;
  if (ware.level === 0 && wareId !== 'EC' && wareId !== 'TerEC') return null;
  if (ware.level === 4) return null;
  return getPrimaryMacroForWare(wareId);
}

export function getDownstreamWares(startWareId) {
  const downstream = new Set();
  const queue = [startWareId];
  while (queue.length > 0) {
    const curr = queue.shift();
    DEPENDENCIES.filter(d => d.from === curr).forEach(d => {
      if (!downstream.has(d.to)) {
        downstream.add(d.to);
        queue.push(d.to);
      }
    });
  }
  return downstream;
}

export function formatWareName(ware) {
  const wMap = {
    hullparts: 'Hull Parts',
    claytronics: 'Claytronics',
    energycells: 'Energy Cells',
    ec: 'Energy Cells',
    computronicsubstrate: 'Computronic Substrate',
    siliconcarbide: 'Silicon Carbide',
    metallicmicrolattice: 'Metallic Microlattice',
    water: 'Water',
    protectyon: 'Protectyon',
    advancedcomposites: 'Advanced Composites',
    engineparts: 'Engine Parts',
    ore: 'Ore',
    silicon: 'Silicon'
  };
  return wMap[ware.toLowerCase()] || (ware.charAt(0).toUpperCase() + ware.slice(1));
}
