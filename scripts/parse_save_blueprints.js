import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';
import path from 'path';

import os from 'os';

const docsDir = process.env.USERPROFILE 
  ? path.join(process.env.USERPROFILE, 'OneDrive', 'Documents')
  : path.join(os.homedir(), 'Documents');

// Find first matching X4 save or use default path
const savePath = process.argv[2] || path.join(docsDir, 'Egosoft', 'X4', '47624366', 'save', 'save_006.xml.gz');
const catalog = JSON.parse(fs.readFileSync('src/data/blueprints_catalog.json', 'utf8'));

const fileStream = fs.createReadStream(savePath);
const gunzip = zlib.createGunzip();
const rl = readline.createInterface({ input: fileStream.pipe(gunzip), crlfDelay: Infinity });

const foundWares = new Set();
rl.on('line', (line) => {
  const m = line.match(/<blueprint ware="([^"]+)"/);
  if (m) foundWares.add(m[1]);
});

rl.on('close', () => {
  console.log(`Found ${foundWares.size} distinct blueprint wares in savegame.`);
  let unlockedCount = 0;
  for (const bp of catalog.blueprints) {
    for (const w of foundWares) {
      if (bp.id === w || bp.macro === w) {
        if (!bp.unlocked) unlockedCount++;
        bp.unlocked = true;
        console.log(`Unlocked [Direct]: ${bp.name} (${bp.macro})`);
        break;
      }
      const cleanW = w.replace(/^module_/, '').replace(/_01$/, '').toLowerCase();
      const cleanM = (bp.macro || '').replace(/_macro$/, '').toLowerCase();
      const parts = cleanW.split('_');
      if (parts.length >= 2 && parts.every(p => cleanM.includes(p))) {
        if (!bp.unlocked) unlockedCount++;
        bp.unlocked = true;
        console.log(`Unlocked [Matched]: ${bp.name} (${bp.macro}) <= ${w}`);
        break;
      }
    }
  }
  console.log(`Total newly unlocked from savegame: ${unlockedCount}`);
  const rm = catalog.blueprints.find(b => b.name.includes('Refined Metal'));
  console.log('Refined Metal Production status:', rm ? rm.unlocked : 'Not found');
  const hp = catalog.blueprints.find(b => b.name.includes('Hull Part Production'));
  console.log('Hull Part Production status:', hp ? hp.unlocked : 'Not found');
});
