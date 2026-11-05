// Production-table HTML for the blueprint overview, extracted from renderBlueprintOverview (Stage 4, step 8d).
// Pure functions of the state object they are given (plus the engine's output-rate helper).
import { NO_PP_WARES, WARES_DB, getWareHourlyRatePerModule } from '../../data/wares.js';
import { calculateLiveOutputRate } from '../../engine/calculator.js';

export const LEVEL_META = {
  1: { title: 'Level 1: Refined Goods', color: 'var(--l1-color)', icon: '⚙️' },
  2: { title: 'Level 2: Intermediates', color: 'var(--l2-color)', icon: '🔩' },
  3: { title: 'Level 3: High-Tech Components', color: 'var(--l3-color)', icon: '🔬' }
};

export function renderProductionTableRow(state, [wareId, calc]) {
  const ware = WARES_DB[wareId];
  let inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
  const liveCalc = (state.calculatedDemand && state.calculatedDemand[wareId]) || (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[wareId]) || calc;
  let neededModules = liveCalc.modulesNeeded || 0;
  const neededCountStr = neededModules >= 1 ? `${neededModules}x` : `${neededModules.toFixed(1)}x`;
  const isDirectPlan = inPlanCount > 0;
  const isSubdued = state.subdueZeroX && inPlanCount === 0;
  const isExceeded = inPlanCount > neededModules;
  const asterisk = isExceeded ? '<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : '';

  const optimumRate = liveCalc.rateNeeded > 0 
    ? liveCalc.rateNeeded 
    : (wareId === 'ScrapHullParts' || wareId === 'ScrapClaytronics'
      ? calculateLiveOutputRate(wareId, neededModules, 0)
      : (neededModules * getWareHourlyRatePerModule(wareId, state.workforceBonus)));
  const currentRate = calculateLiveOutputRate(wareId, inPlanCount, optimumRate);
  const planColor = inPlanCount > 0 ? '#38bdf8' : '#64748b';

  const planNeededDisplay = `
        <div style="display:inline-flex; align-items:center; gap:4px;">
          <input type="number" class="bp-table-qty-input" data-ware="${wareId}" min="0" value="${inPlanCount}" style="width:44px; background:rgba(15,23,42,0.9); border:1px solid ${inPlanCount > 0 ? '#38bdf8' : 'rgba(255,255,255,0.2)'}; border-radius:4px; color:${planColor}; font-weight:700; font-size:0.75rem; text-align:center; padding:1px 3px; outline:none;" title="Type planned module count directly to recalculate" />
          <span style="color:#94a3b8; font-weight:600;">/</span>
          <strong style="color:#34d399;">${neededCountStr}</strong>
        </div>
      `;

  let ecConsRate = 0;
  if (ware.recipe && ware.recipe['EC']) {
    const modCount = inPlanCount > 0 ? inPlanCount : neededModules;
    ecConsRate = modCount * ware.recipe['EC'];
  }
  if (NO_PP_WARES.has(wareId)) {
    ecConsRate = 0;
  }
  if (wareId === 'ScrapMetal') {
    ecConsRate = state.scrapMetalEc ? state.scrapMetalEc.totalDemand : 0;
  } else if (wareId === 'TerScrapMetal') {
    const hasGenSm = Boolean(state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapMetal']);
    if (!hasGenSm && state.scrapMetalEc && state.scrapMetalEc.totalDemand > 0) {
      ecConsRate = state.scrapMetalEc.totalDemand;
    } else {
      ecConsRate = 0;
    }
  }

  const rateDisplay = `
        <div style="font-size:0.75rem; line-height:1.35;">
          <div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${planColor};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>
          <div><span style="color:#94a3b8; font-size:0.68rem;">Optimum:</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
        </div>
      `;

  return `
        <tr style="${isDirectPlan ? 'background:rgba(56,189,248,0.08);' : ''} ${isSubdued ? 'opacity:0.3; filter:grayscale(100%); font-style:italic;' : ''}">
          <td>
            <div>
              <strong>${ware.name}${isExceeded ? '<span style="color:#fb923c; font-weight:bold; margin-left:2px;" title="Plan exceeds Needs">*</span>' : ''}</strong> <span style="color:#94a3b8; font-size:0.72rem;">(L${ware.level})</span>
              ${isDirectPlan ? `<span style="font-size:0.65rem; color:#38bdf8; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); padding:1px 5px; border-radius:3px; margin-left:4px;" title="${isExceeded ? `Plan (${inPlanCount}x) exceeds Needs (${neededModules}x)` : 'Included in station blueprint'}">[In Plan${asterisk}]</span>` : ''}
            </div>
            ${!state.subdueEcCalc && ecConsRate > 0 ? `
              <div style="margin-top:3px;">
                <span class="rate-badge-cons" style="font-size:0.68rem; padding:1px 5px;" title="Energy Cells consumed per hour">⚡ Consumes ${Math.round(ecConsRate).toLocaleString()} EC/hr</span>
              </div>
            ` : ''}
          </td>
          <td class="highlight-val"><span class="module-badge" style="font-size:0.75rem;">${planNeededDisplay}</span></td>
          <td>${rateDisplay}</td>
        </tr>
      `;
}

export function renderProductionLevelPanel(state, lvl, productionEntries) {
  const meta = LEVEL_META[lvl] || { title: `Level ${lvl}`, color: '#38bdf8', icon: '🔹' };
  const levelEntries = productionEntries.filter(([wId]) => WARES_DB[wId] && WARES_DB[wId].level === lvl);

  let lvlPlan = 0;
  let lvlNeeds = 0;
  levelEntries.forEach(([wareId, calc]) => {
    const inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
    const liveCalc = (state.calculatedDemand && state.calculatedDemand[wareId]) || (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[wareId]) || calc;
    lvlPlan += inPlan;
    lvlNeeds += (liveCalc.modulesNeeded || 0);
  });

  const isCollapsed = state.bpLevelCollapsed ? Boolean(state.bpLevelCollapsed[lvl]) : true;
  const arrowChar = isCollapsed ? '▶' : '▼';

  return `
        <div class="bp-level-panel bi-panel ${state.focusedBiPanel === `level-${lvl}` ? 'bi-panel-focused' : ''}" data-level="${lvl}" data-bi-panel="level-${lvl}">
          <div class="bp-level-header" data-level="${lvl}" title="Click to ${isCollapsed ? 'expand' : 'collapse'} ${meta.title}">
            <div class="bp-level-title-group">
              <span class="bp-level-arrow">${arrowChar}</span>
              <span style="color:${meta.color}; font-weight:700; font-size:0.78rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em;">
                ${meta.icon} ${meta.title}
              </span>
            </div>
            <div class="bp-level-badge-group">
              <span style="font-size:0.7rem; color:#94a3b8; background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:3px; border:1px solid rgba(255,255,255,0.08);">
                ${levelEntries.length} Wares
              </span>
              <span style="font-size:0.7rem; font-weight:600; color:${lvlPlan >= lvlNeeds ? '#34d399' : '#fbbf24'}; background:rgba(255,255,255,0.05); padding:1px 6px; border-radius:3px; border:1px solid rgba(255,255,255,0.08);" title="Total modules in plan vs calculated needed">
                ${lvlPlan}x Plan / ${Math.round(lvlNeeds)}x Needs
              </span>
            </div>
          </div>
          <div class="bp-level-body" style="display:${isCollapsed ? 'none' : 'block'};">
            ${levelEntries.length > 0 ? `
              <table class="summary-table">
                <thead>
                  <tr>
                    <th class="th-bp-sort-comp sortable" title="Click to sort by Component Name">
                      Component ${state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
                    </th>
                    <th class="th-bp-sort-needed sortable" title="Click to sort by Needs Modules">
                      Plan / Needs ${state.bpSortField === 'needed' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
                    </th>
                    <th>Current / Optimum Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${levelEntries.map(entry => renderProductionTableRow(state, entry)).join('')}
                </tbody>
              </table>
            ` : `
              <div style="padding:0.5rem 0.65rem; font-size:0.75rem; color:#64748b; font-style:italic;">
                No active or needed modules in this level.
              </div>
            `}
          </div>
        </div>
      `;
}
