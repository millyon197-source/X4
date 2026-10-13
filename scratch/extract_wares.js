import fs from 'fs';
import path from 'path';

function getWares(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const regex = /<ware\s+id="([^"]+)"[^>]+tags="([^"]+)"/g;
  const wares = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    wares.push({ id: m[1], tags: m[2] });
  }
  return wares;
}

const base = 'C:/SteamLibrary/steamapps/common/X4 Foundations';
const allFiles = [path.join(base, 'libraries', 'wares.xml')];
const dlcDir = path.join(base, 'extensions');
if (fs.existsSync(dlcDir)) {
  fs.readdirSync(dlcDir).forEach(d => {
    const p = path.join(dlcDir, d, 'libraries', 'wares.xml');
    if (fs.existsSync(p)) allFiles.push(p);
  });
}

let all = [];
allFiles.forEach(f => {
  all = all.concat(getWares(f));
});

const modules = [...new Set(all.filter(w => w.tags.includes('module')).map(w => w.id))];
const ships = [...new Set(all.filter(w => w.tags.includes('ship')).map(w => w.id))];
const equipment = [...new Set(all.filter(w => w.tags.includes('equipment')).map(w => w.id))];

console.log('Modules count:', modules.length);
console.log('Ships count:', ships.length);
console.log('Equipment count:', equipment.length);
console.log('Sample modules:', modules.slice(0, 10));

fs.writeFileSync('C:/Users/Zeus/projects/x4-supply-matrix/scratch/extracted_wares.json', JSON.stringify({ modules, ships, equipment }, null, 2));
