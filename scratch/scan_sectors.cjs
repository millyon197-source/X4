const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const target = 'C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\save\\quicksave.xml.gz';
const rl = readline.createInterface({ input: fs.createReadStream(target).pipe(zlib.createGunzip()) });

const sectors = [];
rl.on('line', line => {
  if (line.includes('class="sector"')) {
    const macroMatch = line.match(/macro="([^"]+)"/);
    const nameMatch = line.match(/name="([^"]+)"/);
    if (macroMatch && nameMatch) {
      sectors.push({ macro: macroMatch[1], name: nameMatch[1] });
    }
  }
});
rl.on('close', () => {
  console.log(`Found ${sectors.length} sectors:`);
  console.log(sectors.slice(0, 15));
});
