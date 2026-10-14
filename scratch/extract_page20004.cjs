const fs = require('fs');
const path = require('path');

const catFile = 'C:\\SteamLibrary\\steamapps\\common\\X4 Foundations\\09.cat';
const datFile = 'C:\\SteamLibrary\\steamapps\\common\\X4 Foundations\\09.dat';

const lines = fs.readFileSync(catFile, 'utf8').trim().split('\n');
let offset = 0;
let targetEntry = null;

for (const line of lines) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) continue;
  const name = parts[0];
  const size = parseInt(parts[1], 10);
  if (name === 't/0001-l044.xml') {
    targetEntry = { offset, size };
    break;
  }
  offset += size;
}

if (!targetEntry) {
  console.error('Target not found in .cat');
  process.exit(1);
}

console.log('Found t/0001-l044.xml at offset:', targetEntry.offset, 'size:', targetEntry.size);

const fd = fs.openSync(datFile, 'r');
const buf = Buffer.alloc(targetEntry.size);
fs.readSync(fd, buf, 0, targetEntry.size, targetEntry.offset);
fs.closeSync(fd);

const text = buf.toString('utf8');
console.log('Read text length:', text.length);

// Extract page id="20004"
const pageMatch = text.match(/<page\s+id="20004"[^>]*>([\s\S]*?)<\/page>/);
if (pageMatch) {
  const pageContent = pageMatch[1];
  const tRegex = /<t\s+id="(\d+)"[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  const sectorMap = {};
  while ((m = tRegex.exec(pageContent)) !== null) {
    const id = m[1];
    let val = m[2].trim();
    // Only capture sector names (usually odd IDs or short text without long descriptions)
    if (!val.includes('\n') && val.length < 60) {
      sectorMap[id] = val;
    }
  }
  console.log(`Extracted ${Object.keys(sectorMap).length} entries from page 20004`);
  fs.writeFileSync('C:\\Users\\Zeus\\projects\\x4-supply-matrix\\scratch\\sectors_base.json', JSON.stringify(sectorMap, null, 2));
  console.log('Sample entries:');
  for (const k of Object.keys(sectorMap).slice(0, 10)) {
    console.log(`  ${k}: "${sectorMap[k]}"`);
  }
} else {
  console.log('Page 20004 not found in 09.dat, will search other .cats');
}
