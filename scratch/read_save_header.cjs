const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');
const path = require('path');

const possiblePaths = [
  path.join(process.env.USERPROFILE || '', 'OneDrive', 'Documents', 'Egosoft', 'X4'),
  path.join(process.env.USERPROFILE || '', 'Documents', 'Egosoft', 'X4')
];

let target = null;
for (const base of possiblePaths) {
  if (fs.existsSync(base)) {
    const subdirs = fs.readdirSync(base);
    for (const sub of subdirs) {
      const saveDir = path.join(base, sub, 'save');
      if (fs.existsSync(saveDir)) {
        const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.xml.gz'));
        if (files.length > 0) {
          files.sort((a, b) => fs.statSync(path.join(saveDir, b)).mtimeMs - fs.statSync(path.join(saveDir, a)).mtimeMs);
          target = path.join(saveDir, files[0]);
          break;
        }
      }
    }
  }
  if (target) break;
}

if (target) {
  console.log('Target save:', target);
  const rl = readline.createInterface({ input: fs.createReadStream(target).pipe(zlib.createGunzip()) });
  let c = 0;
  rl.on('line', l => {
    c++;
    if (l.includes('<player') || l.includes('location=') || l.includes('<save') || c < 15) {
      console.log(`${c}: ${l.slice(0, 160)}`);
    }
    if (c > 50) rl.close();
  });
} else {
  console.log('No save found');
}
