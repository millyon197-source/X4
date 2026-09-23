# X4: Foundations — Interactive Supply Chain Matrix & Station Module Explorer

A high-performance interactive web application built with **Vite, HTML5, and Vanilla CSS** for analyzing material production chains, station blueprint XML files, per-module construction resource requirements, and workforce-adjusted logistics in **X4: Foundations**.

I would like to acknowledge the prior efforts of previous authors that inspired this effort: Crissian, suurflieg, www.qsna.eu and www.x4-game.com along with all the sites and Reddit conversations providing insights. Any omissions of various points of contribution are entirely my own.
---

## 🚀 Key Features

### ⚙️ 1. Supply Matrix & Dependency Visualizer
- **Interactive 5-Level Supply Chain Grid:** Visualizes production flows from **Level 0 (Raw Minerals & Solar Harvesting)** through **Level 4 (Station Expansion & Starship Fabrication)**.
- **Workforce Efficiency Bonus Slider:** Adjust workforce bonus sliders (**0% to +100%**) to evaluate how worker efficiency scales hourly throughput and reduces station module footprints.
- **Upstream Mining & Raw Harvesting Rates:** Calculates exact hourly mining extraction demand (*Ore/hr, Silicon/hr, Methane/hr, Hydrogen/hr, Helium/hr, Ice/hr, Energy Cells/hr*).

### 📋 2. Planned Modules Editor
- **Friendly Station Module Names:** Displays human-readable station names (*e.g., Paranid Faction Capital, Wide Area Sensor Array, Pavilion Observation Deck, Penthouse Observation Deck*) with secondary `_macro` identifier tags.
- **1x Single Unit vs. Total Build Costs:** Displays single-unit component costs (`1x Module Cost`) under *Mapped Ware / Purpose* and row total multiplied build costs (`Total for Nx modules`) under *Construction Resources Needed*.
- **Standardized Resource Sequence:** Displays resources strictly in an order:  **Hull Parts**, **Engine **Parts**, **Advanced Composites, ... **EC (Energy Cells)**, with any faction wares as included.
- **Faction Construction Method Selector:** Dynamically switch construction methods:
  - 🏛️ **Commonwealth Method:** Claytronics, Hull Parts, Energy Cells.
  - 🪐 **Terran Protectorate Method:** Computronic Substrate, Silicon Carbide, Metallic Microlattice.
  - 🌊 **Boron Kingdom Method:** Water, Claytronics, Hull Parts, Energy Cells.
- **🌾 Exclude Food & Agri Modules Checkbox:** Toggle to hide agricultural and food supply modules (*Soja Husk, Soja Beans, Maja Snails, Nostrop Oil, Food Rations, Medical Supplies, Terran MRE*) from the table and dropdown selector.
- **Alphabetical Click-to-Sort:** Click the **`Station Module Name ▲/▼`** column header to toggle ascending/descending sorting.
- **Grand Total Construction Summary Panel:** Summarizes total **Claytronics**, **Energy Cells (EC)**, **Hull Parts**, **Computronic Substrate**, **Silicon Carbide**, **Metallic Microlattice**, **Protectyon**, and **Water** across the entire station plan.

### 📄 3. Pure Data-Driven XML Blueprint Parser
- **Universal XML File Analysis:** Upload any station blueprint `.xml` file (*e.g., Ormac Paranid HQ.xml, Teladi HQ.xml, TER Shipyard.xml, MegaStation.xml*). The parser reads every `<entry macro="...">` node and updates both main tabs dynamically.
- **Persistent Local State:** Loaded plans and changes persist across tab navigation and browser reloads via `localStorage`.

---

## 📂 Project Structure

