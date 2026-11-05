// Markup of one ware card in the matrix grid, extracted from renderMatrixTabHTML (Stage 4, step 12c).
// `view` is the result of computeWareCardView. Only reads what it is given and returns markup.
import { renderNotOwnedModuleTag } from '../../engine/cuckooDlcLookup.js';
import { getPrimaryMacroForWare } from '../../engine/calculator.js';

export function renderWareCard(state, id, view, { rawSectorName }) {
  const { ware, calc, isTerEC, isEC, inPlanCount, sunlightVal, solarPerMod, solarModsNeeded, isOmitted, hasCalc, initialDisplay, initialGhost, activeCount, prodOutputRate, ecConsRate, totalCompUnits, rawRate, isL1toL3, isPPChecked, hasEcBadge, prodMacro, showBottomPanel, isScrapSubsetCard, isL2orL3, hasCustomOut, displayOutRate, moduleBadgeText, moduleBadgeStyle, moduleBadgeTitle, plannedMacrosForWare, isUnowned } = view;
  return `
                    <div class="ware-card ${initialGhost ? 'ghost-card' : ''} ${id === state.selectedWareId ? 'active-selected' : ''} ${isScrapSubsetCard ? 'scrap-subset-card' : ''}" id="ware-${id}" data-id="${id}" data-omitted="${isOmitted ? 'true' : 'false'}" style="${initialDisplay}">
                      <div class="ware-header">
                        <div class="ware-name ${isUnowned ? 'ware-name-unowned' : ''}" title="${ware.name}">${ware.name}</div>
                        ${isUnowned ? renderNotOwnedModuleTag(plannedMacrosForWare[0]?.[0] || getPrimaryMacroForWare(id) || id) : ''}
                      </div>
                      ${hasCalc ? `
                        <div class="card-calc-info">
                          ${isEC ? `
                            <span class="module-badge" style="background:rgba(251,191,36,0.15); color:#fbbf24; border-color:rgba(251,191,36,0.3);">
                              ${state.activeBlueprint 
                                ? (inPlanCount > 0 
                                    ? `${inPlanCount}x Installed ${isTerEC ? 'TER Solar' : 'Solar'}` 
                                    : (solarModsNeeded > 0 ? `${solarModsNeeded}x Required ${isTerEC ? 'TER Solar' : 'Solar'}` : `0x Installed ${isTerEC ? 'TER Solar' : 'Solar'}`)) 
                                : `${activeCount}x ${solarModsNeeded > 0 ? 'Required ' : ''}${isTerEC ? 'TER Solar' : 'Solar'}`}
                            </span>
                            <span class="rate-badge-prod" title="Hourly production output in ${rawSectorName}">
                              Output: ${Math.round(prodOutputRate).toLocaleString()} /hr
                            </span>
                          ` : `
                            <span class="module-badge" style="${moduleBadgeStyle}" title="${moduleBadgeTitle}">
                              ${moduleBadgeText}
                            </span>
                            ${ware.level === 4 ? `
                              <span class="rate-badge-prod" style="background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3);" title="Total required component units">${Math.round(totalCompUnits).toLocaleString()} Components</span>
                            ` : (isL2orL3 ? `
                              <span class="rate-badge-prod ${hasCustomOut ? 'custom-output-active' : ''}" title="${hasCustomOut ? 'Custom output target override' : 'Hourly production output'}">
                                Output: <input type="number" class="pill-output-input ${hasCustomOut ? 'has-override' : ''}" data-ware-id="${id}" value="${displayOutRate}" min="0" step="1" title="Enter required hourly output to re-evaluate upstream supply" onclick="event.stopPropagation();" onkeydown="if(event.key==='Enter') this.blur();" /> /hr${hasCustomOut ? `<button type="button" class="btn-reset-output" data-ware-id="${id}" title="Reset to calculated output" onclick="event.stopPropagation();">&times;</button>` : ''}
                              </span>
                            ` : (ware.level > 0 ? `
                              <span class="rate-badge-prod" title="Hourly production output">Output: ${Math.round(prodOutputRate).toLocaleString()} /hr</span>
                            ` : `
                              <span class="rate-badge-prod" title="Hourly required ${(id === 'RawScrap' || id === 'RawKhaakScrap') ? 'scrap collection' : 'raw extraction'} rate">${Math.round(rawRate).toLocaleString()} /hr</span>
                            `))}
                          `}
                        </div>
                      ` : `
                        <div class="card-calc-info">
                          ${isL2orL3 ? `
                            <span class="module-badge" style="opacity:0.4; background:none; border-color:rgba(255,255,255,0.1); color:#64748b;">0x Modules</span>
                            <span class="rate-badge-prod" title="Enter required hourly output to re-evaluate upstream supply">
                              Output: <input type="number" class="pill-output-input" data-ware-id="${id}" value="0" min="0" step="1" title="Enter required hourly output to re-evaluate upstream supply" onclick="event.stopPropagation();" onkeydown="if(event.key==='Enter') this.blur();" /> /hr
                            </span>
                          ` : `
                            <span class="module-badge" style="opacity:0.4; background:none; border-color:rgba(255,255,255,0.1); color:#64748b;">Ghost Module</span>
                          `}
                        </div>
                      `}
                      ${showBottomPanel ? `
                        <div class="card-bottom-pill-panel">
                          ${isEC ? `
                            <span class="rate-badge-cons" style="background:rgba(56,189,248,0.12); color:#38bdf8; border-color:rgba(56,189,248,0.25);" title="Solar panel generation efficiency in this sector">
                              ⚡ ${Math.round(solarPerMod).toLocaleString()} EC/mod (${sunlightVal}%)
                            </span>
                          ` : (prodMacro ? `
                            <span class="macro-badge" title="${prodMacro}">${prodMacro}</span>
                          ` : `
                            ${hasEcBadge ? `
                              <span class="rate-badge-cons" title="Energy Cells consumed per hour">⚡ Consumes ${Math.round(ecConsRate).toLocaleString()} EC/hr</span>
                            ` : ''}
                          `)}
                          ${isL1toL3 ? `
                            <label class="pp-checkbox-label" title="Pause Production" onclick="event.stopPropagation();">
                              <input type="checkbox" class="pp-checkbox" data-id="${id}" ${isPPChecked ? 'checked' : ''} onclick="event.stopPropagation();" title="Pause Production" />
                              <span class="pp-text" style="color: ${isPPChecked ? '#f97316' : '#ffffff'};" title="Pause Production">PP</span>
                            </label>
                          ` : ''}
                        </div>
                      ` : ''}
                    </div>
                  `;
}
