import fs from 'fs';
import path from 'path';

function findXmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findXmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Gather files from active workspace assets/structures, plus Steam as fallback/supplement
const primaryDir = 'D:/Ai/X4/GoogleAntiGravity/assets/structures';
const steamDir = 'C:/SteamLibrary/steamapps/common/X4 Foundations/assets/structures';

const dirsToScan = [primaryDir];
if (fs.existsSync(steamDir)) {
  dirsToScan.push(steamDir);
}

const componentMap = new Map(); // name -> { fileName, filePath, source }

for (const dir of dirsToScan) {
  const xmlFiles = findXmlFiles(dir);
  console.log(`Found ${xmlFiles.length} XML files in ${dir}`);

  for (const file of xmlFiles) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      // Match <component name="..." ...>
      const regex = /<component\b[^>]*?\bname="([^"]+)"[^>]*?>/gi;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const compName = match[1].trim();
        if (compName && !componentMap.has(compName)) {
          componentMap.set(compName, {
            name: compName,
            fileName: path.basename(file),
            filePath: file,
            source: dir === primaryDir ? 'local' : 'steam'
          });
        }
      }
    } catch (e) {
      console.warn(`Error reading ${file}:`, e.message);
    }
  }
}

console.log(`Total unique component elements found in assets/structures: ${componentMap.size}`);

// Inspect current cuckoo table
const cuckooTablePath = path.resolve('src/data/cuckoo_extensions_table.json');
const cuckooData = JSON.parse(fs.readFileSync(cuckooTablePath, 'utf8'));

console.log(`Current cuckoo_extensions_table unique components: ${cuckooData.totalUniqueComponents}`);
console.log(`Current lookupMap size: ${Object.keys(cuckooData.lookupMap).length}`);

let presentCount = 0;
let missingCount = 0;
const missingComponents = [];

for (const [compName, info] of componentMap) {
  if (cuckooData.lookupMap[compName] !== undefined) {
    presentCount++;
  } else {
    missingCount++;
    missingComponents.push(info);
  }
}

console.log(`Components already present in table: ${presentCount}`);
console.log(`Components missing from table: ${missingCount}`);
console.log(`Sample missing components:`, missingComponents.slice(0, 15).map(c => c.name));
