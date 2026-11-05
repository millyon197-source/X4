// Workforce summary panel of the blueprint overview, extracted from renderBlueprintOverview (Stage 4, step 8e).
// buildWorkforceView gathers what the panel shows; renderWorkforcePanel returns its HTML ('' when the
// blueprint has no workforce). Both only read the state object they are given.
import { FACTION_FOOD_MED, getMostProminentFaction } from '../../engine/workforce.js';
import { calculateBlueprintWorkforce } from '../../engine/calculator.js';
import { escapeHtml } from '../../html.js';

export function buildWorkforceView(state) {
  const wf = calculateBlueprintWorkforce(state.activeBlueprint);
  const hasWorkforce = wf.totalOptimalWorkforce > 0 || wf.totalHabitationCapacity > 0;
  const prominentFaction = getMostProminentFaction(state.activeBlueprint);
  const prominentFactionCfg = FACTION_FOOD_MED[prominentFaction] || FACTION_FOOD_MED.commonwealth;
  const isWfSupportedChecked = Boolean(state.supportWorkforce || (state.activeBlueprint && state.activeBlueprint._autoWfAddedMacros));
  const isWfCollapsed = Boolean(state.workforceSummaryCollapsed);

  const redShortages = [];
  const expandedDeficits = [];
  if (wf.surplusDeficit < 0) {
    redShortages.push(`<span style="color:#ef4444; background:rgba(239,68,68,0.15); padding:1px 6px; border-radius:3px; border:1px solid rgba(239,68,68,0.35); font-size:0.7rem; font-weight:700;" title="Workforce Bed Shortage: ${wf.surplusDeficit.toLocaleString()} beds">🛏️ ${wf.surplusDeficit.toLocaleString()} beds</span>`);
    expandedDeficits.push({
      icon: '🛏️',
      label: 'Workforce Bed Deficit',
      value: `${wf.surplusDeficit.toLocaleString()} beds`
    });
  }
  if (wf.lifeSupport && wf.lifeSupport.foodBalance < 0) {
    redShortages.push(`<span style="color:#ef4444; background:rgba(239,68,68,0.15); padding:1px 6px; border-radius:3px; border:1px solid rgba(239,68,68,0.35); font-size:0.7rem; font-weight:700;" title="Food Rations Shortage: ${Math.round(wf.lifeSupport.foodBalance).toLocaleString()} / hr">🍞 ${Math.round(wf.lifeSupport.foodBalance).toLocaleString()}/hr</span>`);
    expandedDeficits.push({
      icon: '🍞',
      label: 'Food Rations Deficit',
      value: `${Math.round(wf.lifeSupport.foodBalance).toLocaleString()} / hr`
    });
  }
  if (wf.lifeSupport && wf.lifeSupport.medBalance < 0) {
    redShortages.push(`<span style="color:#ef4444; background:rgba(239,68,68,0.15); padding:1px 6px; border-radius:3px; border:1px solid rgba(239,68,68,0.35); font-size:0.7rem; font-weight:700;" title="Medical Supplies Shortage: ${Math.round(wf.lifeSupport.medBalance).toLocaleString()} / hr">💊 ${Math.round(wf.lifeSupport.medBalance).toLocaleString()}/hr</span>`);
    expandedDeficits.push({
      icon: '💊',
      label: 'Medical Supplies Deficit',
      value: `${Math.round(wf.lifeSupport.medBalance).toLocaleString()} / hr`
    });
  }
  return { wf, hasWorkforce, prominentFactionCfg, isWfSupportedChecked, isWfCollapsed, redShortages, expandedDeficits };
}

