import { getFriendlyModuleName, mapMacroToWare, isFoodOrAgriMacro, getModuleBuildCost, MACRO_TO_WARE, WARES_DB } from '../data/wares.js';
import { state } from '../engine/state.js';

export function renderPlannedTabHTML() {
  const rawMacrosMap = state.activeBlueprint ? (state.activeBlueprint.rawMacros || {}) : {};
  const macroEntries = Object.entries(rawMacrosMap)
    .filter(([macro]) => !state.hideFoodAgriPlanned || !isFoodOrAgriMacro(macro))
    .sort(([macroA], [macroB]) => {
      const nameA = getFriendlyModuleName(macroA);
      const nameB = getFriendlyModuleName(macroB);
      return state.macroSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const knownMacrosList = Object.keys(MACRO_TO_WARE)
    .filter(macro => !state.hideFoodAgriPlanned || !isFoodOrAgriMacro(macro))
    .sort((a, b) => getFriendlyModuleName(a).localeCompare(getFriendlyModuleName(b)));

  // Summation Calculations
  let totalMacroModules = 0;
  let totalClaytronics = 0;
  let totalHullParts = 0;
  let totalECBuild = 0;
  let totalCompSubstrate = 0;
  let totalSilCarbide = 0;
  let totalMetMicrolatt = 0;
  let totalProtectyonBuild = 0;

  macroEntries.forEach(([macro, qty]) => {
    totalMacroModules += qty;
    const c = getModuleBuildCost(macro, qty, state.factionConstructionMethod);
    totalClaytronics += c.claytronics;
    totalHullParts += c.hullparts;
    totalECBuild += c.ec;
    totalCompSubstrate += c.compSubstrate;
    totalSilCarbide += c.silCarbide;
    totalMetMicrolatt += c.metMicrolatt;
    totalProtectyonBuild += c.protectyon;
  });

  return `
    <div class="planned-wrapper">
      <div class="planned-header-card">
        <div class="planned-title">
          <h2>📋 Planned and Changed Station Modules</h2>
          <p>Specify and adjust quantities for each station module. Calculates exact station construction resources required for building each module.</p>
        </div>

        <div class="add-macro-box">
          <label style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.35rem 0.65rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08);" title="When checked, hides agricultural & food supply production modules from table and dropdown">
            <input type="checkbox" id="chkHideFoodAgri" ${state.hideFoodAgriPlanned ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8; cursor:pointer;" />
            🌾 Exclude Food & Agri Modules
          </label>
          <label style="font-size:0.8rem; font-weight:700; color:#94a3b8; display:flex; align-items:center; gap:0.4rem;">
            Method:
            <select id="selectFactionMethod" class="select-preset" style="padding:0.35rem 0.6rem;">
              <option value="commonwealth" ${state.factionConstructionMethod === 'commonwealth' ? 'selected' : ''}>🏛️ Commonwealth</option>
              <option value="terran" ${state.factionConstructionMethod === 'terran' ? 'selected' : ''}>🪐 Terran Protectorate</option>
              <option value="boron" ${state.factionConstructionMethod === 'boron' ? 'selected' : ''}>🌊 Boron Kingdom</option>
            </select>
          </label>
          <select id="addMacroSelect" class="select-macro">
            <option value="">-- Select Station Module to Add --</option>
            ${knownMacrosList.map(macro => {
              const friendly = getFriendlyModuleName(macro);
              return `<option value="${macro}">${friendly} (${macro})</option>`;
            }).join('')}
          </select>
          <button class="btn-add-macro" id="btnAddMacro">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Module
          </button>
        </div>
      </div>

      <div class="macro-table-card">
        <div class="macro-table-container">
          <table class="macro-table">
            <thead>
              <tr>
                <th id="thSortMacro" style="cursor:pointer; user-select:none;" title="Click to sort alphabetically by Station Module Name">
                  Station Module Name ${state.macroSortAsc ? '▲' : '▼'}
                </th>
                <th>Mapped Ware / Purpose</th>
                <th>Quantity in Plan</th>
                <th>Construction Resources Needed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${macroEntries.length > 0 ? macroEntries.map(([macro, qty]) => {
                const wareId = mapMacroToWare(macro);
                const ware = wareId ? WARES_DB[wareId] : null;
                const friendlyName = getFriendlyModuleName(macro);

                // Single Unit Component Cost
                const singleCost = getModuleBuildCost(macro, 1, state.factionConstructionMethod);
                const singleParts = [];
                if (singleCost.claytronics > 0) singleParts.push(`<span style="color:#fbbf24; font-weight:700;">${singleCost.claytronics.toLocaleString()}</span> Claytronics`);
                if (singleCost.ec > 0) singleParts.push(`<span style="color:#cbd5e1; font-weight:700;">${singleCost.ec.toLocaleString()}</span> EC`);
                if (singleCost.hullparts > 0) singleParts.push(`<span style="color:#38bdf8; font-weight:700;">${singleCost.hullparts.toLocaleString()}</span> Hull Parts`);
                if (singleCost.compSubstrate > 0) singleParts.push(`<span style="color:#f472b6; font-weight:700;">${singleCost.compSubstrate.toLocaleString()}</span> Computronic Substrate`);
                if (singleCost.silCarbide > 0) singleParts.push(`<span style="color:#a7f3d0; font-weight:700;">${singleCost.silCarbide.toLocaleString()}</span> Silicon Carbide`);
                if (singleCost.metMicrolatt > 0) singleParts.push(`<span style="color:#94a3b8; font-weight:700;">${singleCost.metMicrolatt.toLocaleString()}</span> Metallic Microlattice`);
                if (singleCost.protectyon > 0) singleParts.push(`<span style="color:#f472b6; font-weight:700;">${singleCost.protectyon.toLocaleString()}</span> Protectyon`);
                if (singleCost.water > 0) singleParts.push(`<span style="color:#38bdf8; font-weight:700;">${singleCost.water.toLocaleString()}</span> Water`);
                const singleCostStr = singleParts.length > 0 ? singleParts.join(' • ') : '<span style="color:#94a3b8; font-style:italic;">Minimal Base Cost</span>';

                // Total Row Build Cost
                const totalCost = getModuleBuildCost(macro, qty, state.factionConstructionMethod);
                const totalParts = [];
                if (totalCost.claytronics > 0) totalParts.push(`<span style="color:#fbbf24; font-weight:700;">${totalCost.claytronics.toLocaleString()}</span> Claytronics`);
                if (totalCost.ec > 0) totalParts.push(`<span style="color:#cbd5e1; font-weight:700;">${totalCost.ec.toLocaleString()}</span> EC`);
                if (totalCost.hullparts > 0) totalParts.push(`<span style="color:#38bdf8; font-weight:700;">${totalCost.hullparts.toLocaleString()}</span> Hull Parts`);
                if (totalCost.compSubstrate > 0) totalParts.push(`<span style="color:#f472b6; font-weight:700;">${totalCost.compSubstrate.toLocaleString()}</span> Computronic Substrate`);
                if (totalCost.silCarbide > 0) totalParts.push(`<span style="color:#a7f3d0; font-weight:700;">${totalCost.silCarbide.toLocaleString()}</span> Silicon Carbide`);
                if (totalCost.metMicrolatt > 0) totalParts.push(`<span style="color:#94a3b8; font-weight:700;">${totalCost.metMicrolatt.toLocaleString()}</span> Metallic Microlattice`);
                if (totalCost.protectyon > 0) totalParts.push(`<span style="color:#f472b6; font-weight:700;">${totalCost.protectyon.toLocaleString()}</span> Protectyon`);
                if (totalCost.water > 0) totalParts.push(`<span style="color:#38bdf8; font-weight:700;">${totalCost.water.toLocaleString()}</span> Water`);
                const totalCostStr = totalParts.length > 0 ? totalParts.join(' • ') : '<span style="color:#94a3b8; font-style:italic;">Minimal Construction Cost</span>';

                return `
                  <tr>
                    <td>
                      <div style="font-weight:700; color:#f8fafc; font-size:0.9rem;">${friendlyName}</div>
                      <div style="margin-top:0.2rem;"><span class="macro-name-tag">${macro}</span></div>
                    </td>
                    <td>
                      ${ware ? `<div style="font-weight:600; color:#cbd5e1;">${ware.name} <span style="font-size:0.75rem; color:#94a3b8;">(Level ${ware.level} ${ware.cat})</span></div>` : '<div style="color:#94a3b8; font-style:italic;">Unmapped Structure</div>'}
                      <div style="margin-top:0.35rem; font-size:0.78rem; color:#94a3b8; background:rgba(255,255,255,0.03); padding:0.25rem 0.5rem; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                        <span style="font-weight:700; color:#38bdf8;">1x Module Cost:</span> ${singleCostStr}
                      </div>
                    </td>
                    <td>
                      <div class="macro-qty-box">
                        <button class="btn-qty btn-macro-dec" data-macro="${macro}">-</button>
                        <input type="number" class="macro-qty-input" data-macro="${macro}" min="0" value="${qty}" />
                        <button class="btn-qty btn-macro-inc" data-macro="${macro}">+</button>
                      </div>
                    </td>
                    <td>
                      <div style="font-weight:700; color:#f8fafc; font-size:0.88rem;">${totalCostStr}</div>
                      <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">Total for ${qty}x module${qty === 1 ? '' : 's'}</div>
                    </td>
                    <td>
                      <button class="btn-del-macro" data-macro="${macro}">Delete</button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem; font-style:italic;">
                    No macro modules present in the current plan. Select a macro module above to add it, or load a blueprint .XML file.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Total Construction Summary Panel -->
      <div class="summation-panel">
        <div class="summation-header">
          <span>🏗️ Total Summated Station Construction Materials</span>
          <span style="font-size:0.85rem; color:#f8fafc; background:rgba(56,189,248,0.2); padding:0.2rem 0.6rem; border-radius:6px;">
            ${totalMacroModules} Total Modules Planned
          </span>
        </div>

        <div class="summation-grid">
          <div class="summation-card">
            <h3>⚙️ Primary Commonwealth Construction Materials</h3>
            <div class="summation-item">
              <span>Total Claytronics:</span>
              <strong style="color:#fbbf24;">${totalClaytronics.toLocaleString()} units</strong>
            </div>
            <div class="summation-item">
              <span>Total Energy Cells (EC):</span>
              <strong style="color:#34d399;">${totalECBuild.toLocaleString()} units</strong>
            </div>
            <div class="summation-item">
              <span>Total Hull Parts:</span>
              <strong style="color:#38bdf8;">${totalHullParts.toLocaleString()} units</strong>
            </div>
          </div>

          ${(totalCompSubstrate > 0 || totalSilCarbide > 0 || totalMetMicrolatt > 0) ? `
            <div class="summation-card">
              <h3>🚀 Terran Protectorate Construction Materials</h3>
              <div class="summation-item">
                <span>Computronic Substrate:</span>
                <strong style="color:#f472b6;">${totalCompSubstrate.toLocaleString()} units</strong>
              </div>
              <div class="summation-item">
                <span>Silicon Carbide:</span>
                <strong style="color:#a7f3d0;">${totalSilCarbide.toLocaleString()} units</strong>
              </div>
              <div class="summation-item">
                <span>Metallic Microlattice:</span>
                <strong style="color:#94a3b8;">${totalMetMicrolatt.toLocaleString()} units</strong>
              </div>
            </div>
          ` : ''}

          ${totalProtectyonBuild > 0 ? `
            <div class="summation-card">
              <h3>✨ Special Condensate & Shielding</h3>
              <div class="summation-item">
                <span>Protectyon Condensate:</span>
                <strong style="color:#f472b6;">${totalProtectyonBuild.toLocaleString()} units</strong>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}
