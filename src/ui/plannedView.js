import { getFriendlyModuleName, mapMacroToWare, isFoodOrAgriMacro, isWareMacro, isStructureMacro, getModuleBuildCost, MACRO_TO_WARE, MODULE_NAMES, MODULE_BUILD_COSTS, WARES_DB } from '../data/wares.js';
import { state } from '../engine/state.js';
import { escapeHtml } from '../html.js';

export function getKnownMacrosList() {
  const allKnownMacros = Array.from(new Set([
    ...Object.keys(MODULE_NAMES || {}),
    ...Object.keys(MODULE_BUILD_COSTS || {}),
    ...Object.keys(MACRO_TO_WARE || {})
  ]));

  return allKnownMacros
    .filter(macro => {
      const lower = macro.toLowerCase();
      const friendly = getFriendlyModuleName(macro).toLowerCase();
      if (lower.includes('xen') || friendly.includes('xenon')) return false;
      if (state.hideFoodAgriPlanned && isFoodOrAgriMacro(macro)) return false;
      if (state.filterWaresPlanned && !isWareMacro(macro)) return false;
      if (state.filterStructuresPlanned && !isStructureMacro(macro)) return false;
      return true;
    })
    .sort((a, b) => getFriendlyModuleName(a).localeCompare(getFriendlyModuleName(b)));
}

export function matchesModuleQuery(macro, query) {
  if (!query) return true;
  const raw = query.trim().toLowerCase();
  if (!raw) return true;

  const isNegated = raw.startsWith('!');
  const q = isNegated ? raw.slice(1).trim() : raw;
  if (!q) return true;

  const friendly = getFriendlyModuleName(macro).toLowerCase();
  const macroLower = macro.toLowerCase();
  const wareId = mapMacroToWare(macro);
  const ware = wareId ? WARES_DB[wareId] : null;
  const wareName = ware ? ware.name.toLowerCase() : '';
  const wareCat = (ware && ware.cat) ? ware.cat.toLowerCase() : '';
  const purpose = ware ? `${wareName} level ${ware.level} ${wareCat}` : 'station structure utility';

  const contains = friendly.includes(q) ||
                   macroLower.includes(q) ||
                   wareName.includes(q) ||
                   wareCat.includes(q) ||
                   purpose.includes(q);

  return isNegated ? !contains : contains;
}

export function updateAddMacroSelect(query) {
  const select = document.getElementById('addMacroSelect');
  if (!select) return;

  const knownMacrosList = getKnownMacrosList();
  const currentVal = select.value;
  const filtered = query ? knownMacrosList.filter(macro => matchesModuleQuery(macro, query)) : knownMacrosList;

  let html = `<option value="">-- Select Station Module to Add ${query ? `(${filtered.length} found)` : ''} --</option>`;
  filtered.forEach(macro => {
    const friendly = getFriendlyModuleName(macro);
    const isSelected = (macro === currentVal) || (!currentVal && state.selectedWareId && mapMacroToWare(macro) === state.selectedWareId);
    html += `<option value="${escapeHtml(macro)}" ${isSelected ? 'selected' : ''}>${escapeHtml(friendly)} (${escapeHtml(macro)})</option>`;
  });

  if (query && filtered.length === 0) {
    html += `<option value="" disabled style="color:#94a3b8; font-style:italic;">No station modules match "${query}"</option>`;
  }

  select.innerHTML = html;
}

