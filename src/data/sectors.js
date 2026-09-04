// X4: Foundations v9.0 Sector Sunlight Efficiency Master Data
import SUNLIGHT_DATA from './sunlight.json';

export const SECTORS_SUNLIGHT = SUNLIGHT_DATA;

export function getSectorSunlight(name) {
  const match = SECTORS_SUNLIGHT.find(s => s.sector.toLowerCase() === name.toLowerCase());
  return match ? match.sunlight : 100;
}

export function getMegahubSectors(minPercent = 150) {
  return SECTORS_SUNLIGHT.filter(s => s.sunlight >= minPercent).sort((a, b) => b.sunlight - a.sunlight);
}
