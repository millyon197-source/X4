import { getFriendlyModuleName, mapMacroToWare, isFoodOrAgriMacro, isWareMacro, isStructureMacro, isShipMacro, getModuleBuildCost, getConstructionMethodForFaction, isTerranFaction, MACRO_TO_WARE, MODULE_NAMES, MODULE_BUILD_COSTS, WARES_DB, BLUEPRINTS_CATALOG } from '../data/wares.js';
import MODULES_WORKFORCE from '../data/modules_workforce.json' with { type: 'json' };
import { calculateBlueprintWorkforce, getPrimaryMacroForWare } from '../engine/calculator.js';
import { readAndParseBlueprintFile } from '../engine/xmlParser.js';
import { calculateBuildCosts } from '../engine/buildCost.js';
import { getWareUnitPrice, WARE_PRICES } from '../engine/prices.js';
import { getMatchNeedsStatus } from '../engine/matchNeeds.js';
import { state, store } from '../state/store.js';
import { escapeHtml } from '../html.js';
import { isMacroBlueprintOwned } from '../engine/blueprintOwnership.js';
import { renderNotOwnedModuleTag, getNotOwnedModuleDlcInfo } from '../engine/cuckooDlcLookup.js';

export function getKnownMacrosList() {
  const allKnownMacros = Array.from(new Set([
    ...Object.keys(MODULE_NAMES || {}),
    ...Object.keys(MODULE_BUILD_COSTS || {}),
    ...Object.keys(MACRO_TO_WARE || {}),
    ...(BLUEPRINTS_CATALOG?.blueprints?.filter(b => b.group === 'modules' || b.category === 'Modules').map(b => b.macro) || []),
    ...(state.activeBlueprint?.rawMacros ? Object.keys(state.activeBlueprint.rawMacros) : []),
    ...(state.originalBlueprint?.rawMacros ? Object.keys(state.originalBlueprint.rawMacros) : []),
    ...(state.loadedBlueprints?.flatMap(b => Object.keys(b?.rawMacros || {})) || [])
  ]));

  return allKnownMacros
    .filter(macro => {
      if (!macro) return false;
      if (isShipMacro(macro)) return false;
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

export function matchesModuleQuery(macro, query, { moduleNameOnly = false } = {}) {
  if (!query) return true;
  const raw = query.trim().toLowerCase();
  if (!raw) return true;

  const wareId = mapMacroToWare(macro);
  const ware = wareId ? WARES_DB[wareId] : null;

  const isNegated = raw.startsWith('!');
  const q = isNegated ? raw.slice(1).trim() : raw;
  if (!q) return true;

  const friendly = getFriendlyModuleName(macro, state?.factionConstructionMethod).toLowerCase();
  const macroLower = macro.toLowerCase();

  // When performing cumulative search (or if moduleNameOnly is true), use ONLY module name for matches
  if (moduleNameOnly) {
    const combinedText = `${friendly} ${macroLower}`;
    const queryWords = q.split(/\s+/).filter(Boolean);
    const allWordsMatch = queryWords.length > 1 && queryWords.every(w => combinedText.includes(w));
    const contains = friendly.includes(q) || macroLower.includes(q) || allWordsMatch;
    return isNegated ? !contains : contains;
  }

  // If ware is an L4 component, do not examine its L4 component text for matches
  const isL4Component = ware && ware.level === 4;
  const wareName = (ware && !isL4Component) ? ware.name.toLowerCase() : '';
  const wareCat = (ware && ware.cat && !isL4Component) ? ware.cat.toLowerCase() : '';
  const isHab = macroLower.startsWith('hab_') || macroLower.includes('housing') || (MODULES_WORKFORCE && MODULES_WORKFORCE[macro]?.capacity > 0);
  const purpose = (ware && !isL4Component)
    ? `${wareName} level ${ware.level} ${wareCat}`
    : (isHab ? 'station habitat habitation workforce housing structure utility' : 'station structure utility');

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
  const currentVal = select.value || state.lastSelectedAddMacro || '';
  const effectiveQuery = (state.addMacroSearchQuery || query || '').trim().toLowerCase();
  let filtered = effectiveQuery
    ? knownMacrosList.filter(macro => matchesModuleQuery(macro, effectiveQuery, { moduleNameOnly: false }))
    : [...knownMacrosList];

  // If currentVal is selected, make sure it is present in filtered list so it remains selectable
  if (currentVal && !filtered.includes(currentVal) && knownMacrosList.includes(currentVal)) {
    filtered.unshift(currentVal);
  }

  const primaryMacro = state.selectedWareId ? getPrimaryMacroForWare(state.selectedWareId) : null;
  const hasInPlan = Boolean(state.selectedWareId && state.activeBlueprint?.rawMacros && Object.entries(state.activeBlueprint.rawMacros).some(([m, q]) => q > 0 && mapMacroToWare(m) === state.selectedWareId));

  let html = `<option value="">-- Select Station Module to Add ${effectiveQuery ? `(${filtered.length} found)` : ''} --</option>`;
  knownMacrosList.forEach(macro => {
    let friendly = getFriendlyModuleName(macro, state.factionConstructionMethod);
    if (macro === 'prod_ter_scrap_recycler_macro' || macro === 'prod_ter_scraprecycler_macro') {
      friendly = 'Scrap Recycler (TER)';
    } else if (!isTerranFaction(state.factionConstructionMethod)) {
      if (macro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
    }
    const isSelected = (macro === currentVal) || (!currentVal && !hasInPlan && primaryMacro && macro === primaryMacro);
    const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(macro, state.serverModules);
    let unownedTag = '';
    if (!isOwned) {
      const dlcInfo = getNotOwnedModuleDlcInfo(macro);
      unownedTag = dlcInfo.isDlc ? ` [${dlcInfo.dlcName}]` : ' [Not Owned]';
    }
    html += `<option value="${escapeHtml(macro)}" ${isSelected ? 'selected' : ''} class="${!isOwned ? 'macro-unowned' : ''}" style="${!isOwned ? 'color:#ef4444;' : ''}">${escapeHtml(friendly)} (${escapeHtml(macro)})${unownedTag}</option>`;
  });

  if (currentVal && !isShipMacro(currentVal) && !knownMacrosList.includes(currentVal)) {
    let friendly = getFriendlyModuleName(currentVal, state.factionConstructionMethod);
    const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(currentVal, state.serverModules);
    let unownedTag = '';
    if (!isOwned) {
      const dlcInfo = getNotOwnedModuleDlcInfo(currentVal);
      unownedTag = dlcInfo.isDlc ? ` [${dlcInfo.dlcName}]` : ' [Not Owned]';
    }
    html += `<option value="${escapeHtml(currentVal)}" selected class="${!isOwned ? 'macro-unowned' : ''}" style="${!isOwned ? 'color:#ef4444;' : ''}">${escapeHtml(friendly)} (${escapeHtml(currentVal)})${unownedTag}</option>`;
  }

  select.innerHTML = html;

  if (currentVal) {
    select.value = currentVal;
    state.lastSelectedAddMacro = currentVal;
  } else if (!select.value) {
    state.lastSelectedAddMacro = '';
  }

  const trigger = document.getElementById('addMacroTrigger');
  const triggerText = document.getElementById('addMacroTriggerText');
  if (triggerText && trigger && !trigger.classList.contains('active')) {
    if (select.value) {
      let friendly = getFriendlyModuleName(select.value, state.factionConstructionMethod);
      if (select.value === 'prod_ter_scrap_recycler_macro' || select.value === 'prod_ter_scraprecycler_macro') {
        friendly = 'Scrap Recycler (TER)';
      } else if (!isTerranFaction(state.factionConstructionMethod)) {
        if (select.value === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
      }
      const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(select.value, state.serverModules);
      triggerText.textContent = `${friendly} (${select.value})`;
      triggerText.style.color = !isOwned ? '#ef4444' : '#fff';
    } else {
      triggerText.textContent = `-- Select Station Module to Add ${effectiveQuery ? `(${filtered.length} found)` : ''} --`;
      triggerText.style.color = '#94a3b8';
    }
  }
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
  const effectiveMacroQuery = (state.addMacroSearchQuery || state.searchQuery || '').trim().toLowerCase();
  let filteredMacrosList = effectiveMacroQuery
    ? knownMacrosList.filter(m => matchesModuleQuery(m, effectiveMacroQuery, { moduleNameOnly: false }))
    : [...knownMacrosList];
  const primaryMacro = state.selectedWareId ? getPrimaryMacroForWare(state.selectedWareId) : null;
  const hasInPlan = Boolean(state.selectedWareId && state.activeBlueprint?.rawMacros && Object.entries(state.activeBlueprint.rawMacros).some(([m, q]) => q > 0 && mapMacroToWare(m) === state.selectedWareId));
  let initiallySelectedMacro = '';
  if (state.lastSelectedAddMacro && !isShipMacro(state.lastSelectedAddMacro) && knownMacrosList.includes(state.lastSelectedAddMacro)) {
    initiallySelectedMacro = state.lastSelectedAddMacro;
  } else if (!hasInPlan && state.selectedWareId) {
    initiallySelectedMacro = (
      filteredMacrosList.find(m => primaryMacro && m === primaryMacro) ||
      filteredMacrosList.find(m => mapMacroToWare(m) === state.selectedWareId) ||
      ''
    );
  }

  // Ensure initiallySelectedMacro is present in filteredMacrosList so <option selected> is rendered
  if (initiallySelectedMacro && !isShipMacro(initiallySelectedMacro) && !filteredMacrosList.includes(initiallySelectedMacro)) {
    filteredMacrosList.unshift(initiallySelectedMacro);
  }

  let initialTriggerText = `-- Select Station Module to Add ${effectiveMacroQuery ? `(${filteredMacrosList.length} found)` : ''} --`;
  let initialIsOwned = true;
  if (initiallySelectedMacro) {
    let friendly = getFriendlyModuleName(initiallySelectedMacro, state.factionConstructionMethod);
    if (initiallySelectedMacro === 'prod_ter_scrap_recycler_macro' || initiallySelectedMacro === 'prod_ter_scraprecycler_macro') {
      friendly = 'Scrap Recycler (TER)';
    } else if (!isTerranFaction(state.factionConstructionMethod)) {
      if (initiallySelectedMacro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
    }
    initialTriggerText = `${friendly} (${initiallySelectedMacro})`;
    initialIsOwned = !state.serverModules ? true : isMacroBlueprintOwned(initiallySelectedMacro, state.serverModules);
  }

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

  const effectiveModules = (state.activeBlueprint?.rawMacros && Object.keys(state.activeBlueprint.rawMacros).length > 0)
    ? state.activeBlueprint.rawMacros
    : (state.modules && Object.keys(state.modules).length > 0)
      ? state.modules
      : rawMacrosMap;
  const currentPriceType = state.priceType || 'avg';
  const method = state.constructionMethod || state.factionConstructionMethod || 'commonwealth';
  const buildResult = calculateBuildCosts(effectiveModules, method, currentPriceType);

  const hasAnyVisible = !searchQuery || macroEntries.some(([macro]) => matchesModuleQuery(macro, searchQuery));
  const wf = calculateBlueprintWorkforce(state.activeBlueprint);
  const hasWorkforce = wf && (wf.totalOptimalWorkforce > 0 || wf.totalHabitationCapacity > 0);
  const { isAllSynced, matchNeedsLabel, matchNeedsTitle } = getMatchNeedsStatus();
  const hasAnyUnownedInPlan = Boolean(state.serverModules && macroEntries.some(([macro]) => !isMacroBlueprintOwned(macro, state.serverModules)));

  return `
    <div class="planned-wrapper">
      <div class="planned-header-card">
        <div class="planned-header-top" style="display:flex; justify-space-between; align-items:flex-start; width:100%; gap:1.25rem; flex-wrap:wrap;">
          <div class="planned-title" style="flex:1; min-width:280px;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <h2 style="margin:0; display:flex; align-items:center; gap:0.5rem;">
                📋 Planned and Changed Modules
                ${hasAnyUnownedInPlan ? '<span class="not-owned-label" style="font-size:0.65rem; padding:0.12rem 0.45rem;">Not Owned</span>' : ''}
              </h2>
              <button class="btn-upload btn-create-bp btn-save-panel-xml" id="btnSavePlannedPanelXML" style="padding:0.25rem 0.65rem; font-size:0.75rem;" title="Save current planned panel as an .xml blueprint file">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Save Panel as .XML Blueprint
              </button>
            </div>
            <p style="margin:0.2rem 0 0 0; font-size:0.8rem; color:#94a3b8;">Specify and adjust quantities for each station module.</p>
          </div>

          <div class="planned-pills-container">
          <!-- Method Selector -->
          <div class="planned-method-container">
            <label for="selectFactionMethod" style="font-size:0.73rem; font-weight:700; color:#94a3b8; display:flex; align-items:center; gap:0.3rem; white-space:nowrap; margin:0; cursor:pointer;">
              Method:
            </label>
            <select id="selectFactionMethod" class="select-preset" style="padding:0.22rem 0.45rem; font-size:0.74rem; border-radius:5px; background:rgba(30,41,59,0.85); border:1px solid #38bdf8; color:#fff; cursor:pointer; max-width:215px;">
              <optgroup label="Major Empires &amp; Factions" style="background:#0f172a; color:#38bdf8; font-weight:700;">
                <option value="commonwealth" ${state.factionConstructionMethod === 'commonwealth' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🏛️ Commonwealth (Generic)</option>
                <option value="argon" ${state.factionConstructionMethod === 'argon' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🛡️ Argon Federation (ARG)</option>
                <option value="antigone" ${state.factionConstructionMethod === 'antigone' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🏛️ Antigone Republic (ANT)</option>
                <option value="terran" ${state.factionConstructionMethod === 'terran' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🪐 Terran Protectorate (TER)</option>
                <option value="pioneers" ${state.factionConstructionMethod === 'pioneers' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🔬 Segaris Pioneers (PIO)</option>
                <option value="boron" ${state.factionConstructionMethod === 'boron' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🌊 Boron Kingdom (BOR)</option>
                <option value="teladi" ${state.factionConstructionMethod === 'teladi' ? 'selected' : ''} style="background:#1e293b; color:#fff;">💰 Teladi Company (TEL)</option>
                <option value="ministry" ${state.factionConstructionMethod === 'ministry' ? 'selected' : ''} style="background:#1e293b; color:#fff;">⚖️ Ministry of Finance (MIN)</option>
                <option value="paranid" ${state.factionConstructionMethod === 'paranid' ? 'selected' : ''} style="background:#1e293b; color:#fff;">👁️ Godrealm of the Paranid (PAR)</option>
                <option value="holyorder" ${state.factionConstructionMethod === 'holyorder' ? 'selected' : ''} style="background:#1e293b; color:#fff;">⚔️ Holy Order of the Pontifex (HOP)</option>
                <option value="split" ${state.factionConstructionMethod === 'split' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🔥 Zyarth Patriarchy (ZYA)</option>
                <option value="freefamilies" ${state.factionConstructionMethod === 'freefamilies' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🏴 Free Families (FRF)</option>
              </optgroup>
              <optgroup label="Minor, Regional &amp; Pirate Factions" style="background:#0f172a; color:#38bdf8; font-weight:700;">
                <option value="hatikvah" ${state.factionConstructionMethod === 'hatikvah' ? 'selected' : ''} style="background:#1e293b; color:#fff;">📦 Hatikvah Free League (HAT)</option>
                <option value="ali" ${state.factionConstructionMethod === 'ali' ? 'selected' : ''} style="background:#1e293b; color:#fff;">📜 Alliance of the Word (ALI)</option>
                <option value="rip" ${state.factionConstructionMethod === 'rip' ? 'selected' : ''} style="background:#1e293b; color:#fff;">⚡ Riptide Rakers (RIP)</option>
                <option value="vigor" ${state.factionConstructionMethod === 'vigor' ? 'selected' : ''} style="background:#1e293b; color:#fff;">💀 Vigor Syndicate (VIG)</option>
                <option value="scaleplate" ${state.factionConstructionMethod === 'scaleplate' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🏴‍☠️ Scale Plate Pact (SCA)</option>
                <option value="yaki" ${state.factionConstructionMethod === 'yaki' ? 'selected' : ''} style="background:#1e293b; color:#fff;">👹 Yaki (YAK)</option>
                <option value="buc" ${state.factionConstructionMethod === 'buc' ? 'selected' : ''} style="background:#1e293b; color:#fff;">👑 Duke's Buccaneers (BUC)</option>
                <option value="faf" ${state.factionConstructionMethod === 'faf' ? 'selected' : ''} style="background:#1e293b; color:#fff;">🗡️ Fallen Families (FAF)</option>
              </optgroup>
            </select>
          </div>

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
              ${(totalCompSubstrate > 0 || isTerranFaction(state.factionConstructionMethod)) ? `
              <div class="construction-pill-item">
                <span>Comp Sub:</span>
                <strong style="color:#f472b6;">${totalCompSubstrate.toLocaleString()}</strong>
              </div>` : ''}
              ${(totalSilCarbide > 0 || isTerranFaction(state.factionConstructionMethod)) ? `
              <div class="construction-pill-item">
                <span>Sil Carbide:</span>
                <strong style="color:#a7f3d0;">${totalSilCarbide.toLocaleString()}</strong>
              </div>` : ''}
              ${(totalMetMicrolatt > 0 || isTerranFaction(state.factionConstructionMethod)) ? `
              <div class="construction-pill-item">
                <span>Met Micro:</span>
                <strong style="color:#94a3b8;">${totalMetMicrolatt.toLocaleString()}</strong>
              </div>` : ''}
              ${totalProtectyonBuild > 0 ? `
              <div class="construction-pill-item">
                <span>Protectyon:</span>
                <strong style="color:#f472b6;">${totalProtectyonBuild.toLocaleString()}</strong>
              </div>` : ''}
              ${(totalWaterBuild > 0 || getConstructionMethodForFaction(state.factionConstructionMethod) === 'boron') ? `
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
              ${wf.lifeSupport && (wf.lifeSupport.totalFoodProd > 0 || wf.lifeSupport.totalMedProd > 0 || wf.lifeSupport.totalFoodRationsProd > 0 || wf.lifeSupport.totalAllMedSuppliesProd > 0) ? `
              <div class="construction-pill-item" style="grid-column: span 2;">
                <span>Sustainable Workers:</span>
                <strong style="color:${wf.lifeSupport.sustainableWorkers >= (wf.totalOptimalWorkforce > 0 ? wf.totalOptimalWorkforce : wf.totalHabitationCapacity) ? '#34d399' : '#fbbf24'};">
                  ${wf.lifeSupport.sustainableWorkers.toLocaleString()} (${wf.lifeSupport.sustainableCoveragePercent}% self-sufficient)
                </strong>
              </div>
              <div class="construction-pill-item" style="grid-column: span 2; display:flex; justify-content:space-between;">
                <span>🍞 ${wf.lifeSupport.foodName || 'Food Rations'}:</span>
                <strong style="color:${wf.lifeSupport.foodBalance >= 0 ? '#34d399' : '#ef4444'};">
                  ${Math.round(wf.lifeSupport.totalFoodProd || wf.lifeSupport.totalFoodRationsProd).toLocaleString()} / hr (need ${Math.round(wf.lifeSupport.foodDemand || wf.lifeSupport.foodRationsDemand).toLocaleString()})
                </strong>
              </div>
              <div class="construction-pill-item" style="grid-column: span 2; display:flex; justify-content:space-between;">
                <span>💊 ${wf.lifeSupport.medName || 'Medical Supplies'}:</span>
                <strong style="color:${wf.lifeSupport.medBalance >= 0 ? '#34d399' : '#ef4444'};">
                  ${Math.round(wf.lifeSupport.totalMedProd || wf.lifeSupport.totalArgMedSuppliesProd || wf.lifeSupport.totalAllMedSuppliesProd).toLocaleString()} / hr (need ${Math.round(wf.lifeSupport.medicalSuppliesDemand).toLocaleString()})
                </strong>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <div style="font-size:0.78rem; color:#94a3b8; margin:-0.15rem 0 -0.45rem 0;">
        Any Station Module Name in <span style="color:#34d399; font-weight:700;">Green</span> has changes to its Quantity In Plan, or in <span style="color:#ef4444; font-weight:700;">Red</span> if blueprint is Not Owned
      </div>

      <div class="add-macro-box" style="margin:0; display:flex; align-items:center; gap:0.4rem; width:100%; flex-wrap:nowrap; position:relative;">
        <div id="addMacroActionGroup" style="display:inline-flex; align-items:center; gap:0.45rem; flex-shrink:0;">
          <div id="addMacroComboboxWrapper" class="custom-macro-dropdown-wrapper">
            <select id="addMacroSelect" style="display:none;" tabindex="-1" aria-hidden="true">
              <option value="">-- Select Station Module to Add ${effectiveMacroQuery ? `(${filteredMacrosList.length} found)` : ''} --</option>
              ${knownMacrosList.map(macro => {
                let friendly = getFriendlyModuleName(macro, state.factionConstructionMethod);
                if (macro === 'prod_ter_scrap_recycler_macro' || macro === 'prod_ter_scraprecycler_macro') {
                  friendly = 'Scrap Recycler (TER)';
                } else if (!isTerranFaction(state.factionConstructionMethod)) {
                  if (macro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
                }
                const isSelected = (macro === initiallySelectedMacro);
                const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(macro, state.serverModules);
                let unownedTag = '';
                if (!isOwned) {
                  const dlcInfo = getNotOwnedModuleDlcInfo(macro);
                  unownedTag = dlcInfo.isDlc ? ` [${dlcInfo.dlcName}]` : ' [Not Owned]';
                }
                return `<option value="${escapeHtml(macro)}" ${isSelected ? 'selected' : ''} class="${!isOwned ? 'macro-unowned' : ''}" style="${!isOwned ? 'color:#ef4444;' : ''}">${escapeHtml(friendly)} (${escapeHtml(macro)})${unownedTag}</option>`;
              }).join('')}
              ${(initiallySelectedMacro && !isShipMacro(initiallySelectedMacro) && !knownMacrosList.includes(initiallySelectedMacro)) ? (() => {
                const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(initiallySelectedMacro, state.serverModules);
                let unownedTag = '';
                if (!isOwned) {
                  const dlcInfo = getNotOwnedModuleDlcInfo(initiallySelectedMacro);
                  unownedTag = dlcInfo.isDlc ? ` [${dlcInfo.dlcName}]` : ' [Not Owned]';
                }
                return `<option value="${escapeHtml(initiallySelectedMacro)}" selected class="${!isOwned ? 'macro-unowned' : ''}" style="${!isOwned ? 'color:#ef4444;' : ''}">${escapeHtml(getFriendlyModuleName(initiallySelectedMacro, state.factionConstructionMethod))} (${escapeHtml(initiallySelectedMacro)})${unownedTag}</option>`;
              })() : ''}
            </select>

            <div id="addMacroTrigger" class="custom-macro-trigger select-macro" tabindex="0" role="combobox" aria-expanded="false" aria-haspopup="listbox" title="Click or type while expanded to search station modules">
              <span id="addMacroTriggerText" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${initiallySelectedMacro ? (!initialIsOwned ? 'color:#ef4444;' : 'color:#fff;') : 'color:#94a3b8;'}">${escapeHtml(initialTriggerText)}</span>
              <span class="custom-macro-arrow" style="font-size:0.65rem; color:#38bdf8; margin-left:6px; flex-shrink:0;">▼</span>
            </div>

            <div id="addMacroMenu" class="custom-macro-menu" role="listbox" style="display:none;">
              <div id="addMacroSearchIndicator" class="custom-macro-search-banner">
                <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                  <span style="font-size:0.75rem; color:#38bdf8; flex-shrink:0;">🔍</span>
                  <input type="text" id="addMacroSearchInput" class="custom-macro-search-input" placeholder="Type to search modules..." value="${escapeHtml(state.addMacroSearchQuery || '')}" autocomplete="off" spellcheck="false" />
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                  <span id="addMacroSearchCount">(${filteredMacrosList.length} ${effectiveMacroQuery ? 'found' : 'available'})</span>
                  <button type="button" id="addMacroClearSearchBtn" style="${(state.addMacroSearchQuery || state.searchQuery) ? 'display:inline-flex;' : 'display:none;'} background:none; border:none; color:#f87171; cursor:pointer; font-size:0.8rem; padding:0 3px; font-weight:bold;" title="Clear search">✕</button>
                </div>
              </div>
              <div id="addMacroOptionsList" class="custom-macro-options-list"></div>
            </div>
          </div>
          <button class="btn-add-macro" id="btnAddMacro" style="padding:0.22rem 0.6rem; font-size:0.74rem; white-space:nowrap; flex-shrink:0;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Module
          </button>
        </div>

        <div id="matchNeedsAlignSpacer" style="width:0px; flex-shrink:0;"></div>

        <div id="chkMatchNeedsPlannedWrapper" style="display:inline-flex; align-items:center; flex-shrink:0;">
          <label style="font-size:0.72rem; color:#38bdf8; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; background:rgba(56,189,248,0.15); padding:0.2rem 0.5rem; border-radius:4px; border:1px solid rgba(56,189,248,0.35); user-select:none; white-space:nowrap; flex-shrink:0;" title="${matchNeedsTitle}">
            <input type="checkbox" id="chkMatchNeedsPlanned" ${isAllSynced ? 'checked' : ''} style="cursor:pointer; width:13px; height:13px; accent-color:#38bdf8; margin:0;" />
            ${matchNeedsLabel}
          </label>
        </div>
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
                const targetWareId = state.selectedWareId || state.lastFocusedWareId;
                const isFocusedWare = Boolean(targetWareId && (wareId === targetWareId || (primaryMacro && macro === primaryMacro)));
                const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(macro, state.serverModules);
                const nameColor = !isOwned ? '#ef4444' : (isChanged ? '#34d399' : '#f8fafc');
                const titleText = !isOwned
                  ? (isChanged ? (origQty === 0 ? 'Not Owned • Added module (original: 0)' : `Not Owned • Modified quantity (original: ${origQty}x)`) : 'Blueprint Not Owned')
                  : (isChanged ? (origQty === 0 ? 'Added module (original: 0)' : `Modified quantity (original: ${origQty}x)`) : '');

                return `
                  <tr class="macro-row ${isFocusedWare ? 'macro-row-focused' : ''} ${!isOwned ? 'macro-row-unowned' : ''}" data-macro="${escapeHtml(macro.toLowerCase())}" data-friendly="${escapeHtml(friendlyName.toLowerCase())}" data-ware="${escapeHtml((ware ? ware.name : '').toLowerCase())}" data-cat="${escapeHtml(wareCat.toLowerCase())}" data-purpose="${escapeHtml(purpose.toLowerCase())}" style="${matchesSearch ? '' : 'display:none;'}">
                    <td>
                      <div style="font-weight:700; font-size:0.9rem; display:flex; align-items:center; gap:6px;">
                        <span style="color:${nameColor};" title="${escapeHtml(titleText)}">${escapeHtml(friendlyName)}</span>
                        ${!isOwned ? renderNotOwnedModuleTag(macro) : ''}
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
  const rawModules = (state.activeBlueprint?.rawMacros && Object.keys(state.activeBlueprint.rawMacros).length > 0)
    ? state.activeBlueprint.rawMacros
    : (state.modules && Object.keys(state.modules).length > 0)
      ? state.modules
      : ((state.activeBlueprint && (state.activeBlueprint.rawMacros || state.activeBlueprint.modules)) || {});

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

/**
 * Places focus onto the planned module corresponding to the given wareId or state.selectedWareId.
 * - Highlights the row in the Planned table, centers it in view, and focuses its quantity input.
 * - If not yet in the active plan, pre-selects the module in the Add Module dropdown and highlights it.
 * @param {string} [wareId] - Optional ware ID to focus; defaults to state.selectedWareId or state.lastFocusedWareId.
 */
export function focusPlannedModule(wareId) {
  const targetWareId = wareId || state.selectedWareId || state.lastFocusedWareId;
  if (!targetWareId) return;

  // 1. Determine matching macro
  let matchingMacro = null;
  if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
    const primary = getPrimaryMacroForWare(targetWareId);
    if (primary && state.activeBlueprint.rawMacros[primary] > 0) {
      matchingMacro = primary;
    } else {
      matchingMacro = Object.keys(state.activeBlueprint.rawMacros).find(m => {
        return state.activeBlueprint.rawMacros[m] > 0 && mapMacroToWare(m) === targetWareId;
      });
    }
  }
  if (!matchingMacro) {
    if (state.lastSelectedAddMacro && mapMacroToWare(state.lastSelectedAddMacro) === targetWareId) {
      matchingMacro = state.lastSelectedAddMacro;
    } else {
      matchingMacro = getPrimaryMacroForWare(targetWareId);
    }
  }
  if (!matchingMacro) return;

  // 2. Adjust filters if they would hide this module
  let filtersModified = false;
  if (state.hideFoodAgriPlanned && isFoodOrAgriMacro(matchingMacro)) {
    state.hideFoodAgriPlanned = false;
    filtersModified = true;
    const chk = document.getElementById('chkHideFoodAgri');
    if (chk) chk.checked = false;
  }
  if (state.filterStructuresPlanned && isWareMacro(matchingMacro)) {
    state.filterStructuresPlanned = false;
    filtersModified = true;
    const chk = document.getElementById('chkFilterStructures');
    if (chk) chk.checked = false;
  }
  if (state.filterWaresPlanned && !isWareMacro(matchingMacro)) {
    state.filterWaresPlanned = false;
    filtersModified = true;
    const chk = document.getElementById('chkFilterWares');
    if (chk) chk.checked = false;
  }
  if (filtersModified) {
    filterPlannedModules();
  }

  // 3. Locate row in macro table
  const macroLower = matchingMacro.toLowerCase();
  let targetRow = document.querySelector(`.macro-table tbody tr.macro-row[data-macro="${macroLower}"]`);
  if (!targetRow) {
    targetRow = Array.from(document.querySelectorAll('.macro-table tbody tr.macro-row')).find(tr => {
      const m = tr.getAttribute('data-macro') || '';
      return m === macroLower || mapMacroToWare(m) === targetWareId;
    });
  }

  if (targetRow) {
    targetRow.style.display = '';

    document.querySelectorAll('.macro-table tr.macro-row-focused').forEach(r => r.classList.remove('macro-row-focused'));
    targetRow.classList.add('macro-row-focused');

    const doScrollAndFocus = () => {
      const tableContainer = targetRow.closest('.macro-table-container') || document.querySelector('.macro-table-container');
      if (tableContainer) {
        const thead = tableContainer.querySelector('thead');
        const theadHeight = thead ? thead.offsetHeight : 0;
        const availableHeight = tableContainer.clientHeight - theadHeight;
        tableContainer.scrollTop = Math.max(0, targetRow.offsetTop - theadHeight - (availableHeight / 2) + (targetRow.offsetHeight / 2));
      } else {
        targetRow.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
      const qtyInput = targetRow.querySelector('.macro-qty-input');
      if (qtyInput) {
        try {
          qtyInput.focus({ preventScroll: true });
          qtyInput.select();
        } catch (e) {
          qtyInput.focus();
        }
      }
    };

    doScrollAndFocus();
    requestAnimationFrame(doScrollAndFocus);
    setTimeout(doScrollAndFocus, 40);
    setTimeout(doScrollAndFocus, 120);

    if (!state.plannedScroll) state.plannedScroll = {};
    state.plannedScroll.lastFocusedMacro = targetRow.getAttribute('data-macro');
    state.plannedScroll.lastFocusedField = 'qty-input';
  } else {
    // Macro is not in the plan table: select and focus in dropdown only if no module is currently loaded,
    // or if the currently loaded module already corresponds to this ware.
    if (!state.lastSelectedAddMacro || mapMacroToWare(state.lastSelectedAddMacro) === targetWareId) {
      const addSelect = document.getElementById('addMacroSelect');
      if (addSelect) {
        let optionExists = Array.from(addSelect.options).some(o => o.value === matchingMacro);
        if (!optionExists) {
          let friendly = getFriendlyModuleName(matchingMacro, state.factionConstructionMethod);
          if (matchingMacro === 'prod_ter_scrap_recycler_macro' || matchingMacro === 'prod_ter_scraprecycler_macro') {
            friendly = 'Scrap Recycler (TER)';
          } else if (!isTerranFaction(state.factionConstructionMethod)) {
            if (matchingMacro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
          }
          const opt = document.createElement('option');
          opt.value = matchingMacro;
          opt.textContent = `${friendly} (${matchingMacro})`;
          addSelect.appendChild(opt);
        }
        addSelect.value = matchingMacro;
        state.lastSelectedAddMacro = addSelect.value;
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem('x4_last_selected_add_macro', addSelect.value);
          }
        } catch (e) {}

        const triggerText = document.getElementById('addMacroTriggerText');
        const trigger = document.getElementById('addMacroTrigger');
        if (triggerText) {
          if (addSelect.value) {
            let friendly = getFriendlyModuleName(addSelect.value, state.factionConstructionMethod);
            if (addSelect.value === 'prod_ter_scrap_recycler_macro' || addSelect.value === 'prod_ter_scraprecycler_macro') {
              friendly = 'Scrap Recycler (TER)';
            } else if (!isTerranFaction(state.factionConstructionMethod)) {
              if (addSelect.value === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
            }
            triggerText.textContent = `${friendly} (${addSelect.value})`;
            triggerText.style.color = '#38bdf8';
          } else {
            triggerText.textContent = `-- Select Station Module to Add --`;
            triggerText.style.color = '#94a3b8';
          }
        }
        if (trigger) {
          trigger.classList.add('macro-trigger-highlight');
          trigger.focus();
        }
      }
      const addGroup = document.getElementById('addMacroActionGroup');
      if (addGroup) {
        addGroup.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }
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
  if (activeMacroDropdownCleanup) {
    activeMacroDropdownCleanup();
    activeMacroDropdownCleanup = null;
  }
  containerEl = null;
}

let activeMacroDropdownCleanup = null;

/**
 * Sets up the searchable dropdown for Add Module with search retention.
 * Search criteria is retained across selections, additions, and re-renders until explicitly removed or re-entered.
 */
export function setupCumulativeMacroDropdown() {
  if (activeMacroDropdownCleanup) {
    activeMacroDropdownCleanup();
    activeMacroDropdownCleanup = null;
  }

  const wrapper = document.getElementById('addMacroComboboxWrapper');
  const trigger = document.getElementById('addMacroTrigger');
  const triggerText = document.getElementById('addMacroTriggerText');
  const select = document.getElementById('addMacroSelect');
  const menu = document.getElementById('addMacroMenu');
  const searchInput = document.getElementById('addMacroSearchInput');
  const searchText = document.getElementById('addMacroSearchText');
  const searchCount = document.getElementById('addMacroSearchCount');
  const clearSearchBtn = document.getElementById('addMacroClearSearchBtn');
  const optionsList = document.getElementById('addMacroOptionsList');

  if (!wrapper || !trigger || !select || !menu || !optionsList) return;

  let cumulativeQuery = state.addMacroSearchQuery || '';
  let isExpanded = false;
  let activeHighlightIndex = -1;

  function getBaseList() {
    const knownMacrosList = getKnownMacrosList();
    const globalQuery = (state.searchQuery || '').trim().toLowerCase();
    return globalQuery ? knownMacrosList.filter(m => matchesModuleQuery(m, globalQuery, { moduleNameOnly: false })) : knownMacrosList;
  }

  function updateTriggerLabel() {
    const rawVal = select.value || state.lastSelectedAddMacro || '';
    const currentVal = !isShipMacro(rawVal) ? rawVal : '';
    const effectiveQuery = (cumulativeQuery || state.addMacroSearchQuery || state.searchQuery || '').trim().toLowerCase();
    const baseList = getBaseList();
    const filteredCount = effectiveQuery
      ? baseList.filter(m => matchesModuleQuery(m, effectiveQuery, { moduleNameOnly: false })).length
      : baseList.length;

    if (!currentVal) {
      triggerText.textContent = `-- Select Station Module to Add ${effectiveQuery ? `(${filteredCount} found)` : ''} --`;
      triggerText.style.color = '#94a3b8';
    } else {
      let friendly = getFriendlyModuleName(currentVal, state.factionConstructionMethod);
      if (currentVal === 'prod_ter_scrap_recycler_macro' || currentVal === 'prod_ter_scraprecycler_macro') {
        friendly = 'Scrap Recycler (TER)';
      } else if (!isTerranFaction(state.factionConstructionMethod)) {
        if (currentVal === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
      }
      const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(currentVal, state.serverModules);
      triggerText.textContent = `${friendly} (${currentVal})`;
      triggerText.style.color = !isOwned ? '#ef4444' : '#fff';
    }
  }

  function renderOptions() {
    const baseList = getBaseList();
    const currentVal = select.value || state.lastSelectedAddMacro || '';
    const effectiveQuery = (cumulativeQuery || state.addMacroSearchQuery || '').trim().toLowerCase();
    const filtered = effectiveQuery
      ? baseList.filter(macro => matchesModuleQuery(macro, effectiveQuery, { moduleNameOnly: false }))
      : baseList;

    if (searchInput && searchInput.value !== cumulativeQuery) {
      searchInput.value = cumulativeQuery;
    }

    if (effectiveQuery) {
      if (searchText) searchText.textContent = `🔍 "${effectiveQuery}"`;
      if (searchCount) searchCount.textContent = `(${filtered.length} found)`;
      if (clearSearchBtn) clearSearchBtn.style.display = 'inline-flex';
    } else {
      if (searchText) searchText.textContent = 'Type to search...';
      const globalQuery = (state.searchQuery || '').trim().toLowerCase();
      if (searchCount) searchCount.textContent = `(${filtered.length} ${globalQuery ? 'matching' : 'available'})`;
      if (clearSearchBtn) clearSearchBtn.style.display = globalQuery ? 'inline-flex' : 'none';
    }

    if (filtered.length === 0) {
      optionsList.innerHTML = `<div class="custom-macro-no-match">No station modules match "${escapeHtml(effectiveQuery)}"</div>`;
      activeHighlightIndex = -1;
      return;
    }

    let html = '';
    if (!effectiveQuery) {
      const isNoneSelected = !currentVal;
      html += `
        <div class="custom-macro-option ${isNoneSelected ? 'selected' : ''}" data-value="" role="option" style="color:#94a3b8; font-style:italic;">
          <span class="custom-macro-option-name">-- Select Station Module to Add --</span>
          <span class="custom-macro-option-macro" style="color:#94a3b8; font-size:0.68rem; font-style:normal; font-family:var(--font-body, sans-serif); margin-left:auto; text-align:right; white-space:nowrap;">Name or Macro</span>
        </div>
      `;
    }

    filtered.forEach((macro, idx) => {
      let friendly = getFriendlyModuleName(macro, state.factionConstructionMethod);
      if (macro === 'prod_ter_scrap_recycler_macro' || macro === 'prod_ter_scraprecycler_macro') {
        friendly = 'Scrap Recycler (TER)';
      } else if (!isTerranFaction(state.factionConstructionMethod)) {
        if (macro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
      }
      const isSelected = (macro === currentVal);
      const isHighlighted = (idx === activeHighlightIndex);
      const isOwned = !state.serverModules ? true : isMacroBlueprintOwned(macro, state.serverModules);
      html += `
        <div class="custom-macro-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''} ${!isOwned ? 'macro-unowned' : ''}" data-value="${escapeHtml(macro)}" data-index="${idx}" role="option" style="${!isOwned ? 'color:#ef4444;' : ''}">
          <div style="display:flex; align-items:center; gap:0.4rem; overflow:hidden; min-width:0; flex:1;">
            <span class="custom-macro-option-name" style="${!isOwned ? 'color:#ef4444;' : ''}">${escapeHtml(friendly)}</span>
            <span class="custom-macro-option-macro" style="${!isOwned ? 'color:rgba(239,68,68,0.75);' : ''}">(${escapeHtml(macro)})</span>
          </div>
          ${!isOwned ? renderNotOwnedModuleTag(macro, { mini: true }) : ''}
        </div>
      `;
    });

    optionsList.innerHTML = html;

    const targetEl = optionsList.querySelector('.custom-macro-option.highlighted') || optionsList.querySelector('.custom-macro-option.selected');
    if (targetEl) {
      targetEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function highlightOptionByIndex(idx) {
    const options = optionsList.querySelectorAll('.custom-macro-option[data-index]');
    if (options.length === 0) return;
    activeHighlightIndex = Math.max(0, Math.min(idx, options.length - 1));
    options.forEach((opt, i) => {
      if (i === activeHighlightIndex) {
        opt.classList.add('highlighted');
        opt.scrollIntoView({ block: 'nearest' });
      } else {
        opt.classList.remove('highlighted');
      }
    });
  }

  function selectOption(macro) {
    if (macro) {
      let opt = Array.from(select.options).find(o => o.value === macro);
      if (!opt) {
        const newOpt = document.createElement('option');
        newOpt.value = macro;
        let friendly = getFriendlyModuleName(macro, state.factionConstructionMethod);
        if (macro === 'prod_ter_scrap_recycler_macro' || macro === 'prod_ter_scraprecycler_macro') {
          friendly = 'Scrap Recycler (TER)';
        } else if (!isTerranFaction(state.factionConstructionMethod)) {
          if (macro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
        }
        newOpt.textContent = `${friendly} (${macro})`;
        select.appendChild(newOpt);
      }
    }
    select.value = macro;
    state.lastSelectedAddMacro = macro || null;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (macro) sessionStorage.setItem('x4_last_selected_add_macro', macro);
        else sessionStorage.removeItem('x4_last_selected_add_macro');
      }
    } catch (e) {}
    updateTriggerLabel();
    select.dispatchEvent(new Event('change', { bubbles: true }));
    minimizeDropdown();
  }

  function expandDropdown() {
    if (isExpanded) return;
    isExpanded = true;
    cumulativeQuery = state.addMacroSearchQuery || '';
    activeHighlightIndex = -1;
    menu.style.display = 'flex';
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('active');
    const arrow = trigger.querySelector('.custom-macro-arrow');
    if (arrow) arrow.textContent = '▲';

    if (searchInput) {
      searchInput.value = cumulativeQuery;
      setTimeout(() => {
        try {
          searchInput.focus();
          if (cumulativeQuery) {
            searchInput.select();
          }
        } catch (e) {}
      }, 20);
    }

    const baseList = getBaseList();
    const rawVal = select.value || state.lastSelectedAddMacro;
    const currentVal = !isShipMacro(rawVal) ? rawVal : '';
    if (currentVal) {
      const idx = baseList.indexOf(currentVal);
      if (idx !== -1) activeHighlightIndex = idx;
    }
    renderOptions();
  }

  function minimizeDropdown() {
    if (!isExpanded) return;
    isExpanded = false;
    // Retain cumulativeQuery & state.addMacroSearchQuery until removed or re-entered!
    activeHighlightIndex = -1;
    menu.style.display = 'none';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('active');
    const arrow = trigger.querySelector('.custom-macro-arrow');
    if (arrow) arrow.textContent = '▼';
  }

  function handleTriggerClick(e) {
    e.stopPropagation();
    if (isExpanded) {
      minimizeDropdown();
    } else {
      expandDropdown();
    }
  }

  function handleClearSearch(e) {
    e.stopPropagation();
    cumulativeQuery = '';
    state.addMacroSearchQuery = '';
    if (searchInput) searchInput.value = '';
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('x4_add_macro_search_query');
      }
    } catch (err) {}
    if (state.searchQuery) {
      state.searchQuery = '';
      const topSearch = document.getElementById('searchInput');
      if (topSearch) topSearch.value = '';
      filterPlannedModules();
    }
    activeHighlightIndex = 0;
    renderOptions();
    updateTriggerLabel();
    if (searchInput) searchInput.focus();
  }

  function handleOptionsListClick(e) {
    const opt = e.target.closest('.custom-macro-option');
    if (!opt) return;
    e.stopPropagation();
    selectOption(opt.dataset.value || '');
  }

  function handleOptionsListMouseOver(e) {
    const opt = e.target.closest('.custom-macro-option[data-index]');
    if (opt) {
      const idx = parseInt(opt.dataset.index, 10);
      if (!isNaN(idx)) {
        activeHighlightIndex = idx;
        const options = optionsList.querySelectorAll('.custom-macro-option[data-index]');
        options.forEach((o, i) => {
          if (i === activeHighlightIndex) o.classList.add('highlighted');
          else o.classList.remove('highlighted');
        });
      }
    }
  }

  function handleDocumentClick(e) {
    if (isExpanded && !wrapper.contains(e.target)) {
      minimizeDropdown();
    }
  }

  function handleSearchInput(e) {
    e.stopPropagation();
    cumulativeQuery = e.target.value;
    state.addMacroSearchQuery = cumulativeQuery;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (cumulativeQuery) {
          sessionStorage.setItem('x4_add_macro_search_query', cumulativeQuery);
        } else {
          sessionStorage.removeItem('x4_add_macro_search_query');
        }
      }
    } catch (err) {}
    activeHighlightIndex = 0;
    renderOptions();
    updateTriggerLabel();
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const options = optionsList.querySelectorAll('.custom-macro-option[data-index]');
      if (options.length > 0) {
        const nextIdx = (activeHighlightIndex + 1) % options.length;
        highlightOptionByIndex(nextIdx);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const options = optionsList.querySelectorAll('.custom-macro-option[data-index]');
      if (options.length > 0) {
        const prevIdx = (activeHighlightIndex - 1 + options.length) % options.length;
        highlightOptionByIndex(prevIdx);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const highlighted = optionsList.querySelector('.custom-macro-option.highlighted') ||
                          optionsList.querySelector('.custom-macro-option[data-index="0"]');
      if (highlighted) {
        selectOption(highlighted.dataset.value || '');
      } else {
        minimizeDropdown();
      }
      trigger.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (cumulativeQuery) {
        cumulativeQuery = '';
        state.addMacroSearchQuery = '';
        if (searchInput) searchInput.value = '';
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem('x4_add_macro_search_query');
          }
        } catch (err) {}
        activeHighlightIndex = -1;
        renderOptions();
      } else {
        minimizeDropdown();
        trigger.focus();
      }
    }
  }

  function handleDocumentKeyDown(e) {
    if (!isExpanded) {
      if (document.activeElement === trigger) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          expandDropdown();
          return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          expandDropdown();
          cumulativeQuery += e.key;
          state.addMacroSearchQuery = cumulativeQuery;
          if (searchInput) searchInput.value = cumulativeQuery;
          try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              sessionStorage.setItem('x4_add_macro_search_query', cumulativeQuery);
            }
          } catch (err) {}
          activeHighlightIndex = 0;
          renderOptions();
          return;
        }
      }
      return;
    }

    // Dropdown IS expanded
    if (document.activeElement === searchInput) {
      if (e.key === 'Tab') {
        minimizeDropdown();
        trigger.focus();
        return;
      }
      return;
    }

    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      minimizeDropdown();
      trigger.focus();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      if (cumulativeQuery.length > 0) {
        cumulativeQuery = cumulativeQuery.slice(0, -1);
        state.addMacroSearchQuery = cumulativeQuery;
        if (searchInput) searchInput.value = cumulativeQuery;
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            if (cumulativeQuery) sessionStorage.setItem('x4_add_macro_search_query', cumulativeQuery);
            else sessionStorage.removeItem('x4_add_macro_search_query');
          }
        } catch (err) {}
        activeHighlightIndex = 0;
        renderOptions();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const options = optionsList.querySelectorAll('.custom-macro-option[data-index]');
      if (options.length > 0) {
        const nextIdx = (activeHighlightIndex + 1) % options.length;
        highlightOptionByIndex(nextIdx);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const options = optionsList.querySelectorAll('.custom-macro-option[data-index]');
      if (options.length > 0) {
        const prevIdx = (activeHighlightIndex - 1 + options.length) % options.length;
        highlightOptionByIndex(prevIdx);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const highlighted = optionsList.querySelector('.custom-macro-option.highlighted') ||
                          optionsList.querySelector('.custom-macro-option[data-index="0"]');
      if (highlighted) {
        selectOption(highlighted.dataset.value || '');
      } else {
        minimizeDropdown();
      }
      trigger.focus();
      return;
    }

    // Printable character: cumulative typing search
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      cumulativeQuery += e.key;
      state.addMacroSearchQuery = cumulativeQuery;
      if (searchInput) searchInput.value = cumulativeQuery;
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('x4_add_macro_search_query', cumulativeQuery);
        }
      } catch (err) {}
      activeHighlightIndex = 0;
      renderOptions();
      return;
    }
  }

  alignAddMacroDropdown();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(alignAddMacroDropdown);
  } else if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(alignAddMacroDropdown);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', alignAddMacroDropdown);
  }

  const tableContainer = document.querySelector('.macro-table-container');
  if (tableContainer) {
    tableContainer.addEventListener('scroll', alignAddMacroDropdown, { passive: true });
  }

  trigger.addEventListener('click', handleTriggerClick);
  if (clearSearchBtn) clearSearchBtn.addEventListener('click', handleClearSearch);
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeyDown);
    searchInput.addEventListener('click', (e) => e.stopPropagation());
  }
  optionsList.addEventListener('click', handleOptionsListClick);
  optionsList.addEventListener('mouseover', handleOptionsListMouseOver);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleDocumentKeyDown);

  // Synchronize select.value and state.lastSelectedAddMacro on initialization
  if (!select.value && state.lastSelectedAddMacro) {
    let opt = Array.from(select.options).find(o => o.value === state.lastSelectedAddMacro);
    if (!opt) {
      const newOpt = document.createElement('option');
      newOpt.value = state.lastSelectedAddMacro;
      let friendly = getFriendlyModuleName(state.lastSelectedAddMacro, state.factionConstructionMethod);
      if (state.lastSelectedAddMacro === 'prod_ter_scrap_recycler_macro' || state.lastSelectedAddMacro === 'prod_ter_scraprecycler_macro') {
        friendly = 'Scrap Recycler (TER)';
      } else if (!isTerranFaction(state.factionConstructionMethod)) {
        if (state.lastSelectedAddMacro === 'prod_gen_scrap_recycler_macro') friendly = 'Scrap Recycler (Hull Parts)';
      }
      newOpt.textContent = `${friendly} (${state.lastSelectedAddMacro})`;
      select.appendChild(newOpt);
    }
    select.value = state.lastSelectedAddMacro;
  } else if (select.value) {
    state.lastSelectedAddMacro = select.value;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('x4_last_selected_add_macro', select.value);
      }
    } catch (e) {}
  }
  updateTriggerLabel();

  activeMacroDropdownCleanup = () => {
    window.removeEventListener('resize', alignAddMacroDropdown);
    if (tableContainer) {
      tableContainer.removeEventListener('scroll', alignAddMacroDropdown);
    }
    trigger.removeEventListener('click', handleTriggerClick);
    if (clearSearchBtn) clearSearchBtn.removeEventListener('click', handleClearSearch);
    if (searchInput) {
      searchInput.removeEventListener('input', handleSearchInput);
      searchInput.removeEventListener('keydown', handleSearchKeyDown);
    }
    optionsList.removeEventListener('click', handleOptionsListClick);
    optionsList.removeEventListener('mouseover', handleOptionsListMouseOver);
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleDocumentKeyDown);
  };
}

