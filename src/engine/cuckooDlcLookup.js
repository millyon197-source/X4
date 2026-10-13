import cuckooTable from '../data/cuckoo_extensions_table.json' with { type: 'json' };
import { getFriendlyModuleName } from '../data/wares.js';
import { escapeHtml } from '../html.js';

/**
 * DLC Metadata Mapping:
 * Maps extension directory names (as scanned in extensions/) to canonical DLC identifiers and friendly names.
 */
export const DLC_METADATA = {
  ego_dlc_split: {
    id: 'ego_dlc_split',
    name: 'Split Vendetta',
    aliasKeys: ['ego_dlc_split', 'split']
  },
  ego_dlc_terran: {
    id: 'ego_dlc_cradle',
    name: 'Cradle of Humanity',
    aliasKeys: ['ego_dlc_cradle', 'ego_dlc_terran', 'cradle', 'terran']
  },
  ego_dlc_cradle: {
    id: 'ego_dlc_cradle',
    name: 'Cradle of Humanity',
    aliasKeys: ['ego_dlc_cradle', 'ego_dlc_terran', 'cradle', 'terran']
  },
  ego_dlc_pirate: {
    id: 'ego_dlc_pirates',
    name: 'Tides of Avarice',
    aliasKeys: ['ego_dlc_pirates', 'ego_dlc_pirate', 'pirates', 'pirate']
  },
  ego_dlc_pirates: {
    id: 'ego_dlc_pirates',
    name: 'Tides of Avarice',
    aliasKeys: ['ego_dlc_pirates', 'ego_dlc_pirate', 'pirates', 'pirate']
  },
  ego_dlc_boron: {
    id: 'ego_dlc_boron',
    name: 'Kingdom End',
    aliasKeys: ['ego_dlc_boron', 'boron']
  },
  ego_dlc_timelines: {
    id: 'ego_dlc_timelines',
    name: 'Timelines',
    aliasKeys: ['ego_dlc_timelines', 'timelines']
  },
  ego_dlc_par_update: {
    id: 'ego_dlc_par_update',
    name: 'Paranid Update',
    aliasKeys: ['ego_dlc_par_update', 'ego_dlc_par', 'par_update', 'paranid_update', 'ego_dlc_paranid']
  },
  ego_dlc_mini_01: {
    id: 'ego_dlc_mini_01',
    name: 'Bonus / Mini DLC',
    aliasKeys: ['ego_dlc_mini_01', 'mini_01']
  },
  generic: {
    id: 'generic',
    name: 'Base Game (Generic)',
    aliasKeys: ['generic', 'base']
  }
};

/**
 * Cache for active and installed DLC status.
 * Pre-populated with baseline detection so lookups are instantly responsive.
 */
let cachedDlcStatus = {
  ego_dlc_split: { active: false, present: true },
  ego_dlc_cradle: { active: false, present: true },
  ego_dlc_pirates: { active: false, present: true },
  ego_dlc_boron: { active: false, present: true },
  ego_dlc_timelines: { active: false, present: true },
  ego_dlc_par_update: { active: false, present: false }
};

/**
 * Update cached DLC status (e.g. from /api/dlcs or WebSocket event).
 * @param {Object} newDlcs
 */
export function setDlcStatus(newDlcs) {
  if (!newDlcs || typeof newDlcs !== 'object') return false;

  // Protect against unverified all-false payloads wiping out verified DLCs
  const newHasAny = Object.values(newDlcs).some(v => v && (v.active || v.present || v === true || v === 'active' || v === 'present'));
  const cachedHasAny = Object.values(cachedDlcStatus).some(v => v && (v.active || v.present));
  if (!newHasAny && cachedHasAny) {
    return false;
  }

  const prevStr = JSON.stringify(cachedDlcStatus);
  cachedDlcStatus = { ...cachedDlcStatus, ...newDlcs };
  if (typeof window !== 'undefined') {
    window.__currentDlcs = cachedDlcStatus;
  }
  const changed = JSON.stringify(cachedDlcStatus) !== prevStr;
  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dlc-status-changed', { detail: cachedDlcStatus }));
  }
  return changed;
}

/**
 * Get current cached DLC status.
 * @returns {Object}
 */
