// The four smaller panels of the blueprint overview, extracted from renderBlueprintOverview (Stage 4, step 8f):
// raw mining, module differences, not-owned blueprints and non-contributing modules. Each returns its HTML
// and only reads the state object and data it is given.
import { escapeHtml } from '../../html.js';
import { isMacroBlueprintOwned } from '../../engine/blueprintOwnership.js';
import { renderNotOwnedModuleTag } from '../../engine/cuckooDlcLookup.js';

export function renderRawMiningPanel(state, totalRaw, ecTotal) {
  const isRawCollapsed = Boolean(state.rawMiningCollapsed);
  return `<div class="workforce-box bp-raw-panel bi-panel ${state.focusedBiPanel === 'raw-mining' ? 'bi-panel-focused' : ''}" data-bi-panel="raw-mining" style="border-color:#38bdf8; margin-bottom:0.6rem; padding:0; overflow:hidden; flex-shrink:0; width:100%; box-sizing:border-box;">
        <div class="bp-raw-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.5rem 0.65rem; background:rgba(56,189,248,0.08); user-select:none; gap:6px; flex-wrap:wrap;" title="Click to ${isRawCollapsed ? 'expand' : 'collapse'} Total Recalculated Raw Mining & Liquids">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="bp-raw-arrow" style="font-size:0.75rem; color:#38bdf8; width:12px; display:inline-block;">${isRawCollapsed ? '▶' : '▼'}</span>
            <h4 style="margin:0; color:#38bdf8; font-size:0.8rem;">⛏️ Total Recalculated Raw Mining & Liquids</h4>
          </div>
          <div class="bp-raw-collapsed-preview" style="display:${isRawCollapsed ? 'inline-flex' : 'none'}; align-items:center; gap:6px; font-size:0.7rem;">
            <span style="color:#34d399; font-weight:700;">${Math.round(totalRaw).toLocaleString()}/hr</span>
            <span style="color:#fbbf24; font-weight:700;">⚡ ${Math.round(ecTotal).toLocaleString()}/hr</span>
          </div>
        </div>
        <div class="bp-raw-body" style="padding:0.5rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); display:${isRawCollapsed ? 'none' : 'block'};">
          <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
          <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Demand:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
        </div>
      </div>`;
}

export function renderModuleDiffPanel(state, diffList) {
  const isDiffCollapsed = Boolean(state.moduleDiffCollapsed);
  return `<div class="module-diff-box bp-diff-panel bi-panel ${state.focusedBiPanel === 'module-diff' ? 'bi-panel-focused' : ''}" data-bi-panel="module-diff" style="margin-top:0.65rem; padding:0; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:0.75rem; flex-shrink:0; width:100%; box-sizing:border-box; overflow:hidden;">
        <div class="bp-diff-header" style="font-weight:700; color:#94a3b8; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em; font-size:0.7rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.45rem 0.65rem; background:rgba(255,255,255,0.02); user-select:none;" title="Click to ${isDiffCollapsed ? 'expand' : 'collapse'} Planned vs Needed Module Differences">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="bp-diff-arrow" style="font-size:0.75rem; color:#fbbf24; width:12px; display:inline-block;">${isDiffCollapsed ? '▶' : '▼'}</span>
            <span>⚖️ Planned vs Needed Module Differences</span>
          </div>
          <div style="display:flex; align-items:center; gap:5px;">
            <span style="color:#fbbf24; font-weight:700; background:rgba(251,191,36,0.1); padding:1px 6px; border-radius:3px; border:1px solid rgba(251,191,36,0.25);">${diffList.length} Differences</span>
          </div>
        </div>
        <div class="bp-diff-body" style="padding:0.45rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); color:#cbd5e1; line-height:1.6; display:${isDiffCollapsed ? 'none' : 'block'};">
          <div class="bp-diff-differences-list">
            ${diffList.length > 0 ? diffList.join(', ') : '<span style="color:#34d399; font-style:italic;">All active modules match Needs count!</span>'}
          </div>
        </div>
      </div>`;
}

