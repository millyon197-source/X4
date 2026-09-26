import { WARES_DB, DEPENDENCIES, mapMacroToWare, getFriendlyModuleName, getWareHourlyRatePerModule, getWareCycleTimeSec, getWareOutputPerCycle, MACRO_TO_WARE, FACTION_WARE_MAP, isTerranWare, isBlueprintTerran, NO_PP_WARES } from '../data/wares.js';
import { state, store, saveActiveBlueprintToStorage } from '../state/store.js';
import { rebuildBlueprintFromMacros, reloadActiveBlueprint } from '../engine/xmlParser.js';
import { calculateFactoryRequirements, calculateMatrix, calculateLiveOutputRate, calculateScrapMetalRawScrapDemand, getPPDownstreamWares, getPrimaryMacroForWare, getScrapRecyclerCycleYield, calculateBlueprintWorkforce } from '../engine/calculator.js';
import { calculateBuildCosts } from '../engine/buildCost.js';
import { getWareUnitPrice } from '../engine/prices.js';
import { SECTORS_SUNLIGHT, getSectorInfo, getSectorSunlight, getSolarDynamicCycles, calculateSolarOutput } from '../data/sectors.js';
import { escapeHtml } from '../html.js';

export { FACTION_WARE_MAP, NO_PP_WARES };

export const SCRAP_WARE_IDS = new Set(['RawScrap', 'ScrapProc', 'ScrapMetal', 'TerScrapMetal', 'ScrapHullParts', 'ScrapClaytronics', 'TerCompSubstrate', 'TerSilCarbide']);

export function getProductionMacroForWare(wareId) {
  const ware = WARES_DB[wareId];
  if (!ware) return null;
  if (ware.level === 0 && wareId !== 'EC' && wareId !== 'TerEC') return null;
  if (ware.level === 4) return null;
  return getPrimaryMacroForWare(wareId);
}

export function updateScrapWarningPill(activeWareId) {
  const pill = document.getElementById('scrapWarningPill');
  if (!pill) return;
  const targetId = activeWareId !== undefined ? activeWareId : state.selectedWareId;
  const hasYellowLink = Boolean(targetId) && SCRAP_WARE_IDS.has(targetId);
  pill.style.display = hasYellowLink ? 'flex' : 'none';
}