/**
 * Fetches the latest DLC inclusion status from the companion server.
 * Always performs a fresh request to the API and updates status.
 * Supports /api/dlcs/query or /api/dlcs with cache-busting timestamp.
 * 
 * @param {Object} [options]
 * @param {boolean} [options.queryBridge=false] - Whether to send isolated GetExtensions() command to Lua bridge if online
 * @returns {Promise<Object>}
 */
export async function fetchDlcStatus(options = {}) {
  const ts = Date.now();
  const endpoints = options.queryBridge
    ? [`/api/dlcs/query?_t=${ts}`, `http://localhost:3000/api/dlcs/query?_t=${ts}`, `/api/dlcs?_t=${ts}`, `http://localhost:3000/api/dlcs?_t=${ts}`]
    : [`/api/dlcs?_t=${ts}`, `http://localhost:3000/api/dlcs?_t=${ts}`, `/api/dlcs/query?_t=${ts}`, `http://localhost:3000/api/dlcs/query?_t=${ts}`];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res && res.ok) {
        const data = await res.json();
        const incomingDlcs = (data && data.dlcs) ? data.dlcs : data;
        if (incomingDlcs && typeof incomingDlcs === 'object') {
          setDlcStatus(incomingDlcs);
          return incomingDlcs;
        }
      }
    } catch (e) {
      // try fallback endpoint
    }
  }

  return cachedDlcStatus;
}

/**
 * Ensures getDLCs / getDlcStatus performs a new request to the API each request
 * and updates DLC status, returning the freshly updated status.
 * Can be called synchronously or awaited as a Promise.
 * 
 * @param {Object} [options]
 * @returns {Promise<Object> & Object}
 */
export function getDLCs(options = {}) {
  // Fire off fresh API request immediately to update status
  const requestPromise = fetchDlcStatus(options);
  
  // Create hybrid object: behaves as Promise and exposes latest cached status immediately
  return Object.assign(requestPromise, {
    cached: cachedDlcStatus,
    ...cachedDlcStatus
  });
}

/**
 * Alias for getDLCs()
 */
export function getDlcStatus(options = {}) {
  return getDLCs(options);
}

// Initial fetch if running in browser
if (typeof window !== 'undefined') {
  fetchDlcStatus().catch(() => {});
}

/**
 * Primary Hash Function h1: DJB2 hash modulo tableSize (1847)
 * @param {string} key
 * @param {number} size
 * @returns {number}
 */
export function getCuckooHash1(key, size = 1847) {
  let h = 5381;
  const str = String(key || '');
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) + str.charCodeAt(i)) % size;
  }
  return (h + size) % size;
}

/**
 * Secondary Hash Function h2: FNV/Polynomial hash modulo tableSize (1847)
 * @param {string} key
 * @param {number} size
 * @returns {number}
 */
export function getCuckooHash2(key, size = 1847) {
  let h = 0;
  const str = String(key || '');
  for (let i = 0; i < str.length; i++) {
    h = ((h * 31) + str.charCodeAt(i)) % size;
  }
  return (h + size) % size;
}

/**
 * Resolves candidate keys for searching in cuckoo_extensions_table.
 * @param {string} rawKey
 * @returns {string[]}
 */
function getCandidateKeys(rawKey) {
  if (!rawKey) return [];
  const clean = String(rawKey).trim();
  const lower = clean.toLowerCase();
  const candidates = new Set();

  candidates.add(clean);
  candidates.add(lower);

  // Strip _macro suffix if present
  if (lower.endsWith('_macro')) {
    const stripped = clean.slice(0, -6);
    candidates.add(stripped);
    candidates.add(stripped.toLowerCase());
  }

  // Strip macro_ prefix if present
  if (lower.startsWith('macro_')) {
    const stripped = clean.slice(6);
    candidates.add(stripped);
    candidates.add(stripped.toLowerCase());
  }

  return Array.from(candidates);
}

/**
 * Performs O(1) Pagh-Rodler Cuckoo search in cuckoo_extensions_table.
 * Probes Table 1 (h1) then Table 2 (h2) in <= 2 memory probes,
 * falling back to lookupMap if needed.
 * 
 * @param {string} moduleName - Module identifier or macro name
 * @returns {{ found: boolean, key: string|null, value: string|null, extensions: string[], table: number|null, slot: number|null }}
 */
