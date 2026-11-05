// Construction-budget and build-needs panel builders extracted from matrixView.js (Stage 4, step 3).
// Pure functions of the state passed in; no DOM and no shared singleton.
import { WARES_DB, mapMacroToWare, isBlueprintTerran, isTerranFaction, getFriendlyModuleName } from '../../data/wares.js';
import { getPrimaryMacroForWare } from '../../engine/calculator.js';
import { calculateBuildCosts } from '../../engine/buildCost.js';
import { escapeHtml } from '../../html.js';
import { formatWareName } from './wareHelpers.js';

/**
 * Calculates modules required to satisfy station Needs.
 * @param {Object} currentState - Application state
 * @param {'deficit'|'total'} [mode='deficit'] - 'deficit' (+Δ additions) or 'total' (all needed modules)
 * @returns {Object} Module map { [macroOrWare]: count }
 */
export function getBuildNeedsModules(currentState, mode = 'deficit') {
  if (!currentState.activeBlueprint) return {};

  const liveDemand = currentState.calculatedDemand || (currentState.activeBlueprint && currentState.activeBlueprint.baselineDemand) || {};
  const liveLt = currentState.layerTotals || (currentState.activeBlueprint && currentState.activeBlueprint.baselineLayerTotals) || {};
  const inPlanModules = (currentState.activeBlueprint && currentState.activeBlueprint.modules) || {};
  const rawMacros = (currentState.activeBlueprint && currentState.activeBlueprint.rawMacros) || {};

  const modulesToBuild = {};

  // 1. Level 1 - 3 Production Wares
  Object.keys(WARES_DB).forEach(wId => {
    const ware = WARES_DB[wId];
    if (!ware) return;
    if (ware.level < 1 || ware.level > 3) return;
    if (wId === 'ScrapMetal' || wId === 'TerScrapMetal' || wId === 'ScrapProc' || wId === 'AllographyneScrapProc') return;

    const inPlan = inPlanModules[wId] || 0;
    const optimum = liveDemand[wId] ? (liveDemand[wId].modulesNeeded || 0) : 0;

    let targetCount = 0;
    if (mode === 'deficit') {
      targetCount = Math.max(0, optimum - inPlan);
    } else {
      targetCount = Math.max(inPlan, optimum);
    }

    if (targetCount > 0) {
      const bpMacro = Object.keys(rawMacros).find(m => {
        const lower = m.toLowerCase();
        if (lower.includes('scraprecycler') || lower.includes('scrap_recycler')) return false;
        return mapMacroToWare(m) === wId;
      });
      const macroKey = bpMacro || getPrimaryMacroForWare(wId) || wId;
      modulesToBuild[macroKey] = (modulesToBuild[macroKey] || 0) + targetCount;
    }
  });

  // 2. Solar Panels (EC and TerEC)
  const terLoaded = (liveLt.inPlanTerSolarCount || 0) > 0;
  const genLoaded = (liveLt.inPlanSolarCount || 0) > 0;
  const isTerran = currentState.activeBlueprint && (isBlueprintTerran(currentState.activeBlueprint) || isTerranFaction(currentState.factionConstructionMethod));
  const isPureTerranSolar = (terLoaded && !genLoaded) || (!terLoaded && !genLoaded && isTerran);

  if (isPureTerranSolar) {
    let terSolarCount = 0;
    if (mode === 'deficit') {
      terSolarCount = liveLt.terSolarModulesNeeded || 0;
    } else {
      terSolarCount = (liveLt.inPlanTerSolarCount || 0) + (liveLt.terSolarModulesNeeded || 0);
    }
    if (terSolarCount > 0) {
      const terSolarMacro = Object.keys(rawMacros).find(m => m.toLowerCase().includes('solar') && m.toLowerCase().includes('ter')) || 'prod_ter_energycells_macro';
      modulesToBuild[terSolarMacro] = (modulesToBuild[terSolarMacro] || 0) + terSolarCount;
    }
  } else {
    let solarCount = 0;
    if (mode === 'deficit') {
      solarCount = liveLt.solarModulesNeeded || 0;
    } else {
      solarCount = (liveLt.inPlanSolarCount || 0) + (liveLt.solarModulesNeeded || 0);
    }
    if (solarCount > 0) {
      const genSolarMacro = Object.keys(rawMacros).find(m => m.toLowerCase().includes('solar') && !m.toLowerCase().includes('ter')) || 'prod_gen_energycells_macro';
      modulesToBuild[genSolarMacro] = (modulesToBuild[genSolarMacro] || 0) + solarCount;
    }
  }

  // 3. Scrap Processors
  const scrapProcCalc = liveDemand['ScrapProc'];
  if (scrapProcCalc && scrapProcCalc.modulesNeeded > 0) {
    const inPlan = inPlanModules['ScrapProc'] || 0;
    const count = mode === 'deficit' ? Math.max(0, scrapProcCalc.modulesNeeded - inPlan) : Math.max(inPlan, scrapProcCalc.modulesNeeded);
    if (count > 0) {
      const procMacro = Object.keys(rawMacros).find(m => mapMacroToWare(m) === 'ScrapProc') || getPrimaryMacroForWare('ScrapProc') || 'ScrapProc';
      modulesToBuild[procMacro] = (modulesToBuild[procMacro] || 0) + count;
    }
  }

  const alloProcCalc = liveDemand['AllographyneScrapProc'];
  if (alloProcCalc && alloProcCalc.modulesNeeded > 0) {
    const inPlan = inPlanModules['AllographyneScrapProc'] || 0;
    const count = mode === 'deficit' ? Math.max(0, alloProcCalc.modulesNeeded - inPlan) : Math.max(inPlan, alloProcCalc.modulesNeeded);
    if (count > 0) {
      modulesToBuild['AllographyneScrapProc'] = (modulesToBuild['AllographyneScrapProc'] || 0) + count;
    }
  }

  // 4. Scrap Recyclers: ScrapClaytronics / ScrapHullParts
  ['ScrapClaytronics', 'ScrapHullParts'].forEach(sId => {
    const sCalc = liveDemand[sId];
    if (sCalc && sCalc.modulesNeeded > 0) {
      const inPlan = inPlanModules[sId] || 0;
      const count = mode === 'deficit' ? Math.max(0, sCalc.modulesNeeded - inPlan) : Math.max(inPlan, sCalc.modulesNeeded);
      if (count > 0) {
        const macro = Object.keys(rawMacros).find(m => m.toLowerCase().includes('scraprecycler') || m.toLowerCase().includes('scrap_recycler')) || 'prod_gen_scraprecycler_macro';
        modulesToBuild[macro] = (modulesToBuild[macro] || 0) + count;
      }
    }
  });

  return modulesToBuild;
}

