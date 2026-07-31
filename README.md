# X4: Foundations — Interactive Material Supply Chain Matrix & Station Calculator

A high-performance interactive web application built with **Vite** for visualizing and calculating material production chains and station module requirements in **X4: Foundations**.

![X4 Foundations Material Explorer](https://img.shields.gradient.is/X4-Matrix-blue)

---

## 🚀 Features

- **Interactive 5-Level Dependency Matrix:** Visualizes supply chains from **Level 0 (Raw Minerals & Solar Harvesting)** up to **Level 4 (Station Expansion & Shipbuilding)**.
- **Dynamic Station Module Calculator:** Enter your target station module count (*e.g., 4x Claytronics Modules*), and the app automatically calculates required **upstream module counts** and hourly material throughput across all tiers down to raw mining extraction (*Ore/hr, Silicon/hr, Methane/hr, Hydrogen/hr, Helium/hr, Energy Cells/hr*).
- **Lineage Path Tracking:** Hover or click any component card to illuminate all **upstream supplier inputs in pink/coral glow** and **downstream consumer uses in emerald green glow**.
- **Workforce Efficiency Bonus Slider:** Adjust workforce habitat multipliers (**0% to +50%**) to evaluate how worker efficiency reduces physical module footprints across your station builds.
- **Quick Preset Filters & Search:** Easily filter by specific station goals (*Station Construction, Ship Hulls, Armament/Turrets, Shields & Avionics*) or search any ware by name.
- **Futuristic Glassmorphic UI:** Built with custom dark mode glassmorphism, responsive SVG bezier curve connectors, and Google Fonts (*Outfit* & *Inter*).

---

## 📂 Project Structure

```
x4-vite-explorer/
├── index.html          # Main HTML entry point & Google Fonts
├── package.json        # Vite dependencies & script configurations
├── README.md           # Project documentation
└── src/
    ├── main.js         # Supply chain matrix engine & calculator logic
    └── style.css       # Glassmorphism dark mode CSS design system
```

---

## 🛠️ Quick Start

### Prerequisites
Make sure **Node.js** (v18+) and **npm** are installed on your system.

### 1. Installation
Navigate to the project directory and install dependencies:
```bash
cd C:\Users\Mark\.gemini\antigravity\scratch\x4-vite-explorer
npm install
```

### 2. Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173/`.

### 3. Production Build
To compile the static production bundle:
```bash
npm run build
```
The output will be generated in the `dist/` directory.

---

## 📊 Material Hierarchy Breakdown

| Tier Level | Category | Key Components |
| :--- | :--- | :--- |
| **Level 0** | **Raw Mining & Harvesting** | Ore, Silicon, Methane, Hydrogen, Helium, Ice, Energy Cells |
| **Level 1** | **Primary Refined Wares** | Refined Metals, Silicon Wafers, Graphene, Antimatter Cells, Superfluid Coolant, Water |
| **Level 2** | **Intermediate Components**| Hull Parts, Engine Parts, Microchips, Quantum Tubes, Plasma Conductors, Scanning Arrays |
| **Level 3** | **High-Tech Components** | Claytronics, Advanced Electronics, Field Coils, Weapon Components, Shield Components |
| **Level 4** | **End Applications** | Station Modules Expansion, Ship Hulls & Propulsion, Weapons, Shields, Drones & Ordnance |

---

## 📜 License
Created as an interactive logistics utility for *X4: Foundations* players and empire builders.
