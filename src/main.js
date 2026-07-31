import './style.css';

// X4 Wares Master Database with Base Production Rates per Module per Hour (Standard 100% Efficiency)
const WARES_DB = {
  // LEVEL 0: RAW MATERIALS
  'Ore': { name: 'Ore', level: 0, cat: 'Solid Mineral', source: 'Asteroid Fields', baseRate: 1, desc: 'Raw iron and titanium ore extracted from asteroids.' },
  'Silicon': { name: 'Silicon', level: 0, cat: 'Solid Mineral', source: 'Asteroid Fields', baseRate: 1, desc: 'Raw silicon crystals used in semiconductor production.' },
  'Methane': { name: 'Methane', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Hydrocarbon gas harvested from nebulae.' },
  'Hydrogen': { name: 'Hydrogen', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Volatile fuel gas for antimatter production.' },
  'Helium': { name: 'Helium', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Inert gas processed into superfluid coolants.' },
  'Ice': { name: 'Ice', level: 0, cat: 'Solid Mineral', source: 'Comets & Ice Belts', baseRate: 1, desc: 'Frozen water purified into drinking water and food supplies.' },
  'EC': { name: 'Energy Cells', level: 0, cat: 'Solar Harvesting', source: 'Sunlight', baseRate: 10500, desc: 'Universal energy catalyst required by all station modules.' },

  // LEVEL 1: REFINED GOODS
  'RefMet': { name: 'Refined Metals', level: 1, cat: 'Refined Industrial', baseRate: 2400, recipe: { 'Ore': 5760, 'EC': 2400 }, desc: 'Standard structural alloy used throughout Commonwealth space.' },
  'SilWaf': { name: 'Silicon Wafers', level: 1, cat: 'Refined Tech', baseRate: 720, recipe: { 'Silicon': 4320, 'EC': 1800 }, desc: 'Purified silicon plates for microchip manufacturing.' },
  'Graph': { name: 'Graphene', level: 1, cat: 'Refined Gas Product', baseRate: 1600, recipe: { 'Methane': 9600, 'EC': 1600 }, desc: 'High-strength carbon sheet used in hulls and composite armor.' },
  'AntiCell': { name: 'Antimatter Cells', level: 1, cat: 'Refined Energy', baseRate: 2400, recipe: { 'Hydrogen': 9600, 'EC': 2400 }, desc: 'Magnetic containment cells holding antimatter fuel.' },
  'SupCool': { name: 'Superfluid Coolant', level: 1, cat: 'Refined Liquid', baseRate: 1600, recipe: { 'Helium': 9600, 'EC': 1600 }, desc: 'Cryogenic fluid used in high-power weapon systems.' },
  'Water': { name: 'Water', level: 1, cat: 'Refined Essential', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'Purified water for station workforce habitats.' },

  // LEVEL 2: INTERMEDIATES
  'HullParts': { name: 'Hull Parts', level: 2, cat: 'Structural Component', baseRate: 660, recipe: { 'RefMet': 560, 'Graph': 160, 'EC': 320 }, desc: 'Interlocking armored hull plates essential for ship and station builds.' },
  'EngParts': { name: 'Engine Parts', level: 2, cat: 'Propulsion Component', baseRate: 450, recipe: { 'RefMet': 360, 'AntiCell': 180, 'EC': 180 }, desc: 'Precision thruster assemblies and drive turbines.' },
  'Microchips': { name: 'Microchips', level: 2, cat: 'Electronics', baseRate: 240, recipe: { 'SilWaf': 960, 'EC': 600 }, desc: 'Integrated circuits powering advanced avionics and claytronics.' },
  'QuanTubes': { name: 'Quantum Tubes', level: 2, cat: 'High-Tech Conduit', baseRate: 200, recipe: { 'Graph': 320, 'SupCool': 320, 'EC': 200 }, desc: 'Superconducting conduit tubes for field matrices.' },
  'PlasmaCond': { name: 'Plasma Conductors', level: 2, cat: 'Energy Conduit', baseRate: 100, recipe: { 'Graph': 160, 'SupCool': 160, 'EC': 320 }, desc: 'Heavy-duty energy lines for plasma weaponry and shields.' },
  'ScanArray': { name: 'Scanning Arrays', level: 2, cat: 'Sensory Gear', baseRate: 120, recipe: { 'SilWaf': 120, 'RefMet': 120, 'EC': 300 }, desc: 'Sensor arrays for long-range radar and targeting systems.' },
  'AdvComp': { name: 'Advanced Composites', level: 2, cat: 'Composite Plating', baseRate: 200, recipe: { 'RefMet': 160, 'Graph': 160, 'EC': 320 }, desc: 'Lightweight high-durability alloy for missile frames.' },

  // LEVEL 3: HIGH-TECH COMPONENTS
  'Claytronics': { name: 'Claytronics', level: 3, cat: 'Nanotech Assemblies', baseRate: 160, recipe: { 'Microchips': 256, 'QuanTubes': 256, 'AntiCell': 256, 'EC': 640 }, desc: 'Programmable nanites required to build all station modules.' },
  'AdvElec': { name: 'Advanced Electronics', level: 3, cat: 'Computers & Avionics', baseRate: 120, recipe: { 'Microchips': 240, 'QuanTubes': 240, 'EC': 360 }, desc: 'Command computers and mainframes for capital ships.' },
  'FieldCoils': { name: 'Field Coils', level: 3, cat: 'Magnetic Systems', baseRate: 300, recipe: { 'PlasmaCond': 240, 'QuanTubes': 240, 'EC': 300 }, desc: 'Magnetic field generators for shields and heavy weaponry.' },
  'ShieldComp': { name: 'Shield Components', level: 3, cat: 'Defense Tech', baseRate: 360, recipe: { 'PlasmaCond': 240, 'QuanTubes': 240, 'EC': 360 }, desc: 'Emitters and capacitors forming starship shields.' },
  'WeapComp': { name: 'Weapon Components', level: 3, cat: 'Military Systems', baseRate: 200, recipe: { 'PlasmaCond': 200, 'HullParts': 200, 'EC': 300 }, desc: 'Barrels, heat sinks, and focus lenses for ship weaponry.' },
  'TurrComp': { name: 'Turret Components', level: 3, cat: 'Military Systems', baseRate: 200, recipe: { 'Microchips': 100, 'QuanTubes': 100, 'HullParts': 100, 'EC': 200 }, desc: 'Rotational gimbal mounts and tracking motors for defensive turrets.' },
  'MissComp': { name: 'Missile Components', level: 3, cat: 'Munitions', baseRate: 600, recipe: { 'AdvComp': 200, 'HullParts': 200, 'EC': 300 }, desc: 'Guidance fins and warheads for ordnance.' },
  'SmartChips': { name: 'Smart Chips', level: 3, cat: 'Autonomous Circuits', baseRate: 1600, recipe: { 'SilWaf': 240, 'EC': 600 }, desc: 'Low-cost guidance microcontrollers for drones and torpedoes.' },
  'AntiConv': { name: 'Antimatter Converters', level: 3, cat: 'Power Converters', baseRate: 300, recipe: { 'Microchips': 180, 'AntiCell': 180, 'EC': 300 }, desc: 'Power step-down transformers for high-yield engines.' },

  // LEVEL 4: FINAL APPLICATIONS
  'StationConst': { name: 'Station Modules Expansion', level: 4, cat: 'Build Storage', baseRate: 1, recipe: { 'Claytronics': 100, 'HullParts': 250, 'EC': 500 }, desc: 'Station construction requirements.' },
  'ShipChassis': { name: 'Ship Hulls & Propulsion', level: 4, cat: 'Wharf / Shipyard', baseRate: 1, recipe: { 'HullParts': 300, 'EngParts': 100 }, desc: 'Shipyard manufacturing.' },
  'ShipWeapons': { name: 'Ship Guns & Turrets', level: 4, cat: 'Equipment Dock', baseRate: 1, recipe: { 'WeapComp': 50, 'TurrComp': 50, 'FieldCoils': 25 }, desc: 'Weapon outfitting.' },
  'ShipShields': { name: 'Shields & Avionics', level: 4, cat: 'Equipment Dock', baseRate: 1, recipe: { 'ShieldComp': 40, 'AdvElec': 20, 'AntiConv': 15 }, desc: 'Shield & computer outfitting.' },
  'FleetConsumables': { name: 'Drones & Ordnance', level: 4, cat: 'Consumables', baseRate: 1, recipe: { 'SmartChips': 20, 'MissComp': 40, 'ScanArray': 10 }, desc: 'Munitions & drone outfitting.' }
};

const DEPENDENCIES = [
  // L0 -> L1
  { from: 'Ore', to: 'RefMet' },
  { from: 'EC', to: 'RefMet' },
  { from: 'Silicon', to: 'SilWaf' },
  { from: 'EC', to: 'SilWaf' },
  { from: 'Methane', to: 'Graph' },
  { from: 'EC', to: 'Graph' },
  { from: 'Hydrogen', to: 'AntiCell' },
  { from: 'EC', to: 'AntiCell' },
  { from: 'Helium', to: 'SupCool' },
  { from: 'EC', to: 'SupCool' },
  { from: 'Ice', to: 'Water' },
  { from: 'EC', to: 'Water' },

  // L1 -> L2
  { from: 'RefMet', to: 'HullParts' },
  { from: 'Graph', to: 'HullParts' },
  { from: 'EC', to: 'HullParts' },
  { from: 'RefMet', to: 'EngParts' },
  { from: 'AntiCell', to: 'EngParts' },
  { from: 'EC', to: 'EngParts' },
  { from: 'SilWaf', to: 'Microchips' },
  { from: 'EC', to: 'Microchips' },
  { from: 'Graph', to: 'QuanTubes' },
  { from: 'SupCool', to: 'QuanTubes' },
  { from: 'EC', to: 'QuanTubes' },
  { from: 'Graph', to: 'PlasmaCond' },
  { from: 'SupCool', to: 'PlasmaCond' },
  { from: 'EC', to: 'PlasmaCond' },
  { from: 'SilWaf', to: 'ScanArray' },
  { from: 'RefMet', to: 'ScanArray' },
  { from: 'EC', to: 'ScanArray' },
  { from: 'RefMet', to: 'AdvComp' },
  { from: 'Graph', to: 'AdvComp' },
  { from: 'EC', to: 'AdvComp' },

  // L2 -> L3
  { from: 'Microchips', to: 'Claytronics' },
  { from: 'QuanTubes', to: 'Claytronics' },
  { from: 'AntiCell', to: 'Claytronics' },
  { from: 'EC', to: 'Claytronics' },
  { from: 'Microchips', to: 'AdvElec' },
  { from: 'QuanTubes', to: 'AdvElec' },
  { from: 'EC', to: 'AdvElec' },
  { from: 'PlasmaCond', to: 'FieldCoils' },
  { from: 'QuanTubes', to: 'FieldCoils' },
  { from: 'EC', to: 'FieldCoils' },
  { from: 'PlasmaCond', to: 'ShieldComp' },
  { from: 'QuanTubes', to: 'ShieldComp' },
  { from: 'EC', to: 'ShieldComp' },
  { from: 'PlasmaCond', to: 'WeapComp' },
  { from: 'HullParts', to: 'WeapComp' },
  { from: 'EC', to: 'WeapComp' },
  { from: 'Microchips', to: 'TurrComp' },
  { from: 'QuanTubes', to: 'TurrComp' },
  { from: 'HullParts', to: 'TurrComp' },
  { from: 'EC', to: 'TurrComp' },
  { from: 'AdvComp', to: 'MissComp' },
  { from: 'HullParts', to: 'MissComp' },
  { from: 'EC', to: 'MissComp' },
  { from: 'SilWaf', to: 'SmartChips' },
  { from: 'EC', to: 'SmartChips' },
  { from: 'Microchips', to: 'AntiConv' },
  { from: 'AntiCell', to: 'AntiConv' },
  { from: 'EC', to: 'AntiConv' },

  // L3 -> L4
  { from: 'Claytronics', to: 'StationConst' },
  { from: 'HullParts', to: 'StationConst' },
  { from: 'HullParts', to: 'ShipChassis' },
  { from: 'EngParts', to: 'ShipChassis' },
  { from: 'WeapComp', to: 'ShipWeapons' },
  { from: 'TurrComp', to: 'ShipWeapons' },
  { from: 'FieldCoils', to: 'ShipWeapons' },
  { from: 'ShieldComp', to: 'ShipShields' },
  { from: 'AdvElec', to: 'ShipShields' },
  { from: 'AntiConv', to: 'ShipShields' },
  { from: 'MissComp', to: 'FleetConsumables' },
  { from: 'SmartChips', to: 'FleetConsumables' },
  { from: 'ScanArray', to: 'FleetConsumables' }
];

// App State
let selectedWareId = 'Claytronics';
let currentPreset = 'all';
let searchQuery = '';
let targetModules = 2; // Default 2 modules for target ware
let workforceBonus = 0; // 0% to 50%

// Calculated Production & Module Map
let calculatedDemand = {}; // wareId -> { rateNeeded, modulesNeeded }

function calculateFactoryRequirements() {
  calculatedDemand = {};
  if (!selectedWareId || !WARES_DB[selectedWareId]) return;

  const effMultiplier = 1 + (workforceBonus / 100);

  // Initialize target ware
  const targetWare = WARES_DB[selectedWareId];
  const targetOutputRate = targetModules * (targetWare.baseRate * effMultiplier);
  
  calculatedDemand[selectedWareId] = {
    rateNeeded: targetOutputRate,
    modulesNeeded: targetModules
  };

  // Traversal queue to propagate upstream input demands
  let queue = [{ id: selectedWareId, requiredRate: targetOutputRate }];

  while (queue.length > 0) {
    const { id, requiredRate } = queue.shift();
    const ware = WARES_DB[id];

    if (ware && ware.recipe) {
      Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
        // Calculate input rate required per hour
        // baseRate produces recipe inputQty per hour at 100%
        const ratePerUnit = inputQty / (ware.baseRate * effMultiplier);
        const totalInputRateNeeded = requiredRate * ratePerUnit;

        if (!calculatedDemand[inputId]) {
          calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
        }

        calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

        const inputWare = WARES_DB[inputId];
        if (inputWare && inputWare.level > 0) {
          const modRate = inputWare.baseRate * effMultiplier;
          calculatedDemand[inputId].modulesNeeded = Math.ceil((calculatedDemand[inputId].rateNeeded / modRate) * 100) / 100;
        }

        queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
      });
    }
  }
}

function renderApp() {
  calculateFactoryRequirements();

  const app = document.getElementById('app');
  app.innerHTML = `
    <header>
      <div class="brand">
        <div class="brand-icon">X4</div>
        <div class="brand-title">
          <h1>Material Supply Chain Matrix</h1>
          <p>Level 0 to Level 4 Station Component Calculator</p>
        </div>
      </div>

      <div class="controls">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="search-input" id="searchInput" placeholder="Search ware..." value="${searchQuery}" />
        </div>

        <button class="btn-filter ${currentPreset === 'all' ? 'active' : ''}" data-preset="all">All Wares</button>
        <button class="btn-filter ${currentPreset === 'station' ? 'active' : ''}" data-preset="station">Station Build</button>
        <button class="btn-filter ${currentPreset === 'ships' ? 'active' : ''}" data-preset="ships">Ship Hulls</button>
        <button class="btn-filter ${currentPreset === 'weapons' ? 'active' : ''}" data-preset="weapons">Weapons</button>
        <button class="btn-filter ${currentPreset === 'shields' ? 'active' : ''}" data-preset="shields">Shields</button>
      </div>
    </header>

    <div class="calc-bar">
      <div class="calc-group">
        <span>Active Station Module Target:</span>
        <strong style="color:#38bdf8;">${WARES_DB[selectedWareId] ? WARES_DB[selectedWareId].name : 'None'}</strong>
      </div>
      <div class="calc-group">
        <label for="moduleInput">Modules Count:</label>
        <input type="number" id="moduleInput" class="calc-input" min="1" max="100" value="${targetModules}" />
      </div>
      <div class="slider-group">
        <label for="workforceSlider">Workforce Efficiency Bonus:</label>
        <input type="range" id="workforceSlider" min="0" max="50" step="5" value="${workforceBonus}" />
        <span style="font-weight:700; color:#34d399;">+${workforceBonus}%</span>
      </div>
    </div>

    <div class="main-wrapper">
      <div class="matrix-viewport" id="viewport">
        <svg class="svg-overlay" id="svgCanvas"></svg>

        <div class="matrix-grid" id="matrixGrid">
          ${[0, 1, 2, 3, 4].map(level => {
            const levelWares = Object.keys(WARES_DB).filter(id => WARES_DB[id].level === level);
            const titles = ['Level 0: Raw Materials', 'Level 1: Refined Wares', 'Level 2: Intermediates', 'Level 3: High-Tech', 'Level 4: End Applications'];
            return `
              <div class="matrix-col col-${level}" data-level="${level}">
                <div class="col-badge">
                  <span>${titles[level]}</span>
                  <span class="count-tag">${levelWares.length}</span>
                </div>
                ${levelWares.map(id => {
                  const ware = WARES_DB[id];
                  const calc = calculatedDemand[id];
                  const hasCalc = calc && calc.rateNeeded > 0;
                  return `
                    <div class="ware-card ${id === selectedWareId ? 'active-selected' : ''}" id="ware-${id}" data-id="${id}">
                      <div class="ware-header">
                        <div class="ware-name">${ware.name}</div>
                      </div>
                      <div class="ware-cat">${ware.cat}</div>
                      ${hasCalc ? `
                        <div class="card-calc-info">
                          <span class="module-badge">${ware.level > 0 ? `${calc.modulesNeeded.toFixed(1)}x Modules` : 'Mining / Solar'}</span>
                          <span class="rate-badge">${Math.round(calc.rateNeeded).toLocaleString()}/hr</span>
                        </div>
                      ` : ''}
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
            <h2 id="insTitle">${WARES_DB[selectedWareId].name}</h2>
            <span id="insSub">Level ${WARES_DB[selectedWareId].level} • ${WARES_DB[selectedWareId].cat}</span>
          </div>
          <button class="btn-close" id="btnCloseIns">&times;</button>
        </div>
        <div class="inspector-body" id="insBody"></div>
      </aside>
    </div>

    <footer>
      <div class="legend-group">
        <div><span class="legend-dot" style="background: var(--line-upstream)"></span> Upstream Inputs</div>
        <div><span class="legend-dot" style="background: var(--line-downstream)"></span> Downstream Uses</div>
      </div>
      <div>Calculated automatically for X4 Factory Planning</div>
    </footer>
  `;

  setupEvents();
  updateInspector(selectedWareId);
  setTimeout(drawLines, 50);
}

function setupEvents() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      filterWares();
    });
  }

  const moduleInput = document.getElementById('moduleInput');
  if (moduleInput) {
    moduleInput.addEventListener('change', (e) => {
      targetModules = Math.max(1, parseInt(e.target.value) || 1);
      renderApp();
    });
  }

  const workforceSlider = document.getElementById('workforceSlider');
  if (workforceSlider) {
    workforceSlider.addEventListener('input', (e) => {
      workforceBonus = parseInt(e.target.value) || 0;
      renderApp();
    });
  }

  document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentPreset = e.target.dataset.preset;
      if (currentPreset === 'station') selectWare('Claytronics');
      else if (currentPreset === 'ships') selectWare('HullParts');
      else if (currentPreset === 'weapons') selectWare('WeapComp');
      else if (currentPreset === 'shields') selectWare('ShieldComp');
      else selectWare('Claytronics');
    });
  });

  document.querySelectorAll('.ware-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      highlightGraph(card.dataset.id);
    });
    card.addEventListener('mouseleave', () => {
      highlightGraph(selectedWareId);
    });
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      selectWare(card.dataset.id);
    });
  });

  document.getElementById('btnCloseIns').addEventListener('click', () => {
    selectWare(null);
  });

  window.addEventListener('resize', drawLines);
}

