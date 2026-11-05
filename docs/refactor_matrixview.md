# Refactor plan: split `src/ui/matrixView.js`

Follows the staged framework (small, reversible, verified steps). Stages 0-1 are done; this doc is the output of Stage 1.

## Stage 0 - Goal and boundaries
- **Done looks like:** `matrixView.js` becomes a thin facade (`src/ui/matrixView/index.js`) over focused modules, with **no behavior change and no change to what `main.js` imports**.
- **In scope:** moving and extracting code, mechanical renames. **Out of scope:** behavior changes, dependency upgrades, CSS changes, bug fixes (log them, fix separately).
- **Metrics:** no file over ~800 lines; `updateInspector` split into section renderers; no import cycles; `vite build` output unchanged in function.
- **Baseline:** there is **no automated test suite** (`package.json` has no test script, no Jest/Vitest). `scratch/` holds ad-hoc scripts and none import `matrixView`. So Stage 2 (safety net) is mandatory before any code moves.

## Stage 1 - Map of the module (3,720 lines, 214 KB)
**Public surface:** 31 exports. `main.js` is the only importer and uses 11:
`renderMatrixTabHTML, drawLines, highlightGraph, filterWares, selectWare, updateInspector, centerOnWare, getCenteredWareId, showNoBlueprintPopup, alignSubdueLevel4, updateModuleCountFromDiff`.
The other 20 exports (e.g. `getBuildNeedsModules`, `bindCrbListeners`, `formatWareName`) are used only inside the file and can become internal.

**Size hot spot:** `updateInspector` runs lines 1855-3574 (~1,720 lines, 46% of the file). It is the main target.

**Rough responsibility clusters (candidate modules):**
| Cluster | Approx. lines | Notes |
|---|---|---|
| Ware graph: `drawLines`, `highlightGraph`, `filterWares`, centering/selection | 703-1110 | DOM-heavy, mostly independent |
| Pure helpers: `getProductionMacroForWare`, `getDownstreamWares`, `isFactionWarePresent`, `formatWareName` | 18-155, 1109-1134 | Easiest first extraction, testable without DOM |
| Build-needs / construction budget panels | 1134-1693 | Pure calc plus HTML strings |
| `updateInspector` | 1855-3574 | Split into per-section renderers |
| Lifecycle: `initMatrixView`, `destroyMatrixView`, listeners | 3574-3720 | Owns the only module-level state |

**Dependencies (12 imports):** `store.js` (`state`, `store`), `xmlParser`, `calculator`, `buildCost`, `prices`, `matchNeeds`, `workforce`, `sectors`, `blueprintOwnership`, `cuckooDlcLookup`, `html.js`, `wares`.

**Hidden coupling (risky spots):**
- Module-level mutable state: `containerEl`, `unsubscribeStore` (lines 3675-3676).
- Globals written or read on `window`: `window.showNoBlueprintPopup`, `window.__lastPopupMessage`, `window.renderApp` (checked at lines 1839, 3692, 3702).
- ~72 direct `window`/`document`/`localStorage` references and 33 `addEventListener`/timer calls: listener cleanup must stay in `destroyMatrixView`.
- Shared singleton `state`/`store` imported directly rather than injected.
- HTML built as strings, so output is diffable (good for golden-file tests).

## Stage 2 - Safety net (next, before moving code)
1. Add Vitest (already on Vite, no new toolchain) with `npm test`.
2. Characterization tests on the pure helpers and on the HTML-string renderers (`renderMatrixTabHTML`, `renderConstructionBudgetInspectorHTML`, `renderBuildNeedsBudgetInspectorHTML`), using fixed sample state and golden snapshots.
3. A contract test pinning the 11 names `main.js` imports.
4. One headless smoke test (jsdom or the existing puppeteer-core) that mounts the app and calls `updateInspector` for a few wares.
5. Gate: break a function on purpose, confirm a test fails.

## Stage 3-6 (one change kind per commit)
3. Add `src/ui/matrixView/index.js` facade re-exporting the 11 names; point `main.js` at it (no logic change). Make the 20 unused exports internal.
4. Extract leaf-first, one PR each: pure helpers -> budget/needs calc -> graph code -> `updateInspector` sections -> lifecycle.
5. Verify: render old and new inspector HTML for the same saved blueprints and diff (empty diff expected); compare load time on a large blueprint.
6. Delete the old file; add an import-cycle check and a lint rule blocking deep imports past the facade; update README/docs.

## Exit plan
Each step is a single revertable commit; the old file stays untouched until Stage 6.

## Status log
- **Stage 3 (facade) done:** module moved to `src/ui/matrixView/matrixView.js`; `index.js` exposes the 11 names `main.js` uses; temporary shim at the old path; `tests/matrixView/boundary.test.js` blocks imports past the facade.
- **Deferred to after the `updateInspector` test exists:** injecting `state`/`store` instead of importing the singletons, and removing `window.renderApp` / `window.showNoBlueprintPopup` coupling (these change runtime wiring, not just structure).
- The 20 exports not used by `main.js` stay `export`ed from `matrixView.js` on purpose: the files extracted in Stage 4 need them. The facade, not the `export` keyword, is the public boundary.
