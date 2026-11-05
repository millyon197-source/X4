// DOM event wiring for the budget panels and the inspector panel focus handling, extracted from
// matrixView.js (Stage 4, step 5). Behavior is unchanged.
import { state, store } from '../../state/store.js';
import {
  renderConstructionBudgetInspectorHTML,
  renderBuildNeedsBudgetInspectorHTML,
} from './budgetPanels.js';

/**
 * Refreshes both CRB and Needs budget panels in-place without disturbing scroll position.
 * @param {HTMLElement} container - Container element (#insBody)
 */
export function refreshBothBudgetPanels(container) {
  if (!container) return;
  const crbPanel = container.querySelector('.construction-budget-panel');
  if (crbPanel) {
    const tempCrb = document.createElement('div');
    tempCrb.innerHTML = renderConstructionBudgetInspectorHTML(state);
    const newCrb = tempCrb.firstElementChild;
    if (crbPanel.parentNode) {
      crbPanel.parentNode.replaceChild(newCrb, crbPanel);
      bindCrbListeners(newCrb);
    }
  }
  const nbPanel = container.querySelector('.needs-budget-panel');
  const tempNb = document.createElement('div');
  tempNb.innerHTML = renderBuildNeedsBudgetInspectorHTML(state);
  const newNb = tempNb.firstElementChild;

  if (nbPanel) {
    if (newNb) {
      if (nbPanel.parentNode) {
        nbPanel.parentNode.replaceChild(newNb, nbPanel);
        bindNeedsCrbListeners(newNb);
      }
    } else {
      nbPanel.remove();
    }
  } else if (newNb) {
    const crbPanel = container.querySelector('.construction-budget-panel');
    if (crbPanel && crbPanel.parentNode) {
      crbPanel.parentNode.insertBefore(newNb, crbPanel.nextSibling);
    } else {
      const ncBox = container.querySelector('.non-contributing-box');
      if (ncBox && ncBox.parentNode) {
        ncBox.parentNode.insertBefore(newNb, ncBox);
      } else {
        container.appendChild(newNb);
      }
    }
    bindNeedsCrbListeners(newNb);
  }
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
      header.title = `Click to ${isExpanded ? 'collapse' : 'expand'} Plan Construction Budget`;
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
        // In-place refresh of BOTH budget panels without refreshing the BI panel
        const insBody = panel.closest('#insBody');
        const curScroll = insBody ? insBody.scrollTop : null;

        if (insBody) {
          refreshBothBudgetPanels(insBody);
        }

        if (insBody && curScroll !== null) {
          insBody.scrollTop = curScroll;
        }
      }
    });
  });
}

/**
 * Attaches in-place interactive listeners to the Build Needs Construction Budget panel,
 * ensuring mode toggles, price tier switches, and collapse/expand do NOT cause a refresh of the BI panel.
 * @param {HTMLElement} panel - The .needs-budget-panel container
 */
export function bindNeedsCrbListeners(panel) {
  if (!panel) return;

  const header = panel.querySelector('.bp-nb-header');
  if (header) {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.btn-price-tier') || e.target.closest('.btn-needs-mode')) return;
      state.showNeedsConstructionBudget = !state.showNeedsConstructionBudget;
      if (store && typeof store.setShowNeedsConstructionBudget === 'function') {
        store.setShowNeedsConstructionBudget(state.showNeedsConstructionBudget);
      }

      const arrow = header.querySelector('.bp-nb-arrow');
      const body = panel.querySelector('.bp-nb-body');
      const preview = header.querySelector('.bp-nb-collapsed-preview');
      const controlsRow = header.querySelector('.bp-nb-controls-row');
      const isExpanded = state.showNeedsConstructionBudget;

      if (arrow) arrow.textContent = isExpanded ? '▼' : '▶';
      if (body) body.style.display = isExpanded ? 'block' : 'none';
      if (preview) preview.style.display = isExpanded ? 'none' : 'inline-block';
      if (controlsRow) controlsRow.style.display = isExpanded ? 'flex' : 'none';
      header.title = `Click to ${isExpanded ? 'collapse' : 'expand'} Build Needs Budget`;
    });
  }

  panel.querySelectorAll('.btn-needs-mode').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      const mode = btn.dataset.needsMode;
      if (mode && ['deficit', 'total'].includes(mode)) {
        state.needsBudgetMode = mode;
        if (store && typeof store.setNeedsBudgetMode === 'function') {
          store.setNeedsBudgetMode(mode);
        } else {
          try {
            localStorage.setItem('x4_needs_budget_mode', mode);
          } catch (err) {}
        }
        const insBody = panel.closest('#insBody');
        const curScroll = insBody ? insBody.scrollTop : null;

        const temp = document.createElement('div');
        temp.innerHTML = renderBuildNeedsBudgetInspectorHTML(state);
        const newPanel = temp.firstElementChild;
        if (panel.parentNode) {
          panel.parentNode.replaceChild(newPanel, panel);
          bindNeedsCrbListeners(newPanel);
        }

        if (insBody && curScroll !== null) {
          insBody.scrollTop = curScroll;
        }
      }
    });
  });

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
        // In-place refresh of BOTH budget panels without refreshing the BI panel
        const insBody = panel.closest('#insBody');
        const curScroll = insBody ? insBody.scrollTop : null;

        if (insBody) {
          refreshBothBudgetPanels(insBody);
        }

        if (insBody && curScroll !== null) {
          insBody.scrollTop = curScroll;
        }
      }
    });
  });
}