/**
 * Renders the Construction Resource Budget card for the Blueprint Inspector sidebar.
 * @param {Object} currentState - Application state
 * @returns {string} HTML markup
 */
export function renderConstructionBudgetInspectorHTML(currentState) {
  const isExpanded = Boolean(currentState.showConstructionBudget);
  const currentPriceType = currentState.priceType || 'avg';
  const method = currentState.constructionMethod || currentState.factionConstructionMethod || 'commonwealth';
  const rawModules = (currentState.activeBlueprint?.rawMacros && Object.keys(currentState.activeBlueprint.rawMacros).length > 0)
    ? currentState.activeBlueprint.rawMacros
    : (currentState.modules && Object.keys(currentState.modules).length > 0)
      ? currentState.modules
      : ((currentState.activeBlueprint && (currentState.activeBlueprint.rawMacros || currentState.activeBlueprint.modules)) || {});

  let totalPlanModules = 0;
  let nonContributingPlanModules = 0;
  let contributingPlanModules = 0;

  Object.entries(rawModules).forEach(([macro, count]) => {
    const qty = typeof count === 'number' ? count : (parseInt(count, 10) || 0);
    if (qty > 0) {
      totalPlanModules += qty;
      if (mapMacroToWare(macro)) {
        contributingPlanModules += qty;
      } else {
        nonContributingPlanModules += qty;
      }
    }
  });

  const buildResult = calculateBuildCosts(rawModules, method, currentPriceType);
  const resourceEntries = Object.entries(buildResult.resources);

  if (resourceEntries.length === 0) {
    return `
      <div class="bp-level-panel construction-budget-panel bi-panel ${currentState.focusedBiPanel === 'construction-budget' ? 'bi-panel-focused' : ''}" data-bi-panel="construction-budget" style="border-color: rgba(56, 189, 248, 0.35); flex-shrink: 0; width: 100%; box-sizing: border-box; margin-top: 0.65rem; margin-bottom: 0;">
        <div class="bp-level-header bp-cb-header" style="background: rgba(15, 23, 42, 0.85); padding: 0.5rem 0.65rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; cursor:pointer;" title="Click to ${isExpanded ? 'collapse' : 'expand'} Plan Construction Budget">
          <div class="bp-level-title-group" style="display:flex; align-items:center; gap:6px;">
            <span class="bp-level-arrow bp-cb-arrow">${isExpanded ? '▼' : '▶'}</span>
            <span style="font-size:0.9rem;">💰</span>
            <strong style="color:#38bdf8; font-size:0.8rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em;">Plan Construction Budget</strong>
          </div>
          <div class="price-mode-toggles" style="display:flex; align-items:center; gap:0.2rem;">
            <button type="button" class="btn-price-tier ${currentPriceType === 'min' ? 'active' : ''}" data-price-tier="min" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'min' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'min' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'min' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Min</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'avg' ? 'active' : ''}" data-price-tier="avg" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'avg' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'avg' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'avg' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Avg</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'max' ? 'active' : ''}" data-price-tier="max" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'max' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'max' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'max' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Max</button>
          </div>
        </div>
        <div class="bp-cb-body" style="padding: 0.5rem 0.75rem; background: rgba(30, 41, 59, 0.4); display:${isExpanded ? 'block' : 'none'};">
          <p style="color:#94a3b8; font-style:italic; margin:0; font-size:0.75rem;">No construction resources required.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="bp-level-panel construction-budget-panel bi-panel ${currentState.focusedBiPanel === 'construction-budget' ? 'bi-panel-focused' : ''}" data-bi-panel="construction-budget" style="border-color: rgba(56, 189, 248, 0.35); flex-shrink: 0; width: 100%; box-sizing: border-box; margin-top: 0.65rem; margin-bottom: 0;">
      <div class="bp-level-header bp-cb-header" style="background: rgba(15, 23, 42, 0.85); padding: 0.5rem 0.65rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem; cursor:pointer;" title="Click to ${isExpanded ? 'collapse' : 'expand'} Plan Construction Budget">
        <div class="bp-level-title-group" style="display:flex; align-items:center; gap:6px;">
          <span class="bp-level-arrow bp-cb-arrow">${isExpanded ? '▼' : '▶'}</span>
          <span style="font-size:0.9rem;">💰</span>
          <strong style="color:#38bdf8; font-size:0.8rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em;">Plan Construction Budget</strong>
        </div>
        <div style="display:flex; align-items:center; gap:0.35rem;">
          <span class="bp-cb-collapsed-preview" style="font-size:0.72rem; color:#34d399; font-weight:700; font-family:monospace; background:rgba(52,211,153,0.1); padding:1px 6px; border-radius:3px; border:1px solid rgba(52,211,153,0.25); display:${isExpanded ? 'none' : 'inline-block'};" title="Total plan construction valuation">
            ${buildResult.totals.totalCredits.toLocaleString()} Cr
          </span>
          <div class="price-mode-toggles" style="display:flex; align-items:center; gap:0.2rem;">
            <button type="button" class="btn-price-tier ${currentPriceType === 'min' ? 'active' : ''}" data-price-tier="min" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'min' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'min' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'min' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Min</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'avg' ? 'active' : ''}" data-price-tier="avg" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'avg' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'avg' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'avg' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Avg</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'max' ? 'active' : ''}" data-price-tier="max" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'max' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'max' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'max' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Max</button>
          </div>
        </div>
      </div>
      <div class="bp-cb-body" style="padding: 0.5rem 0.75rem; background: rgba(30, 41, 59, 0.4); display:${isExpanded ? 'block' : 'none'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.35rem; padding-bottom: 0.3rem; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <span style="color:#94a3b8; font-size:0.72rem;">Total Plan Valuation (${currentPriceType.toUpperCase()}):</span>
          <strong style="color:#34d399; font-size:0.88rem; font-family:monospace;">${buildResult.totals.totalCredits.toLocaleString()} Cr</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.35rem; font-size:0.72rem;">
          <span style="color:#94a3b8;">Total Plan Construction Units:</span>
          <strong style="color:#38bdf8;">${buildResult.totals.totalWareUnits.toLocaleString()} units</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.45rem; font-size:0.72rem;">
          <span style="color:#94a3b8;">Budgeted Station Modules:</span>
          <strong style="color:#e2e8f0;">
            ${totalPlanModules.toLocaleString()} modules
            ${nonContributingPlanModules > 0 ? `<span style="font-size:0.68rem; font-weight:normal; color:#94a3b8;"> (${contributingPlanModules} ware, ${nonContributingPlanModules} non-contributing)</span>` : ''}
          </strong>
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
 * Renders the Build Needs Construction Budget card for the Blueprint Inspector sidebar.
 * Reflects budget and materials needed to build needs (deficit additions or total needs target).
 * @param {Object} currentState - Application state
 * @returns {string} HTML markup
 */
export function renderBuildNeedsBudgetInspectorHTML(currentState) {
  const isExpanded = Boolean(currentState.showNeedsConstructionBudget);
  const currentMode = currentState.needsBudgetMode || 'deficit'; // 'deficit' | 'total'
  const currentPriceType = currentState.priceType || 'avg';
  const method = currentState.constructionMethod || currentState.factionConstructionMethod || 'commonwealth';

  const neededModules = getBuildNeedsModules(currentState, currentMode);
  const buildResult = calculateBuildCosts(neededModules, method, currentPriceType);
  const resourceEntries = Object.entries(buildResult.resources);

  // Collect list of module names and counts to build
  const moduleEntries = Object.entries(neededModules).filter(([, count]) => count > 0);
  const totalNeededModulesCount = moduleEntries.reduce((sum, [, count]) => sum + count, 0);

  const modulePills = moduleEntries.map(([macroOrWare, count]) => {
    const wareId = mapMacroToWare(macroOrWare) || macroOrWare;
    const name = (WARES_DB[wareId] && WARES_DB[wareId].name) || getFriendlyModuleName(macroOrWare);
    const prefix = currentMode === 'deficit' ? '+' : '';
    const color = currentMode === 'deficit' ? '#fbbf24' : '#38bdf8';
    return `<span style="white-space:nowrap;"><strong style="color:${color};">${prefix}${count}x</strong> ${escapeHtml(name)}</span>`;
  });

  // If Build Needs Budget is 0, suppress display of panel
  if (buildResult.totals.totalCredits === 0 || resourceEntries.length === 0 || totalNeededModulesCount === 0) {
    if (currentState && currentState.focusedBiPanel === 'needs-budget') {
      currentState.focusedBiPanel = null;
    }
    return '';
  }

  const previewText = `${buildResult.totals.totalCredits.toLocaleString()} Cr`;

  return `
    <div class="bp-level-panel needs-budget-panel bi-panel ${currentState.focusedBiPanel === 'needs-budget' ? 'bi-panel-focused' : ''}" data-bi-panel="needs-budget" style="border-color: rgba(251, 191, 36, 0.4); flex-shrink: 0; width: 100%; box-sizing: border-box; margin-top: 0.65rem; margin-bottom: 0;">
      <div class="bp-level-header bp-nb-header" style="background: rgba(15, 23, 42, 0.85); padding: 0.45rem 0.65rem; display:flex; flex-direction:column; gap:0.35rem; cursor:pointer;" title="Click to ${isExpanded ? 'collapse' : 'expand'} Build Needs Budget">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div class="bp-level-title-group" style="display:flex; align-items:center; gap:6px;">
            <span class="bp-level-arrow bp-nb-arrow">${isExpanded ? '▼' : '▶'}</span>
            <span style="font-size:0.9rem;">🏗️</span>
            <strong style="color:#fbbf24; font-size:0.8rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em;">Build Needs Budget</strong>
          </div>
          <span class="bp-nb-collapsed-preview" style="font-size:0.72rem; color:#fbbf24; font-weight:700; font-family:monospace; background:rgba(251,191,36,0.1); padding:1px 6px; border-radius:3px; border:1px solid rgba(251,191,36,0.25); display:${isExpanded ? 'none' : 'inline-block'};" title="Budget to build needs">
            ${previewText}
          </span>
        </div>
        <div class="bp-nb-controls-row" style="display:${isExpanded ? 'flex' : 'none'}; justify-content:space-between; align-items:center; width:100%; gap:0.35rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.3rem;">
          <div class="needs-mode-toggles" style="display:flex; align-items:center; gap:0.25rem;">
            <button type="button" class="btn-needs-mode ${currentMode === 'deficit' ? 'active' : ''}" data-needs-mode="deficit" style="padding:0.15rem 0.45rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentMode === 'deficit' ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; background:${currentMode === 'deficit' ? 'rgba(251, 191, 36, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentMode === 'deficit' ? '#fbbf24' : '#cbd5e1'}; cursor:pointer; font-weight:700;" title="Show additional materials needed to satisfy current shortages (+Δ)">Deficit (+Δ)</button>
            <button type="button" class="btn-needs-mode ${currentMode === 'total' ? 'active' : ''}" data-needs-mode="total" style="padding:0.15rem 0.45rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentMode === 'total' ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; background:${currentMode === 'total' ? 'rgba(251, 191, 36, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentMode === 'total' ? '#fbbf24' : '#cbd5e1'}; cursor:pointer; font-weight:700;" title="Show total materials to build all needed modules">Total Needs</button>
          </div>
          <div class="price-mode-toggles" style="display:flex; align-items:center; gap:0.2rem;">
            <button type="button" class="btn-price-tier ${currentPriceType === 'min' ? 'active' : ''}" data-price-tier="min" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'min' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'min' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'min' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Min</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'avg' ? 'active' : ''}" data-price-tier="avg" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'avg' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'avg' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'avg' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Avg</button>
            <button type="button" class="btn-price-tier ${currentPriceType === 'max' ? 'active' : ''}" data-price-tier="max" style="padding:0.15rem 0.4rem; font-size:0.68rem; border-radius:3px; border:1px solid ${currentPriceType === 'max' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${currentPriceType === 'max' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.03)'}; color:${currentPriceType === 'max' ? '#38bdf8' : '#cbd5e1'}; cursor:pointer; font-weight:700;">Max</button>
          </div>
        </div>
      </div>
      <div class="bp-nb-body" style="padding: 0.5rem 0.75rem; background: rgba(30, 41, 59, 0.4); display:${isExpanded ? 'block' : 'none'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.35rem; padding-bottom: 0.3rem; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <span style="color:#94a3b8; font-size:0.72rem;">${currentMode === 'deficit' ? 'Deficit Build Valuation' : 'Total Needs Valuation'} (${currentPriceType.toUpperCase()}):</span>
          <strong style="color:#fbbf24; font-size:0.88rem; font-family:monospace;">${buildResult.totals.totalCredits.toLocaleString()} Cr</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.45rem; font-size:0.72rem;">
          <span style="color:#94a3b8;">${currentMode === 'deficit' ? 'Materials Needed to Build' : 'Total Needed Materials'}:</span>
          <strong style="color:#38bdf8;">${buildResult.totals.totalWareUnits.toLocaleString()} units</strong>
        </div>

        ${modulePills.length > 0 ? `
          <details style="margin-bottom:0.5rem; font-size:0.72rem; cursor:pointer;" ${modulePills.length <= 6 ? 'open' : ''}>
            <summary style="color:#fbbf24; user-select:none; font-weight:600; outline:none; margin-bottom:0.25rem;">
              🔍 ${currentMode === 'deficit' ? `Modules to Build (${totalNeededModulesCount} modules, ${modulePills.length} types)` : `Target Needed Modules (${totalNeededModulesCount} modules, ${modulePills.length} types)`}
            </summary>
            <div style="max-height:110px; overflow-y:auto; padding:0.3rem 0.45rem; background:rgba(0,0,0,0.25); border-radius:4px; line-height:1.5; border:1px solid rgba(255,255,255,0.04); color:#cbd5e1;">
              ${modulePills.join(', ')}
            </div>
          </details>
        ` : ''}

        <table class="bp-calc-table" style="width:100%; border-collapse:collapse; font-size:0.72rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color:#94a3b8;">
              <th style="text-align:left; padding:2px 0;">Material</th>
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
            <tr style="border-top: 1px solid rgba(251,191,36,0.35); font-weight:700;">
              <td style="text-align:left; padding:4px 0; color:#f8fafc;">Total</td>
              <td style="text-align:right; padding:4px 0; color:#38bdf8;">${buildResult.totals.totalWareUnits.toLocaleString()}</td>
              <td style="text-align:right; padding:4px 0; color:#94a3b8;">—</td>
              <td style="text-align:right; padding:4px 0; color:#fbbf24; font-family:monospace;">${buildResult.totals.totalCredits.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}
