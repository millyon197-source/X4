import { WARES_DB, DEPENDENCIES, mapMacroToWare, getFriendlyModuleName, getWareWorkforceMultiplier, MACRO_TO_WARE, FACTION_WARE_MAP } from '../data/wares.js';
import { state, saveActiveBlueprintToStorage } from '../engine/state.js';
import { rebuildBlueprintFromMacros, reloadActiveBlueprint } from '../engine/xmlParser.js';
import { calculateFactoryRequirements, calculateLiveOutputRate } from '../engine/calculator.js';
import { SECTORS_SUNLIGHT, getSectorInfo } from '../data/sectors.js';
import { escapeHtml } from '../html.js';

export { FACTION_WARE_MAP };

export function isFactionWarePresent(id, inPlanCount = 0, hasDemand = false) {
  if (!FACTION_WARE_MAP[id]) return true;

  // Selected ware is always present
  if (state.selectedWareId === id) return true;

  // If active search query matches this ware or its faction, display it
  if (state.searchQuery && state.searchQuery.trim()) {
    const raw = state.searchQuery.trim().toLowerCase();
    const isNegated = raw.startsWith('!');
    const q = isNegated ? raw.slice(1).trim() : raw;
    if (q && !isNegated) {
      const ware = WARES_DB[id];
      const faction = FACTION_WARE_MAP[id];
      const contains = (ware && (
        ware.name.toLowerCase().includes(q) || 
        (ware.cat && ware.cat.toLowerCase().includes(q))
      )) || (faction && faction.toLowerCase().includes(q));
      if (contains) return true;
    }
  }

  // When active blueprint is loaded:
  if (state.activeBlueprint) {
    return inPlanCount > 0 || hasDemand;
  }

  // In Single Target Mode when a target is selected:
  if (state.selectedWareId) {
    return hasDemand;
  }

  // In Single Target Mode when no ware is selected yet:
  return false;
}

