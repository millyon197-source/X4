import { WARES_DB, DEPENDENCIES } from '../src/data/wares.js';

console.log('=== Hull Parts Output Consumers ===');
for (const [id, ware] of Object.entries(WARES_DB)) {
  if (ware.recipe && (ware.recipe.HullParts !== undefined || ware.recipe.ScrapHullParts !== undefined)) {
    console.log(`- [${id}] ${ware.name} (Level ${ware.level}, ${ware.cat})`);
    console.log(`  Recipe requirement: ${ware.recipe.HullParts || ware.recipe.ScrapHullParts} Hull Parts / cycle`);
    console.log(`  Full recipe:`, JSON.stringify(ware.recipe));
  }
}

console.log('\n=== Graph Dependency Links in DEPENDENCIES ===');
const links = DEPENDENCIES.filter(d => d.from === 'HullParts' || d.from === 'ScrapHullParts');
links.forEach(l => {
  const target = WARES_DB[l.to];
  console.log(`- ${l.from} -> ${l.to} ("${target ? target.name : 'Unknown'}", Level ${target ? target.level : '?'})`);
});
