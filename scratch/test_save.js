const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const possiblePaths = [
  path.join(process.env.USERPROFILE || '', 'OneDrive', 'Documents', 'Egosoft', 'X4'),
  path.join(process.env.USERPROFILE || '', 'Documents', 'Egosoft', 'X4')
];

function findLatestSavegamePath() {
  for (const base of possiblePaths) {
    if (fs.existsSync(base)) {
      try {
        const subdirs = fs.readdirSync(base);
        for (const sub of subdirs) {
          const saveDir = path.join(base, sub, 'save');
          if (fs.existsSync(saveDir)) {
            const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.xml.gz'));
            if (files.length > 0) {
              files.sort((a, b) => fs.statSync(path.join(saveDir, b)).mtimeMs - fs.statSync(path.join(saveDir, a)).mtimeMs);
              return path.join(saveDir, files[0]);
            }
          }
        }
      } catch (err) {}
    }
  }
  return null;
}

const targetSave = findLatestSavegamePath();
console.log('Target save:', targetSave);

const fileStream = fs.createReadStream(targetSave);
const gunzip = zlib.createGunzip();
const rl = readline.createInterface({ input: fileStream.pipe(gunzip), crlfDelay: Infinity });

const foundPatches = new Set();
let hasPatchesHeader = false;
let count = 0;

rl.on('line', (line) => {
  count++;
  if (line.includes('<patches>') || line.includes('<patches/>')) {
    hasPatchesHeader = true;
  }
  const patchMatch = line.match(/<patch\s+extension="([^"]+)"/i);
  if (patchMatch) {
    hasPatchesHeader = true;
    foundPatches.add(patchMatch[1].toLowerCase());
  }
  if (count > 200) {
    rl.close();
    fileStream.destroy();
  }
});

rl.on('close', () => {
  console.log('Lines read:', count);
  console.log('hasPatchesHeader:', hasPatchesHeader);
  console.log('foundPatches:', Array.from(foundPatches));
});
