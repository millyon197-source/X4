import { WARES_DB, FACTION_WARE_MAP, NO_PP_WARES } from '../../data/wares.js';
import { state, store } from '../../state/store.js';
import { getPPDownstreamWares } from '../../engine/calculator.js';
import { getSectorInfo } from '../../data/sectors.js';
import { escapeHtml } from '../../html.js';

export { FACTION_WARE_MAP, NO_PP_WARES };

import { SCRAP_WARE_IDS, getProductionMacroForWare, getDownstreamWares, formatWareName } from './wareHelpers.js';
import { isFactionWarePresentIn } from './factionVisibility.js';
import { updateInspector, updateModuleCountFromDiff } from './inspector.js';
import { createMatrixLifecycle } from './lifecycle.js';
import { renderLayerTotalsBanner } from './layerTotalsBanner.js';
import { computeWareCardView } from './wareCardView.js';
import { renderWareCard } from './wareCard.js';
export { updateInspector, updateModuleCountFromDiff };
import { refreshBothBudgetPanels, bindCrbListeners, bindNeedsCrbListeners, bindBiPanelFocusListeners } from './budgetBindings.js';
export { refreshBothBudgetPanels, bindCrbListeners, bindNeedsCrbListeners, bindBiPanelFocusListeners };
import { updateScrapWarningPill, alignSubdueLevel4, drawLines, highlightGraph, filterWares, getCenteredWareId, centerOnWare, selectWareWith } from './graph.js';
export { updateScrapWarningPill, alignSubdueLevel4, drawLines, highlightGraph, filterWares, getCenteredWareId, centerOnWare };
import { getBuildNeedsModules as getBuildNeedsModulesFor, renderConstructionBudgetInspectorHTML as renderConstructionBudgetFor, renderBuildNeedsBudgetInspectorHTML as renderBuildNeedsBudgetFor } from './budgetPanels.js';
export { SCRAP_WARE_IDS, getProductionMacroForWare, getDownstreamWares, formatWareName };


