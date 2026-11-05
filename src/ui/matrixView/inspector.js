// Inspector rendering extracted from matrixView.js (Stage 4, step 6): the blueprint overview,
// the empty state and the ware detail panel, plus the diff-list module-count updates.
// updateInspector and updateModuleCountFromDiff call each other, so they live together here.
import { MACRO_TO_WARE, WARES_DB, getWareCycleTimeSec, getWareOutputPerCycle, isBlueprintTerran, isTerranFaction, mapMacroToWare } from '../../data/wares.js';
import { getMatchNeedsStatus } from '../../engine/matchNeeds.js';
import { bindBiPanelFocusListeners, bindCrbListeners } from './budgetBindings.js';
import { calculateFactoryRequirements, getPrimaryMacroForWare, getScrapRecyclerCycleYield } from '../../engine/calculator.js';
import { getSolarDynamicCycles } from '../../data/sectors.js';
import { escapeHtml } from '../../html.js';
import { rebuildBlueprintFromMacros } from '../../engine/xmlParser.js';
import { saveActiveBlueprintToStorage, state, store } from '../../state/store.js';
import { selectWareWith } from './graph.js';
import { buildSortedProductionEntries, gatherNonContributing, gatherUnownedModules } from './blueprintGroups.js';
import { renderProductionLevelPanel } from './productionPanels.js';
import { bindBlueprintOverview } from './overviewBindings.js';
import { bindWareInspector } from './wareInspectorBindings.js';
import { renderConsumersPanel, renderUpstreamRows, renderWareInspectorBody } from './wareInspectorPanels.js';
import { computeWareConsumers, computeWareProduction, computeWareUpstreamDemand } from './wareInspectorData.js';
import { renderModuleDiffPanel, renderNonContributingPanel, renderRawMiningPanel, renderUnownedPanel } from './overviewPanels.js';
import { buildWorkforceView, renderWorkforcePanel } from './workforcePanel.js';
import { renderConstructionBudgetInspectorHTML, renderBuildNeedsBudgetInspectorHTML } from './budgetPanels.js';

function selectWare(id, onRender) {
  return selectWareWith(updateInspector, id, onRender);
}

