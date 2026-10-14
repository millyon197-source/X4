import assert from 'node:assert';
import { parseXMLBlueprint, parseBlueprintXML } from '../src/engine/xmlParser.js';
import { state } from '../src/state/store.js';
import { mapMacroToWare, getFriendlyModuleName } from '../src/data/wares.js';
import { isMacroBlueprintOwned } from '../src/engine/blueprintOwnership.js';
import { calculateBuildCosts } from '../src/engine/buildCost.js';

console.log('=== Test 1: parseXMLBlueprint with Upgrades ===');

const xmlSample = `<?xml version="1.0" encoding="utf-8"?>
<plans>
  <plan id="test_defense_outpost" name="Frontier Defense Outpost">
    <entry index="1" macro="defense_arg_disc_01_macro">
      <upgrades>
        <groups>
          <shields macro="shield_arg_m_standard_02_mk2_macro" group="group01"/>
          <shields macro="shield_arg_m_standard_02_mk2_macro" group="group02"/>
          <turrets macro="turret_arg_m_flak_02_mk1_macro" group="group01" exact="2"/>
          <turrets macro="turret_arg_l_plasma_01_mk1_macro" group="group05" exact="4"/>
        </groups>
      </upgrades>
    </entry>
    <entry index="2" macro="prod_gen_energycells_macro">
    </entry>
  </plan>
</plans>`;

parseXMLBlueprint(xmlSample, 'test.xml', () => {});

assert(state.activeBlueprint, 'activeBlueprint should be populated');
const rawMacros = state.activeBlueprint.rawMacros;
console.log('Parsed rawMacros:', rawMacros);

assert.strictEqual(rawMacros['defense_arg_disc_01_macro'], 1, 'defense disc module should be 1');
assert.strictEqual(rawMacros['shield_arg_m_standard_02_mk2_macro'], 2, 'shields should accumulate to 2');
assert.strictEqual(rawMacros['turret_arg_m_flak_02_mk1_macro'], 2, 'flak turrets should be 2');
assert.strictEqual(rawMacros['turret_arg_l_plasma_01_mk1_macro'], 4, 'plasma turrets should be 4');
assert.strictEqual(rawMacros['prod_gen_energycells_macro'], 1, 'energy cells module should be 1');

console.log('=== Test 2: Verify Non-Contributing Ware Modules Inclusion ===');
// Upgrades and non-ware modules must have mapMacroToWare returning null/undefined
assert.strictEqual(mapMacroToWare('defense_arg_disc_01_macro'), null);
assert.strictEqual(mapMacroToWare('shield_arg_m_standard_02_mk2_macro'), null);
assert.strictEqual(mapMacroToWare('turret_arg_m_flak_02_mk1_macro'), null);
assert.strictEqual(mapMacroToWare('turret_arg_l_plasma_01_mk1_macro'), null);

const nonContributingMacros = Object.entries(rawMacros).filter(([m, count]) => !mapMacroToWare(m) && count > 0);
console.log('Non-contributing macros count:', nonContributingMacros.length);
assert.strictEqual(nonContributingMacros.length, 4, 'All 4 non-ware modules/upgrades should be non-contributing');

const nonContributingNames = nonContributingMacros.map(([m, c]) => `${c}x ${getFriendlyModuleName(m)}`);
console.log('Non-contributing friendly items:', nonContributingNames);

console.log('=== Test 3: Ownership Check & Not Owned Panel Placement ===');
const mockServerModules = [
  { macro: 'defense_arg_disc_01_macro', unlocked: true },
  { macro: 'shield_arg_m_standard_02_mk2_macro', unlocked: false }, // NOT OWNED
  { macro: 'turret_arg_m_flak_02_mk1_macro', unlocked: false },      // NOT OWNED
  { macro: 'turret_arg_l_plasma_01_mk1_macro', unlocked: true },     // OWNED
  { macro: 'prod_gen_energycells_macro', unlocked: true }
];

const unowned = [];
for (const [m, count] of Object.entries(rawMacros)) {
  const isOwned = isMacroBlueprintOwned(m, mockServerModules);
  console.log(`Module ${m} (${count}x): isOwned = ${isOwned}`);
  if (!isOwned) {
    unowned.push({ macro: m, count, friendly: getFriendlyModuleName(m) });
  }
}

assert.strictEqual(unowned.length, 2, 'Exactly 2 unowned upgrades should be flagged');
assert(unowned.some(u => u.macro === 'shield_arg_m_standard_02_mk2_macro' && u.count === 2));
assert(unowned.some(u => u.macro === 'turret_arg_m_flak_02_mk1_macro' && u.count === 2));
console.log('Items for Not Owned panel:', unowned);

console.log('=== Test 4: calculateBuildCosts with Upgrades ===');
const costResult = calculateBuildCosts(rawMacros);
console.log('Build costs calculated total credits:', costResult.totals.totalCredits);
console.log('Build costs resources:', Object.keys(costResult.resources));
assert(costResult.totals.totalWareUnits > 0, 'Build cost units should be greater than 0');
assert(costResult.totals.totalCredits > 0, 'Total credits should be greater than 0');

console.log('=== Test 5: parseBlueprintXML API function ===');
const parseResult = parseBlueprintXML(xmlSample);
assert(parseResult.success, 'parseBlueprintXML should succeed');
assert.strictEqual(parseResult.modules['shield_arg_m_standard_02_mk2_macro'], 2);
assert.strictEqual(parseResult.modules['turret_arg_l_plasma_01_mk1_macro'], 4);

console.log('\nAll blueprint upgrade tests passed successfully! ✓');
