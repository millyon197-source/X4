const fs = require('fs');
const path = require('path');

const allSectors = {};

function processCat(catPath, datPath) {
  if (!fs.existsSync(catPath) || !fs.existsSync(datPath)) return;
  const lines = fs.readFileSync(catPath, 'utf8').trim().split('\n');
  let offset = 0;
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const name = parts[0];
    const size = parseInt(parts[1], 10);
    if (name.includes('0001-l044.xml') || name.includes('0001-L044.xml')) {
      try {
        const fd = fs.openSync(datPath, 'r');
        const buf = Buffer.alloc(size);
        fs.readSync(fd, buf, 0, size, offset);
        fs.closeSync(fd);
        const text = buf.toString('utf8');
        const pageMatch = text.match(/<page\s+id="20004"[^>]*>([\s\S]*?)<\/page>/);
        if (pageMatch) {
          const tRegex = /<t\s+id="(\d+)"[^>]*>([\s\S]*?)<\/t>/g;
          let m;
          while ((m = tRegex.exec(pageMatch[1])) !== null) {
            const id = m[1];
            let val = m[2].trim();
            const parenMatch = val.match(/\(([^)]+)\)/);
            if (parenMatch) {
              allSectors[id] = parenMatch[1].trim();
            } else if (!val.includes('{') && val.length > 0 && val.length < 60) {
              allSectors[id] = val.trim();
            }
          }
        }
      } catch (e) {}
    }
    offset += size;
  }
}

// 1. Base game
const baseDir = 'C:\\SteamLibrary\\steamapps\\common\\X4 Foundations';
for (let i = 1; i <= 9; i++) {
  const pad = String(i).padStart(2, '0');
  processCat(path.join(baseDir, `${pad}.cat`), path.join(baseDir, `${pad}.dat`));
}

// 2. Extensions / DLCs
const extBase = path.join(baseDir, 'extensions');
if (fs.existsSync(extBase)) {
  for (const ext of fs.readdirSync(extBase)) {
    const dir = path.join(extBase, ext);
    if (fs.statSync(dir).isDirectory()) {
      for (let j = 1; j <= 5; j++) {
        const pad = String(j).padStart(2, '0');
        processCat(path.join(dir, `ext_${pad}.cat`), path.join(dir, `ext_${pad}.dat`));
      }
    }
  }
}

console.log(`Total complete sectors extracted across base game + all DLCs: ${Object.keys(allSectors).length}`);

// Also generate full {20004,ID} lookup
const finalLookup = {};
for (const [id, name] of Object.entries(allSectors)) {
  finalLookup[`{20004,${id}}`] = name;
  finalLookup[id] = name;
}

fs.writeFileSync('C:\\Users\\Zeus\\projects\\x4-supply-matrix\\src\\data\\sectors_lookup.json', JSON.stringify(finalLookup, null, 2));
console.log('Saved to src/data/sectors_lookup.json');
