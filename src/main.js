import './style.css';
import { PRESET_BLUEPRINTS, mapMacroToWare, WARES_DB, getFriendlyModuleName } from './data/wares.js';
import { state, store, saveActiveBlueprintToStorage, isHostedMode, clearBlueprintInternalStorage, collapseAllBiComponents, clearCustomOutputs, hasLoadedBlueprint } from './state/store.js';
import { calculateFactoryRequirements, getPrimaryMacroForWare } from './engine/calculator.js';
import { applyMatchNeeds } from './engine/matchNeeds.js';
import { parseXMLBlueprint, removeActiveBlueprint, rebuildBlueprintFromMacros, reloadActiveBlueprint, switchLoadedBlueprint, removeLoadedBlueprint } from './engine/xmlParser.js';
import { renderMatrixTabHTML, drawLines, highlightGraph, filterWares, selectWare, updateInspector, centerOnWare, getCenteredWareId, showNoBlueprintPopup, alignSubdueLevel4, updateModuleCountFromDiff } from './ui/matrixView.js';
import { renderPlannedTabHTML, filterPlannedModules, setupCumulativeMacroDropdown, alignAddMacroDropdown, focusPlannedModule, getKnownMacrosList } from './ui/plannedView.js';
import { isWorkforceStructure, hasWorkforceStructures, autoSupportWorkforceWithFoodAndMedicine, calculateBlueprintWorkforce, applySupportWorkforce, getMostProminentFaction, getLargestOwnedHabitatMacro, isWorkforceFullySupported } from './engine/workforce.js';
import { version as appVersion } from '../package.json';
import { escapeHtml } from './html.js';
import { showCreateBlueprintModal, generateBlueprintXML, downloadXMLFile, showToastNotification } from './engine/blueprintExporter.js';
import { io } from 'socket.io-client';
import { isWareModuleOwned } from './engine/blueprintOwnership.js';
import { fetchDlcStatus, setDlcStatus, getDLCs, getDlcStatus, showUndefinedModuleDlcPopup, checkModuleDlcStatus } from './engine/cuckooDlcLookup.js';

export async function fetchServerBlueprints(isUserTriggered = false) {
  try {
    let updateData = null;
    if (isUserTriggered) {
      try {
        let reqRes = null;
        try {
          reqRes = await fetch('/api/request-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'all', action: 'HARVEST_TABLE' })
          });
        } catch (eReq1) {
          reqRes = await fetch('http://localhost:3000/api/request-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'all', action: 'HARVEST_TABLE' })
          });
        }
        if (reqRes && reqRes.ok) {
          updateData = await reqRes.json();
        }
      } catch (eReq) {
        console.warn('request-update failed, falling back to direct sync-savegame:', eReq.message);
        try {
          await fetch('/api/sync-savegame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'all' })
          });
        } catch (e0) {
          try {
            await fetch('http://localhost:3000/api/sync-savegame', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ table: 'all' })
            });
          } catch (e00) {}
        }
      }
    }

    // If request-update returned valid entries directly, apply them (filtering modules and equipment)
    if (updateData?.entry?.data && Array.isArray(updateData.entry.data) && updateData.entry.data.length > 0) {
      const modules = updateData.entry.data.filter(b => !b.group || b.group === 'modules' || b.group === 'equipment');
      store.setServerModules(modules);
      if (typeof renderApp === 'function') {
        renderApp();
      }
      if (isUserTriggered) {
        const owned = modules.filter(m => Boolean(m.unlocked)).length;
        const sourceLabel = updateData.source === 'game_engine' ? 'live game' : 'savegame';
        showToastNotification(`Synced ${modules.length} blueprints (${owned} owned, ${modules.length - owned} unowned) via ${sourceLabel}`);
      }
      return modules;
    }

    let res = null;
    const cacheBuster = `?_t=${Date.now()}`;
    const fetchOptions = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    };
    try {
      res = await fetch(`/api/blueprints/all${cacheBuster}`, fetchOptions);
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e1) {
      try {
        res = await fetch(`http://localhost:3000/api/blueprints/all${cacheBuster}`, fetchOptions);
      } catch (e2) {
        res = await fetch(`/api/blueprints/modules${cacheBuster}`, fetchOptions).catch(() => null);
      }
    }
    if (res && res.ok) {
      const rawData = await res.json();
      if (Array.isArray(rawData)) {
        const modules = rawData.filter(b => !b.group || b.group === 'modules' || b.group === 'equipment');
        store.setServerModules(modules);
        if (typeof renderApp === 'function') {
          renderApp();
        }
        if (isUserTriggered) {
          const owned = modules.filter(m => Boolean(m.unlocked)).length;
          showToastNotification(`Synced ${modules.length} blueprints (${owned} owned, ${modules.length - owned} unowned)`);
        }
        return modules;
      }
    }
  } catch (err) {
    console.warn('Could not fetch blueprints from server:', err.message);
    if (isUserTriggered) {
      showToastNotification('Could not connect to companion server on port 3000');
    }
  }
  return null;
}