export function isFactionWarePresent(id, inPlanCount = 0, hasDemand = false) {
  if (!FACTION_WARE_MAP[id]) return true;

  // Selected ware is always present
  if (state.selectedWareId === id) return true;

  // If active search query matches this ware or its faction, display it
  if (state.searchQuery && state.searchQuery.trim()) {
    const raw = state.searchQuery.trim().toLowerCase();
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
  if (state.activeBlueprint) {
    return inPlanCount > 0 || hasDemand;
  }

  // In Single Target Mode when a target is selected:
  if (state.selectedWareId) {
    return hasDemand;
  }

  // In Single Target Mode when no ware is selected yet:
  return false;
}

export function renderMatrixTabHTML() {
  const lt = state.layerTotals || {
    L1: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L2: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L3: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    totalECNeeded: 0,
    solarModulesNeeded: 0
  };

  const effMultiplier = 1 + (state.workforceBonus / 100);
  const ppDownstreamWares = getPPDownstreamWares();
  const hasYellowLinkInitial = Boolean(state.selectedWareId) && SCRAP_WARE_IDS.has(state.selectedWareId);

  const activeLevels = state.subdueLevel4 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  const colClass = state.subdueLevel4 ? 'cols-4' : 'cols-5';

  const isSectorSelected = Boolean(state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector));
  const activeSectorName = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
  const sectorInfo = activeSectorName ? getSectorInfo(activeSectorName) : null;
  const rawSectorName = sectorInfo ? sectorInfo.sector : (activeSectorName || 'No Sector Selected');

  return `
    <div class="main-wrapper">
      <div class="matrix-viewport" id="viewport">
        <div class="layer-totals-banner ${colClass}">
          <div class="layer-totals-card" style="overflow:hidden;">
            <div class="layer-title" style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; overflow:hidden;">
              <span style="white-space:nowrap; flex-shrink:0;">⚡ Solar Harvesting</span>
              <div style="display:inline-flex; align-items:center; gap:3px; max-width:125px; overflow:hidden; flex-shrink:1;">
                <svg id="needleIndicator" class="needle-indicator ${isSectorSelected ? 'needle-selected' : 'needle-flashing'}" width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" title="${isSectorSelected ? `Sector location: ${rawSectorName} (${lt.sunlight}%)` : 'Sector not selected • Click to choose sector location'}">
                  <!-- Needle Pin Shaft -->
                  <line x1="10" y1="10" x2="3" y2="17" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/>
                  <!-- Needle Collar -->
                  <path d="M8.5 8.5L11.5 11.5" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
                  <!-- Needle Head (Round Pin Head) -->
                  <circle class="needle-head" cx="13" cy="7" r="4.5" />
                  <!-- Specular shine on head -->
                  <circle cx="11.8" cy="5.2" r="1.3" fill="#ffffff" opacity="0.75"/>
                </svg>
                <select id="sectorSelect" class="sector-select-badge ${isSectorSelected ? '' : 'unselected'}" title="${isSectorSelected ? `${rawSectorName} (${lt.sunlight || 100}%) • Click to select sector location` : 'Sector not selected • Click to choose sector location'}">
                  <option value="" ${!isSectorSelected ? 'selected' : ''}>-- Select Sector --</option>
                  ${SECTORS_SUNLIGHT.map(s => {
                    const isSel = isSectorSelected && (s.sector === rawSectorName || (activeSectorName && (activeSectorName === s.sector || activeSectorName.includes(s.sector))));
                    const optionVal = `${s.sector} (${s.sunlight}%)`;
                    return `<option value="${optionVal}" ${isSel ? 'selected' : ''}>${s.sunlight}% — ${s.sector}</option>`;
                  }).join('')}
                </select>
              </div>
            </div>
            <div class="layer-stat" style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
              <span>Total Demand: <strong style="color:#fbbf24;">${Math.round(lt.totalECNeeded).toLocaleString()} EC/hr</strong></span>
              ${state.activeBlueprint && ((lt.inPlanSolarCount || 0) + (lt.inPlanTerSolarCount || 0) > 0) ? `
                <span style="font-size:0.72rem; color:${lt.ecBalance >= 0 ? '#34d399' : '#f87171'};" title="${(lt.inPlanTerSolarCount || 0) > 0 ? `Combined Solar Generation (${lt.inPlanSolarCount || 0}x Gen + ${lt.inPlanTerSolarCount || 0}x TER) vs Demand` : `Solar Generation (${lt.inPlanSolarCount || 0}x) vs Demand`}">
                  Prod: <strong>${Math.round(lt.totalECProduced).toLocaleString()}</strong> (${lt.ecBalance >= 0 ? '+' : ''}${Math.round(lt.ecBalance).toLocaleString()})
                </span>
              ` : ''}
            </div>
            <div class="layer-sub" style="margin-top:2px;">
              ${(() => {
                const terLoaded = (lt.inPlanTerSolarCount || 0) > 0;
                const genLoaded = (lt.inPlanSolarCount || 0) > 0;

                let installedHtml = '';
                if (state.activeBlueprint) {
                  if (terLoaded && genLoaded) {
                    installedHtml = `Installed: <strong style="color:#38bdf8;">${(lt.inPlanSolarCount || 0) + (lt.inPlanTerSolarCount || 0)}x Total</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${lt.inPlanSolarCount}x Gen)</span> <span style="font-size:0.68rem; color:#94a3b8;">(${lt.inPlanTerSolarCount}x TER)</span> • `;
                  } else if (terLoaded) {
                    installedHtml = `Installed: <strong style="color:#38bdf8;">${lt.inPlanTerSolarCount}x TER</strong> • `;
                  } else if (genLoaded || (lt.solarModulesNeeded > 0)) {
                    installedHtml = `Installed: <strong style="color:#38bdf8;">${lt.inPlanSolarCount || 0}x</strong> • `;
                  }
                }

                const ecFallback = (WARES_DB['EC'] && typeof WARES_DB['EC'].baseRate === 'number') ? WARES_DB['EC'].baseRate : 10500;
                const terEcFallback = (WARES_DB['TerEC'] && typeof WARES_DB['TerEC'].baseRate === 'number') ? WARES_DB['TerEC'].baseRate : 3000;
                let reqHtml = '';
                if (state.activeBlueprint && !terLoaded) {
                  reqHtml = `Requires <strong style="color:#34d399;">${lt.solarModulesNeeded}x</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.solarOutputPerPanel || ecFallback).toLocaleString()}/mod)</span>`;
                } else if (state.activeBlueprint && terLoaded && !genLoaded) {
                  reqHtml = `Requires <strong style="color:#38bdf8;">${lt.terSolarModulesNeeded}x TER</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.terSolarOutputPerPanel || terEcFallback).toLocaleString()}/mod)</span>`;
                } else {
                  reqHtml = `Requires <strong style="color:#34d399;">${lt.solarModulesNeeded}x Gen</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.solarOutputPerPanel || ecFallback).toLocaleString()}/mod)</span> or <strong style="color:#38bdf8;">${lt.terSolarModulesNeeded}x TER</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.terSolarOutputPerPanel || terEcFallback).toLocaleString()}/mod)</span>`;
                }

                return `${installedHtml}${reqHtml}`;
              })()}
            </div>
          </div>
          <div class="layer-totals-card">
            <div class="layer-title">
              <span>Level 1: Refined Goods</span>
            </div>
            <div class="layer-stat">Output: <strong style="color:#34d399;">${Math.round(lt.L1.totalProd).toLocaleString()} /hr</strong></div>
            <div class="layer-sub">Layer EC: <strong style="color:#fbbf24;">${Math.round(lt.L1.ecConsumed).toLocaleString()} EC/hr</strong></div>
          </div>
          <div class="layer-totals-card">
            <div class="layer-title">
              <span>Level 2: Intermediates</span>
            </div>
            <div class="layer-stat">Output: <strong style="color:#34d399;">${Math.round(lt.L2.totalProd).toLocaleString()} /hr</strong></div>
            <div class="layer-sub">Layer EC: <strong style="color:#fbbf24;">${Math.round(lt.L2.ecConsumed).toLocaleString()} EC/hr</strong></div>
          </div>
          <div class="layer-totals-card">
            <div class="layer-title">
              <span>Level 3: High-Tech</span>
            </div>
            <div class="layer-stat">Output: <strong style="color:#34d399;">${Math.round(lt.L3.totalProd).toLocaleString()} /hr</strong></div>
            <div class="layer-sub">Layer EC: <strong style="color:#fbbf24;">${Math.round(lt.L3.ecConsumed).toLocaleString()} EC/hr</strong></div>
          </div>
          ${!state.subdueLevel4 ? `
            <div class="layer-totals-card">
              <div class="layer-title">
                <span style="color:#a78bfa;">Level 4: Applications</span>
              </div>
              <div class="layer-stat">Output: <strong style="color:#a78bfa;">9 Modules</strong></div>
              <div class="layer-sub">Shipyards, Docks &amp; HQ Claims</div>
            </div>
          ` : ''}
        </div>

        <svg class="svg-overlay" id="svgCanvas"></svg>

        <div class="matrix-grid ${colClass}" id="matrixGrid">
          ${activeLevels.map(level => {
            const levelWares = Object.keys(WARES_DB).filter(id => WARES_DB[id].level === level);
            const titles = ['Level 0: Raw', 'Level 1: Refined Goods', 'Level 2: Intermediates', 'Level 3: High-Tech', 'Level 4: Applications'];
            const levelEcConsumed = level >= 1 && level <= 3 ? (lt[`L${level}`] ? lt[`L${level}`].ecConsumed : 0) : 0;
            return `
              <div class="matrix-col col-${level}" data-level="${level}">
                <div class="col-badge">
                  <span>${titles[level]}</span>
                </div>
                ${levelWares.map(id => {
                  const ware = WARES_DB[id];
                  const calc = state.calculatedDemand[id];
                  const isGenEC = id === 'EC';
                  const isTerEC = id === 'TerEC';
                  const isEC = isGenEC || isTerEC;
                  let inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[id]) || 0;
                  if (isTerEC && inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
                    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
                      if (mapMacroToWare(m) === 'TerEC') inPlanCount += count;
                    });
                  }
                  if (isGenEC && inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
                    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
                      if (mapMacroToWare(m) === 'EC') inPlanCount += count;
                    });
                  }
                  if (inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
                    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
                      const lower = m.toLowerCase();
                      const isRecycler = (lower.includes('scraprecycler') || lower.includes('scrap_recycler')) && !lower.includes('khaak');
                      if (isRecycler) {
                        if (lower.includes('ter')) {
                          if (id === 'TerCompSubstrate' || id === 'TerSilCarbide' || id === 'TerScrapMetal') inPlanCount += count;
                        } else {
                          if (id === 'ScrapHullParts' || id === 'ScrapClaytronics' || id === 'ScrapMetal') inPlanCount += count;
                        }
                      } else if (mapMacroToWare(m) === id) {
                        inPlanCount += count;
                      }
                    });
                  }
                  const smInPlan = (state.activeBlueprint && state.activeBlueprint.modules && ((state.activeBlueprint.modules['ScrapMetal'] || 0) + (state.activeBlueprint.modules['TerScrapMetal'] || 0) + (state.activeBlueprint.modules['ScrapProc'] || 0))) || 0;
                  const smCalc = state.calculatedDemand && (state.calculatedDemand['ScrapMetal'] || state.calculatedDemand['TerScrapMetal'] || state.calculatedDemand['ScrapProc']);
                  const smOutputNonZero = smInPlan > 0 || (smCalc && (smCalc.rateNeeded > 0 || smCalc.modulesNeeded > 0)) || (state.selectedWareId === 'ScrapMetal' || state.selectedWareId === 'TerScrapMetal' || state.selectedWareId === 'ScrapProc' || state.selectedWareId === 'RawScrap');

                  let calcNeeded = calc ? (calc.modulesNeeded || 0) : 0;
                  let hasDemand = calc ? (calc.rateNeeded > 0 || calc.modulesNeeded > 0) : false;
                  if ((id === 'ScrapHullParts' || id === 'ScrapClaytronics') && smOutputNonZero) {
                    if (!state.activeBlueprint) {
                      calcNeeded = Math.max(calcNeeded, 1);
                    }
                    hasDemand = true;
                  }
                  const isTerranBp = state.activeBlueprint ? isBlueprintTerran(state.activeBlueprint) : false;
                  const isGenECOmitted = isGenEC && (
                    (state.activeBlueprint && (
                      (lt.inPlanTerSolarCount > 0 && inPlanCount === 0) ||
                      (lt.inPlanSolarCount === 0 && lt.inPlanTerSolarCount === 0 && isTerranBp)
                    )) ||
                    (!state.activeBlueprint && Boolean(state.selectedWareId) && isTerranWare(state.selectedWareId))
                  );
                  const isTerECOmitted = isTerEC && (
                    (state.activeBlueprint && (
                      (lt.inPlanSolarCount > 0 && inPlanCount === 0) ||
                      (lt.inPlanSolarCount === 0 && lt.inPlanTerSolarCount === 0 && !isTerranBp)
                    )) ||
                    (!state.activeBlueprint && (!state.selectedWareId || !isTerranWare(state.selectedWareId)))
                  );
                  const activeSector = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
                  const sunlightVal = activeSector ? getSectorSunlight(activeSector) : (lt.sunlight || 100);
                  const baseOutput = ware.baseRate || (isTerEC ? 3000 : 10500);
                  const moduleMaxBonus = isTerEC ? 0.0 : 0.43;
                  const solarPerMod = isEC 
                    ? calculateSolarOutput(sunlightVal, state.workforceBonus, 1, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60)
                    : 0;
                  const solarModsNeeded = isTerEC ? (lt.terSolarModulesNeeded || 0) : (lt.solarModulesNeeded || 0);

                  let isZeroCountOrInput = false;
                  const hasAlloFrag = Boolean(state.activeBlueprint && (
                    (state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneFragments'] > 0) ||
                    (state.calculatedDemand && state.calculatedDemand['AllographyneFragments'] && state.calculatedDemand['AllographyneFragments'].modulesNeeded > 0)
                  ));

                  if (state.activeBlueprint) {
                    if (ware.level === 0) {
                      if (isEC) {
                        isZeroCountOrInput = inPlanCount <= 0;
                      } else {
                        const rawRate = (calc && calc.rateNeeded > 0) ? calc.rateNeeded : 0;
                        isZeroCountOrInput = (id === 'RawKhaakScrap' && hasAlloFrag) ? false : (rawRate <= 0);
                      }
                    } else {
                      if (id === 'AllographyneScrapProc' && hasAlloFrag) {
                        isZeroCountOrInput = false;
                      } else {
                        isZeroCountOrInput = inPlanCount <= 0;
                      }
                    }
                  } else if (state.selectedWareId) {
                    if (ware.level === 0) {
                      if (isEC) {
                        isZeroCountOrInput = id === state.selectedWareId ? false : (solarModsNeeded <= 0);
                      } else {
                        const rawRate = (calc && calc.rateNeeded > 0) ? calc.rateNeeded : 0;
                        isZeroCountOrInput = id === state.selectedWareId ? false : (rawRate <= 0);
                      }
                    } else {
                      const isTarget = id === state.selectedWareId;
                      const count = (calc && calc.modulesNeeded > 0) ? calc.modulesNeeded : (isTarget ? 1 : 0);
                      isZeroCountOrInput = count <= 0;
                    }
                  }

                  const isFactionOmitted = !isFactionWarePresent(id, inPlanCount, hasDemand);
                  const isOmitted = isGenECOmitted || isTerECOmitted || isFactionOmitted || isZeroCountOrInput;

                  const rawQ = (state.searchQuery || '').trim().toLowerCase();
                  const isNegatedQ = rawQ.startsWith('!');
                  const searchQ = isNegatedQ ? rawQ.slice(1).trim() : rawQ;
                  const isSearchActive = Boolean(searchQ);
                  let isMatchedBySearch = false;
                  if (isSearchActive) {
                    const faction = FACTION_WARE_MAP[id];
                    const wareName = (ware.name || '').toLowerCase();
                    const wareCat = (ware.cat || '').toLowerCase();
                    const factionName = (faction || '').toLowerCase();
                    const catWords = wareCat ? wareCat.split(/[\s/()]+/) : [];
                    const catMatches = catWords.some(w => w.startsWith(searchQ)) || (wareCat.includes(searchQ) && searchQ.includes(' '));
                    const contains = wareName.includes(searchQ) || catMatches || factionName.includes(searchQ);
                    isMatchedBySearch = isNegatedQ ? !contains : contains;
                  }

                  const hasCalc = state.activeBlueprint 
                    ? (inPlanCount > 0 || hasDemand || (isEC && !isOmitted && lt.totalECNeeded > 0) || ware.level === 4 || !state.subdueZeroX) 
                    : true;
                  const isGhost = state.activeBlueprint ? (state.subdueZeroX && inPlanCount === 0 && !hasDemand && ware.level !== 4) : false;

                  let initialDisplay = isOmitted ? 'display:none;' : '';
                  let initialGhost = isGhost;
                  if (isSearchActive) {
                    if (isMatchedBySearch) {
                      initialDisplay = '';
                      initialGhost = false;
                    } else {
                      if (isOmitted) {
                        initialDisplay = 'display:none;';
                      } else {
                        initialDisplay = '';
                        initialGhost = true;
                      }
                    }
                  }

                  let activeCount = isEC 
                    ? (state.activeBlueprint 
                        ? inPlanCount 
                        : (state.selectedWareId === id ? 1 : (solarModsNeeded > 0 ? solarModsNeeded : 1))) 
                    : (state.activeBlueprint 
                        ? (inPlanCount > 0 ? inPlanCount : ((id === 'AllographyneScrapProc' && hasAlloFrag) ? (calcNeeded > 0 ? calcNeeded : 1) : 0)) 
                        : (calcNeeded > 0 ? calcNeeded : 1));

                  let prodOutputRate = 0;
                  let ecConsRate = 0;
                  let totalCompUnits = 0;
                  let rawRate = 0;
                  if (hasCalc) {
                    if (ware.level === 4) {
                      totalCompUnits = ware.recipe ? Object.entries(ware.recipe).filter(([k]) => k !== 'EC').reduce((sum, [_, v]) => sum + v, 0) : 0;
                    } else if (isEC) {
                      prodOutputRate = calculateSolarOutput(sunlightVal, state.workforceBonus, activeCount, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60);
                    } else if (ware.level > 0) {
                      const baselineCalc = (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[id]) || (state.calculatedDemand && state.calculatedDemand[id]);
                      const optimumRate = baselineCalc ? (baselineCalc.rateNeeded || 0) : 0;
                      prodOutputRate = calculateLiveOutputRate(id, activeCount, optimumRate);
                    } else if (ware.level === 0) {
                      rawRate = (calc && calc.rateNeeded > 0) ? calc.rateNeeded : 0;
                    }
                    if (ware.level !== 4 && ware.recipe && ware.recipe['EC']) {
                      ecConsRate = activeCount * ware.recipe['EC'];
                    }
                  }
                  const isRecyclerProduct = NO_PP_WARES.has(id);
                  const isL1toL3 = ware.level >= 1 && ware.level <= 3 && !isRecyclerProduct;
                  const isPPChecked = isL1toL3 && Boolean(
                    (state.activeBlueprint && state.activeBlueprint.ppStates && state.activeBlueprint.ppStates[id]) ||
                    (!state.activeBlueprint && state.ppStates && state.ppStates[id])
                  );
                  const isOutputSuppressed = isPPChecked || ppDownstreamWares.has(id);
                  if (isOutputSuppressed) {
                    prodOutputRate = 0;
                  }
                  if (isRecyclerProduct || isPPChecked) {
                    ecConsRate = 0;
                  }
                  if (id === 'ScrapProc') {
                    ecConsRate = state.scrapMetalEc ? state.scrapMetalEc.processorEc : (activeCount * 90000);
                  } else if (id === 'ScrapMetal') {
                    ecConsRate = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : 0;
                  } else if (id === 'TerScrapMetal') {
                    const hasGenSm = Boolean(state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapMetal']);
                    if (!hasGenSm && state.scrapMetalEc && state.scrapMetalEc.totalDemand > 0) {
                      ecConsRate = state.scrapMetalEc.totalDemand;
                    } else {
                      ecConsRate = 0;
                    }
                  }
                  const hasEcBadge = hasCalc && !isEC && !state.subdueEcCalc && ecConsRate > 0;
                  const hasSolarBadge = hasCalc && isEC;
                  const isSingleTargetActive = Boolean(state.selectedWareId || !state.activeBlueprint);
                  const prodMacro = isSingleTargetActive ? getProductionMacroForWare(id) : null;
                  const showBottomPanel = hasSolarBadge || hasEcBadge || isL1toL3 || Boolean(prodMacro);

                  const isScrapSubsetCard = id === 'ScrapMetal' || id === 'TerScrapMetal';

                  return `
                    <div class="ware-card ${initialGhost ? 'ghost-card' : ''} ${id === state.selectedWareId ? 'active-selected' : ''} ${isScrapSubsetCard ? 'scrap-subset-card' : ''}" id="ware-${id}" data-id="${id}" data-omitted="${isOmitted ? 'true' : 'false'}" style="${initialDisplay}">
                      <div class="ware-header">
                        <div class="ware-name" title="${ware.name}">${ware.name}</div>
                      </div>
                      ${hasCalc ? `
                        <div class="card-calc-info">
                          ${isEC ? `
                            <span class="module-badge" style="background:rgba(251,191,36,0.15); color:#fbbf24; border-color:rgba(251,191,36,0.3);">
                              ${state.activeBlueprint 
                                ? (inPlanCount > 0 
                                    ? `${inPlanCount}x Installed ${isTerEC ? 'TER Solar' : 'Solar'}` 
                                    : (solarModsNeeded > 0 ? `${solarModsNeeded}x Required ${isTerEC ? 'TER Solar' : 'Solar'}` : `0x Installed ${isTerEC ? 'TER Solar' : 'Solar'}`)) 
                                : `${activeCount}x ${solarModsNeeded > 0 ? 'Required ' : ''}${isTerEC ? 'TER Solar' : 'Solar'}`}
                            </span>
                            <span class="rate-badge-prod" title="Hourly production output in ${rawSectorName}">
                              Output: ${Math.round(prodOutputRate).toLocaleString()} /hr
                            </span>
                          ` : `
                            <span class="module-badge" style="${ware.level === 4 ? 'background:rgba(167,139,250,0.15); color:#a78bfa; border-color:rgba(167,139,250,0.3);' : ''}">
                              ${ware.level === 4 ? (ware.cat || 'Application') : (ware.level > 0 ? `${activeCount}x Modules` : (id === 'RawScrap' || id === 'RawKhaakScrap' ? 'Scrap' : 'Mining'))}
                            </span>
                            ${ware.level === 4 ? `
                              <span class="rate-badge-prod" style="background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3);" title="Total required component units">${Math.round(totalCompUnits).toLocaleString()} Components</span>
                            ` : (ware.level > 0 ? `
                              <span class="rate-badge-prod" title="Hourly production output">Output: ${Math.round(prodOutputRate).toLocaleString()} /hr</span>
                            ` : `
                              <span class="rate-badge-prod" title="Hourly required ${(id === 'RawScrap' || id === 'RawKhaakScrap') ? 'scrap collection' : 'raw extraction'} rate">${Math.round(rawRate).toLocaleString()} /hr</span>
                            `)}
                          `}
                        </div>
                      ` : `
                        <div class="card-calc-info">
                          <span class="module-badge" style="opacity:0.4; background:none; border-color:rgba(255,255,255,0.1); color:#64748b;">${state.activeBlueprint ? 'Ghost Module' : 'Hover / Select'}</span>
                        </div>
                      `}
                      ${showBottomPanel ? `
                        <div class="card-bottom-pill-panel">
                          ${isEC ? `
                            <span class="rate-badge-cons" style="background:rgba(56,189,248,0.12); color:#38bdf8; border-color:rgba(56,189,248,0.25);" title="Solar panel generation efficiency in this sector">
                              ⚡ ${Math.round(solarPerMod).toLocaleString()} EC/mod (${sunlightVal}%)
                            </span>
                          ` : (prodMacro ? `
                            <span class="macro-badge" title="${prodMacro}">${prodMacro}</span>
                          ` : `
                            ${hasEcBadge ? `
                              <span class="rate-badge-cons" title="Energy Cells consumed per hour">⚡ Consumes ${Math.round(ecConsRate).toLocaleString()} EC/hr</span>
                            ` : ''}
                          `)}
                          ${isL1toL3 ? `
                            <label class="pp-checkbox-label" title="Pause Production" onclick="event.stopPropagation();">
                              <input type="checkbox" class="pp-checkbox" data-id="${id}" ${isPPChecked ? 'checked' : ''} onclick="event.stopPropagation();" title="Pause Production" />
                              <span class="pp-text" style="color: ${isPPChecked ? '#f97316' : '#ffffff'};" title="Pause Production">PP</span>
                            </label>
                          ` : ''}
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
                ${level === 0 ? `
                  <div id="scrapWarningPill" class="scrap-warning-pill" style="display:${hasYellowLinkInitial ? 'flex' : 'none'};">
                    Scrap calculations are confusing for Hull and Claytronics outputs. Do some research
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <aside class="inspector-panel" id="inspectorPanel">
        <div class="inspector-header">
          <div class="inspector-title">
            <h2 id="insTitle">${state.activeBlueprint ? 'Blueprint Inspector' : 'Module Inspector'}</h2>
            <span id="insSub">${state.activeBlueprint ? escapeHtml(state.activeBlueprint.name) : 'Single Target Mode'}</span>
          </div>
          <button class="btn-close" id="btnCloseIns">&times;</button>
        </div>
        <div class="inspector-body" id="insBody"></div>
      </aside>
    </div>
  `;
}

export function drawLines() {
  const svg = document.getElementById('svgCanvas');
  const viewport = document.getElementById('viewport');
  if (!svg || !viewport) return;

  const rect = viewport.getBoundingClientRect();
  svg.setAttribute('width', viewport.scrollWidth);
  svg.setAttribute('height', viewport.scrollHeight);
  svg.innerHTML = '';

  DEPENDENCIES.forEach(dep => {
    if (dep.from === 'EC' || dep.from === 'TerEC') return;
    const toWare = WARES_DB[dep.to];
    if (toWare && toWare.level === 4) return;

    const fromEl = document.getElementById(`ware-${dep.from}`);
    const toEl = document.getElementById(`ware-${dep.to}`);
    if (!fromEl || !toEl || fromEl.style.display === 'none' || toEl.style.display === 'none') return;

    const r1 = fromEl.getBoundingClientRect();
    const r2 = toEl.getBoundingClientRect();

    const x1 = r1.right - rect.left + viewport.scrollLeft;
    const y1 = r1.top + r1.height / 2 - rect.top + viewport.scrollTop;
    const x2 = r2.left - rect.left + viewport.scrollLeft;
    const y2 = r2.top + r2.height / 2 - rect.top + viewport.scrollTop;

    const fromWare = WARES_DB[dep.from];
    const isSameCol = (fromWare && toWare && fromWare.level === toWare.level) || Math.abs(r1.left - r2.left) < 35;
    let pathD = '';

    if (dep.from === 'ScrapProc' && (dep.to === 'ScrapMetal' || dep.to === 'TerScrapMetal')) {
      const branchX = (r1.left - rect.left + viewport.scrollLeft) + 8;
      const startY = r1.bottom - rect.top + viewport.scrollTop;
      const dy = y2 - startY;
      const cy1 = startY + dy * 0.55;
      const cx2 = x2 - Math.min((x2 - branchX) * 0.45, 18);
      pathD = `M ${branchX} ${startY} C ${branchX} ${cy1}, ${cx2} ${y2}, ${x2} ${y2}`;
    } else if (isSameCol) {
      const r2Right = r2.right - rect.left + viewport.scrollLeft;
      const dy = y2 - y1;
      const loopDist = Math.max(26, Math.min(48, Math.abs(dy) * 0.25));
      const cx1 = x1 + loopDist;
      const cx2 = r2Right + loopDist;
      pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${r2Right} ${y2}`;
    } else {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const absDy = Math.abs(dy);
      const handle = Math.max(20, Math.min(dx * 0.5, 75 + absDy * 0.08));
      const cx1 = x1 + handle;
      const cy1 = y1;
      const cx2 = x2 - handle;
      const cy2 = y2;
      pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }

    const fromInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[dep.from]) || 0;
    const toInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[dep.to]) || 0;

    const fromCalc = state.calculatedDemand[dep.from];
    const toCalc = state.calculatedDemand[dep.to];

    const isFromActive = fromInPlan > 0 || (fromCalc && (fromCalc.rateNeeded > 0 || fromCalc.modulesNeeded > 0));
    const isToActive = toInPlan > 0 || (toCalc && (toCalc.rateNeeded > 0 || toCalc.modulesNeeded > 0));

    let isActiveLink = isFromActive && isToActive;
    if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
      const hasAlloFrag = Boolean(
        (state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneFragments'] > 0) ||
        (state.calculatedDemand && state.calculatedDemand['AllographyneFragments'] && state.calculatedDemand['AllographyneFragments'].modulesNeeded > 0)
      );
      const isAlloActiveFlow = isAllographyne && hasAlloFrag && (
        (dep.from === 'RawKhaakScrap' && dep.to === 'AllographyneScrapProc') ||
        (dep.from === 'AllographyneScrapProc' && dep.to === 'AllographyneFragments')
      );
      if (!isAlloActiveFlow) {
        isActiveLink = false;
      }
    }

    const isScrap = dep.from === 'ScrapMetal' || dep.from === 'TerScrapMetal' || dep.from === 'RawScrap' || dep.from === 'ScrapProc' || dep.from === 'RawKhaakScrap' || dep.from === 'AllographyneScrapProc';
    const isAllographyne = (dep.from === 'RawKhaakScrap' && dep.to === 'AllographyneScrapProc') || (dep.from === 'AllographyneScrapProc' && dep.to === 'AllographyneFragments') || (dep.from === 'AllographyneFragments' && dep.to === 'Allographyne');
    const isDashed = dep.dashed || false;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', `link-line ${isActiveLink ? 'active-link' : 'ghost-link'} ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${isDashed ? 'dashed-link' : ''}`.trim());
    path.setAttribute('data-from', dep.from);
    path.setAttribute('data-to', dep.to);
    if (isDashed) {
      path.setAttribute('data-dashed', 'true');
    }
    svg.appendChild(path);
  });

  if (!state.searchQuery || !state.searchQuery.trim()) {
    highlightGraph(state.selectedWareId);
  } else {
    document.querySelectorAll('.link-line').forEach(line => {
      const from = line.getAttribute('data-from');
      const to = line.getAttribute('data-to');
      const fromEl = document.getElementById(`ware-${from}`);
      const toEl = document.getElementById(`ware-${to}`);
      if (!fromEl || !toEl || fromEl.style.display === 'none' || toEl.style.display === 'none') return;

      const fromGhost = fromEl.classList.contains('ghost-card');
      const toGhost = toEl.classList.contains('ghost-card');
      const isScrap = from === 'ScrapMetal' || from === 'TerScrapMetal' || from === 'RawScrap' || from === 'ScrapProc' || from === 'RawKhaakScrap' || from === 'AllographyneScrapProc';
      const isAllographyne = (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') || (from === 'AllographyneScrapProc' && to === 'AllographyneFragments') || (from === 'AllographyneFragments' && to === 'Allographyne');
      const isDashed = line.getAttribute('data-dashed') === 'true';
      const dashedClass = isDashed ? 'dashed-link' : '';

      if (!fromGhost && !toGhost) {
        line.className.baseVal = `link-line active-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
      } else {
        line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
      }
    });
  }

  updateScrapWarningPill(state.selectedWareId);
}

export function highlightGraph(id) {
  if (!id) {
    updateScrapWarningPill(null);
    document.querySelectorAll('.link-line').forEach(l => {
      const from = l.getAttribute('data-from');
      const to = l.getAttribute('data-to');

      const fromInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[from]) || 0;
      const toInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[to]) || 0;

      const fromCalc = state.calculatedDemand[from];
      const toCalc = state.calculatedDemand[to];

      const isFromActive = fromInPlan > 0 || (fromCalc && (fromCalc.rateNeeded > 0 || fromCalc.modulesNeeded > 0));
      const isToActive = toInPlan > 0 || (toCalc && (toCalc.rateNeeded > 0 || toCalc.modulesNeeded > 0));

      const isDashed = l.getAttribute('data-dashed') === 'true';
      const isScrap = from === 'ScrapMetal' || from === 'TerScrapMetal' || from === 'RawScrap' || from === 'ScrapProc' || from === 'RawKhaakScrap' || from === 'AllographyneScrapProc';
      const isAllographyne = (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') || (from === 'AllographyneScrapProc' && to === 'AllographyneFragments') || (from === 'AllographyneFragments' && to === 'Allographyne');

      let active = isFromActive && isToActive;
      if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
        const hasAlloFrag = Boolean(
          (state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneFragments'] > 0) ||
          (state.calculatedDemand && state.calculatedDemand['AllographyneFragments'] && state.calculatedDemand['AllographyneFragments'].modulesNeeded > 0)
        );
        const isAlloActiveFlow = isAllographyne && hasAlloFrag && (
          (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') ||
          (from === 'AllographyneScrapProc' && to === 'AllographyneFragments')
        );
        if (!isAlloActiveFlow) {
          active = false;
        }
      }
      l.className.baseVal = `link-line ${active ? 'active-link' : 'ghost-link'} ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${isDashed ? 'dashed-link' : ''}`.trim();
    });
    document.querySelectorAll('.ware-card').forEach(c => {
      const cardId = c.dataset.id;
      const inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[cardId]) || 0;
      const calc = state.calculatedDemand[cardId];
      const hasDemand = calc && (calc.rateNeeded > 0 || calc.modulesNeeded > 0);
      const isEC = cardId === 'EC' || cardId === 'TerEC';
      const hasCalc = inPlan > 0 || hasDemand || (isEC && state.layerTotals && state.layerTotals.totalECNeeded > 0);
      const shouldGhost = state.activeBlueprint ? (state.subdueZeroX && inPlan === 0 && !hasDemand) : false;
      c.classList.toggle('ghost-card', shouldGhost);
    });
    return;
  }

  const selectedWare = WARES_DB[id];
  const isLevel4 = selectedWare && selectedWare.level === 4;

  const upstreamSet = new Set([id]);
  const downstreamSet = new Set([id]);

  const lt = state.layerTotals || {};
  const inPlanSolarCount = lt.inPlanSolarCount || 0;
  const inPlanTerSolarCount = lt.inPlanTerSolarCount || 0;
  const isTerranBp = state.activeBlueprint ? isBlueprintTerran(state.activeBlueprint) : false;

  function traverseUp(curr) {
    DEPENDENCIES.filter(d => d.to === curr).forEach(d => {
      if (d.from === 'EC') {
        if (state.activeBlueprint && inPlanTerSolarCount > 0 && inPlanSolarCount === 0) return;
        if (state.activeBlueprint && inPlanSolarCount === 0 && inPlanTerSolarCount === 0 && isTerranBp) return;
        if (!state.activeBlueprint && state.selectedWareId && isTerranWare(state.selectedWareId)) return;
      }
      if (d.from === 'TerEC') {
        if (state.activeBlueprint && inPlanSolarCount > 0 && inPlanTerSolarCount === 0) return;
        if (state.activeBlueprint && inPlanSolarCount === 0 && inPlanTerSolarCount === 0 && !isTerranBp) return;
        if (!state.activeBlueprint && (!state.selectedWareId || !isTerranWare(state.selectedWareId))) return;
      }
      upstreamSet.add(d.from);
      traverseUp(d.from);
    });
  }

  function traverseDown(curr) {
    DEPENDENCIES.filter(d => d.from === curr).forEach(d => {
      downstreamSet.add(d.to);
      traverseDown(d.to);
    });
  }

  traverseUp(id);
  if (!isLevel4) {
    traverseDown(id);
  }

  const allowedNodes = isLevel4 ? upstreamSet : new Set([...upstreamSet, ...downstreamSet]);

  document.querySelectorAll('.ware-card').forEach(card => {
    const cardId = card.dataset.id;
    const isAllowed = allowedNodes.has(cardId);

    if (isAllowed) {
      card.classList.remove('ghost-card');
    } else {
      card.classList.add('ghost-card');
    }
  });

  document.querySelectorAll('.link-line').forEach(line => {
    const from = line.getAttribute('data-from');
    const to = line.getAttribute('data-to');
    const isScrap = from === 'ScrapMetal' || from === 'TerScrapMetal' || from === 'RawScrap' || from === 'ScrapProc' || from === 'RawKhaakScrap' || from === 'AllographyneScrapProc';
    const isAllographyne = (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') || (from === 'AllographyneScrapProc' && to === 'AllographyneFragments') || (from === 'AllographyneFragments' && to === 'Allographyne');
    const isDashed = line.getAttribute('data-dashed') === 'true';
    const dashedClass = isDashed ? 'dashed-link' : '';

    const fromInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[from] || 0) : 1;
    const toInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[to] || 0) : 1;

    const isUpstreamLink = upstreamSet.has(from) && upstreamSet.has(to);
    const isDownstreamLink = !isLevel4 && downstreamSet.has(from) && downstreamSet.has(to);
    const isTracedLink = isUpstreamLink || isDownstreamLink;

    if (isTracedLink) {
      line.className.baseVal = `link-line active-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
    } else {
      line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
    }
  });

  updateScrapWarningPill(id);
}

export function filterWares() {
  const raw = (state.searchQuery || '').trim().toLowerCase();
  const isNegated = raw.startsWith('!');
  const q = isNegated ? raw.slice(1).trim() : raw;

  if (!q) {
    // Search is cleared: restore default visibility and ghosting
    document.querySelectorAll('.ware-card').forEach(card => {
      const isOmitted = card.dataset.omitted === 'true';
      card.style.display = isOmitted ? 'none' : '';
    });
    highlightGraph(state.selectedWareId);
    drawLines();
    return;
  }

  // Active search query: any partial match becomes visible and un-ghosted, others ghosted
  document.querySelectorAll('.ware-card').forEach(card => {
    const id = card.dataset.id;
    const ware = WARES_DB[id];
    if (!ware) return;

    const isOmitted = card.dataset.omitted === 'true';
    const faction = FACTION_WARE_MAP[id];

    const wareName = (ware.name || '').toLowerCase();
    const wareCat = (ware.cat || '').toLowerCase();
    const factionName = (faction || '').toLowerCase();

    const catWords = wareCat ? wareCat.split(/[\s/()]+/) : [];
    const catMatches = catWords.some(w => w.startsWith(q)) || (wareCat.includes(q) && q.includes(' '));
    const contains = wareName.includes(q) || catMatches || factionName.includes(q);
    const matches = isNegated ? !contains : contains;

    if (matches) {
      // Partial match: card becomes visible and un-ghosted
      card.style.display = '';
      card.classList.remove('ghost-card');
    } else {
      // Non-match
      if (isOmitted) {
        // Non-present faction cards remain hidden if not matched
        card.style.display = 'none';
      } else {
        // Regular cards stay in grid layout but are ghosted
        card.style.display = '';
        card.classList.add('ghost-card');
      }
    }
  });

  drawLines();
}

export function getCenteredWareId() {
  if (state.selectedWareId) return state.selectedWareId;
  const viewport = document.getElementById('viewport');
  if (!viewport) return state.lastFocusedWareId || null;

  const vpRect = viewport.getBoundingClientRect();
  if (vpRect.width === 0 || vpRect.height === 0) {
    return state.selectedWareId || state.lastFocusedWareId || null;
  }

  const vpCenterX = vpRect.left + vpRect.width / 2;
  const vpCenterY = vpRect.top + vpRect.height / 2;

  const cards = document.querySelectorAll('.ware-card');
  let closestId = null;
  let minDistance = Infinity;

  cards.forEach(card => {
    if (card.offsetParent === null) return;
    const r = card.getBoundingClientRect();
    const cardCenterX = r.left + r.width / 2;
    const cardCenterY = r.top + r.height / 2;
    const dist = Math.hypot(cardCenterX - vpCenterX, cardCenterY - vpCenterY);
    if (dist < minDistance) {
      minDistance = dist;
      closestId = card.dataset.id;
    }
  });

  return closestId || state.selectedWareId || state.lastFocusedWareId || null;
}

export function centerOnWare(id, behavior = 'smooth') {
  if (!id) return;
  const cardEl = document.getElementById(`ware-${id}`);
  const viewport = document.getElementById('viewport');
  if (!cardEl || !viewport || cardEl.offsetParent === null) return;

  const cardRect = cardEl.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  if (viewportRect.width === 0 || viewportRect.height === 0) return;

  const scrollLeftTarget = viewport.scrollLeft + (cardRect.left - viewportRect.left) - (viewportRect.width / 2) + (cardRect.width / 2);
  const scrollTopTarget = viewport.scrollTop + (cardRect.top - viewportRect.top) - (viewportRect.height / 2) + (cardRect.height / 2);

  viewport.scrollTo({
    left: Math.max(0, scrollLeftTarget),
    top: Math.max(0, scrollTopTarget),
    behavior
  });
}

export function selectWare(id, onRender) {
  if (id) {
    state.lastFocusedWareId = id;
  }
  state.selectedWareId = id;
  const selectedWare = WARES_DB[id];
  const isLevel4 = selectedWare && selectedWare.level === 4;

  if (isLevel4) {
    // If "Subdue Level 4" is unchecked, do not recalculate any cards only highlight cards associated.
    document.querySelectorAll('.ware-card').forEach(card => {
      card.classList.toggle('active-selected', card.dataset.id === id);
    });
    highlightGraph(id);
    updateInspector(id, onRender);
    if (id) {
      setTimeout(() => centerOnWare(id), 60);
    }
    return;
  }

  if (typeof onRender === 'function') onRender();
  highlightGraph(id);
  if (id) {
    setTimeout(() => centerOnWare(id), 60);
  }
}

/**
 * Renders the Construction Resource Budget card for the Blueprint Inspector sidebar.
 * @param {Object} [currentState=state] - Application state
 * @returns {string} HTML markup
 */
export function renderConstructionBudgetInspectorHTML(currentState = state) {
  const isExpanded = Boolean(currentState.showConstructionBudget);
  const currentPriceType = currentState.priceType || 'avg';
  const method = currentState.constructionMethod || currentState.factionConstructionMethod || 'commonwealth';
  const rawModules = (currentState.modules && Object.keys(currentState.modules).length > 0)
    ? currentState.modules
    : (currentState.activeBlueprint?.rawMacros && Object.keys(currentState.activeBlueprint.rawMacros).length > 0)
      ? currentState.activeBlueprint.rawMacros
      : ((currentState.activeBlueprint && (currentState.activeBlueprint.modules || currentState.activeBlueprint.rawMacros)) || {});

  const buildResult = calculateBuildCosts(rawModules, method, currentPriceType);
  const resourceEntries = Object.entries(buildResult.resources);

  const formatWareName = (ware) => {
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
  };

  if (resourceEntries.length === 0) {
    return `
      <div class="bp-level-panel construction-budget-panel" style="border-color: rgba(56, 189, 248, 0.35); flex-shrink: 0; width: 100%; box-sizing: border-box; margin-top: 0.65rem; margin-bottom: 0;">
        <div class="bp-level-header bp-cb-header" style="background: rgba(15, 23, 42, 0.85); padding: 0.5rem 0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; cursor:pointer;" title="Click to ${isExpanded ? 'collapse' : 'expand'} Construction Resource Budget">
          <div class="bp-level-title-group" style="display:flex; align-items:center; gap:6px;">
            <span class="bp-level-arrow bp-cb-arrow">${isExpanded ? '▼' : '▶'}</span>
            <span style="font-size:0.9rem;">💰</span>
            <strong style="color:#38bdf8; font-size:0.8rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em;">Construction Resource Budget</strong>
          </div>
          <div class="price-mode-toggles" style="display:flex; align-items:center; gap:0.25rem;">
            <button type="button" class="btn-price-tier ${currentPriceType === 'min' ? 'active' : ''}" data-price-tier="min" style="padding:0.15rem 0.45rem; font-size:0.7rem; border-radius:3px; border:1px solid ${currentPriceType === 'min' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'min' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'min' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Min</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'avg' ? 'active' : ''}" data-price-tier="avg" style="padding:0.15rem 0.45rem; font-size:0.7rem; border-radius:3px; border:1px solid ${currentPriceType === 'avg' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'avg' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'avg' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Avg</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'max' ? 'active' : ''}" data-price-tier="max" style="padding:0.15rem 0.45rem; font-size:0.7rem; border-radius:3px; border:1px solid ${currentPriceType === 'max' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'max' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'max' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Max</button>
          </div>
        </div>
        <div class="bp-cb-body" style="padding: 0.5rem 0.75rem; background: rgba(30, 41, 59, 0.4); display:${isExpanded ? 'block' : 'none'};">
          <p style="color:#94a3b8; font-style:italic; margin:0; font-size:0.75rem;">No construction resources required.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="bp-level-panel construction-budget-panel" style="border-color: rgba(56, 189, 248, 0.35); flex-shrink: 0; width: 100%; box-sizing: border-box; margin-top: 0.65rem; margin-bottom: 0;">
      <div class="bp-level-header bp-cb-header" style="background: rgba(15, 23, 42, 0.85); padding: 0.5rem 0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; cursor:pointer;" title="Click to ${isExpanded ? 'collapse' : 'expand'} Construction Resource Budget">
        <div class="bp-level-title-group" style="display:flex; align-items:center; gap:6px;">
          <span class="bp-level-arrow bp-cb-arrow">${isExpanded ? '▼' : '▶'}</span>
          <span style="font-size:0.9rem;">💰</span>
          <strong style="color:#38bdf8; font-size:0.8rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em;">Construction Resource Budget</strong>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span class="bp-cb-collapsed-preview" style="font-size:0.72rem; color:#34d399; font-weight:700; font-family:monospace; background:rgba(52,211,153,0.1); padding:1px 6px; border-radius:3px; border:1px solid rgba(52,211,153,0.25); display:${isExpanded ? 'none' : 'inline-block'};" title="Total station construction valuation">
            ${buildResult.totals.totalCredits.toLocaleString()} Cr
          </span>
          <div class="price-mode-toggles" style="display:flex; align-items:center; gap:0.25rem;">
            <button type="button" class="btn-price-tier ${currentPriceType === 'min' ? 'active' : ''}" data-price-tier="min" style="padding:0.15rem 0.45rem; font-size:0.7rem; border-radius:3px; border:1px solid ${currentPriceType === 'min' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'min' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'min' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Min</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'avg' ? 'active' : ''}" data-price-tier="avg" style="padding:0.15rem 0.45rem; font-size:0.7rem; border-radius:3px; border:1px solid ${currentPriceType === 'avg' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'avg' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'avg' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Avg</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'max' ? 'active' : ''}" data-price-tier="max" style="padding:0.15rem 0.45rem; font-size:0.7rem; border-radius:3px; border:1px solid ${currentPriceType === 'max' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'max' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'max' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Max</button>
          </div>
        </div>
      </div>
      <div class="bp-cb-body" style="padding: 0.5rem 0.75rem; background: rgba(30, 41, 59, 0.4); display:${isExpanded ? 'block' : 'none'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.35rem; padding-bottom: 0.3rem; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <span style="color:#94a3b8; font-size:0.72rem;">Total Station Valuation (${currentPriceType.toUpperCase()}):</span>
          <strong style="color:#34d399; font-size:0.88rem; font-family:monospace;">${buildResult.totals.totalCredits.toLocaleString()} Cr</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.45rem; font-size:0.72rem;">
          <span style="color:#94a3b8;">Total Construction Units:</span>
          <strong style="color:#38bdf8;">${buildResult.totals.totalWareUnits.toLocaleString()} units</strong>
        </div>
        <table class="bp-calc-table" style="width:100%; border-collapse:collapse; font-size:0.72rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color:#94a3b8;">
              <th style="text-align:left; padding:2px 0;">Ware</th>
              <th style="text-align:right; padding:2px 0;">Qty</th>
              <th style="text-align:right; padding:2px 0;">Unit (Cr)</th>
              <th style="text-align:right; padding:2px 0;">Total (Cr)</th>
            </tr>
          </thead>
          <tbody>
            ${resourceEntries.map(([ware, data]) => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                <td style="text-align:left; padding:3px 0; color:#f8fafc; font-weight:600;">
                  ${escapeHtml(formatWareName(ware))}
                </td>
                <td style="text-align:right; padding:3px 0; color:#38bdf8;">
                  ${data.quantity.toLocaleString()}
                </td>
                <td style="text-align:right; padding:3px 0; color:#cbd5e1; font-family:monospace;">
                  ${data.unitPrice.toLocaleString()}
                </td>
                <td style="text-align:right; padding:3px 0; color:#fbbf24; font-weight:700; font-family:monospace;">
                  ${data.totalCredits.toLocaleString()}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top: 1px solid rgba(56,189,248,0.3); font-weight:700;">
              <td style="text-align:left; padding:4px 0; color:#f8fafc;">Total</td>
              <td style="text-align:right; padding:4px 0; color:#38bdf8;">${buildResult.totals.totalWareUnits.toLocaleString()}</td>
              <td style="text-align:right; padding:4px 0; color:#94a3b8;">—</td>
              <td style="text-align:right; padding:4px 0; color:#34d399; font-family:monospace;">${buildResult.totals.totalCredits.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

/**
 * Attaches in-place interactive listeners to the Construction Resource Budget panel,
 * ensuring price tier switches and collapse/expand do NOT cause a refresh of the BI panel.
 * @param {HTMLElement} panel - The .construction-budget-panel container
 */
export function bindCrbListeners(panel) {
  if (!panel) return;

  const header = panel.querySelector('.bp-cb-header');
  if (header) {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.btn-price-tier')) return;
      state.showConstructionBudget = !state.showConstructionBudget;
      if (store && typeof store.setShowConstructionBudget === 'function') {
        store.setShowConstructionBudget(state.showConstructionBudget);
      }

      const arrow = header.querySelector('.bp-cb-arrow');
      const body = panel.querySelector('.bp-cb-body');
      const preview = header.querySelector('.bp-cb-collapsed-preview');
      const isExpanded = state.showConstructionBudget;

      if (arrow) arrow.textContent = isExpanded ? '▼' : '▶';
      if (body) body.style.display = isExpanded ? 'block' : 'none';
      if (preview) preview.style.display = isExpanded ? 'none' : 'inline-block';
      header.title = `Click to ${isExpanded ? 'collapse' : 'expand'} Construction Resource Budget`;
    });
  }

  panel.querySelectorAll('.btn-price-tier').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      const tier = btn.dataset.priceTier;
      if (tier && ['min', 'avg', 'max'].includes(tier)) {
        state.priceType = tier;
        if (store && typeof store.setPriceType === 'function') {
          store.setPriceType(tier, true);
        } else {
          try {
            localStorage.setItem('x4_price_type', tier);
          } catch (err) {}
        }
        // In-place refresh of ONLY the CRB panel without refreshing the BI panel
        const insBody = panel.closest('#insBody');
        const curScroll = insBody ? insBody.scrollTop : null;

        const temp = document.createElement('div');
        temp.innerHTML = renderConstructionBudgetInspectorHTML(state);
        const newPanel = temp.firstElementChild;
        if (panel.parentNode) {
          panel.parentNode.replaceChild(newPanel, panel);
          bindCrbListeners(newPanel);
        }

        if (insBody && curScroll !== null) {
          insBody.scrollTop = curScroll;
        }
      }
    });
  });
}

