// X4: Foundations v9.0 Sector Sunlight Efficiency Master Data & EC Calculation Engine
import SUNLIGHT_DATA from './sunlight.json' with { type: 'json' };

export const SECTORS_SUNLIGHT = SUNLIGHT_DATA;

// Default standard Commonwealth Solar Power Plant base hourly production rate per module
export const BASE_SOLAR_OUTPUT = 10500;

/**
 * Calculates dynamic solar cycle metrics for a given sector and workforce bonus
 * 
 * @param {string|number} sectorOrSunlight - Sector name string or numeric nominal sunlight percentage
 * @param {number} workforceBonus - Workforce bonus percentage (e.g. 0 to 50)
 * @param {number} baseOutput - Base hourly output per module (default 10,500 EC/hr)
 * @param {number} maxWorkforce - Max workforce multiplier (0.43 for Commonwealth, 0.0 for Terran)
 * @param {number} baseCyclesPerHour - Base production cycles per hour (default 60, i.e. 1-minute cycle)
 * @returns {object} Dynamic cycle metrics object
 */
export function getSolarDynamicCycles(sectorOrSunlight, workforceBonus = 0, baseOutput = BASE_SOLAR_OUTPUT, moduleMaxBonus = 0.43, baseCyclesPerHour = 60) {
  const sunlightPercent = typeof sectorOrSunlight === 'number' 
    ? sectorOrSunlight 
    : getSectorSunlight(sectorOrSunlight);

  const sunlightDecimal = sunlightPercent / 100;
  const baseRatePerCycle = baseOutput / baseCyclesPerHour;

  // Determine Module Max Workforce Bonus (0.43 for Commonwealth Solar, 0.0 for Terran Solar)
  const isTer = baseOutput === 3000 || moduleMaxBonus === 0;
  const actualModuleMaxBonus = isTer ? 0 : (typeof moduleMaxBonus === 'number' ? moduleMaxBonus : 0.43);

  // Gained Workforce Bonus = WEB times Module Max Workforce Bonus rounded up becomes Efficiency
  const gainedBonus = (workforceBonus > 0 && actualModuleMaxBonus > 0)
    ? Math.ceil(workforceBonus * actualModuleMaxBonus)
    : 0;

  // Efficiency converted to decimal with one added to it yields Workforce
  const workforceFactor = parseFloat((1 + (gainedBonus / 100)).toFixed(4));

  // Overall Module Efficiency then becomes Sunlight Efficiency (in decimal) times Gained Workforce Bonus (Workforce factor)
  const overallEfficiency = sunlightDecimal * workforceFactor;
  const overallEfficiencyPercent = Math.round(overallEfficiency * 100);

  const cycleYield = Math.floor(baseRatePerCycle * (overallEfficiencyPercent / 100));
  const hourlyOutputPerModule = cycleYield * baseCyclesPerHour;

  const cycleDurationSec = baseCyclesPerHour > 0 ? (3600 / baseCyclesPerHour) : 60;
  const dynamicCyclesPerHour = baseCyclesPerHour;

  return {
    sunlightPercent,
    sunlightDecimal,
    baseYield: Math.floor(baseRatePerCycle * sunlightDecimal),
    cycleYield,
    baseCyclesPerHour,
    dynamicCyclesPerHour,
    cycleDurationSec,
    gainedBonus,
    workforceFactor,
    effectiveBonus: gainedBonus / 100,
    workforceMultiplier: workforceFactor,
    overallEfficiencyPercent,
    hourlyOutputPerModule
  };
}

/**
 * Calculates hourly Energy Cell output for Solar Power Plant modules
 * Formula: floor(floor((Base Output / 60) × (Nominal Sunlight % / 100)) × (60 × (1 + Workforce % / 100)))
 * Uses dynamic cycles per hour scaled by workforce efficiency bonus, rounding down to discrete integer units.
 * 
 * @param {string|number} sectorOrSunlight - Sector name string or numeric nominal sunlight percentage
 * @param {number} workforceBonus - Workforce bonus percentage (e.g. 0 to 50)
 * @param {number} modulesCount - Number of solar power plant modules (default 1)
 * @param {number} baseOutput - Base hourly output per module (default 10,500 EC/hr)
 * @param {number} maxWorkforce - Max workforce multiplier (0.43 for Commonwealth, 0.0 for Terran)
 * @param {number} cyclesPerHour - Production cycles per hour (default 60, i.e. 1-minute cycle)
 * @returns {number} Total hourly Energy Cells output
 */
export function calculateSolarOutput(sectorOrSunlight, workforceBonus = 0, modulesCount = 1, baseOutput = BASE_SOLAR_OUTPUT, moduleMaxBonus = 0.43, cyclesPerHour = 60) {
  if (modulesCount <= 0) return 0;
  const { hourlyOutputPerModule } = getSolarDynamicCycles(sectorOrSunlight, workforceBonus, baseOutput, moduleMaxBonus, cyclesPerHour);
  return modulesCount * hourlyOutputPerModule;
}

/**
 * Calculates the number of solar panel modules needed to satisfy an hourly EC demand in a sector
 * 
 * @param {number} totalECDemand - Total hourly Energy Cells demand
 * @param {string|number} sectorOrSunlight - Sector name or nominal sunlight percentage
 * @param {number} workforceBonus - Workforce bonus percentage (e.g. 0 to 50)
 * @param {number} baseOutput - Base hourly output per module (default 10,500 EC/hr)
 * @param {number} moduleMaxBonus - Module max workforce bonus (0.43 for Commonwealth, 0.0 for Terran)
 * @returns {number} Number of solar modules needed (integer ceiling)
 */
export function calculateSolarPanelsNeeded(totalECDemand, sectorOrSunlight, workforceBonus = 0, baseOutput = BASE_SOLAR_OUTPUT, moduleMaxBonus = 0.43) {
  if (totalECDemand <= 0) return 0;
  const singleModuleRate = calculateSolarOutput(sectorOrSunlight, workforceBonus, 1, baseOutput, moduleMaxBonus);
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
export function calculateSectorECMetrics(sectorName, totalECDemand = 0, modulesInstalled = 1, workforceBonus = 0, baseOutput = BASE_SOLAR_OUTPUT, moduleMaxBonus = 0.43) {
  const info = getSectorInfo(sectorName) || {
    sector: sectorName,
    cluster: 'Unknown',
    faction: 'Unknown',
    sunlight: 100,
    environment: 'Standard'
  };

  const outputPerModule = calculateSolarOutput(info.sunlight, workforceBonus, 1, baseOutput, moduleMaxBonus);
  const totalProduction = calculateSolarOutput(info.sunlight, workforceBonus, modulesInstalled, baseOutput, moduleMaxBonus);
  const solarPanelsNeeded = calculateSolarPanelsNeeded(totalECDemand, info.sunlight, workforceBonus, baseOutput, moduleMaxBonus);
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
