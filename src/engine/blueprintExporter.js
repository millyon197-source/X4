/**
 * X4 Station Construction Plan (Blueprint) XML Exporter
 * Conforms to specification in docs/x4_construction_plan_blueprint_spec.md
 */

import { escapeHtml } from '../html.js';
import { MACRO_TO_WARE, WARES_DB } from '../data/wares.js';

import { state } from '../state/store.js';

/**
 * Escapes characters for XML attribute values and text nodes.
 * @param {string} str 
 * @returns {string}
 */
export function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats an XML string with clean, standardized indentation.
 * @param {string} xmlString
 * @returns {string}
 */
export function formatXmlString(xmlString) {
  let formatted = '';
  const lines = xmlString.replace(/>\s*</g, '>\n<').split('\n');
  let indent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isClosing = line.startsWith('</');
    const isSelfClosing = line.endsWith('/>') || Boolean(line.match(/\/\s*>$/));
    const isSpecial = line.startsWith('<?') || line.startsWith('<!');
    const isSingleLineTagWithContent = Boolean(line.match(/<([^\s>]+)[^>]*>.*<\/\1>/));

    if (isClosing) {
      indent = Math.max(0, indent - 1);
    }

    formatted += '  '.repeat(indent) + line + '\n';

    if (!isClosing && !isSelfClosing && !isSpecial && !isSingleLineTagWithContent) {
      indent++;
    }
  }

  return formatted.trim();
}

/**
 * Checks whether a macro represents an equipment module (turret, shield, weapon).
 * @param {string} macro 
 * @returns {boolean}
 */
export function isEquipmentMacro(macro) {
  if (!macro) return false;
  const l = String(macro).toLowerCase();
  return l.startsWith('turret_') || l.startsWith('shield_') || l.startsWith('weapon_');
}

/**
 * Detects DLC requirements based on macro identifiers present in the plan.
 * @param {Object} rawMacrosMap - { [macroName]: count }
 * @returns {Array<string>} Array of <patch> XML strings
 */
export function detectDlcPatches(rawMacrosMap) {
  const macros = Object.keys(rawMacrosMap || {});
  const patches = [];

  const hasTerran = macros.some(m => m.includes('_ter_'));
  const hasSplit = macros.some(m => m.includes('_spl_'));
  const hasBoron = macros.some(m => m.includes('_bor_'));
  const hasPirate = macros.some(m => m.includes('_pir_') || m.includes('_rip_'));
  const hasTimelines = macros.some(m => m.includes('timelines'));

  if (hasTerran) {
    patches.push('<patch extension="ego_dlc_terran" version="900" name="Cradle of Humanity"/>');
  }
  if (hasSplit) {
    patches.push('<patch extension="ego_dlc_split" version="800" name="Split Vendetta"/>');
  }
  if (hasBoron) {
    patches.push('<patch extension="ego_dlc_boron" version="800" name="Kingdom End"/>');
  }
  if (hasPirate) {
    patches.push('<patch extension="ego_dlc_pirate" version="800" name="Tides of Avarice"/>');
  }
  if (hasTimelines) {
    patches.push('<patch extension="ego_dlc_timelines" version="800" name="Timelines"/>');
  }

  return patches;
}

/**
 * Generates an X4 construction plan XML from scratch on a grid layout.
 * Used when no original blueprint XML was loaded.
 * 
 * @param {string} planName - User-specified station plan name
 * @param {Object} rawMacrosMap - Map of { [macroName]: count }
 * @param {Object} [options] - Optional configurations
 * @returns {string} Complete XML document string
 */
