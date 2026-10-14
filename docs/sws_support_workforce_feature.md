# SWS Support Workforce Feature

## Overview
Added the **"Support Workforce"** checkbox directly into the Station Workforce Summary (SWS) header in the Blueprint Inspector (BI). When activated, it determines the prominent faction of the current station, provisions the largest available/owned habitat modules (including Antigone `_spire` habs) to achieve a positive workforce bed surplus, and inserts the necessary Food and Medical Supplies production modules with full multi-pass convergence.

---

## Key Capabilities

1. **Prominent Faction Auto-Detection**
   - Automatically determines the station's dominant race/culture from existing module macros (`_ter_`, `_bor_`, `_tel_`, `_par_`, `_spl_`, `_arg_`).
   - Syncs `state.factionConstructionMethod` so life support requirements match the station's primary workforce.

2. **Habitat Selection & `_spire` Habitats Consideration**
   - Queries owned blueprint definitions from `blueprints_catalog.json` and persistent blueprint storage.
   - Evaluates largest capacity habitat modules for the faction.
   - Explicitly supports **Antigone XL Housing Spires** (`landmarks_arg_antigonespire_01_macro` / `hab_arg_antigonespire_01_macro`, **2,000 capacity**) and Pillars, prioritizing them ahead of standard L habitats (1,000 capacity).
   - Adds the minimum number of these largest habitats needed to ensure `totalHabitationCapacity >= totalOptimalWorkforce`.

3. **Life Support Production & Multi-Pass Convergence**
   - Calculates the net hourly consumption for the detected faction's food and medicine:
     - **Commonwealth**: Food Rations + Medical Supplies
     - **Terran**: Terran MRE + TER Medical Supplies
     - **Boron**: BoFu + BOR Medical Supplies
     - **Teladi**: Nostrop Oil + TEL Medical Supplies
     - **Paranid**: Soja Husk + PAR Medical Supplies
     - **Split**: Chelt Meat / Scruffin Fruits + SPL Medical Supplies
   - Inserts production modules to eliminate life support deficits.
   - Re-evaluates worker housing iteratively until both habitation surplus and life support coverage reach $\ge 100\%$.

4. **Clean Reversibility**
   - Auto-added modules are tracked in `state.activeBlueprint._autoWfAddedMacros`.
   - Unchecking the box cleanly reverts only the auto-added modules without impacting user-planned factories.

---

## Verification & Showcase

- **Commonwealth Station (10x Hull Parts)**:
  - Detected prominent faction: **Commonwealth**.
  - Selected Habitat: **Argon XL Housing Spire** (2,000 capacity).
  - Modules added: 2x Argon XL Housing Spire, 1x Food Rations Factory, 2x ARG Medical Supplies.
  - Final workforce balance: **+1,030 surplus beds** (135% coverage).
  - Food/Med balances: **+3,558 Food Rations / hr**, **+2,987 Medical Supplies / hr**.
  - Reversion test: Fully restored original 10x Hull Parts configuration.

- **Terran Station (3x Computronic Substrate)**:
  - Detected prominent faction: **Terran**.
  - Selected Habitat: **Terran L Living Quarters** (1,000 capacity).
  - Modules added: 11x Terran L Living Quarters, 2x Terran MRE, 3x TER Medical Supplies.
  - Final workforce balance: **+460 surplus beds** (109% coverage).
  - Food/Med balances: **+1,300 MRE / hr**, **+1,638 Medical Supplies / hr**.

- **Boron Station (6x BoFu + 2x Water)**:
  - Detected prominent faction: **Boron**.
  - Selected Habitat: **Boron L Oasis** (1,000 capacity).
  - Modules added: 2x Boron L Oasis, 1x BOR Medical Supplies.
  - Final workforce balance: **+800 surplus beds** (167% coverage).
