# X4: Foundations — Interactive Supply Chain Matrix & Station Module Explorer

A high-performance interactive web application built with **Vite, HTML5, and Vanilla CSS** for analyzing material production chains, station blueprint XML files, per-module construction resource requirements, and workforce-adjusted logistics in **X4: Foundations**.

---

## 🚀 Key Features

### ⚙️ 1. Supply Chain Matrix & Dependency Visualizer
- **Interactive 5-Level Supply Chain Grid:** Visualizes production flows from **Level 0 (Raw Minerals & Solar Harvesting)** through **Level 4 (Station Expansion & Starship Fabrication)**.
- **Subdue 0x Modules Toggle:** Check `Subdue 0x` to ghost inactive production cards (`opacity: 0.3; grayscale(100%)`) and faint dashed ghost-link lines, illuminating active blueprint production paths in bright green.
- **Workforce Efficiency Bonus Slider:** Adjust workforce bonus sliders (**0% to +50%**) to evaluate how worker efficiency scales hourly throughput and reduces station module footprints.
- **Upstream Mining & Raw Harvesting Rates:** Calculates exact hourly mining extraction demand (*Ore/hr, Silicon/hr, Methane/hr, Hydrogen/hr, Helium/hr, Ice/hr, Energy Cells/hr*).

### 📋 2. Planned & Changed Station Modules Editor
- **Friendly Station Module Names:** Displays human-readable station names (*e.g., Paranid Faction Capital, Wide Area Sensor Array, Pavilion Observation Deck, Penthouse Observation Deck*) with secondary `_macro` identifier tags.
- **1x Single Unit vs. Total Build Costs:** Displays single-unit component costs (`1x Module Cost`) under *Mapped Ware / Purpose* and row total multiplied build costs (`Total for Nx modules`) under *Construction Resources Needed*.
- **Standardized Resource Sequence:** Displays resources strictly in the order: **Claytronics**, **EC (Energy Cells)**, **Hull Parts**, followed by Terran/Specialty wares.
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
├── index.html                    # Main HTML entry point & Google Fonts
├── package.json                  # Vite build script & dependency manifest
├── README.md                     # Complete project documentation
└── src/
    ├── main.js                   # Dual-tab app engine, XML parser & calculator logic
    ├── style.css                 # Glassmorphic dark mode design system
    ├── crissian_build_costs.json # 338 verified X4 module build cost recipes
    ├── macro_names.json          # 329 verified friendly module names
    └── crissian_modules_master.json # Master module database
```

---

## 🛠️ Quick Start

### Prerequisites
Make sure **Node.js** (v18+) and **npm** are installed on your system. Use whatever means you choose to clone repo. Here we use Git Bash.

### 1. Installation
Navigate to the project directory:
Default Location Behavior for cloning
  Default Start Path: 
    When you open Git Bash normally (without right-clicking a specific folder), it opens in your Windows user home directory (C:\Users\YourUsername). Running git clone <url> there places the new repo folder right inside C:\Users\YourUsername.
  Custom Path via Context Menu: 
    If you right-clicked a specific folder in Windows Explorer and selected "Git Bash Here", the repo will be placed inside that exact folder.
  Manual Navigation: 
    If you typed cd /path/to/folder before running the clone command, the repo will be created inside that targeted directory.

```bash
npm install
```

### 2. Run Local Development Server
Start the Vite dev server:
```bash
npm run dev
```
Open your browser to: **http://localhost:5173/**

### 3. Build for Production
To compile the optimized production bundle:
```bash
npm run build
```

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
| **🤖 Xenon Collective** | `_xen_` | **7** | Xenon Base Structures, XL Fabrication Bays, Solar Arrays |
| **🗡️ Split Dynasty** | `_split_` | **1** | Split Administrative Sector Claim Structure |
| **Total** | | **338** | **100% Verified X4 Database Coverage** |

---

## 📜 License
Created as an interactive logistics utility for *X4: Foundations* players and empire builders. Database build costs and recipes verified against official X4 game data.