export function renderMatrixTabHTML() {
  const lt = state.layerTotals || {
    L1: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L2: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L3: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    totalECNeeded: 0,
    solarModulesNeeded: 0
  };

  const effMultiplier = 1 + (state.workforceBonus / 100);

  const activeLevels = state.subdueLevel4 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  const colClass = state.subdueLevel4 ? 'cols-4' : 'cols-5';

  const sectorInfo = getSectorInfo(lt.sector || state.selectedSector || "Nopileos' Fortune VI / Duke's Awakening");
  const rawSectorName = sectorInfo ? sectorInfo.sector : (lt.sector || state.selectedSector || "Nopileos' Fortune VI / Duke's Awakening");

  let twoLetter = 'Du';
  if (rawSectorName.toLowerCase().includes('duke')) {
    twoLetter = 'Du';
  } else {
    const letters = rawSectorName.replace(/[^a-zA-Z]/g, '');
    twoLetter = letters.length >= 2 ? letters.slice(0, 2) : rawSectorName.slice(0, 2);
  }
  const abbrSectorDisplay = `${twoLetter}...`;

  return `
    <div class="main-wrapper">
      <div class="matrix-viewport" id="viewport">
        <div class="layer-totals-banner ${colClass}">
          <div class="layer-totals-card" style="overflow:hidden;">
            <div class="layer-title" style="display:flex; justify-content:space-between; align-items:center; gap:0.35rem; overflow:hidden;">
              <span style="white-space:nowrap; flex-shrink:0;">⚡ Solar Harvesting</span>
              <div style="display:inline-flex; align-items:center; gap:2px; max-width:115px; overflow:hidden; flex-shrink:1;">
                <span style="font-size:0.75rem; flex-shrink:0;">📍</span>
                <select id="sectorSelect" class="sector-select-badge" title="${rawSectorName} (${lt.sunlight || 100}%) • Click to select sector location">
                  ${SECTORS_SUNLIGHT.map(s => {
                    const isSel = (s.sector === rawSectorName || (state.selectedSector && (state.selectedSector === s.sector || state.selectedSector.includes(s.sector))) || (lt.sector && lt.sector.includes(s.sector)));
                    const optionVal = `${s.sector} (${s.sunlight}%)`;
                    return `<option value="${optionVal}" ${isSel ? 'selected' : ''}>${s.sunlight}% — ${s.sector}</option>`;
                  }).join('')}
                </select>
              </div>
            </div>
            <div class="layer-stat" style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
              <span>Total Demand: <strong style="color:#fbbf24;">${Math.round(lt.totalECNeeded).toLocaleString()} EC/hr</strong></span>
              ${state.activeBlueprint && ((lt.inPlanSolarCount || 0) + (lt.inPlanTerSolarCount || 0) > 0) ? `
                <span style="font-size:0.72rem; color:${lt.ecBalance >= 0 ? '#34d399' : '#f87171'};" title="${(lt.inPlanTerSolarCount || 0) > 0 ? `Combined Solar Generation (${lt.inPlanSolarCount || 0}x Gen + ${lt.inPlanTerSolarCount || 0}x TER) vs Demand` : `Solar Generation (${lt.inPlanSolarCount || 0}x) vs Demand`}">
                  Prod: <strong>${Math.round(lt.totalECProduced).toLocaleString()}</strong> (${lt.ecBalance >= 0 ? '+' : ''}${Math.round(lt.ecBalance).toLocaleString()})
                </span>
              ` : ''}
            </div>
            <div class="layer-sub" style="margin-top:2px;">
              ${(() => {
                const terLoaded = (lt.inPlanTerSolarCount || 0) > 0;
                const genLoaded = (lt.inPlanSolarCount || 0) > 0;

                let installedHtml = '';
                if (state.activeBlueprint) {
                  if (terLoaded && genLoaded) {
                    installedHtml = `Installed: <strong style="color:#38bdf8;">${(lt.inPlanSolarCount || 0) + (lt.inPlanTerSolarCount || 0)}x Total</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${lt.inPlanSolarCount}x Gen)</span> <span style="font-size:0.68rem; color:#94a3b8;">(${lt.inPlanTerSolarCount}x TER)</span> • `;
                  } else if (terLoaded) {
                    installedHtml = `Installed: <strong style="color:#38bdf8;">${lt.inPlanTerSolarCount}x TER</strong> • `;
                  } else if (genLoaded || (lt.solarModulesNeeded > 0)) {
                    installedHtml = `Installed: <strong style="color:#38bdf8;">${lt.inPlanSolarCount || 0}x</strong> • `;
                  }
                }

                let reqHtml = '';
                if (state.activeBlueprint && !terLoaded) {
                  reqHtml = `Requires <strong style="color:#34d399;">${lt.solarModulesNeeded}x</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.solarOutputPerPanel || 10500).toLocaleString()}/mod)</span>`;
                } else if (state.activeBlueprint && terLoaded && !genLoaded) {
                  reqHtml = `Requires <strong style="color:#38bdf8;">${lt.terSolarModulesNeeded}x TER</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.terSolarOutputPerPanel || 3000).toLocaleString()}/mod)</span>`;
                } else {
                  reqHtml = `Requires <strong style="color:#34d399;">${lt.solarModulesNeeded}x Gen</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.solarOutputPerPanel || 10500).toLocaleString()}/mod)</span> or <strong style="color:#38bdf8;">${lt.terSolarModulesNeeded}x TER</strong> <span style="font-size:0.68rem; color:#94a3b8;">(${Math.round(lt.terSolarOutputPerPanel || 3000).toLocaleString()}/mod)</span>`;
                }

                return `${installedHtml}${reqHtml}`;
              })()}
            </div>
          </div>
          <div class="layer-totals-card">
            <div class="layer-title">
              <span>Level 1: Refined Goods</span>
            </div>
            <div class="layer-stat">Output: <strong style="color:#34d399;">${Math.round(lt.L1.totalProd).toLocaleString()} /hr</strong></div>
            <div class="layer-sub">Layer EC: <strong style="color:#fbbf24;">${Math.round(lt.L1.ecConsumed).toLocaleString()} EC/hr</strong></div>
          </div>
          <div class="layer-totals-card">
            <div class="layer-title">
              <span>Level 2: Intermediates</span>
            </div>
            <div class="layer-stat">Output: <strong style="color:#34d399;">${Math.round(lt.L2.totalProd).toLocaleString()} /hr</strong></div>
            <div class="layer-sub">Layer EC: <strong style="color:#fbbf24;">${Math.round(lt.L2.ecConsumed).toLocaleString()} EC/hr</strong></div>
          </div>
          <div class="layer-totals-card">
            <div class="layer-title">
              <span>Level 3: High-Tech</span>
            </div>
            <div class="layer-stat">Output: <strong style="color:#34d399;">${Math.round(lt.L3.totalProd).toLocaleString()} /hr</strong></div>
            <div class="layer-sub">Layer EC: <strong style="color:#fbbf24;">${Math.round(lt.L3.ecConsumed).toLocaleString()} EC/hr</strong></div>
          </div>
          ${!state.subdueLevel4 ? `
            <div class="layer-totals-card">
              <div class="layer-title">
                <span style="color:#a78bfa;">Level 4: Applications</span>
              </div>
              <div class="layer-stat">Output: <strong style="color:#a78bfa;">9 Modules</strong></div>
              <div class="layer-sub">Shipyards, Docks &amp; HQ Claims</div>
            </div>
          ` : ''}
        </div>

        <svg class="svg-overlay" id="svgCanvas"></svg>

        <div class="matrix-grid ${colClass}" id="matrixGrid">
          ${activeLevels.map(level => {
            const levelWares = Object.keys(WARES_DB).filter(id => WARES_DB[id].level === level);
            const titles = ['Level 0: Raw', 'Level 1: Refined Goods', 'Level 2: Intermediates', 'Level 3: High-Tech', 'Level 4: Applications'];
            const levelEcConsumed = level >= 1 && level <= 3 ? (lt[`L${level}`] ? lt[`L${level}`].ecConsumed : 0) : 0;
            return `
              <div class="matrix-col col-${level}" data-level="${level}">
                <div class="col-badge">
                  <span>${titles[level]}</span>
                </div>
                ${levelWares.map(id => {
                  const ware = WARES_DB[id];
                  const calc = state.calculatedDemand[id];
                  const isGenEC = id === 'EC';
                  const isTerEC = id === 'TerEC';
                  const isEC = isGenEC || isTerEC;
                  let inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[id]) || 0;
                  if (isTerEC && inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
                    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
                      if (mapMacroToWare(m) === 'TerEC') inPlanCount += count;
                    });
                  }
                  if (isGenEC && inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
                    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
                      if (mapMacroToWare(m) === 'EC') inPlanCount += count;
                    });
                  }
                  if (inPlanCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
                    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
                      if (mapMacroToWare(m) === id) inPlanCount += count;
                    });
                  }
                  const calcNeeded = calc ? (calc.modulesNeeded || 0) : 0;
                  const hasDemand = calc ? (calc.rateNeeded > 0 || calc.modulesNeeded > 0) : false;
                  const isTerECOmitted = isTerEC && state.activeBlueprint && inPlanCount === 0;
                  const isFactionOmitted = !isFactionWarePresent(id, inPlanCount, hasDemand);
                  const isOmitted = isTerECOmitted || isFactionOmitted;

                  const rawQ = (state.searchQuery || '').trim().toLowerCase();
                  const isNegatedQ = rawQ.startsWith('!');
                  const searchQ = isNegatedQ ? rawQ.slice(1).trim() : rawQ;
                  const isSearchActive = Boolean(searchQ);
                  let isMatchedBySearch = false;
                  if (isSearchActive) {
                    const faction = FACTION_WARE_MAP[id];
                    const wareName = (ware.name || '').toLowerCase();
                    const wareCat = (ware.cat || '').toLowerCase();
                    const factionName = (faction || '').toLowerCase();
                    const contains = wareName.includes(searchQ) || wareCat.includes(searchQ) || factionName.includes(searchQ);
                    isMatchedBySearch = isNegatedQ ? !contains : contains;
                  }

                  const hasCalc = state.activeBlueprint 
                    ? (inPlanCount > 0 || hasDemand || (isEC && lt.totalECNeeded > 0) || ware.level === 4 || !state.subdueZeroX) 
                    : true;
                  const isGhost = state.activeBlueprint ? (state.subdueZeroX && inPlanCount === 0 && !hasDemand && ware.level !== 4) : false;

                  let initialDisplay = isOmitted ? 'display:none;' : '';
                  let initialGhost = isGhost;
                  if (isSearchActive) {
                    if (isMatchedBySearch) {
                      initialDisplay = '';
                      initialGhost = false;
                    } else {
                      if (isOmitted) {
                        initialDisplay = 'display:none;';
                      } else {
                        initialDisplay = '';
                        initialGhost = true;
                      }
                    }
                  }

                  const solarPerMod = isTerEC ? (lt.terSolarOutputPerPanel || 3000) : (lt.solarOutputPerPanel || 10500);
                  const solarModsNeeded = isTerEC ? (lt.terSolarModulesNeeded || 0) : (lt.solarModulesNeeded || 0);

                  const activeCount = isEC 
                    ? (state.activeBlueprint ? inPlanCount : (solarModsNeeded > 0 ? solarModsNeeded : 1)) 
                    : (state.activeBlueprint ? (inPlanCount > 0 ? inPlanCount : calcNeeded) : (calcNeeded > 0 ? calcNeeded : 1));

                  let prodOutputRate = 0;
                  let ecConsRate = 0;
                  let totalCompUnits = 0;
                  let rawRate = 0;
                  if (hasCalc) {
                    const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
                    if (ware.level === 4) {
                      totalCompUnits = ware.recipe ? Object.entries(ware.recipe).filter(([k]) => k !== 'EC').reduce((sum, [_, v]) => sum + v, 0) : 0;
                    } else if (isEC) {
                      prodOutputRate = activeCount * solarPerMod;
                    } else if (ware.level > 0) {
                      const baselineCalc = (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[id]) || (state.calculatedDemand && state.calculatedDemand[id]);
                      const optimumRate = baselineCalc ? (baselineCalc.rateNeeded || 0) : 0;
                      prodOutputRate = optimumRate > 0 ? calculateLiveOutputRate(id, activeCount, optimumRate) : activeCount * (ware.baseRate || 1) * wareEff;
                    } else if (ware.level === 0) {
                      rawRate = (calc && calc.rateNeeded > 0) ? calc.rateNeeded : 0;
                    }
                    if (ware.recipe && ware.recipe['EC']) {
                      const inputEff = (ware.level >= 1 && ware.level <= 3) ? wareEff : 1;
                      ecConsRate = activeCount * ware.recipe['EC'] * inputEff;
                    }
                  }

                  return `
                    <div class="ware-card ${initialGhost ? 'ghost-card' : ''} ${id === state.selectedWareId ? 'active-selected' : ''}" id="ware-${id}" data-id="${id}" data-omitted="${isOmitted ? 'true' : 'false'}" style="${initialDisplay}">
                      <div class="ware-header">
                        <div class="ware-name">${ware.name}</div>
                      </div>
                      ${hasCalc ? `
                        <div class="card-calc-info">
                          ${isEC ? `
                            <span class="module-badge" style="background:rgba(251,191,36,0.15); color:#fbbf24; border-color:rgba(251,191,36,0.3);">
                              ${state.activeBlueprint ? `${inPlanCount}x Installed ${isTerEC ? 'TER Solar' : 'Solar'}` : `${solarModsNeeded}x Required ${isTerEC ? 'TER Solar' : 'Solar'}`}
                            </span>
                            <span class="rate-badge-prod" title="Hourly production output in ${rawSectorName}">
                              Output: ${Math.round(activeCount * solarPerMod).toLocaleString()}/hr
                            </span>
                          ` : `
                            <span class="module-badge" style="${ware.level === 4 ? 'background:rgba(167,139,250,0.15); color:#a78bfa; border-color:rgba(167,139,250,0.3);' : ''}">${ware.level === 4 ? (ware.cat || 'Application') : (ware.level > 0 ? `${activeCount}x Modules` : (id === 'RawScrap' ? 'Scrap' : 'Mining'))}</span>
                            ${ware.level === 4 ? `
                              <span class="rate-badge-prod" style="background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3);" title="Total required component units">${Math.round(totalCompUnits).toLocaleString()} Components</span>
                            ` : (ware.level > 0 ? `
                              <span class="rate-badge-prod" title="Hourly production output">Output: ${Math.round(prodOutputRate).toLocaleString()}/hr</span>
                            ` : `
                              <span class="rate-badge-prod" ${id === 'RawScrap' ? 'style="background:rgba(251,191,36,0.15); color:#fbbf24; border-color:rgba(251,191,36,0.3);"' : ''} title="Hourly required ${id === 'RawScrap' ? 'scrap collection' : 'raw extraction'} rate">${Math.round(rawRate).toLocaleString()}/hr</span>
                            `)}
                          `}
                        </div>
                        ${isEC ? `
                          <div style="margin-top:0.25rem; display:flex; justify-content:flex-start;">
                            <span class="rate-badge-cons" style="background:rgba(56,189,248,0.12); color:#38bdf8; border-color:rgba(56,189,248,0.25);" title="Solar panel generation efficiency in this sector">
                              ⚡ ${Math.round(solarPerMod).toLocaleString()} EC/mod (${lt.sunlight}%)
                            </span>
                          </div>
                        ` : `
                          ${!state.subdueEcCalc && ecConsRate > 0 ? `
                            <div style="margin-top:0.25rem; display:flex; justify-content:flex-start;">
                              <span class="rate-badge-cons" title="Energy Cells consumed per hour">⚡ Consumes ${Math.round(ecConsRate).toLocaleString()} EC/hr</span>
                            </div>
                          ` : ''}
                        `}
                      ` : `
                        <div class="card-calc-info">
                          <span class="module-badge" style="opacity:0.4; background:none; border-color:rgba(255,255,255,0.1); color:#64748b;">${state.activeBlueprint ? 'Ghost Module' : 'Hover / Select'}</span>
                        </div>
                      `}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <aside class="inspector-panel" id="inspectorPanel">
        <div class="inspector-header">
          <div class="inspector-title">
            <h2 id="insTitle">${state.activeBlueprint ? 'Blueprint Inspector' : 'Module Inspector'}</h2>
            <span id="insSub">${state.activeBlueprint ? escapeHtml(state.activeBlueprint.name) : 'Single Target Mode'}</span>
          </div>
          <button class="btn-close" id="btnCloseIns">&times;</button>
        </div>
        <div class="inspector-body" id="insBody"></div>
      </aside>
    </div>
  `;
}