export function updateInspector(id, onRender) {
  const insTitle = document.getElementById('insTitle');
  const insSub = document.getElementById('insSub');
  const insBody = document.getElementById('insBody');

  if (!insTitle || !insSub || !insBody) return;

  const prevInsScrollTop = insBody.scrollTop;

  const effMultiplier = 1 + (state.workforceBonus / 100);

  // CASE 1: Active Blueprint loaded & no specific card selected
  if (state.activeBlueprint && !id) {
    const dbOrder = Object.keys(WARES_DB);
    const liveDemand = state.calculatedDemand || (state.activeBlueprint && state.activeBlueprint.baselineDemand) || {};
    const liveLt = state.layerTotals || (state.activeBlueprint && state.activeBlueprint.baselineLayerTotals) || { totalECNeeded: 0, solarModulesNeeded: 0 };

    // Gather all card modules where needed module count is not equal to plan count
    const diffList = [];
    let hasExceeded = false;
    let hasDeficit = false;

    const smInPlan = (state.activeBlueprint && state.activeBlueprint.modules && ((state.activeBlueprint.modules['ScrapMetal'] || 0) + (state.activeBlueprint.modules['TerScrapMetal'] || 0) + (state.activeBlueprint.modules['ScrapProc'] || 0))) || 0;
    const smCalc = state.calculatedDemand && (state.calculatedDemand['ScrapMetal'] || state.calculatedDemand['TerScrapMetal'] || state.calculatedDemand['ScrapProc']);
    const smOutputNonZero = smInPlan > 0 || (smCalc && (smCalc.rateNeeded > 0 || smCalc.modulesNeeded > 0)) || (state.selectedWareId === 'ScrapMetal' || state.selectedWareId === 'TerScrapMetal' || state.selectedWareId === 'ScrapProc' || state.selectedWareId === 'RawScrap');

    Object.keys(WARES_DB).forEach(wId => {
      const ware = WARES_DB[wId];
      if (ware.level === 0 && wId !== 'EC' && wId !== 'TerEC') return;
      if (ware.level === 4) return;

      let inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wId]) || 0;
      let optimum = 0;
      if (wId === 'EC' || wId === 'TerEC') {
        optimum = (liveDemand[wId] ? liveDemand[wId].modulesNeeded : 0) || 0;
      } else if (liveDemand[wId]) {
        optimum = liveDemand[wId].modulesNeeded || 0;
      }

      if (inPlan > optimum) {
        hasExceeded = true;
      } else if (inPlan < optimum) {
        hasDeficit = true;
      }

      if (inPlan !== optimum && (inPlan > 0 || optimum > 0)) {
        const diff = optimum - inPlan;
        const diffSign = diff > 0 ? '+' : '';
        const diffColor = diff > 0 ? '#f87171' : '#38bdf8';
        const asterisk = inPlan > optimum ? '<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : '';
        diffList.push(`<span style="white-space:nowrap;" title="Plan: ${inPlan}x • Needs: ${optimum}x • Delta: ${diffSign}${diff}x${inPlan > optimum ? ' (Plan exceeds Needs)' : ''}"><strong style="color:${diffColor};">${diffSign}${diff}x</strong> ${ware.name}${asterisk}</span>`);
      }
    });

    // Plan >= Needs counts as matching Needs; unchecked only when there is a deficit
    const isAllSynced = !hasDeficit;
    const matchNeedsLabel = hasExceeded ? 'Match Needs<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : 'Match Needs';
    const matchNeedsTitle = hasExceeded
      ? "When checked, updates each module's Plan value to its calculated Needed count (preserving higher Plan values) and recalculates (* indicates one or more Plan values exceed Needs)"
      : "When checked, updates each module's Plan value to its calculated Needed count and recalculates";

    insTitle.innerText = 'Blueprint Inspector';
    insSub.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.15rem;">
        <span style="color:#94a3b8; font-size:0.75rem;">${escapeHtml(state.activeBlueprint.name)}</span>
        <label style="font-size:0.72rem; color:#38bdf8; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; background:rgba(56,189,248,0.15); padding:0.15rem 0.5rem; border-radius:4px; border:1px solid rgba(56,189,248,0.35); user-select:none;" title="${matchNeedsTitle}">
          <input type="checkbox" id="chkSyncOptimum" ${isAllSynced ? 'checked' : ''} style="cursor:pointer;" />
          ${matchNeedsLabel}
        </label>
      </div>
    `;

    const rawList = [
      { name: 'Ore', rate: state.calculatedDemand['Ore'] ? state.calculatedDemand['Ore'].rateNeeded : 0 },
      { name: 'Silicon', rate: state.calculatedDemand['Silicon'] ? state.calculatedDemand['Silicon'].rateNeeded : 0 },
      { name: 'Methane', rate: state.calculatedDemand['Methane'] ? state.calculatedDemand['Methane'].rateNeeded : 0 },
      { name: 'Hydrogen', rate: state.calculatedDemand['Hydrogen'] ? state.calculatedDemand['Hydrogen'].rateNeeded : 0 },
      { name: 'Helium', rate: state.calculatedDemand['Helium'] ? state.calculatedDemand['Helium'].rateNeeded : 0 },
      { name: 'Ice', rate: state.calculatedDemand['Ice'] ? state.calculatedDemand['Ice'].rateNeeded : 0, color: '#38bdf8' },
      { name: 'Raw Scrap Fragments', rate: state.calculatedDemand['RawScrap'] ? state.calculatedDemand['RawScrap'].rateNeeded : 0, color: '#34d399' },
      { name: 'Raw Kha\'ak Salvage', rate: state.calculatedDemand['RawKhaakScrap'] ? state.calculatedDemand['RawKhaakScrap'].rateNeeded : 0, color: '#c084fc' },
      { name: 'Protectyon (Condensate)', rate: state.calculatedDemand['Protectyon'] ? state.calculatedDemand['Protectyon'].rateNeeded : 0, color: '#f472b6' }
    ];

    const activeRawList = rawList.filter(item => item.rate > 0);
    const totalRaw = activeRawList.reduce((sum, item) => sum + item.rate, 0);
    const ecTotal = state.layerTotals ? state.layerTotals.totalECNeeded : (state.calculatedDemand['EC'] ? state.calculatedDemand['EC'].rateNeeded : 0);

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

    // Helper to categorize module for grouping similar module types together
    const getModuleCategoryOrder = (macro, name) => {
      const m = (macro || '').toLowerCase();
      const n = (name || '').toLowerCase();

      // 1. Habitation / Workforce
      if (m.startsWith('hab_') || n.includes('habitat') || n.includes('dome') || n.includes('biome') || n.includes('living')) return 1;
      // 2. Storage Modules
      if (m.startsWith('storage_') || n.includes('storage')) return 2;
      // 3. Docks & Piers
      if (m.startsWith('dockarea_') || m.startsWith('pier_') || n.includes('dock') || n.includes('pier') || n.includes('landing')) return 3;
      // 4. Defence Platforms
      if (m.startsWith('defence_') || m.startsWith('defense_') || n.includes('defence') || n.includes('defense') || n.includes('turret')) return 4;
      // 5. Observation & Sensors / Radar
      if (m.includes('observationdeck') || m.startsWith('radar_') || n.includes('observation') || n.includes('radar') || n.includes('sensor')) return 5;
      // 6. Connection Structures & Trusses
      if (m.startsWith('struct_') || n.includes('connection') || n.includes('structure') || n.includes('cross') || n.includes('vertical') || n.includes('base') || n.includes('truss')) return 6;

      return 7;
    };

    // Gather all non-contributing ware modules
    const nonContributingMap = {};
    let totalNonContributingCount = 0;

    if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
      Object.entries(state.activeBlueprint.rawMacros).forEach(([macro, count]) => {
        if (!mapMacroToWare(macro) && count > 0) {
          const friendly = getFriendlyModuleName(macro);
          const catOrder = getModuleCategoryOrder(macro, friendly);
          if (!nonContributingMap[friendly]) {
            nonContributingMap[friendly] = { count: 0, catOrder, name: friendly };
          }
          nonContributingMap[friendly].count += count;
          totalNonContributingCount += count;
        }
      });
    }

    const nonContributingList = Object.values(nonContributingMap)
      .sort((a, b) => {
        if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
        return a.name.localeCompare(b.name);
      })
      .map(item => `<span style="white-space:nowrap;"><strong style="color:#38bdf8;">${item.count}x</strong> ${escapeHtml(item.name)}</span>`);

    const lt = state.layerTotals || { totalECNeeded: 0, solarModulesNeeded: 0 };
    const productionEntries = sortedEntries.filter(([wId]) => WARES_DB[wId] && WARES_DB[wId].level < 4);

    let lastLevel = null;
    const levelMeta = {
      1: { title: 'Level 1: Refined Goods', color: 'var(--l1-color)', icon: '⚙️' },
      2: { title: 'Level 2: Intermediates', color: 'var(--l2-color)', icon: '🔩' },
      3: { title: 'Level 3: High-Tech Components', color: 'var(--l3-color)', icon: '🔬' }
    };

    const renderTableRow = ([wareId, calc]) => {
      const ware = WARES_DB[wareId];
      let inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
      const liveCalc = (state.calculatedDemand && state.calculatedDemand[wareId]) || (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[wareId]) || calc;
      let neededModules = liveCalc.modulesNeeded || 0;
      const neededCountStr = neededModules >= 1 ? `${neededModules}x` : `${neededModules.toFixed(1)}x`;
      const isDirectPlan = inPlanCount > 0;
      const isSubdued = state.subdueZeroX && inPlanCount === 0;
      const isExceeded = inPlanCount > neededModules;
      const asterisk = isExceeded ? '<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : '';

      const optimumRate = liveCalc.rateNeeded > 0 
        ? liveCalc.rateNeeded 
        : (wareId === 'ScrapHullParts' || wareId === 'ScrapClaytronics'
          ? calculateLiveOutputRate(wareId, neededModules, 0)
          : (neededModules * getWareHourlyRatePerModule(wareId, state.workforceBonus)));
      const currentRate = calculateLiveOutputRate(wareId, inPlanCount, optimumRate);
      const planColor = inPlanCount > 0 ? '#38bdf8' : '#64748b';

      const planNeededDisplay = `
        <div style="display:inline-flex; align-items:center; gap:4px;">
          <input type="number" class="bp-table-qty-input" data-ware="${wareId}" min="0" value="${inPlanCount}" style="width:44px; background:rgba(15,23,42,0.9); border:1px solid ${inPlanCount > 0 ? '#38bdf8' : 'rgba(255,255,255,0.2)'}; border-radius:4px; color:${planColor}; font-weight:700; font-size:0.75rem; text-align:center; padding:1px 3px; outline:none;" title="Type planned module count directly to recalculate" />
          <span style="color:#94a3b8; font-weight:600;">/</span>
          <strong style="color:#34d399;">${neededCountStr}</strong>
        </div>
      `;

      let ecConsRate = 0;
      if (ware.recipe && ware.recipe['EC']) {
        const modCount = inPlanCount > 0 ? inPlanCount : neededModules;
        ecConsRate = modCount * ware.recipe['EC'];
      }
      if (NO_PP_WARES.has(wareId)) {
        ecConsRate = 0;
      }
      if (wareId === 'ScrapMetal') {
        ecConsRate = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : 0;
      } else if (wareId === 'TerScrapMetal') {
        const hasGenSm = Boolean(state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapMetal']);
        if (!hasGenSm && state.scrapMetalEc && state.scrapMetalEc.totalDemand > 0) {
          ecConsRate = state.scrapMetalEc.totalDemand;
        } else {
          ecConsRate = 0;
        }
      }

      const rateDisplay = `
        <div style="font-size:0.75rem; line-height:1.35;">
          <div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${planColor};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>
          <div><span style="color:#94a3b8; font-size:0.68rem;">Optimum:</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
        </div>
      `;

      return `
        <tr style="${isDirectPlan ? 'background:rgba(56,189,248,0.08);' : ''} ${isSubdued ? 'opacity:0.3; filter:grayscale(100%); font-style:italic;' : ''}">
          <td>
            <div>
              <strong>${ware.name}${isExceeded ? '<span style="color:#fb923c; font-weight:bold; margin-left:2px;" title="Plan exceeds Needs">*</span>' : ''}</strong> <span style="color:#94a3b8; font-size:0.72rem;">(L${ware.level})</span>
              ${isDirectPlan ? `<span style="font-size:0.65rem; color:#38bdf8; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); padding:1px 5px; border-radius:3px; margin-left:4px;" title="${isExceeded ? `Plan (${inPlanCount}x) exceeds Needs (${neededModules}x)` : 'Included in station blueprint'}">[In Plan${asterisk}]</span>` : ''}
            </div>
            ${!state.subdueEcCalc && ecConsRate > 0 ? `
              <div style="margin-top:3px;">
                <span class="rate-badge-cons" style="font-size:0.68rem; padding:1px 5px;" title="Energy Cells consumed per hour">⚡ Consumes ${Math.round(ecConsRate).toLocaleString()} EC/hr</span>
              </div>
            ` : ''}
          </td>
          <td class="highlight-val"><span class="module-badge" style="font-size:0.75rem;">${planNeededDisplay}</span></td>
          <td>${rateDisplay}</td>
        </tr>
      `;
    };

    const renderLevelPanel = (lvl) => {
      const meta = levelMeta[lvl] || { title: `Level ${lvl}`, color: '#38bdf8', icon: '🔹' };
      const levelEntries = productionEntries.filter(([wId]) => WARES_DB[wId] && WARES_DB[wId].level === lvl);

      let lvlPlan = 0;
      let lvlNeeds = 0;
      levelEntries.forEach(([wareId, calc]) => {
        const inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
        const liveCalc = (state.calculatedDemand && state.calculatedDemand[wareId]) || (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[wareId]) || calc;
        lvlPlan += inPlan;
        lvlNeeds += (liveCalc.modulesNeeded || 0);
      });

      const isCollapsed = state.bpLevelCollapsed ? Boolean(state.bpLevelCollapsed[lvl]) : true;
      const arrowChar = isCollapsed ? '▶' : '▼';

      return `
        <div class="bp-level-panel" data-level="${lvl}">
          <div class="bp-level-header" data-level="${lvl}" title="Click to ${isCollapsed ? 'expand' : 'collapse'} ${meta.title}">
            <div class="bp-level-title-group">
              <span class="bp-level-arrow">${arrowChar}</span>
              <span style="color:${meta.color}; font-weight:700; font-size:0.78rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em;">
                ${meta.icon} ${meta.title}
              </span>
            </div>
            <div class="bp-level-badge-group">
              <span style="font-size:0.7rem; color:#94a3b8; background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:3px; border:1px solid rgba(255,255,255,0.08);">
                ${levelEntries.length} Wares
              </span>
              <span style="font-size:0.7rem; font-weight:600; color:${lvlPlan >= lvlNeeds ? '#34d399' : '#fbbf24'}; background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:3px; border:1px solid rgba(255,255,255,0.08);" title="Total modules in plan vs calculated needed">
                ${lvlPlan}x Plan / ${Math.round(lvlNeeds)}x Needs
              </span>
            </div>
          </div>
          <div class="bp-level-body" style="display:${isCollapsed ? 'none' : 'block'};">
            ${levelEntries.length > 0 ? `
              <table class="summary-table">
                <thead>
                  <tr>
                    <th class="th-bp-sort-comp sortable" title="Click to sort by Component Name">
                      Component ${state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
                    </th>
                    <th class="th-bp-sort-needed sortable" title="Click to sort by Needs Modules">
                      Plan / Needs ${state.bpSortField === 'needed' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
                    </th>
                    <th>Current / Optimum Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${levelEntries.map(renderTableRow).join('')}
                </tbody>
              </table>
            ` : `
              <div style="padding:0.5rem 0.65rem; font-size:0.75rem; color:#64748b; font-style:italic;">
                No active or needed modules in this level.
              </div>
            `}
          </div>
        </div>
      `;
    };

    const wf = calculateBlueprintWorkforce(state.activeBlueprint);
    const hasWorkforce = wf.totalOptimalWorkforce > 0 || wf.totalHabitationCapacity > 0;
    const isWfCollapsed = Boolean(state.workforceSummaryCollapsed);
    const isNcCollapsed = Boolean(state.nonContributingCollapsed);
    const isRawCollapsed = Boolean(state.rawMiningCollapsed);
    const isDiffCollapsed = Boolean(state.moduleDiffCollapsed);

    const redShortages = [];
    if (wf.surplusDeficit < 0) {
      redShortages.push(`<span style="color:#ef4444; background:rgba(239,68,68,0.15); padding:1px 6px; border-radius:3px; border:1px solid rgba(239,68,68,0.35); font-size:0.7rem; font-weight:700;" title="Workforce Bed Shortage: ${wf.surplusDeficit.toLocaleString()} beds">🛏️ ${wf.surplusDeficit.toLocaleString()} beds</span>`);
    }
    if (wf.lifeSupport && wf.lifeSupport.foodBalance < 0) {
      redShortages.push(`<span style="color:#ef4444; background:rgba(239,68,68,0.15); padding:1px 6px; border-radius:3px; border:1px solid rgba(239,68,68,0.35); font-size:0.7rem; font-weight:700;" title="Food Rations Shortage: ${Math.round(wf.lifeSupport.foodBalance).toLocaleString()} / hr">🍞 ${Math.round(wf.lifeSupport.foodBalance).toLocaleString()}/hr</span>`);
    }
    if (wf.lifeSupport && wf.lifeSupport.medBalance < 0) {
      redShortages.push(`<span style="color:#ef4444; background:rgba(239,68,68,0.15); padding:1px 6px; border-radius:3px; border:1px solid rgba(239,68,68,0.35); font-size:0.7rem; font-weight:700;" title="Medical Supplies Shortage: ${Math.round(wf.lifeSupport.medBalance).toLocaleString()} / hr">💊 ${Math.round(wf.lifeSupport.medBalance).toLocaleString()}/hr</span>`);
    }

    insBody.innerHTML = `
      <div class="workforce-box bp-raw-panel" style="border-color:#38bdf8; margin-bottom:0.6rem; padding:0; overflow:hidden; flex-shrink:0; width:100%; box-sizing:border-box;">
        <div class="bp-raw-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.5rem 0.65rem; background:rgba(56,189,248,0.08); user-select:none; gap:6px; flex-wrap:wrap;" title="Click to ${isRawCollapsed ? 'expand' : 'collapse'} Total Recalculated Raw Mining & Liquids">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="bp-raw-arrow" style="font-size:0.75rem; color:#38bdf8; width:12px; display:inline-block;">${isRawCollapsed ? '▶' : '▼'}</span>
            <h4 style="margin:0; color:#38bdf8; font-size:0.8rem;">⛏️ Total Recalculated Raw Mining & Liquids</h4>
          </div>
          <div class="bp-raw-collapsed-preview" style="display:${isRawCollapsed ? 'inline-flex' : 'none'}; align-items:center; gap:6px; font-size:0.7rem;">
            <span style="color:#34d399; font-weight:700;">${Math.round(totalRaw).toLocaleString()}/hr</span>
            <span style="color:#fbbf24; font-weight:700;">⚡ ${Math.round(ecTotal).toLocaleString()}/hr</span>
          </div>
        </div>
        <div class="bp-raw-body" style="padding:0.5rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); display:${isRawCollapsed ? 'none' : 'block'};">
          <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
          <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Demand:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
        </div>
      </div>

      ${hasWorkforce ? `
        <div class="workforce-box bp-wf-panel" style="border-color:#10b981; margin-bottom:0.6rem; padding:0; overflow:hidden; flex-shrink:0; width:100%; box-sizing:border-box;">
          <div class="bp-wf-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.5rem 0.65rem; background:rgba(16,185,129,0.08); user-select:none; gap:6px; flex-wrap:wrap;" title="Click to ${isWfCollapsed ? 'expand' : 'collapse'} Station Workforce Summary">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="bp-wf-arrow" style="font-size:0.75rem; color:#34d399; width:12px; display:inline-block;">${isWfCollapsed ? '▶' : '▼'}</span>
              <h4 style="margin:0; color:#34d399; font-size:0.8rem;">👥 Station Workforce Summary</h4>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <div class="bp-wf-collapsed-deficits" style="display:${isWfCollapsed ? 'inline-flex' : 'none'}; align-items:center; gap:4px; flex-wrap:wrap;">
                ${redShortages.join('')}
              </div>
              <span style="font-size:0.7rem; font-weight:700; padding:1px 6px; border-radius:4px; background:${wf.coveragePercent >= 100 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color:${wf.coveragePercent >= 100 ? '#34d399' : '#ef4444'}; border:1px solid ${wf.coveragePercent >= 100 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};">
                ${wf.coveragePercent}% Coverage
              </span>
            </div>
          </div>
          <div class="bp-wf-body" style="padding:0.5rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); display:${isWfCollapsed ? 'none' : 'block'};">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.35rem 0.6rem; font-size:0.76rem;">
              <div><span style="color:#94a3b8;">Optimal Needed:</span> <strong style="color:#38bdf8;">${wf.totalOptimalWorkforce.toLocaleString()}</strong></div>
              <div><span style="color:#94a3b8;">Hab Capacity:</span> <strong style="color:#34d399;">${wf.totalHabitationCapacity.toLocaleString()}</strong></div>
              <div><span style="color:#94a3b8;">Production:</span> <strong style="color:#cbd5e1;">${wf.productionWorkforce.toLocaleString()}</strong></div>
              <div><span style="color:#94a3b8;">Shipyards:</span> <strong style="color:#cbd5e1;">${wf.shipyardWorkforce.toLocaleString()}</strong></div>
            </div>
            <div style="margin-top:0.4rem; font-size:0.74rem; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.08); padding-top:0.3rem;">
              <span style="color:#94a3b8;">Workforce Balance:</span>
              <strong style="color:${wf.surplusDeficit >= 0 ? '#34d399' : '#ef4444'};">
                ${wf.surplusDeficit >= 0 ? `+${wf.surplusDeficit.toLocaleString()} surplus beds (${wf.habitatCount} habitats)` : `${wf.surplusDeficit.toLocaleString()} bed shortage`}
              </strong>
            </div>
            ${wf.lifeSupport && (wf.lifeSupport.totalFoodRationsProd > 0 || wf.lifeSupport.totalAllMedSuppliesProd > 0) ? `
            <div style="margin-top:0.35rem; font-size:0.74rem; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.25rem;">
              <span style="color:#94a3b8;">Sustainable Workers:</span>
              <strong style="color:${wf.lifeSupport.sustainableWorkers >= wf.totalOptimalWorkforce ? '#34d399' : '#fbbf24'};">
                ${wf.lifeSupport.sustainableWorkers.toLocaleString()} (${wf.lifeSupport.sustainableCoveragePercent}% self-sufficient)
              </strong>
            </div>
            ` : ''}
            ${wf.lifeSupport && (wf.lifeSupport.totalFoodRationsProd > 0 || wf.lifeSupport.totalAllMedSuppliesProd > 0) ? `
            <div style="margin-top:0.35rem; font-size:0.72rem; background:rgba(0,0,0,0.2); padding:0.3rem 0.45rem; border-radius:4px; border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:0.2rem;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">🍞 Food Rations:</span>
                <span><strong>${Math.round(wf.lifeSupport.totalFoodRationsProd).toLocaleString()}</strong> / hr vs <strong>${Math.round(wf.lifeSupport.foodRationsDemand).toLocaleString()}</strong> needed (<span style="color:${wf.lifeSupport.foodBalance >= 0 ? '#34d399' : '#ef4444'}; font-weight:700;">${wf.lifeSupport.foodBalance >= 0 ? '+' : ''}${Math.round(wf.lifeSupport.foodBalance).toLocaleString()}</span>)</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">💊 Medical Supplies:</span>
                <span><strong>${Math.round(wf.lifeSupport.totalArgMedSuppliesProd || wf.lifeSupport.totalAllMedSuppliesProd).toLocaleString()}</strong> / hr vs <strong>${Math.round(wf.lifeSupport.medicalSuppliesDemand).toLocaleString()}</strong> needed (<span style="color:${wf.lifeSupport.medBalance >= 0 ? '#34d399' : '#ef4444'}; font-weight:700;">${wf.lifeSupport.medBalance >= 0 ? '+' : ''}${Math.round(wf.lifeSupport.medBalance).toLocaleString()}</span>)</span>
              </div>
            </div>
            ` : ''}
            ${(wf.consumersList.length > 0 || wf.providersList.length > 0) ? `
              <details style="margin-top:0.45rem; font-size:0.72rem; cursor:pointer;">
                <summary style="color:#38bdf8; user-select:none; font-weight:600; outline:none;">🔍 View Workforce Breakdown (${wf.consumersList.length} consumers, ${wf.providersList.length} habitats)</summary>
                <div style="margin-top:0.35rem; max-height:160px; overflow-y:auto; padding-right:4px; background:rgba(0,0,0,0.2); padding:0.3rem 0.4rem; border-radius:4px;">
                  <div style="font-weight:700; color:#cbd5e1; margin-bottom:0.2rem; text-transform:uppercase; font-size:0.68rem;">Top Consumers:</div>
                  ${wf.consumersList.slice(0, 10).map(c => `
                    <div style="display:flex; justify-content:space-between; padding:1px 0; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.03);">
                      <span>${c.count}x ${escapeHtml(c.name)}</span>
                      <strong style="color:#38bdf8;">${c.total.toLocaleString()}</strong>
                    </div>
                  `).join('')}
                  ${wf.providersList.length > 0 ? `
                    <div style="font-weight:700; color:#cbd5e1; margin-top:0.35rem; margin-bottom:0.2rem; text-transform:uppercase; font-size:0.68rem;">Habitation Modules:</div>
                    ${wf.providersList.map(p => `
                      <div style="display:flex; justify-content:space-between; padding:1px 0; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.03);">
                        <span>${p.count}x ${escapeHtml(p.name)}</span>
                        <strong style="color:#34d399;">${p.total.toLocaleString()}</strong>
                      </div>
                    `).join('')}
                  ` : ''}
                </div>
              </details>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <div style="margin-top:0.6rem;">
        <div class="section-label">All Plan Modules & Recalculated Upstream Chains</div>
        ${[1, 2, 3].map(lvl => renderLevelPanel(lvl)).join('')}
      </div>

      <div class="module-diff-box bp-diff-panel" style="margin-top:0.65rem; padding:0; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:0.75rem; flex-shrink:0; width:100%; box-sizing:border-box; overflow:hidden;">
        <div class="bp-diff-header" style="font-weight:700; color:#94a3b8; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em; font-size:0.7rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.45rem 0.65rem; background:rgba(255,255,255,0.02); user-select:none;" title="Click to ${isDiffCollapsed ? 'expand' : 'collapse'} Plan vs Needs Module Differences">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="bp-diff-arrow" style="font-size:0.75rem; color:#fbbf24; width:12px; display:inline-block;">${isDiffCollapsed ? '▶' : '▼'}</span>
            <span>⚖️ Plan vs Needs Module Differences</span>
          </div>
          <span style="color:#fbbf24; font-weight:700; background:rgba(251,191,36,0.1); padding:1px 6px; border-radius:3px; border:1px solid rgba(251,191,36,0.25);">${diffList.length} Differences</span>
        </div>
        <div class="bp-diff-body" style="padding:0.45rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); color:#cbd5e1; line-height:1.45; display:${isDiffCollapsed ? 'none' : 'block'};">
          ${diffList.length > 0 ? diffList.join(', ') : '<span style="color:#34d399; font-style:italic;">All active modules match Needs count!</span>'}
        </div>
      </div>

      ${renderConstructionBudgetInspectorHTML(state)}

      <div class="non-contributing-box bp-nc-panel" style="margin-top:0.65rem; padding:0; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:0.75rem; flex-shrink:0; width:100%; box-sizing:border-box; overflow:hidden;">
        <div class="bp-nc-header" style="font-weight:700; color:#94a3b8; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em; font-size:0.7rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.45rem 0.65rem; background:rgba(255,255,255,0.02); user-select:none;" title="Click to ${isNcCollapsed ? 'expand' : 'collapse'} Non-Contributing Ware Modules">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="bp-nc-arrow" style="font-size:0.75rem; color:#38bdf8; width:12px; display:inline-block;">${isNcCollapsed ? '▶' : '▼'}</span>
            <span>📦 Non-Contributing Ware Modules</span>
          </div>
          <span style="color:#38bdf8; font-weight:700; background:rgba(56,189,248,0.1); padding:1px 6px; border-radius:3px; border:1px solid rgba(56,189,248,0.25);">Total: ${totalNonContributingCount}</span>
        </div>
        <div class="bp-nc-body" style="padding:0.45rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); color:#cbd5e1; line-height:1.45; display:${isNcCollapsed ? 'none' : 'block'};">
          ${nonContributingList.length > 0 ? nonContributingList.join(', ') : '<span style="color:#64748b; font-style:italic;">None</span>'}
        </div>
      </div>
    `;

    document.querySelectorAll('.bp-table-qty-input').forEach(input => {
      const handlePlanChange = (e) => {
        const wareId = e.target.dataset.ware;
        const newQty = Math.max(0, parseInt(e.target.value) || 0);

        if (!state.activeBlueprint) {
          state.activeBlueprint = {
            name: 'Custom Planned Station Blueprint',
            totalModules: 0,
            modules: {},
            rawMacros: {}
          };
        }
        if (!state.activeBlueprint.modules) state.activeBlueprint.modules = {};
        if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};

        let macroKey = null;
        if (wareId === 'ScrapMetal' || wareId === 'ScrapHullParts' || wareId === 'ScrapClaytronics') {
          macroKey = (state.activeBlueprint.rawMacros && state.activeBlueprint.rawMacros['prod_gen_scraprecycler_macro'] !== undefined)
            ? 'prod_gen_scraprecycler_macro'
            : 'prod_gen_scrap_recycler_macro';
        } else if (wareId === 'TerScrapMetal' || wareId === 'TerCompSubstrate' || wareId === 'TerSilCarbide') {
          macroKey = (state.activeBlueprint.rawMacros && state.activeBlueprint.rawMacros['prod_ter_scraprecycler_macro'] !== undefined)
            ? 'prod_ter_scraprecycler_macro'
            : 'prod_ter_scrap_recycler_macro';
        } else if (wareId === 'ScrapProc') {
          macroKey = getPrimaryMacroForWare('ScrapProc');
        } else {
          macroKey = Object.keys(state.activeBlueprint.rawMacros).find(m => mapMacroToWare(m) === wareId);
          if (!macroKey) {
            macroKey = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wareId);
          }
        }

          if (macroKey) {
            if (newQty <= 0) {
              delete state.activeBlueprint.rawMacros[macroKey];
              if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
            } else {
              state.activeBlueprint.rawMacros[macroKey] = newQty;
              if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = newQty;
            }
          }

          if (newQty <= 0) {
            delete state.activeBlueprint.modules[wareId];
          } else {
            state.activeBlueprint.modules[wareId] = newQty;
          }

        delete state.activeBlueprint.modules['RawScrap'];

        rebuildBlueprintFromMacros();
        saveActiveBlueprintToStorage();

        if (typeof onRender === 'function') {
          onRender();
        } else {
          calculateFactoryRequirements();
          updateInspector(id, onRender);
        }
      };

      input.addEventListener('blur', handlePlanChange);
      input.addEventListener('change', handlePlanChange);
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });
    });

    insBody.querySelectorAll('.bp-raw-header').forEach(header => {
      header.addEventListener('click', () => {
        state.rawMiningCollapsed = !state.rawMiningCollapsed;
        try {
          localStorage.setItem('x4_raw_mining_collapsed', String(state.rawMiningCollapsed));
        } catch (e) {}

        const panel = header.closest('.bp-raw-panel');
        const arrow = header.querySelector('.bp-raw-arrow');
        const body = panel ? panel.querySelector('.bp-raw-body') : null;
        const preview = header.querySelector('.bp-raw-collapsed-preview');
        const isCollapsed = Boolean(state.rawMiningCollapsed);

        if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
        if (body) body.style.display = isCollapsed ? 'none' : 'block';
        if (preview) preview.style.display = isCollapsed ? 'inline-flex' : 'none';
        header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} Total Recalculated Raw Mining & Liquids`;
      });
    });

    insBody.querySelectorAll('.construction-budget-panel').forEach(panel => {
      bindCrbListeners(panel);
    });

    insBody.querySelectorAll('.bp-wf-header').forEach(header => {
      header.addEventListener('click', () => {
        state.workforceSummaryCollapsed = !state.workforceSummaryCollapsed;
        try {
          localStorage.setItem('x4_wf_summary_collapsed', String(state.workforceSummaryCollapsed));
        } catch (e) {}

        const panel = header.closest('.bp-wf-panel');
        const arrow = header.querySelector('.bp-wf-arrow');
        const body = panel ? panel.querySelector('.bp-wf-body') : null;
        const deficits = header.querySelector('.bp-wf-collapsed-deficits');
        const isCollapsed = Boolean(state.workforceSummaryCollapsed);

        if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
        if (body) body.style.display = isCollapsed ? 'none' : 'block';
        if (deficits) deficits.style.display = isCollapsed ? 'inline-flex' : 'none';
        header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} Station Workforce Summary`;
      });
    });

    insBody.querySelectorAll('.bp-diff-header').forEach(header => {
      header.addEventListener('click', () => {
        state.moduleDiffCollapsed = !state.moduleDiffCollapsed;
        try {
          localStorage.setItem('x4_diff_collapsed', String(state.moduleDiffCollapsed));
        } catch (e) {}

        const panel = header.closest('.bp-diff-panel');
        const arrow = header.querySelector('.bp-diff-arrow');
        const body = panel ? panel.querySelector('.bp-diff-body') : null;
        const isCollapsed = Boolean(state.moduleDiffCollapsed);

        if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
        if (body) body.style.display = isCollapsed ? 'none' : 'block';
        header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} Plan vs Needs Module Differences`;
      });
    });

    insBody.querySelectorAll('.bp-nc-header').forEach(header => {
      header.addEventListener('click', () => {
        state.nonContributingCollapsed = !state.nonContributingCollapsed;
        try {
          localStorage.setItem('x4_nc_modules_collapsed', String(state.nonContributingCollapsed));
        } catch (e) {}

        const panel = header.closest('.bp-nc-panel');
        const arrow = header.querySelector('.bp-nc-arrow');
        const body = panel ? panel.querySelector('.bp-nc-body') : null;
        const isCollapsed = Boolean(state.nonContributingCollapsed);

        if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
        if (body) body.style.display = isCollapsed ? 'none' : 'block';
        header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} Non-Contributing Ware Modules`;
      });
    });

    document.querySelectorAll('.bp-level-header').forEach(header => {
      header.addEventListener('click', () => {
        const lvl = parseInt(header.dataset.level);
        if (!lvl) return;
        if (!state.bpLevelCollapsed) state.bpLevelCollapsed = {};
        state.bpLevelCollapsed[lvl] = !state.bpLevelCollapsed[lvl];
        try {
          sessionStorage.setItem('x4_bp_level_collapsed', JSON.stringify(state.bpLevelCollapsed));
        } catch(err) {}

        const panel = header.closest('.bp-level-panel');
        const arrow = header.querySelector('.bp-level-arrow');
        const body = panel ? panel.querySelector('.bp-level-body') : null;
        const isCollapsed = state.bpLevelCollapsed[lvl];

        if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
        if (body) body.style.display = isCollapsed ? 'none' : 'block';
        header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} ${levelMeta[lvl] ? levelMeta[lvl].title : 'Level ' + lvl}`;
      });
    });

    document.querySelectorAll('.th-bp-sort-comp').forEach(th => {
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.bpSortField === 'component') {
          state.bpSortAsc = !state.bpSortAsc;
        } else {
          state.bpSortField = 'component';
          state.bpSortAsc = true;
        }
        updateInspector(id, onRender);
      });
    });

    document.querySelectorAll('.th-bp-sort-needed').forEach(th => {
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.bpSortField === 'needed') {
          state.bpSortAsc = !state.bpSortAsc;
        } else {
          state.bpSortField = 'needed';
          state.bpSortAsc = false;
        }
        updateInspector(id, onRender);
      });
    });

    const handleSyncOptimum = (e) => {
      if (!e.target.checked) {
        reloadActiveBlueprint(onRender);
        if (typeof onRender !== 'function') {
          calculateFactoryRequirements();
          updateInspector(id, onRender);
        }
        return;
      }
      if (!state.activeBlueprint) return;
      if (!state.activeBlueprint.modules) state.activeBlueprint.modules = {};
      if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};

      const allWares = new Set([
        'EC',
        'TerEC',
        ...Object.keys(WARES_DB).filter(w => WARES_DB[w].level >= 1 && WARES_DB[w].level <= 3),
        ...Object.keys(liveDemand || {})
      ]);

      allWares.forEach(wId => {
        const ware = WARES_DB[wId];
        if (!ware) return;
        if (ware.level === 0 && wId !== 'EC' && wId !== 'TerEC') return;
        if (ware.level === 4) return;

        let optimum = 0;
        if (wId === 'EC' || wId === 'TerEC') {
          optimum = (liveDemand[wId] ? liveDemand[wId].modulesNeeded : 0) || 0;
        } else if (liveDemand[wId]) {
          optimum = liveDemand[wId].modulesNeeded || 0;
        }

        const currentPlan = (state.activeBlueprint.modules && state.activeBlueprint.modules[wId]) || 0;

        // If Plan value exceeds Needs value, do not update Plan value to Needs value (preserve higher Plan count)
        if (currentPlan > optimum) {
          return;
        }

        // Solar panels (EC and TerEC) installed in station blueprint are preserved and not overridden
        if ((wId === 'EC' || wId === 'TerEC') && currentPlan > 0) {
          return;
        }

        if (wId === 'ScrapMetal' || wId === 'TerScrapMetal') {
          return;
        }

        if (wId === 'ScrapClaytronics' || wId === 'ScrapHullParts') {
          const macroKey = state.activeBlueprint.rawMacros['prod_gen_scraprecycler_macro'] !== undefined
            ? 'prod_gen_scraprecycler_macro'
            : 'prod_gen_scrap_recycler_macro';
          if (optimum > 0) {
            state.activeBlueprint.modules[wId] = optimum;
            state.activeBlueprint.modules['ScrapMetal'] = Math.max(state.activeBlueprint.modules['ScrapClaytronics'] || 0, state.activeBlueprint.modules['ScrapHullParts'] || 0);
            state.activeBlueprint.rawMacros[macroKey] = Math.max(state.activeBlueprint.rawMacros[macroKey] || 0, optimum);
            if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = Math.max(state.activeBlueprint.rootMacros[macroKey] || 0, optimum);
          } else {
            delete state.activeBlueprint.modules[wId];
            const otherId = wId === 'ScrapClaytronics' ? 'ScrapHullParts' : 'ScrapClaytronics';
            if (!state.activeBlueprint.modules[otherId]) {
              delete state.activeBlueprint.modules['ScrapMetal'];
              delete state.activeBlueprint.rawMacros[macroKey];
              if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
            } else {
              state.activeBlueprint.modules['ScrapMetal'] = state.activeBlueprint.modules[otherId];
            }
          }
          return;
        }

        if (wId === 'TerCompSubstrate' || wId === 'TerSilCarbide') {
          const macroKey = state.activeBlueprint.rawMacros['prod_ter_scraprecycler_macro'] !== undefined
            ? 'prod_ter_scraprecycler_macro'
            : 'prod_ter_scrap_recycler_macro';
          if (optimum > 0) {
            state.activeBlueprint.modules[wId] = optimum;
            state.activeBlueprint.modules['TerScrapMetal'] = Math.max(state.activeBlueprint.modules['TerCompSubstrate'] || 0, state.activeBlueprint.modules['TerSilCarbide'] || 0);
            state.activeBlueprint.rawMacros[macroKey] = Math.max(state.activeBlueprint.rawMacros[macroKey] || 0, optimum);
            if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = Math.max(state.activeBlueprint.rootMacros[macroKey] || 0, optimum);
          } else {
            delete state.activeBlueprint.modules[wId];
            const otherId = wId === 'TerCompSubstrate' ? 'TerSilCarbide' : 'TerCompSubstrate';
            if (!state.activeBlueprint.modules[otherId]) {
              delete state.activeBlueprint.modules['TerScrapMetal'];
              delete state.activeBlueprint.rawMacros[macroKey];
              if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
            } else {
              state.activeBlueprint.modules['TerScrapMetal'] = state.activeBlueprint.modules[otherId];
            }
          }
          return;
        }

        // Clean up all existing macros for this ware to prevent double counting
        const matchingMacros = Object.keys(state.activeBlueprint.rawMacros).filter(m => mapMacroToWare(m) === wId);
        matchingMacros.forEach(m => {
          delete state.activeBlueprint.rawMacros[m];
          if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[m];
        });

        // Determine primary macro name
        let primaryMacro = matchingMacros[0];
        if (wId === 'ScrapProc') {
          primaryMacro = getPrimaryMacroForWare('ScrapProc');
        } else if (!primaryMacro) {
          primaryMacro = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wId);
        }
        if (!primaryMacro) {
          primaryMacro = `prod_gen_${wId.toLowerCase()}_macro`;
        }

        if (optimum > 0) {
          state.activeBlueprint.modules[wId] = optimum;
          state.activeBlueprint.rawMacros[primaryMacro] = optimum;
          if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[primaryMacro] = optimum;
        } else {
          delete state.activeBlueprint.modules[wId];
        }
      });

      delete state.activeBlueprint.modules['RawScrap'];

      rebuildBlueprintFromMacros();
      saveActiveBlueprintToStorage();

      if (typeof onRender === 'function') {
        onRender();
      } else {
        calculateFactoryRequirements();
        updateInspector(id, onRender);
      }
    };

    const chkSyncOptimum = document.getElementById('chkSyncOptimum');
    if (chkSyncOptimum) chkSyncOptimum.addEventListener('change', handleSyncOptimum);

    if (prevInsScrollTop > 0) {
      insBody.scrollTop = prevInsScrollTop;
    }

    return;
  }

  // CASE 2: No active blueprint loaded & no card selected
  if (!id || !WARES_DB[id]) {
    insTitle.innerText = 'Blueprint Inspector';
    insSub.innerText = 'Station Construction Budget';
    insBody.innerHTML = `
      ${renderConstructionBudgetInspectorHTML(state)}
      <div style="padding: 0.5rem; color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">
        <p>No station blueprint is currently active.</p>
        <p style="margin-top:0.5rem;">Click on any material card in the matrix to select it as a Single Production Target, or upload a station <code>.xml</code> blueprint file.</p>
      </div>
    `;

    insBody.querySelectorAll('.construction-budget-panel').forEach(panel => {
      bindCrbListeners(panel);
    });

    if (prevInsScrollTop > 0) {
      insBody.scrollTop = prevInsScrollTop;
    }

    return;
  }

  // CASE 3: A specific card is selected (including Level 4 components)
  const ware = WARES_DB[id];
  insTitle.innerText = ware.name;
  let cycleSec = getWareCycleTimeSec(ware);
  let cycleOut = getWareOutputPerCycle(ware, state.workforceBonus);
  if (id === 'ScrapHullParts' || id === 'ScrapClaytronics') {
    const scrapYield = getScrapRecyclerCycleYield(id, state.workforceBonus);
    if (scrapYield) {
      cycleSec = 600;
      cycleOut = scrapYield.yieldPerCycle;
    }
  } else if (id === 'EC' || id === 'TerEC') {
    const isTer = id === 'TerEC';
    const baseOutput = ware.baseRate || (isTer ? 3000 : 10500);
    const moduleMaxBonus = isTer ? 0.0 : 0.43;
    const activeSector = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
    const solarInfo = getSolarDynamicCycles(activeSector || 100, state.workforceBonus, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60);
    cycleSec = solarInfo.cycleDurationSec;
    cycleOut = solarInfo.cycleYield;
  }
  const formattedSec = (typeof cycleSec === 'number' && cycleSec % 1 !== 0) ? cycleSec.toFixed(1) : cycleSec;
  const cycleInfoStr = cycleSec > 0 ? ` • ${formattedSec}s cycle (${Math.floor(cycleOut)} units)` : '';
  insSub.innerText = `Level ${ware.level} • ${ware.cat}${cycleInfoStr}`;

  const smInPlan = (state.activeBlueprint && state.activeBlueprint.modules && ((state.activeBlueprint.modules['ScrapMetal'] || 0) + (state.activeBlueprint.modules['TerScrapMetal'] || 0) + (state.activeBlueprint.modules['ScrapProc'] || 0))) || 0;
  const smCalc = state.calculatedDemand && (state.calculatedDemand['ScrapMetal'] || state.calculatedDemand['TerScrapMetal'] || state.calculatedDemand['ScrapProc']);
  const smOutputNonZero = smInPlan > 0 || (smCalc && (smCalc.rateNeeded > 0 || smCalc.modulesNeeded > 0)) || (state.selectedWareId === 'ScrapMetal' || state.selectedWareId === 'TerScrapMetal' || state.selectedWareId === 'ScrapProc' || state.selectedWareId === 'RawScrap');

  let inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[id]) || 0;
  const planModCount = inPlanCount > 0 ? inPlanCount : (state.calculatedDemand[id] ? state.calculatedDemand[id].modulesNeeded : 1);
  const effectiveCount = state.inspectorSingle ? 1 : Math.max(1, planModCount);

  // Compute upstream requirements strictly for the selected card and its direct/upstream recipe inputs to Level 0
  const activeDemand = {};
  const sQueue = [];

  if (ware.level === 4) {
    if (ware.recipe) {
      Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
        const reqQty = inpQty * effectiveCount;
        activeDemand[inpId] = { rateNeeded: reqQty, modulesNeeded: 0 };
        const inpW = WARES_DB[inpId];
        if (inpW && inpW.level > 0) {
          activeDemand[inpId].modulesNeeded = Math.ceil(reqQty / getWareHourlyRatePerModule(inpId, state.workforceBonus));
        }
        sQueue.push({ id: inpId, requiredRate: reqQty });
      });
    }
  } else if (ware.level > 0) {
    const targetOut = (id === 'ScrapHullParts' || id === 'ScrapClaytronics')
      ? calculateLiveOutputRate(id, effectiveCount, 0)
      : (effectiveCount * getWareHourlyRatePerModule(id, state.workforceBonus));
    activeDemand[id] = { rateNeeded: targetOut, modulesNeeded: effectiveCount };

    if (id === 'ScrapProc') {
      const scrapRaw = state.scrapRawDemand || calculateScrapMetalRawScrapDemand();
      const smTotalDemand = scrapRaw ? ((scrapRaw.genRawScrapDemand || 0) + (scrapRaw.terRawScrapDemand || 0)) : 0;
      if (smTotalDemand > 0 && !state.inspectorSingle) {
        const procBaseRate = (WARES_DB['ScrapProc'] && WARES_DB['ScrapProc'].baseRate) || 9000;
        const procNeeds = Math.ceil(smTotalDemand / procBaseRate);
        activeDemand['ScrapProc'] = {
          rateNeeded: smTotalDemand,
          modulesNeeded: procNeeds
        };
      }
    }

    if (ware.recipe) {
      Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
        let inpRate = effectiveCount * inpQty;
        if ((id === 'ScrapMetal' || id === 'TerScrapMetal') && inpId === 'EC') {
          inpRate = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : inpRate;
        }
        if (id === 'ScrapProc' && inpId === 'EC') {
          inpRate = state.scrapMetalEc ? state.scrapMetalEc.processorEc : inpRate;
        }
        if (id === 'ScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          inpRate = state.scrapRawDemand ? state.scrapRawDemand.genRawScrapDemand : inpRate;
        }
        if (id === 'TerScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          inpRate = state.scrapRawDemand ? state.scrapRawDemand.terRawScrapDemand : inpRate;
        }
        if (id === 'ScrapProc' && inpId === 'RawScrap') {
          inpRate = state.scrapRawDemand ? state.scrapRawDemand.totalRawScrapDemand : inpRate;
        }
        if (NO_PP_WARES.has(id) && inpId === 'EC') {
          return;
        }
        activeDemand[inpId] = { rateNeeded: inpRate, modulesNeeded: 0 };
        const inpW = WARES_DB[inpId];
        if (inpW && inpW.level > 0) {
          activeDemand[inpId].modulesNeeded = Math.ceil(inpRate / getWareHourlyRatePerModule(inpId, state.workforceBonus));
        }
        sQueue.push({ id: inpId, requiredRate: inpRate });
      });
    }
  } else if (ware.level === 0) {
    let rawRateNeeded = (state.calculatedDemand[id] && state.calculatedDemand[id].rateNeeded > 0) ? state.calculatedDemand[id].rateNeeded : (ware.baseRate || 1);
    if (id === 'RawScrap') {
      const scrapRaw = state.scrapRawDemand || calculateScrapMetalRawScrapDemand();
      if (scrapRaw && scrapRaw.convertedPerHr > 0) {
        rawRateNeeded = scrapRaw.convertedPerHr;
      }
    } else if (id === 'EC' || id === 'TerEC') {
      const isTer = id === 'TerEC';
      const baseOutput = ware.baseRate || (isTer ? 3000 : 10500);
      const moduleMaxBonus = isTer ? 0.0 : 0.43;
      const activeSector = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
      const sunlightVal = activeSector ? getSectorSunlight(activeSector) : 100;
      rawRateNeeded = calculateSolarOutput(sunlightVal, state.workforceBonus, effectiveCount, baseOutput, moduleMaxBonus, ware.cyclesPerHr || 60);
    }
    activeDemand[id] = { rateNeeded: rawRateNeeded, modulesNeeded: effectiveCount };
  }

  while (sQueue.length > 0) {
    const { id: currId, requiredRate } = sQueue.shift();
    const currWare = WARES_DB[currId];
    if (currWare && currWare.recipe && currWare.level > 0) {
      const currModRate = (currId === 'ScrapHullParts' || currId === 'ScrapClaytronics')
        ? calculateLiveOutputRate(currId, 1, 0)
        : getWareHourlyRatePerModule(currId, state.workforceBonus);
      Object.entries(currWare.recipe).forEach(([inpId, inpQty]) => {
        if (NO_PP_WARES.has(currId) && inpId === 'EC') {
          return;
        }
        const ratePerUnit = inpQty / currModRate;
        let totalInputRateNeeded = requiredRate * ratePerUnit;
        if ((currId === 'ScrapMetal' || currId === 'TerScrapMetal') && inpId === 'EC') {
          totalInputRateNeeded = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : totalInputRateNeeded;
        }
        if (currId === 'ScrapProc' && inpId === 'EC') {
          totalInputRateNeeded = state.scrapMetalEc ? state.scrapMetalEc.processorEc : totalInputRateNeeded;
        }
        if (currId === 'ScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          totalInputRateNeeded = state.scrapRawDemand ? state.scrapRawDemand.genRawScrapDemand : totalInputRateNeeded;
        }
        if (currId === 'TerScrapMetal' && (inpId === 'RawScrap' || inpId === 'ScrapProc')) {
          totalInputRateNeeded = state.scrapRawDemand ? state.scrapRawDemand.terRawScrapDemand : totalInputRateNeeded;
        }
        if (currId === 'ScrapProc' && inpId === 'RawScrap') {
          totalInputRateNeeded = state.scrapRawDemand ? state.scrapRawDemand.totalRawScrapDemand : totalInputRateNeeded;
        }

        if (!activeDemand[inpId]) {
          activeDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
        }
        activeDemand[inpId].rateNeeded += totalInputRateNeeded;

        const inputWare = WARES_DB[inpId];
        if (inputWare && inputWare.level > 0) {
          activeDemand[inpId].modulesNeeded = Math.ceil(activeDemand[inpId].rateNeeded / getWareHourlyRatePerModule(inpId, state.workforceBonus));
        }
        sQueue.push({ id: inpId, requiredRate: totalInputRateNeeded });
      });
    }
  }

  const rawList = [
    { name: 'Ore', rate: activeDemand['Ore'] ? activeDemand['Ore'].rateNeeded : 0 },
    { name: 'Silicon', rate: activeDemand['Silicon'] ? activeDemand['Silicon'].rateNeeded : 0 },
    { name: 'Methane', rate: activeDemand['Methane'] ? activeDemand['Methane'].rateNeeded : 0 },
    { name: 'Hydrogen', rate: activeDemand['Hydrogen'] ? activeDemand['Hydrogen'].rateNeeded : 0 },
    { name: 'Helium', rate: activeDemand['Helium'] ? activeDemand['Helium'].rateNeeded : 0 },
    { name: 'Ice', rate: activeDemand['Ice'] ? activeDemand['Ice'].rateNeeded : 0, color: '#38bdf8' },
    { name: 'Raw Scrap Fragments', rate: activeDemand['RawScrap'] ? activeDemand['RawScrap'].rateNeeded : 0, color: '#34d399' },
    { name: 'Raw Kha\'ak Salvage', rate: activeDemand['RawKhaakScrap'] ? activeDemand['RawKhaakScrap'].rateNeeded : 0, color: '#c084fc' },
    { name: 'Protectyon (Condensate)', rate: activeDemand['Protectyon'] ? activeDemand['Protectyon'].rateNeeded : 0, color: '#f472b6' }
  ];

  const activeRawList = rawList.filter(item => item.rate > 0);
  const totalRaw = activeRawList.reduce((sum, item) => sum + item.rate, 0);
  const ecTotal = activeDemand['EC'] ? activeDemand['EC'].rateNeeded : 0;

  const upstreamEntries = Object.keys(activeDemand)
    .filter(uId => {
      const uWare = WARES_DB[uId];
      if (!uWare || uId === id || !activeDemand[uId] || activeDemand[uId].rateNeeded <= 0) return false;
      return uWare.level > 0 && uWare.level <= ware.level;
    })
    .sort((uA, uB) => {
      const wareA = WARES_DB[uA];
      const wareB = WARES_DB[uB];
      const calcA = activeDemand[uA];
      const calcB = activeDemand[uB];
      const dbOrder = Object.keys(WARES_DB);

      if (state.bpSortField === 'needed') {
        const neededA = calcA ? calcA.modulesNeeded || 0 : 0;
        const neededB = calcB ? calcB.modulesNeeded || 0 : 0;
        if (neededA !== neededB) {
          return state.bpSortAsc ? neededA - neededB : neededB - neededA;
        }
        return wareA.level !== wareB.level ? wareA.level - wareB.level : (dbOrder.indexOf(uA) - dbOrder.indexOf(uB));
      } else if (state.bpSortField === 'component') {
        const compComp = wareA.name.localeCompare(wareB.name);
        return state.bpSortAsc ? compComp : -compComp;
      } else {
        // Default: Sort by level (L1 -> L2 -> L3 -> L4), then by card display order in matrix
        if (wareA.level !== wareB.level) {
          return state.bpSortAsc ? wareA.level - wareB.level : wareB.level - wareA.level;
        }
        const orderDiff = dbOrder.indexOf(uA) - dbOrder.indexOf(uB);
        return state.bpSortAsc ? orderDiff : -orderDiff;
      }
    });

  const isLevel4Target = ware.level === 4;

  const upstreamRows = upstreamEntries.map(uId => {
    const uWare = WARES_DB[uId];
    const uCalc = activeDemand[uId];
    const curInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[uId]) || 0;
    const optimumRate = uCalc.rateNeeded;
    const currentRate = calculateLiveOutputRate(uId, curInPlan, optimumRate);

    if (isLevel4Target) {
      return `
        <tr>
          <td><strong>${uWare.name}</strong> (L${uWare.level})</td>
          <td style="text-align:right; font-weight:700; color:#34d399; font-size:0.82rem;">${Math.round(uCalc.rateNeeded).toLocaleString()} units</td>
        </tr>
      `;
    }

    let uRateDisplay = '&mdash;';
    const planColor = curInPlan > 0 ? '#38bdf8' : '#64748b';
    if (uWare.level >= 1 && uWare.level <= 3) {
      uRateDisplay = `
        <div style="font-size:0.75rem; line-height:1.35;">
          ${!state.inspectorSingle && state.activeBlueprint ? `<div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${planColor};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>` : ''}
          <div><span style="color:#94a3b8; font-size:0.68rem;">${state.inspectorSingle ? 'Required:' : 'Optimum:'}</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
        </div>
      `;
    }

    const neededStr = `${uCalc.modulesNeeded}x`;
    let planNeededDisplay = `<strong style="color:#34d399;">${neededStr}</strong>`;
    if (!state.inspectorSingle && state.activeBlueprint) {
      planNeededDisplay = `<span style="color:${planColor}; font-weight:600;">${curInPlan}x</span> <span style="color:#94a3b8;">/</span> <strong style="color:#34d399;">${neededStr}</strong>`;
    }

    return `
      <tr>
        <td><strong>${uWare.name}</strong> (L${uWare.level})</td>
        <td class="highlight-val">${planNeededDisplay}</td>
        <td>${uRateDisplay}</td>
      </tr>
    `;
  });

  // Compute Output Consumers for the selected ware (downstream (Level+1)–L3 components that require this ware in their recipe)
  const minConsumerLevel = (ware.level !== undefined ? ware.level : 0) + 1;
  const consumers = [];
  let totalBpConsumption = 0;
  let totalOptimumConsumption = 0;

  const ppDownstreamWares = getPPDownstreamWares();
  const isPPCheckedForInspector = (ware.level >= 1 && ware.level <= 3 && !NO_PP_WARES.has(id)) && Boolean(
    (state.activeBlueprint && state.activeBlueprint.ppStates && state.activeBlueprint.ppStates[id]) ||
    (!state.activeBlueprint && state.ppStates && state.ppStates[id])
  );
  const isInspectorOutputSuppressed = isPPCheckedForInspector || ppDownstreamWares.has(id);

  Object.entries(WARES_DB).forEach(([cId, cWare]) => {
    const isDirectRecipeInput = cWare.recipe && (
      (cWare.recipe[id] !== undefined && cWare.recipe[id] > 0) ||
      (id === 'TerEC' && cWare.recipe['EC'] !== undefined && cWare.recipe['EC'] > 0)
    );
    const isTelPartsAlternative = (id === 'TelParts') && cWare.recipe && cWare.recipe['HullParts'] !== undefined && cWare.recipe['HullParts'] > 0;
    const isScrapPartsAlternative = (id === 'ScrapHullParts') && cWare.recipe && cWare.recipe['HullParts'] !== undefined && cWare.recipe['HullParts'] > 0;
    const isScrapClaytronicsAlternative = (id === 'ScrapClaytronics') && cWare.recipe && cWare.recipe['Claytronics'] !== undefined && cWare.recipe['Claytronics'] > 0;
    const isTelArrayAlternative = (id === 'TelArray') && cWare.recipe && cWare.recipe['ScanArray'] !== undefined && cWare.recipe['ScanArray'] > 0;
    const isTelEngPartsAlternative = (id === 'TelEngParts') && cWare.recipe && cWare.recipe['EngParts'] !== undefined && cWare.recipe['EngParts'] > 0;
    const isTelAdvCompAlternative = (id === 'TelAdvComp') && cWare.recipe && cWare.recipe['AdvComp'] !== undefined && cWare.recipe['AdvComp'] > 0;

    if (cId !== id && cWare.level >= ((id === 'ScrapMetal' || id === 'TerScrapMetal' || id === 'ScrapProc') ? 1 : minConsumerLevel) && cWare.level <= 3 && (isDirectRecipeInput || isTelPartsAlternative || isScrapPartsAlternative || isScrapClaytronicsAlternative || isTelArrayAlternative || isTelEngPartsAlternative || isTelAdvCompAlternative)) {
      if ((id === 'EC' || id === 'TerEC') && NO_PP_WARES.has(cId)) {
        return;
      }
      if ((id === 'EC' || id === 'TerEC') && cId === 'TerScrapMetal' && state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapMetal']) {
        return;
      }

      const baseInputQty = isDirectRecipeInput 
        ? (id === 'TerEC' ? cWare.recipe['EC'] : cWare.recipe[id])
        : ((isTelPartsAlternative || isScrapPartsAlternative) ? cWare.recipe['HullParts'] : (isScrapClaytronicsAlternative ? cWare.recipe['Claytronics'] : (isTelArrayAlternative ? cWare.recipe['ScanArray'] : (isTelEngPartsAlternative ? cWare.recipe['EngParts'] : cWare.recipe['AdvComp']))));
      let inputPerMod = baseInputQty;
      let cInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[cId]) || 0;
      let cCalc = state.calculatedDemand[cId] ? (state.calculatedDemand[cId].modulesNeeded || 0) : 0;

      const smInPlan = (state.activeBlueprint && state.activeBlueprint.modules && ((state.activeBlueprint.modules['ScrapMetal'] || 0) + (state.activeBlueprint.modules['TerScrapMetal'] || 0) + (state.activeBlueprint.modules['ScrapProc'] || 0))) || 0;
      const smCalc = state.calculatedDemand && (state.calculatedDemand['ScrapMetal'] || state.calculatedDemand['TerScrapMetal'] || state.calculatedDemand['ScrapProc']);
      const smOutputNonZero = smInPlan > 0 || (smCalc && (smCalc.rateNeeded > 0 || smCalc.modulesNeeded > 0)) || (state.selectedWareId === 'ScrapMetal' || state.selectedWareId === 'TerScrapMetal' || state.selectedWareId === 'ScrapProc' || state.selectedWareId === 'RawScrap');

      if (cId === 'ScrapClaytronics' && smOutputNonZero && !state.activeBlueprint) {
        cCalc = Math.max(cCalc, 1);
      }

      let bpConsumption = cInPlan * inputPerMod;
      let optConsumption = cCalc * inputPerMod;

      if ((id === 'EC' || id === 'TerEC') && (cId === 'ScrapMetal' || cId === 'TerScrapMetal') && state.scrapMetalEc && state.scrapMetalEc.totalDemand > 0) {
        inputPerMod = state.scrapMetalEc.totalDemand;
        bpConsumption = state.scrapMetalEc.totalDemand;
        optConsumption = state.scrapMetalEc.totalDemand;
      }

      if (id === 'RawScrap' && cId === 'ScrapProc') {
        inputPerMod = 9000;
        bpConsumption = (cInPlan > 0 ? cInPlan : 1) * 9000;
        optConsumption = 9000;
      }

      if (id === 'ScrapProc') {
        if (cId === 'ScrapMetal' && state.scrapRawDemand) {
          inputPerMod = state.scrapRawDemand.genRecyclers > 0 ? Math.round(state.scrapRawDemand.genRawScrapDemand / state.scrapRawDemand.genRecyclers) : 2250;
          bpConsumption = state.scrapRawDemand.genRawScrapDemand;
          optConsumption = state.scrapRawDemand.genRawScrapDemand;
        } else if (cId === 'TerScrapMetal' && state.scrapRawDemand) {
          inputPerMod = state.scrapRawDemand.terRecyclers > 0 ? Math.round(state.scrapRawDemand.terRawScrapDemand / state.scrapRawDemand.terRecyclers) : 7500;
          bpConsumption = state.scrapRawDemand.terRawScrapDemand;
          optConsumption = state.scrapRawDemand.terRawScrapDemand;
        }
      }

      const isConsumerSuppressed = isInspectorOutputSuppressed || ppDownstreamWares.has(cId) || (
        (cWare.level >= 1 && cWare.level <= 3 && !NO_PP_WARES.has(cId)) && Boolean(
          (state.activeBlueprint && state.activeBlueprint.ppStates && state.activeBlueprint.ppStates[cId]) ||
          (!state.activeBlueprint && state.ppStates && state.ppStates[cId])
        )
      );

      if (isConsumerSuppressed) {
        bpConsumption = 0;
        optConsumption = 0;
      }

      totalBpConsumption += bpConsumption;
      totalOptimumConsumption += optConsumption;

      consumers.push({
        id: cId,
        ware: cWare,
        inputPerMod,
        inPlan: cInPlan,
        calcNeeded: cCalc,
        bpConsumption,
        optConsumption
      });
    }
  });

  // Sort consumers: active in blueprint first, then by level, then alphabetically
  consumers.sort((a, b) => {
    if (state.activeBlueprint) {
      if ((a.inPlan > 0) !== (b.inPlan > 0)) {
        return a.inPlan > 0 ? -1 : 1;
      }
    }
    if (a.ware.level !== b.ware.level) return a.ware.level - b.ware.level;
    return a.ware.name.localeCompare(b.ware.name);
  });

  const isGenEC = id === 'EC';
  const isTerEC = id === 'TerEC';
  const isEC = isGenEC || isTerEC;
  const lt = state.layerTotals || {};
  const ecPerMod = isTerEC 
    ? (lt.terSolarOutputPerPanel || (WARES_DB['TerEC'] ? WARES_DB['TerEC'].baseRate : 3000)) 
    : (lt.solarOutputPerPanel || (WARES_DB['EC'] ? WARES_DB['EC'].baseRate : 10500));
  const ecNeeded = isTerEC ? (lt.terSolarModulesNeeded || 0) : (lt.solarModulesNeeded || 0);
  let currentProd = isEC 
    ? (state.activeBlueprint ? (inPlanCount * ecPerMod) : (ecNeeded * ecPerMod))
    : (id === 'ScrapProc'
      ? (inPlanCount * 9000)
      : (id === 'ScrapHullParts' || id === 'ScrapClaytronics'
        ? calculateLiveOutputRate(id, inPlanCount, 0)
        : (inPlanCount * getWareHourlyRatePerModule(id, state.workforceBonus))));
  if (isInspectorOutputSuppressed) {
    currentProd = 0;
  }

  const netBpBalance = currentProd - totalBpConsumption;

  const nextLvl = (ware.level !== undefined ? ware.level : 0) + 1;
  let rangeTag = '';
  if (id === 'ScrapMetal' || id === 'TerScrapMetal' || id === 'ScrapProc') {
    rangeTag = '(L1–L3)';
  } else if (ware.level >= 3) {
    rangeTag = '(No output consumers)';
  } else if (nextLvl === 1) {
    rangeTag = '(L1–L3)';
  } else if (nextLvl === 2) {
    rangeTag = '(L2–L3)';
  } else if (nextLvl === 3) {
    rangeTag = '(L3)';
  }

  const consumersHtml = `
    <div class="consumers-box" style="background:rgba(15,23,42,0.75); padding:0.7rem 0.8rem; border-radius:8px; border:1px solid rgba(129,140,248,0.3); border-left:4px solid #818cf8;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem;">
        <h4 style="font-size:0.78rem; color:#a5b4fc; text-transform:uppercase; font-family:var(--font-heading); letter-spacing:0.03em; margin:0; display:flex; align-items:center; gap:6px;">
          <span>🏭 Output Consumers ${rangeTag}</span>
          ${consumers.length > 0 ? `<span style="font-size:0.7rem; color:#94a3b8; font-weight:normal; text-transform:none;">(${consumers.length} downstream wares)</span>` : ''}
        </h4>
        ${state.activeBlueprint ? `<span style="font-size:0.7rem; color:#38bdf8; font-weight:600; background:rgba(56,189,248,0.12); padding:0.1rem 0.4rem; border-radius:4px; border:1px solid rgba(56,189,248,0.3);">Blueprint Active</span>` : ''}
      </div>
      ${consumers.length > 0 ? `
        <div style="max-height:190px; overflow-y:auto; padding-right:4px; margin-bottom:0.45rem;">
          ${consumers.map(c => {
            const hasPlan = c.inPlan > 0;
            const rateVal = state.activeBlueprint ? c.bpConsumption : c.optConsumption;
            const planColor = (hasPlan && rateVal > 0) ? '#38bdf8' : '#64748b';
            const rateColor = rateVal > 0 ? '#34d399' : '#64748b';
            return `
              <div style="font-size:0.8rem; padding:0.25rem 0; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:#f8fafc;">${c.ware.name}</strong> 
                  <span style="font-size:0.68rem; color:#94a3b8;">(L${c.ware.level})</span>
                  <div style="font-size:0.68rem; color:#94a3b8;">
                    ${state.activeBlueprint 
                      ? `<span style="color:${planColor}; font-weight:600;">${c.inPlan}x in Plan</span> • ${c.inputPerMod.toLocaleString()} / hr each` 
                      : `<span style="color:#38bdf8; font-weight:600;">${c.calcNeeded > 0 ? `${c.calcNeeded}x Needs` : '0x'}</span> • ${c.inputPerMod.toLocaleString()} / hr each`}
                  </div>
                </div>
                <div style="text-align:right;">
                  <strong style="color:${rateColor}; font-size:0.82rem;">
                    ${Math.round(rateVal).toLocaleString()} / hr
                  </strong>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <hr style="border-color:rgba(255,255,255,0.08); margin:0.35rem 0;" />
        <div style="font-size:0.78rem; line-height:1.45;">
          ${state.activeBlueprint ? `
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#94a3b8;">Total Blueprint Consumption:</span>
              <strong style="color:#fbbf24;">${Math.round(totalBpConsumption).toLocaleString()} / hr</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#94a3b8;">${id === 'ScrapProc' ? 'Scrap Metal Converted' : 'Current Production'} (${inPlanCount}x):</span>
              <strong style="color:#38bdf8;">${Math.round(currentProd).toLocaleString()} / hr</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:0.15rem; padding-top:0.2rem; border-top:1px dashed rgba(255,255,255,0.1);">
              <span style="color:#cbd5e1; font-weight:600;">Net Balance:</span>
              <strong style="color:${netBpBalance >= 0 ? '#34d399' : '#f87171'}; font-weight:700;">
                ${netBpBalance >= 0 ? '+' : ''}${Math.round(netBpBalance).toLocaleString()} / hr ${netBpBalance >= 0 ? '(Surplus)' : '(Deficit)'}
              </strong>
            </div>
          ` : `
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#94a3b8;">Total Downstream Demand:</span>
              <strong style="color:#34d399;">${Math.round(totalOptimumConsumption).toLocaleString()} / hr</strong>
            </div>
          `}
        </div>
      ` : `
        <p style="color:#94a3b8; font-size:0.78rem; font-style:italic; margin:0;">No output consumers.</p>
      `}
    </div>
  `;

  insBody.innerHTML = `
    <div class="recipe-box" style="margin-top:0.6rem; background:rgba(30,41,59,0.6); padding:0.65rem 0.8rem; border-radius:8px; border:1px solid rgba(56,189,248,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <h4 style="font-size:0.78rem; color:#38bdf8; text-transform:uppercase; font-family:var(--font-heading); letter-spacing:0.03em; margin:0;">
          📋 Direct Recipe Inputs ${state.inspectorSingle ? '(1x Single Module)' : `(${effectiveCount}x Modules Total)`}
        </h4>
        <label style="font-size:0.75rem; color:#38bdf8; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; background:rgba(56,189,248,0.15); padding:0.15rem 0.5rem; border-radius:4px; border:1px solid rgba(56,189,248,0.35);" title="When checked, recalculates direct inputs and upstream totals for a single module">
          <input type="checkbox" id="chkInspectorSingle" ${state.inspectorSingle ? 'checked' : ''} style="cursor:pointer;" />
          Single
        </label>
      </div>
      ${(() => {
        if (!ware.recipe) return '<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">No input materials required (Raw / Solar).</div>';

        const linkedFromDeps = DEPENDENCIES.filter(d => d.to === id).map(d => d.from);
        const displayedInputs = [];
        const telPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelParts']) || 0;
        const scrapPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapHullParts']) || 0;
        const scrapClayPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapClaytronics']) || 0;
        const hullPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['HullParts']) || 0;
        const claytronicsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['Claytronics']) || 0;
        const telArrayPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelArray']) || 0;
        const scanArrayPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScanArray']) || 0;
        const telEngPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelEngParts']) || 0;
        const engPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['EngParts']) || 0;
        const telAdvCompPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelAdvComp']) || 0;
        const advCompPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['AdvComp']) || 0;

        const isSTM = Boolean(state.selectedWareId || !state.activeBlueprint);

        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (inpId === 'HullParts') {
            if (!isSTM && state.activeBlueprint) {
              const hasAlt = telPartsPlan > 0 || scrapPartsPlan > 0;
              if (telPartsPlan > 0 && hullPartsPlan === 0 && scrapPartsPlan === 0) {
                displayedInputs.push({ id: 'TelParts', qty: inpQty, tag: '[TEL Hull Parts]' });
              } else if (scrapPartsPlan > 0 && hullPartsPlan === 0 && telPartsPlan === 0) {
                displayedInputs.push({ id: 'ScrapHullParts', qty: inpQty, tag: '[Scrap Hull Parts]' });
              } else {
                displayedInputs.push({ id: 'HullParts', qty: inpQty, tag: hasAlt ? '[Commonwealth]' : '' });
                if (telPartsPlan > 0) {
                  displayedInputs.push({ id: 'TelParts', qty: inpQty, tag: '[TEL Hull Parts]' });
                }
                if (scrapPartsPlan > 0) {
                  displayedInputs.push({ id: 'ScrapHullParts', qty: inpQty, tag: '[Scrap Hull Parts]' });
                }
              }
            } else {
              displayedInputs.push({ id: 'HullParts', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'EngParts') {
            if (!isSTM && state.activeBlueprint) {
              if (telEngPartsPlan > 0 && engPartsPlan === 0) {
                displayedInputs.push({ id: 'TelEngParts', qty: inpQty, tag: '[TEL Engine Parts]' });
              } else if (telEngPartsPlan > 0 && engPartsPlan > 0) {
                displayedInputs.push({ id: 'EngParts', qty: inpQty, tag: '[Commonwealth]' });
                displayedInputs.push({ id: 'TelEngParts', qty: inpQty, tag: '[TEL Engine Parts]' });
              } else {
                displayedInputs.push({ id: 'EngParts', qty: inpQty, tag: '' });
              }
            } else {
              displayedInputs.push({ id: 'EngParts', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'AdvComp') {
            if (!isSTM && state.activeBlueprint) {
              if (telAdvCompPlan > 0 && advCompPlan === 0) {
                displayedInputs.push({ id: 'TelAdvComp', qty: inpQty, tag: '[TEL Adv Composites]' });
              } else if (telAdvCompPlan > 0 && advCompPlan > 0) {
                displayedInputs.push({ id: 'AdvComp', qty: inpQty, tag: '[Commonwealth]' });
                displayedInputs.push({ id: 'TelAdvComp', qty: inpQty, tag: '[TEL Adv Composites]' });
              } else {
                displayedInputs.push({ id: 'AdvComp', qty: inpQty, tag: '' });
              }
            } else {
              displayedInputs.push({ id: 'AdvComp', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'ScanArray') {
            if (!isSTM && state.activeBlueprint) {
              if (telArrayPlan > 0 && scanArrayPlan === 0) {
                displayedInputs.push({ id: 'TelArray', qty: inpQty, tag: '[TEL Scanning Arrays]' });
              } else if (telArrayPlan > 0 && scanArrayPlan > 0) {
                displayedInputs.push({ id: 'ScanArray', qty: inpQty, tag: '[Commonwealth]' });
                displayedInputs.push({ id: 'TelArray', qty: inpQty, tag: '[TEL Scanning Arrays]' });
              } else {
                displayedInputs.push({ id: 'ScanArray', qty: inpQty, tag: '' });
              }
            } else {
              displayedInputs.push({ id: 'ScanArray', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'Claytronics') {
            if (!isSTM && state.activeBlueprint) {
              const hasAlt = scrapClayPlan > 0;
              if (scrapClayPlan > 0 && claytronicsPlan === 0) {
                displayedInputs.push({ id: 'ScrapClaytronics', qty: inpQty, tag: '[Scrap Claytronics]' });
              } else {
                displayedInputs.push({ id: 'Claytronics', qty: inpQty, tag: hasAlt ? '[Commonwealth]' : '' });
                if (scrapClayPlan > 0) {
                  displayedInputs.push({ id: 'ScrapClaytronics', qty: inpQty, tag: '[Scrap Claytronics]' });
                }
              }
            } else {
              displayedInputs.push({ id: 'Claytronics', qty: inpQty, tag: '' });
            }
            return;
          }
          displayedInputs.push({ id: inpId, qty: inpQty, tag: '' });
        });

        const inputsToRender = isSTM
          ? displayedInputs.filter(item => {
              const d = state.calculatedDemand && state.calculatedDemand[item.id];
              const hasSupply = d ? ((d.rateNeeded && d.rateNeeded > 0) || (d.modulesNeeded && d.modulesNeeded > 0)) : (item.qty > 0);
              return hasSupply;
            })
          : displayedInputs;

        return inputsToRender.map(({ id: inpId, qty: inpQty, tag }) => {
          const inpWare = WARES_DB[inpId];
          const calcQty = state.inspectorSingle ? inpQty : (inpQty * effectiveCount);
          const unitSuffix = ware.level === 4 ? (inpId === 'EC' ? 'EC' : 'units') : '/ hr';
          const cycleQty = (ware.cyclesPerHr && ware.cyclesPerHr > 0 && ware.level < 4) ? (inpQty / ware.cyclesPerHr) : 0;
          const cycleStr = cycleQty > 0 ? `<span style="font-size:0.72rem; color:#94a3b8; font-weight:normal; margin-left:3px;">(${Math.round(cycleQty * 100) / 100} / cycle)</span>` : '';
          return `<div style="font-size:0.82rem; color:#f8fafc; padding:0.2rem 0; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center;"><span>${inpWare ? inpWare.name : inpId} ${tag ? `<span style="font-size:0.68rem; color:#38bdf8; background:rgba(56,189,248,0.12); padding:1px 4px; border-radius:3px; margin-left:3px;">${tag}</span>` : ''}:</span> <strong style="color:#34d399;">${Math.round(calcQty).toLocaleString()} ${unitSuffix}${cycleStr}</strong></div>`;
        }).join('');
      })()}
    </div>

    <div class="workforce-box" style="border-color:#38bdf8; margin-top:0.6rem;">
      <h4>⛏️ ${state.inspectorSingle ? 'Single Module' : 'Total'} Upstream Raw Mining & Liquids</h4>
      <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
      <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Demand:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
    </div>

    ${upstreamRows.length > 0 ? `
      <div style="margin-top:0.6rem;">
        <div class="section-label">${state.inspectorSingle ? 'Single Module' : 'Total'} Upstream Requirements (${upstreamRows.length} Wares)</div>
        <table class="summary-table">
          <thead>
            ${isLevel4Target ? `
              <tr>
                <th id="thUpSortComp" class="sortable" title="Click to sort by Level / Component Name">
                  Material (Level) ${state.bpSortField === 'level' ? (state.bpSortAsc ? '▲' : '▼') : (state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>')}
                </th>
                <th style="text-align:right;">Total Component Count</th>
              </tr>
            ` : `
              <tr>
                <th id="thUpSortComp" class="sortable" title="Click to sort by Level / Component Name">
                  Material (Level) ${state.bpSortField === 'level' ? (state.bpSortAsc ? '▲' : '▼') : (state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>')}
                </th>
                <th id="thUpSortNeeded" class="sortable" title="Click to sort by Needs Modules">
                  ${(!state.inspectorSingle && state.activeBlueprint) ? 'Plan / Needs' : 'Modules'} ${state.bpSortField === 'needed' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
                </th>
                <th>${(!state.inspectorSingle && state.activeBlueprint) ? 'Current / Optimum Rate' : 'Required Rate'}</th>
              </tr>
            `}
          </thead>
          <tbody>
            ${upstreamRows.join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div style="margin-top:0.6rem;">
      ${consumersHtml}
    </div>
  `;

  const chkInspectorSingle = document.getElementById('chkInspectorSingle');
  if (chkInspectorSingle) {
    chkInspectorSingle.addEventListener('change', (e) => {
      state.inspectorSingle = e.target.checked;
      updateInspector(id);
    });
  }

  const thUpSortComp = document.getElementById('thUpSortComp');
  if (thUpSortComp) {
    thUpSortComp.addEventListener('click', () => {
      if (state.bpSortField === 'level') {
        state.bpSortAsc = !state.bpSortAsc;
      } else {
        state.bpSortField = 'level';
        state.bpSortAsc = true;
      }
      updateInspector(id);
    });
  }

  const thUpSortNeeded = document.getElementById('thUpSortNeeded');
  if (thUpSortNeeded) {
    thUpSortNeeded.addEventListener('click', () => {
      if (state.bpSortField === 'needed') {
        state.bpSortAsc = !state.bpSortAsc;
      } else {
        state.bpSortField = 'needed';
        state.bpSortAsc = false;
      }
      updateInspector(id);
    });
  }

  if (prevInsScrollTop > 0) {
    insBody.scrollTop = prevInsScrollTop;
  }
}

let containerEl = null;
let unsubscribeStore = null;

/**
 * Initializes the Matrix View component and subscribes to state changes.
 * @param {HTMLElement} rootElement - Parent DOM container
 */
export function initMatrixView(rootElement) {
  containerEl = rootElement;

  if (unsubscribeStore) {
    unsubscribeStore();
  }

  // Subscribe to store updates
  unsubscribeStore = store.subscribe((currentState) => {
    if (containerEl && state.activeTab === 'matrix') {
      if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
        window.renderApp();
      } else {
        containerEl.innerHTML = renderMatrixTabHTML();
      }
    }
  });

  // Initial render
  if (containerEl) {
    if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
      window.renderApp();
    } else {
      containerEl.innerHTML = renderMatrixTabHTML();
    }
  }
}

/**
 * Cleans up DOM event listeners and store subscriptions upon tab switch.
 */
export function destroyMatrixView() {
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  containerEl = null;
}