/**
 * Binds focus listeners to Blueprint Inspector (BI) panels.
 * Any selection of any panel in BI maintains the focus on that panel.
 * Any subsequent BI panel selection moves the focus to that panel.
 * Scrolling allows change of focus if outside the panel.
 */
export function bindBiPanelFocusListeners() {
  const insBody = document.getElementById('insBody');
  if (!insBody) return;

  if (!insBody._biFocusBound) {
    insBody._biFocusBound = true;

    // 1. Capture click on any BI panel (or inside it) to maintain or shift focus
    insBody.addEventListener('click', (e) => {
      const panel = e.target.closest('.bi-panel');
      if (!panel || !insBody.contains(panel)) return;
      const panelId = panel.dataset.biPanel;
      if (!panelId) return;

      if (state.focusedBiPanel !== panelId) {
        state.focusedBiPanel = panelId;
        insBody.querySelectorAll('.bi-panel').forEach(p => {
          p.classList.toggle('bi-panel-focused', p.dataset.biPanel === panelId);
        });
      }
    }, true);

    // 2. Wheel event: scrolling outside the focused panel allows change of focus
    insBody.addEventListener('wheel', (e) => {
      if (!state.focusedBiPanel) return;
      const curFocusedEl = insBody.querySelector(`.bi-panel[data-bi-panel="${state.focusedBiPanel}"]`);
      if (!curFocusedEl) return;

      const isInsideFocused = curFocusedEl.contains(e.target);
      if (!isInsideFocused) {
        const hoveredPanel = e.target.closest('.bi-panel');
        if (hoveredPanel && hoveredPanel.dataset.biPanel && hoveredPanel.dataset.biPanel !== state.focusedBiPanel) {
          state.focusedBiPanel = hoveredPanel.dataset.biPanel;
          insBody.querySelectorAll('.bi-panel').forEach(p => {
            p.classList.toggle('bi-panel-focused', p.dataset.biPanel === state.focusedBiPanel);
          });
        }
      }
    }, { passive: true });

    // 3. Scroll event on insBody:
    // If the focused panel scrolls outside the viewport, allow focus to change
    let scrollTicking = false;
    insBody.addEventListener('scroll', () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        const insRect = insBody.getBoundingClientRect();

        // If a panel is currently focused, check if it's still in view
        if (state.focusedBiPanel) {
          const curFocusedEl = insBody.querySelector(`.bi-panel[data-bi-panel="${state.focusedBiPanel}"]`);
          if (curFocusedEl) {
            const curRect = curFocusedEl.getBoundingClientRect();
            // Check if still visible within insBody viewport
            const isStillInside = (curRect.bottom > insRect.top + 5 && curRect.top < insRect.bottom - 5);
            if (isStillInside) {
              return; // Maintain focus on that panel
            }
          }
        }

        // Focused panel has scrolled OUTSIDE the view (or none focused) -> change focus to panel now in view
        const targetY = insRect.top + Math.min(100, insRect.height * 0.25);
        const allPanels = Array.from(insBody.querySelectorAll('.bi-panel'));
        let newPanel = null;

        for (const p of allPanels) {
          const r = p.getBoundingClientRect();
          if (r.top <= targetY && r.bottom >= insRect.top + 15) {
            newPanel = p;
            break;
          }
        }

        if (!newPanel && allPanels.length > 0) {
          newPanel = allPanels.find(p => {
            const r = p.getBoundingClientRect();
            return r.bottom > insRect.top && r.top < insRect.bottom;
          });
        }

        if (newPanel && newPanel.dataset.biPanel !== state.focusedBiPanel) {
          state.focusedBiPanel = newPanel.dataset.biPanel;
          allPanels.forEach(p => {
            p.classList.toggle('bi-panel-focused', p === newPanel);
          });
        }
      });
    }, { passive: true });
  }

  // Ensure current focused panel has the class applied
  if (state.focusedBiPanel) {
    insBody.querySelectorAll('.bi-panel').forEach(p => {
      p.classList.toggle('bi-panel-focused', p.dataset.biPanel === state.focusedBiPanel);
    });
  }
}