let socket = null;
export function initSocketConnection() {
  if (socket) return;
  try {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const socketUrl = isLocal ? 'http://localhost:3000' : undefined;

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 5000
    });

    socket.on('connect', () => {
      console.log('🔌 Connected to companion server websocket:', socket.id);
      fetchServerBlueprints(false);
      fetchDlcStatus().then(() => renderApp()).catch(() => {});
    });

    socket.on('blueprint_ownership_changed', (data) => {
      if (data && data.id) {
        store.updateModuleOwnership(data.id, data.unlocked);
        renderApp();
      }
    });

    socket.on('encyclopedia_updated', (data) => {
      if (data && Array.isArray(data.blueprints)) {
        const mods = data.blueprints.filter(b => b.group === 'modules' || b.group === 'equipment');
        store.setServerModules(mods);
        renderApp();
      } else if (data && Array.isArray(data.modules)) {
        store.setServerModules(data.modules);
        renderApp();
      }
    });

    socket.on('dlcs_updated', (dlcs) => {
      if (dlcs) {
        const changed = setDlcStatus(dlcs);
        if (changed) renderApp();
      }
    });

    socket.on('game_state_changed', (stateData) => {
      if (stateData && stateData.dlcs) {
        const changed = setDlcStatus(stateData.dlcs);
        if (changed) renderApp();
      }
    });

    socket.on('table_updated', (data) => {
      if (data && data.table === 'dlcs') {
        const targetDlcs = data.dlcs || data.entry?.data;
        if (targetDlcs) {
          const changed = setDlcStatus(targetDlcs);
          if (changed) renderApp();
        }
      }
      if (data && ['modules', 'all', 'blueprints', 'equipment', 'ships'].includes(data.table)) {
        fetchServerBlueprints(false);
      }
    });

    socket.on('reload_ui', (data) => {
      reloadAppUI(data);
    });

    socket.on('game_loaded', (data) => {
      reloadAppUI(data);
    });
  } catch (err) {
    console.warn('Socket.IO initialization error:', err);
  }
}

let isReloadingUI = false;

/**
 * Reloads the app UI upon detection of <event_game_loaded/> from the game backend.
 * Re-fetches fresh blueprint & DLC data, triggers a toast notification,
 * and reloads the browser UI page.
 * 
 * @param {Object} [data]
 */
export function reloadAppUI(data = {}) {
  if (isReloadingUI) return;
  isReloadingUI = true;
  console.log('🔄 [MD event_game_loaded] Game loaded detected: reloading app UI...', data);

  try {
    showToastNotification('Game load detected — Reloading UI...');
  } catch (e) {}

  if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
    setTimeout(() => {
      window.location.reload();
    }, 450);
  } else {
    fetchServerBlueprints(true);
    fetchDlcStatus().catch(() => {});
    if (typeof renderApp === 'function') {
      renderApp();
    }
    setTimeout(() => { isReloadingUI = false; }, 2000);
  }
}

let lastKnownServerEncSync = null;