export function searchCuckooExtensionsTable(moduleName) {
  if (!moduleName || !cuckooTable) {
    return { found: false, key: null, value: null, extensions: [], table: null, slot: null };
  }

  const tableSize = cuckooTable.tableSize || 1847;
  const t1 = Array.isArray(cuckooTable.table1?.value) ? cuckooTable.table1.value : (Array.isArray(cuckooTable.table1) ? cuckooTable.table1 : []);
  const t2 = Array.isArray(cuckooTable.table2?.value) ? cuckooTable.table2.value : (Array.isArray(cuckooTable.table2) ? cuckooTable.table2 : []);
  const lookupMap = cuckooTable.lookupMap || {};

  const candidates = getCandidateKeys(moduleName);

  for (const cand of candidates) {
    // 1. Probe Table 1 at hash1(cand)
    const p1 = getCuckooHash1(cand, tableSize);
    const e1 = t1[p1];
    if (e1) {
      const eKey = e1.Key || e1.key;
      if (eKey && (eKey === cand || eKey.toLowerCase() === cand.toLowerCase())) {
        const val = e1.Value || e1.value || '';
        const exts = Array.isArray(e1.Extensions) ? e1.Extensions : val.split(',').map(s => s.trim()).filter(Boolean);
        return {
          found: true,
          key: eKey,
          value: val,
          extensions: exts,
          table: 1,
          slot: p1
        };
      }
    }

    // 2. Probe Table 2 at hash2(cand)
    const p2 = getCuckooHash2(cand, tableSize);
    const e2 = t2[p2];
    if (e2) {
      const eKey = e2.Key || e2.key;
      if (eKey && (eKey === cand || eKey.toLowerCase() === cand.toLowerCase())) {
        const val = e2.Value || e2.value || '';
        const exts = Array.isArray(e2.Extensions) ? e2.Extensions : val.split(',').map(s => s.trim()).filter(Boolean);
        return {
          found: true,
          key: eKey,
          value: val,
          extensions: exts,
          table: 2,
          slot: p2
        };
      }
    }

    // 3. Direct lookup in lookupMap
    if (lookupMap[cand]) {
      const val = lookupMap[cand];
      const exts = val.split(',').map(s => s.trim()).filter(Boolean);
      return {
        found: true,
        key: cand,
        value: val,
        extensions: exts,
        table: null,
        slot: null
      };
    }
  }

  // Also check case-insensitive match on lookupMap keys
  const lowerCandSet = new Set(candidates.map(c => c.toLowerCase()));
  for (const [mapKey, val] of Object.entries(lookupMap)) {
    if (lowerCandSet.has(mapKey.toLowerCase())) {
      const exts = val.split(',').map(s => s.trim()).filter(Boolean);
      return {
        found: true,
        key: mapKey,
        value: val,
        extensions: exts,
        table: null,
        slot: null
      };
    }
  }

  // Fallback: Check if module name contains race DLC tags
  const lowerMod = String(moduleName || '').toLowerCase();
  if (lowerMod.includes('_bor_') || lowerMod.includes('boron')) {
    return { found: true, key: moduleName, value: 'ego_dlc_boron', extensions: ['ego_dlc_boron'], table: null, slot: null };
  }
  if (lowerMod.includes('_ter_') || lowerMod.includes('terran') || lowerMod.includes('_atf_') || lowerMod.includes('torus')) {
    return { found: true, key: moduleName, value: 'ego_dlc_terran', extensions: ['ego_dlc_terran'], table: null, slot: null };
  }
  if (lowerMod.includes('_spl_') || lowerMod.includes('split')) {
    return { found: true, key: moduleName, value: 'ego_dlc_split', extensions: ['ego_dlc_split'], table: null, slot: null };
  }
  if (lowerMod.includes('_pir_') || lowerMod.includes('pirate') || lowerMod.includes('erlking') || lowerMod.includes('condensate')) {
    return { found: true, key: moduleName, value: 'ego_dlc_pirate', extensions: ['ego_dlc_pirate'], table: null, slot: null };
  }
  if (lowerMod.includes('timelines')) {
    return { found: true, key: moduleName, value: 'ego_dlc_timelines', extensions: ['ego_dlc_timelines'], table: null, slot: null };
  }

  return { found: false, key: null, value: null, extensions: [], table: null, slot: null };
}

