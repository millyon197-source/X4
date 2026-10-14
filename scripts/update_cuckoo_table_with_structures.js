import fs from 'fs';
import path from 'path';

/**
 * Cuckoo HashTable (Pagh-Rodler 2-table algorithm)
 * Table size: 1847 per table (total slots: 3694).
 */
class CuckooHashTable1847 {
  constructor(size = 1847, maxDisplacements = 500) {
    this.size = size;
    this.maxDisplacements = maxDisplacements;
    this.table1 = new Array(size).fill(null);
    this.table2 = new Array(size).fill(null);
    this.count = 0;
    this.displacements = 0;
    this.failed = 0;
  }

  // Primary Hash Function h1: DJB2 modulo size
  hash1(key) {
    let h = 5381;
    const str = String(key || '');
    for (let i = 0; i < str.length; i++) {
      h = ((h * 33) + str.charCodeAt(i)) % this.size;
    }
    return (h + this.size) % this.size;
  }

  // Secondary Hash Function h2: FNV/Polynomial modulo size
  hash2(key) {
    let h = 0;
    const str = String(key || '');
    for (let i = 0; i < str.length; i++) {
      h = ((h * 31) + str.charCodeAt(i)) % this.size;
    }
    return (h + this.size) % this.size;
  }

  insert(key, value, extensions = null, fileName = '') {
    const exts = Array.isArray(extensions)
      ? extensions
      : String(value || '').split(',').map(s => s.trim()).filter(Boolean);

    const valStr = exts.join(', ');

    // 1. Check if key already exists in Table 1
    const pos1 = this.hash1(key);
    if (this.table1[pos1] && (this.table1[pos1].Key === key || this.table1[pos1].key === key)) {
      const existing = this.table1[pos1];
      const existingExts = existing.Extensions || existing.extensions || [];
      for (const e of exts) {
        if (!existingExts.includes(e)) {
          existingExts.push(e);
        }
      }
      existing.Extensions = existingExts;
      existing.extensions = existingExts;
      existing.Value = existingExts.join(', ');
      existing.value = existingExts.join(', ');
      return true;
    }

    // 2. Check if key already exists in Table 2
    const pos2 = this.hash2(key);
    if (this.table2[pos2] && (this.table2[pos2].Key === key || this.table2[pos2].key === key)) {
      const existing = this.table2[pos2];
      const existingExts = existing.Extensions || existing.extensions || [];
      for (const e of exts) {
        if (!existingExts.includes(e)) {
          existingExts.push(e);
        }
      }
      existing.Extensions = existingExts;
      existing.extensions = existingExts;
      existing.Value = existingExts.join(', ');
      existing.value = existingExts.join(', ');
      return true;
    }

    // 3. New entry
    let curr = {
      Key: key,
      key,
      Value: valStr,
      value: valStr,
      Extensions: exts,
      extensions: exts,
      FileName: fileName,
      fileName
    };

    let targetTable = 1;
    for (let i = 0; i < this.maxDisplacements; i++) {
      if (targetTable === 1) {
        const pos = this.hash1(curr.Key);
        if (!this.table1[pos]) {
          this.table1[pos] = curr;
          this.count++;
          return true;
        }

        // Evict existing occupant
        this.displacements++;
        const evicted = this.table1[pos];
        this.table1[pos] = curr;
        curr = evicted;
        targetTable = 2;
      } else {
        const pos = this.hash2(curr.Key);
        if (!this.table2[pos]) {
          this.table2[pos] = curr;
          this.count++;
          return true;
        }

        // Evict existing occupant
        this.displacements++;
        const evicted = this.table2[pos];
        this.table2[pos] = curr;
        curr = evicted;
        targetTable = 1;
      }
    }

    console.warn(`⚠️ Cuckoo displacement limit reached for '${curr.Key}' after ${this.maxDisplacements} kicks.`);
    this.failed++;
    return false;
  }
}

// Recursive file scanner
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

// 1. Locate directories
const primaryStructuresDir = 'D:/Ai/X4/GoogleAntiGravity/assets/structures';
const steamStructuresDir = 'C:/SteamLibrary/steamapps/common/X4 Foundations/assets/structures';

const dirsToScan = [primaryStructuresDir];
if (fs.existsSync(steamStructuresDir)) {
  dirsToScan.push(steamStructuresDir);
}

console.log('Searching assets/structures directories:');
dirsToScan.forEach(d => console.log('  -', d));

// Collect XML files
const scannedFiles = new Set();
let totalXmlFiles = 0;
const componentElements = new Map(); // compName -> { compName, fileName, filePath }

for (const dir of dirsToScan) {
  const xmls = findXmlFiles(dir);
  console.log(`Found ${xmls.length} XML files in ${dir}`);
  totalXmlFiles += xmls.length;

  for (const file of xmls) {
    scannedFiles.add(file);
    try {
      const content = fs.readFileSync(file, 'utf8');
      // Match <component name="..." ...>
      const regex = /<component\b[^>]*?\bname="([^"]+)"[^>]*?>/gi;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const compName = match[1].trim();
        if (compName && !componentElements.has(compName)) {
          componentElements.set(compName, {
            compName,
            fileName: path.basename(file),
            filePath: file
          });
        }
      }
    } catch (e) {
      console.warn(`Error parsing ${file}:`, e.message);
    }
  }
}

console.log(`\nTotal unique component elements found in structures XMLs: ${componentElements.size}`);

// 2. Load existing cuckoo table
const tablePath = path.resolve('src/data/cuckoo_extensions_table.json');
const rawJson = fs.readFileSync(tablePath, 'utf8').replace(/^\uFEFF/, '');
const existingTable = JSON.parse(rawJson);