export async function checkServerPollStatus() {
  try {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const baseUrl = isLocal ? 'http://localhost:3000' : '';
    const res = await fetch(`${baseUrl}/api/poll-status?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.lastEncyclopediaSync) {
        if (lastKnownServerEncSync === null) {
          lastKnownServerEncSync = data.lastEncyclopediaSync;
        } else if (lastKnownServerEncSync !== data.lastEncyclopediaSync) {
          console.log(`🔄 Encyclopedia update detected via poll status: ${lastKnownServerEncSync} -> ${data.lastEncyclopediaSync}`);
          lastKnownServerEncSync = data.lastEncyclopediaSync;
          await fetchServerBlueprints(false);
          await fetchDlcStatus().catch(() => {});
          if (typeof renderApp === 'function') {
            renderApp();
          }
        }
      }
    }
  } catch (e) {}
}

// Continuously sync DLC status & encyclopedia status with companion server every 2 seconds
if (typeof window !== 'undefined') {
  setInterval(async () => {
    try {
      await checkServerPollStatus();
      const updated = await fetchDlcStatus();
      if (updated) {
        const changed = setDlcStatus(updated);
        if (changed) {
          console.log('🔄 DLC status updated via 2s companion sync, re-rendering app:', updated);
          renderApp();
        }
      }
    } catch (e) {}
  }, 2000);

  // When user alt-tabs or switches back to this open browser tab, immediately reconnect and sync
  const onTabActive = () => {
    if (socket && !socket.connected) {
      socket.connect();
    }
    checkServerPollStatus();
    fetchDlcStatus().then(updated => {
      if (updated && setDlcStatus(updated)) renderApp();
    }).catch(() => {});
  };

  window.addEventListener('focus', onTabActive);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onTabActive();
    }
  });
}

if (typeof window !== 'undefined') {
  window.state = state;
  window.store = store;
  window.WARES_DB = WARES_DB;
  window.calculateFactoryRequirements = calculateFactoryRequirements;
  window.renderMatrixTabHTML = renderMatrixTabHTML;
  window.updateInspector = updateInspector;
  window.updateModuleCountFromDiff = updateModuleCountFromDiff;
  window.alignSubdueLevel4 = alignSubdueLevel4;
  window.isHostedMode = isHostedMode;
  window.clearBlueprintInternalStorage = clearBlueprintInternalStorage;
  window.calculateBlueprintWorkforce = calculateBlueprintWorkforce;
  window.applySupportWorkforce = applySupportWorkforce;
  window.getMostProminentFaction = getMostProminentFaction;
  window.getLargestOwnedHabitatMacro = getLargestOwnedHabitatMacro;
  window.isWorkforceFullySupported = isWorkforceFullySupported;
  window.saveCurrentPanelAsBlueprint = saveCurrentPanelAsBlueprint;
  window.renderApp = renderApp;
  window.fetchServerBlueprints = fetchServerBlueprints;
  window.reloadAppUI = reloadAppUI;
  window.initSocketConnection = initSocketConnection;
  window.isWareModuleOwned = isWareModuleOwned;
  window.fetchDlcStatus = fetchDlcStatus;
  window.setDlcStatus = setDlcStatus;
  window.getDLCs = getDLCs;
  window.getDlcStatus = getDlcStatus;
  window.showUndefinedModuleDlcPopup = showUndefinedModuleDlcPopup;
  window.checkModuleDlcStatus = checkModuleDlcStatus;
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

let isRestoringPlannedFocus = false;
let restoreFocusRaf = null;
let restoreFocusTimer = null;

export function savePlannedPositions() {
  if (state.activeTab !== 'planned' || isRestoringPlannedFocus) return;
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
        const valLen = String(active.value ?? '').length;
        state.plannedScroll.cursorStart = active.selectionStart !== null && active.selectionStart !== undefined ? active.selectionStart : valLen;
        state.plannedScroll.cursorEnd = active.selectionEnd !== null && active.selectionEnd !== undefined ? active.selectionEnd : valLen;
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

  if (restoreFocusRaf !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(restoreFocusRaf);
    restoreFocusRaf = null;
  }
  if (restoreFocusTimer !== null) {
    clearTimeout(restoreFocusTimer);
    restoreFocusTimer = null;
  }

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
      if (document.activeElement === elToFocus) return;
      isRestoringPlannedFocus = true;
      try {
        elToFocus.focus({ preventScroll: true });
        if (elToFocus.classList && elToFocus.classList.contains('macro-qty-input')) {
          // HTML5 input[type="number"] does not support setSelectionRange and defaults caret to index 0 on focus().
          // Resetting .value while focused moves the caret to the end so multi-digit typing (e.g. 56) is not reversed.
          const currentVal = elToFocus.value;
          elToFocus.value = '';
          elToFocus.value = currentVal;
        } else if (typeof elToFocus.setSelectionRange === 'function' && ps.cursorStart !== null && ps.cursorEnd !== null) {
          elToFocus.setSelectionRange(ps.cursorStart, ps.cursorEnd);
        }
      } catch (e) {
      } finally {
        isRestoringPlannedFocus = false;
      }
    }
  };

  restoreFocus();
  restoreFocusRaf = requestAnimationFrame(restoreFocus);
  restoreFocusTimer = setTimeout(restoreFocus, 40);
}

export function saveCurrentPanelAsBlueprint() {
  if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
    rebuildBlueprintFromMacros();
  }
  calculateFactoryRequirements();

  let rawMacros = {};
  if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
    for (const [macro, qty] of Object.entries(state.activeBlueprint.rawMacros)) {
      if (qty > 0) rawMacros[macro] = qty;
    }
  }

  if (Object.keys(rawMacros).length === 0 && state.modules && Object.keys(state.modules).length > 0) {
    for (const [key, count] of Object.entries(state.modules)) {
      if (count > 0) {
        const macro = key.endsWith('_macro') ? key : getPrimaryMacroForWare(key);
        if (macro) {
          rawMacros[macro] = (rawMacros[macro] || 0) + count;
        }
      }
    }
  }

  if (Object.keys(rawMacros).length === 0 && state.activeBlueprint && state.activeBlueprint.modules) {
    for (const [wareId, count] of Object.entries(state.activeBlueprint.modules)) {
      if (count > 0) {
        const macro = getPrimaryMacroForWare(wareId);
        if (macro) {
          rawMacros[macro] = (rawMacros[macro] || 0) + count;
        }
      }
    }
  }

  const totalModules = Object.values(rawMacros).reduce((sum, n) => sum + n, 0);
  if (totalModules === 0) {
    showNoBlueprintPopup();
    return;
  }

  const defaultName = (state.activeBlueprint && state.activeBlueprint.name) || 'Custom Station Plan';

  showCreateBlueprintModal({
    defaultName,
    totalModules,
    onSave: async (chosenName) => {
      const originalXml = (state.originalBlueprint && state.originalBlueprint.rawXml) ||
                          (state.activeBlueprint && state.activeBlueprint.rawXml) ||
                          null;
      const xmlContent = generateBlueprintXML(chosenName, rawMacros, { originalXml });
      const safeFileName = chosenName.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Custom Station Plan';

      downloadXMLFile(xmlContent, `${safeFileName}.xml`);

      try {
        fetch('/api/save-blueprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: `${safeFileName}.xml`, xmlContent })
        }).catch(() => {});
      } catch (e) {}

      if (!state.activeBlueprint) {
        state.activeBlueprint = {
          name: chosenName,
          totalModules,
          modules: {},
          rawMacros: { ...rawMacros },
          rootMacros: { ...rawMacros },
          rawXml: xmlContent
        };
      } else {
        state.activeBlueprint.name = chosenName;
        state.activeBlueprint.rawMacros = { ...rawMacros };
        state.activeBlueprint.rawXml = xmlContent;
        state.activeBlueprint.totalModules = totalModules;
      }

      if (state.originalBlueprint) {
        state.originalBlueprint.name = chosenName;
        state.originalBlueprint.rawXml = xmlContent;
      }

      saveActiveBlueprintToStorage();
      renderApp();
      showToastNotification(`Blueprint "${safeFileName}.xml" saved successfully!`);
    }
  });
}

function renderApp() {
  try {

    if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
      rebuildBlueprintFromMacros();
    }
    calculateFactoryRequirements();

    const isTransitionFromMatrix = (state._prevTab === 'matrix' && state.activeTab === 'planned');
    state._prevTab = state.activeTab;

    if (state.activeTab === 'planned' && !isTransitionFromMatrix) {
      savePlannedPositions();
    }

    const winScrollY = window.scrollY || document.documentElement.scrollTop;
    const winScrollX = window.scrollX || document.documentElement.scrollLeft;

    const prevInsBody = document.getElementById('insBody');
    const preRenderInsScrollTop = prevInsBody ? prevInsBody.scrollTop : 0;

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
          <div class="calc-group" style="display:flex; flex-direction:column; align-items:flex-start; gap:0.4rem; flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <input type="file" id="xmlFileInput" accept=".xml" style="display:none;" />
              <button class="btn-upload" id="btnUploadXML" style="padding:0.25rem 0.65rem; font-size:0.75rem;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Upload .XML Blueprint
              </button>
              <button class="btn-upload btn-sync-blueprints" id="btnSyncBlueprints" style="padding:0.25rem 0.65rem; font-size:0.75rem;" title="Sync Station Module Blueprints from Companion Server">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                ${state.serverModules ? `Blueprints (${state.serverModulesOwnedCount}/${state.serverModulesTotalCount})` : 'Sync Blueprints'}
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
              <div class="web-subdue-line" style="display:flex; align-items:center; width:100%; position:relative; min-height:28px;">
                <div class="slider-group" style="margin:0;">
                  <label for="workforceSlider" class="${state.workforceBonus === 0 ? 'flash-wf-label' : ''}">Workforce Eff Bonus:</label>
                  <button class="btn-qty" id="btnWfDec" title="Decrease workforce bonus by 1% (or 0.1% with Shift)">&lt;</button>
                  <input type="range" id="workforceSlider" min="0" max="100" step="0.1" value="${state.workforceBonus}" />
                  <button class="btn-qty" id="btnWfInc" title="Increase workforce bonus by 1% (or 0.1% with Shift)">&gt;</button>
                  <span id="wfBonusValue" style="font-weight:700; color:#34d399; min-width:45px; cursor:pointer;" title="Click to enter exact Workforce % or Current/Optimal workers">+${Number.isInteger(state.workforceBonus) ? state.workforceBonus : parseFloat(state.workforceBonus.toFixed(2))}%</span>
                </div>
                <label id="lblSubdueLevel4" style="position:absolute; left:${state.subdueL4Left !== null && state.subdueL4Left !== undefined ? `${state.subdueL4Left}px` : (state.subdueL4MarginLeft ? `${state.subdueL4MarginLeft}px` : 'auto')}; top:50%; transform:translateY(-50%); font-size:0.8rem; color:#a78bfa; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; background:rgba(167,139,250,0.12); padding:0.25rem 0.65rem; border-radius:6px; border:1px solid rgba(167,139,250,0.35); user-select:none; white-space:nowrap; transition:left 0.15s ease;" title="When checked, hides the Level 4 Applications column and expands remaining columns across the panel">
                  <input type="checkbox" id="chkSubdueLevel4" ${state.subdueLevel4 ? 'checked' : ''} style="cursor:pointer;" />
                  Subdue Level 4
                </label>
              </div>
            ` : ''}
          </div>

          <div class="calc-group bi-header-slot" style="width:360px; margin-right:-1.5rem; display:flex; justify-content:center; align-items:center; align-self:flex-start; min-height:28px; margin-left:auto; flex-shrink:0;">
            <button class="btn-upload btn-create-bp btn-save-panel-xml" id="btnCreateXML" style="padding:0.25rem 0.75rem; font-size:0.75rem;" title="Save current panel modules as an .xml blueprint file">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              Save Panel as .XML Blueprint
            </button>
          </div>
        </div>
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
      const wareToFocus = state._pendingFocusWareId || null;
      if (wareToFocus) {
        if (state.plannedScroll) {
          delete state.plannedScroll.tableTop;
          delete state.plannedScroll.tableLeft;
          delete state.plannedScroll.wrapperTop;
          delete state.plannedScroll.winY;
          delete state.plannedScroll.lastFocusedId;
          delete state.plannedScroll.lastFocusedMacro;
          delete state.plannedScroll.lastFocusedField;
        }
      } else {
        restorePlannedPositions();
      }
      filterPlannedModules();
      requestAnimationFrame(alignAddMacroDropdown);
      if (wareToFocus) {
        focusPlannedModule(wareToFocus);
        state._pendingFocusWareId = null;
      }
    } else {
      if (winScrollY > 0 || winScrollX > 0) {
        window.scrollTo(winScrollX, winScrollY);
        requestAnimationFrame(() => {
          window.scrollTo(winScrollX, winScrollY);
        });
      }
      updateInspector(state.selectedWareId, renderApp);
      const newInsBody = document.getElementById('insBody');
      if (newInsBody && preRenderInsScrollTop > 0) {
        newInsBody.scrollTop = preRenderInsScrollTop;
        requestAnimationFrame(() => {
          if (newInsBody) newInsBody.scrollTop = preRenderInsScrollTop;
        });
      }
      filterWares();
      setTimeout(drawLines, 50);
      alignSubdueLevel4();
      requestAnimationFrame(alignSubdueLevel4);
      setTimeout(alignSubdueLevel4, 60);
      const wareToCenter = state.selectedWareId;
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
    const prevIns = document.getElementById('insBody');
    const insScrollTop = prevIns ? prevIns.scrollTop : 0;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderMatrixTabHTML();
    const newWrapper = tempDiv.querySelector('.main-wrapper');
    if (newWrapper) {
      mainWrapper.replaceWith(newWrapper);
      setupMatrixEvents();
      updateInspector(state.selectedWareId, renderApp);
      const newIns = document.getElementById('insBody');
      if (newIns && insScrollTop > 0) {
        newIns.scrollTop = insScrollTop;
        requestAnimationFrame(() => {
          if (newIns) newIns.scrollTop = insScrollTop;
        });
      }
      filterWares();
      const newVp = document.getElementById('viewport');
      if (newVp) {
        newVp.scrollTop = vpScrollTop;
        newVp.scrollLeft = vpScrollLeft;
      }
      setTimeout(drawLines, 20);
      alignSubdueLevel4();
      setTimeout(alignSubdueLevel4, 30);
    }
  } else {
    renderApp();
  }
}

