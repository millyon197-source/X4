// Event wiring for the blueprint overview, extracted from renderBlueprintOverview (Stage 4, step 9).
// deps carries the inspector functions this wiring calls back into (updateInspector and friends), passed in
// rather than imported so this file does not import inspector.js.
import { MACRO_TO_WARE, mapMacroToWare } from '../../data/wares.js';
import { applySupportWorkforce } from '../../engine/workforce.js';
import { applyMatchNeeds } from '../../engine/matchNeeds.js';
import { bindBiPanelFocusListeners, bindCrbListeners, bindNeedsCrbListeners } from './budgetBindings.js';
import { calculateFactoryRequirements, getPrimaryMacroForWare } from '../../engine/calculator.js';
import { rebuildBlueprintFromMacros } from '../../engine/xmlParser.js';
import { saveActiveBlueprintToStorage, state } from '../../state/store.js';
import { LEVEL_META } from './productionPanels.js';

export function bindBlueprintOverview(deps, id, onRender, insBody, prevInsScrollTop) {
  const { updateInspector, updateModuleCountFromDiff } = deps;
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
      } else if (wareId === 'TerScrapMetal' || ((wareId === 'TerCompSubstrate' || wareId === 'TerSilCarbide') && !state.activeBlueprint.rawMacros['prod_ter_computronicsubstrate_macro'] && !state.activeBlueprint.rawMacros['prod_ter_siliconcarbide_macro'])) {
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

  insBody.querySelectorAll('.needs-budget-panel').forEach(panel => {
    bindNeedsCrbListeners(panel);
  });

  insBody.querySelectorAll('.bp-wf-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('#lblSupportWorkforce') || e.target.closest('#chkSupportWorkforce')) return;
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
      header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} Planned vs Needed Module Differences`;
    });
  });

  insBody.querySelectorAll('.bp-unowned-header').forEach(header => {
    header.addEventListener('click', () => {
      state.unownedCollapsed = !state.unownedCollapsed;
      try {
        localStorage.setItem('x4_unowned_collapsed', String(state.unownedCollapsed));
      } catch (e) {}

      const panel = header.closest('.bp-unowned-panel');
      const arrow = header.querySelector('.bp-unowned-arrow');
      const body = panel ? panel.querySelector('.bp-unowned-body') : null;
      const isCollapsed = Boolean(state.unownedCollapsed);

      if (arrow) arrow.textContent = isCollapsed ? '▶' : '▼';
      if (body) body.style.display = isCollapsed ? 'none' : 'block';
      header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} Not Owned Blueprints`;
    });
  });

  insBody.querySelectorAll('.bp-diff-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const wareId = item.dataset.ware;
      const delta = parseInt(item.dataset.delta) || 0;
      updateModuleCountFromDiff(wareId, 'match', delta, onRender);
    });
  });

  insBody.querySelectorAll('.bp-diff-unowned-item[data-ware]').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const wareId = row.dataset.ware;
      if (wareId && typeof onRender === 'function') {
        state.selectedWareId = wareId;
        onRender();
      }
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
      header.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} ${LEVEL_META[lvl] ? LEVEL_META[lvl].title : 'Level ' + lvl}`;
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
    const preservedFocus = state.focusedBiPanel;
    const prevIns = document.getElementById('insBody');
    const curInsScroll = prevIns ? prevIns.scrollTop : 0;

    applyMatchNeeds(e.target.checked, onRender);

    if (preservedFocus) {
      state.focusedBiPanel = preservedFocus;
    }
    const newIns = document.getElementById('insBody');
    if (newIns && curInsScroll > 0) {
      newIns.scrollTop = curInsScroll;
    }
    bindBiPanelFocusListeners();
  };

  const chkSyncOptimum = document.getElementById('chkSyncOptimum');
  if (chkSyncOptimum) chkSyncOptimum.addEventListener('change', handleSyncOptimum);

  const handleSubdueEcCalc = (e) => {
    state.subdueEcCalc = e.target.checked;
    const preservedFocus = state.focusedBiPanel;
    const prevIns = document.getElementById('insBody');
    const curInsScroll = prevIns ? prevIns.scrollTop : 0;

    if (typeof onRender === 'function') {
      onRender();
    }

    if (preservedFocus) {
      state.focusedBiPanel = preservedFocus;
    }
    const newIns = document.getElementById('insBody');
    if (newIns && curInsScroll > 0) {
      newIns.scrollTop = curInsScroll;
    }
    bindBiPanelFocusListeners();
  };

  const chkSubdueEcCalc = document.getElementById('chkSubdueEcCalc');
  if (chkSubdueEcCalc) chkSubdueEcCalc.addEventListener('change', handleSubdueEcCalc);

  const handleSupportWorkforce = (e) => {
    e.stopPropagation();
    const preservedFocus = state.focusedBiPanel || 'workforce-summary';
    const prevIns = document.getElementById('insBody');
    const curInsScroll = prevIns ? prevIns.scrollTop : 0;

    applySupportWorkforce(e.target.checked, onRender);

    if (preservedFocus) {
      state.focusedBiPanel = preservedFocus;
    }
    const newIns = document.getElementById('insBody');
    if (newIns && curInsScroll > 0) {
      newIns.scrollTop = curInsScroll;
    }
    bindBiPanelFocusListeners();
  };

  const chkSupportWorkforce = document.getElementById('chkSupportWorkforce');
  if (chkSupportWorkforce) chkSupportWorkforce.addEventListener('change', handleSupportWorkforce);

  if (prevInsScrollTop > 0) {
    insBody.scrollTop = prevInsScrollTop;
  }

  bindBiPanelFocusListeners();
}
