import fs from 'fs';
const raw = JSON.parse(fs.readFileSync('./src/data/blueprints_catalog.json', 'utf8'));
const bps = raw.blueprints;
console.log('Total in catalog:', bps.length);
console.log('Sample modules:');
bps.filter(b => b.group === 'modules').slice(0, 10).forEach(b => {
  console.log(`id: "${b.id}", macro: "${b.macro}", name: "${b.name}"`);
});

// Also check savegame wares found:
const saveWares = JSON.parse(fs.readFileSync('./src/data/crissian_modules_master.json', 'utf8'));
console.log('Crissian master modules count:', Object.keys(saveWares).length);