export function renderUnownedPanel(state, unownedModules, totalUnownedCount) {
  const isUnownedCollapsed = Boolean(state.unownedCollapsed);
  const unownedListHtml = unownedModules.map(item => `
      <span class="bp-diff-item bp-diff-unowned-item" ${item.wareId ? `data-ware="${escapeHtml(item.wareId)}" style="cursor:pointer;" title="Click to inspect ${escapeHtml(item.friendly)} in Supply Matrix"` : `title="${escapeHtml(item.friendly)} (${escapeHtml(item.macro)}) - Blueprint Not Owned"`} style="white-space:nowrap; display:inline-flex; align-items:center; gap:5px; padding:1px 6px; border-radius:4px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); margin:1px 0; color:#cbd5e1;">
        <strong style="color:#ef4444; font-weight:700;">${item.count}x</strong> <span style="color:#fca5a5;">${escapeHtml(item.friendly)}</span>
        ${renderNotOwnedModuleTag(item.macro || item.wareId, { mini: true })}
      </span>
    `).join(' ');
  return `${unownedModules.length > 0 ? `
        <div class="unowned-modules-box bp-unowned-panel bi-panel ${state.focusedBiPanel === 'not-owned' ? 'bi-panel-focused' : ''}" data-bi-panel="not-owned" style="margin-top:0.65rem; padding:0; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.3); border-radius:6px; font-size:0.75rem; flex-shrink:0; width:100%; box-sizing:border-box; overflow:hidden;">
          <div class="bp-unowned-header" style="font-weight:700; color:#ef4444; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em; font-size:0.7rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.45rem 0.65rem; background:rgba(239,68,68,0.08); user-select:none;" title="Click to ${isUnownedCollapsed ? 'expand' : 'collapse'} Not Owned Blueprints">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="bp-unowned-arrow" style="font-size:0.75rem; color:#ef4444; width:12px; display:inline-block;">${isUnownedCollapsed ? '▶' : '▼'}</span>
              <span>🚫 Not Owned Blueprints</span>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <span class="not-owned-label" style="font-size:0.56rem; padding:0.02rem 0.35rem;">${unownedModules.length} Modules (${totalUnownedCount}x Total)</span>
            </div>
          </div>
          <div class="bp-unowned-body" style="padding:0.45rem 0.65rem; border-top:1px solid rgba(239,68,68,0.2); color:#cbd5e1; line-height:1.6; display:${isUnownedCollapsed ? 'none' : 'block'};">
            ${unownedListHtml}
          </div>
        </div>
      ` : ''}`;
}

export function renderNonContributingPanel(state, nonContributingMap, totalNonContributingCount) {
  const isNcCollapsed = Boolean(state.nonContributingCollapsed);
  const nonContributingList = Object.values(nonContributingMap)
    .sort((a, b) => {
      if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
      return a.name.localeCompare(b.name);
    })
    .map(item => {
      const isUnowned = item.macro && !isMacroBlueprintOwned(item.macro, state.serverModules);
      return `<span style="white-space:nowrap; display:inline-flex; align-items:center; gap:4px;"><strong style="color:#38bdf8;">${item.count}x</strong> ${escapeHtml(item.name)}${isUnowned ? ` ${renderNotOwnedModuleTag(item.macro, { mini: true })}` : ''}</span>`;
    });
  return `<div class="non-contributing-box bp-nc-panel bi-panel ${state.focusedBiPanel === 'non-contributing' ? 'bi-panel-focused' : ''}" data-bi-panel="non-contributing" style="margin-top:0.65rem; padding:0; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:0.75rem; flex-shrink:0; width:100%; box-sizing:border-box; overflow:hidden;">
        <div class="bp-nc-header" style="font-weight:700; color:#94a3b8; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em; font-size:0.7rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.45rem 0.65rem; background:rgba(255,255,255,0.02); user-select:none;" title="Click to ${isNcCollapsed ? 'expand' : 'collapse'} Non-Contributing Ware Modules">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="bp-nc-arrow" style="font-size:0.75rem; color:#38bdf8; width:12px; display:inline-block;">${isNcCollapsed ? '▶' : '▼'}</span>
            <span>📦 Non-Contributing Ware Modules</span>
          </div>
          <span style="color:#38bdf8; font-weight:700; background:rgba(56,189,248,0.1); padding:1px 6px; border-radius:3px; border:1px solid rgba(56,189,248,0.25);">Total: ${totalNonContributingCount}</span>
        </div>
        <div class="bp-nc-body" style="padding:0.45rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); color:#cbd5e1; line-height:1.45; display:${isNcCollapsed ? 'none' : 'block'};">
          ${nonContributingList.length > 0 ? nonContributingList.join(', ') : '<span style="color:#64748b; font-style:italic;">None</span>'}
        </div>
      </div>`;
}
