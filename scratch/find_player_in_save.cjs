const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const target = 'C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\save\\quicksave.xml.gz';
const rl = readline.createInterface({ input: fs.createReadStream(target).pipe(zlib.createGunzip()) });

let c = 0;
rl.on('line', l => {
  c++;
  if (c > 20 && l.includes('Millyon Aire')) {
    console.log(`Line ${c}: ${l.slice(0, 160)}`);
  }
});
rl.on('close', () => console.log('Done, checked', c, 'lines.'));
