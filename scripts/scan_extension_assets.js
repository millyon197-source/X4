import fs from 'fs';
import path from 'path';

/**
 * Cuckoo HashTable implementation (Pagh-Rodler 2001)
 * Table size = 1847 per table.
 * Key (1st entry): Component Name
 * Value (2nd entry): First directory name after \extensions (e.g. ego_dlc_terran)
 * Worst-case O(1) lookup time (<= 2 memory probes).
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
    const str = String(key);
    for (let i = 0; i < str.length; i++) {
      h = ((h * 33) + str.charCodeAt(i)) % this.size;
    }
    return (h + this.size) % this.size;
  }

  // Secondary Hash Function h2: FNV/Polynomial modulo size
  hash2(key) {
    let h = 0;
    const str = String(key);
    for (let i = 0; i < str.length; i++) {
      h = ((h * 31) + str.charCodeAt(i)) % this.size;
    }
    return (h + this.size) % this.size;
  }

  insert(key, value, fileName = '') {
    // Check if key already exists in Table 1
    const pos1 = this.hash1(key);
    if (this.table1[pos1] && this.table1[pos1].key === key) {
      if (!this.table1[pos1].extensions.includes(value)) {
        this.table1[pos1].extensions.push(value);
        this.table1[pos1].value = this.table1[pos1].extensions.join(', ');
      }
      return true;
    }

    // Check if key already exists in Table 2
    const pos2 = this.hash2(key);
    if (this.table2[pos2] && this.table2[pos2].key === key) {
      if (!this.table2[pos2].extensions.includes(value)) {
        this.table2[pos2].extensions.push(value);
        this.table2[pos2].value = this.table2[pos2].extensions.join(', ');
      }
      return true;
    }

    // New entry pair: Key = ComponentName, Value = FirstDirAfterExtensions
    let curr = {
      key,
      value,
      extensions: [value],
      fileName
    };

    let targetTable = 1;
    for (let i = 0; i < this.maxDisplacements; i++) {
      if (targetTable === 1) {
        const pos = this.hash1(curr.key);
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
        const pos = this.hash2(curr.key);
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

    console.warn(`⚠️ Cuckoo displacement cycle detected for component '${curr.key}' after ${this.maxDisplacements} kicks.`);
    this.failed++;
    return false;
  }

  find(key) {
    const pos1 = this.hash1(key);
    if (this.table1[pos1] && this.table1[pos1].key === key) {
      return { found: true, table: 1, slot: pos1, key, value: this.table1[pos1].value, entry: this.table1[pos1] };
    }

    const pos2 = this.hash2(key);
    if (this.table2[pos2] && this.table2[pos2].key === key) {
      return { found: true, table: 2, slot: pos2, key, value: this.table2[pos2].value, entry: this.table2[pos2] };
    }

    return { found: false, table: 0, slot: -1, key, value: null, entry: null };
  }

  getStats() {
    const occT1 = this.table1.filter(Boolean).length;
    const occT2 = this.table2.filter(Boolean).length;
    const totalSlots = this.size * 2;
    return {
      tableSize: this.size,
      totalSlots,
      uniqueKeys: this.count,
      failed: this.failed,
      displacements: this.displacements,
      occT1,
      occT2,
      loadFactor: (this.count / totalSlots).toFixed(3)
    };
  }
}

function extractComponentElementName(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const compMatch = content.match(/<component\b[^>]*\bname\s*=\s*["']([^"']+)["']/i);
    if (compMatch && compMatch[1]) return compMatch[1].trim();

    const refMatch = content.match(/<component\b[^>]*\bref\s*=\s*["']([^"']+)["']/i);
    if (refMatch && refMatch[1]) return refMatch[1].trim();

    const macroMatch = content.match(/<macro\b[^>]*\bname\s*=\s*["']([^"']+)["']/i);
    if (macroMatch && macroMatch[1]) return macroMatch[1].trim();

    return path.basename(filePath, '.xml');
  } catch (err) {
    return path.basename(filePath, '.xml');
  }
}

function findXmlFiles(dir) {
  let xmlFiles = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        xmlFiles = xmlFiles.concat(findXmlFiles(fullPath));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
        xmlFiles.push(fullPath);
      }
    }
  } catch {}
  return xmlFiles;
}

export function scanExtensionsAndBuildCuckooTable(explicitExtensionsDir) {
  const possiblePaths = [
    explicitExtensionsDir,
    'C:\\SteamLibrary\\steamapps\\common\\X4 Foundations\\extensions',
    'D:\\Games\\Steam\\steamapps\\common\\X4 Foundations\\extensions',
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'Documents', 'Egosoft', 'X4', 'extensions'),
    path.join(process.env.USERPROFILE || '', 'Documents', 'Egosoft', 'X4', 'extensions')
  ].filter(Boolean);

  let extensionsDir = possiblePaths.find(p => fs.existsSync(p));
  if (!extensionsDir) {
    console.error('❌ Could not locate X4 Foundations extensions directory.');
    return null;
  }

  console.log(`🔍 Scanning extensions directory: ${extensionsDir}`);

  const cuckoo = new CuckooHashTable1847(1847);
  const extSubdirs = fs.readdirSync(extensionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let totalXmlProcessed = 0;

  for (const extName of extSubdirs) {
    const extPath = path.join(extensionsDir, extName);
    const childDirs = fs.readdirSync(extPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const assetsFolder = childDirs.find(d => /^assets?$/i.test(d) || /^assests?$/i.test(d));
    if (!assetsFolder) continue;

    const assetsPath = path.join(extPath, assetsFolder);
    console.log(`📂 Entering assets folder: [${extName}\\${assetsFolder}]`);

    const xmlFiles = findXmlFiles(assetsPath);
    console.log(`   Found ${xmlFiles.length} .xml files in ${assetsPath}`);

    for (const xmlPath of xmlFiles) {
      totalXmlProcessed++;

      // 1st Entry (Key): Component element name
      const componentName = extractComponentElementName(xmlPath);

      // Obtain directory path for inclusion after \extensions
      const subDirAfterExtensions = path.relative(extensionsDir, path.dirname(xmlPath));

      // 2nd Entry (Value): Strip path information after the first directory name
      const firstDirAfterExtensions = subDirAfterExtensions.split(path.sep)[0];

      // Insert pair into Cuckoo table
      cuckoo.insert(componentName, firstDirAfterExtensions, path.basename(xmlPath));
    }
  }

  const stats = cuckoo.getStats();
  console.log('\n📊 === Cuckoo Hashing (Table Size: 1847) Summary ===');
  console.log(`Total XML Processed:          ${totalXmlProcessed}`);
  console.log(`Unique Component Keys:        ${stats.uniqueKeys}`);
  console.log(`Cycles (Failures):            ${stats.failed}`);
  console.log(`Total Displacements:          ${stats.displacements}`);
  console.log(`Table 1 Occupied:             ${stats.occT1} / ${stats.tableSize} (${((stats.occT1 / stats.tableSize) * 100).toFixed(1)}%)`);
  console.log(`Table 2 Occupied:             ${stats.occT2} / ${stats.tableSize} (${((stats.occT2 / stats.tableSize) * 100).toFixed(1)}%)`);
  console.log(`Combined Capacity:            ${stats.totalSlots} slots (2 x ${stats.tableSize})`);
  console.log(`Load Factor:                  ${stats.loadFactor} (${((stats.uniqueKeys / stats.totalSlots) * 100).toFixed(1)}%)`);
  console.log(`Worst-Case Lookup Cost:       O(1) (<= 2 memory probes)`);

  // Save to src/data/cuckoo_extensions_table.json
  try {
    const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
    const outDir = path.join(projectRoot, 'src', 'data');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'cuckoo_extensions_table.json');

    const lookupMap = {};
    for (let i = 0; i < cuckoo.size; i++) {
      if (cuckoo.table1[i]) lookupMap[cuckoo.table1[i].key] = cuckoo.table1[i].value;
      if (cuckoo.table2[i]) lookupMap[cuckoo.table2[i].key] = cuckoo.table2[i].value;
    }

    const payload = {
      tableSize: cuckoo.size,
      totalUniqueComponents: stats.uniqueKeys,
      totalXmlScanned: totalXmlProcessed,
      generatedAt: new Date().toISOString(),
      statistics: stats,
      lookupMap,
      table1: cuckoo.table1,
      table2: cuckoo.table2
    };

    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`\n💾 Successfully exported Cuckoo HashTable to: ${outFile}`);
  } catch (err) {
    console.warn('Could not export to JSON file:', err.message);
  }

  return cuckoo;
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('scan_extension_assets.js') || 
  path.basename(process.argv[1]).includes('scan_extension_assets')
);

if (isDirectRun) {
  const cuckoo = scanExtensionsAndBuildCuckooTable(process.argv[2]);
  if (cuckoo) {
    const testKeys = ['station_bor_tradestation_base_01', 'dockarea_ter_xl_carrier_01', 'prod_ter_siliconcarbide'];
    console.log('\n--- Live O(1) Cuckoo Lookup Verification ---');
    for (const k of testKeys) {
      const res = cuckoo.find(k);
      console.log(res.found ? `  [OK] Key: '${res.key}' -> Table ${res.table} (Slot ${res.slot}), Value: '${res.value}'` : `  [MISS] Key '${k}' not found`);
    }
  }
}