export function renderPlannedTabHTML() {
  const rawMacrosMap = state.activeBlueprint ? (state.activeBlueprint.rawMacros || {}) : {};
  const macroEntries = Object.entries(rawMacrosMap)
    .filter(([macro, qty]) => {
      if (qty <= 0) return false;
      if (state.hideFoodAgriPlanned && isFoodOrAgriMacro(macro)) return false;
      if (state.filterWaresPlanned && !isWareMacro(macro)) return false;
      if (state.filterStructuresPlanned && !isStructureMacro(macro)) return false;
      return true;
    })
    .sort(([macroA], [macroB]) => {
      const nameA = getFriendlyModuleName(macroA);
      const nameB = getFriendlyModuleName(macroB);
      return state.macroSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const knownMacrosList = getKnownMacrosList();
  const searchQuery = (state.searchQuery || '').trim().toLowerCase();
  const filteredMacrosList = searchQuery ? knownMacrosList.filter(m => matchesModuleQuery(m, searchQuery)) : knownMacrosList;

  // Summation Calculations
  let totalMacroModules = 0;
  let totalClaytronics = 0;
  let totalHullParts = 0;
  let totalECBuild = 0;
  let totalCompSubstrate = 0;
  let totalSilCarbide = 0;
  let totalMetMicrolatt = 0;
  let totalProtectyonBuild = 0;
  let totalWaterBuild = 0;

  macroEntries.forEach(([macro, qty]) => {
    totalMacroModules += qty;
    const c = getModuleBuildCost(macro, qty, state.factionConstructionMethod);
    totalClaytronics += c.claytronics || 0;
    totalHullParts += c.hullparts || 0;
    totalECBuild += c.ec || 0;
    totalCompSubstrate += c.compSubstrate || 0;
    totalSilCarbide += c.silCarbide || 0;
    totalMetMicrolatt += c.metMicrolatt || 0;
    totalProtectyonBuild += c.protectyon || 0;
    totalWaterBuild += c.water || 0;
  });

  const hasAnyVisible = !searchQuery || macroEntries.some(([macro]) => matchesModuleQuery(macro, searchQuery));

  return `
    <div class="planned-wrapper">
      <div class="planned-header-card">
        <div class="planned-title" style="flex:1; min-width:320px; display:flex; flex-direction:column; justify-content:space-between; gap:0.65rem;">
          <div style="display:flex; flex-direction:column; gap:0.45rem;">
            <h2>📋 Planned and Changed Modules</h2>
            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
              <label style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.35rem 0.65rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08);" title="When checked, hides agricultural & food supply production modules from table and dropdown">
                <input type="checkbox" id="chkHideFoodAgri" ${state.hideFoodAgriPlanned ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8; cursor:pointer;" />
                🌾 Exclude Food & Agri Modules
              </label>
              <label style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.35rem 0.65rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08);" title="When checked, lists only ware production modules">
                <input type="checkbox" id="chkFilterWares" ${state.filterWaresPlanned ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8; cursor:pointer;" />
                📦 Wares
              </label>
              <label style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.35rem 0.65rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08);" title="When checked, unchecks Wares checkbox and populates only station structures">
                <input type="checkbox" id="chkFilterStructures" ${state.filterStructuresPlanned ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8; cursor:pointer;" />
                🏗️ Structures
              </label>
            </div>
          </div>
          <p style="margin:0; font-size:0.82rem; color:#94a3b8;">Specify and adjust quantities for each station module.</p>
          <div class="add-macro-box" style="margin:0; display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
            <label style="font-size:0.82rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none; background:rgba(56,189,248,0.1); padding:0.35rem 0.65rem; border-radius:6px; border:1px solid rgba(56,189,248,0.25);" title="Once checked, signifies that the selected ware may have upstream providers. If the ware is L2 or L3, populates the display with those upstream wares and displays the number required to satisfy the upstream demands of each ware.">
              <input type="checkbox" id="chkPopulateMatrix" ${state.populateMatrix ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8; cursor:pointer;" />
              ⚡ Populate Needs
            </label>
            <label style="font-size:0.8rem; font-weight:700; color:#94a3b8; display:flex; align-items:center; gap:0.4rem;">
              Method:
              <select id="selectFactionMethod" class="select-preset" style="padding:0.35rem 0.6rem;">
                <option value="commonwealth" ${state.factionConstructionMethod === 'commonwealth' ? 'selected' : ''}>🏛️ Commonwealth</option>
                <option value="terran" ${state.factionConstructionMethod === 'terran' ? 'selected' : ''}>🪐 Terran Protectorate</option>
                <option value="boron" ${state.factionConstructionMethod === 'boron' ? 'selected' : ''}>🌊 Boron Kingdom</option>
              </select>
            </label>
            <select id="addMacroSelect" class="select-macro" style="padding:0.35rem 0.65rem;">
              <option value="">-- Select Station Module to Add ${searchQuery ? `(${filteredMacrosList.length} found)` : ''} --</option>
              ${filteredMacrosList.map(macro => {
                const friendly = getFriendlyModuleName(macro);
                const isSelected = (state.selectedWareId && mapMacroToWare(macro) === state.selectedWareId);
                return `<option value="${escapeHtml(macro)}" ${isSelected ? 'selected' : ''}>${escapeHtml(friendly)} (${escapeHtml(macro)})</option>`;
              }).join('')}
              ${(searchQuery && filteredMacrosList.length === 0) ? `
                <option value="" disabled style="color:#94a3b8; font-style:italic;">No station modules match "${escapeHtml(searchQuery)}"</option>
              ` : ''}
            </select>
            <button class="btn-add-macro" id="btnAddMacro" style="padding:0.35rem 0.75rem; white-space:nowrap;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Module
            </button>
          </div>
        </div>

        <!-- Total Summated Station Construction Materials Pill (occupies far right vertically as well as horizontal area) -->
        <div class="construction-summary-pill" title="Total Summated Station Construction Materials required for ${totalMacroModules} planned modules">
          <div class="construction-pill-header">
            <div class="construction-pill-title">
              <span>🏗️ Total Summated Station Construction Materials</span>
            </div>
            <div class="construction-pill-count">
              <span class="construction-pill-badge">${totalMacroModules} Module${totalMacroModules === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div class="construction-pill-grid">
            <div class="construction-pill-item">
              <span>Claytronics:</span>
              <strong style="color:#fbbf24;">${totalClaytronics.toLocaleString()}</strong>
            </div>
            <div class="construction-pill-item">
              <span>Hull Parts:</span>
              <strong style="color:#38bdf8;">${totalHullParts.toLocaleString()}</strong>
            </div>
            <div class="construction-pill-item">
              <span>EC:</span>
              <strong style="color:#34d399;">${totalECBuild.toLocaleString()}</strong>
            </div>
            ${(totalCompSubstrate > 0 || state.factionConstructionMethod === 'terran') ? `
            <div class="construction-pill-item">
              <span>Comp Sub:</span>
              <strong style="color:#f472b6;">${totalCompSubstrate.toLocaleString()}</strong>
            </div>` : ''}
            ${(totalSilCarbide > 0 || state.factionConstructionMethod === 'terran') ? `
            <div class="construction-pill-item">
              <span>Sil Carbide:</span>
              <strong style="color:#a7f3d0;">${totalSilCarbide.toLocaleString()}</strong>
            </div>` : ''}
            ${(totalMetMicrolatt > 0 || state.factionConstructionMethod === 'terran') ? `
            <div class="construction-pill-item">
              <span>Met Micro:</span>
              <strong style="color:#94a3b8;">${totalMetMicrolatt.toLocaleString()}</strong>
            </div>` : ''}
            ${totalProtectyonBuild > 0 ? `
            <div class="construction-pill-item">
              <span>Protectyon:</span>
              <strong style="color:#f472b6;">${totalProtectyonBuild.toLocaleString()}</strong>
            </div>` : ''}
            ${(totalWaterBuild > 0 || state.factionConstructionMethod === 'boron') ? `
            <div class="construction-pill-item">
              <span>Water:</span>
              <strong style="color:#38bdf8;">${totalWaterBuild.toLocaleString()}</strong>
            </div>` : ''}
          </div>
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

                const origQty = (state.originalBlueprint && state.originalBlueprint.rawMacros && state.originalBlueprint.rawMacros[macro]) || 0;
                const isChanged = qty !== origQty;
                const wareCat = (ware && ware.cat) ? ware.cat : '';
                const purpose = ware ? `${ware.name} (Level ${ware.level} ${ware.cat})` : 'Station Structure / Utility';
                const matchesSearch = matchesModuleQuery(macro, searchQuery);

                return `
                  <tr class="macro-row" data-macro="${escapeHtml(macro.toLowerCase())}" data-friendly="${escapeHtml(friendlyName.toLowerCase())}" data-ware="${escapeHtml((ware ? ware.name : '').toLowerCase())}" data-cat="${escapeHtml(wareCat.toLowerCase())}" data-purpose="${escapeHtml(purpose.toLowerCase())}" style="${matchesSearch ? '' : 'display:none;'}">
                    <td>
                      <div style="font-weight:700; font-size:0.9rem; display:flex; align-items:center; gap:6px;">
                        <span style="color:${isChanged ? '#34d399' : '#f8fafc'};" title="${escapeHtml(isChanged ? (origQty === 0 ? 'Added module (original: 0)' : `Modified quantity (original: ${origQty}x)`) : '')}">${escapeHtml(friendlyName)}</span>
                      </div>
                      <div style="margin-top:0.2rem;"><span class="macro-name-tag">${escapeHtml(macro)}</span></div>
                    </td>
                    <td>
                      ${ware ? `<div style="font-weight:600; color:#cbd5e1;">${ware.name} <span style="font-size:0.75rem; color:#94a3b8;">(Level ${ware.level} ${ware.cat})</span></div>` : '<div style="color:#38bdf8; font-weight:600; font-size:0.85rem;">Station Structure / Utility</div>'}
                      <div style="margin-top:0.35rem; font-size:0.78rem; color:#94a3b8; background:rgba(255,255,255,0.03); padding:0.25rem 0.5rem; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                        <span style="font-weight:700; color:#38bdf8;">1x Module Cost:</span> ${singleCostStr}
                      </div>
                    </td>
                    <td>
                      <div class="macro-qty-box">
                        <button class="btn-qty btn-macro-dec" data-macro="${escapeHtml(macro)}">-</button>
                        <input type="number" class="macro-qty-input" data-macro="${escapeHtml(macro)}" min="0" value="${qty}" />
                        <button class="btn-qty btn-macro-inc" data-macro="${escapeHtml(macro)}">+</button>
                      </div>
                    </td>
                    <td>
                      <div style="font-weight:700; color:#f8fafc; font-size:0.88rem;">${totalCostStr}</div>
                      <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">Total for ${qty}x module${qty === 1 ? '' : 's'}</div>
                    </td>
                    <td>
                      <button class="btn-del-macro" data-macro="${escapeHtml(macro)}">Delete</button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="5" id="emptyPlanCell" style="text-align:center; color:#94a3b8; padding:2rem; font-style:italic;">
                    ${searchQuery ? `No macro modules in current plan. Check the filtered "Select Station Module to Add" dropdown above to add matching modules.` : `No macro modules present in the current plan. Select a macro module above to add it, or load a blueprint .XML file.`}
                  </td>
                </tr>
              `}
              <tr id="noSearchMatchRow" style="${(!hasAnyVisible && macroEntries.length > 0) ? '' : 'display:none;'}">
                <td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem; font-style:italic;">
                  No planned modules match the search query.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function filterPlannedModules() {
  const rawQuery = (state.searchQuery || '').trim().toLowerCase();
  const isNegated = rawQuery.startsWith('!');
  const query = isNegated ? rawQuery.slice(1).trim() : rawQuery;

  const rows = document.querySelectorAll('.macro-table tbody tr.macro-row');
  let visibleCount = 0;
  rows.forEach(row => {
    const macro = row.dataset.macro || '';
    const commonName = (row.dataset.friendly || '').toLowerCase();
    const macroName = macro.toLowerCase();
    const wareName = (row.dataset.ware || '').toLowerCase();
    const catName = (row.dataset.cat || '').toLowerCase();
    const purpose = (row.dataset.purpose || '').toLowerCase();
    const rowText = row.textContent.toLowerCase();

    let matches = true;
    if (query) {
      const contains = (matchesModuleQuery(macro, query) === true) ||
        commonName.includes(query) ||
        macroName.includes(query) ||
        wareName.includes(query) ||
        catName.includes(query) ||
        purpose.includes(query) ||
        rowText.includes(query);
      matches = isNegated ? !contains : contains;
    }

    row.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });

  const noMatchRow = document.getElementById('noSearchMatchRow');
  if (noMatchRow) {
    noMatchRow.style.display = (visibleCount === 0 && rows.length > 0 && query) ? '' : 'none';
  }

  const emptyPlanCell = document.getElementById('emptyPlanCell');
  if (emptyPlanCell) {
    emptyPlanCell.textContent = query
      ? `No macro modules in current plan. Check the filtered "Select Station Module to Add" dropdown above to add matching modules.`
      : `No macro modules present in the current plan. Select a macro module above to add it, or load a blueprint .XML file.`;
  }

  updateAddMacroSelect(rawQuery);
}
