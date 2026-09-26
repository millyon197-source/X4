/**
 * src/engine/prices.js
 * Market price database and lookup utilities for X4 economy wares.
 */

export const WARE_PRICES = {
  // Commonwealth Construction Wares
  hullparts: { min: 156, avg: 208, max: 260 },
  claytronics: { min: 1480, avg: 1973, max: 2466 },
  advancedcomposites: { min: 380, avg: 507, max: 634 },
  engineparts: { min: 150, avg: 200, max: 250 },
  energycells: { min: 10, avg: 16, max: 22 },
  ec: { min: 10, avg: 16, max: 22 },

  // Terran Protectorate Wares
  computronicsubstrate: { min: 5100, avg: 6800, max: 8500 },
  siliconcarbide: { min: 1050, avg: 1400, max: 1750 },
  metallicmicrolattice: { min: 120, avg: 160, max: 200 },

  // Boron Kingdom & Special Wares
  water: { min: 40, avg: 60, max: 80 },
  protectyon: { min: 1200, avg: 1600, max: 2000 },

  // Raw Minerals
  ore: { min: 40, avg: 53, max: 67 },
  silicon: { min: 85, avg: 113, max: 141 },
};

/**
 * Resolves the unit price for a given ware.
 * 
 * @param {string} wareId - Ware key (e.g., 'hullparts', 'claytronics')
 * @param {'min'|'avg'|'max'} [priceType='avg'] - Price tier to select
 * @param {Object} [priceOverrides={}] - Custom player price overrides
 * @returns {number} Price per unit in credits (Cr)
 */
export function getWareUnitPrice(wareId, priceType = 'avg', priceOverrides = {}) {
  const normWare = (wareId || '').toLowerCase().replace(/[\s_-]+/g, '');
  
  // 1. Check custom overrides first
  if (priceOverrides[normWare] !== undefined) {
    return Number(priceOverrides[normWare]) || 0;
  }
  if (priceOverrides[wareId] !== undefined) {
    return Number(priceOverrides[wareId]) || 0;
  }

  // 2. Lookup standard game database ranges
  const priceRange = WARE_PRICES[normWare] || WARE_PRICES[wareId];
  if (priceRange) {
    const tier = (priceType || 'avg').toLowerCase();
    return priceRange[tier] !== undefined ? priceRange[tier] : priceRange.avg;
  }

  return 0; // Default fallback if unknown ware
}