export function renderWorkforcePanel(state, view) {
  const { wf, hasWorkforce, prominentFactionCfg, isWfSupportedChecked, isWfCollapsed, redShortages, expandedDeficits } = view;
  return hasWorkforce ? `
        <div class="workforce-box bp-wf-panel bi-panel ${state.focusedBiPanel === 'workforce-summary' ? 'bi-panel-focused' : ''}" data-bi-panel="workforce-summary" style="border-color:#10b981; margin-bottom:0.6rem; padding:0; overflow:hidden; flex-shrink:0; width:100%; box-sizing:border-box;">
          <div class="bp-wf-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:0.5rem 0.65rem; background:rgba(16,185,129,0.08); user-select:none; gap:6px; flex-wrap:wrap;" title="Click to ${isWfCollapsed ? 'expand' : 'collapse'} Station Workforce Summary">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="bp-wf-arrow" style="font-size:0.75rem; color:#34d399; width:12px; display:inline-block;">${isWfCollapsed ? '▶' : '▼'}</span>
              <h4 style="margin:0; color:#34d399; font-size:0.8rem;">👥 Station Workforce Summary</h4>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <label id="lblSupportWorkforce" style="font-size:0.72rem; color:#10b981; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:4px; background:rgba(16,185,129,0.15); padding:0.15rem 0.45rem; border-radius:4px; border:1px solid rgba(16,185,129,0.35); user-select:none; white-space:nowrap;" title="Update SWS requirements to support needed Food/Medicine for the most prominent faction and add largest owned habitat modules (including _spire habs) for surplus workers" onclick="event.stopPropagation();">
                <input type="checkbox" id="chkSupportWorkforce" ${isWfSupportedChecked ? 'checked' : ''} style="cursor:pointer;" onclick="event.stopPropagation();" />
                Support Workforce
              </label>
              <div class="bp-wf-collapsed-deficits" style="display:${isWfCollapsed ? 'inline-flex' : 'none'}; align-items:center; gap:4px; flex-wrap:wrap;">
                ${redShortages.join('')}
              </div>
              <span style="font-size:0.7rem; font-weight:700; padding:1px 6px; border-radius:4px; background:${wf.coveragePercent >= 100 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color:${wf.coveragePercent >= 100 ? '#34d399' : '#ef4444'}; border:1px solid ${wf.coveragePercent >= 100 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'};">
                ${wf.coveragePercent}% Coverage
              </span>
            </div>
          </div>
          <div class="bp-wf-body" style="padding:0.5rem 0.65rem; border-top:1px solid rgba(255,255,255,0.05); display:${isWfCollapsed ? 'none' : 'block'};">
            <div style="font-size:0.72rem; color:#94a3b8; display:flex; justify-content:space-between; margin-bottom:0.4rem; padding-bottom:0.25rem; border-bottom:1px solid rgba(255,255,255,0.05);">
              <span>Prominent Faction: <strong style="color:#38bdf8;">${prominentFactionCfg.name}</strong></span>
              ${(state.supportWorkforce || (state.activeBlueprint && state.activeBlueprint._autoWfAddedMacros)) ? `<span style="color:#34d399; font-weight:600;">✨ Auto-Supported</span>` : ''}
            </div>
            ${expandedDeficits.length > 0 ? `
              <div class="bp-wf-expanded-deficits" style="margin-bottom:0.45rem; padding:0.35rem 0.5rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:4px; font-size:0.72rem; display:flex; flex-direction:column; gap:0.25rem;">
                <div style="font-weight:700; color:#ef4444; font-size:0.68rem; text-transform:uppercase; letter-spacing:0.03em;">⚠️ Workforce Deficits:</div>
                ${expandedDeficits.map(d => `
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#cbd5e1;">${d.icon} ${d.label}:</span>
                    <span style="color:#ef4444; font-weight:700; background:rgba(239,68,68,0.2); padding:1px 6px; border-radius:3px; border:1px solid rgba(239,68,68,0.35); font-size:0.7rem;">${d.value}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.35rem 0.6rem; font-size:0.76rem;">
              <div><span style="color:#94a3b8;">Optimal Needed:</span> <strong style="color:#38bdf8;">${wf.totalOptimalWorkforce.toLocaleString()}</strong></div>
              <div><span style="color:#94a3b8;">Hab Capacity:</span> <strong style="color:#34d399;">${wf.totalHabitationCapacity.toLocaleString()}</strong></div>
              <div><span style="color:#94a3b8;">Production:</span> <strong style="color:#cbd5e1;">${wf.productionWorkforce.toLocaleString()}</strong></div>
              <div><span style="color:#94a3b8;">Shipyards:</span> <strong style="color:#cbd5e1;">${wf.shipyardWorkforce.toLocaleString()}</strong></div>
            </div>
            <div style="margin-top:0.4rem; font-size:0.74rem; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.08); padding-top:0.3rem;">
              <span style="color:#94a3b8;">Workforce Balance:</span>
              <strong style="color:${wf.surplusDeficit >= 0 ? '#34d399' : '#ef4444'};">
                ${wf.surplusDeficit >= 0 ? `+${wf.surplusDeficit.toLocaleString()} surplus beds (${wf.habitatCount} habitats)` : `${wf.surplusDeficit.toLocaleString()} bed shortage`}
              </strong>
            </div>
            ${wf.lifeSupport && (wf.lifeSupport.totalFoodProd > 0 || wf.lifeSupport.totalMedProd > 0 || wf.lifeSupport.totalFoodRationsProd > 0 || wf.lifeSupport.totalAllMedSuppliesProd > 0) ? `
            <div style="margin-top:0.35rem; font-size:0.74rem; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.25rem;">
              <span style="color:#94a3b8;">Sustainable Workers:</span>
              <strong style="color:${wf.lifeSupport.sustainableWorkers >= (wf.totalOptimalWorkforce > 0 ? wf.totalOptimalWorkforce : wf.totalHabitationCapacity) ? '#34d399' : '#fbbf24'};">
                ${wf.lifeSupport.sustainableWorkers.toLocaleString()} (${wf.lifeSupport.sustainableCoveragePercent}% self-sufficient)
              </strong>
            </div>
            ` : ''}
            ${wf.lifeSupport && (wf.lifeSupport.totalFoodProd > 0 || wf.lifeSupport.totalMedProd > 0 || wf.lifeSupport.totalFoodRationsProd > 0 || wf.lifeSupport.totalAllMedSuppliesProd > 0) ? `
            <div style="margin-top:0.35rem; font-size:0.72rem; background:rgba(0,0,0,0.2); padding:0.3rem 0.45rem; border-radius:4px; border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:0.2rem;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">🍞 ${wf.lifeSupport.foodName || 'Food Rations'}:</span>
                <span><strong>${Math.round(wf.lifeSupport.totalFoodProd || wf.lifeSupport.totalFoodRationsProd).toLocaleString()}</strong> / hr vs <strong>${Math.round(wf.lifeSupport.foodDemand || wf.lifeSupport.foodRationsDemand).toLocaleString()}</strong> needed (<span style="color:${wf.lifeSupport.foodBalance >= 0 ? '#34d399' : '#ef4444'}; font-weight:700;">${wf.lifeSupport.foodBalance >= 0 ? '+' : ''}${Math.round(wf.lifeSupport.foodBalance).toLocaleString()}</span>)</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:#94a3b8;">💊 ${wf.lifeSupport.medName || 'Medical Supplies'}:</span>
                <span><strong>${Math.round(wf.lifeSupport.totalMedProd || wf.lifeSupport.totalArgMedSuppliesProd || wf.lifeSupport.totalAllMedSuppliesProd).toLocaleString()}</strong> / hr vs <strong>${Math.round(wf.lifeSupport.medicalSuppliesDemand).toLocaleString()}</strong> needed (<span style="color:${wf.lifeSupport.medBalance >= 0 ? '#34d399' : '#ef4444'}; font-weight:700;">${wf.lifeSupport.medBalance >= 0 ? '+' : ''}${Math.round(wf.lifeSupport.medBalance).toLocaleString()}</span>)</span>
              </div>
            </div>
            ` : ''}
            ${(wf.consumersList.length > 0 || wf.providersList.length > 0) ? `
              <details style="margin-top:0.45rem; font-size:0.72rem; cursor:pointer;">
                <summary style="color:#38bdf8; user-select:none; font-weight:600; outline:none;">🔍 View Workforce Breakdown (${wf.consumersList.length} consumers, ${wf.providersList.length} habitats)</summary>
                <div style="margin-top:0.35rem; max-height:160px; overflow-y:auto; padding-right:4px; background:rgba(0,0,0,0.2); padding:0.3rem 0.4rem; border-radius:4px;">
                  <div style="font-weight:700; color:#cbd5e1; margin-bottom:0.2rem; text-transform:uppercase; font-size:0.68rem;">Top Consumers:</div>
                  ${wf.consumersList.slice(0, 10).map(c => `
                    <div style="display:flex; justify-content:space-between; padding:1px 0; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.03);">
                      <span>${c.count}x ${escapeHtml(c.name)}</span>
                      <strong style="color:#38bdf8;">${c.total.toLocaleString()}</strong>
                    </div>
                  `).join('')}
                  ${wf.providersList.length > 0 ? `
                    <div style="font-weight:700; color:#cbd5e1; margin-top:0.35rem; margin-bottom:0.2rem; text-transform:uppercase; font-size:0.68rem;">Habitation Modules:</div>
                    ${wf.providersList.map(p => `
                      <div style="display:flex; justify-content:space-between; padding:1px 0; color:#94a3b8; border-bottom:1px solid rgba(255,255,255,0.03);">
                        <span>${p.count}x ${escapeHtml(p.name)}</span>
                        <strong style="color:#34d399;">${p.total.toLocaleString()}</strong>
                      </div>
                    `).join('')}
                  ` : ''}
                </div>
              </details>
            ` : ''}
          </div>
        </div>
      ` : '';
}
