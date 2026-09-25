import { WARES_DB, DEPENDENCIES } from '../src/data/wares.js';
import { state } from '../src/engine/state.js';
import { calculateFactoryRequirements, accumulateRawMiningRates, computeLayerTotals } from '../src/engine/calculator.js';

console.log('=== Test: Ensure No L4 Cards Impose Upstream Demands ===\n');

const l4Wares = Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 4);
console.log('Found Level 4 Wares:', l4Wares);

let allPassed = true;

// Scenario 1: Each L4 ware selected in Single Target Mode (STM)
for (const l4Id of l4Wares) {
  state.activeBlueprint = null;
  state.selectedWareId = l4Id;
  state.workforceBonus = 0;
  calculateFactoryRequirements();

  // Check state.calculatedDemand
  const demands = Object.entries(state.calculatedDemand).filter(([k, v]) => v && (v.rateNeeded > 0 || v.modulesNeeded > 0));
  if (demands.length > 0) {
    console.error(`FAIL: STM with L4 ware "${l4Id}" imposed demands:`, demands);
    allPassed = false;
  } else {
    console.log(`PASS: STM with "${l4Id}" imposed 0 upstream demands.`);
  }

  // Check state.rawDemand
  const rawDemands = Object.entries(state.rawDemand || {}).filter(([k, v]) => v > 0);
  if (rawDemands.length > 0) {
    console.error(`FAIL: STM with L4 ware "${l4Id}" imposed raw demands:`, rawDemands);
    allPassed = false;
  }

  // Check layerTotals
  if (state.layerTotals) {
    if (state.layerTotals.totalECNeeded > 0) {
      console.error(`FAIL: STM with L4 ware "${l4Id}" imposed EC demand: ${state.layerTotals.totalECNeeded}`);
      allPassed = false;
    }
  }
}

// Scenario 2: Active Blueprint with L4 modules planned
state.activeBlueprint = {
  name: 'Test L4 Blueprint',
  totalModules: l4Wares.length,
  modules: {},
  rawMacros: {}
};
l4Wares.forEach(id => {
  state.activeBlueprint.modules[id] = 5; // 5x of every L4 module
});
state.selectedWareId = null;
calculateFactoryRequirements();

const bpDemands = Object.entries(state.calculatedDemand).filter(([k, v]) => v && (v.rateNeeded > 0 || v.modulesNeeded > 0));
if (bpDemands.length > 0) {
  console.error('FAIL: Blueprint with L4 modules imposed demands:', bpDemands);
  allPassed = false;
} else {
  console.log('\nPASS: Blueprint with 5x of every L4 module imposed 0 upstream demands.');
}

const bpRawDemands = Object.entries(state.rawDemand || {}).filter(([k, v]) => v > 0);
if (bpRawDemands.length > 0) {
  console.error('FAIL: Blueprint with L4 modules imposed raw mining demands:', bpRawDemands);
  allPassed = false;
} else {
  console.log('PASS: Blueprint with 5x of every L4 module imposed 0 raw mining demands.');
}

if (state.layerTotals.totalECNeeded > 0) {
  console.error('FAIL: Blueprint with L4 modules imposed totalECNeeded:', state.layerTotals.totalECNeeded);
  allPassed = false;
} else {
  console.log('PASS: Blueprint with 5x of every L4 module imposed 0 EC demand.');
}

if (allPassed) {
  console.log('\n🎉 ALL TESTS PASSED: No L4 cards impose any upstream demands!');
} else {
  process.exit(1);
}