```
x4-vite-explorer/
├── index.html                    # Main HTML5 entry point & Google Fonts
├── package.json                  # Vite build scripts & dependency manifest
├── package-lock.json             # Locked dependency tree
├── vite.config.js                # Vite build and development configuration
├── README.md                     # Complete project documentation & guide
├── Installation.md               # Environment setup & installation guide
├── setup_x4_vite_explorer.ps1    # Automated PowerShell environment configuration script
├── public/                       # Static public assets (favicons, SVG sprites)
│   ├── favicon.svg               # Application browser tab icon
│   └── icons.svg                 # SVG icon sprite sheet
└── src/
    ├── main.js                   # Application lifecycle entry point & tab routing
    ├── style.css                 # Glassmorphic dark mode styling & layout
    ├── html.js                   # HTML string escaping utility
    ├── crissian_build_costs.json # 343 verified module construction resource recipes
    ├── crissian_modules_master.json # Master module catalog and dimensions (247 modules)
    ├── macro_costs.json          # Macro construction resource cost database
    ├── macro_names.json          # 334 human-readable friendly module names
    ├── assets/                   # Static UI images & vector icons
    │   ├── hero.png              # Header banner asset
    │   ├── javascript.svg        # JS logo
    │   └── vite.svg              # Vite logo
    ├── data/                     # Game constants, ware databases, presets & sector sunlight
    │   ├── wares.js              # 5-Level WARES_DB, DEPENDENCIES & MACRO_TO_WARE mappings
    │   ├── sectors.js            # Sector sunlight percentages & solar formula calculators
    │   ├── sunlight.json         # Verified X4 sector sunlight database
    │   ├── modules_workforce.json# Station module workforce requirements & capacities
    │   └── preset_prod_max.json  # Production Maximum complex preset blueprint definition
    ├── engine/                   # Core math, XML parsing & reactive state
    │   ├── calculator.js         # Downstream demand cascades, mining requirements & layer totals
    │   ├── state.js              # Centralized reactive application state management & persistence
    │   └── xmlParser.js          # Universal X4 station blueprint XML parser
    └── ui/                       # Dynamic modular UI renderers
        ├── matrixView.js         # Interactive 5-Level Supply Chain Matrix & Blueprint Inspector
        └── plannedView.js        # Station Module Planner, build cost breakdowns & filters
```

---

## 🛠️ Quick Start

### Prerequisites
Make sure **Node.js** (v18+) and **npm** are installed on your system.

### 1. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/wfbrown53-source/x4-vite-explorer.git
cd x4-vite-explorer
npm install
```

### 2. Build for Production
Compile the optimized production bundle to the `dist/` directory:
```bash
npm run build
```

### 3. Run Local Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open your browser to: **http://localhost:5173/**

---

## 📊 Database & Faction Coverage

| Faction / Alignment | Prefix | Total Modules | Key Faction Focus |
| :--- | :--- | :---: | :--- |
| **🌊 Boron Kingdom** | `_bor_` | **74** | Organic Domes, Water-based Factories, Ion & Water Storage |
| **🪐 Terran Protectorate** | `_ter_` | **73** | Computronic & Metallic Factories, Terran Domes, Spire Bases |
| **🏛️ Argon Federation** | `_arg_` | **43** | High-Tech Docking Areas, 3-Dock Piers, Argon Base/Cross Connections |
| **⚙️ Generic / Universal** | `_gen_` | **38** | Standard Manufacturing, Universal Shipyard/Wharf Bays |
| **🦎 Teladi Company** | `_tel_` | **35** | Teladi Base Connections, Trade Stations, Nostrop Oil Farms |
| **👁️ Paranid Empire** | `_par_` | **33** | Paranid Y-Connections, Faction Capital, Harbor Piers |
| **⚡ Special / Neutral** | Various | **34** | Scrap Recycling, Protectyon Condensate Collectors, Gambling Halls |
| **🗡️ Split Dynasty** | `_split_` | **1** | Split Administrative Sector Claim Structure |
| **Total** | | **331** | **100% Verified X4 Database Coverage** |

---

## 📜 License
Created as an interactive logistics utility for *X4: Foundations* players and empire builders. Database build costs and recipes verified against official X4 game data.
