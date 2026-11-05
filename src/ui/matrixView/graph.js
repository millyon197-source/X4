// Ware-graph code extracted from matrixView.js (Stage 4, step 4): link drawing, highlighting,
// search filtering, selection and centering. Uses the shared `state`. `selectWareWith` takes
// `updateInspector` as a parameter so this file does not import matrixView.js (no import cycle).
import { DEPENDENCIES, FACTION_WARE_MAP, WARES_DB, isBlueprintTerran, isTerranWare } from '../../data/wares.js';
import { SCRAP_WARE_IDS } from './wareHelpers.js';
import { state } from '../../state/store.js';

export function updateScrapWarningPill(activeWareId) {
  const pill = document.getElementById('scrapWarningPill');
  if (!pill) return;
  const targetId = activeWareId !== undefined ? activeWareId : state.selectedWareId;
  const hasYellowLink = Boolean(targetId) && SCRAP_WARE_IDS.has(targetId);
  pill.style.display = hasYellowLink ? 'flex' : 'none';
}

/**
 * Aligns the "Subdue Level 4" control horizontally with:
 * - Level 4: Applications column (col-4) when L4 is displayed
 * - Level 3: High-Tech column (col-3) when L4 is subdued (not displayed)
 * Keeps it centered over the target column and aligned on the same row as WEB.
 */
export function alignSubdueLevel4() {
  if (typeof document === 'undefined' || (state && state.activeTab !== 'matrix')) return;
  const lbl = document.getElementById('lblSubdueLevel4');
  if (!lbl) return;

  const container = lbl.closest('.web-subdue-line') || lbl.parentElement;
  if (!container) return;

  const target = state.subdueLevel4
    ? (document.querySelector('.col-3') || document.querySelector('.layer-totals-banner .layer-totals-card:nth-child(4)'))
    : (document.querySelector('.col-4') || document.querySelector('.layer-totals-banner .layer-totals-card:nth-child(5)'));

  if (!target) return;

  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (targetRect.width === 0 || containerRect.width === 0) return;

  const targetCenter = targetRect.left + (targetRect.width / 2);
  const lblWidth = lbl.offsetWidth || 135;
  let offsetLeft = Math.round(targetCenter - (lblWidth / 2) - containerRect.left);

  // Safety check to ensure it doesn't overlap the slider group if space is narrow
  const sliderGroup = container.querySelector('.slider-group');
  if (sliderGroup) {
    const sgRect = sliderGroup.getBoundingClientRect();
    const minLeft = Math.round(sgRect.right - containerRect.left + 8);
    offsetLeft = Math.max(minLeft, offsetLeft);
  }

  state.subdueL4Left = offsetLeft;
  state.subdueL4MarginLeft = offsetLeft;
  lbl.style.left = `${offsetLeft}px`;
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

    const fromEl = document.getElementById(`ware-${dep.from}`);
    const toEl = document.getElementById(`ware-${dep.to}`);
    if (!fromEl || !toEl || fromEl.style.display === 'none' || toEl.style.display === 'none') return;

    const r1 = fromEl.getBoundingClientRect();
    const r2 = toEl.getBoundingClientRect();

    const x1 = r1.right - rect.left + viewport.scrollLeft;
    const y1 = r1.top + r1.height / 2 - rect.top + viewport.scrollTop;
    const x2 = r2.left - rect.left + viewport.scrollLeft;
    const y2 = r2.top + r2.height / 2 - rect.top + viewport.scrollTop;

    const fromWare = WARES_DB[dep.from];
    const isSameCol = (fromWare && toWare && fromWare.level === toWare.level) || Math.abs(r1.left - r2.left) < 35;
    let pathD = '';

    if (dep.from === 'ScrapProc' && (dep.to === 'ScrapMetal' || dep.to === 'TerScrapMetal')) {
      const branchX = (r1.left - rect.left + viewport.scrollLeft) + 8;
      const startY = r1.bottom - rect.top + viewport.scrollTop;
      const dy = y2 - startY;
      const cy1 = startY + dy * 0.55;
      const cx2 = x2 - Math.min((x2 - branchX) * 0.45, 18);
      pathD = `M ${branchX} ${startY} C ${branchX} ${cy1}, ${cx2} ${y2}, ${x2} ${y2}`;
    } else if (isSameCol) {
      const r2Right = r2.right - rect.left + viewport.scrollLeft;
      const dy = y2 - y1;
      const loopDist = Math.max(26, Math.min(48, Math.abs(dy) * 0.25));
      const cx1 = x1 + loopDist;
      const cx2 = r2Right + loopDist;
      pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${r2Right} ${y2}`;
    } else {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const absDy = Math.abs(dy);
      const handle = Math.max(20, Math.min(dx * 0.5, 75 + absDy * 0.08));
      const cx1 = x1 + handle;
      const cy1 = y1;
      const cx2 = x2 - handle;
      const cy2 = y2;
      pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }

    const fromInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[dep.from]) || 0;
    const toInPlan = (state.activeBlueprint && state.activeBlueprint.modules && state.activeBlueprint.modules[dep.to]) || 0;

    const fromCalc = state.calculatedDemand[dep.from];
    const toCalc = state.calculatedDemand[dep.to];

    const isFromActive = fromInPlan > 0 || (fromCalc && (fromCalc.rateNeeded > 0 || fromCalc.modulesNeeded > 0));
    const isToActive = toInPlan > 0 || (toCalc && (toCalc.rateNeeded > 0 || toCalc.modulesNeeded > 0));

    let isActiveLink = isFromActive && isToActive;
    const isAllographyne = (dep.from === 'RawKhaakScrap' && dep.to === 'AllographyneScrapProc') || (dep.from === 'AllographyneScrapProc' && dep.to === 'AllographyneFragments') || (dep.from === 'AllographyneFragments' && dep.to === 'Allographyne');
    if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
      const hasAlloFrag = Boolean(
        (state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneFragments'] > 0) ||
        (state.calculatedDemand && state.calculatedDemand['AllographyneFragments'] && state.calculatedDemand['AllographyneFragments'].modulesNeeded > 0)
      );
      const isAlloActiveFlow = isAllographyne && hasAlloFrag && (
        (dep.from === 'RawKhaakScrap' && dep.to === 'AllographyneScrapProc') ||
        (dep.from === 'AllographyneScrapProc' && dep.to === 'AllographyneFragments')
      );
      if (!isAlloActiveFlow) {
        isActiveLink = false;
      }
    }

    const isScrap = dep.from === 'ScrapMetal' || dep.from === 'TerScrapMetal' || dep.from === 'RawScrap' || dep.from === 'ScrapProc' || dep.from === 'RawKhaakScrap' || dep.from === 'AllographyneScrapProc';
    const isDashed = dep.dashed || false;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', `link-line ${isActiveLink ? 'active-link' : 'ghost-link'} ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${isDashed ? 'dashed-link' : ''}`.trim());
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
      const isScrap = from === 'ScrapMetal' || from === 'TerScrapMetal' || from === 'RawScrap' || from === 'ScrapProc' || from === 'RawKhaakScrap' || from === 'AllographyneScrapProc';
      const isAllographyne = (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') || (from === 'AllographyneScrapProc' && to === 'AllographyneFragments') || (from === 'AllographyneFragments' && to === 'Allographyne');
      const isDashed = line.getAttribute('data-dashed') === 'true';
      const dashedClass = isDashed ? 'dashed-link' : '';

      if (!fromGhost && !toGhost) {
        line.className.baseVal = `link-line active-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
      } else {
        line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
      }
    });
  }

  updateScrapWarningPill(state.selectedWareId);
  alignSubdueLevel4();
}