function setupMatrixEvents() {
  document.querySelectorAll('.ware-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      if (!state.selectedWareId) {
        highlightGraph(card.dataset.id);
      }
    });
    card.addEventListener('mouseleave', () => {
      if (!state.selectedWareId) {
        if (state.searchQuery && state.searchQuery.trim()) {
          filterWares();
        } else {
          highlightGraph(null);
        }
      }
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('.pp-checkbox-label') || e.target.closest('.pill-output-input') || e.target.closest('.btn-reset-output')) return;
      e.stopPropagation();
      selectWare(card.dataset.id, renderApp);
    });
  });

  document.querySelectorAll('.pill-output-input').forEach(input => {
    const handleAttemptWithoutBlueprint = (e) => {
      if (state.activeTab === 'matrix' && !hasLoadedBlueprint()) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        input.value = '0';
        input.blur();
        showNoBlueprintPopup();
        return true;
      }
      return false;
    };

    input.addEventListener('pointerdown', (e) => {
      if (handleAttemptWithoutBlueprint(e)) return;
      e.stopPropagation();
    });

    input.addEventListener('mousedown', (e) => {
      if (handleAttemptWithoutBlueprint(e)) return;
      e.stopPropagation();
    });

    input.addEventListener('click', (e) => {
      if (handleAttemptWithoutBlueprint(e)) return;
      e.stopPropagation();
    });

    input.addEventListener('focus', (e) => {
      if (handleAttemptWithoutBlueprint(e)) return;
    });

    input.addEventListener('keydown', (e) => {
      if (handleAttemptWithoutBlueprint(e)) return;
      e.stopPropagation();
      if (e.key === 'Enter') {
        input.blur();
      }
    });

    input.addEventListener('input', (e) => {
      if (handleAttemptWithoutBlueprint(e)) return;
    });

    input.addEventListener('change', (e) => {
      if (handleAttemptWithoutBlueprint(e)) return;
      e.stopPropagation();
      const wareId = input.dataset.wareId;
      const rawVal = input.value.trim();
      if (rawVal === '') {
        store.setCustomOutput(wareId, null);
      } else {
        const intVal = parseInt(rawVal, 10);
        if (isNaN(intVal) || intVal < 0) {
          store.setCustomOutput(wareId, null);
        } else {
          store.setCustomOutput(wareId, intVal);
        }
      }
      updateLiveMatrixContent();
    });
  });

  document.querySelectorAll('.btn-reset-output').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.activeTab === 'matrix' && !hasLoadedBlueprint()) {
        e.preventDefault();
        showNoBlueprintPopup();
        return;
      }
      const wareId = btn.dataset.wareId;
      store.setCustomOutput(wareId, null);
      updateLiveMatrixContent();
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

  const vp = document.getElementById('viewport');
  if (vp) {
    vp.addEventListener('scroll', alignSubdueLevel4, { passive: true });
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
      const fromMatrix = state.activeTab === 'matrix';
      state.activeTab = 'planned';
      try {
        sessionStorage.setItem('x4_active_tab', 'planned');
      } catch (e) {}
      if (fromMatrix && (state.selectedWareId || state.lastFocusedWareId)) {
        const targetWare = state.selectedWareId || state.lastFocusedWareId;
        const hasInPlan = Boolean(state.activeBlueprint?.rawMacros && Object.entries(state.activeBlueprint.rawMacros).some(([m, q]) => q > 0 && mapMacroToWare(m) === targetWare));
        if (hasInPlan || !state.lastSelectedAddMacro) {
          state._pendingFocusWareId = targetWare;
          if (state.plannedScroll) {
            delete state.plannedScroll.tableTop;
            delete state.plannedScroll.tableLeft;
            delete state.plannedScroll.wrapperTop;
            delete state.plannedScroll.winY;
            delete state.plannedScroll.lastFocusedId;
            delete state.plannedScroll.lastFocusedMacro;
            delete state.plannedScroll.lastFocusedField;
          }
        }
      }
      renderApp();
    });
  }

  const btnUploadXML = document.getElementById('btnUploadXML');
  const xmlFileInput = document.getElementById('xmlFileInput');

  if (btnUploadXML && xmlFileInput) {
    btnUploadXML.addEventListener('click', () => {
      xmlFileInput.value = '';
      xmlFileInput.click();
    });
    xmlFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => parseXMLBlueprint(event.target.result, file.name, renderApp);
        reader.readAsText(file);
      }
    });
  }

  const btnSyncBlueprints = document.getElementById('btnSyncBlueprints');
  if (btnSyncBlueprints) {
    btnSyncBlueprints.addEventListener('click', async () => {
      btnSyncBlueprints.disabled = true;
      btnSyncBlueprints.style.opacity = '0.7';
      await fetchServerBlueprints(true);
      btnSyncBlueprints.disabled = false;
      btnSyncBlueprints.style.opacity = '1';
    });
  }

  document.querySelectorAll('.btn-save-panel-xml, #btnCreateXML').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveCurrentPanelAsBlueprint();
    });
  });

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


  const chkSubdueLevel4 = document.getElementById('chkSubdueLevel4');
  if (chkSubdueLevel4) {
    chkSubdueLevel4.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      if (store && typeof store.setSubdueLevel4 === 'function') {
        store.setSubdueLevel4(isChecked);
      } else {
        state.subdueLevel4 = isChecked;
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('x4_subdue_level4', String(isChecked));
          } catch (err) {}
        }
      }
      renderApp();
    });
  }

  document.querySelectorAll('.btn-filter[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const presetKey = btn.dataset.preset;

      if (isHostedMode()) {
        clearBlueprintInternalStorage();
      }
      state.currentPreset = presetKey;
      state.selectedWareId = null;
      state.lastFocusedWareId = null;
      state.calculatedDemand = {};
      clearCustomOutputs();
      state.supportWorkforce = false;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('x4_support_workforce', 'false');
        }
      } catch (e) {}
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

  const chkMatchNeedsPlanned = document.getElementById('chkMatchNeedsPlanned');
  if (chkMatchNeedsPlanned) {
    chkMatchNeedsPlanned.addEventListener('change', (e) => {
      applyMatchNeeds(e.target.checked, renderApp);
    });
  }

  const selectFactionMethod = document.getElementById('selectFactionMethod');
  if (selectFactionMethod) {
    selectFactionMethod.addEventListener('change', (e) => {
      state.factionConstructionMethod = e.target.value;
      state.constructionMethod = e.target.value;
      if (hasWorkforceStructures(state.activeBlueprint)) {
        state.filterStructuresPlanned = false;
        state.filterAgriFoodPlanned = false;
        autoSupportWorkforceWithFoodAndMedicine(state.activeBlueprint, state.factionConstructionMethod, true);
        rebuildBlueprintFromMacros();
        saveActiveBlueprintToStorage();
        calculateFactoryRequirements();
      }
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
      state.lastSelectedAddMacro = macro || null;
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          if (macro) sessionStorage.setItem('x4_last_selected_add_macro', macro);
          else sessionStorage.removeItem('x4_last_selected_add_macro');
        }
      } catch (err) {}
      if (macro) {
        const wareId = mapMacroToWare(macro);
        state.selectedWareId = wareId;
      }
    });
  }

  setupCumulativeMacroDropdown();

  if (btnAddMacro && addMacroSelect) {
    btnAddMacro.addEventListener('click', () => {
      let selectedMacro = addMacroSelect.value;
      if (!selectedMacro && state.lastSelectedAddMacro) {
        selectedMacro = state.lastSelectedAddMacro;
        let opt = Array.from(addMacroSelect.options).find(o => o.value === selectedMacro);
        if (!opt) {
          const newOpt = document.createElement('option');
          newOpt.value = selectedMacro;
          let friendly = getFriendlyModuleName(selectedMacro, state.factionConstructionMethod);
          newOpt.textContent = `${friendly} (${selectedMacro})`;
          addMacroSelect.appendChild(newOpt);
        }
        addMacroSelect.value = selectedMacro;
      }
      if (!selectedMacro) {
        alert('Please select a macro module to add.');
        return;
      }
      state.lastSelectedAddMacro = selectedMacro;
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('x4_last_selected_add_macro', selectedMacro);
        }
      } catch (err) {}

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

      if (isWorkforceStructure(selectedMacro)) {
        state.filterStructuresPlanned = false;
        state.filterAgriFoodPlanned = false;
        autoSupportWorkforceWithFoodAndMedicine(state.activeBlueprint, state.factionConstructionMethod);
      }

      rebuildBlueprintFromMacros();
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

    const oldQty = state.activeBlueprint.rawMacros[macro] || 0;

    if (isDelete || newQty <= 0) {
      delete state.activeBlueprint.rootMacros[macro];
      delete state.activeBlueprint.rawMacros[macro];
    } else {
      state.activeBlueprint.rootMacros[macro] = Math.max(0, newQty);
      state.activeBlueprint.rawMacros[macro] = Math.max(0, newQty);
    }

    if (!isDelete && newQty > oldQty && isWorkforceStructure(macro)) {
      state.filterStructuresPlanned = false;
      state.filterAgriFoodPlanned = false;
      autoSupportWorkforceWithFoodAndMedicine(state.activeBlueprint, state.factionConstructionMethod);
    }

    const wareId = mapMacroToWare(macro);
    if (!wareId) {
      state.selectedWareId = null;
    }

    rebuildBlueprintFromMacros();
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

  if (state.activeTab === 'planned') {
    document.querySelectorAll('.macro-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        const macro = row.getAttribute('data-macro');
        const wareId = mapMacroToWare(macro);
        if (wareId) {
          state.selectedWareId = wareId;
          state.lastFocusedWareId = wareId;
        }
        document.querySelectorAll('.macro-row.macro-row-focused').forEach(r => r.classList.remove('macro-row-focused'));
        row.classList.add('macro-row-focused');
        const qtyInput = row.querySelector('.macro-qty-input');
        if (qtyInput) {
          qtyInput.focus();
          const currentVal = qtyInput.value;
          qtyInput.value = '';
          qtyInput.value = currentVal;
        }
      });
    });

    document.querySelectorAll('.macro-qty-input').forEach(input => {
      input.addEventListener('focus', () => {
        const row = input.closest('.macro-row');
        if (row) {
          document.querySelectorAll('.macro-row.macro-row-focused').forEach(r => r.classList.remove('macro-row-focused'));
          row.classList.add('macro-row-focused');
          const macro = row.getAttribute('data-macro');
          const wareId = mapMacroToWare(macro);
          if (wareId) {
            state.selectedWareId = wareId;
            state.lastFocusedWareId = wareId;
          }
        }
      });
    });
  }

  // Matrix View Events
  if (state.activeTab === 'matrix') {
    setupMatrixEvents();
    window.addEventListener('resize', drawLines);
    window.addEventListener('resize', alignSubdueLevel4);
  }
}

if (state.activeBlueprint && state.activeBlueprint.rawXml) {
  rebuildBlueprintFromMacros();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (state.activeBlueprint && state.activeBlueprint.rawXml) {
      rebuildBlueprintFromMacros();
    }
    renderApp();
    fetchServerBlueprints(false);
    fetchDlcStatus().catch(() => {});
    initSocketConnection();
  });
} else {
  renderApp();
  fetchServerBlueprints(false);
  fetchDlcStatus().catch(() => {});
  initSocketConnection();
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
