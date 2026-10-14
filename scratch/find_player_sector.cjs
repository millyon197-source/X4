const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const target = 'C:\\Users\\Zeus\\OneDrive\\Documents\\Egosoft\\X4\\47624366\\save\\quicksave.xml.gz';
const rl = readline.createInterface({ input: fs.createReadStream(target).pipe(zlib.createGunzip()) });

let lineNum = 0;
let lastSector = null;
let lastCluster = null;

rl.on('line', line => {
  lineNum++;
  if (line.includes('class="cluster"')) {
    lastCluster = `${lineNum}: ${line.slice(0, 160)}`;
  }
  if (line.includes('class="sector"')) {
    lastSector = `${lineNum}: ${line.slice(0, 160)}`;
  }
  if (lineNum === 4015129) {
    console.log('Player at line 4015129');
    console.log('Last Sector:', lastSector);
    console.log('Last Cluster:', lastCluster);
    rl.close();
  }
});
