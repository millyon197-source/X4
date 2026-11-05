// The four (or five) layer-totals cards above the matrix grid, extracted from renderMatrixTabHTML (Stage 4, step 12a).
// Only reads the state object it is given and returns markup.
import { WARES_DB, isBlueprintTerran, isTerranFaction } from '../../data/wares.js';
import { SECTORS_SUNLIGHT } from '../../data/sectors.js';

export function renderLayerTotalsBanner(state, { lt, colClass, isSectorSelected, activeSectorName, rawSectorName }) {
  return `<div class="layer-totals-banner ${colClass}">
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
                const isTerran = state.activeBlueprint && (isBlueprintTerran(state.activeBlueprint) || isTerranFaction(state.factionConstructionMethod));
                let reqHtml = '';
                if (state.activeBlueprint && (terLoaded && !genLoaded || (!terLoaded && !genLoaded && isTerran))) {
                  reqHtml = `Requires <strong style="color:#38bdf8;">${lt.terSolarModulesNeeded}x TER</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.terSolarOutputPerPanel || terEcFallback).toLocaleString()}/mod)</span>`;
                } else if (state.activeBlueprint && !terLoaded) {
                  reqHtml = `Requires <strong style="color:#34d399;">${lt.solarModulesNeeded}x</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.solarOutputPerPanel || ecFallback).toLocaleString()}/mod)</span>`;
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
        </div>`;
}