export function generateCleanBlueprintXML(planName, rawMacrosMap, options = {}) {
  const cleanName = (planName || 'Custom Station Plan').trim();
  const planId = options.id || `player_${Math.floor(Date.now() / 1000)}`;
  const description = options.description || '';

  const entriesXml = [];
  let entryIndex = 1;

  for (const [macro, count] of Object.entries(rawMacrosMap || {})) {
    if (isEquipmentMacro(macro)) continue;
    const qty = parseInt(count, 10);
    if (isNaN(qty) || qty <= 0) continue;

    for (let i = 0; i < qty; i++) {
      const col = (entryIndex - 1) % 10;
      const row = Math.floor((entryIndex - 1) / 10);
      const x = ((col - 4.5) * 400).toFixed(1);
      const y = '0';
      const z = ((row - 4.5) * 400).toFixed(1);

      entriesXml.push(
`    <entry index="${entryIndex}" macro="${escapeXml(macro)}">
      <offset>
        <position x="${x}" y="${y}" z="${z}"/>
      </offset>
    </entry>`
      );
      entryIndex++;
    }
  }

  // Attach equipment upgrades to first station entry if equipment macros are present
  const equipmentEntries = [];
  for (const [macro, count] of Object.entries(rawMacrosMap || {})) {
    if (isEquipmentMacro(macro)) {
      const qty = parseInt(count, 10);
      if (!isNaN(qty) && qty > 0) {
        const tag = macro.toLowerCase().startsWith('shield') ? 'shields' : (macro.toLowerCase().startsWith('weapon') ? 'weapons' : 'turrets');
        equipmentEntries.push(`        <${tag} macro="${escapeXml(macro)}" exact="${qty}"/>`);
      }
    }
  }
  if (equipmentEntries.length > 0 && entriesXml.length > 0) {
    const upgradesBlock = `      <upgrades>\n        <groups>\n${equipmentEntries.join('\n')}\n        </groups>\n      </upgrades>\n    </entry>`;
    entriesXml[0] = entriesXml[0].replace('    </entry>', upgradesBlock);
  }

  const patches = detectDlcPatches(rawMacrosMap);
  let patchesXml = '';
  if (patches.length > 0) {
    patchesXml = `\n    <patches>\n      ${patches.join('\n      ')}\n    </patches>`;
  }

  const rawDoc = `<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="${escapeXml(planId)}" name="${escapeXml(cleanName)}" description="${escapeXml(description)}">${patchesXml}
${entriesXml.join('\n')}
  </plan>
</plans>
`;

  return formatXmlString(rawDoc);
}

/**
 * Generates an X4 construction plan XML using as much of the original loaded XML as possible.
 * Adds any module modifications (new or added modules) to the beginning of the <plan> document.
 * 
 * @param {string} planName - User-specified station plan name
 * @param {Object} rawMacrosMap - Map of { [macroName]: count }
 * @param {string} originalXml - Original XML string loaded into the app
 * @param {Object} [options] - Optional configurations
 * @returns {string} Complete XML document string
 */
