// Faction-ware visibility rule extracted from matrixView.js (Stage 4, step 2).
// Takes the state as a parameter instead of importing the shared singleton.
import { WARES_DB, FACTION_WARE_MAP } from '../../data/wares.js';
import { getDownstreamWares } from './wareHelpers.js';

export function isFactionWarePresentIn(currentState, id, inPlanCount = 0, hasDemand = false) {
  if (!FACTION_WARE_MAP[id]) return true;

  // Selected ware is always present
  if (currentState.selectedWareId === id) return true;

  // Downstream associated wares of selected ware are always present
  if (currentState.selectedWareId) {
    const downstream = getDownstreamWares(currentState.selectedWareId);
    if (downstream.has(id)) return true;
  }

  // If active search query matches this ware or its faction, display it
  if (currentState.searchQuery && currentState.searchQuery.trim()) {
    const raw = currentState.searchQuery.trim().toLowerCase();
    const isNegated = raw.startsWith('!');
    const q = isNegated ? raw.slice(1).trim() : raw;
    if (q && !isNegated) {
      const ware = WARES_DB[id];
      const faction = FACTION_WARE_MAP[id];
      const catWords = ware && ware.cat ? ware.cat.toLowerCase().split(/[\s/()]+/) : [];
      const catMatches = catWords.some(w => w.startsWith(q)) || (ware && ware.cat && ware.cat.toLowerCase().includes(q) && q.includes(' '));
      const contains = (ware && (
        ware.name.toLowerCase().includes(q) || catMatches
      )) || (faction && faction.toLowerCase().includes(q));
      if (contains) return true;
    }
  }

  // When active blueprint is loaded:
  if (currentState.activeBlueprint) {
    return inPlanCount > 0 || hasDemand;
  }

  return hasDemand;
}