/**
 * Resolves the primary DLC for a given module and list of extensions.
 * Many assets are present in multiple extension directories (e.g. ego_dlc_boron and ego_dlc_terran).
 * This inspects racial tags (_bor_, _ter_, _spl_, _pir_) to pick the primary required DLC.
 * 
 * @param {string} moduleName
 * @param {string[]} extensions
 * @returns {string} Primary extension directory name
 */
export function resolvePrimaryExtension(moduleName, extensions = []) {
  if (!extensions || extensions.length === 0) return '';
  if (extensions.length === 1) return extensions[0];

  const lower = String(moduleName || '').toLowerCase();
  if (lower.includes('_bor_') || lower.includes('boron')) {
    const bor = extensions.find(e => e.includes('boron'));
    if (bor) return bor;
  }
  if (lower.includes('_ter_') || lower.includes('terran') || lower.includes('_atf_') || lower.includes('torus')) {
    const ter = extensions.find(e => e.includes('terran') || e.includes('cradle'));
    if (ter) return ter;
  }
  if (lower.includes('_spl_') || lower.includes('split')) {
    const spl = extensions.find(e => e.includes('split'));
    if (spl) return spl;
  }
  if (lower.includes('_pir_') || lower.includes('pirate') || lower.includes('erlking') || lower.includes('condensate')) {
    const pir = extensions.find(e => e.includes('pirate'));
    if (pir) return pir;
  }
  if (lower.includes('timelines')) {
    const tl = extensions.find(e => e.includes('timelines'));
    if (tl) return tl;
  }

  // Fallback to first non-mini extension
  return extensions.find(e => !e.includes('mini')) || extensions[0];
}

/**
 * Evaluates the status of a specific extension/DLC against cached DLC inclusion.
 * 
 * @param {string} extensionName - e.g. 'ego_dlc_terran' or 'ego_dlc_boron'
 * @param {Object} [dlcStatus=cachedDlcStatus] - DLC status dictionary
 * @returns {{
 *   extensionId: string,
 *   dlcKey: string,
 *   dlcName: string,
 *   active: boolean,
 *   present: boolean,
 *   statusCode: 'active' | 'present' | 'missing',
 *   statusBadge: string,
 *   statusLabel: string,
 *   statusIcon: string,
 *   statusMessage: string
 * }}
 */
export function evaluateExtensionStatus(extensionName, dlcStatus = cachedDlcStatus) {
  const extKey = String(extensionName || '').trim().toLowerCase();
  const meta = DLC_METADATA[extKey] || {
    id: extKey,
    name: extKey.replace(/^ego_dlc_/, '').replace(/_/g, ' ').toUpperCase(),
    aliasKeys: [extKey]
  };

  let active = false;
  let present = false;

  if (extKey === 'generic' || extKey === 'base') {
    active = true;
    present = true;
  } else {
    // Search across meta alias keys in dlcStatus
    for (const alias of (meta.aliasKeys || [extKey])) {
      const statusObj = dlcStatus[alias];
      if (statusObj) {
        if (typeof statusObj === 'object') {
          if (statusObj.present) present = true;
          if (statusObj.active) { active = true; present = true; }
        } else if (typeof statusObj === 'boolean') {
          if (statusObj) { active = true; present = true; }
        } else if (statusObj === 'active') {
          active = true;
          present = true;
        } else if (statusObj === 'present') {
          present = true;
        }
      }
    }
  }

  let statusCode = 'missing';
  let statusIcon = '⚪';
  let statusBadge = 'status-missing';
  let statusLabel = 'Not Installed';
  let statusMessage = `Extension "${meta.name}" is not installed in the game directory.`;

  if (active) {
    statusCode = 'active';
    statusIcon = '🟢';
    statusBadge = 'status-active';
    statusLabel = (extKey === 'generic' || extKey === 'base') ? 'Active (Base Game)' : 'Active in Current Game';
    statusMessage = (extKey === 'generic' || extKey === 'base')
      ? 'Module belongs to the base game and is always active.'
      : `DLC "${meta.name}" is active and loaded in the current game session.`;
  } else if (present) {
    statusCode = 'present';
    statusIcon = '🟣';
    statusBadge = 'status-present';
    statusLabel = 'Present (Not Active in Current Save)';
    statusMessage = `DLC "${meta.name}" is installed on disk, but inactive in this game save.`;
  }

  return {
    extensionId: extKey,
    dlcKey: meta.id,
    dlcName: meta.name,
    active,
    present,
    statusCode,
    statusBadge,
    statusLabel,
    statusIcon,
    statusMessage
  };
}