function selectWare(id) {
  selectedWareId = id;
  renderApp();
  highlightGraph(id);
}

function filterWares() {
  document.querySelectorAll('.ware-card').forEach(card => {
    const id = card.dataset.id;
    const ware = WARES_DB[id];
    const matches = ware.name.toLowerCase().includes(searchQuery) || ware.cat.toLowerCase().includes(searchQuery);
    card.style.display = matches ? 'block' : 'none';
  });
  drawLines();
}

function drawLines() {
  const svg = document.getElementById('svgCanvas');
  const viewport = document.getElementById('viewport');
  if (!svg || !viewport) return;

  const rect = viewport.getBoundingClientRect();
  svg.setAttribute('width', viewport.scrollWidth);
  svg.setAttribute('height', viewport.scrollHeight);
  svg.innerHTML = '';

  DEPENDENCIES.forEach(dep => {
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

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', 'link-line');
    path.setAttribute('data-from', dep.from);
    path.setAttribute('data-to', dep.to);
    svg.appendChild(path);
  });

  if (selectedWareId) highlightGraph(selectedWareId);
}

function highlightGraph(id) {
  if (!id) {
    document.querySelectorAll('.link-line').forEach(l => l.className.baseVal = 'link-line');
    document.querySelectorAll('.ware-card').forEach(c => c.classList.remove('dimmed'));
    return;
  }

  const upstream = new Set([id]);
  const downstream = new Set([id]);

  function traverseUp(curr) {
    DEPENDENCIES.filter(d => d.to === curr).forEach(d => {
      upstream.add(d.from);
      traverseUp(d.from);
    });
  }

  function traverseDown(curr) {
    DEPENDENCIES.filter(d => d.from === curr).forEach(d => {
      downstream.add(d.to);
      traverseDown(d.to);
    });
  }

  traverseUp(id);
  traverseDown(id);

  document.querySelectorAll('.ware-card').forEach(card => {
    const cardId = card.dataset.id;
    const isRelated = upstream.has(cardId) || downstream.has(cardId);
    card.classList.toggle('dimmed', !isRelated);
  });

  document.querySelectorAll('.link-line').forEach(line => {
    const from = line.getAttribute('data-from');
    const to = line.getAttribute('data-to');

    if (upstream.has(to) && upstream.has(from)) {
      line.className.baseVal = 'link-line upstream';
    } else if (downstream.has(from) && downstream.has(to)) {
      line.className.baseVal = 'link-line downstream';
    } else {
      line.className.baseVal = 'link-line dimmed';
    }
  });
}