export function drawLines() {
  const svg = document.getElementById('svgCanvas');
  const viewport = document.getElementById('viewport');
  if (!svg || !viewport) return;

  const rect = viewport.getBoundingClientRect();
  svg.setAttribute('width', viewport.scrollWidth);
  svg.setAttribute('height', viewport.scrollHeight);
  svg.innerHTML = '';

  DEPENDENCIES.forEach(dep => {
    if (dep.from === 'EC' || dep.from === 'TerEC') return;
    const toWare = WARES_DB[dep.to];
    if (toWare && toWare.level === 4) return;

    const fromEl = document.getElementById(`ware-${dep.from}`);
    const toEl = document.getElementById(`ware-${dep.to}`);
    if (!fromEl || !toEl || fromEl.style.display === 'none' || toEl.style.display === 'none') return;

    const r1 = fromEl.getBoundingClientRect();
    const r2 = toEl.getBoundingClientRect();

    const x1 = r1.right - rect.left + viewport.scrollLeft;
    const y1 = r1.top + r1.height / 2 - rect.top + viewport.scrollTop;
    const x2 = r2.left - rect.left + viewport.scrollLeft;
    const y2 = r2.top + r2.height / 2 - rect.top + viewport.scrollTop;

    const dx = (x2 - x1) * 0.45;

    const fromInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[dep.from]) || 0;
    const toInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[dep.to]) || 0;

    const fromCalc = state.calculatedDemand[dep.from];
    const toCalc = state.calculatedDemand[dep.to];

    const isFromActive = fromInPlan > 0 || (fromCalc && (fromCalc.rateNeeded > 0 || fromCalc.modulesNeeded > 0));
    const isToActive = toInPlan > 0 || (toCalc && (toCalc.rateNeeded > 0 || toCalc.modulesNeeded > 0));

    let isActiveLink = isFromActive && isToActive;
    if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
      isActiveLink = false;
    }

    const isScrap = dep.from === 'ScrapMetal' || dep.from === 'RawScrap';
    const isDashed = dep.dashed || false;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', `link-line ${isActiveLink ? 'active-link' : 'ghost-link'} ${isScrap ? 'scrap-link' : ''} ${isDashed ? 'dashed-link' : ''}`.trim());
    path.setAttribute('data-from', dep.from);
    path.setAttribute('data-to', dep.to);
    if (isDashed) {
      path.setAttribute('data-dashed', 'true');
    }
    svg.appendChild(path);
  });

  if (!state.searchQuery || !state.searchQuery.trim()) {
    highlightGraph(state.selectedWareId);
  } else {
    document.querySelectorAll('.link-line').forEach(line => {
      const from = line.getAttribute('data-from');
      const to = line.getAttribute('data-to');
      const fromEl = document.getElementById(`ware-${from}`);
      const toEl = document.getElementById(`ware-${to}`);
      if (!fromEl || !toEl || fromEl.style.display === 'none' || toEl.style.display === 'none') return;

      const fromGhost = fromEl.classList.contains('ghost-card');
      const toGhost = toEl.classList.contains('ghost-card');
      const isScrap = from === 'ScrapMetal' || from === 'RawScrap';
      const isDashed = line.getAttribute('data-dashed') === 'true';
      const dashedClass = isDashed ? 'dashed-link' : '';

      if (!fromGhost && !toGhost) {
        line.className.baseVal = `link-line active-link ${isScrap ? 'scrap-link' : ''} ${dashedClass}`.trim();
      } else {
        line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''} ${dashedClass}`.trim();
      }
    });
  }
}

export function highlightGraph(id) {
  if (!id) {
    document.querySelectorAll('.link-line').forEach(l => {
      const from = l.getAttribute('data-from');
      const to = l.getAttribute('data-to');

      const fromInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[from]) || 0;
      const toInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[to]) || 0;

      const fromCalc = state.calculatedDemand[from];
      const toCalc = state.calculatedDemand[to];

      const isFromActive = fromInPlan > 0 || (fromCalc && (fromCalc.rateNeeded > 0 || fromCalc.modulesNeeded > 0));
      const isToActive = toInPlan > 0 || (toCalc && (toCalc.rateNeeded > 0 || toCalc.modulesNeeded > 0));

      const isDashed = l.getAttribute('data-dashed') === 'true';
      const isScrap = from === 'ScrapMetal' || from === 'RawScrap';

      let active = isFromActive && isToActive;
      if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
        active = false;
      }
      l.className.baseVal = `link-line ${active ? 'active-link' : 'ghost-link'} ${isScrap ? 'scrap-link' : ''} ${isDashed ? 'dashed-link' : ''}`.trim();
    });
    document.querySelectorAll('.ware-card').forEach(c => {
      const cardId = c.dataset.id;
      const inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[cardId]) || 0;
      const calc = state.calculatedDemand[cardId];
      const hasDemand = calc && (calc.rateNeeded > 0 || calc.modulesNeeded > 0);
      const isEC = cardId === 'EC' || cardId === 'TerEC';
      const hasCalc = inPlan > 0 || hasDemand || (isEC && state.layerTotals && state.layerTotals.totalECNeeded > 0);
      const shouldGhost = state.activeBlueprint ? (state.subdueZeroX && inPlan === 0 && !hasDemand) : false;
      c.classList.toggle('ghost-card', shouldGhost);
    });
    return;
  }

  const selectedWare = WARES_DB[id];
  const isLevel4 = selectedWare && selectedWare.level === 4;

  const upstreamSet = new Set([id]);
  const downstreamSet = new Set([id]);

  function traverseUp(curr) {
    DEPENDENCIES.filter(d => d.to === curr).forEach(d => {
      upstreamSet.add(d.from);
      traverseUp(d.from);
    });
  }

  function traverseDown(curr) {
    DEPENDENCIES.filter(d => d.from === curr).forEach(d => {
      downstreamSet.add(d.to);
      traverseDown(d.to);
    });
  }

  traverseUp(id);
  if (!isLevel4) {
    traverseDown(id);
  }

  const allowedNodes = isLevel4 ? upstreamSet : new Set([...upstreamSet, ...downstreamSet]);

  document.querySelectorAll('.ware-card').forEach(card => {
    const cardId = card.dataset.id;
    const isAllowed = allowedNodes.has(cardId);

    if (isAllowed) {
      card.classList.remove('ghost-card');
    } else {
      card.classList.add('ghost-card');
    }
  });

  document.querySelectorAll('.link-line').forEach(line => {
    const from = line.getAttribute('data-from');
    const to = line.getAttribute('data-to');
    const isScrap = from === 'ScrapMetal' || from === 'RawScrap';
    const isDashed = line.getAttribute('data-dashed') === 'true';
    const dashedClass = isDashed ? 'dashed-link' : '';

    const fromInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[from] || 0) : 1;
    const toInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[to] || 0) : 1;

    const isUpstreamLink = upstreamSet.has(from) && upstreamSet.has(to);
    const isDownstreamLink = !isLevel4 && downstreamSet.has(from) && downstreamSet.has(to);
    const isTracedLink = isUpstreamLink || isDownstreamLink;

    if (isTracedLink) {
      line.className.baseVal = `link-line active-link ${isScrap ? 'scrap-link' : ''} ${dashedClass}`.trim();
    } else {
      line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''} ${dashedClass}`.trim();
    }
  });
}

