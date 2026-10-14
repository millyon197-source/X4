const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const target = 'C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\save\\quicksave.xml.gz';
const rl = readline.createInterface({ input: fs.createReadStream(target).pipe(zlib.createGunzip()) });

let lineNum = 0;
rl.on('line', line => {
  lineNum++;
  if (line.includes('220011')) {
    console.log(`${lineNum}: ${line.slice(0, 160)}`);
  }
});
rl.on('close', () => console.log('Done scanning for 220011'));