/**
 * Searches the module name in cuckoo_extensions_table, evaluates DLC status,
 * and compiles comprehensive status details for popup presentation.
 * 
 * @param {string} moduleName
 * @param {Object} [dlcStatus=cachedDlcStatus]
 * @returns {{
 *   found: boolean,
 *   moduleName: string,
 *   friendlyName: string,
 *   cuckooKey: string|null,
 *   rawExtensionsValue: string|null,
 *   extensions: string[],
 *   primaryDlc: Object|null,
 *   allDlcs: Object[],
 *   statusSummary: string,
 *   table: number|null,
 *   slot: number|null
 * }}
 */
export function checkModuleDlcStatus(moduleName, dlcStatus = cachedDlcStatus) {
  const rawKey = String(moduleName || 'unknown').trim();
  const friendlyName = getFriendlyModuleName(rawKey);

  const searchResult = searchCuckooExtensionsTable(rawKey);

  if (!searchResult.found) {
    return {
      found: false,
      moduleName: rawKey,
      friendlyName,
      cuckooKey: null,
      rawExtensionsValue: null,
      extensions: [],
      primaryDlc: null,
      allDlcs: [],
      statusSummary: 'Not found in extensions catalog',
      table: null,
      slot: null
    };
  }

  const primaryExt = resolvePrimaryExtension(rawKey, searchResult.extensions);
  const primaryDlc = evaluateExtensionStatus(primaryExt, dlcStatus);
  const allDlcs = searchResult.extensions.map(ext => evaluateExtensionStatus(ext, dlcStatus));

  return {
    found: true,
    moduleName: rawKey,
    friendlyName,
    cuckooKey: searchResult.key,
    rawExtensionsValue: searchResult.value,
    extensions: searchResult.extensions,
    primaryDlc,
    allDlcs,
    statusSummary: `${primaryDlc.statusIcon} ${primaryDlc.dlcName}: ${primaryDlc.statusLabel}`,
    table: searchResult.table,
    slot: searchResult.slot
  };
}

// Active warnings tracker for deduplication (preventing duplicate alerts within 4.5s)
const activeModuleWarnings = new Map();

/**
 * Presents the Undefined Module Warning popup with Cuckoo table lookup & DLC status.
 * Relies on the close button for dismissal, and deduplicates rapid repeated calls.
 * 
 * @param {string} macroOrWare - Undefined module identifier
 * @param {Object} [options]
 * @returns {Object} Search and status evaluation result
 */
