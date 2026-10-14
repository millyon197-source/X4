import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const crissianPath = path.join(projectRoot, 'src', 'data', 'crissian_build_costs.json');
const macroNamesPath = path.join(projectRoot, 'src', 'data', 'macro_names.json');
const blueprintsPath = path.join(projectRoot, 'src', 'data', 'blueprints_catalog.json');
const cuckooPath = path.join(projectRoot, 'src', 'data', 'cuckoo_extensions_table.json');

// 1. Update crissian_build_costs.json
const crissian = JSON.parse(fs.readFileSync(crissianPath, 'utf8'));
if (!crissian['struct_arg_cross_03_macro']) {
  crissian['struct_arg_cross_03_macro'] = {
    claytronics: 15,
    energycells: 30,
    hullparts: 55
  };
  fs.writeFileSync(crissianPath, JSON.stringify(crissian, null, 2), 'utf8');
  console.log('✓ Added struct_arg_cross_03_macro to crissian_build_costs.json');
} else {
  console.log('struct_arg_cross_03_macro already in crissian_build_costs.json');
}

// 2. Update macro_names.json
const macroNames = JSON.parse(fs.readFileSync(macroNamesPath, 'utf8'));
const namesToAdd = {
  'struct_arg_arc_01_macro': 'Argon Arc Connection Structure 01',
  'struct_arg_cross_02_macro': 'Argon Cross Connection Structure 02',
  'struct_arg_cross_03_macro': 'Argon Cross Connection Structure 03',
  'struct_arg_cross_04_macro': 'Argon Cross Connection Structure 04',
  'struct_arg_cross_05_macro': 'Argon Cross Connection Structure 05'
};
let namesUpdated = false;
for (const [k, v] of Object.entries(namesToAdd)) {
  if (!macroNames[k]) {
    macroNames[k] = v;
    namesUpdated = true;
  }
}
if (namesUpdated) {
  fs.writeFileSync(macroNamesPath, JSON.stringify(macroNames, null, 2), 'utf8');
  console.log('✓ Added missing names to macro_names.json');
} else {
  console.log('macro_names.json already has all names');
}

// 3. Update blueprints_catalog.json
const blueprints = JSON.parse(fs.readFileSync(blueprintsPath, 'utf8'));
const existingBpMacros = new Set(blueprints.blueprints.map(b => b.macro));
const bpsToAdd = [
  {
    id: 'struct_arg_arc_01_macro',
    name: 'Argon Arc Connection Structure 01',
    macro: 'struct_arg_arc_01_macro',
    group: 'modules',
    subgroup: 'Structural',
    moduleType: 'Structural',
    category: 'Structural',
    faction: 'Argon',
    hull: 120000,
    unlocked: true,
    cost: { claytronics: 15, energycells: 30, hullparts: 55 }
  },
  {
    id: 'struct_arg_cross_02_macro',
    name: 'Argon Cross Connection Structure 02',
    macro: 'struct_arg_cross_02_macro',
    group: 'modules',
    subgroup: 'Structural',
    moduleType: 'Structural',
    category: 'Structural',
    faction: 'Argon',
    hull: 110000,
    unlocked: true,
    cost: { claytronics: 14, energycells: 28, hullparts: 52 }
  },
  {
    id: 'struct_arg_cross_03_macro',
    name: 'Argon Cross Connection Structure 03',
    macro: 'struct_arg_cross_03_macro',
    group: 'modules',
    subgroup: 'Structural',
    moduleType: 'Structural',
    category: 'Structural',
    faction: 'Argon',
    hull: 100000,
    unlocked: true,
    cost: { claytronics: 15, energycells: 30, hullparts: 55 }
  },
  {
    id: 'struct_arg_cross_04_macro',
    name: 'Argon Cross Connection Structure 04',
    macro: 'struct_arg_cross_04_macro',
    group: 'modules',
    subgroup: 'Structural',
    moduleType: 'Structural',
    category: 'Structural',
    faction: 'Argon',
    hull: 90000,
    unlocked: true,
    cost: { claytronics: 16, energycells: 32, hullparts: 58 }
  },
  {
    id: 'struct_arg_cross_05_macro',
    name: 'Argon Cross Connection Structure 05',
    macro: 'struct_arg_cross_05_macro',
    group: 'modules',
    subgroup: 'Structural',
    moduleType: 'Structural',
    category: 'Structural',
    faction: 'Argon',
    hull: 80000,
    unlocked: true,
    cost: { claytronics: 18, energycells: 36, hullparts: 64 }
  }
];

let bpAddedCount = 0;
for (const bp of bpsToAdd) {
  if (!existingBpMacros.has(bp.macro)) {
    blueprints.blueprints.push(bp);
    bpAddedCount++;
  }
}
if (bpAddedCount > 0) {
  blueprints.totalCount = blueprints.blueprints.length;
  fs.writeFileSync(blueprintsPath, JSON.stringify(blueprints, null, 2), 'utf8');
  console.log(`✓ Added ${bpAddedCount} blueprints to blueprints_catalog.json`);
} else {
  console.log('blueprints_catalog.json already has all blueprints');
}

// 4. Update cuckoo_extensions_table.json to ensure struct_arg_cross_03_macro is also directly mapped
const cuckooData = JSON.parse(fs.readFileSync(cuckooPath, 'utf8'));
if (!cuckooData.lookupMap['struct_arg_cross_03_macro']) {
  cuckooData.lookupMap['struct_arg_cross_03_macro'] = 'generic';
  fs.writeFileSync(cuckooPath, JSON.stringify(cuckooData, null, 4), 'utf8');
  console.log('✓ Added struct_arg_cross_03_macro to cuckoo_extensions_table.json');
} else {
  console.log('cuckoo_extensions_table.json already has struct_arg_cross_03_macro');
}

console.log('\nAll appropriate tables updated successfully!');
