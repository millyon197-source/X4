import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';

const savePath = 'C:/Users/Zeus/OneDrive/Documents/Egosoft/X4/47624366/save/quicksave.xml.gz';
const fileStream = fs.createReadStream(savePath);
const gunzip = zlib.createGunzip();
const rl = readline.createInterface({ input: fileStream.pipe(gunzip), crlfDelay: Infinity });

const found = [];
rl.on('line', (line) => {
  const m = line.match(/<blueprint ware="([^"]+)"/);
  if (m) found.push(m[1]);
});

rl.on('close', () => {
  console.log('Total blueprints in quicksave:', found.length);
  console.log('List of wares:');
  console.log(found);
});