export function showUndefinedModuleDlcPopup(macroOrWare, options = {}) {
  const key = String(macroOrWare || 'unknown').trim();
  const now = Date.now();

  // Deduplicate calls within 4500ms for the same module
  if (activeModuleWarnings.has(key)) {
    const lastTime = activeModuleWarnings.get(key);
    if (now - lastTime < 4500) {
      return checkModuleDlcStatus(key);
    }
  }
  activeModuleWarnings.set(key, now);

  const dlcInfo = checkModuleDlcStatus(key);
  const friendlyName = dlcInfo.friendlyName || getFriendlyModuleName(key);

  let message = '';
  if (dlcInfo.found && dlcInfo.primaryDlc) {
    message = `Undefined module "${friendlyName}" (${key}): Belongs to DLC [${dlcInfo.primaryDlc.dlcName}]. Status: ${dlcInfo.primaryDlc.statusLabel}`;
  } else {
    message = `Undefined module "${friendlyName}" (${key}): Construction recipe not found in catalog.`;
  }

  // Dispatch custom event and attach to window
  if (typeof window !== 'undefined') {
    window.__lastUndefinedModuleWarning = {
      macro: key,
      friendlyName,
      message,
      dlcInfo,
      timestamp: now,
    };
    window.dispatchEvent(new CustomEvent('undefined-module-warning', {
      detail: { macro: key, friendlyName, message, dlcInfo }
    }));
  }

  if (typeof document === 'undefined') {
    console.warn(`[UndefinedModule Warning] ${message}`);
    return dlcInfo;
  }

  // Manage popup rack
  let rack = document.getElementById('undefinedModulePopupRack');
  if (!rack) {
    rack = document.createElement('div');
    rack.id = 'undefinedModulePopupRack';
    rack.className = 'undefined-module-popup-rack';
    document.body.appendChild(rack);
  }

  const popup = document.createElement('div');
  popup.className = 'undefined-module-warning-popup';
  popup.setAttribute('role', 'alert');
  popup.setAttribute('aria-live', 'assertive');

  let bodyContentHtml = '';

  if (dlcInfo.found && dlcInfo.primaryDlc) {
    const pDlc = dlcInfo.primaryDlc;
    const isMultiple = dlcInfo.allDlcs.length > 1;

    bodyContentHtml = `
      <div class="warning-popup-module-line">
        Undefined module: <strong>${escapeHtml(friendlyName)}</strong> (<code>${escapeHtml(key)}</code>)
      </div>
      <div class="dlc-status-container">
        <div class="dlc-status-row">
          <span class="dlc-label">Required Extension:</span>
          <span class="dlc-name"><strong>${escapeHtml(pDlc.dlcName)}</strong> (<code>${escapeHtml(pDlc.extensionId)}</code>)</span>
        </div>
        <div class="dlc-status-row">
          <span class="dlc-label">DLC Status:</span>
          <span class="dlc-status-pill ${escapeHtml(pDlc.statusBadge)}">
            ${escapeHtml(pDlc.statusIcon)} ${escapeHtml(pDlc.statusLabel)}
          </span>
        </div>
        <div class="dlc-status-detail-msg">
          ${escapeHtml(pDlc.statusMessage)}
        </div>
        ${isMultiple ? `
          <div class="dlc-other-extensions">
            <span class="dlc-other-label">Also listed in:</span>
            ${dlcInfo.allDlcs.filter(d => d.extensionId !== pDlc.extensionId).map(d => `
              <span class="dlc-mini-tag ${escapeHtml(d.statusBadge)}" title="${escapeHtml(d.statusLabel)}">
                ${escapeHtml(d.dlcName)} (${escapeHtml(d.statusIcon)})
              </span>
            `).join(' ')}
          </div>
        ` : ''}
        <div class="dlc-cuckoo-meta">
          <span>Found in Cuckoo Table${dlcInfo.table ? ` [T${dlcInfo.table} slot ${dlcInfo.slot}]` : ''}: <code>${escapeHtml(dlcInfo.cuckooKey)}</code></span>
        </div>
      </div>
    `;
  } else {
    bodyContentHtml = `
      <div class="warning-popup-module-line">
        Undefined module: <strong>${escapeHtml(friendlyName)}</strong> (<code>${escapeHtml(key)}</code>)
      </div>
      <div class="dlc-status-container">
        <div class="dlc-status-detail-msg">
          Construction recipe not found in catalog and not found in scanned DLC extensions.
        </div>
      </div>
    `;
  }

  popup.innerHTML = `
    <div class="warning-popup-header">
      <span class="warning-popup-icon">⚠️</span>
      <div class="warning-popup-title-area">
        <strong class="warning-popup-title">Undefined Module Warning</strong>
      </div>
      <button type="button" class="warning-popup-close" aria-label="Close" title="Close warning">×</button>
    </div>
    <div class="warning-popup-body">
      ${bodyContentHtml}
    </div>
  `;

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    popup.classList.add('warning-fade-out');
    setTimeout(() => {
      popup.remove();
      if (rack && rack.children.length === 0) {
        rack.remove();
      }
    }, 250);
  };

  const closeBtn = popup.querySelector('.warning-popup-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', dismiss);
  }

  rack.appendChild(popup);

  return dlcInfo;
}

/**
 * Resolves DLC metadata and availability status for a Not Owned module.
 * 
 * @param {string} macroOrWare
 * @returns {{
 *   isDlc: boolean,
 *   dlcName: string|null,
 *   extensionId: string,
 *   statusCode: 'active' | 'present' | 'missing' | 'base',
 *   statusBadge: string,
 *   statusLabel: string,
 *   statusIcon: string,
 *   statusMessage: string,
 *   tagText: string,
 *   tooltip: string
 * }}
 */
