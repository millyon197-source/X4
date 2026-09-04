import './style.css';
import { PRESET_BLUEPRINTS, mapMacroToWare, WARES_DB } from './data/wares.js';
import { state, saveActiveBlueprintToStorage } from './engine/state.js';
import { calculateFactoryRequirements, syncPopulatedMatrix, getPrimaryMacroForWare } from './engine/calculator.js';
import { parseXMLBlueprint, removeActiveBlueprint, rebuildBlueprintFromMacros, reloadActiveBlueprint, switchLoadedBlueprint, removeLoadedBlueprint } from './engine/xmlParser.js';
import { renderMatrixTabHTML, drawLines, highlightGraph, filterWares, selectWare, updateInspector, centerOnWare } from './ui/matrixView.js';
import { renderPlannedTabHTML, filterPlannedModules } from './ui/plannedView.js';
import { version as appVersion } from '../package.json';
import { escapeHtml } from './html.js';

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

    // Preserve scroll positions
    const tableContainer = document.querySelector('.macro-table-container');
    const tableScrollTop = tableContainer ? tableContainer.scrollTop : 0;
    const tableScrollLeft = tableContainer ? tableContainer.scrollLeft : 0;

    const plannedWrapper = document.querySelector('.planned-wrapper');
    const wrapperScrollTop = plannedWrapper ? plannedWrapper.scrollTop : 0;
    const wrapperScrollLeft = plannedWrapper ? plannedWrapper.scrollLeft : 0;

    const winScrollY = window.scrollY || document.documentElement.scrollTop;
    const winScrollX = window.scrollX || document.documentElement.scrollLeft;

    const prevSearchInput = document.getElementById('searchInput');
    const isSearchFocused = document.activeElement === prevSearchInput;
    const searchSelStart = isSearchFocused && prevSearchInput ? prevSearchInput.selectionStart : null;
    const searchSelEnd = isSearchFocused && prevSearchInput ? prevSearchInput.selectionEnd : null;

    const app = document.getElementById('app');
    if (!app) return;
  app.innerHTML = `
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

              ${(state.loadedBlueprints || []).filter(b => b.name !== state.activeBlueprint.name).map(b => {
                const encName = encodeURIComponent(b.name);
                return `
                  <div class="bp-tag prev-bp-tag">
                    <span class="btn-switch-bp" data-bp-name="${encName}" title="Click to switch to ${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>
                    <span class="bp-entries-badge prev-badge">${b.totalModules}</span>
                    <button class="btn-remove-prev-bp" data-bp-name="${encName}" title="Remove from list">&times;</button>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            ${(state.loadedBlueprints && state.loadedBlueprints.length > 0) ? `
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
            <button class="btn-qty" id="btnWfDec" title="Decrease workforce bonus by 1%">&lt;</button>
            <input type="range" id="workforceSlider" min="0" max="100" step="1" value="${state.workforceBonus}" />
            <button class="btn-qty" id="btnWfInc" title="Increase workforce bonus by 1%">&gt;</button>
            <span id="wfBonusValue" style="font-weight:700; color:#34d399; min-width:45px;">+${state.workforceBonus}%</span>
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
            <button class="btn-filter ${state.currentPreset === 'all' ? 'active' : ''}" data-preset="all" style="padding:0.25rem 0.65rem; font-size:0.8rem;" title="Click to clear active blueprint and switch to Single Target Mode">Single Target Mode</button>
            ${(!state.activeBlueprint || state.currentPreset === 'all') ? `
              <span id="singleTargetModeWording" style="color:#94a3b8; font-style:italic; font-size:0.8rem;">(Single Target Mode)</span>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>

    ${state.activeTab === 'matrix' ? renderMatrixTabHTML() : renderPlannedTabHTML()}
  `;

    setupEvents({ isSearchFocused, searchSelStart, searchSelEnd });

    // Restore scroll positions
    const newTableContainer = document.querySelector('.macro-table-container');
    if (newTableContainer && (tableScrollTop > 0 || tableScrollLeft > 0)) {
      newTableContainer.scrollTop = tableScrollTop;
      newTableContainer.scrollLeft = tableScrollLeft;
      requestAnimationFrame(() => {
        if (newTableContainer) {
          newTableContainer.scrollTop = tableScrollTop;
          newTableContainer.scrollLeft = tableScrollLeft;
        }
      });
    }

    const newPlannedWrapper = document.querySelector('.planned-wrapper');
    if (newPlannedWrapper && (wrapperScrollTop > 0 || wrapperScrollLeft > 0)) {
      newPlannedWrapper.scrollTop = wrapperScrollTop;
      newPlannedWrapper.scrollLeft = wrapperScrollLeft;
      requestAnimationFrame(() => {
        if (newPlannedWrapper) {
          newPlannedWrapper.scrollTop = wrapperScrollTop;
          newPlannedWrapper.scrollLeft = wrapperScrollLeft;
        }
      });
    }

    if (winScrollY > 0 || winScrollX > 0) {
      window.scrollTo(winScrollX, winScrollY);
      requestAnimationFrame(() => {
        window.scrollTo(winScrollX, winScrollY);
      });
    }

    if (state.activeTab === 'matrix') {
      updateInspector(state.selectedWareId, renderApp);
      filterWares();
      setTimeout(drawLines, 50);
      if (state.selectedWareId) {
        setTimeout(() => centerOnWare(state.selectedWareId), 60);
      }
    } else if (state.activeTab === 'planned') {
      filterPlannedModules();
    }
  } catch (err) {
    console.error('Error rendering app:', err);
  }
}

function setupEvents(searchFocusState = {}) {
  const tabBtnMatrix = document.getElementById('tabBtnMatrix');
  const tabBtnPlanned = document.getElementById('tabBtnPlanned');

  if (tabBtnMatrix) {
    tabBtnMatrix.addEventListener('click', () => {
      state.activeTab = 'matrix';
      renderApp();
    });
  }

  if (tabBtnPlanned) {
    tabBtnPlanned.addEventListener('click', () => {
      state.activeTab = 'planned';
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



  let hasPendingWfChange = false;

  const updateWfDisplay = () => {
    const wfValDisplay = document.getElementById('wfBonusValue');
    if (wfValDisplay) {
      wfValDisplay.innerText = `+${state.workforceBonus}%`;
    }
    const slider = document.getElementById('workforceSlider');
    if (slider && parseInt(slider.value) !== state.workforceBonus) {
      slider.value = state.workforceBonus;
    }
  };

  const triggerWfRecalc = () => {
    if (hasPendingWfChange) {
      hasPendingWfChange = false;
      renderApp();
    }
  };

  const btnWfDec = document.getElementById('btnWfDec');
  if (btnWfDec) {
    btnWfDec.addEventListener('click', () => {
      const prev = state.workforceBonus;
      state.workforceBonus = Math.max(0, state.workforceBonus - 1);
      if (state.workforceBonus !== prev) {
        hasPendingWfChange = true;
        updateWfDisplay();
      }
    });
    btnWfDec.addEventListener('blur', triggerWfRecalc);
  }

  const btnWfInc = document.getElementById('btnWfInc');
  if (btnWfInc) {
    btnWfInc.addEventListener('click', () => {
      const prev = state.workforceBonus;
      state.workforceBonus = Math.min(100, state.workforceBonus + 1);
      if (state.workforceBonus !== prev) {
        hasPendingWfChange = true;
        updateWfDisplay();
      }
    });
    btnWfInc.addEventListener('blur', triggerWfRecalc);
  }

  const workforceSlider = document.getElementById('workforceSlider');
  if (workforceSlider) {
    workforceSlider.addEventListener('input', (e) => {
      const newVal = parseInt(e.target.value) || 0;
      if (state.workforceBonus !== newVal) {
        state.workforceBonus = newVal;
        hasPendingWfChange = true;
        updateWfDisplay();
      }
    });
    workforceSlider.addEventListener('change', (e) => {
      const newVal = parseInt(e.target.value) || 0;
      if (state.workforceBonus !== newVal) {
        state.workforceBonus = newVal;
        hasPendingWfChange = true;
        updateWfDisplay();
      }
    });
    workforceSlider.addEventListener('blur', triggerWfRecalc);
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

  document.querySelectorAll('.btn-filter[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      state.currentPreset = btn.dataset.preset;
      state.selectedWareId = null;
      state.calculatedDemand = {};
      if (state.currentPreset === 'all') {
        state.activeBlueprint = null;
      } else if (PRESET_BLUEPRINTS[state.currentPreset]) {
        const p = PRESET_BLUEPRINTS[state.currentPreset];
        state.activeBlueprint = {
          name: p.name,
          totalModules: p.totalModules,
          modules: { ...p.modules },
          rawMacros: { ...(p.rawMacros || {}) },
          rootMacros: { ...(p.rawMacros || {}) },
          baselineDemand: null,
          baselineLayerTotals: null
        };
        state.originalBlueprint = {
          name: p.name,
          totalModules: p.totalModules,
          modules: { ...p.modules },
          rawMacros: { ...(p.rawMacros || {}) }
        };
        state.subdueEcCalc = true;
        state.subdueLevel4 = true;
      }
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
      renderApp();
    });
  }

  document.querySelectorAll('.macro-qty-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const macro = e.target.dataset.macro;
      const newQty = Math.max(0, parseInt(e.target.value) || 0);

      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        if (!state.activeBlueprint.rootMacros) {
          state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };
        }
        if (newQty === 0) {
          delete state.activeBlueprint.rootMacros[macro];
          delete state.activeBlueprint.rawMacros[macro];
        } else {
          state.activeBlueprint.rootMacros[macro] = newQty;
          state.activeBlueprint.rawMacros[macro] = newQty;
        }

        if (state.populateMatrix) {
          syncPopulatedMatrix();
        } else {
          rebuildBlueprintFromMacros();
        }
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-macro-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        if (!state.activeBlueprint.rootMacros) {
          state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };
        }
        state.activeBlueprint.rootMacros[macro] = (state.activeBlueprint.rootMacros[macro] || 0) + 1;
        state.activeBlueprint.rawMacros[macro] = (state.activeBlueprint.rawMacros[macro] || 0) + 1;
        if (state.populateMatrix) {
          syncPopulatedMatrix();
        } else {
          rebuildBlueprintFromMacros();
        }
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-macro-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        if (!state.activeBlueprint.rootMacros) {
          state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };
        }
        const currentQty = state.activeBlueprint.rootMacros[macro] !== undefined ? state.activeBlueprint.rootMacros[macro] : (state.activeBlueprint.rawMacros[macro] || 0);
        if (currentQty <= 1) {
          delete state.activeBlueprint.rootMacros[macro];
          delete state.activeBlueprint.rawMacros[macro];
        } else {
          state.activeBlueprint.rootMacros[macro] = currentQty - 1;
          state.activeBlueprint.rawMacros[macro] = currentQty - 1;
        }

        if (state.populateMatrix) {
          syncPopulatedMatrix();
        } else {
          rebuildBlueprintFromMacros();
        }
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-del-macro').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        if (!state.activeBlueprint.rootMacros) {
          state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };
        }
        delete state.activeBlueprint.rootMacros[macro];
        delete state.activeBlueprint.rawMacros[macro];
        if (state.populateMatrix) {
          syncPopulatedMatrix();
        } else {
          rebuildBlueprintFromMacros();
        }
        renderApp();
      }
    });
  });

  // Matrix View Events
  if (state.activeTab === 'matrix') {
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
        e.stopPropagation();
        selectWare(card.dataset.id, renderApp);
      });
    });

    const btnCloseIns = document.getElementById('btnCloseIns');
    if (btnCloseIns) {
      btnCloseIns.addEventListener('click', () => {
        selectWare(null, renderApp);
      });
    }

    const sectorSelect = document.getElementById('sectorSelect');
    if (sectorSelect) {
      const handleSectorChange = (e) => {
        const chosen = e.target.value;
        if (!chosen) return;
        state.selectedSector = chosen;
        if (state.activeBlueprint) {
          state.activeBlueprint.sector = chosen;
        }
        saveActiveBlueprintToStorage();
        renderApp();
      };
      sectorSelect.addEventListener('change', handleSectorChange);
      sectorSelect.addEventListener('input', handleSectorChange);
    }

    window.addEventListener('resize', drawLines);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
