import './style.css';
import { PRESET_BLUEPRINTS, mapMacroToWare, WARES_DB } from './data/wares.js';
import { state, store, saveActiveBlueprintToStorage, isHostedMode, clearBlueprintInternalStorage, collapseAllBiComponents } from './state/store.js';
import { calculateFactoryRequirements, syncPopulatedMatrix, getPrimaryMacroForWare } from './engine/calculator.js';
import { parseXMLBlueprint, removeActiveBlueprint, rebuildBlueprintFromMacros, reloadActiveBlueprint, switchLoadedBlueprint, removeLoadedBlueprint } from './engine/xmlParser.js';
import { renderMatrixTabHTML, drawLines, highlightGraph, filterWares, selectWare, updateInspector, centerOnWare, getCenteredWareId } from './ui/matrixView.js';
import { renderPlannedTabHTML, filterPlannedModules } from './ui/plannedView.js';
import { version as appVersion } from '../package.json';
import { escapeHtml } from './html.js';

if (typeof window !== 'undefined') {
  window.state = state;
  window.store = store;
  window.WARES_DB = WARES_DB;
  window.calculateFactoryRequirements = calculateFactoryRequirements;
  window.renderMatrixTabHTML = renderMatrixTabHTML;
  window.updateInspector = updateInspector;
  window.isHostedMode = isHostedMode;
  window.clearBlueprintInternalStorage = clearBlueprintInternalStorage;
  try {
    if (typeof __IS_HOSTED__ !== 'undefined') {
      window.__IS_HOSTED__ = Boolean(__IS_HOSTED__);
    }
  } catch (e) {}

  // Subscribe UI to reactive state changes from StationStore
  store.subscribe(() => {
    if (typeof renderApp === 'function') {
      renderApp();
    }
  });
}

if (isHostedMode()) {
  console.log("This build/server was explicitly started with hosted mode enabled (__IS_HOSTED__ = true). Multiple blueprints internal storage is disabled.");
}

export function savePlannedPositions() {
  if (state.activeTab !== 'planned') return;
  if (!state.plannedScroll) {
    state.plannedScroll = {};
  }

  const tableContainer = document.querySelector('.macro-table-container');
  if (tableContainer) {
    state.plannedScroll.tableTop = tableContainer.scrollTop;
    state.plannedScroll.tableLeft = tableContainer.scrollLeft;
  }

  const plannedWrapper = document.querySelector('.planned-wrapper');
  if (plannedWrapper) {
    state.plannedScroll.wrapperTop = plannedWrapper.scrollTop;
    state.plannedScroll.wrapperLeft = plannedWrapper.scrollLeft;
  }

  state.plannedScroll.winY = window.scrollY || document.documentElement.scrollTop || 0;
  state.plannedScroll.winX = window.scrollX || document.documentElement.scrollLeft || 0;

  const active = document.activeElement;
  if (active && active !== document.body) {
    state.plannedScroll.lastFocusedId = active.id || null;
    if (active.dataset && active.dataset.macro) {
      state.plannedScroll.lastFocusedMacro = active.dataset.macro;
      if (active.classList.contains('macro-qty-input')) {
        state.plannedScroll.lastFocusedField = 'qty-input';
        state.plannedScroll.cursorStart = active.selectionStart;
        state.plannedScroll.cursorEnd = active.selectionEnd;
      } else if (active.classList.contains('btn-macro-inc')) {
        state.plannedScroll.lastFocusedField = 'btn-inc';
      } else if (active.classList.contains('btn-macro-dec')) {
        state.plannedScroll.lastFocusedField = 'btn-dec';
      } else if (active.classList.contains('btn-del-macro')) {
        state.plannedScroll.lastFocusedField = 'btn-del';
      }
    } else if (active.id === 'searchInput') {
      state.plannedScroll.lastFocusedMacro = null;
      state.plannedScroll.lastFocusedField = 'searchInput';
      state.plannedScroll.cursorStart = active.selectionStart;
      state.plannedScroll.cursorEnd = active.selectionEnd;
    } else {
      state.plannedScroll.lastFocusedMacro = null;
      state.plannedScroll.lastFocusedField = null;
    }
  }

  try {
    sessionStorage.setItem('x4_planned_scroll', JSON.stringify(state.plannedScroll));
  } catch (e) {}
}