export function highlightGraph(id) {
  if (!id) {
    updateScrapWarningPill(null);
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
      const isScrap = from === 'ScrapMetal' || from === 'TerScrapMetal' || from === 'RawScrap' || from === 'ScrapProc' || from === 'RawKhaakScrap' || from === 'AllographyneScrapProc';
      const isAllographyne = (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') || (from === 'AllographyneScrapProc' && to === 'AllographyneFragments') || (from === 'AllographyneFragments' && to === 'Allographyne');

      let active = isFromActive && isToActive;
      if (state.activeBlueprint && state.subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
        const hasAlloFrag = Boolean(
          (state.activeBlueprint.modules && state.activeBlueprint.modules['AllographyneFragments'] > 0) ||
          (state.calculatedDemand && state.calculatedDemand['AllographyneFragments'] && state.calculatedDemand['AllographyneFragments'].modulesNeeded > 0)
        );
        const isAlloActiveFlow = isAllographyne && hasAlloFrag && (
          (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') ||
          (from === 'AllographyneScrapProc' && to === 'AllographyneFragments')
        );
        if (!isAlloActiveFlow) {
          active = false;
        }
      }
      l.className.baseVal = `link-line ${active ? 'active-link' : 'ghost-link'} ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${isDashed ? 'dashed-link' : ''}`.trim();
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

  const lt = state.layerTotals || {};
  const inPlanSolarCount = lt.inPlanSolarCount || 0;
  const inPlanTerSolarCount = lt.inPlanTerSolarCount || 0;
  const isTerranBp = state.activeBlueprint ? isBlueprintTerran(state.activeBlueprint) : false;

  function traverseUp(curr) {
    DEPENDENCIES.filter(d => d.to === curr).forEach(d => {
      if (d.from === 'EC') {
        if (state.activeBlueprint && inPlanTerSolarCount > 0 && inPlanSolarCount === 0) return;
        if (state.activeBlueprint && inPlanSolarCount === 0 && inPlanTerSolarCount === 0 && isTerranBp) return;
        if (!state.activeBlueprint && state.selectedWareId && isTerranWare(state.selectedWareId)) return;
      }
      if (d.from === 'TerEC') {
        if (state.activeBlueprint && inPlanSolarCount > 0 && inPlanTerSolarCount === 0) return;
        if (state.activeBlueprint && inPlanSolarCount === 0 && inPlanTerSolarCount === 0 && !isTerranBp) return;
        if (!state.activeBlueprint && (!state.selectedWareId || !isTerranWare(state.selectedWareId))) return;
      }
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
    const isScrap = from === 'ScrapMetal' || from === 'TerScrapMetal' || from === 'RawScrap' || from === 'ScrapProc' || from === 'RawKhaakScrap' || from === 'AllographyneScrapProc';
    const isAllographyne = (from === 'RawKhaakScrap' && to === 'AllographyneScrapProc') || (from === 'AllographyneScrapProc' && to === 'AllographyneFragments') || (from === 'AllographyneFragments' && to === 'Allographyne');
    const isDashed = line.getAttribute('data-dashed') === 'true';
    const dashedClass = isDashed ? 'dashed-link' : '';

    const fromInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[from] || 0) : 1;
    const toInPlan = state.activeBlueprint ? (state.activeBlueprint.modules[to] || 0) : 1;

    const isUpstreamLink = upstreamSet.has(from) && upstreamSet.has(to);
    const isDownstreamLink = !isLevel4 && downstreamSet.has(from) && downstreamSet.has(to);
    const isTracedLink = isUpstreamLink || isDownstreamLink;

    if (isTracedLink) {
      line.className.baseVal = `link-line active-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
    } else {
      line.className.baseVal = `link-line ghost-link ${isScrap ? 'scrap-link' : ''} ${isAllographyne ? 'allographyne-link' : ''} ${dashedClass}`.trim();
    }
  });

  updateScrapWarningPill(id);
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

    const catWords = wareCat ? wareCat.split(/[\s/()]+/) : [];
    const catMatches = catWords.some(w => w.startsWith(q)) || (wareCat.includes(q) && q.includes(' '));
    const contains = wareName.includes(q) || catMatches || factionName.includes(q);
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

export function getCenteredWareId() {
  if (state.selectedWareId) return state.selectedWareId;
  const viewport = document.getElementById('viewport');
  if (!viewport) return state.lastFocusedWareId || null;

  const vpRect = viewport.getBoundingClientRect();
  if (vpRect.width === 0 || vpRect.height === 0) {
    return state.selectedWareId || state.lastFocusedWareId || null;
  }

  const vpCenterX = vpRect.left + vpRect.width / 2;
  const vpCenterY = vpRect.top + vpRect.height / 2;

  const cards = document.querySelectorAll('.ware-card');
  let closestId = null;
  let minDistance = Infinity;

  cards.forEach(card => {
    if (card.offsetParent === null) return;
    const r = card.getBoundingClientRect();
    const cardCenterX = r.left + r.width / 2;
    const cardCenterY = r.top + r.height / 2;
    const dist = Math.hypot(cardCenterX - vpCenterX, cardCenterY - vpCenterY);
    if (dist < minDistance) {
      minDistance = dist;
      closestId = card.dataset.id;
    }
  });

  return closestId || state.selectedWareId || state.lastFocusedWareId || null;
}

export function centerOnWare(id, behavior = 'smooth') {
  if (!id) return;
  const cardEl = document.getElementById(`ware-${id}`);
  const viewport = document.getElementById('viewport');
  if (!cardEl || !viewport || cardEl.offsetParent === null) return;

  const cardRect = cardEl.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  if (viewportRect.width === 0 || viewportRect.height === 0) return;

  const scrollLeftTarget = viewport.scrollLeft + (cardRect.left - viewportRect.left) - (viewportRect.width / 2) + (cardRect.width / 2);
  const scrollTopTarget = viewport.scrollTop + (cardRect.top - viewportRect.top) - (viewportRect.height / 2) + (cardRect.height / 2);

  viewport.scrollTo({
    left: Math.max(0, scrollLeftTarget),
    top: Math.max(0, scrollTopTarget),
    behavior
  });
}

export function selectWareWith(updateInspectorFn, id, onRender) {
  const isReclick = Boolean(id && state.selectedWareId === id);
  const targetId = isReclick ? null : id;
  if (targetId) {
    state.lastFocusedWareId = targetId;
  }
  state.selectedWareId = targetId;

  if (!targetId) {
    document.querySelectorAll('.ware-card').forEach(card => {
      card.classList.remove('active-selected');
    });
    if (typeof onRender === 'function') {
      onRender();
    } else {
      updateInspectorFn(null, onRender);
    }
    highlightGraph(null);
    return;
  }

  const selectedWare = WARES_DB[targetId];
  const isLevel4 = selectedWare && selectedWare.level === 4;

  if (isLevel4) {
    // If "Subdue Level 4" is unchecked, do not recalculate any cards only highlight cards associated.
    document.querySelectorAll('.ware-card').forEach(card => {
      card.classList.toggle('active-selected', card.dataset.id === targetId);
    });
    highlightGraph(targetId);
    updateInspectorFn(targetId, onRender);
    if (targetId) {
      setTimeout(() => centerOnWare(targetId), 60);
    }
    return;
  }

  if (typeof onRender === 'function') onRender();
  highlightGraph(targetId);
  if (targetId) {
    setTimeout(() => centerOnWare(targetId), 60);
  }
}
