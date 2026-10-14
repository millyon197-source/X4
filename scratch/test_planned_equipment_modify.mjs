import assert from 'node:assert';
import { parseXMLBlueprint, rebuildBlueprintFromMacros } from '../src/engine/xmlParser.js';
import { generateBlueprintXML, generateModifiedBlueprintXML, generateCleanBlueprintXML, isEquipmentMacro } from '../src/engine/blueprintExporter.js';
import { state } from '../src/state/store.js';
import { getKnownMacrosList } from '../src/ui/plannedView.js';
import { JSDOM } from 'jsdom';

// Setup DOMParser for Node.js environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = dom.window.XMLSerializer;

console.log('=== Test 1: Load XML Blueprint with Equipment Upgrades ===');

const testXml = `<?xml version="1.0" encoding="utf-8"?>
<plans>
  <plan id="test_defense_base" name="Test Defense Base">
    <entry index="1" macro="defense_arg_disc_01_macro">
      <offset>
        <position x="0" y="0" z="0"/>
      </offset>
      <upgrades>
        <groups>
          <shields macro="shield_arg_m_standard_02_mk2_macro" group="group01" exact="6"/>
          <turrets macro="turret_arg_m_flak_02_mk1_macro" group="group01" exact="12"/>
        </groups>
      </upgrades>
    </entry>
    <entry index="2" macro="prod_gen_energycells_macro">
      <offset>
        <position x="500" y="0" z="0"/>
      </offset>
    </entry>
  </plan>
</plans>`;

parseXMLBlueprint(testXml, 'test_defense_base.xml', () => {});

assert(state.activeBlueprint, 'activeBlueprint should exist');
assert.strictEqual(state.activeBlueprint.rawMacros['defense_arg_disc_01_macro'], 1);
assert.strictEqual(state.activeBlueprint.rawMacros['shield_arg_m_standard_02_mk2_macro'], 6);
assert.strictEqual(state.activeBlueprint.rawMacros['turret_arg_m_flak_02_mk1_macro'], 12);
assert.strictEqual(state.activeBlueprint.rawMacros['prod_gen_energycells_macro'], 1);
console.log('Initial rawMacros loaded:', state.activeBlueprint.rawMacros);

console.log('\n=== Test 2: Modify Equipment Qty (Decrease turrets 12 -> 4) ===');

// Simulate Planned Modules decrement / quantity input update
const turretMacro = 'turret_arg_m_flak_02_mk1_macro';
state.activeBlueprint.rawMacros[turretMacro] = 4;
state.activeBlueprint.rootMacros[turretMacro] = 4;
rebuildBlueprintFromMacros();

assert.strictEqual(state.activeBlueprint.rawMacros[turretMacro], 4, 'Turret count must remain 4 after rebuild');
console.log('Turrets successfully modified to 4, not reverted by rebuildBlueprintFromMacros');

console.log('\n=== Test 3: Delete Equipment Module (Delete shields 6 -> 0) ===');

const shieldMacro = 'shield_arg_m_standard_02_mk2_macro';
delete state.activeBlueprint.rawMacros[shieldMacro];
delete state.activeBlueprint.rootMacros[shieldMacro];
rebuildBlueprintFromMacros();

assert.strictEqual(state.activeBlueprint.rawMacros[shieldMacro], undefined, 'Shields must remain deleted');
console.log('Shields successfully deleted, not resurrected by rebuildBlueprintFromMacros');

console.log('\n=== Test 4: Increase Equipment Qty (Increase turrets 4 -> 16) ===');

state.activeBlueprint.rawMacros[turretMacro] = 16;
state.activeBlueprint.rootMacros[turretMacro] = 16;
rebuildBlueprintFromMacros();

assert.strictEqual(state.activeBlueprint.rawMacros[turretMacro], 16, 'Turret count must remain 16');
console.log('Turrets successfully increased to 16');

console.log('\n=== Test 5: Check getKnownMacrosList includes Equipment ===');

const known = getKnownMacrosList();
const hasTurrets = known.some(m => isEquipmentMacro(m));
console.log('Total known macros:', known.length);
console.log('Sample equipment macros in known list:', known.filter(m => isEquipmentMacro(m)).slice(0, 5));
assert(hasTurrets, 'getKnownMacrosList must include equipment macros');

console.log('\n=== Test 6: Export Modified Blueprint XML ===');

const exportedXml = generateModifiedBlueprintXML('ExportedTest', state.activeBlueprint.rawMacros, testXml);
console.log('Exported XML snippet:\n', exportedXml);

// Validate XML using DOMParser
const parser = new DOMParser();
const doc = parser.parseFromString(exportedXml, 'text/xml');
const parserErrors = doc.querySelectorAll('parsererror');
assert.strictEqual(parserErrors.length, 0, 'Exported XML must be valid XML with no syntax errors');

// Verify equipment is NOT top-level <entry>
const entryMacros = Array.from(doc.querySelectorAll('entry')).map(e => e.getAttribute('macro'));
assert(!entryMacros.includes('shield_arg_m_standard_02_mk2_macro'), 'Shields must not be top-level entry');
assert(!entryMacros.includes('turret_arg_m_flak_02_mk1_macro'), 'Turrets must not be top-level entry');

// Verify upgrades reflect changes: 0 shields, 16 turrets
const exportedShields = doc.querySelectorAll('shields[macro="shield_arg_m_standard_02_mk2_macro"]');
assert.strictEqual(exportedShields.length, 0, 'Deleted shields must not appear in exported XML upgrades');

const exportedTurrets = doc.querySelectorAll('turrets[macro="turret_arg_m_flak_02_mk1_macro"]');
assert(exportedTurrets.length > 0, 'Turrets must appear in upgrades');
let totalExportedTurrets = 0;
exportedTurrets.forEach(t => {
  totalExportedTurrets += parseInt(t.getAttribute('exact'), 10) || 1;
});
assert.strictEqual(totalExportedTurrets, 16, 'Total turrets in XML upgrades must equal 16');
console.log('Exported XML upgrades verified: 0 shields, 16 turrets');

console.log('\n=== Test 7: Clean Blueprint XML Generation with Equipment ===');

const cleanMacros = {
  'prod_gen_energycells_macro': 2,
  'turret_arg_m_flak_02_mk1_macro': 8
};
const cleanXml = generateCleanBlueprintXML('CleanTest', cleanMacros);
const cleanDoc = parser.parseFromString(cleanXml, 'text/xml');
assert.strictEqual(cleanDoc.querySelectorAll('parsererror').length, 0, 'Clean XML must be valid XML');
const cleanEntryMacros = Array.from(cleanDoc.querySelectorAll('entry')).map(e => e.getAttribute('macro'));
assert.strictEqual(cleanEntryMacros.filter(m => m === 'prod_gen_energycells_macro').length, 2);
assert(!cleanEntryMacros.includes('turret_arg_m_flak_02_mk1_macro'), 'Equipment must not be clean entry');
const cleanTurretTag = cleanDoc.querySelector('turrets[macro="turret_arg_m_flak_02_mk1_macro"]');
assert(cleanTurretTag, 'Equipment must be attached in upgrades of clean entry');
assert.strictEqual(cleanTurretTag.getAttribute('exact'), '8', 'Clean turret tag exact must be 8');
console.log('Clean XML generation with equipment verified');

console.log('\nAll tests passed successfully! ✓');
