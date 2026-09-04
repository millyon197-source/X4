import { WARES_DB, DEPENDENCIES } from '../data/wares.js';
import { state } from '../engine/state.js';

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

  return `
    <div class="main-wrapper">
      <div class="matrix-viewport" id="viewport">
        <div class="layer-totals-banner ${colClass}">
          <div class="layer-totals-card">
            <div class="layer-title">
              <span>⚡ Solar Harvesting</span>
            </div>
            <div class="layer-stat">Total EC Demand: <strong style="color:#fbbf24;">${Math.round(lt.totalECNeeded).toLocaleString()} EC/hr</strong></div>
            <div class="layer-sub">Requires <strong style="color:#34d399;">${lt.solarModulesNeeded}x</strong> Solar Panels</div>
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
                  const inPlanCount = state.activeBlueprint ? (state.activeBlueprint.modules[id] || 0) : 0;
                  const hasCalc = state.activeBlueprint ? (inPlanCount > 0) : (calc && calc.rateNeeded > 0);
                  const isGhost = state.activeBlueprint ? (inPlanCount === 0 && (!state.selectedWareId || id !== state.selectedWareId)) : false;
                  const activeCount = state.activeBlueprint ? inPlanCount : (calc ? calc.modulesNeeded : 0);

                  let prodOutputRate = 0;
                  let ecConsRate = 0;
                  let totalCompUnits = 0;
                  if (hasCalc && ware.level > 0) {
                    if (ware.level === 4) {
                      totalCompUnits = ware.recipe ? Object.entries(ware.recipe).filter(([k]) => k !== 'EC').reduce((sum, [_, v]) => sum + v * (activeCount || 1), 0) : 0;
                    } else {
                      prodOutputRate = activeCount * (ware.baseRate || 1) * effMultiplier;
                    }
                    if (ware.recipe && ware.recipe['EC']) {
                      ecConsRate = activeCount * ware.recipe['EC'];
                    }
                  }

                  return `
                    <div class="ware-card ${isGhost ? 'ghost-card' : ''} ${id === state.selectedWareId ? 'active-selected' : ''}" id="ware-${id}" data-id="${id}">
                      <div class="ware-header">
                        <div class="ware-name">${ware.name}</div>
                      </div>
                      ${hasCalc ? `
                        <div class="card-calc-info">
                          <span class="module-badge">${ware.level > 0 ? `${activeCount}x Modules` : (id === 'EC' ? `${state.activeBlueprint ? inPlanCount : lt.solarModulesNeeded}x Solar` : 'Mining/Scrap')}</span>
                          ${ware.level === 4 ? `
                            <span class="rate-badge-prod" style="background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3);" title="Total upstream required component units">${Math.round(totalCompUnits).toLocaleString()} Components</span>
                          ` : `
                            <span class="rate-badge-prod" title="Hourly production output">Output: ${Math.round(prodOutputRate).toLocaleString()}/hr</span>
                          `}
                        </div>
                        ${!state.subdueEcCalc && ecConsRate > 0 ? `
                          <div style="margin-top:0.25rem; display:flex; justify-content:flex-start;">
                            <span class="rate-badge-cons" title="Energy Cells consumed per hour">⚡ Consumes ${Math.round(ecConsRate).toLocaleString()} EC/hr</span>
                          </div>
                        ` : ''}
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
            <span id="insSub">${state.activeBlueprint ? state.activeBlueprint.name : 'Single Target Mode'}</span>
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
    if (dep.from === 'EC') return;
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

    const isFromActive = state.calculatedDemand[dep.from] && state.calculatedDemand[dep.from].rateNeeded > 0;
    const isToActive = state.calculatedDemand[dep.to] && state.calculatedDemand[dep.to].rateNeeded > 0;

    const fromInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[dep.from] || 0) : 1;
    const toInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[dep.to] || 0) : 1;

    let isActiveLink = isFromActive && isToActive;
    if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
      isActiveLink = false;
    }

    const isScrap = dep.from === 'ScrapMetal' || dep.from === 'RawScrap';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', `link-line ${isActiveLink ? 'active-link' : 'ghost-link'} ${isScrap ? 'scrap-link' : ''}`);
    path.setAttribute('data-from', dep.from);
    path.setAttribute('data-to', dep.to);
    svg.appendChild(path);
  });

  highlightGraph(state.selectedWareId);
}

export function highlightGraph(id) {
  if (!id) {
    document.querySelectorAll('.link-line').forEach(l => {
      const from = l.getAttribute('data-from');
      const to = l.getAttribute('data-to');
      const isFromActive = state.calculatedDemand[from] && state.calculatedDemand[from].rateNeeded > 0;
      const isToActive = state.calculatedDemand[to] && state.calculatedDemand[to].rateNeeded > 0;
      const fromInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[from] || 0) : 1;
      const toInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[to] || 0) : 1;

      let active = isFromActive && isToActive;
      if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
        active = false;
      }
      l.className.baseVal = `link-line ${active ? 'active-link' : 'ghost-link'}`;
    });
    document.querySelectorAll('.ware-card').forEach(c => {
      const cardId = c.dataset.id;
      const hasCalc = state.calculatedDemand[cardId] && state.calculatedDemand[cardId].rateNeeded > 0;
      const inPlan = state.activeBlueprint ? (state.activeBlueprint.modules[cardId] || 0) : 1;
      const shouldGhost = state.activeBlueprint ? (!hasCalc || (state.subdueZeroX && inPlan === 0)) : false;
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

    const fromInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[from] || 0) : 1;
    const toInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[to] || 0) : 1;

    const isUpstreamLink = upstreamSet.has(from) && upstreamSet.has(to);
    const isDownstreamLink = !isLevel4 && downstreamSet.has(from) && downstreamSet.has(to);
    const isTracedLink = isUpstreamLink || isDownstreamLink;

    if (isTracedLink) {
      if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
        line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''}`;
      } else {
        line.className.baseVal = `link-line active-link ${isScrap ? 'scrap-link' : ''}`;
      }
    } else {
      line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''}`;
    }
  });
}

export function filterWares() {
  document.querySelectorAll('.ware-card').forEach(card => {
    const id = card.dataset.id;
    const ware = WARES_DB[id];
    const matches = ware.name.toLowerCase().includes(state.searchQuery) || ware.cat.toLowerCase().includes(state.searchQuery);
    card.style.display = matches ? 'block' : 'none';
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
  if (typeof onRender === 'function') onRender();
  highlightGraph(id);
  if (id) {
    setTimeout(() => centerOnWare(id), 60);
  }
}

export function updateInspector(id) {
  const insTitle = document.getElementById('insTitle');
  const insSub = document.getElementById('insSub');
  const insBody = document.getElementById('insBody');

  if (!insTitle || !insSub || !insBody) return;

  const effMultiplier = 1 + (state.workforceBonus / 100);

  // CASE 1: Active Blueprint loaded & no specific card selected
  if (state.activeBlueprint && !id) {
    insTitle.innerText = 'Blueprint Inspector';
    insSub.innerText = state.activeBlueprint.name;

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
    const ecTotal = state.calculatedDemand['EC'] ? state.calculatedDemand['EC'].rateNeeded : 0;

    const dbOrder = Object.keys(WARES_DB);

    const sortedEntries = Object.entries(state.calculatedDemand)
      .filter(([wId, c]) => c.rateNeeded > 0 && WARES_DB[wId] && WARES_DB[wId].level > 0)
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

    insBody.innerHTML = `
      <div class="workforce-box" style="border-color:#38bdf8;">
        <h4>⛏️ Total Recalculated Raw Mining & Liquids</h4>
        ${activeRawList.length > 0 ? activeRawList.map(item => `
          <p><strong style="${item.color ? `color:${item.color};` : ''}">${item.name}:</strong> ${Math.round(item.rate).toLocaleString()} / hr</p>
        `).join('') : `
          <p style="color:#94a3b8; font-style:italic;">No raw resource mining required for active blueprint modules.</p>
        `}
        <hr style="border-color:rgba(255,255,255,0.1); margin:0.4rem 0;" />
        <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
        <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Total:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
      </div>

      <div style="margin-top:0.6rem;">
        <div class="section-label">All Plan Modules & Recalculated Upstream Chains</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th id="thBpSortComp" class="sortable" title="Click to sort by Level / Component Name">
                Component (Level) ${state.bpSortField === 'level' ? (state.bpSortAsc ? '▲' : '▼') : (state.bpSortField === 'component' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>')}
              </th>
              <th id="thBpSortNeeded" class="sortable" title="Click to sort by Needed Modules">
                Plan / Needed ${state.bpSortField === 'needed' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
              </th>
              <th>Current / Optimum Rate</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              let lastLevel = null;
              const levelMeta = {
                1: { title: 'Level 1: Refined Goods', color: 'var(--l1-color)', icon: '⚙️' },
                2: { title: 'Level 2: Intermediates', color: 'var(--l2-color)', icon: '🔩' },
                3: { title: 'Level 3: High-Tech Components', color: 'var(--l3-color)', icon: '🔬' },
                4: { title: 'Level 4: Final Applications', color: 'var(--l4-color)', icon: '🚀' }
              };

              return sortedEntries.map(([wareId, calc]) => {
                const ware = WARES_DB[wareId];
                const inPlanCount = state.activeBlueprint.modules[wareId] || 0;
                const neededCountStr = calc.modulesNeeded >= 1 ? `${calc.modulesNeeded}x` : `${calc.modulesNeeded.toFixed(1)}x`;
                const isDirectPlan = inPlanCount > 0;
                const isSubdued = state.subdueZeroX && inPlanCount === 0;

                const currentRate = inPlanCount * (ware.baseRate || 1) * effMultiplier;
                const optimumRate = calc.rateNeeded;
                const planColor = inPlanCount > 0 ? '#38bdf8' : '#64748b';
                const planNeededDisplay = `<span style="color:${planColor}; font-weight:600;">${inPlanCount}x</span> <span style="color:#94a3b8;">/</span> <strong style="color:#34d399;">${neededCountStr}</strong>`;

                let ecConsRate = 0;
                if (ware.recipe && ware.recipe['EC']) {
                  const modCount = inPlanCount > 0 ? inPlanCount : calc.modulesNeeded;
                  ecConsRate = modCount * ware.recipe['EC'];
                }

                let totalCompUnits = 0;
                if (ware.level === 4 && ware.recipe) {
                  const modCount = inPlanCount > 0 ? inPlanCount : (calc.modulesNeeded || 1);
                  totalCompUnits = Object.entries(ware.recipe).filter(([k]) => k !== 'EC').reduce((sum, [_, v]) => sum + v * modCount, 0);
                }

                let rateDisplay = '&mdash;';
                if (ware.level >= 1 && ware.level <= 3) {
                  rateDisplay = `
                    <div style="font-size:0.75rem; line-height:1.35;">
                      <div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${planColor};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>
                      <div><span style="color:#94a3b8; font-size:0.68rem;">Optimum:</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
                    </div>
                  `;
                } else if (ware.level === 4) {
                  rateDisplay = `
                    <span class="rate-badge-prod" style="background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3); font-size:0.72rem;">
                      ${Math.round(totalCompUnits).toLocaleString()} Components
                    </span>
                  `;
                }

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
                        <strong>${ware.name}</strong> <span style="color:#94a3b8; font-size:0.72rem;">(L${ware.level})</span>
                        ${isDirectPlan ? '<span style="font-size:0.65rem; color:#38bdf8; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); padding:1px 5px; border-radius:3px; margin-left:4px;">[In Plan]</span>' : ''}
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
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
    `;

    const thBpSortComp = document.getElementById('thBpSortComp');
    if (thBpSortComp) {
      thBpSortComp.addEventListener('click', () => {
        if (state.bpSortField === 'level') {
          state.bpSortAsc = !state.bpSortAsc;
        } else {
          state.bpSortField = 'level';
          state.bpSortAsc = true;
        }
        updateInspector(id);
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
        updateInspector(id);
      });
    }

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

  const inPlanCount = state.activeBlueprint ? (state.activeBlueprint.modules[id] || 0) : 0;
  const planModCount = inPlanCount > 0 ? inPlanCount : (state.calculatedDemand[id] ? state.calculatedDemand[id].modulesNeeded : (state.targetModules || 1));
  const effectiveCount = state.inspectorSingle ? 1 : Math.max(1, planModCount);

  let activeDemand = state.calculatedDemand;

  if (state.inspectorSingle) {
    activeDemand = {};
    let sQueue = [];

    if (ware.level === 4) {
      if (ware.recipe) {
        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          activeDemand[inpId] = { rateNeeded: inpQty, modulesNeeded: 0 };
          const inpW = WARES_DB[inpId];
          if (inpW && inpW.level > 0) {
            activeDemand[inpId].modulesNeeded = Math.ceil(inpQty / ((inpW.baseRate || 1) * effMultiplier));
          }
          sQueue.push({ id: inpId, requiredRate: inpQty });
        });
      }
    } else {
      const baseOut = (ware.baseRate || 1) * effMultiplier;
      activeDemand[id] = { rateNeeded: baseOut, modulesNeeded: 1 };
      sQueue.push({ id: id, requiredRate: baseOut });
    }

    while (sQueue.length > 0) {
      const { id: currId, requiredRate } = sQueue.shift();
      const currWare = WARES_DB[currId];
      if (currWare && currWare.recipe) {
        Object.entries(currWare.recipe).forEach(([inpId, inpQty]) => {
          const ratePerUnit = inpQty / ((currWare.baseRate || 1) * effMultiplier);
          const totalInputRateNeeded = requiredRate * ratePerUnit;

          if (!activeDemand[inpId]) {
            activeDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
          }
          activeDemand[inpId].rateNeeded += totalInputRateNeeded;

          const inputWare = WARES_DB[inpId];
          if (inputWare && inputWare.level > 0) {
            activeDemand[inpId].modulesNeeded = Math.ceil(activeDemand[inpId].rateNeeded / ((inputWare.baseRate || 1) * effMultiplier));
          }
          sQueue.push({ id: inpId, requiredRate: totalInputRateNeeded });
        });
      }
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
      if (state.inspectorSingle) {
        return uWare.level > 0 && uWare.level < ware.level;
      }
      return uWare.level > 0;
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
    const curInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[uId] || 0) : 0;
    const currentRate = curInPlan * uWare.baseRate * effMultiplier;
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
      ${ware.recipe ? Object.entries(ware.recipe).map(([inpId, inpQty]) => {
        const inpWare = WARES_DB[inpId];
        const calcQty = state.inspectorSingle ? inpQty : (inpQty * effectiveCount);
        const unitSuffix = ware.level === 4 ? (inpId === 'EC' ? 'EC' : 'units') : '/ hr';
        return `<div style="font-size:0.82rem; color:#f8fafc; padding:0.2rem 0; border-bottom:1px solid rgba(255,255,255,0.04); display:flex; justify-content:space-between;"><span>${inpWare ? inpWare.name : inpId}:</span> <strong style="color:#34d399;">${Math.round(calcQty).toLocaleString()} ${unitSuffix}</strong></div>`;
      }).join('') : '<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">No input materials required (Raw / Solar).</div>'}
    </div>

    <div class="workforce-box" style="border-color:#38bdf8; margin-top:0.6rem;">
      <h4>⛏️ ${state.inspectorSingle ? 'Single Module' : 'Total'} Upstream Raw Mining & Liquids</h4>
      ${activeRawList.length > 0 ? activeRawList.map(item => `
        <p><strong style="${item.color ? `color:${item.color};` : ''}">${item.name}:</strong> ${Math.round(item.rate).toLocaleString()} / hr</p>
      `).join('') : `
        <p style="color:#94a3b8; font-style:italic;">No raw resource mining required for this module.</p>
      `}
      <hr style="border-color:rgba(255,255,255,0.1); margin:0.4rem 0;" />
      <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
      <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Total:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
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
                <th id="thUpSortNeeded" class="sortable" title="Click to sort by Needed Modules">
                  ${(!state.inspectorSingle && state.activeBlueprint) ? 'Plan / Needed' : 'Modules'} ${state.bpSortField === 'needed' ? (state.bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
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
