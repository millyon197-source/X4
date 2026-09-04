// X4: Foundations v9.0 Sector Sunlight Efficiency Master Data & EC Calculation Engine
import SUNLIGHT_DATA from './sunlight.json';

export const SECTORS_SUNLIGHT = SUNLIGHT_DATA;

// Default standard Commonwealth Solar Power Plant base hourly production rate per module
export const BASE_SOLAR_OUTPUT = 10500;

/**
 * Calculates hourly Energy Cell output for Solar Power Plant modules
 * Formula: Base Output × (Nominal Sunlight % / 100) × (1 + Workforce % / 100)
 * 
 * @param {string|number} sectorOrSunlight - Sector name string or numeric nominal sunlight percentage
 * @param {number} workforceBonus - Workforce bonus percentage (e.g. 0 to 50)
 * @param {number} modulesCount - Number of solar power plant modules (default 1)
 * @param {number} baseOutput - Base hourly output per module (default 10,500 EC/hr)
 * @returns {number} Total hourly Energy Cells output
 */
export function calculateSolarOutput(sectorOrSunlight, workforceBonus = 0, modulesCount = 1, baseOutput = BASE_SOLAR_OUTPUT, maxWorkforce = 0.43) {
  const sunlightPercent = typeof sectorOrSunlight === 'number' 
    ? sectorOrSunlight 
    : getSectorSunlight(sectorOrSunlight);

  const sunlightMultiplier = sunlightPercent / 100;
  const workforceMultiplier = maxWorkforce !== 0 ? (1 + (maxWorkforce * (workforceBonus / 100))) : 1;

  return modulesCount * baseOutput * sunlightMultiplier * workforceMultiplier;
}

/**
 * Calculates the number of solar panel modules needed to satisfy an hourly EC demand in a sector
 * 
 * @param {number} totalECDemand - Total hourly Energy Cells demand
 * @param {string|number} sectorOrSunlight - Sector name or nominal sunlight percentage
 * @param {number} workforceBonus - Workforce bonus percentage (e.g. 0 to 50)
 * @param {number} baseOutput - Base hourly output per module (default 10,500 EC/hr)
 * @returns {number} Number of solar modules needed (integer ceiling)
 */
export function calculateSolarPanelsNeeded(totalECDemand, sectorOrSunlight, workforceBonus = 0, baseOutput = BASE_SOLAR_OUTPUT) {
  if (totalECDemand <= 0) return 0;
  const singleModuleRate = calculateSolarOutput(sectorOrSunlight, workforceBonus, 1, baseOutput);
  if (singleModuleRate <= 0) return 0;
  return Math.ceil(totalECDemand / singleModuleRate);
}

/**
 * Retrieves the nominal sunlight percentage for a specific sector directly from sunlight.json
 * 
 * @param {string|number} name - Sector name
 * @returns {number} Canonical sunlight efficiency percentage from sunlight.json
 */
export function getSectorSunlight(name) {
  if (typeof name === 'number') return name;
  if (!name) return 100;

  // 1. Direct lookup from sunlight.json dataset
  const info = getSectorInfo(name);
  if (info && typeof info.sunlight === 'number') {
    return info.sunlight;
  }

  // 2. Fallback: Parse percentage if string contains explicit (X%)
  const parenPercentMatch = name.toString().match(/\((\d+(?:\.\d+)?)\s*%\)/);
  if (parenPercentMatch) {
    const val = parseFloat(parenPercentMatch[1]);
    if (!isNaN(val)) return val;
  }

  return 100;
}

/**
 * Retrieves sector details including cluster, initial owner, environment, and sunlight
 * 
 * @param {string} name - Sector name
 * @returns {object|null} Sector info object or null
 */
export function getSectorInfo(name) {
  if (!name) return null;
  const rawClean = name.toString().replace(/\s*\(\d+(?:\.\d+)?%\)/g, '').trim();
  const clean = rawClean.toLowerCase().replace(/['’]/g, '');
  
  // 1. Direct exact or substring match
  let match = SECTORS_SUNLIGHT.find(s => {
    const sClean = s.sector.toLowerCase().replace(/['’]/g, '');
    return sClean === clean || sClean.includes(clean) || clean.includes(sClean);
  });
  if (match) return match;

  // 2. Multi-alias split (e.g. "Nopileos' Fortune VI / Duke's Awakening")
  match = SECTORS_SUNLIGHT.find(s => {
    const parts = s.sector.toLowerCase().replace(/['’]/g, '').split('/').map(p => p.trim());
    return parts.some(p => p === clean || p.includes(clean) || clean.includes(p));
  });
  if (match) return match;

  // 3. Special handling for Duke's Awakening / Nopileos Fortune VI
  if (clean.includes('duke') && (clean.includes('awakening') || clean.includes('tempest') || clean.includes('vi') || clean.includes('6'))) {
    return SECTORS_SUNLIGHT.find(s => s.sector.includes("Duke's Awakening")) || null;
  }
  if (clean.includes('nopileos') && (clean.includes('vi') || clean.includes('6'))) {
    return SECTORS_SUNLIGHT.find(s => s.sector.includes("Duke's Awakening")) || null;
  }

  return null;
}

/**
 * Returns comprehensive EC solar generation metrics for a given sector and station demand
 * 
 * @param {string} sectorName - Sector name
 * @param {number} totalECDemand - Total station hourly EC demand
 * @param {number} modulesInstalled - Number of installed solar modules
 * @param {number} workforceBonus - Workforce bonus percentage (0-50%)
 * @param {number} baseOutput - Base hourly output per module
 * @returns {object} Comprehensive solar metrics object
 */
export function calculateSectorECMetrics(sectorName, totalECDemand = 0, modulesInstalled = 1, workforceBonus = 0, baseOutput = BASE_SOLAR_OUTPUT) {
  const info = getSectorInfo(sectorName) || {
    sector: sectorName,
    cluster: 'Unknown',
    faction: 'Unknown',
    sunlight: 100,
    environment: 'Standard'
  };

  const outputPerModule = calculateSolarOutput(info.sunlight, workforceBonus, 1, baseOutput);
  const totalProduction = calculateSolarOutput(info.sunlight, workforceBonus, modulesInstalled, baseOutput);
  const solarPanelsNeeded = calculateSolarPanelsNeeded(totalECDemand, info.sunlight, workforceBonus, baseOutput);
  const surplusOrDeficit = totalProduction - totalECDemand;

  return {
    sector: info.sector,
    cluster: info.cluster,
    faction: info.faction,
    environment: info.environment,
    nominalSunlight: info.sunlight,
    workforceBonus,
    baseOutput,
    outputPerModule,
    modulesInstalled,
    totalProduction,
    totalDemand: totalECDemand,
    solarPanelsNeeded,
    surplusOrDeficit,
    isSelfSufficient: surplusOrDeficit >= 0
  };
}

/**
 * Returns list of high-efficiency solar megahub sectors (sunlight >= minPercent)
 * 
 * @param {number} minPercent - Minimum sunlight threshold (default 150%)
 * @returns {Array} Sorted array of top solar sectors
 */
export function getMegahubSectors(minPercent = 150) {
  return SECTORS_SUNLIGHT.filter(s => s.sunlight >= minPercent).sort((a, b) => b.sunlight - a.sunlight);
}
