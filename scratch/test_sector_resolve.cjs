const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const secLookup = JSON.parse(fs.readFileSync('./src/data/sectors_lookup.json', 'utf8'));
const targetSave = 'C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\save\\quicksave.xml.gz';
const rl = readline.createInterface({ input: fs.createReadStream(targetSave).pipe(zlib.createGunzip()) });

rl.on('line', line => {
  const pMatch = line.match(/<player\s+name="([^"]+)"(?:\s+location="([^"]*)")?(?:\s+money="([^"]*)")?/);
  if (pMatch) {
    console.log('Player name:', pMatch[1]);
    console.log('Location:', pMatch[2]);
    console.log('Resolved sector:', secLookup[pMatch[2]]);
    rl.close();
  }
});
