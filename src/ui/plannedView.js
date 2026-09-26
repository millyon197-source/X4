import { getFriendlyModuleName, mapMacroToWare, isFoodOrAgriMacro, isWareMacro, isStructureMacro, getModuleBuildCost, MACRO_TO_WARE, MODULE_NAMES, MODULE_BUILD_COSTS, WARES_DB } from '../data/wares.js';
import MODULES_WORKFORCE from '../data/modules_workforce.json' with { type: 'json' };
import { calculateBlueprintWorkforce } from '../engine/calculator.js';
import { readAndParseBlueprintFile } from '../engine/xmlParser.js';
import { calculateBuildCosts } from '../engine/buildCost.js';
import { getWareUnitPrice, WARE_PRICES } from '../engine/prices.js';
import { state, store } from '../state/store.js';
import { escapeHtml } from '../html.js';

export function getKnownMacrosList() {
  const allKnownMacros = Array.from(new Set([
    ...Object.keys(MODULE_NAMES || {}),
    ...Object.keys(MODULE_BUILD_COSTS || {}),
    ...Object.keys(MACRO_TO_WARE || {})
  ]));

  return allKnownMacros
    .filter(macro => {
      if (macro === 'prod_ter_scraprecycler_macro') return false;
      if (macro === 'hab_arg_antigonepillar_01_macro' || macro === 'hab_arg_antigonespire_01_macro') return false;
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
  const isHab = macroLower.startsWith('hab_') || macroLower.includes('housing') || (MODULES_WORKFORCE && MODULES_WORKFORCE[macro]?.capacity > 0);
  const purpose = ware ? `${wareName} level ${ware.level} ${wareCat}` : (isHab ? 'station habitat habitation workforce housing structure utility' : 'station structure utility');

  const combinedText = `${friendly} ${macroLower} ${wareName} ${wareCat} ${purpose}`;
  const queryWords = q.split(/\s+/).filter(Boolean);
  const allWordsMatch = queryWords.length > 1 && queryWords.every(w => combinedText.includes(w));

  const contains = friendly.includes(q) ||
                   macroLower.includes(q) ||
                   wareName.includes(q) ||
                   wareCat.includes(q) ||
                   purpose.includes(q) ||
                   allWordsMatch;

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
    let friendly = getFriendlyModuleName(macro, state.factionConstructionMethod);
    if (macro === 'prod_ter_scrap_recycler_macro' || macro === 'prod_ter_scraprecycler_macro') {
      friendly = 'Scrap Recycler (TER)';
    } else if (state.factionConstructionMethod !== 'terran') {
      if (macro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
    }
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

  const effectiveModules = (state.modules && Object.keys(state.modules).length > 0)
    ? state.modules
    : rawMacrosMap;
  const currentPriceType = state.priceType || 'avg';
  const method = state.constructionMethod || state.factionConstructionMethod || 'commonwealth';
  const buildResult = calculateBuildCosts(effectiveModules, method, currentPriceType);

  const hasAnyVisible = !searchQuery || macroEntries.some(([macro]) => matchesModuleQuery(macro, searchQuery));
  const wf = calculateBlueprintWorkforce(state.activeBlueprint);
  const hasWorkforce = wf && (wf.totalOptimalWorkforce > 0 || wf.totalHabitationCapacity > 0);

  return `
    <div class="planned-wrapper">
      <div class="planned-header-card">
        <div class="planned-header-top" style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; gap:1.25rem; flex-wrap:wrap;">
          <div class="planned-title" style="flex:1; min-width:280px;">
            <h2>📋 Planned and Changed Modules</h2>
            <p style="margin:0.2rem 0 0 0; font-size:0.8rem; color:#94a3b8;">Specify and adjust quantities for each station module.</p>
          </div>

          <div class="planned-pills-container">
          <!-- Total Summated Station Construction Materials Pill -->
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
              <div class="construction-pill-item" style="grid-column: span 2; border-top: 1px solid rgba(56,189,248,0.25); padding-top: 0.25rem; margin-top: 0.15rem; display:flex; justify-content:space-between; align-items:center;">
                <span>Est. Station Cost (${currentPriceType.toUpperCase()}):</span>
                <strong style="color:#34d399; font-size:0.82rem;">${buildResult.totals.totalCredits.toLocaleString()} Cr</strong>
              </div>
            </div>
          </div>

          <!-- Station Workforce Summary Pill -->
          <div class="construction-summary-pill" style="border-color: rgba(16, 185, 129, 0.4);" title="Station Workforce Summary based on planned modules">
            <div class="construction-pill-header">
              <div class="construction-pill-title" style="color:#34d399; justify-content:space-between; width:100%;">
                <span>👥 Station Workforce Summary</span>
                <span class="construction-pill-badge" style="background:${wf.coveragePercent >= 100 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}; color:${wf.coveragePercent >= 100 ? '#34d399' : '#fbbf24'}; border-color:${wf.coveragePercent >= 100 ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'};">
                  ${wf.coveragePercent}% Coverage
                </span>
              </div>
            </div>
            <div class="construction-pill-grid">
              <div class="construction-pill-item">
                <span>Optimal Needed:</span>
                <strong style="color:#38bdf8;">${wf.totalOptimalWorkforce.toLocaleString()}</strong>
              </div>
              <div class="construction-pill-item">
                <span>Hab Capacity:</span>
                <strong style="color:#34d399;">${wf.totalHabitationCapacity.toLocaleString()}</strong>
              </div>
              <div class="construction-pill-item">
                <span>Production:</span>
                <strong style="color:#cbd5e1;">${wf.productionWorkforce.toLocaleString()}</strong>
              </div>
              <div class="construction-pill-item">
                <span>Shipyards:</span>
                <strong style="color:#cbd5e1;">${wf.shipyardWorkforce.toLocaleString()}</strong>
              </div>
              <div class="construction-pill-item" style="grid-column: span 2;">
                <span>Workforce Balance:</span>
                <strong style="color:${wf.surplusDeficit > 0 ? '#34d399' : (wf.surplusDeficit < 0 ? '#ef4444' : '#cbd5e1')};">
                  ${wf.surplusDeficit > 0 ? `+${wf.surplusDeficit.toLocaleString()} surplus beds (${wf.habitatCount} habs)` : (wf.surplusDeficit < 0 ? `${wf.surplusDeficit.toLocaleString()} shortage` : `0 balance (${wf.habitatCount} habs)`)}
                </strong>
              </div>
              ${wf.lifeSupport && (wf.lifeSupport.totalFoodRationsProd > 0 || wf.lifeSupport.totalAllMedSuppliesProd > 0) ? `
              <div class="construction-pill-item" style="grid-column: span 2;">
                <span>Sustainable Workers:</span>
                <strong style="color:${wf.lifeSupport.sustainableWorkers >= wf.totalOptimalWorkforce ? '#34d399' : '#fbbf24'};">
                  ${wf.lifeSupport.sustainableWorkers.toLocaleString()} (${wf.lifeSupport.sustainableCoveragePercent}% self-sufficient)
                </strong>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="add-macro-box" style="margin:0; display:flex; align-items:center; gap:0.4rem; width:100%; flex-wrap:nowrap;">
        <label style="font-size:0.73rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:0.3rem; cursor:pointer; user-select:none; background:rgba(56,189,248,0.1); padding:0.2rem 0.45rem; border-radius:5px; border:1px solid rgba(56,189,248,0.25); white-space:nowrap; flex-shrink:0;" title="Once checked, signifies that the selected ware may have upstream providers. If the ware is L2 or L3, populates the display with those upstream wares and displays the number required to satisfy the upstream demands of each ware.">
          <input type="checkbox" id="chkPopulateMatrix" ${state.populateMatrix ? 'checked' : ''} style="width:13px; height:13px; accent-color:#38bdf8; cursor:pointer; margin:0;" />
          ⚡ Populate Needs
        </label>
        <label style="font-size:0.73rem; font-weight:700; color:#94a3b8; display:flex; align-items:center; gap:0.3rem; white-space:nowrap; flex-shrink:0;">
          Method:
          <select id="selectFactionMethod" class="select-preset" style="padding:0.2rem 0.4rem; font-size:0.73rem; border-radius:5px;">
            <option value="commonwealth" ${state.factionConstructionMethod === 'commonwealth' ? 'selected' : ''}>🏛️ Commonwealth</option>
            <option value="terran" ${state.factionConstructionMethod === 'terran' ? 'selected' : ''}>🪐 Terran Protectorate</option>
            <option value="boron" ${state.factionConstructionMethod === 'boron' ? 'selected' : ''}>🌊 Boron Kingdom</option>
          </select>
        </label>
        <select id="addMacroSelect" class="select-macro" style="padding:0.2rem 0.45rem; font-size:0.73rem; min-width:140px; max-width:240px; flex:1 1 auto;">
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
        <button class="btn-add-macro" id="btnAddMacro" style="padding:0.2rem 0.55rem; font-size:0.73rem; white-space:nowrap; flex-shrink:0;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Module
        </button>
        <div class="planned-filter-checkboxes" style="margin-left:auto; display:flex; align-items:center; gap:0.35rem; flex-shrink:0;">
          <label style="font-size:0.73rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.25rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.2rem 0.45rem; border-radius:5px; border:1px solid rgba(255,255,255,0.08); white-space:nowrap;" title="When checked, hides agricultural & food provision modules from table and dropdown (medical supplies are considered wares and remain visible)">
            <input type="checkbox" id="chkHideFoodAgri" ${state.hideFoodAgriPlanned ? 'checked' : ''} style="width:13px; height:13px; accent-color:#38bdf8; cursor:pointer; margin:0;" />
            🌾 Exclude Food & Agri Modules
          </label>
          <label style="font-size:0.73rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.25rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.2rem 0.45rem; border-radius:5px; border:1px solid rgba(255,255,255,0.08); white-space:nowrap;" title="When checked, lists only ware production modules (including medical supplies)">
            <input type="checkbox" id="chkFilterWares" ${state.filterWaresPlanned ? 'checked' : ''} style="width:13px; height:13px; accent-color:#38bdf8; cursor:pointer; margin:0;" />
            📦 Wares
          </label>
          <label style="font-size:0.73rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.25rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.2rem 0.45rem; border-radius:5px; border:1px solid rgba(255,255,255,0.08); white-space:nowrap;" title="When checked, unchecks Wares checkbox and populates only station structures">
            <input type="checkbox" id="chkFilterStructures" ${state.filterStructuresPlanned ? 'checked' : ''} style="width:13px; height:13px; accent-color:#38bdf8; cursor:pointer; margin:0;" />
            🏗️ Structures
          </label>
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
                const friendlyName = getFriendlyModuleName(macro, state.factionConstructionMethod);

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
                let purpose = ware ? `${ware.name} (Level ${ware.level} ${ware.cat})` : 'Station Structure / Utility';
                let displayWareName = ware ? ware.name : 'Station Structure / Utility';
                let displayWareSub = ware ? `(Level ${ware.level} ${ware.cat})` : '';

                const isGenRecycler = (macro === 'prod_gen_scrap_recycler_macro' || macro === 'prod_gen_scraprecycler_macro' || macro === 'prod_bor_scrap_recycler_macro' || macro === 'prod_bor_scraprecycler_macro');
                const isTerRecycler = (macro === 'prod_ter_scrap_recycler_macro' || macro === 'prod_ter_scraprecycler_macro');

                if (isGenRecycler && state.activeBlueprint && state.activeBlueprint.modules) {
                  const hasHull = (state.activeBlueprint.modules['ScrapHullParts'] || 0) > 0;
                  const hasClay = (state.activeBlueprint.modules['ScrapClaytronics'] || 0) > 0;
                  if (hasHull && hasClay) {
                    displayWareName = 'Hull Parts & Claytronics';
                    displayWareSub = '(Scrap Recycling)';
                    purpose = 'Hull Parts & Claytronics (Scrap Recycling)';
                  } else if (hasClay) {
                    displayWareName = 'Claytronics (Scrap)';
                    displayWareSub = '(Level 3 Nanotech Assemblies)';
                    purpose = 'Claytronics (Scrap) (Level 3 Nanotech Assemblies)';
                  } else if (hasHull) {
                    displayWareName = 'Hull Parts (Scrap)';
                    displayWareSub = '(Level 2 Refined Construction Materials)';
                    purpose = 'Hull Parts (Scrap) (Level 2 Refined Construction Materials)';
                  }
                } else if (isTerRecycler && state.activeBlueprint && state.activeBlueprint.modules) {
                  const hasSubstrate = (state.activeBlueprint.modules['TerCompSubstrate'] || 0) > 0;
                  const hasCarbide = (state.activeBlueprint.modules['TerSilCarbide'] || 0) > 0;
                  if (hasSubstrate && hasCarbide) {
                    displayWareName = 'Computronic Substrate & Silicon Carbide';
                    displayWareSub = '(TER Scrap Recycling)';
                    purpose = 'Computronic Substrate & Silicon Carbide (TER Scrap Recycling)';
                  } else if (hasSubstrate) {
                    displayWareName = 'Computronic Substrate (TER)';
                    displayWareSub = '(TER Scrap Recycling)';
                    purpose = 'Computronic Substrate (TER) (TER Scrap Recycling)';
                  } else if (hasCarbide) {
                    displayWareName = 'Silicon Carbide (TER)';
                    displayWareSub = '(TER Scrap Recycling)';
                    purpose = 'Silicon Carbide (TER) (TER Scrap Recycling)';
                  }
                }
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
                      ${ware ? `<div style="font-weight:600; color:#cbd5e1;">${displayWareName} <span style="font-size:0.75rem; color:#94a3b8;">${displayWareSub}</span></div>` : '<div style="color:#38bdf8; font-weight:600; font-size:0.85rem;">Station Structure / Utility</div>'}
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

/**
 * Renders the Construction Resource Budget table with Min / Avg / Max price tier toggles.
 * @param {Object} state - Application state
 * @param {'min'|'avg'|'max'} [priceType='avg'] - Selected price evaluation tier
 * @returns {string} HTML string for the construction resource budget card
 */
export function renderConstructionCosts(state = {}, priceType = 'avg') {
  const currentPriceType = priceType || state.priceType || 'avg';
  const method = state.constructionMethod || state.factionConstructionMethod || 'commonwealth';
  const rawModules = (state.modules && Object.keys(state.modules).length > 0)
    ? state.modules
    : ((state.activeBlueprint && state.activeBlueprint.rawMacros) || {});

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
      <div class="macro-table-card construction-budget-card" style="margin-top: 1.25rem;">
        <div class="construction-budget-card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; padding: 0.85rem 1rem 0.65rem 1rem; border-bottom: 1px solid var(--border-card);">
          <h3 style="margin:0; font-size:1.05rem; color:#38bdf8; display:flex; align-items:center; gap:0.5rem;">
            <span>💰 Construction Resource Budget</span>
            <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(${currentPriceType.toUpperCase()} Price Evaluation)</span>
          </h3>
          <div class="price-mode-toggles" style="display:flex; align-items:center; gap:0.35rem; background:rgba(15, 23, 42, 0.6); padding:0.2rem 0.35rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
            <span style="font-size:0.72rem; color:#94a3b8; font-weight:600; margin-right:0.2rem;">Price Tier:</span>
            <button type="button" class="btn-price-tier ${currentPriceType === 'min' ? 'active' : ''}" data-price-tier="min" style="padding:0.2rem 0.55rem; font-size:0.72rem; border-radius:4px; border:1px solid ${currentPriceType === 'min' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'min' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'min' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Min Price</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'avg' ? 'active' : ''}" data-price-tier="avg" style="padding:0.2rem 0.55rem; font-size:0.72rem; border-radius:4px; border:1px solid ${currentPriceType === 'avg' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'avg' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'avg' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Avg Price</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'max' ? 'active' : ''}" data-price-tier="max" style="padding:0.2rem 0.55rem; font-size:0.72rem; border-radius:4px; border:1px solid ${currentPriceType === 'max' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'max' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'max' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Max Price</button>
          </div>
        </div>
        <p style="color:#94a3b8; font-style:italic; padding: 1.5rem; text-align:center;">No construction resources required.</p>
      </div>
    `;
  }

  return `
    <div class="macro-table-card construction-budget-card" style="margin-top: 1.25rem;">
      <div class="construction-budget-card-header" style="display:flex; justify-content:space-between; align-items:center; padding: 0.85rem 1rem 0.65rem 1rem; border-bottom: 1px solid var(--border-card); flex-wrap:wrap; gap:0.6rem;">
        <div>
          <h3 style="margin:0; font-size:1.05rem; color:#38bdf8; display:flex; align-items:center; gap:0.5rem;">
            <span>💰 Construction Resource Budget</span>
            <span style="font-size:0.75rem; color:#94a3b8; font-weight:normal;">(${currentPriceType.toUpperCase()} Market Cr Valuation)</span>
          </h3>
          <p style="margin:0.2rem 0 0 0; font-size:0.75rem; color:#94a3b8;">
            Aggregated station construction materials and total estimated credit costs across all planned modules.
          </p>
        </div>
        <div class="price-mode-toggles" style="display:flex; align-items:center; gap:0.35rem; background:rgba(15, 23, 42, 0.6); padding:0.2rem 0.35rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
          <span style="font-size:0.72rem; color:#94a3b8; font-weight:600; margin-right:0.2rem;">Price Tier:</span>
          <button type="button" class="btn-price-tier ${currentPriceType === 'min' ? 'active' : ''}" data-price-tier="min" style="padding:0.22rem 0.6rem; font-size:0.72rem; border-radius:4px; border:1px solid ${currentPriceType === 'min' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'min' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'min' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700; transition:all 0.15s ease;">Min Price</button>
          <button type="button" class="btn-price-tier ${currentPriceType === 'avg' ? 'active' : ''}" data-price-tier="avg" style="padding:0.22rem 0.6rem; font-size:0.72rem; border-radius:4px; border:1px solid ${currentPriceType === 'avg' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'avg' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'avg' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700; transition:all 0.15s ease;">Avg Price</button>
          <button type="button" class="btn-price-tier ${currentPriceType === 'max' ? 'active' : ''}" data-price-tier="max" style="padding:0.22rem 0.6rem; font-size:0.72rem; border-radius:4px; border:1px solid ${currentPriceType === 'max' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'max' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'max' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700; transition:all 0.15s ease;">Max Price</button>
        </div>
      </div>

      <div class="macro-table-container">
        <table class="macro-table">
          <thead>
            <tr>
              <th style="text-align:left;">Construction Ware</th>
              <th style="text-align:right;">Required Quantity</th>
              <th style="text-align:right;">Est. Unit Price (${currentPriceType.toUpperCase()})</th>
              <th style="text-align:right;">Total Cost (Cr)</th>
            </tr>
          </thead>
          <tbody>
            ${resourceEntries.map(([ware, data]) => `
              <tr>
                <td style="text-align:left;">
                  <div style="font-weight:700; color:#f8fafc; font-size:0.9rem;">${escapeHtml(formatWareName(ware))}</div>
                  <div style="font-size:0.75rem; color:#64748b; font-family:monospace; margin-top:2px;">${escapeHtml(ware)}</div>
                </td>
                <td style="text-align:right;">
                  <strong style="color:#38bdf8; font-size:0.9rem;">${data.quantity.toLocaleString()}</strong> <span style="font-size:0.75rem; color:#94a3b8;">units</span>
                </td>
                <td style="text-align:right; color:#cbd5e1; font-family:monospace; font-size:0.85rem;">
                  ${data.unitPrice.toLocaleString()} Cr
                </td>
                <td style="text-align:right;">
                  <strong style="color:#fbbf24; font-size:0.9rem; font-family:monospace;">${data.totalCredits.toLocaleString()} Cr</strong>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top: 1px solid rgba(56, 189, 248, 0.35); background: rgba(30, 41, 59, 0.5);">
              <th style="text-align:left; color:#f8fafc; font-size:0.95rem;">Grand Total</th>
              <th style="text-align:right; color:#38bdf8; font-size:0.95rem;">${buildResult.totals.totalWareUnits.toLocaleString()} units</th>
              <th style="text-align:right; color:#94a3b8;">—</th>
              <th style="text-align:right; color:#34d399; font-size:1.05rem; font-weight:800; font-family:monospace;">${buildResult.totals.totalCredits.toLocaleString()} Cr</th>
            </tr>
          </tfoot>
        </table>
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
      const catWords = catName ? catName.split(/[\s/()]+/) : [];
      const catMatches = catWords.some(w => w.startsWith(query)) || (catName.includes(query) && query.includes(' '));
      const combinedText = `${commonName} ${macroName} ${wareName} ${catName} ${purpose} ${rowText}`;
      const queryWords = query.split(/\s+/).filter(Boolean);
      const allWordsMatch = queryWords.length > 1 && queryWords.every(w => combinedText.includes(w));
      const contains = (matchesModuleQuery(macro, query) === true) ||
        commonName.includes(query) ||
        macroName.includes(query) ||
        wareName.includes(query) ||
        catMatches ||
        purpose.includes(query) ||
        rowText.includes(query) ||
        allWordsMatch;
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

let containerEl = null;
let unsubscribeStore = null;

/**
 * Initializes the Planned View component and subscribes to state changes.
 * @param {HTMLElement} rootElement - Parent DOM container
 */
export function initPlannedView(rootElement) {
  containerEl = rootElement;

  if (unsubscribeStore) {
    unsubscribeStore();
  }

  // Subscribe to store updates
  unsubscribeStore = store.subscribe((currentState) => {
    if (containerEl && state.activeTab === 'planned') {
      if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
        window.renderApp();
      } else {
        containerEl.innerHTML = renderPlannedTabHTML();
      }
    }
  });

  // Attach price tier toggle listener to rootElement container
  if (containerEl && typeof containerEl.addEventListener === 'function' && !containerEl._priceTierListenerAttached) {
    containerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-price-tier');
      if (btn) {
        const tier = btn.dataset.priceTier;
        if (tier && ['min', 'avg', 'max'].includes(tier)) {
          if (store && typeof store.setPriceType === 'function') {
            store.setPriceType(tier);
          } else {
            state.priceType = tier;
            if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
              window.renderApp();
            } else if (containerEl) {
              containerEl.innerHTML = renderPlannedTabHTML();
            }
          }
        }
      }
    });
    containerEl._priceTierListenerAttached = true;
  }

  // Initial render
  if (containerEl) {
    if (typeof window !== 'undefined' && typeof window.renderApp === 'function') {
      window.renderApp();
    } else {
      containerEl.innerHTML = renderPlannedTabHTML();
    }
  }
}

/**
 * Cleans up DOM event listeners and store subscriptions upon tab switch.
 */
export function destroyPlannedView() {
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  containerEl = null;
}

