import './style.css';
import { PRESET_BLUEPRINTS } from './data/wares.js';
import { state } from './engine/state.js';
import { calculateFactoryRequirements } from './engine/calculator.js';
import { parseXMLBlueprint, removeActiveBlueprint, rebuildBlueprintFromMacros, reloadActiveBlueprint, switchLoadedBlueprint, removeLoadedBlueprint } from './engine/xmlParser.js';
import { renderMatrixTabHTML, drawLines, highlightGraph, filterWares, selectWare, updateInspector, centerOnWare } from './ui/matrixView.js';
import { renderPlannedTabHTML } from './ui/plannedView.js';

function renderApp() {
  calculateFactoryRequirements();

  const app = document.getElementById('app');
  app.innerHTML = `
    <header>
      <div class="brand">
        <div class="brand-icon">X4</div>
        <div class="brand-title">
          <h1>Material Supply Chain Matrix</h1>
          <p>Real-Time Station Blueprint Recalculator & Supply Explorer</p>
        </div>
      </div>

      <nav class="nav-tabs">
        <button class="nav-tab-btn ${state.activeTab === 'matrix' ? 'active' : ''}" id="tabBtnMatrix">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Supply Chain Matrix
        </button>
        <button class="nav-tab-btn ${state.activeTab === 'planned' ? 'active' : ''}" id="tabBtnPlanned">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          Planned & Changed Modules
        </button>
      </nav>

      <div class="controls">
        <input type="file" id="xmlFileInput" accept=".xml" style="display:none;" />
        <button class="btn-upload" id="btnUploadXML">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Upload .XML Blueprint
        </button>

        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="search-input" id="searchInput" placeholder="Search ware..." value="${state.searchQuery}" />
        </div>

        ${Object.keys(PRESET_BLUEPRINTS).map(key => {
          const p = PRESET_BLUEPRINTS[key];
          return `
            <button class="btn-filter ${state.currentPreset === key ? 'active' : ''}" data-preset="${key}" title="Left-click to load plan • Right-click to remove preset">
              ${p.label}
            </button>
          `;
        }).join('')}
        <button class="btn-filter ${state.currentPreset === 'all' ? 'active' : ''}" data-preset="all">Single Target Mode</button>
      </div>
    </header>

    <div class="calc-bar">
      <div class="calc-group" style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
        <span style="font-weight:600; color:#94a3b8;">Active Blueprint:</span>
        ${state.activeBlueprint ? `
          <div class="bp-tags-list">
            <div class="bp-tag active-bp-tag">
              <strong id="activeBpName" class="active-bp-name" title="Click to reload this blueprint">${state.activeBlueprint.name} 🔄</strong>
              <span class="bp-entries-badge">${state.activeBlueprint.totalModules} Entries</span>
              <button id="btnRemoveActiveBP" class="btn-remove-bp-tag" title="Remove active blueprint">&times;</button>
            </div>

            ${(state.loadedBlueprints || []).filter(b => b.name !== state.activeBlueprint.name).map(b => {
              const encName = encodeURIComponent(b.name);
              return `
                <div class="bp-tag prev-bp-tag">
                  <span class="btn-switch-bp" data-bp-name="${encName}" title="Click to switch to ${b.name}">${b.name}</span>
                  <span class="bp-entries-badge prev-badge">${b.totalModules}</span>
                  <button class="btn-remove-prev-bp" data-bp-name="${encName}" title="Remove from list">&times;</button>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          ${(state.loadedBlueprints && state.loadedBlueprints.length > 0) ? `
            <div class="bp-tags-list">
              <span style="color:#94a3b8; font-style:italic; font-size:0.8rem; margin-right:0.3rem;">(Single Target Mode)</span>
              ${state.loadedBlueprints.map(b => {
                const encName = encodeURIComponent(b.name);
                return `
                  <div class="bp-tag prev-bp-tag">
                    <span class="btn-switch-bp" data-bp-name="${encName}" title="Click to load ${b.name}">${b.name}</span>
                    <span class="bp-entries-badge prev-badge">${b.totalModules}</span>
                    <button class="btn-remove-prev-bp" data-bp-name="${encName}" title="Remove from list">&times;</button>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <span style="color:#94a3b8; font-style:italic;">No active blueprint loaded (Single Target Mode)</span>
          `}
        `}
      </div>
      ${!state.activeBlueprint ? `
        <div class="calc-group">
          <label for="moduleInput">Target Modules:</label>
          <input type="number" id="moduleInput" class="calc-input" min="1" max="500" value="${state.targetModules}" />
        </div>
      ` : ''}
      <div class="slider-group">
        <label for="workforceSlider">Workforce Efficiency Bonus:</label>
        <button class="btn-qty" id="btnWfDec" title="Decrease workforce bonus by 1%">&lt;</button>
        <input type="range" id="workforceSlider" min="0" max="50" step="1" value="${state.workforceBonus}" />
        <button class="btn-qty" id="btnWfInc" title="Increase workforce bonus by 1%">&gt;</button>
        <span style="font-weight:700; color:#34d399; min-width:45px;">+${state.workforceBonus}%</span>
      </div>
      <div class="calc-group" style="margin-left: 0.5rem;">
        <label style="font-size:0.8rem; color:#fbbf24; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; background:rgba(245,158,11,0.12); padding:0.25rem 0.65rem; border-radius:6px; border:1px solid rgba(245,158,11,0.35);" title="When checked, hides the EC consumption badges on all ware cards">
          <input type="checkbox" id="chkSubdueEcCalc" ${state.subdueEcCalc ? 'checked' : ''} style="cursor:pointer;" />
          Subdue EC Calc
        </label>
      </div>
      <div class="calc-group" style="margin-left: 0.5rem;">
        <label style="font-size:0.8rem; color:#a78bfa; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; background:rgba(167,139,250,0.12); padding:0.25rem 0.65rem; border-radius:6px; border:1px solid rgba(167,139,250,0.35);" title="When checked, hides the Level 4 Applications column and expands remaining columns across the panel">
          <input type="checkbox" id="chkSubdueLevel4" ${state.subdueLevel4 ? 'checked' : ''} style="cursor:pointer;" />
          Subdue Level 4
        </label>
      </div>
    </div>

    ${state.activeTab === 'matrix' ? renderMatrixTabHTML() : renderPlannedTabHTML()}

    <footer>
      <div class="legend-group">
        <div><span class="legend-dot" style="background: #10b981"></span> Active Production Links (Green)</div>
        <div style="opacity:0.6;"><span class="legend-dot" style="background: rgba(148,163,184,0.3); border: 1px dashed #94a3b8;"></span> Subdued Ghost Links (Faint dashed lines)</div>
      </div>
      <div>X4: Foundations Materials & Sector Blueprint Engine v2.4</div>
    </footer>
  `;

  setupEvents();
  if (state.activeTab === 'matrix') {
    updateInspector(state.selectedWareId);
    setTimeout(drawLines, 50);
    if (state.selectedWareId) {
      setTimeout(() => centerOnWare(state.selectedWareId), 60);
    }
  }
}

function setupEvents() {
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
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      if (state.activeTab === 'matrix') filterWares();
    });
  }

  const moduleInput = document.getElementById('moduleInput');
  if (moduleInput) {
    moduleInput.addEventListener('input', (e) => {
      state.targetModules = Math.max(1, parseInt(e.target.value) || 1);
      renderApp();
    });
  }

  const btnWfDec = document.getElementById('btnWfDec');
  if (btnWfDec) {
    btnWfDec.addEventListener('click', () => {
      state.workforceBonus = Math.max(0, state.workforceBonus - 1);
      renderApp();
    });
  }

  const btnWfInc = document.getElementById('btnWfInc');
  if (btnWfInc) {
    btnWfInc.addEventListener('click', () => {
      state.workforceBonus = Math.min(50, state.workforceBonus + 1);
      renderApp();
    });
  }

  const workforceSlider = document.getElementById('workforceSlider');
  if (workforceSlider) {
    workforceSlider.addEventListener('input', (e) => {
      state.workforceBonus = parseInt(e.target.value) || 0;
      renderApp();
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
          rawMacros: {}
        };
      }

      if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
      state.activeBlueprint.rawMacros[selectedMacro] = (state.activeBlueprint.rawMacros[selectedMacro] || 0) + 1;
      rebuildBlueprintFromMacros();
      renderApp();
    });
  }

  document.querySelectorAll('.macro-qty-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const macro = e.target.dataset.macro;
      const newQty = Math.max(0, parseInt(e.target.value) || 0);

      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        if (newQty === 0) {
          delete state.activeBlueprint.rawMacros[macro];
        } else {
          state.activeBlueprint.rawMacros[macro] = newQty;
        }
        rebuildBlueprintFromMacros();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-macro-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        state.activeBlueprint.rawMacros[macro] = (state.activeBlueprint.rawMacros[macro] || 0) + 1;
        rebuildBlueprintFromMacros();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-macro-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        const currentQty = state.activeBlueprint.rawMacros[macro] || 0;
        if (currentQty <= 1) {
          delete state.activeBlueprint.rawMacros[macro];
        } else {
          state.activeBlueprint.rawMacros[macro] = currentQty - 1;
        }
        rebuildBlueprintFromMacros();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-del-macro').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
        delete state.activeBlueprint.rawMacros[macro];
        rebuildBlueprintFromMacros();
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
        highlightGraph(state.selectedWareId);
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

    window.addEventListener('resize', drawLines);
  }
}

document.addEventListener('DOMContentLoaded', renderApp);
