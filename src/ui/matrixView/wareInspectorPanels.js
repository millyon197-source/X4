// HTML pieces of the single-ware inspector, extracted from renderWareInspector (Stage 4, step 10e).
// Each function only reads the state object it is given and returns markup.
import { DEPENDENCIES, WARES_DB } from '../../data/wares.js';
import { calculateLiveOutputRate } from '../../engine/calculator.js';

// Table rows for the upstream requirements of the selected ware, sorted by the blueprint sort settings.
export function renderUpstreamRows(state, id, ware, activeDemand) {
  const upstreamEntries = Object.keys(activeDemand)
    .filter(uId => {
      const uWare = WARES_DB[uId];
      if (!uWare || uId === id || !activeDemand[uId] || activeDemand[uId].rateNeeded <= 0) return false;
      return uWare.level > 0 && uWare.level <= ware.level;
    })
    .sort((uA, uB) => {
      const wareA = WARES_DB[uA];
      const wareB = WARES_DB[uB];
      const calcA = activeDemand[uA];
      const calcB = activeDemand[uB];
      const dbOrder = Object.keys(WARES_DB);

      if (state.bpSortField === 'needed') {
        const neededA = calcA ? calcA.modulesNeeded || 0 : 0;
        const neededB = calcB ? calcB.modulesNeeded || 0 : 0;
        if (neededA !== neededB) {
          return state.bpSortAsc ? neededA - neededB : neededB - neededA;
        }
        return wareA.level !== wareB.level ? wareA.level - wareB.level : (dbOrder.indexOf(uA) - dbOrder.indexOf(uB));
      } else if (state.bpSortField === 'component') {
        const compComp = wareA.name.localeCompare(wareB.name);
        return state.bpSortAsc ? compComp : -compComp;
      } else {
        // Default: Sort by level (L1 -> L2 -> L3 -> L4), then by card display order in matrix
        if (wareA.level !== wareB.level) {
          return state.bpSortAsc ? wareA.level - wareB.level : wareB.level - wareA.level;
        }
        const orderDiff = dbOrder.indexOf(uA) - dbOrder.indexOf(uB);
        return state.bpSortAsc ? orderDiff : -orderDiff;
      }
    });

  const isLevel4Target = ware.level === 4;

  const upstreamRows = upstreamEntries.map(uId => {
    const uWare = WARES_DB[uId];
    const uCalc = activeDemand[uId];
    const curInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[uId]) || 0;
    const optimumRate = uCalc.rateNeeded;
    const currentRate = calculateLiveOutputRate(uId, curInPlan, optimumRate);

    if (isLevel4Target) {
      return `
        <tr>
          <td><strong>${uWare.name}</strong> (L${uWare.level})</td>
          <td style="text-align:right; font-weight:700; color:#34d399; font-size:0.82rem;">${Math.round(uCalc.rateNeeded).toLocaleString()} units</td>
        </tr>
      `;
    }

    let uRateDisplay = '&mdash;';
    const planColor = curInPlan > 0 ? '#38bdf8' : '#64748b';
    if (uWare.level >= 1 && uWare.level <= 3) {
      uRateDisplay = `
        <div style="font-size:0.75rem; line-height:1.35;">
          ${!state.inspectorSingle && state.activeBlueprint ? `<div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${planColor};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>` : ''}
          <div><span style="color:#94a3b8; font-size:0.68rem;">${state.inspectorSingle ? 'Required:' : 'Optimum:'}</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
        </div>
      `;
    }

    const neededStr = `${uCalc.modulesNeeded}x`;
    let planNeededDisplay = `<strong style="color:#34d399;">${neededStr}</strong>`;
    if (!state.inspectorSingle && state.activeBlueprint) {
      planNeededDisplay = `<span style="color:${planColor}; font-weight:600;">${curInPlan}x</span> <span style="color:#94a3b8;">/</span> <strong style="color:#34d399;">${neededStr}</strong>`;
    }

    return `
      <tr>
        <td><strong>${uWare.name}</strong> (L${uWare.level})</td>
        <td class="highlight-val">${planNeededDisplay}</td>
        <td>${uRateDisplay}</td>
      </tr>
    `;
  });
  return upstreamRows;
}