export function generateModifiedBlueprintXML(planName, rawMacrosMap, originalXml, options = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalXml, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Original XML contains parsing errors: ' + parserError.textContent);
  }

  const planEl = doc.querySelector('plan');
  if (!planEl) {
    throw new Error('No <plan> element found in original XML');
  }

  const cleanName = (planName || planEl.getAttribute('name') || 'Custom Station Plan').trim();
  const planId = options.id || `player_${Math.floor(Date.now() / 1000)}`;
  planEl.setAttribute('id', planId);
  planEl.setAttribute('name', cleanName);
  if (options.description !== undefined) {
    planEl.setAttribute('description', options.description);
  }

  // 1. Gather all original entry elements
  const originalEntries = Array.from(planEl.querySelectorAll('entry'));
  const origEntriesByMacro = new Map();
  let maxOriginalY = 0;
  let hasCoords = false;

  originalEntries.forEach(entry => {
    const macro = entry.getAttribute('macro');
    if (!macro) return;
    if (!origEntriesByMacro.has(macro)) {
      origEntriesByMacro.set(macro, []);
    }
    origEntriesByMacro.get(macro).push(entry);

    const posEl = entry.querySelector('position');
    if (posEl) {
      const y = parseFloat(posEl.getAttribute('y')) || 0;
      if (!hasCoords) {
        maxOriginalY = y;
        hasCoords = true;
      } else {
        maxOriginalY = Math.max(maxOriginalY, y);
      }
    }
  });

  // 2. Prepare desired target module counts
  const targetCounts = {};
  for (const [macro, count] of Object.entries(rawMacrosMap || {})) {
    const qty = parseInt(count, 10);
    if (!isNaN(qty) && qty > 0) {
      targetCounts[macro] = qty;
    }
  }

  // 3. Determine quotas: how many original entries to preserve vs how many new entries to create
  const preservedQuotaByMacro = new Map();
  const additionsByMacro = new Map();

  for (const [macro, desiredQty] of Object.entries(targetCounts)) {
    if (isEquipmentMacro(macro)) continue; // Equipment is synchronized inside entry upgrades
    const origList = origEntriesByMacro.get(macro) || [];
    const origQty = origList.length;
    const keepQty = Math.min(origQty, desiredQty);
    preservedQuotaByMacro.set(macro, keepQty);
    if (desiredQty > origQty) {
      additionsByMacro.set(macro, desiredQty - origQty);
    }
  }

  // 4. Select preserved entries in original sequence
  const preservedEntries = [];
  const currentKeptByMacro = new Map();

  originalEntries.forEach(entry => {
    const macro = entry.getAttribute('macro');
    const maxToKeep = preservedQuotaByMacro.get(macro) || 0;
    const currentlyKept = currentKeptByMacro.get(macro) || 0;

    if (currentlyKept < maxToKeep) {
      preservedEntries.push(entry);
      currentKeptByMacro.set(macro, currentlyKept + 1);
    }
  });

  // 4b. Synchronize equipment upgrades in preserved entries with targetCounts
  const equipmentTarget = {};
  for (const [macro, count] of Object.entries(targetCounts)) {
    if (isEquipmentMacro(macro)) {
      equipmentTarget[macro] = count;
      equipmentTarget[macro.toLowerCase()] = count;
    }
  }

  const lastUpgradeByMacro = new Map();

  preservedEntries.forEach(entry => {
    const upgradesEl = entry.querySelector('upgrades');
    if (!upgradesEl) return;

    const upgradeItems = Array.from(upgradesEl.querySelectorAll('[macro]'));
    upgradeItems.forEach(u => {
      const uMacro = u.getAttribute('macro');
      if (!uMacro) return;
      const lowerUMacro = uMacro.toLowerCase();
      const exactAttr = u.getAttribute('exact');
      const itemExact = exactAttr ? (parseInt(exactAttr, 10) || 1) : 1;

      const remaining = equipmentTarget[uMacro] ?? equipmentTarget[lowerUMacro] ?? 0;
      if (remaining <= 0) {
        // Equipment was deleted or modified to 0 by user: remove this upgrade tag
        u.remove();
      } else if (remaining < itemExact) {
        // Reduced: adjust exact attribute to remaining count
        u.setAttribute('exact', String(remaining));
        equipmentTarget[uMacro] = 0;
        equipmentTarget[lowerUMacro] = 0;
        lastUpgradeByMacro.set(uMacro, u);
        lastUpgradeByMacro.set(lowerUMacro, u);
      } else {
        // Preserved within remaining allowance
        equipmentTarget[uMacro] = remaining - itemExact;
        equipmentTarget[lowerUMacro] = remaining - itemExact;
        lastUpgradeByMacro.set(uMacro, u);
        lastUpgradeByMacro.set(lowerUMacro, u);
      }
    });

    const groupsEl = upgradesEl.querySelector('groups');
    if (groupsEl && groupsEl.children.length === 0) {
      groupsEl.remove();
    }
    if (upgradesEl.children.length === 0) {
      upgradesEl.remove();
    }
  });

  // If user increased equipment count beyond original XML count, allocate surplus to last matching upgrade tag
  for (const [macro, remaining] of Object.entries(equipmentTarget)) {
    if (remaining > 0 && lastUpgradeByMacro.has(macro)) {
      const u = lastUpgradeByMacro.get(macro);
      const curExact = parseInt(u.getAttribute('exact'), 10) || 1;
      u.setAttribute('exact', String(curExact + remaining));
      equipmentTarget[macro] = 0;
      if (equipmentTarget[macro.toLowerCase()] !== undefined) {
        equipmentTarget[macro.toLowerCase()] = 0;
      }
    }
  }

  // If user added equipment that was not in original XML upgrades, append to first preserved entry
  for (const [macro, remaining] of Object.entries(equipmentTarget)) {
    if (remaining > 0 && preservedEntries.length > 0) {
      const targetEntry = preservedEntries.find(e => e.querySelector('upgrades')) || preservedEntries[0];
      let upgradesEl = targetEntry.querySelector('upgrades');
      if (!upgradesEl) {
        upgradesEl = doc.createElement('upgrades');
        targetEntry.appendChild(upgradesEl);
      }
      let groupsEl = upgradesEl.querySelector('groups');
      if (!groupsEl) {
        groupsEl = doc.createElement('groups');
        upgradesEl.appendChild(groupsEl);
      }
      const tag = macro.toLowerCase().startsWith('shield') ? 'shields' : (macro.toLowerCase().startsWith('weapon') ? 'weapons' : 'turrets');
      const newU = doc.createElement(tag);
      newU.setAttribute('macro', macro);
      newU.setAttribute('exact', String(remaining));
      groupsEl.appendChild(newU);
      equipmentTarget[macro] = 0;
      if (equipmentTarget[macro.toLowerCase()] !== undefined) {
        equipmentTarget[macro.toLowerCase()] = 0;
      }
    }
  }

  // 5. Build list of modifications (new/added entries) to place at the beginning
  const newEntryMacros = [];
  for (const [macro, addCount] of additionsByMacro.entries()) {
    for (let i = 0; i < addCount; i++) {
      newEntryMacros.push(macro);
    }
  }

  // 6. Create new entry elements for the beginning of the document (indices 1 to M)
  const spawnY = hasCoords ? Math.round(maxOriginalY + 500) : 0;
  const newEntryNodes = [];

  for (let i = 0; i < newEntryMacros.length; i++) {
    const macro = newEntryMacros[i];
    const entryIndex = i + 1;
    const col = i % 10;
    const row = Math.floor(i / 10);
    const x = Math.round((col - 4.5) * 400);
    const y = spawnY;
    const z = Math.round((row - 4.5) * 400);

    const newEntry = doc.createElement('entry');
    newEntry.setAttribute('index', String(entryIndex));
    newEntry.setAttribute('macro', macro);

    const offsetEl = doc.createElement('offset');
    const posEl = doc.createElement('position');
    posEl.setAttribute('x', String(x));
    posEl.setAttribute('y', String(y));
    posEl.setAttribute('z', String(z));
    offsetEl.appendChild(posEl);
    newEntry.appendChild(offsetEl);

    newEntryNodes.push(newEntry);
  }

  // 7. Re-index preserved original entries (indices M + 1 to M + K)
  const oldIndexToNewIndex = new Map();
  let currentNewIndex = newEntryMacros.length + 1;

  preservedEntries.forEach(entry => {
    const oldIndex = parseInt(entry.getAttribute('index'), 10);
    oldIndexToNewIndex.set(oldIndex, currentNewIndex);
    entry.setAttribute('index', String(currentNewIndex));
    currentNewIndex++;
  });

  // 8. Re-map predecessor indices in preserved entries to ensure valid snapping
  preservedEntries.forEach(entry => {
    const predEl = entry.querySelector('predecessor');
    if (predEl) {
      const oldPredIndex = parseInt(predEl.getAttribute('index'), 10);
      if (oldIndexToNewIndex.has(oldPredIndex)) {
        predEl.setAttribute('index', String(oldIndexToNewIndex.get(oldPredIndex)));
      } else {
        // Predecessor was deleted or removed from the plan; safely remove predecessor link
        predEl.remove();
        entry.removeAttribute('connection');
      }
    }
  });

  // 9. Replace entries in plan: new modifications FIRST, preserved original entries SECOND
  originalEntries.forEach(e => e.remove());
  newEntryNodes.forEach(e => planEl.appendChild(e));
  preservedEntries.forEach(e => planEl.appendChild(e));

  // 10. Update DLC patches if newly added modules require additional DLCs
  const requiredPatches = detectDlcPatches(targetCounts);
  if (requiredPatches.length > 0) {
    let patchesEl = planEl.querySelector('patches');
    if (!patchesEl) {
      patchesEl = doc.createElement('patches');
      planEl.insertBefore(patchesEl, planEl.firstChild);
    }
    const existingExtensions = new Set(
      Array.from(patchesEl.querySelectorAll('patch')).map(p => p.getAttribute('extension'))
    );
    requiredPatches.forEach(patchXml => {
      const extMatch = patchXml.match(/extension="([^"]+)"/);
      const verMatch = patchXml.match(/version="([^"]+)"/);
      const nameMatch = patchXml.match(/name="([^"]+)"/);
      if (extMatch && !existingExtensions.has(extMatch[1])) {
        const patchEl = doc.createElement('patch');
        patchEl.setAttribute('extension', extMatch[1]);
        if (verMatch) patchEl.setAttribute('version', verMatch[1]);
        if (nameMatch) patchEl.setAttribute('name', nameMatch[1]);
        patchesEl.appendChild(patchEl);
        existingExtensions.add(extMatch[1]);
      }
    });
  }

  // 11. Serialize and format XML
  const serializer = new XMLSerializer();
  let serialized = serializer.serializeToString(doc);
  serialized = serialized.replace(/\sxmlns="[^"]*"/g, '');

  if (!serialized.trim().startsWith('<?xml')) {
    serialized = `<?xml version="1.0" encoding="UTF-8"?>\n${serialized.trim()}`;
  }

  return formatXmlString(serialized);
}