export function filterWares() {
  const raw = (state.searchQuery || '').trim().toLowerCase();
  const isNegated = raw.startsWith('!');
  const q = isNegated ? raw.slice(1).trim() : raw;

  if (!q) {
    // Search is cleared: restore default visibility and ghosting
    document.querySelectorAll('.ware-card').forEach(card => {
      const isOmitted = card.dataset.omitted === 'true';
      card.style.display = isOmitted ? 'none' : '';
    });
    highlightGraph(state.selectedWareId);
    drawLines();
    return;
  }

  // Active search query: any partial match becomes visible and un-ghosted, others ghosted
  document.querySelectorAll('.ware-card').forEach(card => {
    const id = card.dataset.id;
    const ware = WARES_DB[id];
    if (!ware) return;

    const isOmitted = card.dataset.omitted === 'true';
    const faction = FACTION_WARE_MAP[id];

    const wareName = (ware.name || '').toLowerCase();
    const wareCat = (ware.cat || '').toLowerCase();
    const factionName = (faction || '').toLowerCase();

    const contains = wareName.includes(q) || wareCat.includes(q) || factionName.includes(q);
    const matches = isNegated ? !contains : contains;

    if (matches) {
      // Partial match: card becomes visible and un-ghosted
      card.style.display = '';
      card.classList.remove('ghost-card');
    } else {
      // Non-match
      if (isOmitted) {
        // Non-present faction cards remain hidden if not matched
        card.style.display = 'none';
      } else {
        // Regular cards stay in grid layout but are ghosted
        card.style.display = '';
        card.classList.add('ghost-card');
      }
    }
  });

  drawLines();
}

export function centerOnWare(id) {
  if (!id) return;
  const cardEl = document.getElementById(`ware-${id}`);
  const viewport = document.getElementById('viewport');
  if (!cardEl || !viewport) return;

  const cardRect = cardEl.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();

  const scrollLeftTarget = viewport.scrollLeft + (cardRect.left - viewportRect.left) - (viewportRect.width / 2) + (cardRect.width / 2);
  const scrollTopTarget = viewport.scrollTop + (cardRect.top - viewportRect.top) - (viewportRect.height / 2) + (cardRect.height / 2);

  viewport.scrollTo({
    left: Math.max(0, scrollLeftTarget),
    top: Math.max(0, scrollTopTarget),
    behavior: 'smooth'
  });
}

export function selectWare(id, onRender) {
  state.selectedWareId = id;
  const selectedWare = WARES_DB[id];
  const isLevel4 = selectedWare && selectedWare.level === 4;

  if (isLevel4) {
    // If "Subdue Level 4" is unchecked, do not recalculate any cards only highlight cards associated.
    document.querySelectorAll('.ware-card').forEach(card => {
      card.classList.toggle('active-selected', card.dataset.id === id);
    });
    highlightGraph(id);
    updateInspector(id, onRender);
    if (id) {
      setTimeout(() => centerOnWare(id), 60);
    }
    return;
  }

  if (typeof onRender === 'function') onRender();
  highlightGraph(id);
  if (id) {
    setTimeout(() => centerOnWare(id), 60);
  }
}