export function restorePlannedPositions() {
  if (state.activeTab !== 'planned') return;
  const ps = state.plannedScroll;
  if (!ps) return;

  const applyScroll = () => {
    const tableContainer = document.querySelector('.macro-table-container');
    const plannedWrapper = document.querySelector('.planned-wrapper');
    if (tableContainer && (ps.tableTop !== undefined || ps.tableLeft !== undefined)) {
      tableContainer.scrollTop = ps.tableTop || 0;
      tableContainer.scrollLeft = ps.tableLeft || 0;
    }
    if (plannedWrapper && (ps.wrapperTop !== undefined || ps.wrapperLeft !== undefined)) {
      plannedWrapper.scrollTop = ps.wrapperTop || 0;
      plannedWrapper.scrollLeft = ps.wrapperLeft || 0;
    }
    if ((ps.winY && ps.winY > 0) || (ps.winX && ps.winX > 0)) {
      window.scrollTo(ps.winX || 0, ps.winY || 0);
    }
  };

  applyScroll();
  requestAnimationFrame(applyScroll);
  setTimeout(applyScroll, 40);
  setTimeout(applyScroll, 120);

  const restoreFocus = () => {
    let elToFocus = null;
    if (ps.lastFocusedField === 'searchInput') {
      elToFocus = document.getElementById('searchInput');
    } else if (ps.lastFocusedId) {
      elToFocus = document.getElementById(ps.lastFocusedId);
    } else if (ps.lastFocusedMacro && ps.lastFocusedField) {
      const escapedMacro = (typeof CSS !== 'undefined' && CSS.escape)
        ? CSS.escape(ps.lastFocusedMacro)
        : ps.lastFocusedMacro.replace(/["\\]/g, '\\$&');
      if (ps.lastFocusedField === 'qty-input') {
        elToFocus = document.querySelector(`.macro-qty-input[data-macro="${escapedMacro}"]`);
      } else if (ps.lastFocusedField === 'btn-inc') {
        elToFocus = document.querySelector(`.btn-macro-inc[data-macro="${escapedMacro}"]`);
      } else if (ps.lastFocusedField === 'btn-dec') {
        elToFocus = document.querySelector(`.btn-macro-dec[data-macro="${escapedMacro}"]`);
      } else if (ps.lastFocusedField === 'btn-del') {
        elToFocus = document.querySelector(`.btn-del-macro[data-macro="${escapedMacro}"]`);
      }
    }

    if (elToFocus && typeof elToFocus.focus === 'function') {
      try {
        elToFocus.focus({ preventScroll: true });
        if (typeof elToFocus.setSelectionRange === 'function' && ps.cursorStart !== null && ps.cursorEnd !== null) {
          elToFocus.setSelectionRange(ps.cursorStart, ps.cursorEnd);
        }
      } catch (e) {}
    }
  };

  restoreFocus();
  requestAnimationFrame(restoreFocus);
  setTimeout(restoreFocus, 40);
}

function renderApp() {
  try {

    if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
      if (state.populateMatrix) {
        syncPopulatedMatrix();
      } else {
        rebuildBlueprintFromMacros();
      }
    }
    calculateFactoryRequirements();

    if (state.activeTab === 'planned') {
      savePlannedPositions();
    }

    const winScrollY = window.scrollY || document.documentElement.scrollTop;
    const winScrollX = window.scrollX || document.documentElement.scrollLeft;

    let preRenderCenteredWareId = null;
    let preRenderVpScrollLeft = 0;
    let preRenderVpScrollTop = 0;
    if (state.activeTab === 'matrix') {
      preRenderCenteredWareId = state.selectedWareId || getCenteredWareId() || state.lastFocusedWareId;
      if (preRenderCenteredWareId) {
        state.lastFocusedWareId = preRenderCenteredWareId;
      }
      const prevVp = document.getElementById('viewport');
      if (prevVp) {
        preRenderVpScrollLeft = prevVp.scrollLeft;
        preRenderVpScrollTop = prevVp.scrollTop;
      }
    }

    const prevSearchInput = document.getElementById('searchInput');
    const isSearchFocused = document.activeElement === prevSearchInput;
    const searchSelStart = isSearchFocused && prevSearchInput ? prevSearchInput.selectionStart : null;
    const searchSelEnd = isSearchFocused && prevSearchInput ? prevSearchInput.selectionEnd : null;

    const app = document.getElementById('app');
    if (!app) return;
  app.innerHTML = `
    <div class="top-pinned-panel">
      <header>
        <div class="brand">
          <div class="brand-icon">X4</div>
          <div class="brand-title">
            <h1><span class="brand-title-text">Ware Supply Chain Matrix</span> <span class="app-version-badge">v${appVersion}</span></h1>
            <p>Real-Time Station Supply Explorer & Blueprint Generator</p>
          </div>
        </div>

        <nav class="nav-tabs">
          <button class="nav-tab-btn ${state.activeTab === 'matrix' ? 'active' : ''}" id="tabBtnMatrix">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Supply Matrix
          </button>
          <button class="nav-tab-btn ${state.activeTab === 'planned' ? 'active' : ''}" id="tabBtnPlanned">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Planned Modules
          </button>
        </nav>

        <div class="controls">
          <div class="search-box">
            <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" class="search-input" id="searchInput" placeholder="${state.activeTab === 'planned' ? '(!) Search module...' : '(!) Search ware...'}" value="${escapeHtml(state.searchQuery)}" />
          </div>

          ${Object.keys(PRESET_BLUEPRINTS).map(key => {
            const p = PRESET_BLUEPRINTS[key];
            return `
              <button class="btn-filter ${state.currentPreset === key ? 'active' : ''}" data-preset="${key}" title="Left-click to load plan • Right-click to remove preset">
                ${p.label}
              </button>
            `;
          }).join('')}
        </div>
      </header>

      <div class="calc-bar">
        <div class="calc-bar-row">
          <div class="calc-group" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <input type="file" id="xmlFileInput" accept=".xml" style="display:none;" />
            <button class="btn-upload" id="btnUploadXML" style="padding:0.25rem 0.65rem; font-size:0.75rem;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Upload .XML Blueprint
            </button>
            ${state.activeBlueprint ? `
              <div class="bp-tags-list">
                <div class="bp-tag active-bp-tag">
                  <strong id="activeBpName" class="active-bp-name" title="Click to reload this blueprint">${escapeHtml(state.activeBlueprint.name)} 🔄</strong>
                  <span class="bp-entries-badge">${state.activeBlueprint.totalModules} Entries</span>
                  <button id="btnRemoveActiveBP" class="btn-remove-bp-tag" title="Remove active blueprint">&times;</button>
                </div>

                ${(!isHostedMode() && state.loadedBlueprints) ? (state.loadedBlueprints || []).filter(b => b.name !== state.activeBlueprint.name).map(b => {
                  const encName = encodeURIComponent(b.name);
                  return `
                    <div class="bp-tag prev-bp-tag">
                      <span class="btn-switch-bp" data-bp-name="${encName}" title="Click to switch to ${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>
                      <span class="bp-entries-badge prev-badge">${b.totalModules}</span>
                      <button class="btn-remove-prev-bp" data-bp-name="${encName}" title="Remove from list">&times;</button>
                    </div>
                  `;
                }).join('') : ''}
              </div>
            ` : `
              ${(!isHostedMode() && state.loadedBlueprints && state.loadedBlueprints.length > 0) ? `
                <div class="bp-tags-list">
                  ${state.loadedBlueprints.map(b => {
                    const encName = encodeURIComponent(b.name);
                    return `
                      <div class="bp-tag prev-bp-tag">
                        <span class="btn-switch-bp" data-bp-name="${encName}" title="Click to load ${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>
                        <span class="bp-entries-badge prev-badge">${b.totalModules}</span>
                        <button class="btn-remove-prev-bp" data-bp-name="${encName}" title="Remove from list">&times;</button>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            `}
          </div>
          ${state.activeTab === 'matrix' ? `
            <div class="slider-group">
              <label for="workforceSlider" class="${state.workforceBonus === 0 ? 'flash-wf-label' : ''}">Workforce Eff Bonus:</label>
              <button class="btn-qty" id="btnWfDec" title="Decrease workforce bonus by 1% (or 0.1% with Shift)">&lt;</button>
              <input type="range" id="workforceSlider" min="0" max="100" step="0.1" value="${state.workforceBonus}" />
              <button class="btn-qty" id="btnWfInc" title="Increase workforce bonus by 1% (or 0.1% with Shift)">&gt;</button>
              <span id="wfBonusValue" style="font-weight:700; color:#34d399; min-width:45px; cursor:pointer;" title="Click to enter exact Workforce % or Current/Optimal workers">+${Number.isInteger(state.workforceBonus) ? state.workforceBonus : parseFloat(state.workforceBonus.toFixed(2))}%</span>
            </div>
          ` : ''}
        </div>
        ${state.activeTab === 'matrix' ? `
          <div class="calc-bar-row">
            <div class="calc-group">
              <label id="lblSubdueEcCalc" style="font-size:0.8rem; color:#fbbf24; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; background:rgba(245,158,11,0.12); padding:0.25rem 0.65rem; border-radius:6px; border:1px solid rgba(245,158,11,0.35); user-select:none;" title="When checked, hides the EC consumption badges on all ware cards">
                <input type="checkbox" id="chkSubdueEcCalc" ${state.subdueEcCalc ? 'checked' : ''} style="cursor:pointer;" />
                Subdue EC Calc
              </label>
            </div>
            <div class="calc-group">
              <label id="lblSubdueLevel4" style="font-size:0.8rem; color:#a78bfa; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; background:rgba(167,139,250,0.12); padding:0.25rem 0.65rem; border-radius:6px; border:1px solid rgba(167,139,250,0.35); user-select:none;" title="When checked, hides the Level 4 Applications column and expands remaining columns across the panel">
                <input type="checkbox" id="chkSubdueLevel4" ${state.subdueLevel4 ? 'checked' : ''} style="cursor:pointer;" />
                Subdue Level 4
              </label>
            </div>
            <div class="calc-group">
              ${(() => {
                const isStmActive = Boolean(state.selectedWareId || !state.activeBlueprint || state.currentPreset === 'all');
                return `
                  <label id="lblToggleSTM" style="font-size:0.8rem; color:#38bdf8; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; background:${isStmActive ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.08)'}; padding:0.25rem 0.65rem; border-radius:6px; border:1px solid ${isStmActive ? 'rgba(56,189,248,0.5)' : 'rgba(56,189,248,0.25)'}; user-select:none;" title="${isStmActive ? 'Checked: Single Target Mode is active. Uncheck to exit STM.' : 'Unchecked: Blueprint mode is active. Check to switch to Single Target Mode.'}">
                    <input type="checkbox" id="chkToggleSTM" ${isStmActive ? 'checked' : ''} style="cursor:pointer;" />
                    STM
                  </label>
                  <button class="btn-filter ${isStmActive ? 'active' : ''}" data-preset="all" id="btnToggleSTM" style="display:none;">${isStmActive ? 'Exit STM' : 'Single Target Mode'}</button>
                  ${isStmActive ? `
                    <span id="singleTargetModeWording" style="color:#94a3b8; font-style:italic; font-size:0.8rem;">(Single Target Mode)</span>
                  ` : ''}
                `;
              })()}
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    ${state.activeTab === 'matrix' ? renderMatrixTabHTML() : renderPlannedTabHTML()}
  `;

    if (state.activeTab === 'matrix') {
      const newVp = document.getElementById('viewport');
      if (newVp && (preRenderVpScrollLeft > 0 || preRenderVpScrollTop > 0)) {
        newVp.scrollLeft = preRenderVpScrollLeft;
        newVp.scrollTop = preRenderVpScrollTop;
      }
    }

    setupEvents({ isSearchFocused, searchSelStart, searchSelEnd });

    if (state.activeTab === 'planned') {
      restorePlannedPositions();
      filterPlannedModules();
    } else {
      if (winScrollY > 0 || winScrollX > 0) {
        window.scrollTo(winScrollX, winScrollY);
        requestAnimationFrame(() => {
          window.scrollTo(winScrollX, winScrollY);
        });
      }
      updateInspector(state.selectedWareId, renderApp);
      filterWares();
      setTimeout(drawLines, 50);
      const wareToCenter = state.selectedWareId || state.lastFocusedWareId;
      if (wareToCenter) {
        setTimeout(() => {
          centerOnWare(wareToCenter);
          setTimeout(drawLines, 80);
        }, 60);
      }
    }
  } catch (err) {
    console.error('Error rendering app:', err);
  }
}

function updateLiveMatrixContent() {
  calculateFactoryRequirements();
  const mainWrapper = document.querySelector('.main-wrapper');
  if (mainWrapper && state.activeTab === 'matrix') {
    const prevVp = document.getElementById('viewport');
    const vpScrollTop = prevVp ? prevVp.scrollTop : 0;
    const vpScrollLeft = prevVp ? prevVp.scrollLeft : 0;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderMatrixTabHTML();
    const newWrapper = tempDiv.querySelector('.main-wrapper');
    if (newWrapper) {
      mainWrapper.replaceWith(newWrapper);
      setupMatrixEvents();
      updateInspector(state.selectedWareId, renderApp);
      filterWares();
      const newVp = document.getElementById('viewport');
      if (newVp) {
        newVp.scrollTop = vpScrollTop;
        newVp.scrollLeft = vpScrollLeft;
      }
      setTimeout(drawLines, 20);
    }
  } else {
    renderApp();
  }
}

function setupMatrixEvents() {
  document.querySelectorAll('.ware-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      highlightGraph(card.dataset.id);
    });
    card.addEventListener('mouseleave', () => {
      if (state.searchQuery && state.searchQuery.trim()) {
        filterWares();
      } else {
        highlightGraph(state.selectedWareId);
      }
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('.pp-checkbox-label')) return;
      e.stopPropagation();
      selectWare(card.dataset.id, renderApp);
    });
  });

  document.querySelectorAll('.pp-checkbox').forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const wareId = cb.dataset.id;
      const isChecked = cb.checked;
      const ppText = cb.nextElementSibling;
      if (ppText) {
        ppText.style.color = isChecked ? '#f97316' : '#ffffff';
      }

      if (state.activeBlueprint) {
        if (!state.activeBlueprint.ppStates) state.activeBlueprint.ppStates = {};
        state.activeBlueprint.ppStates[wareId] = isChecked;
        if (!isChecked && (wareId === 'HullParts' || wareId === 'TelParts')) {
          delete state.activeBlueprint._autoHullPartsPP;
          state.activeBlueprint._manualHullPartsPP = true;
        } else if (isChecked && (wareId === 'HullParts' || wareId === 'TelParts')) {
          delete state.activeBlueprint._manualHullPartsPP;
        }
        if (!isChecked && wareId === 'Claytronics') {
          delete state.activeBlueprint._autoClaytronicsPP;
          state.activeBlueprint._manualClaytronicsPP = true;
        } else if (isChecked && wareId === 'Claytronics') {
          delete state.activeBlueprint._manualClaytronicsPP;
        }
        saveActiveBlueprintToStorage();
      } else {
        if (!state.ppStates) state.ppStates = {};
        state.ppStates[wareId] = isChecked;
        if (!isChecked && (wareId === 'HullParts' || wareId === 'TelParts')) {
          delete state._autoHullPartsPP;
          state._manualHullPartsPP = true;
        } else if (isChecked && (wareId === 'HullParts' || wareId === 'TelParts')) {
          delete state._manualHullPartsPP;
        }
        if (!isChecked && wareId === 'Claytronics') {
          delete state._autoClaytronicsPP;
          state._manualClaytronicsPP = true;
        } else if (isChecked && wareId === 'Claytronics') {
          delete state._manualClaytronicsPP;
        }
      }
      updateLiveMatrixContent();
    });
  });

  document.querySelectorAll('.pp-checkbox-label').forEach(lbl => {
    lbl.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  const btnCloseIns = document.getElementById('btnCloseIns');
  if (btnCloseIns) {
    btnCloseIns.addEventListener('click', () => {
      const currentFocus = state.selectedWareId || getCenteredWareId() || state.lastFocusedWareId;
      if (currentFocus) {
        state.lastFocusedWareId = currentFocus;
      }
      selectWare(null, renderApp);
    });
  }

  const sectorSelect = document.getElementById('sectorSelect');
  if (sectorSelect) {
    const handleSectorChange = (e) => {
      const chosen = e.target.value;
      state.selectedSector = chosen || null;
      if (state.activeBlueprint) {
        state.activeBlueprint.sector = chosen || null;
      }
      if (state.loadedBlueprints && state.activeBlueprint) {
        const currentLb = state.loadedBlueprints.find(b => b && b.name === state.activeBlueprint.name);
        if (currentLb) {
          currentLb.sector = chosen || null;
        }
      }
      saveActiveBlueprintToStorage();
      renderApp();
    };
    sectorSelect.addEventListener('change', handleSectorChange);
    sectorSelect.addEventListener('input', handleSectorChange);
  }

  const needleIndicator = document.getElementById('needleIndicator');
  if (needleIndicator && sectorSelect) {
    needleIndicator.addEventListener('click', () => {
      sectorSelect.focus();
    });
  }
}

function setupEvents(searchFocusState = {}) {
  const tabBtnMatrix = document.getElementById('tabBtnMatrix');
  const tabBtnPlanned = document.getElementById('tabBtnPlanned');

  if (tabBtnMatrix) {
    tabBtnMatrix.addEventListener('click', () => {
      savePlannedPositions();
      state.activeTab = 'matrix';
      try {
        sessionStorage.setItem('x4_active_tab', 'matrix');
      } catch (e) {}
      renderApp();
    });
  }

  if (tabBtnPlanned) {
    tabBtnPlanned.addEventListener('click', () => {
      state.activeTab = 'planned';
      try {
        sessionStorage.setItem('x4_active_tab', 'planned');
      } catch (e) {}
      renderApp();
    });
  }

  const btnUploadXML = document.getElementById('btnUploadXML');
  const xmlFileInput = document.getElementById('xmlFileInput');

  if (btnUploadXML && xmlFileInput) {
    btnUploadXML.addEventListener('click', () => xmlFileInput.click());
    xmlFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => parseXMLBlueprint(event.target.result, file.name, renderApp);
        reader.readAsText(file);
      }
    });
  }

  const btnClearBP = document.getElementById('btnClearBP');
  if (btnClearBP) {
    btnClearBP.addEventListener('click', () => removeActiveBlueprint(renderApp));
  }

  const btnRemoveActiveBP = document.getElementById('btnRemoveActiveBP');
  if (btnRemoveActiveBP) {
    btnRemoveActiveBP.addEventListener('click', (e) => {
      e.stopPropagation();
      removeActiveBlueprint(renderApp);
    });
  }

  const activeBpName = document.getElementById('activeBpName');
  if (activeBpName) {
    activeBpName.addEventListener('click', () => reloadActiveBlueprint(renderApp));
  }

  document.querySelectorAll('.btn-switch-bp').forEach(btn => {
    btn.addEventListener('click', () => {
      const bpName = decodeURIComponent(btn.dataset.bpName || '');
      if (bpName) switchLoadedBlueprint(bpName, renderApp);
    });
  });

  document.querySelectorAll('.btn-remove-prev-bp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bpName = decodeURIComponent(btn.dataset.bpName || '');
      if (bpName) removeLoadedBlueprint(bpName, renderApp);
    });
  });

  const viewport = document.getElementById('viewport');
  if (viewport) {
    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      viewport.classList.add('drag-active');
    });
    viewport.addEventListener('dragleave', () => {
      viewport.classList.remove('drag-active');
    });
    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      viewport.classList.remove('drag-active');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.xml')) {
        const reader = new FileReader();
        reader.onload = (event) => parseXMLBlueprint(event.target.result, file.name, renderApp);
        reader.readAsText(file);
      }
    });
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    if (searchFocusState.isSearchFocused) {
      searchInput.focus();
      if (searchFocusState.searchSelStart !== null && searchFocusState.searchSelEnd !== null) {
        searchInput.setSelectionRange(searchFocusState.searchSelStart, searchFocusState.searchSelEnd);
      }
    }

    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.activeTab === 'matrix') {
        filterWares();
      } else if (state.activeTab === 'planned') {
        filterPlannedModules();
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        state.searchQuery = '';
        if (state.activeTab === 'matrix') {
          filterWares();
        } else if (state.activeTab === 'planned') {
          filterPlannedModules();
        }
      }
    });
  }



  const saveWfForActiveBlueprint = () => {
    if (state.activeBlueprint) {
      state.activeBlueprint.workforceBonus = state.workforceBonus;
      if (state.loadedBlueprints) {
        const currentLb = state.loadedBlueprints.find(b => b && b.name === state.activeBlueprint.name);
        if (currentLb) {
          currentLb.workforceBonus = state.workforceBonus;
        }
      }
      saveActiveBlueprintToStorage();
    }
    try {
      localStorage.setItem('x4_workforce_bonus', String(state.workforceBonus));
    } catch (e) {}
  };

  const updateWfDisplay = () => {
    const wfValDisplay = document.getElementById('wfBonusValue');
    if (wfValDisplay) {
      const formatted = Number.isInteger(state.workforceBonus) ? state.workforceBonus : parseFloat(state.workforceBonus.toFixed(2));
      wfValDisplay.innerText = `+${formatted}%`;
    }
    const slider = document.getElementById('workforceSlider');
    if (slider && parseFloat(slider.value) !== state.workforceBonus) {
      slider.value = state.workforceBonus;
    }
    const wfLabel = document.querySelector('label[for="workforceSlider"]');
    if (wfLabel) {
      if (state.workforceBonus === 0) {
        wfLabel.classList.add('flash-wf-label');
      } else {
        wfLabel.classList.remove('flash-wf-label');
      }
    }
  };


  const btnWfDec = document.getElementById('btnWfDec');
  if (btnWfDec) {
    btnWfDec.addEventListener('click', (e) => {
      const step = e.shiftKey ? 0.1 : 1;
      const prev = state.workforceBonus;
      state.workforceBonus = Math.max(0, parseFloat((state.workforceBonus - step).toFixed(2)));
      if (state.workforceBonus !== prev) {
        saveWfForActiveBlueprint();
        updateWfDisplay();
        renderApp();
      }
    });
  }

  const btnWfInc = document.getElementById('btnWfInc');
  if (btnWfInc) {
    btnWfInc.addEventListener('click', (e) => {
      const step = e.shiftKey ? 0.1 : 1;
      const prev = state.workforceBonus;
      state.workforceBonus = Math.min(100, parseFloat((state.workforceBonus + step).toFixed(2)));
      if (state.workforceBonus !== prev) {
        saveWfForActiveBlueprint();
        updateWfDisplay();
        renderApp();
      }
    });
  }

  const workforceSlider = document.getElementById('workforceSlider');
  if (workforceSlider) {
    workforceSlider.addEventListener('input', (e) => {
      const newVal = parseFloat(e.target.value) || 0;
      if (state.workforceBonus !== newVal) {
        state.workforceBonus = newVal;
        saveWfForActiveBlueprint();
        updateWfDisplay();
        updateLiveMatrixContent();
      }
    });
    workforceSlider.addEventListener('change', (e) => {
      const newVal = parseFloat(e.target.value) || 0;
      state.workforceBonus = newVal;
      saveWfForActiveBlueprint();
      updateWfDisplay();
      renderApp();
    });
  }

  const wfBonusValueEl = document.getElementById('wfBonusValue');
  if (wfBonusValueEl) {
    wfBonusValueEl.addEventListener('click', () => {
      const input = prompt('Enter Workforce Bonus % (e.g. 32.3) or Current/Optimal Workers (e.g. 30890/95636):', state.workforceBonus);
      if (input !== null) {
        let val;
        if (input.includes('/')) {
          const parts = input.split('/');
          const cur = parseFloat(parts[0]);
          const opt = parseFloat(parts[1]);
          if (opt > 0) val = (cur / opt) * 100;
        } else {
          val = parseFloat(input);
        }
        if (!isNaN(val) && val >= 0 && val <= 100) {
          state.workforceBonus = parseFloat(val.toFixed(2));
          saveWfForActiveBlueprint();
          updateWfDisplay();
          renderApp();
        }
      }
    });
  }

  const chkSubdueEcCalc = document.getElementById('chkSubdueEcCalc');
  if (chkSubdueEcCalc) {
    chkSubdueEcCalc.addEventListener('change', (e) => {
      state.subdueEcCalc = e.target.checked;
      renderApp();
    });
  }

  const chkSubdueLevel4 = document.getElementById('chkSubdueLevel4');
  if (chkSubdueLevel4) {
    chkSubdueLevel4.addEventListener('change', (e) => {
      state.subdueLevel4 = e.target.checked;
      renderApp();
    });
  }

  const chkToggleSTM = document.getElementById('chkToggleSTM');
  if (chkToggleSTM) {
    chkToggleSTM.addEventListener('change', () => {
      document.getElementById('btnToggleSTM')?.click();
    });
  }

  document.querySelectorAll('.btn-filter[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const presetKey = btn.dataset.preset;
      if (presetKey === 'all') {
        const isStmActive = Boolean(state.selectedWareId || !state.activeBlueprint || state.currentPreset === 'all');
        const currentFocus = state.selectedWareId || getCenteredWareId() || state.lastFocusedWareId;
        if (currentFocus) {
          state.lastFocusedWareId = currentFocus;
        }

        if (isStmActive) {
          // Exiting STM: deselect any card and restore previous blueprint if available
          state.selectedWareId = null;
          state.calculatedDemand = {};
          if (state.previousBlueprint) {
            state.activeBlueprint = state.previousBlueprint;
            state.currentPreset = state.previousPreset || (state.previousBlueprint.name === 'Prod Max' ? 'prod_max' : 'blueprint');
            state.selectedSector = state.activeBlueprint.sector || null;
            state.workforceBonus = typeof state.activeBlueprint.workforceBonus === 'number' ? state.activeBlueprint.workforceBonus : 0;
            state.previousBlueprint = null;
            state.previousPreset = null;
          } else if (state.activeBlueprint) {
            state.currentPreset = state.activeBlueprint.name === 'Prod Max' ? 'prod_max' : 'blueprint';
          } else if (state.loadedBlueprints && state.loadedBlueprints.length > 0) {
            const bp = state.loadedBlueprints[0];
            state.activeBlueprint = {
              name: bp.name,
              totalModules: bp.totalModules,
              modules: { ...bp.modules },
              rawMacros: { ...(bp.rawMacros || {}) },
              rootMacros: { ...(bp.rawMacros || bp.rootMacros || {}) },
              sector: bp.sector || null,
              workforceBonus: typeof bp.workforceBonus === 'number' ? bp.workforceBonus : 0,
              ppStates: bp.ppStates ? { ...bp.ppStates } : {},
              baselineDemand: null,
              baselineLayerTotals: null
            };
            state.selectedSector = bp.sector || null;
            state.workforceBonus = typeof bp.workforceBonus === 'number' ? bp.workforceBonus : 0;
            state.currentPreset = Object.keys(PRESET_BLUEPRINTS).find(k => PRESET_BLUEPRINTS[k].name === bp.name) || 'blueprint';
          } else {
            state.currentPreset = 'all';
          }
        } else {
          // Entering Single Target Mode: stash active blueprint so it can be restored on exit
          if (state.activeBlueprint) {
            state.previousBlueprint = {
              name: state.activeBlueprint.name,
              totalModules: state.activeBlueprint.totalModules,
              modules: { ...state.activeBlueprint.modules },
              rawMacros: { ...(state.activeBlueprint.rawMacros || {}) },
              rootMacros: { ...(state.activeBlueprint.rootMacros || state.activeBlueprint.rawMacros || {}) },
              sector: state.selectedSector || state.activeBlueprint.sector || null,
              workforceBonus: state.workforceBonus,
              ppStates: state.activeBlueprint.ppStates ? { ...state.activeBlueprint.ppStates } : {}
            };
            state.previousPreset = state.currentPreset;
          }
          state.activeBlueprint = null;
          state.currentPreset = 'all';
          state.selectedWareId = null;
          state.calculatedDemand = {};
          state.selectedSector = null;
          state.workforceBonus = 0;
        }
        saveActiveBlueprintToStorage();
        renderApp();
        return;
      }

      if (isHostedMode()) {
        clearBlueprintInternalStorage();
      }
      state.previousBlueprint = null;
      state.previousPreset = null;
      state.currentPreset = presetKey;
      state.selectedWareId = null;
      state.lastFocusedWareId = null;
      state.calculatedDemand = {};
      if (PRESET_BLUEPRINTS[state.currentPreset]) {
        const p = PRESET_BLUEPRINTS[state.currentPreset];
        const existingLb = !isHostedMode() ? (state.loadedBlueprints || []).find(b => b && b.name === p.name) : null;
        const presetSector = existingLb ? (existingLb.sector || null) : null;
        const presetWf = existingLb && typeof existingLb.workforceBonus === 'number' ? existingLb.workforceBonus : 0;
        const presetPP = existingLb && existingLb.ppStates ? { ...existingLb.ppStates } : {};

        state.activeBlueprint = {
          name: p.name,
          totalModules: p.totalModules,
          modules: { ...p.modules },
          rawMacros: { ...(p.rawMacros || {}) },
          rootMacros: { ...(p.rawMacros || {}) },
          sector: presetSector,
          workforceBonus: presetWf,
          ppStates: presetPP,
          baselineDemand: null,
          baselineLayerTotals: null
        };
        state.selectedSector = presetSector;
        state.workforceBonus = presetWf;
        state.originalBlueprint = {
          name: p.name,
          totalModules: p.totalModules,
          modules: { ...p.modules },
          rawMacros: { ...(p.rawMacros || {}) }
        };
        state.subdueEcCalc = true;
        state.subdueLevel4 = true;

        if (isHostedMode()) {
          state.loadedBlueprints = [{
            name: p.name,
            totalModules: p.totalModules,
            modules: { ...p.modules },
            rawMacros: { ...(p.rawMacros || {}) },
            rootMacros: { ...(p.rawMacros || {}) },
            sector: null,
            workforceBonus: 0,
            ppStates: {}
          }];
        } else {
          if (!state.loadedBlueprints) state.loadedBlueprints = [];
          if (!existingLb) {
            state.loadedBlueprints.unshift({
              name: p.name,
              totalModules: p.totalModules,
              modules: { ...p.modules },
              rawMacros: { ...(p.rawMacros || {}) },
              rootMacros: { ...(p.rawMacros || {}) },
              sector: null,
              workforceBonus: 0,
              ppStates: {}
            });
          }
        }
        collapseAllBiComponents();
      }
      saveActiveBlueprintToStorage();
      renderApp();
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const key = btn.dataset.preset;
      if (key === 'all') return;

      const preset = PRESET_BLUEPRINTS[key];
      if (preset) {
        if (confirm(`Delete plan preset "${preset.label}" (${preset.name})?`)) {
          delete PRESET_BLUEPRINTS[key];
          try {
            const deleted = JSON.parse(localStorage.getItem('x4_deleted_presets') || '[]');
            if (!deleted.includes(key)) {
              deleted.push(key);
              localStorage.setItem('x4_deleted_presets', JSON.stringify(deleted));
            }
          } catch (err) {}

          if (state.currentPreset === key) {
            removeActiveBlueprint(renderApp);
          } else {
            renderApp();
          }
        }
      }
    });
  });

  // Planned & Changed Modules Events
  const chkHideFoodAgri = document.getElementById('chkHideFoodAgri');
  if (chkHideFoodAgri) {
    chkHideFoodAgri.addEventListener('change', (e) => {
      state.hideFoodAgriPlanned = e.target.checked;
      renderApp();
    });
  }

  const chkFilterWares = document.getElementById('chkFilterWares');
  if (chkFilterWares) {
    chkFilterWares.addEventListener('change', (e) => {
      state.filterWaresPlanned = e.target.checked;
      if (state.filterWaresPlanned) {
        state.filterStructuresPlanned = false;
      }
      renderApp();
    });
  }

  const chkFilterStructures = document.getElementById('chkFilterStructures');
  if (chkFilterStructures) {
    chkFilterStructures.addEventListener('change', (e) => {
      state.filterStructuresPlanned = e.target.checked;
      if (state.filterStructuresPlanned) {
        state.filterWaresPlanned = false;
      }
      renderApp();
    });
  }

  const chkPopulateMatrix = document.getElementById('chkPopulateMatrix');
  if (chkPopulateMatrix) {
    chkPopulateMatrix.addEventListener('change', (e) => {
      state.populateMatrix = e.target.checked;
      if (state.activeBlueprint) {
        if (!state.activeBlueprint.rootMacros) {
          state.activeBlueprint.rootMacros = { ...(state.activeBlueprint.rawMacros || {}) };
        }
        syncPopulatedMatrix();
      }
      saveActiveBlueprintToStorage();
      renderApp();
    });
  }

  const selectFactionMethod = document.getElementById('selectFactionMethod');
  if (selectFactionMethod) {
    selectFactionMethod.addEventListener('change', (e) => {
      state.factionConstructionMethod = e.target.value;
      renderApp();
    });
  }

  if (state.activeTab === 'planned') {
    const tableContainer = document.querySelector('.macro-table-container');
    if (tableContainer) {
      tableContainer.addEventListener('scroll', () => {
        if (state.activeTab === 'planned') {
          if (!state.plannedScroll) state.plannedScroll = {};
          state.plannedScroll.tableTop = tableContainer.scrollTop;
          state.plannedScroll.tableLeft = tableContainer.scrollLeft;
          try {
            sessionStorage.setItem('x4_planned_scroll', JSON.stringify(state.plannedScroll));
          } catch (e) {}
        }
      }, { passive: true });
    }

    const plannedWrapper = document.querySelector('.planned-wrapper');
    if (plannedWrapper) {
      plannedWrapper.addEventListener('scroll', () => {
        if (state.activeTab === 'planned') {
          if (!state.plannedScroll) state.plannedScroll = {};
          state.plannedScroll.wrapperTop = plannedWrapper.scrollTop;
          state.plannedScroll.wrapperLeft = plannedWrapper.scrollLeft;
          try {
            sessionStorage.setItem('x4_planned_scroll', JSON.stringify(state.plannedScroll));
          } catch (e) {}
        }
      }, { passive: true });
    }
  }

  const thSortMacro = document.getElementById('thSortMacro');
  if (thSortMacro) {
    thSortMacro.addEventListener('click', () => {
      state.macroSortAsc = !state.macroSortAsc;
      renderApp();
    });
  }

  const btnAddMacro = document.getElementById('btnAddMacro');
  const addMacroSelect = document.getElementById('addMacroSelect');

  if (addMacroSelect) {
    addMacroSelect.addEventListener('change', (e) => {
      const macro = e.target.value;
      if (macro) {
        const wareId = mapMacroToWare(macro);
        state.selectedWareId = wareId;
      }
    });
  }

  if (btnAddMacro && addMacroSelect) {
    btnAddMacro.addEventListener('click', () => {
      const selectedMacro = addMacroSelect.value;
      if (!selectedMacro) {
        alert('Please select a macro module to add.');
        return;
      }

      if (!state.activeBlueprint) {
        state.activeBlueprint = {
          name: 'Custom Planned Station Blueprint',
          totalModules: 0,
          modules: {},
          rawMacros: {},
          rootMacros: {}
        };
      }

      if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
      if (!state.activeBlueprint.rootMacros) state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };

      state.activeBlueprint.rootMacros[selectedMacro] = (state.activeBlueprint.rootMacros[selectedMacro] || 0) + 1;
      state.activeBlueprint.rawMacros[selectedMacro] = (state.activeBlueprint.rawMacros[selectedMacro] || 0) + 1;

      const addedWareId = mapMacroToWare(selectedMacro);
      state.selectedWareId = addedWareId;

      if (state.populateMatrix) {
        syncPopulatedMatrix();
      } else {
        rebuildBlueprintFromMacros();
      }
      saveActiveBlueprintToStorage();
      calculateFactoryRequirements();
      renderApp();
    });
  }

  function updatePlannedMacroQty(macro, newQty, isDelete = false) {
    if (!state.activeBlueprint) return;
    if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
    if (!state.activeBlueprint.rootMacros) {
      state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };
    }

    if (isDelete || newQty < 0) {
      delete state.activeBlueprint.rootMacros[macro];
      delete state.activeBlueprint.rawMacros[macro];
    } else {
      state.activeBlueprint.rootMacros[macro] = Math.max(0, newQty);
      state.activeBlueprint.rawMacros[macro] = Math.max(0, newQty);
    }

    if (state.populateMatrix) {
      syncPopulatedMatrix();
    } else {
      rebuildBlueprintFromMacros();
    }
    saveActiveBlueprintToStorage();
    calculateFactoryRequirements();
    renderApp();
  }

  document.querySelectorAll('.macro-qty-input').forEach(input => {
    const handleQtyChange = (e) => {
      const macro = e.target.dataset.macro;
      const valStr = e.target.value;
      if (valStr === '' && e.type === 'input') return;
      const newQty = Math.max(0, parseInt(valStr) || 0);
      updatePlannedMacroQty(macro, newQty, false);
    };
    input.addEventListener('change', handleQtyChange);
    input.addEventListener('input', handleQtyChange);
  });

  document.querySelectorAll('.btn-macro-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      const currentQty = (state.activeBlueprint && state.activeBlueprint.rawMacros && state.activeBlueprint.rawMacros[macro] !== undefined)
        ? state.activeBlueprint.rawMacros[macro]
        : 0;
      updatePlannedMacroQty(macro, currentQty + 1, false);
    });
  });

  document.querySelectorAll('.btn-macro-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      const currentQty = (state.activeBlueprint && state.activeBlueprint.rawMacros && state.activeBlueprint.rawMacros[macro] !== undefined)
        ? state.activeBlueprint.rawMacros[macro]
        : 0;
      updatePlannedMacroQty(macro, Math.max(0, currentQty - 1), false);
    });
  });

  document.querySelectorAll('.btn-del-macro').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      updatePlannedMacroQty(macro, 0, true);
    });
  });

  document.querySelectorAll('#plannedView .btn-price-tier').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = btn.dataset.priceTier;
      if (tier && ['min', 'avg', 'max'].includes(tier)) {
        if (store && typeof store.setPriceType === 'function') {
          store.setPriceType(tier);
        } else {
          state.priceType = tier;
        }
        renderApp();
      }
    });
  });

  // Matrix View Events
  if (state.activeTab === 'matrix') {
    setupMatrixEvents();
    window.addEventListener('resize', drawLines);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}

window.addEventListener('scroll', () => {
  if (state.activeTab === 'planned') {
    if (!state.plannedScroll) state.plannedScroll = {};
    state.plannedScroll.winY = window.scrollY || document.documentElement.scrollTop || 0;
    state.plannedScroll.winX = window.scrollX || document.documentElement.scrollLeft || 0;
    try {
      sessionStorage.setItem('x4_planned_scroll', JSON.stringify(state.plannedScroll));
    } catch (e) {}
  }
}, { passive: true });

document.addEventListener('focusin', () => {
  if (state.activeTab === 'planned') {
    savePlannedPositions();
  }
});

window.addEventListener('blur', () => {
  if (state.activeTab === 'planned') {
    savePlannedPositions();
  }
});

window.addEventListener('focus', () => {
  if (state.activeTab === 'planned') {
    restorePlannedPositions();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (state.activeTab === 'planned') {
      savePlannedPositions();
    }
  } else if (document.visibilityState === 'visible') {
    if (state.activeTab === 'planned') {
      restorePlannedPositions();
    }
  }
});

window.addEventListener('beforeunload', () => {
  if (state.activeTab === 'planned') {
    savePlannedPositions();
  }
});

window.addEventListener('pagehide', () => {
  if (state.activeTab === 'planned') {
    savePlannedPositions();
  }
});