/**
 * Generates an X4-compliant station construction plan XML string.
 * Automatically utilizes the loaded original blueprint XML if available,
 * placing modifications at the beginning of the document.
 * 
 * @param {string} planName - User-specified station plan name
 * @param {Object} rawMacrosMap - Map of { [macroName]: count }
 * @param {Object} [options] - Optional configurations
 * @returns {string} Complete XML document string
 */
export function generateBlueprintXML(planName, rawMacrosMap, options = {}) {
  const originalXml = options.originalXml ||
    (state?.originalBlueprint && state.originalBlueprint.rawXml) ||
    (state?.activeBlueprint && state.activeBlueprint.rawXml) ||
    null;

  if (originalXml && typeof DOMParser !== 'undefined') {
    try {
      return generateModifiedBlueprintXML(planName, rawMacrosMap, originalXml, options);
    } catch (err) {
      console.warn('Failed to generate blueprint from original XML, falling back to clean generation:', err);
    }
  }

  return generateCleanBlueprintXML(planName, rawMacrosMap, options);
}

/**
 * Initiates an HTML5 client-side file download of the given XML content.
 * @param {string} xmlContent - Raw XML string
 * @param {string} fileName - File name to save as (e.g. "MyStation.xml")
 */
export function downloadXMLFile(xmlContent, fileName) {
  const safeName = (fileName || 'station_plan.xml').trim().replace(/[<>:"/\\|?*]+/g, '_');
  const finalName = safeName.toLowerCase().endsWith('.xml') ? safeName : `${safeName}.xml`;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Displays a modal dialog prompting the user to name the blueprint before exporting.
 * 
 * @param {Object} params
 * @param {string} params.defaultName - Initial blueprint name
 * @param {number} params.totalModules - Number of modules in plan
 * @param {Function} params.onSave - Callback receiving the confirmed blueprint name string
 */
export function showCreateBlueprintModal({ defaultName, totalModules, onSave }) {
  const existing = document.getElementById('createBpModalOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'createBpModalOverlay';
  overlay.className = 'no-bp-popup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="no-bp-popup-card create-bp-modal-card">
      <div class="create-bp-modal-header">
        <span class="create-bp-modal-icon">📐</span>
        <div class="create-bp-modal-titles">
          <h3>Create .XML Blueprint</h3>
          <span class="create-bp-modal-sub">${totalModules} station module${totalModules === 1 ? '' : 's'} in current plan</span>
        </div>
      </div>

      <p class="create-bp-modal-desc">
        Name your blueprint before generating the XML file. It will be constructed following the X4 station construction plan specification and saved to your device.
      </p>

      <div class="create-bp-input-group">
        <label for="createBpNameInput">Blueprint Name</label>
        <input
          type="text"
          id="createBpNameInput"
          value="${escapeHtml(defaultName || 'Custom Station Plan')}"
          placeholder="e.g. Argon Prime Mega Complex"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="create-bp-modal-actions">
        <button type="button" id="btnCancelCreateBp" class="btn-modal-cancel">
          Cancel
        </button>
        <button type="button" id="btnConfirmCreateBp" class="btn-upload btn-create-bp btn-modal-confirm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          Save .XML Blueprint
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = document.getElementById('createBpNameInput');
  const btnCancel = document.getElementById('btnCancelCreateBp');
  const btnConfirm = document.getElementById('btnConfirmCreateBp');

  setTimeout(() => {
    if (input) {
      input.focus();
      input.select();
    }
  }, 50);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleKey);
  };

  const handleConfirm = () => {
    const rawVal = input ? input.value.trim() : '';
    const finalName = rawVal || defaultName || 'Custom Station Plan';
    close();
    if (typeof onSave === 'function') {
      onSave(finalName);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  document.addEventListener('keydown', handleKey);
  if (btnCancel) btnCancel.addEventListener('click', close);
  if (btnConfirm) btnConfirm.addEventListener('click', handleConfirm);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

/**
 * Toast notification rack for user alerts.
 */
export function showToastNotification(message, type = 'success') {
  let container = document.getElementById('toastNotificationRack');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastNotificationRack';
    container.className = 'toast-notification-rack';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  toast.className = `app-toast-item ${isSuccess ? 'toast-success' : 'toast-error'}`;
  toast.innerHTML = `
    <span class="toast-icon">${isSuccess ? '✅' : '⚠️'}</span>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}