export function getNotOwnedModuleDlcInfo(macroOrWare) {
  const statusInfo = checkModuleDlcStatus(macroOrWare);
  const isDlc = Boolean(
    statusInfo &&
    statusInfo.primaryDlc &&
    statusInfo.primaryDlc.extensionId !== 'generic' &&
    statusInfo.primaryDlc.extensionId !== 'base'
  );

  if (isDlc) {
    const pDlc = statusInfo.primaryDlc;

    // Collect unique DLC extensions
    const uniqueDlcs = [];
    const seenNames = new Set();
    if (pDlc && pDlc.dlcName && pDlc.extensionId !== 'generic' && pDlc.extensionId !== 'base') {
      seenNames.add(pDlc.dlcName);
      uniqueDlcs.push(pDlc);
    }
    for (const d of (statusInfo.allDlcs || [])) {
      if (d && d.dlcName && d.extensionId !== 'generic' && d.extensionId !== 'base' && !seenNames.has(d.dlcName)) {
        seenNames.add(d.dlcName);
        uniqueDlcs.push(d);
      }
    }

    let dlcList = uniqueDlcs.filter(d => !d.extensionId.includes('mini'));
    if (dlcList.length === 0) {
      dlcList = uniqueDlcs;
    }

    let tooltip = '';
    if (dlcList.length > 1) {
      const dlcListStr = dlcList.map(d => {
        const shortStatus = d.statusCode === 'active'
          ? 'Active'
          : (d.statusCode === 'present' ? 'Present' : 'Not Installed');
        const iconStr = d.statusIcon ? `${d.statusIcon} ` : '';
        return `${d.dlcName} (${iconStr}${shortStatus})`;
      }).join(', ');
      tooltip = `Found in DLCs: ${dlcListStr} • Blueprint Not Owned`;
    } else {
      tooltip = `${pDlc.dlcName} DLC: ${pDlc.statusIcon} ${pDlc.statusLabel} • Blueprint Not Owned`;
    }

    return {
      isDlc: true,
      dlcName: pDlc.dlcName,
      dlcNames: dlcList.map(d => d.dlcName),
      allDlcs: dlcList,
      extensionId: pDlc.extensionId,
      statusCode: pDlc.statusCode,
      statusBadge: pDlc.statusBadge,
      statusLabel: pDlc.statusLabel,
      statusIcon: pDlc.statusIcon,
      statusMessage: pDlc.statusMessage,
      tagText: pDlc.dlcName,
      tooltip
    };
  }

  return {
    isDlc: false,
    dlcName: null,
    dlcNames: [],
    allDlcs: [],
    extensionId: 'generic',
    statusCode: 'base',
    statusBadge: 'status-base',
    statusLabel: 'Base Game',
    statusIcon: '',
    statusMessage: 'Base game module blueprint is not owned.',
    tagText: 'Not Owned',
    tooltip: 'Base Game — Blueprint Not Owned'
  };
}

/**
 * Renders the HTML badge for an unowned module.
 * If the module is DLC dependent, displays the DLC friendly name tag with availability colors and tooltip.
 * Otherwise, displays the default "Not Owned" tag.
 * 
 * @param {string} macroOrWare
 * @param {Object} [options]
 * @returns {string} HTML string
 */
export function renderNotOwnedModuleTag(macroOrWare, options = {}) {
  const info = getNotOwnedModuleDlcInfo(macroOrWare);
  const sizeStyle = options.mini ? 'font-size:0.52rem; padding:0.01rem 0.25rem;' : 'font-size:0.56rem; padding:0.02rem 0.35rem;';
  
  if (info.isDlc) {
    return `<span class="not-owned-label not-owned-dlc-tag ${escapeHtml(info.statusBadge)}" style="${sizeStyle}" title="${escapeHtml(info.tooltip)}">${escapeHtml(info.tagText)}</span>`;
  }

  return `<span class="not-owned-label" style="${sizeStyle}" title="${escapeHtml(info.tooltip)}">Not Owned</span>`;
}

if (typeof window !== 'undefined') {
  window.searchCuckooExtensionsTable = searchCuckooExtensionsTable;
  window.checkModuleDlcStatus = checkModuleDlcStatus;
  window.showUndefinedModuleDlcPopup = showUndefinedModuleDlcPopup;
  window.setDlcStatus = setDlcStatus;
  window.getDlcStatus = getDlcStatus;
  window.getDLCs = getDLCs;
  window.fetchDlcStatus = fetchDlcStatus;
  window.getNotOwnedModuleDlcInfo = getNotOwnedModuleDlcInfo;
  window.renderNotOwnedModuleTag = renderNotOwnedModuleTag;
}