function updateInspector(id) {
  const insTitle = document.getElementById('insTitle');
  const insSub = document.getElementById('insSub');
  const insBody = document.getElementById('insBody');

  if (!id || !WARES_DB[id]) return;

  const ware = WARES_DB[id];
  insTitle.innerText = ware.name;
  insSub.innerText = `Level ${ware.level} • ${ware.cat}`;

  const calc = calculatedDemand[id];
  const hasCalc = calc && calc.rateNeeded > 0;

  // Upstream required modules list
  let upstreamRows = [];
  Object.keys(calculatedDemand).forEach(uId => {
    const uWare = WARES_DB[uId];
    if (uWare && uWare.level < ware.level) {
      const uCalc = calculatedDemand[uId];
      upstreamRows.push(`
        <tr>
          <td><strong>${uWare.name}</strong> (L${uWare.level})</td>
          <td class="highlight-val">${uWare.level > 0 ? `${uCalc.modulesNeeded.toFixed(1)}x` : 'Miner/Solar'}</td>
          <td>${Math.round(uCalc.rateNeeded).toLocaleString()}/hr</td>
        </tr>
      `);
    }
  });

  insBody.innerHTML = `
    <p style="font-size:0.85rem; color: #cbd5e1; line-height:1.5;">${ware.desc}</p>

    <div class="module-input-box">
      <div class="module-input-row">
        <label>Selected Target Modules:</label>
        <span class="highlight-val" style="font-size:1.1rem;">${targetModules}x Modules</span>
      </div>
      <div class="module-input-row">
        <label>Output Production Rate:</label>
        <span class="rate-badge" style="font-size:1rem;">${hasCalc ? Math.round(calc.rateNeeded).toLocaleString() : 0} / hr</span>
      </div>
    </div>

    ${upstreamRows.length > 0 ? `
      <div>
        <div class="section-label">Upstream Module Requirements (${upstreamRows.length} Wares)</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Modules</th>
              <th>Required Rate</th>
            </tr>
          </thead>
          <tbody>
            ${upstreamRows.join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <div class="workforce-box">
      <h4>⚡ Efficiency Modifier (+${workforceBonus}%)</h4>
      <p>Operating with +${workforceBonus}% workforce bonus increases production output across all modules, reducing the physical module counts required for upstream inputs.</p>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', renderApp);