/**
 * Aligns Planned header controls with table columns:
 * - "Select Station Module to Add" & "Add Module" btn is on the left aligned vertically with "Station Module Name" (Col 1)
 * - "Match Needs" checkbox is aligned vertically with "Quantity in Plan" (Col 3)
 */
export function alignAddMacroDropdown() {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
  const targetTh = document.querySelector('.macro-table th:nth-child(3)');
  const addMacroGroup = document.getElementById('addMacroActionGroup');
  const addMacroBox = document.querySelector('.add-macro-box');
  const matchNeedsWrapper = document.getElementById('chkMatchNeedsPlannedWrapper');
  const spacer = document.getElementById('matchNeedsAlignSpacer') || document.getElementById('addMacroAlignSpacer');

  if (!targetTh || !addMacroGroup || !addMacroBox || !matchNeedsWrapper || !spacer) return;

  const thRect = targetTh.getBoundingClientRect();
  const boxRect = addMacroBox.getBoundingClientRect();
  const groupRect = addMacroGroup.getBoundingClientRect();

  // If table is hidden or layout is not yet ready, default spacer to 0
  if (thRect.width === 0 || boxRect.width === 0) {
    spacer.style.width = '0px';
    return;
  }

  const gap = 6;
  const desiredSpacerWidth = Math.round(thRect.left - groupRect.right - gap);

  // Compute available space before hitting the right-side filter checkboxes to prevent overflow
  const filterBoxes = addMacroBox.querySelector('.planned-filter-checkboxes');
  const filterWidth = filterBoxes ? filterBoxes.offsetWidth : 360;
  const matchNeedsWidth = matchNeedsWrapper.offsetWidth || 120;
  const availableSpace = boxRect.width - (groupRect.right - boxRect.left) - matchNeedsWidth - filterWidth - 20;

  const safeSpacerWidth = Math.max(0, Math.min(desiredSpacerWidth, Math.max(0, availableSpace)));
  spacer.style.width = `${safeSpacerWidth}px`;
}