// The Output Consumers box: downstream wares that take the selected ware as input, plus the balance summary.
export function renderConsumersPanel(state, id, { consumers, rangeTag, totalBpConsumption, totalOptimumConsumption, inPlanCount, currentProd, netBpBalance }) {
  const consumersHtml = `
    <div class="consumers-box bi-panel ${state.focusedBiPanel === 'output-consumers' ? 'bi-panel-focused' : ''}" data-bi-panel="output-consumers" style="background:rgba(15,23,42,0.75); padding:0.7rem 0.8rem; border-radius:8px; border:1px solid rgba(129,140,248,0.3); border-left:4px solid #818cf8;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem;">
        <h4 style="font-size:0.78rem; color:#a5b4fc; text-transform:uppercase; font-family:var(--font-heading); letter-spacing:0.03em; margin:0; display:flex; align-items:center; gap:6px;">
          <span>🏭 Output Consumers ${rangeTag}</span>
          ${consumers.length > 0 ? `<span style="font-size:0.7rem; color:#94a3b8; font-weight:normal; text-transform:none;">(${consumers.length} downstream wares)</span>` : ''}
        </h4>
        ${state.activeBlueprint ? `<span style="font-size:0.7rem; color:#38bdf8; font-weight:600; background:rgba(56,189,248,0.12); padding:0.1rem 0.4rem; border-radius:4px; border:1px solid rgba(56,189,248,0.3);">Blueprint Active</span>` : ''}
      </div>
      ${consumers.length > 0 ? `
        <div style="max-height:190px; overflow-y:auto; padding-right:4px; margin-bottom:0.45rem;">
          ${consumers.map(c => {
            const isL4 = c.ware.level === 4;
            const hasPlan = c.inPlan > 0;
            const rateVal = state.activeBlueprint ? c.bpConsumption : c.optConsumption;
            const planColor = (hasPlan && rateVal > 0) ? '#38bdf8' : '#64748b';
            const rateColor = isL4 ? '#c084fc' : (rateVal > 0 ? '#34d399' : '#64748b');
            return `
              <div class="consumer-row" data-ware-id="${c.id}" style="font-size:0.8rem; padding:0.3rem 0.25rem; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center; cursor:pointer; border-radius:4px; transition:background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <strong style="color:#f8fafc;">${c.ware.name}</strong> 
                    ${isL4 
                      ? `<span style="background:rgba(167,139,250,0.18); color:#c084fc; border:1px solid rgba(167,139,250,0.35); padding:1px 5px; border-radius:4px; font-size:0.65rem; font-weight:700;">L4 Application</span>`
                      : `<span style="font-size:0.68rem; color:#94a3b8;">(L${c.ware.level})</span>`
                    }
                  </div>
                  <div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;">
                    ${isL4
                      ? `End Application • Requires <strong style="color:#c084fc;">${c.inputPerMod.toLocaleString()} units</strong>`
                      : (state.activeBlueprint 
                          ? `<span style="color:${planColor}; font-weight:600;">${c.inPlan}x in Plan</span> • ${c.inputPerMod.toLocaleString()} / hr each` 
                          : `<span style="color:#38bdf8; font-weight:600;">${c.calcNeeded > 0 ? `${c.calcNeeded}x Needs` : '0x'}</span> • ${c.inputPerMod.toLocaleString()} / hr each`
                        )
                    }
                  </div>
                </div>
                <div style="text-align:right;">
                  <strong style="color:${rateColor}; font-size:0.82rem;">
                    ${isL4 ? `${c.inputPerMod.toLocaleString()} units` : `${Math.round(rateVal).toLocaleString()} / hr`}
                  </strong>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <hr style="border-color:rgba(255,255,255,0.08); margin:0.35rem 0;" />
        <div style="font-size:0.78rem; line-height:1.45;">
          ${state.activeBlueprint ? `
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#94a3b8;">Total Blueprint Consumption:</span>
              <strong style="color:#fbbf24;">${Math.round(totalBpConsumption).toLocaleString()} / hr</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#94a3b8;">${id === 'ScrapProc' ? 'Scrap Metal Converted' : 'Current Production'} (${inPlanCount}x):</span>
              <strong style="color:#38bdf8;">${Math.round(currentProd).toLocaleString()} / hr</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:0.15rem; padding-top:0.2rem; border-top:1px dashed rgba(255,255,255,0.1);">
              <span style="color:#cbd5e1; font-weight:600;">Net Balance:</span>
              <strong style="color:${netBpBalance >= 0 ? '#34d399' : '#f87171'}; font-weight:700;">
                ${netBpBalance >= 0 ? '+' : ''}${Math.round(netBpBalance).toLocaleString()} / hr ${netBpBalance >= 0 ? '(Surplus)' : '(Deficit)'}
              </strong>
            </div>
          ` : `
            <div style="display:flex; justify-content:space-between;">
              <span style="color:#94a3b8;">Total Downstream Demand:</span>
              <strong style="color:#34d399;">${Math.round(totalOptimumConsumption).toLocaleString()} / hr</strong>
            </div>
          `}
        </div>
      ` : `
        <p style="color:#94a3b8; font-size:0.78rem; font-style:italic; margin:0;">No output consumers.</p>
      `}
    </div>
  `;
  return consumersHtml;
}

// The whole single-ware detail view: direct recipe inputs, raw / EC totals, upstream requirements table and consumers box.
export function renderWareInspectorBody(state, id, ware, { effectiveCount, totalRaw, ecTotal, upstreamRows, isLevel4Target, consumersHtml }) {
  return `
    <div class="recipe-box bi-panel ${state.focusedBiPanel === 'recipe-inputs' ? 'bi-panel-focused' : ''}" data-bi-panel="recipe-inputs" style="margin-top:0.6rem; background:rgba(30,41,59,0.6); padding:0.65rem 0.8rem; border-radius:8px; border:1px solid rgba(56,189,248,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <h4 style="font-size:0.78rem; color:#38bdf8; text-transform:uppercase; font-family:var(--font-heading); letter-spacing:0.03em; margin:0;">
          📋 Direct Recipe Inputs ${state.inspectorSingle ? '(1x Single Module)' : `(${effectiveCount}x Modules Total)`}
        </h4>
        <label style="font-size:0.75rem; color:#38bdf8; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; background:rgba(56,189,248,0.15); padding:0.15rem 0.5rem; border-radius:4px; border:1px solid rgba(56,189,248,0.35);" title="When checked, recalculates direct inputs and upstream totals for a single module">
          <input type="checkbox" id="chkInspectorSingle" ${state.inspectorSingle ? 'checked' : ''} style="cursor:pointer;" />
          Single
        </label>
      </div>
      ${(() => {
        if (!ware.recipe) return '<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">No input materials required (Raw / Solar).</div>';

        const linkedFromDeps = DEPENDENCIES.filter(d => d.to === id).map(d => d.from);
        const displayedInputs = [];
        const telPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelParts']) || 0;
        const scrapPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapHullParts']) || 0;
        const scrapClayPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScrapClaytronics']) || 0;
        const hullPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['HullParts']) || 0;
        const claytronicsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['Claytronics']) || 0;
        const telArrayPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelArray']) || 0;
        const scanArrayPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['ScanArray']) || 0;
        const telEngPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelEngParts']) || 0;
        const engPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['EngParts']) || 0;
        const telAdvCompPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['TelAdvComp']) || 0;
        const advCompPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['AdvComp']) || 0;

        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (inpId === 'HullParts') {
            if (state.activeBlueprint) {
              const hasAlt = telPartsPlan > 0 || scrapPartsPlan > 0;
              if (telPartsPlan > 0 && hullPartsPlan === 0 && scrapPartsPlan === 0) {
                displayedInputs.push({ id: 'TelParts', qty: inpQty, tag: '[TEL Hull Parts]' });
              } else if (scrapPartsPlan > 0 && hullPartsPlan === 0 && telPartsPlan === 0) {
                displayedInputs.push({ id: 'ScrapHullParts', qty: inpQty, tag: '[Scrap Hull Parts]' });
              } else {
                displayedInputs.push({ id: 'HullParts', qty: inpQty, tag: hasAlt ? '[Commonwealth]' : '' });
                if (telPartsPlan > 0) {
                  displayedInputs.push({ id: 'TelParts', qty: inpQty, tag: '[TEL Hull Parts]' });
                }
                if (scrapPartsPlan > 0) {
                  displayedInputs.push({ id: 'ScrapHullParts', qty: inpQty, tag: '[Scrap Hull Parts]' });
                }
              }
            } else {
              displayedInputs.push({ id: 'HullParts', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'EngParts') {
            if (state.activeBlueprint) {
              if (telEngPartsPlan > 0 && engPartsPlan === 0) {
                displayedInputs.push({ id: 'TelEngParts', qty: inpQty, tag: '[TEL Engine Parts]' });
              } else if (telEngPartsPlan > 0 && engPartsPlan > 0) {
                displayedInputs.push({ id: 'EngParts', qty: inpQty, tag: '[Commonwealth]' });
                displayedInputs.push({ id: 'TelEngParts', qty: inpQty, tag: '[TEL Engine Parts]' });
              } else {
                displayedInputs.push({ id: 'EngParts', qty: inpQty, tag: '' });
              }
            } else {
              displayedInputs.push({ id: 'EngParts', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'AdvComp') {
            if (state.activeBlueprint) {
              if (telAdvCompPlan > 0 && advCompPlan === 0) {
                displayedInputs.push({ id: 'TelAdvComp', qty: inpQty, tag: '[TEL Adv Composites]' });
              } else if (telAdvCompPlan > 0 && advCompPlan > 0) {
                displayedInputs.push({ id: 'AdvComp', qty: inpQty, tag: '[Commonwealth]' });
                displayedInputs.push({ id: 'TelAdvComp', qty: inpQty, tag: '[TEL Adv Composites]' });
              } else {
                displayedInputs.push({ id: 'AdvComp', qty: inpQty, tag: '' });
              }
            } else {
              displayedInputs.push({ id: 'AdvComp', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'ScanArray') {
            if (state.activeBlueprint) {
              if (telArrayPlan > 0 && scanArrayPlan === 0) {
                displayedInputs.push({ id: 'TelArray', qty: inpQty, tag: '[TEL Scanning Arrays]' });
              } else if (telArrayPlan > 0 && scanArrayPlan > 0) {
                displayedInputs.push({ id: 'ScanArray', qty: inpQty, tag: '[Commonwealth]' });
                displayedInputs.push({ id: 'TelArray', qty: inpQty, tag: '[TEL Scanning Arrays]' });
              } else {
                displayedInputs.push({ id: 'ScanArray', qty: inpQty, tag: '' });
              }
            } else {
              displayedInputs.push({ id: 'ScanArray', qty: inpQty, tag: '' });
            }
            return;
          } else if (inpId === 'Claytronics') {
            if (state.activeBlueprint) {
              const hasAlt = scrapClayPlan > 0;
              if (scrapClayPlan > 0 && claytronicsPlan === 0) {
                displayedInputs.push({ id: 'ScrapClaytronics', qty: inpQty, tag: '[Scrap Claytronics]' });
              } else {
                displayedInputs.push({ id: 'Claytronics', qty: inpQty, tag: hasAlt ? '[Commonwealth]' : '' });
                if (scrapClayPlan > 0) {
                  displayedInputs.push({ id: 'ScrapClaytronics', qty: inpQty, tag: '[Scrap Claytronics]' });
                }
              }
            } else {
              displayedInputs.push({ id: 'Claytronics', qty: inpQty, tag: '' });
            }
            return;
          }
          displayedInputs.push({ id: inpId, qty: inpQty, tag: '' });
        });

        const inputsToRender = displayedInputs;

        return inputsToRender.map(({ id: inpId, qty: inpQty, tag }) => {
          const inpWare = WARES_DB[inpId];
          const calcQty = state.inspectorSingle ? inpQty : (inpQty * effectiveCount);
          const unitSuffix = ware.level === 4 ? (inpId === 'EC' ? 'EC' : 'units') : '/ hr';
          const cycleQty = (ware.cyclesPerHr && ware.cyclesPerHr > 0 && ware.level < 4) ? (inpQty / ware.cyclesPerHr) : 0;
          const cycleStr = cycleQty > 0 ? `<span style="font-size:0.72rem; color:#94a3b8; font-weight:normal; margin-left:3px;">(${Math.round(cycleQty * 100) / 100} / cycle)</span>` : '';
          return `<div style="font-size:0.82rem; color:#f8fafc; padding:0.2rem 0; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center;"><span>${inpWare ? inpWare.name : inpId} ${tag ? `<span style="font-size:0.68rem; color:#38bdf8; background:rgba(56,189,248,0.12); padding:1px 4px; border-radius:3px; margin-left:3px;">${tag}</span>` : ''}:</span> <strong style="color:#34d399;">${Math.round(calcQty).toLocaleString()} ${unitSuffix}${cycleStr}</strong></div>`;
        }).join('');
      })()}
    </div>

    <div class="workforce-box bi-panel ${state.focusedBiPanel === 'upstream-raw' ? 'bi-panel-focused' : ''}" data-bi-panel="upstream-raw" style="border-color:#38bdf8; margin-top:0.6rem;">
      <h4>⛏️ ${state.inspectorSingle ? 'Single Module' : 'Total'} Upstream Raw Mining & Liquids</h4>
      <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
      <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Demand:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
    </div>

    ${upstreamRows.length > 0 ? `
      <div class="bp-level-panel bi-panel ${state.focusedBiPanel === 'upstream-requirements' ? 'bi-panel-focused' : ''}" data-bi-panel="upstream-requirements" style="margin-top:0.6rem; overflow:hidden; border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
        <div class="section-label" style="padding:0.4rem 0.6rem 0 0.6rem;">${state.inspectorSingle ? 'Single Module' : 'Total'} Upstream Requirements (${upstreamRows.length} Wares)</div>
        <table class="summary-table">
          <thead>
            ${isLevel4Target ? `
              <tr>
                <th id="thUpSortComp" class="sortable" title="Click to sort by Level / Component Name">
                  Material (Level) ${state.bpSortField === 'level' ? (state.bpSortAsc ? '▲' : '▼') : (state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>')}
                </th>
                <th style="text-align:right;">Total Component Count</th>
              </tr>
            ` : `
              <tr>
                <th id="thUpSortComp" class="sortable" title="Click to sort by Level / Component Name">
                  Material (Level) ${state.bpSortField === 'level' ? (state.bpSortAsc ? '▲' : '▼') : (state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>')}
                </th>
                <th id="thUpSortNeeded" class="sortable" title="Click to sort by Needs Modules">
                  ${(!state.inspectorSingle && state.activeBlueprint) ? 'Plan / Needs' : 'Modules'} ${state.bpSortField === 'needed' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
                </th>
                <th>${(!state.inspectorSingle && state.activeBlueprint) ? 'Current / Optimum Rate' : 'Required Rate'}</th>
              </tr>
            `}
          </thead>
          <tbody>
            ${upstreamRows.join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div style="margin-top:0.6rem;">
      ${consumersHtml}
    </div>
  `;
}