export function updateInspector(id, onRender) {
  const insTitle = document.getElementById('insTitle');
  const insSub = document.getElementById('insSub');
  const insBody = document.getElementById('insBody');

  if (!insTitle || !insSub || !insBody) return;

  const effMultiplier = 1 + (state.workforceBonus / 100);

  // CASE 1: Active Blueprint loaded & no specific card selected
  if (state.activeBlueprint && !id) {
    const dbOrder = Object.keys(WARES_DB);
    const liveDemand = state.calculatedDemand || (state.activeBlueprint && state.activeBlueprint.baselineDemand) || {};
    const liveLt = state.layerTotals || (state.activeBlueprint && state.activeBlueprint.baselineLayerTotals) || { totalECNeeded: 0, solarModulesNeeded: 0 };

    // Gather all card modules where needed module count is not equal to plan count
    const diffList = [];
    let hasExceeded = false;
    let hasDeficit = false;

    Object.keys(WARES_DB).forEach(wId => {
      const ware = WARES_DB[wId];
      if (ware.level === 0 || ware.level === 4) return;

      const inPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wId]) || 0;
      let optimum = 0;
      if (wId === 'EC') {
        optimum = liveLt.solarModulesNeeded || (liveDemand['EC'] ? liveDemand['EC'].modulesNeeded : 0);
      } else if (liveDemand[wId]) {
        optimum = liveDemand[wId].modulesNeeded || 0;
      }

      if (inPlan > optimum) {
        hasExceeded = true;
      } else if (inPlan < optimum) {
        hasDeficit = true;
      }

      if (inPlan !== optimum && (inPlan > 0 || optimum > 0)) {
        const diff = optimum - inPlan;
        const diffSign = diff > 0 ? '+' : '';
        const diffColor = diff > 0 ? '#f87171' : '#38bdf8';
        const asterisk = inPlan > optimum ? '<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : '';
        diffList.push(`<span style="white-space:nowrap;" title="Plan: ${inPlan}x • Needs: ${optimum}x • Delta: ${diffSign}${diff}x${inPlan > optimum ? ' (Plan exceeds Needs)' : ''}"><strong style="color:${diffColor};">${diffSign}${diff}x</strong> ${ware.name}${asterisk}</span>`);
      }
    });

    // Plan >= Needs counts as matching Needs; unchecked only when there is a deficit
    const isAllSynced = !hasDeficit;
    const matchNeedsLabel = hasExceeded ? 'Match Needs<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : 'Match Needs';
    const matchNeedsTitle = hasExceeded
      ? "When checked, updates each module's Plan value to its calculated Needed count (preserving higher Plan values) and recalculates (* indicates one or more Plan values exceed Needs)"
      : "When checked, updates each module's Plan value to its calculated Needed count and recalculates";

    insTitle.innerText = 'Blueprint Inspector';
    insSub.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-top:0.15rem;">
        <span style="color:#94a3b8; font-size:0.75rem;">${escapeHtml(state.activeBlueprint.name)}</span>
        <label style="font-size:0.72rem; color:#38bdf8; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; background:rgba(56,189,248,0.15); padding:0.15rem 0.5rem; border-radius:4px; border:1px solid rgba(56,189,248,0.35); user-select:none;" title="${matchNeedsTitle}">
          <input type="checkbox" id="chkSyncOptimum" ${isAllSynced ? 'checked' : ''} style="cursor:pointer;" />
          ${matchNeedsLabel}
        </label>
      </div>
    `;

    const rawList = [
      { name: 'Ore', rate: state.calculatedDemand['Ore'] ? state.calculatedDemand['Ore'].rateNeeded : 0 },
      { name: 'Silicon', rate: state.calculatedDemand['Silicon'] ? state.calculatedDemand['Silicon'].rateNeeded : 0 },
      { name: 'Methane', rate: state.calculatedDemand['Methane'] ? state.calculatedDemand['Methane'].rateNeeded : 0 },
      { name: 'Hydrogen', rate: state.calculatedDemand['Hydrogen'] ? state.calculatedDemand['Hydrogen'].rateNeeded : 0 },
      { name: 'Helium', rate: state.calculatedDemand['Helium'] ? state.calculatedDemand['Helium'].rateNeeded : 0 },
      { name: 'Ice', rate: state.calculatedDemand['Ice'] ? state.calculatedDemand['Ice'].rateNeeded : 0, color: '#38bdf8' },
      { name: 'Raw Scrap Fragments', rate: state.calculatedDemand['RawScrap'] ? state.calculatedDemand['RawScrap'].rateNeeded : 0, color: '#fbbf24' },
      { name: 'Protectyon (Condensate)', rate: state.calculatedDemand['Protectyon'] ? state.calculatedDemand['Protectyon'].rateNeeded : 0, color: '#f472b6' }
    ];

    const activeRawList = rawList.filter(item => item.rate > 0);
    const totalRaw = activeRawList.reduce((sum, item) => sum + item.rate, 0);
    const ecTotal = state.layerTotals ? state.layerTotals.totalECNeeded : (state.calculatedDemand['EC'] ? state.calculatedDemand['EC'].rateNeeded : 0);

    const bpEntriesMap = {};
    
    // 1. Add all Level 1-3 modules in active blueprint
    if (state.activeBlueprint && state.activeBlueprint.modules) {
      Object.entries(state.activeBlueprint.modules).forEach(([wId, count]) => {
        if (count > 0 && WARES_DB[wId] && WARES_DB[wId].level >= 1 && WARES_DB[wId].level <= 3) {
          const calc = liveDemand[wId] || (state.calculatedDemand && state.calculatedDemand[wId]) || { modulesNeeded: count, rateNeeded: 0 };
          bpEntriesMap[wId] = calc;
        }
      });
    }

    // 2. Add all Level 1-3 wares in liveDemand with rateNeeded > 0
    Object.entries(liveDemand).forEach(([wId, calc]) => {
      if (calc && calc.rateNeeded > 0 && WARES_DB[wId] && WARES_DB[wId].level >= 1 && WARES_DB[wId].level <= 3) {
        bpEntriesMap[wId] = calc;
      }
    });

    // 3. Add all Level 1-3 wares in calculatedDemand with rateNeeded > 0
    if (state.calculatedDemand) {
      Object.entries(state.calculatedDemand).forEach(([wId, calc]) => {
        if (calc && calc.rateNeeded > 0 && WARES_DB[wId] && WARES_DB[wId].level >= 1 && WARES_DB[wId].level <= 3) {
          if (!bpEntriesMap[wId]) bpEntriesMap[wId] = calc;
        }
      });
    }

    const sortedEntries = Object.entries(bpEntriesMap)
      .sort(([idA, calcA], [idB, calcB]) => {
        const wareA = WARES_DB[idA];
        const wareB = WARES_DB[idB];
        if (state.bpSortField === 'needed') {
          const neededA = calcA.modulesNeeded || 0;
          const neededB = calcB.modulesNeeded || 0;
          if (neededA !== neededB) {
            return state.bpSortAsc ? neededA - neededB : neededB - neededA;
          }
          return wareA.level !== wareB.level ? wareA.level - wareB.level : (dbOrder.indexOf(idA) - dbOrder.indexOf(idB));
        } else if (state.bpSortField === 'component') {
          const compComp = wareA.name.localeCompare(wareB.name);
          return state.bpSortAsc ? compComp : -compComp;
        } else {
          // Default: Sort by level (L1 -> L2 -> L3 -> L4), then by card display order in matrix
          if (wareA.level !== wareB.level) {
            return state.bpSortAsc ? wareA.level - wareB.level : wareB.level - wareA.level;
          }
          const orderDiff = dbOrder.indexOf(idA) - dbOrder.indexOf(idB);
          return state.bpSortAsc ? orderDiff : -orderDiff;
        }
      });

    // Helper to categorize module for grouping similar module types together
    const getModuleCategoryOrder = (macro, name) => {
      const m = (macro || '').toLowerCase();
      const n = (name || '').toLowerCase();

      // 1. Habitation / Workforce
      if (m.startsWith('hab_') || n.includes('habitat') || n.includes('dome') || n.includes('biome') || n.includes('living')) return 1;
      // 2. Storage Modules
      if (m.startsWith('storage_') || n.includes('storage')) return 2;
      // 3. Docks & Piers
      if (m.startsWith('dockarea_') || m.startsWith('pier_') || n.includes('dock') || n.includes('pier') || n.includes('landing')) return 3;
      // 4. Defence Platforms
      if (m.startsWith('defence_') || m.startsWith('defense_') || n.includes('defence') || n.includes('defense') || n.includes('turret')) return 4;
      // 5. Observation & Sensors / Radar
      if (m.includes('observationdeck') || m.startsWith('radar_') || n.includes('observation') || n.includes('radar') || n.includes('sensor')) return 5;
      // 6. Connection Structures & Trusses
      if (m.startsWith('struct_') || n.includes('connection') || n.includes('structure') || n.includes('cross') || n.includes('vertical') || n.includes('base') || n.includes('truss')) return 6;

      return 7;
    };

    // Gather all non-contributing ware modules
    const nonContributingMap = {};
    let totalNonContributingCount = 0;

    if (state.activeBlueprint && state.activeBlueprint.rawMacros) {
      Object.entries(state.activeBlueprint.rawMacros).forEach(([macro, count]) => {
        if (!mapMacroToWare(macro) && count > 0) {
          const friendly = getFriendlyModuleName(macro);
          const catOrder = getModuleCategoryOrder(macro, friendly);
          if (!nonContributingMap[friendly]) {
            nonContributingMap[friendly] = { count: 0, catOrder, name: friendly };
          }
          nonContributingMap[friendly].count += count;
          totalNonContributingCount += count;
        }
      });
    }

    const nonContributingList = Object.values(nonContributingMap)
      .sort((a, b) => {
        if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
        return a.name.localeCompare(b.name);
      })
      .map(item => `<span style="white-space:nowrap;"><strong style="color:#38bdf8;">${item.count}x</strong> ${escapeHtml(item.name)}</span>`);

    const lt = state.layerTotals || { totalECNeeded: 0, solarModulesNeeded: 0 };
    const productionEntries = sortedEntries.filter(([wId]) => WARES_DB[wId] && WARES_DB[wId].level < 4);

    let lastLevel = null;
    const levelMeta = {
      1: { title: 'Level 1: Refined Goods', color: 'var(--l1-color)', icon: '⚙️' },
      2: { title: 'Level 2: Intermediates', color: 'var(--l2-color)', icon: '🔩' },
      3: { title: 'Level 3: High-Tech Components', color: 'var(--l3-color)', icon: '🔬' }
    };

    const renderTableRow = ([wareId, calc]) => {
      const ware = WARES_DB[wareId];
      const inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
      const liveCalc = (state.calculatedDemand && state.calculatedDemand[wareId]) || (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[wareId]) || calc;
      const neededModules = liveCalc.modulesNeeded || 0;
      const neededCountStr = neededModules >= 1 ? `${neededModules}x` : `${neededModules.toFixed(1)}x`;
      const isDirectPlan = inPlanCount > 0;
      const isSubdued = state.subdueZeroX && inPlanCount === 0;
      const isExceeded = inPlanCount > neededModules;
      const asterisk = isExceeded ? '<span style="color:#fb923c; font-weight:bold; margin-left:1px;">*</span>' : '';

      const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
      const optimumRate = liveCalc.rateNeeded > 0 
        ? liveCalc.rateNeeded 
        : (neededModules * (ware.baseRate || 1) * wareEff);
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
        const inputEff = (ware.level >= 1 && ware.level <= 3) ? wareEff : 1;
        ecConsRate = modCount * ware.recipe['EC'] * inputEff;
      }

      const rateDisplay = `
        <div style="font-size:0.75rem; line-height:1.35;">
          <div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${planColor};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>
          <div><span style="color:#94a3b8; font-size:0.68rem;">Optimum:</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
        </div>
      `;

      let dividerHtml = '';
      if (state.bpSortField === 'level' && ware.level !== lastLevel) {
        lastLevel = ware.level;
        const meta = levelMeta[ware.level] || { title: `Level ${ware.level}`, color: '#38bdf8', icon: '🔹' };
        dividerHtml = `
          <tr class="level-divider-row" style="background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <td colspan="3" style="padding: 0.35rem 0.6rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: ${meta.color}; font-family: var(--font-heading);">
              ${meta.icon} ${meta.title}
            </td>
          </tr>
        `;
      }

      return `
        ${dividerHtml}
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
    };

    insBody.innerHTML = `
      <div class="workforce-box" style="border-color:#38bdf8;">
        <h4>⛏️ Total Recalculated Raw Mining & Liquids</h4>
        <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
        <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Demand:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
      </div>

      <div style="margin-top:0.6rem;">
        <div class="section-label">All Plan Modules & Recalculated Upstream Chains</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th id="thBpSortComp" class="sortable" title="Click to sort by Level / Component Name">
                Component (Level) ${state.bpSortField === 'level' ? (state.bpSortAsc ? '▲' : '▼') : (state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>')}
              </th>
              <th id="thBpSortNeeded" class="sortable" title="Click to sort by Needs Modules">
                Plan / Needs ${state.bpSortField === 'needed' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
              </th>
              <th>Current / Optimum Rate</th>
            </tr>
          </thead>
          <tbody>
            ${productionEntries.map(renderTableRow).join('')}
          </tbody>
        </table>
      </div>

      <div class="module-diff-box" style="margin-top:0.65rem; padding:0.45rem 0.65rem; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:0.75rem;">
        <div style="font-weight:700; color:#94a3b8; margin-bottom:0.25rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em; font-size:0.7rem; display:flex; justify-content:space-between; align-items:center;">
          <span>⚖️ Plan vs Needs Module Differences</span>
          <span style="color:#fbbf24; font-weight:700;">${diffList.length} Differences</span>
        </div>
        <div style="color:#cbd5e1; line-height:1.45;">
          ${diffList.length > 0 ? diffList.join(', ') : '<span style="color:#34d399; font-style:italic;">All active modules match Needs count!</span>'}
        </div>
      </div>

      <div class="non-contributing-box" style="margin-top:0.65rem; padding:0.45rem 0.65rem; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:6px; font-size:0.75rem;">
        <div style="font-weight:700; color:#94a3b8; margin-bottom:0.25rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:0.03em; font-size:0.7rem; display:flex; justify-content:space-between; align-items:center;">
          <span>📦 Non-Contributing Ware Modules</span>
          <span style="color:#38bdf8; font-weight:700;">Total: ${totalNonContributingCount}</span>
        </div>
        <div style="color:#cbd5e1; line-height:1.45;">
          ${nonContributingList.length > 0 ? nonContributingList.join(', ') : '<span style="color:#64748b; font-style:italic;">None</span>'}
        </div>
      </div>
    `;

    document.querySelectorAll('.bp-table-qty-input').forEach(input => {
      const handlePlanChange = (e) => {
        const wareId = e.target.dataset.ware;
        const newQty = Math.max(0, parseInt(e.target.value) || 0);

        if (!state.activeBlueprint) {
          state.activeBlueprint = {
            name: 'Custom Planned Station Blueprint',
            totalModules: 0,
            modules: {},
            rawMacros: {}
          };
        }
        if (!state.activeBlueprint.modules) state.activeBlueprint.modules = {};
        if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};

        let macroKey = Object.keys(state.activeBlueprint.rawMacros).find(m => mapMacroToWare(m) === wareId);
        if (!macroKey) {
          macroKey = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wareId);
        }

        if (macroKey) {
          if (newQty <= 0) {
            delete state.activeBlueprint.rawMacros[macroKey];
          } else {
            state.activeBlueprint.rawMacros[macroKey] = newQty;
          }
        }

        if (newQty <= 0) {
          delete state.activeBlueprint.modules[wareId];
        } else {
          state.activeBlueprint.modules[wareId] = newQty;
        }

        rebuildBlueprintFromMacros();
        saveActiveBlueprintToStorage();

        if (typeof onRender === 'function') {
          onRender();
        } else {
          calculateFactoryRequirements();
          updateInspector(id, onRender);
        }
      };

      input.addEventListener('blur', handlePlanChange);
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });
    });

    const thBpSortComp = document.getElementById('thBpSortComp');
    if (thBpSortComp) {
      thBpSortComp.addEventListener('click', () => {
        if (state.bpSortField === 'level') {
          state.bpSortAsc = !state.bpSortAsc;
        } else {
          state.bpSortField = 'level';
          state.bpSortAsc = true;
        }
        updateInspector(id, onRender);
      });
    }

    const thBpSortNeeded = document.getElementById('thBpSortNeeded');
    if (thBpSortNeeded) {
      thBpSortNeeded.addEventListener('click', () => {
        if (state.bpSortField === 'needed') {
          state.bpSortAsc = !state.bpSortAsc;
        } else {
          state.bpSortField = 'needed';
          state.bpSortAsc = false;
        }
        updateInspector(id, onRender);
      });
    }

    const handleSyncOptimum = (e) => {
      if (!e.target.checked) {
        reloadActiveBlueprint(onRender);
        if (typeof onRender !== 'function') {
          calculateFactoryRequirements();
          updateInspector(id, onRender);
        }
        return;
      }
      if (!state.activeBlueprint) return;
      if (!state.activeBlueprint.modules) state.activeBlueprint.modules = {};
      if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};

      const allWares = new Set([
        'EC',
        'TerEC',
        ...Object.keys(WARES_DB).filter(w => WARES_DB[w].level >= 1 && WARES_DB[w].level <= 3),
        ...Object.keys(liveDemand || {})
      ]);

      allWares.forEach(wId => {
        const ware = WARES_DB[wId];
        if (!ware) return;
        if (ware.level === 0 && wId !== 'EC' && wId !== 'TerEC') return;
        if (ware.level === 4) return;

        let optimum = 0;
        if (wId === 'EC' || wId === 'TerEC') {
          const isTer = wId === 'TerEC';
          optimum = isTer ? (liveLt.terSolarModulesNeeded || (liveDemand['TerEC'] ? liveDemand['TerEC'].modulesNeeded : 0)) : (liveLt.solarModulesNeeded || (liveDemand['EC'] ? liveDemand['EC'].modulesNeeded : 0));
        } else if (liveDemand[wId]) {
          optimum = liveDemand[wId].modulesNeeded || 0;
        }

        const currentPlan = (state.activeBlueprint.modules && state.activeBlueprint.modules[wId]) || 0;

        // If Plan value exceeds Needs value, do not update Plan value to Needs value (preserve higher Plan count)
        if (currentPlan > optimum) {
          return;
        }

        // Solar panels (EC and TerEC) installed in station blueprint are preserved and not overridden
        if ((wId === 'EC' || wId === 'TerEC') && currentPlan > 0) {
          return;
        }

        // Clean up all existing macros for this ware to prevent double counting
        const matchingMacros = Object.keys(state.activeBlueprint.rawMacros).filter(m => mapMacroToWare(m) === wId);
        matchingMacros.forEach(m => {
          delete state.activeBlueprint.rawMacros[m];
        });

        // Determine primary macro name
        let primaryMacro = matchingMacros[0];
        if (!primaryMacro) {
          primaryMacro = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wId);
        }
        if (!primaryMacro) {
          primaryMacro = `prod_gen_${wId.toLowerCase()}_macro`;
        }

        if (optimum > 0) {
          state.activeBlueprint.modules[wId] = optimum;
          state.activeBlueprint.rawMacros[primaryMacro] = optimum;
        } else {
          delete state.activeBlueprint.modules[wId];
        }
      });

      rebuildBlueprintFromMacros();
      saveActiveBlueprintToStorage();

      if (typeof onRender === 'function') {
        onRender();
      } else {
        calculateFactoryRequirements();
        updateInspector(id, onRender);
      }
    };

    const chkSyncOptimum = document.getElementById('chkSyncOptimum');
    if (chkSyncOptimum) chkSyncOptimum.addEventListener('change', handleSyncOptimum);

    return;
  }

  // CASE 2: No active blueprint loaded & no card selected
  if (!id || !WARES_DB[id]) {
    insTitle.innerText = 'Module Inspector';
    insSub.innerText = 'Single Target Mode';
    insBody.innerHTML = `
      <div style="padding: 0.5rem; color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">
        <p>No station blueprint is currently active.</p>
        <p style="margin-top:0.5rem;">Click on any material card in the matrix to select it as a Single Production Target, or upload a station <code>.xml</code> blueprint file.</p>
      </div>
    `;
    return;
  }

  // CASE 3: A specific card is selected (including Level 4 components)
  const ware = WARES_DB[id];
  insTitle.innerText = ware.name;
  insSub.innerText = `Level ${ware.level} • ${ware.cat}`;

  const inPlanCount = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[id]) || 0;
  const planModCount = inPlanCount > 0 ? inPlanCount : (state.calculatedDemand[id] ? state.calculatedDemand[id].modulesNeeded : 1);
  const effectiveCount = state.inspectorSingle ? 1 : Math.max(1, planModCount);

  // Compute upstream requirements strictly for the selected card and its direct/upstream recipe inputs to Level 0
  const activeDemand = {};
  const sQueue = [];

  if (ware.level === 4) {
    if (ware.recipe) {
      Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
        const reqQty = inpQty * effectiveCount;
        activeDemand[inpId] = { rateNeeded: reqQty, modulesNeeded: 0 };
        const inpW = WARES_DB[inpId];
        if (inpW && inpW.level > 0) {
          const inpEff = getWareWorkforceMultiplier(inpW, state.workforceBonus);
          activeDemand[inpId].modulesNeeded = Math.ceil(reqQty / ((inpW.baseRate || 1) * inpEff));
        }
        sQueue.push({ id: inpId, requiredRate: reqQty });
      });
    }
  } else if (ware.level > 0) {
    const targetEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
    const targetOut = effectiveCount * (ware.baseRate || 1) * targetEff;
    activeDemand[id] = { rateNeeded: targetOut, modulesNeeded: effectiveCount };

    if (ware.recipe) {
      Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
        const inpRate = effectiveCount * inpQty;
        activeDemand[inpId] = { rateNeeded: inpRate, modulesNeeded: 0 };
        const inpW = WARES_DB[inpId];
        if (inpW && inpW.level > 0) {
          const inpEff = getWareWorkforceMultiplier(inpW, state.workforceBonus);
          activeDemand[inpId].modulesNeeded = Math.ceil(inpRate / ((inpW.baseRate || 1) * inpEff));
        }
        sQueue.push({ id: inpId, requiredRate: inpRate });
      });
    }
  }

  while (sQueue.length > 0) {
    const { id: currId, requiredRate } = sQueue.shift();
    const currWare = WARES_DB[currId];
    if (currWare && currWare.recipe && currWare.level > 0) {
      const currEff = getWareWorkforceMultiplier(currWare, state.workforceBonus);
      const currModRate = (currWare.baseRate || 1) * currEff;
      Object.entries(currWare.recipe).forEach(([inpId, inpQty]) => {
        const ratePerUnit = inpQty / currModRate;
        const totalInputRateNeeded = requiredRate * ratePerUnit;

        if (!activeDemand[inpId]) {
          activeDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
        }
        activeDemand[inpId].rateNeeded += totalInputRateNeeded;

        const inputWare = WARES_DB[inpId];
        if (inputWare && inputWare.level > 0) {
          const inputEff = getWareWorkforceMultiplier(inputWare, state.workforceBonus);
          activeDemand[inpId].modulesNeeded = Math.ceil(activeDemand[inpId].rateNeeded / ((inputWare.baseRate || 1) * inputEff));
        }
        sQueue.push({ id: inpId, requiredRate: totalInputRateNeeded });
      });
    }
  }

  const rawList = [
    { name: 'Ore', rate: activeDemand['Ore'] ? activeDemand['Ore'].rateNeeded : 0 },
    { name: 'Silicon', rate: activeDemand['Silicon'] ? activeDemand['Silicon'].rateNeeded : 0 },
    { name: 'Methane', rate: activeDemand['Methane'] ? activeDemand['Methane'].rateNeeded : 0 },
    { name: 'Hydrogen', rate: activeDemand['Hydrogen'] ? activeDemand['Hydrogen'].rateNeeded : 0 },
    { name: 'Helium', rate: activeDemand['Helium'] ? activeDemand['Helium'].rateNeeded : 0 },
    { name: 'Ice', rate: activeDemand['Ice'] ? activeDemand['Ice'].rateNeeded : 0, color: '#38bdf8' },
    { name: 'Raw Scrap Fragments', rate: activeDemand['RawScrap'] ? activeDemand['RawScrap'].rateNeeded : 0, color: '#fbbf24' },
    { name: 'Protectyon (Condensate)', rate: activeDemand['Protectyon'] ? activeDemand['Protectyon'].rateNeeded : 0, color: '#f472b6' }
  ];

  const activeRawList = rawList.filter(item => item.rate > 0);
  const totalRaw = activeRawList.reduce((sum, item) => sum + item.rate, 0);
  const ecTotal = activeDemand['EC'] ? activeDemand['EC'].rateNeeded : 0;

  const upstreamEntries = Object.keys(activeDemand)
    .filter(uId => {
      const uWare = WARES_DB[uId];
      if (!uWare || uId === id || !activeDemand[uId] || activeDemand[uId].rateNeeded <= 0) return false;
      return uWare.level > 0 && uWare.level < ware.level;
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
    const uEff = getWareWorkforceMultiplier(uWare, state.workforceBonus);
    const currentRate = curInPlan * (uWare.baseRate || 1) * uEff;
    const optimumRate = uCalc.rateNeeded;

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

  // Compute Output Consumers for the selected ware (downstream (Level+1)–L3 components that require this ware in their recipe)
  const minConsumerLevel = (ware.level !== undefined ? ware.level : 0) + 1;
  const consumers = [];
  let totalBpConsumption = 0;
  let totalOptimumConsumption = 0;

  Object.entries(WARES_DB).forEach(([cId, cWare]) => {
    const isDirectRecipeInput = cWare.recipe && cWare.recipe[id] !== undefined && cWare.recipe[id] > 0;
    const isTelPartsAlternative = (id === 'TelParts') && cWare.recipe && cWare.recipe['HullParts'] !== undefined && cWare.recipe['HullParts'] > 0;
    const isTelArrayAlternative = (id === 'TelArray') && cWare.recipe && cWare.recipe['ScanArray'] !== undefined && cWare.recipe['ScanArray'] > 0;

    if (cWare.level >= minConsumerLevel && cWare.level <= 3 && (isDirectRecipeInput || isTelPartsAlternative || isTelArrayAlternative)) {
      const cEff = getWareWorkforceMultiplier(cWare, state.workforceBonus);
      const baseInputQty = isDirectRecipeInput ? cWare.recipe[id] : (isTelPartsAlternative ? cWare.recipe['HullParts'] : cWare.recipe['ScanArray']);
      const inputPerMod = baseInputQty * cEff;
      const cInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[cId]) || 0;
      const cCalc = state.calculatedDemand[cId] ? (state.calculatedDemand[cId].modulesNeeded || 0) : 0;
      const bpConsumption = cInPlan * inputPerMod;
      const optConsumption = cCalc * inputPerMod;

      totalBpConsumption += bpConsumption;
      totalOptimumConsumption += optConsumption;

      consumers.push({
        id: cId,
        ware: cWare,
        inputPerMod,
        inPlan: cInPlan,
        calcNeeded: cCalc,
        bpConsumption,
        optConsumption
      });
    }
  });

  // Sort consumers: active in blueprint first, then by level, then alphabetically
  consumers.sort((a, b) => {
    if (state.activeBlueprint) {
      if ((a.inPlan > 0) !== (b.inPlan > 0)) {
        return a.inPlan > 0 ? -1 : 1;
      }
    }
    if (a.ware.level !== b.ware.level) return a.ware.level - b.ware.level;
    return a.ware.name.localeCompare(b.ware.name);
  });

  const isGenEC = id === 'EC';
  const isTerEC = id === 'TerEC';
  const isEC = isGenEC || isTerEC;
  const lt = state.layerTotals || {};
  const ecPerMod = isTerEC ? (lt.terSolarOutputPerPanel || 3000) : (lt.solarOutputPerPanel || 10500);
  const ecNeeded = isTerEC ? (lt.terSolarModulesNeeded || 0) : (lt.solarModulesNeeded || 0);
  const currentProd = isEC 
    ? (state.activeBlueprint ? (inPlanCount * ecPerMod) : (ecNeeded * ecPerMod))
    : (inPlanCount * (ware.baseRate || 1) * getWareWorkforceMultiplier(ware, state.workforceBonus));

  const netBpBalance = currentProd - totalBpConsumption;

  const nextLvl = (ware.level !== undefined ? ware.level : 0) + 1;
  let rangeTag = '';
  if (ware.level >= 3) {
    rangeTag = '(No output consumers)';
  } else if (nextLvl === 1) {
    rangeTag = '(L1–L3)';
  } else if (nextLvl === 2) {
    rangeTag = '(L2–L3)';
  } else if (nextLvl === 3) {
    rangeTag = '(L3)';
  }

  const consumersHtml = `
    <div class="consumers-box" style="background:rgba(15,23,42,0.75); padding:0.7rem 0.8rem; border-radius:8px; border:1px solid rgba(129,140,248,0.3); border-left:4px solid #818cf8;">
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
            const hasPlan = c.inPlan > 0;
            const planColor = hasPlan ? '#38bdf8' : '#64748b';
            const rateColor = hasPlan ? '#34d399' : '#64748b';
            return `
              <div style="font-size:0.8rem; padding:0.25rem 0; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:#f8fafc;">${c.ware.name}</strong> 
                  <span style="font-size:0.68rem; color:#94a3b8;">(L${c.ware.level})</span>
                  <div style="font-size:0.68rem; color:#94a3b8;">
                    ${state.activeBlueprint 
                      ? `<span style="color:${planColor}; font-weight:600;">${c.inPlan}x in Plan</span> • ${c.inputPerMod.toLocaleString()} / hr each` 
                      : `<span style="color:#38bdf8; font-weight:600;">${c.calcNeeded > 0 ? `${c.calcNeeded}x Needs` : '0x'}</span> • ${c.inputPerMod.toLocaleString()} / hr each`}
                  </div>
                </div>
                <div style="text-align:right;">
                  <strong style="color:${rateColor}; font-size:0.82rem;">
                    ${state.activeBlueprint ? Math.round(c.bpConsumption).toLocaleString() : Math.round(c.optConsumption).toLocaleString()} / hr
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
              <span style="color:#94a3b8;">Current Production (${inPlanCount}x):</span>
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

  insBody.innerHTML = `
    <div class="recipe-box" style="margin-top:0.6rem; background:rgba(30,41,59,0.6); padding:0.65rem 0.8rem; border-radius:8px; border:1px solid rgba(56,189,248,0.25);">
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
        const hullPartsPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules['HullParts']) || 0;

        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (inpId === 'HullParts') {
            if (telPartsPlan > 0 && hullPartsPlan === 0) {
              displayedInputs.push({ id: 'TelParts', qty: inpQty, tag: '[TEL Hull Parts]' });
              return;
            } else if (telPartsPlan > 0 && hullPartsPlan > 0) {
              displayedInputs.push({ id: 'HullParts', qty: inpQty, tag: '[Commonwealth]' });
              displayedInputs.push({ id: 'TelParts', qty: inpQty, tag: '[TEL Hull Parts]' });
              return;
            } else if (linkedFromDeps.includes('TelParts')) {
              displayedInputs.push({ id: 'HullParts', qty: inpQty, tag: '' });
              displayedInputs.push({ id: 'TelParts', qty: inpQty, tag: '[TEL Option]' });
              return;
            }
          }
          displayedInputs.push({ id: inpId, qty: inpQty, tag: '' });
        });

        // Include any other linked faction inputs from DEPENDENCIES
        linkedFromDeps.forEach(depFrom => {
          if (depFrom !== 'EC' && !displayedInputs.some(d => d.id === depFrom)) {
            const depWare = WARES_DB[depFrom];
            if (depWare && depFrom === 'TelParts' && ware.recipe['HullParts']) {
              displayedInputs.push({ id: depFrom, qty: ware.recipe['HullParts'], tag: '[TEL Option]' });
            }
          }
        });

        return displayedInputs.map(({ id: inpId, qty: inpQty, tag }) => {
          const inpWare = WARES_DB[inpId];
          const wareEff = (ware.level >= 1 && ware.level <= 3) ? getWareWorkforceMultiplier(ware, state.workforceBonus) : 1;
          const scaledInpQty = inpQty * wareEff;
          const calcQty = state.inspectorSingle ? scaledInpQty : (scaledInpQty * effectiveCount);
          const unitSuffix = ware.level === 4 ? (inpId === 'EC' ? 'EC' : 'units') : '/ hr';
          return `<div style="font-size:0.82rem; color:#f8fafc; padding:0.2rem 0; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between; align-items:center;"><span>${inpWare ? inpWare.name : inpId} ${tag ? `<span style="font-size:0.68rem; color:#38bdf8; background:rgba(56,189,248,0.12); padding:1px 4px; border-radius:3px; margin-left:3px;">${tag}</span>` : ''}:</span> <strong style="color:#34d399;">${Math.round(calcQty).toLocaleString()} ${unitSuffix}</strong></div>`;
        }).join('');
      })()}
    </div>

    <div class="workforce-box" style="border-color:#38bdf8; margin-top:0.6rem;">
      <h4>⛏️ ${state.inspectorSingle ? 'Single Module' : 'Total'} Upstream Raw Mining & Liquids</h4>
      <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
      <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Demand:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
    </div>

    ${upstreamRows.length > 0 ? `
      <div style="margin-top:0.6rem;">
        <div class="section-label">${state.inspectorSingle ? 'Single Module' : 'Total'} Upstream Requirements (${upstreamRows.length} Wares)</div>
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

  const chkInspectorSingle = document.getElementById('chkInspectorSingle');
  if (chkInspectorSingle) {
    chkInspectorSingle.addEventListener('change', (e) => {
      state.inspectorSingle = e.target.checked;
      updateInspector(id);
    });
  }

  const thUpSortComp = document.getElementById('thUpSortComp');
  if (thUpSortComp) {
    thUpSortComp.addEventListener('click', () => {
      if (state.bpSortField === 'level') {
        state.bpSortAsc = !state.bpSortAsc;
      } else {
        state.bpSortField = 'level';
        state.bpSortAsc = true;
      }
      updateInspector(id);
    });
  }

  const thUpSortNeeded = document.getElementById('thUpSortNeeded');
  if (thUpSortNeeded) {
    thUpSortNeeded.addEventListener('click', () => {
      if (state.bpSortField === 'needed') {
        state.bpSortAsc = !state.bpSortAsc;
      } else {
        state.bpSortField = 'needed';
        state.bpSortAsc = false;
      }
      updateInspector(id);
    });
  }
}
