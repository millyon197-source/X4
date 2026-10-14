import fs from 'fs';
import { parseXMLBlueprint } from '../src/engine/xmlParser.js';
import { state, store } from '../src/state/store.js';
import { calculateBuildCosts } from '../src/engine/buildCost.js';
import { isMacroBlueprintOwned } from '../src/engine/blueprintOwnership.js';
import { getFriendlyModuleName, mapMacroToWare } from '../src/data/wares.js';

const xml = fs.readFileSync('C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/constructionplan/Test123.xml', 'utf8');
parseXMLBlueprint(xml, 'Test123.xml');

console.log('--- 1. ACTIVE BLUEPRINT SUMMARY ---');
console.log('Name:', state.activeBlueprint.name);
console.log('Total entries:', state.activeBlueprint.totalModules);
console.log('Raw macros count:', Object.keys(state.activeBlueprint.rawMacros).length);

console.log('\n--- 2. NON-CONTRIBUTING MODULES ---');
const nonContributing = [];
for (const [macro, count] of Object.entries(state.activeBlueprint.rawMacros)) {
  if (!mapMacroToWare(macro)) {
    const friendly = getFriendlyModuleName(macro);
    const isOwned = isMacroBlueprintOwned(macro, state.serverModules);
    nonContributing.push({ macro, friendly, count, isOwned });
    console.log(`  - ${count}x ${friendly} (${macro}) [Owned: ${isOwned}]`);
  }
}

console.log('\n--- 3. UNOWNED MODULES / UPGRADES ---');
const unowned = [];
for (const [macro, count] of Object.entries(state.activeBlueprint.rawMacros)) {
  const isOwned = isMacroBlueprintOwned(macro, state.serverModules);
  if (!isOwned) {
    const friendly = getFriendlyModuleName(macro);
    unowned.push({ macro, friendly, count });
    console.log(`  - [NOT OWNED] ${count}x ${friendly} (${macro})`);
  }
}

console.log('\n--- 4. BUILD COSTS FOR BLUEPRINT ---');
const costs = calculateBuildCosts(state.activeBlueprint);
console.log('Total ware units:', costs.totals.totalWareUnits);
console.log('Total credits:', costs.totals.totalCredits);
console.log('Resources budgeted:', Object.keys(costs.resources));

if (unowned.length > 0 && nonContributing.some(m => m.macro.includes('shield')) && nonContributing.some(m => m.macro.includes('turret'))) {
  console.log('\n🎉 ALL VERIFICATION CRITERIA PERFECTLY SATISFIED!');
} else {
  console.error('\n❌ VERIFICATION FAILED');
  process.exit(1);
}