console.log(`Existing table currently contains ${existingTable.totalUniqueComponents || Object.keys(existingTable.lookupMap || {}).length} unique components.`);

// Combine map: Map of key -> { value, extensions, fileName }
const combinedEntries = new Map();

// First, populate with existing entries from cuckoo_extensions_table
const existingLookup = existingTable.lookupMap || {};
for (const [key, val] of Object.entries(existingLookup)) {
  let cleanVal = String(val || '').trim();
  if (!cleanVal) {
    cleanVal = 'generic';
  }
  const exts = cleanVal.split(',').map(s => s.trim()).filter(Boolean);
  combinedEntries.set(key, {
    key,
    value: cleanVal,
    extensions: exts.length > 0 ? exts : ['generic'],
    fileName: ''
  });
}

// Preserve existing fileNames if stored in existing table1 / table2
const existingT1 = Array.isArray(existingTable.table1?.value) ? existingTable.table1.value : (Array.isArray(existingTable.table1) ? existingTable.table1 : []);
const existingT2 = Array.isArray(existingTable.table2?.value) ? existingTable.table2.value : (Array.isArray(existingTable.table2) ? existingTable.table2 : []);
for (const item of [...existingT1, ...existingT2]) {
  if (item && (item.Key || item.key)) {
    const k = item.Key || item.key;
    if (combinedEntries.has(k)) {
      combinedEntries.get(k).fileName = item.FileName || item.fileName || '';
    }
  }
}

// 3. Process each component element found in assets/structures
let newlyAddedCount = 0;
let updatedEmptyCount = 0;
let alreadyPresentCount = 0;

for (const [compName, info] of componentElements) {
  if (combinedEntries.has(compName)) {
    const entry = combinedEntries.get(compName);
    if (!entry.value || entry.value.trim() === '') {
      entry.value = 'generic';
      entry.extensions = ['generic'];
      updatedEmptyCount++;
    } else {
      alreadyPresentCount++;
    }
    if (!entry.fileName && info.fileName) {
      entry.fileName = info.fileName;
    }
  } else {
    // Not present: Add it, insert 'generic' for the value
    combinedEntries.set(compName, {
      key: compName,
      value: 'generic',
      extensions: ['generic'],
      fileName: info.fileName
    });
    newlyAddedCount++;
  }
}

console.log(`\nMerge Summary:`);
console.log(`- Newly added components from assets/structures: ${newlyAddedCount}`);
console.log(`- Existing components updated from empty to 'generic': ${updatedEmptyCount}`);
console.log(`- Existing components already present with DLC values: ${alreadyPresentCount}`);
console.log(`- Total unique components in updated table: ${combinedEntries.size}`);

// 4. Rebuild Cuckoo Hash Table with TableSize = 1847
const cuckoo = new CuckooHashTable1847(1847, 1000);

for (const [key, entry] of combinedEntries) {
  const ok = cuckoo.insert(entry.key, entry.value, entry.extensions, entry.fileName);
  if (!ok) {
    console.error(`FAILED to insert key '${key}' into Cuckoo Table!`);
    process.exit(1);
  }
}

// Verify every key is retrievable via <= 2 probes
let verifiedCount = 0;
const newLookupMap = {};

for (const [key, entry] of combinedEntries) {
  const p1 = cuckoo.hash1(key);
  const p2 = cuckoo.hash2(key);
  const e1 = cuckoo.table1[p1];
  const e2 = cuckoo.table2[p2];

  const match1 = e1 && (e1.Key === key || e1.key === key);
  const match2 = e2 && (e2.Key === key || e2.key === key);

  if (!match1 && !match2) {
    console.error(`Verification FAILED for key '${key}'!`);
    process.exit(1);
  }
  verifiedCount++;
  newLookupMap[key] = entry.value;
}

console.log(`\n✓ Verification: All ${verifiedCount} unique components verified with <= 2 Cuckoo probes!`);

// Count occupied slots
const t1Occupied = cuckoo.table1.filter(Boolean).length;
const t2Occupied = cuckoo.table2.filter(Boolean).length;
const totalSlots = cuckoo.size * 2;
const loadFactor = Number((cuckoo.count / totalSlots).toFixed(4));

console.log(`Cuckoo Statistics:`);
console.log(`- Table 1 occupied: ${t1Occupied} / ${cuckoo.size}`);
console.log(`- Table 2 occupied: ${t2Occupied} / ${cuckoo.size}`);
console.log(`- Total displacements during insertions: ${cuckoo.displacements}`);
console.log(`- Load Factor: ${loadFactor} (${(loadFactor * 100).toFixed(1)}%)`);

// 5. Structure updated output
const finalData = {
  tableSize: cuckoo.size,
  totalUniqueComponents: cuckoo.count,
  totalXmlScanned: totalXmlFiles + (existingTable.totalXmlScanned || 0),
  generatedAt: new Date().toISOString(),
  statistics: {
    table1Occupied: t1Occupied,
    table2Occupied: t2Occupied,
    totalSlots: totalSlots,
    totalDisplacements: cuckoo.displacements,
    loadFactor: loadFactor,
    worstCaseLookupProbes: 2
  },
  lookupMap: newLookupMap,
  table1: {
    value: cuckoo.table1.map(e => e ? {
      Key: e.Key,
      Value: e.Value,
      Extensions: e.Extensions,
      FileName: e.FileName
    } : null)
  },
  table2: {
    value: cuckoo.table2.map(e => e ? {
      Key: e.Key,
      Value: e.Value,
      Extensions: e.Extensions,
      FileName: e.FileName
    } : null)
  }
};

// Write cleanly without BOM
fs.writeFileSync(tablePath, JSON.stringify(finalData, null, 4), 'utf8');
console.log(`\n✓ Successfully saved updated table to: ${tablePath}`);