export function showNoBlueprintPopup() {
  const message = 'Add in Planned Modules first. After which you can change the output. Click Match Needs to populate support requirements.';

  if (typeof window !== 'undefined') {
    window.__lastPopupMessage = message;
    window.dispatchEvent(new CustomEvent('app-popup', { detail: { message } }));
  }

  if (typeof document === 'undefined') return;

  const existing = document.getElementById('noBlueprintPopupOverlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'noBlueprintPopupOverlay';
  overlay.className = 'no-bp-popup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="no-bp-popup-card" id="noBlueprintPopup">
      <div style="font-size:1.8rem; margin-bottom:0.35rem; line-height:1;">⚠️</div>
      <h3 style="margin:0 0 0.65rem 0; font-size:1.1rem; color:#38bdf8; font-weight:700;">Notice</h3>
      <p class="no-bp-popup-message" style="margin:0 0 1.3rem 0; font-size:0.92rem; line-height:1.55; color:#cbd5e1;">
        ${escapeHtml(message)}
      </p>
      <button type="button" id="btnNoBpPopupOk" class="btn-popup-ok" style="background:linear-gradient(135deg, #0284c7, #0369a1); border:1px solid #38bdf8; color:#fff; padding:0.45rem 1.6rem; border-radius:6px; font-weight:700; font-size:0.85rem; cursor:pointer; box-shadow:0 0 10px rgba(56,189,248,0.3); transition:all 0.15s ease;">
        OK
      </button>
    </div>
  `;

  const closePopup = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleKey);
  };

  const handleKey = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      closePopup();
    }
  };

  document.addEventListener('keydown', handleKey);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('#btnNoBpPopupOk')) {
      closePopup();
    }
  });

  document.body.appendChild(overlay);

  const okBtn = overlay.querySelector('#btnNoBpPopupOk');
  if (okBtn) okBtn.focus();
}

if (typeof window !== 'undefined') {
  window.showNoBlueprintPopup = showNoBlueprintPopup;
}


export function isFactionWarePresent(id, inPlanCount = 0, hasDemand = false) {
  return isFactionWarePresentIn(state, id, inPlanCount, hasDemand);
}


export function renderMatrixTabHTML() {
  const lt = state.layerTotals || {
    L1: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L2: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L3: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    totalECNeeded: 0,
    solarModulesNeeded: 0
  };

  const ppDownstreamWares = getPPDownstreamWares();
  const hasYellowLinkInitial = Boolean(state.selectedWareId) && SCRAP_WARE_IDS.has(state.selectedWareId);
  const selectedDownstreamWares = state.selectedWareId ? getDownstreamWares(state.selectedWareId) : null;

  const activeLevels = state.subdueLevel4 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  const colClass = state.subdueLevel4 ? 'cols-4' : 'cols-5';

  const isSectorSelected = Boolean(state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector));
  const activeSectorName = state.selectedSector || (state.activeBlueprint && state.activeBlueprint.sector) || null;
  const sectorInfo = activeSectorName ? getSectorInfo(activeSectorName) : null;
  const rawSectorName = sectorInfo ? sectorInfo.sector : (activeSectorName || 'No Sector Selected');

  return `
    <div class="main-wrapper">
      <div class="matrix-viewport" id="viewport">
        ${renderLayerTotalsBanner(state, { lt, colClass, isSectorSelected, activeSectorName, rawSectorName })}

        <svg class="svg-overlay" id="svgCanvas"></svg>

        <div class="matrix-grid ${colClass}" id="matrixGrid">
          ${activeLevels.map(level => {
            const levelWares = Object.keys(WARES_DB).filter(id => WARES_DB[id].level === level);
            const titles = ['Level 0: Raw', 'Level 1: Refined Goods', 'Level 2: Intermediates', 'Level 3: High-Tech', 'Level 4: Applications'];
            return `
              <div class="matrix-col col-${level}" data-level="${level}">
                <div class="col-badge">
                  <span>${titles[level]}</span>
                </div>
                ${levelWares.map(id => {
                  const view = computeWareCardView(state, id, { lt, ppDownstreamWares, selectedDownstreamWares });
                  return renderWareCard(state, id, view, { rawSectorName });
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
          <div class="inspector-title" style="flex:1; min-width:0; margin-right:0.5rem;">
            <h2 id="insTitle">${state.activeBlueprint ? 'Blueprint Inspector' : 'Module Inspector'}</h2>
            <span id="insSub">${state.activeBlueprint ? escapeHtml(state.activeBlueprint.name) : 'Station Blueprint'}</span>
          </div>
          <button class="btn-close" id="btnCloseIns">&times;</button>
        </div>
        <div class="inspector-body" id="insBody"></div>
      </aside>
    </div>
  `;
}






export function selectWare(id, onRender) {
  return selectWareWith(updateInspector, id, onRender);
}

/**
 * Renders the Construction Resource Budget card for the Blueprint Inspector sidebar.
 * @param {Object} [currentState=state] - Application state
 * @returns {string} HTML markup
 */
export function getBuildNeedsModules(currentState = state, mode = 'deficit') {
  return getBuildNeedsModulesFor(currentState, mode);
}


export function renderConstructionBudgetInspectorHTML(currentState = state) {
  return renderConstructionBudgetFor(currentState);
}

export function renderBuildNeedsBudgetInspectorHTML(currentState = state) {
  return renderBuildNeedsBudgetFor(currentState);
}

const lifecycle = createMatrixLifecycle(renderMatrixTabHTML);

/**
 * Initializes the Matrix View component and subscribes to state changes.
 * @param {HTMLElement} rootElement - Parent DOM container
 */
export function initMatrixView(rootElement) {
  return lifecycle.initMatrixView(rootElement);
}

/**
 * Cleans up DOM event listeners and store subscriptions upon tab switch.
 */
export function destroyMatrixView() {
  return lifecycle.destroyMatrixView();
}