export function updateModuleCountFromDiff(wareId, action, delta, onRender) {
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

  let currentPlan = 0;
  if (wareId === 'EC' || wareId === 'TerEC') {
    const liveLt = state.layerTotals || (state.activeBlueprint && state.activeBlueprint.baselineLayerTotals) || {};
    currentPlan = wareId === 'TerEC' ? (liveLt.inPlanTerSolarCount || 0) : (liveLt.inPlanSolarCount || 0);
  } else {
    currentPlan = (state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
  }

  let newQty = currentPlan;
  if (action === 'plus') {
    newQty = currentPlan + 1;
  } else if (action === 'minus') {
    newQty = Math.max(0, currentPlan - 1);
  } else {
    // action === 'match'
    newQty = Math.max(0, currentPlan + delta);
  }

  if (wareId === 'EC' || wareId === 'TerEC') {
    const isTerran = wareId === 'TerEC' || (state.activeBlueprint && (isBlueprintTerran(state.activeBlueprint) || isTerranFaction(state.factionConstructionMethod)));
    let macroKey = Object.keys(state.activeBlueprint.rawMacros).find(m => mapMacroToWare(m) === wareId);
    if (!macroKey) {
      macroKey = isTerran ? 'prod_ter_energycells_macro' : 'prod_gen_energycells_macro';
    }
    if (newQty <= 0) {
      delete state.activeBlueprint.rawMacros[macroKey];
      if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
      delete state.activeBlueprint.modules[wareId];
    } else {
      state.activeBlueprint.rawMacros[macroKey] = newQty;
      if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = newQty;
      state.activeBlueprint.modules[wareId] = newQty;
    }
  } else if (wareId === 'ScrapMetal' || wareId === 'ScrapHullParts' || wareId === 'ScrapClaytronics') {
    let macroKey = (state.activeBlueprint.rawMacros && state.activeBlueprint.rawMacros['prod_gen_scraprecycler_macro'] !== undefined)
      ? 'prod_gen_scraprecycler_macro'
      : 'prod_gen_scrap_recycler_macro';
    if (newQty <= 0) {
      delete state.activeBlueprint.modules[wareId];
      const otherId = wareId === 'ScrapHullParts' ? 'ScrapClaytronics' : 'ScrapHullParts';
      const otherQty = state.activeBlueprint.modules[otherId] || 0;
      if (otherQty <= 0) {
        delete state.activeBlueprint.modules['ScrapMetal'];
        delete state.activeBlueprint.rawMacros[macroKey];
        if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
      } else {
        state.activeBlueprint.modules['ScrapMetal'] = otherQty;
        state.activeBlueprint.rawMacros[macroKey] = otherQty;
        if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = otherQty;
      }
    } else {
      state.activeBlueprint.modules[wareId] = newQty;
      const otherId = wareId === 'ScrapHullParts' ? 'ScrapClaytronics' : 'ScrapHullParts';
      const maxScrap = Math.max(newQty, state.activeBlueprint.modules[otherId] || 0);
      state.activeBlueprint.modules['ScrapMetal'] = maxScrap;
      state.activeBlueprint.rawMacros[macroKey] = maxScrap;
      if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = maxScrap;
    }
  } else if (wareId === 'TerScrapMetal' || ((wareId === 'TerCompSubstrate' || wareId === 'TerSilCarbide') && !state.activeBlueprint.rawMacros['prod_ter_computronicsubstrate_macro'] && !state.activeBlueprint.rawMacros['prod_ter_siliconcarbide_macro'] && (state.activeBlueprint.rawMacros['prod_ter_scraprecycler_macro'] || state.activeBlueprint.rawMacros['prod_ter_scrap_recycler_macro']))) {
    let macroKey = (state.activeBlueprint.rawMacros && state.activeBlueprint.rawMacros['prod_ter_scraprecycler_macro'] !== undefined)
      ? 'prod_ter_scraprecycler_macro'
      : 'prod_ter_scrap_recycler_macro';
    if (newQty <= 0) {
      delete state.activeBlueprint.modules[wareId];
      const otherId = wareId === 'TerCompSubstrate' ? 'TerSilCarbide' : 'TerCompSubstrate';
      const otherQty = state.activeBlueprint.modules[otherId] || 0;
      if (otherQty <= 0) {
        delete state.activeBlueprint.modules['TerScrapMetal'];
        delete state.activeBlueprint.rawMacros[macroKey];
        if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[macroKey];
      } else {
        state.activeBlueprint.modules['TerScrapMetal'] = otherQty;
        state.activeBlueprint.rawMacros[macroKey] = otherQty;
        if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = otherQty;
      }
    } else {
      state.activeBlueprint.modules[wareId] = newQty;
      const otherId = wareId === 'TerCompSubstrate' ? 'TerSilCarbide' : 'TerCompSubstrate';
      const maxScrap = Math.max(newQty, state.activeBlueprint.modules[otherId] || 0);
      state.activeBlueprint.modules['TerScrapMetal'] = maxScrap;
      state.activeBlueprint.rawMacros[macroKey] = maxScrap;
      if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[macroKey] = maxScrap;
    }
  } else {
    const matchingMacros = Object.keys(state.activeBlueprint.rawMacros).filter(m => {
      const lower = m.toLowerCase();
      if (lower.includes('scraprecycler') || lower.includes('scrap_recycler')) return false;
      return mapMacroToWare(m) === wareId;
    });

    let primaryMacro = matchingMacros[0];
    if (wareId === 'ScrapProc') {
      primaryMacro = getPrimaryMacroForWare('ScrapProc');
    } else if (!primaryMacro) {
      primaryMacro = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wareId);
    }
    if (!primaryMacro) {
      primaryMacro = getPrimaryMacroForWare(wareId);
    }
    if (!primaryMacro) {
      primaryMacro = `prod_gen_${wareId.toLowerCase()}_macro`;
    }

    matchingMacros.forEach(m => {
      if (m !== primaryMacro) {
        delete state.activeBlueprint.rawMacros[m];
        if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[m];
      }
    });

    if (newQty <= 0) {
      delete state.activeBlueprint.rawMacros[primaryMacro];
      if (state.activeBlueprint.rootMacros) delete state.activeBlueprint.rootMacros[primaryMacro];
      delete state.activeBlueprint.modules[wareId];
    } else {
      state.activeBlueprint.rawMacros[primaryMacro] = newQty;
      if (state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros[primaryMacro] = newQty;
      state.activeBlueprint.modules[wareId] = newQty;
    }
  }

  delete state.activeBlueprint.modules['RawScrap'];

  rebuildBlueprintFromMacros();
  saveActiveBlueprintToStorage();
  calculateFactoryRequirements();
  store.notify('BLUEPRINT_UPDATED');

  const preservedFocus = state.focusedBiPanel || 'module-diff';
  const prevIns = document.getElementById('insBody');
  const curInsScroll = prevIns ? prevIns.scrollTop : 0;

  if (typeof onRender === 'function') {
    onRender();
  } else if (typeof window.renderApp === 'function') {
    window.renderApp();
  } else {
    updateInspector(null, onRender);
  }

  if (preservedFocus) {
    state.focusedBiPanel = preservedFocus;
  }
  const newIns = document.getElementById('insBody');
  if (newIns && curInsScroll > 0) {
    newIns.scrollTop = curInsScroll;
  }
  bindBiPanelFocusListeners();
}

// CASE 2 view: no active blueprint loaded & no card selected
function renderEmptyInspector(insTitle, insSub, insBody, prevInsScrollTop) {
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

  bindBiPanelFocusListeners();
}

// CASE 3 view: a specific card is selected (including Level 4 components)
function renderWareInspector(id, onRender, insTitle, insSub, insBody, prevInsScrollTop) {
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

  const { activeDemand, totalRaw, ecTotal } = computeWareUpstreamDemand(state, id, ware, effectiveCount);

  const isLevel4Target = ware.level === 4;
  const upstreamRows = renderUpstreamRows(state, id, ware, activeDemand);

  const { consumers, totalBpConsumption, totalOptimumConsumption, isInspectorOutputSuppressed } = computeWareConsumers(state, id, ware);

  const { currentProd, netBpBalance, rangeTag } = computeWareProduction(state, id, ware, inPlanCount, totalBpConsumption, isInspectorOutputSuppressed);

  const consumersHtml = renderConsumersPanel(state, id, { consumers, rangeTag, totalBpConsumption, totalOptimumConsumption, inPlanCount, currentProd, netBpBalance });

  insBody.innerHTML = renderWareInspectorBody(state, id, ware, { effectiveCount, totalRaw, ecTotal, upstreamRows, isLevel4Target, consumersHtml });

  bindWareInspector({ updateInspector, selectWare }, id, insBody, prevInsScrollTop);
}

// CASE 1 view: active blueprint loaded & no specific card selected
function renderBlueprintOverview(id, onRender, insTitle, insSub, insBody, prevInsScrollTop) {
  const liveDemand = state.calculatedDemand || (state.activeBlueprint && state.activeBlueprint.baselineDemand) || {};
  const liveLt = state.layerTotals || (state.activeBlueprint && state.activeBlueprint.baselineLayerTotals) || { totalECNeeded: 0, solarModulesNeeded: 0 };

  // Gather all card modules where needed module count is not equal to plan count
  const diffList = [];
  let hasExceeded = false;
  let hasDeficit = false;

  const renderDiffItem = (wareId, wareName, inPlan, optimum, diff, isSolar = false) => {
    const diffSign = diff > 0 ? '+' : '';
    const diffColor = diff > 0 ? '#f87171' : '#38bdf8';
    const asterisk = inPlan > optimum ? '<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : '';
    const actionText = diff > 0 ? `add ${diff}x` : `remove ${Math.abs(diff)}x`;
    const matchTitle = isSolar
      ? `Click to add ${diffSign}${diff}x ${escapeHtml(wareName)} to Plan (Plan: ${inPlan}x ➔ Needs: ${optimum}x)`
      : `Click to ${actionText} ${escapeHtml(wareName)} (Plan: ${inPlan}x ➔ Needs: ${optimum}x)`;

    return `<span class="bp-diff-item" data-ware="${wareId}" data-delta="${diff}" data-plan="${inPlan}" data-optimum="${optimum}" style="white-space:nowrap; cursor:pointer; padding:1px 5px; border-radius:3px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); user-select:none; display:inline-block; margin:1px 0; transition:all 0.15s ease;" title="${matchTitle}"><strong style="color:${diffColor}; font-weight:700;">${diffSign}${diff}x</strong> <span style="color:#cbd5e1;">${escapeHtml(wareName)}</span>${asterisk}</span>`;
  };

  const smInPlan = (state.activeBlueprint && state.activeBlueprint.modules && ((state.activeBlueprint.modules['ScrapMetal'] || 0) + (state.activeBlueprint.modules['TerScrapMetal'] || 0) + (state.activeBlueprint.modules['ScrapProc'] || 0))) || 0;
  const smCalc = state.calculatedDemand && (state.calculatedDemand['ScrapMetal'] || state.calculatedDemand['TerScrapMetal'] || state.calculatedDemand['ScrapProc']);
  const smOutputNonZero = smInPlan > 0 || (smCalc && (smCalc.rateNeeded > 0 || smCalc.modulesNeeded > 0)) || (state.selectedWareId === 'ScrapMetal' || state.selectedWareId === 'TerScrapMetal' || state.selectedWareId === 'ScrapProc' || state.selectedWareId === 'RawScrap');

  Object.keys(WARES_DB).forEach(wId => {
    const ware = WARES_DB[wId];
    if (ware.level === 0 && wId !== 'EC' && wId !== 'TerEC') return;
    if (ware.level === 4) return;
    if (wId === 'ScrapMetal' || wId === 'TerScrapMetal' || wId === 'ScrapProc' || wId === 'AllographyneScrapProc') return;

    if (wId === 'EC' || wId === 'TerEC') {
      const terLoaded = (liveLt.inPlanTerSolarCount || 0) > 0;
      const genLoaded = (liveLt.inPlanSolarCount || 0) > 0;
      const isTerran = state.activeBlueprint && (isBlueprintTerran(state.activeBlueprint) || isTerranFaction(state.factionConstructionMethod));
      const isPureTerranSolar = (terLoaded && !genLoaded) || (!terLoaded && !genLoaded && isTerran);

      if (wId === 'TerEC') {
        if (isPureTerranSolar && (liveLt.terSolarModulesNeeded || 0) > 0) {
          const needed = liveLt.terSolarModulesNeeded;
          const inPlan = liveLt.inPlanTerSolarCount || 0;
          diffList.push(renderDiffItem('TerEC', ware.name, inPlan, inPlan + needed, needed, true));
        }
      } else if (wId === 'EC') {
        if (!isPureTerranSolar && (liveLt.solarModulesNeeded || 0) > 0) {
          const needed = liveLt.solarModulesNeeded;
          const inPlan = liveLt.inPlanSolarCount || 0;
          diffList.push(renderDiffItem('EC', ware.name, inPlan, inPlan + needed, needed, true));
        }
      }
      return;
    }

    let inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wId]) || 0;
    let optimum = liveDemand[wId] ? (liveDemand[wId].modulesNeeded || 0) : 0;

    if (inPlan > optimum) {
      hasExceeded = true;
    } else if (inPlan < optimum) {
      hasDeficit = true;
    }

    if (inPlan !== optimum && (inPlan > 0 || optimum > 0)) {
      const diff = optimum - inPlan;
      diffList.push(renderDiffItem(wId, ware.name, inPlan, optimum, diff, false));
    }
  });

  // Plan >= Needs counts as matching Needs; unchecked only when there is a deficit
  const { isAllSynced, matchNeedsLabel, matchNeedsTitle } = getMatchNeedsStatus();

  insTitle.innerText = 'Blueprint Inspector';
  insSub.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; flex-wrap:wrap; margin-top:0.15rem; width:100%;">
        <span style="color:#94a3b8; font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(state.activeBlueprint.name)}">${escapeHtml(state.activeBlueprint.name)}</span>
        <div style="display:inline-flex; align-items:center; gap:0.35rem; margin-left:auto; flex-shrink:0;">
          <label id="lblMatchNeeds" style="font-size:0.72rem; color:#38bdf8; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px; background:rgba(56,189,248,0.15); padding:0.15rem 0.45rem; border-radius:4px; border:1px solid rgba(56,189,248,0.35); user-select:none; white-space:nowrap;" title="${matchNeedsTitle}">
            <input type="checkbox" id="chkSyncOptimum" ${isAllSynced ? 'checked' : ''} style="cursor:pointer;" />
            ${matchNeedsLabel}
          </label>
          <label id="lblSubdueEcCalc" style="font-size:0.72rem; color:#fbbf24; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px; background:rgba(245,158,11,0.15); padding:0.15rem 0.45rem; border-radius:4px; border:1px solid rgba(245,158,11,0.35); user-select:none; white-space:nowrap;" title="When checked, hides the EC consumption badges on all ware cards">
            <input type="checkbox" id="chkSubdueEcCalc" ${state.subdueEcCalc ? 'checked' : ''} style="cursor:pointer;" />
            Subdue EC Calc
          </label>
        </div>
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

  const sortedEntries = buildSortedProductionEntries(state, liveDemand, smOutputNonZero);

  // Gather all unowned modules in current blueprint
  const { unownedModules, totalUnownedCount } = gatherUnownedModules(state);

  // Gather all non-contributing ware modules
  const { nonContributingMap, totalNonContributingCount } = gatherNonContributing(state);

  const productionEntries = sortedEntries.filter(([wId]) => WARES_DB[wId] && WARES_DB[wId].level < 4);

  const workforceView = buildWorkforceView(state);

  insBody.innerHTML = `
      ${renderRawMiningPanel(state, totalRaw, ecTotal)}

      ${renderWorkforcePanel(state, workforceView)}

      <div style="margin-top:0.6rem;">
        <div class="section-label">All Plan Modules & Recalculated Upstream Chains</div>
        ${[1, 2, 3].map(lvl => renderProductionLevelPanel(state, lvl, productionEntries)).join('')}
      </div>

      ${renderModuleDiffPanel(state, diffList)}

      ${renderUnownedPanel(state, unownedModules, totalUnownedCount)}

      ${renderConstructionBudgetInspectorHTML(state)}

      ${renderBuildNeedsBudgetInspectorHTML(state)}

      ${renderNonContributingPanel(state, nonContributingMap, totalNonContributingCount)}
    `;

  bindBlueprintOverview({ updateInspector, updateModuleCountFromDiff }, id, onRender, insBody, prevInsScrollTop);
}

export function updateInspector(id, onRender) {
  const insTitle = document.getElementById('insTitle');
  const insSub = document.getElementById('insSub');
  const insBody = document.getElementById('insBody');


  if (!insTitle || !insSub || !insBody) return;

  const prevInsScrollTop = insBody.scrollTop;

  // CASE 1: Active Blueprint loaded & no specific card selected
  if (state.activeBlueprint && !id) {
    renderBlueprintOverview(id, onRender, insTitle, insSub, insBody, prevInsScrollTop);
    return;
  }

  // CASE 2: No active blueprint loaded & no card selected
  if (!id || !WARES_DB[id]) {
    renderEmptyInspector(insTitle, insSub, insBody, prevInsScrollTop);
    return;
  }

  // CASE 3: A specific card is selected (including Level 4 components)
  renderWareInspector(id, onRender, insTitle, insSub, insBody, prevInsScrollTop);
}
