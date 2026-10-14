const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const target = 'C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\save\\quicksave.xml.gz';
const rl = readline.createInterface({ input: fs.createReadStream(target).pipe(zlib.createGunzip()) });

let c = 0;
let printing = 0;
rl.on('line', l => {
  c++;
  if (c === 6) return; // skip header line
  if (l.includes('40028') || l.includes('40028') || l.includes('name="Millyon Aire"')) {
    console.log(`MATCH line ${c}: ${l.slice(0, 160)}`);
    printing = 5;
  } else if (printing > 0) {
    console.log(`   + line ${c}: ${l.slice(0, 160)}`);
    printing--;
  }
  if (c > 300000) rl.close();
});
rl.on('close', () => console.log('Done after', c, 'lines'));
