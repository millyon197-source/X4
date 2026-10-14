const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('C:\\Users\\Zeus\\projects\\x4-supply-matrix\\scratch\\sectors_base.json', 'utf8'));

const cleaned = {};
for (const [id, val] of Object.entries(raw)) {
  let name = null;
  // If there's (Sector Name) in parentheses:
  const parenMatch = val.match(/\(([^)]+)\)/);
  if (parenMatch) {
    name = parenMatch[1].trim();
  } else if (!val.includes('{')) {
    name = val.trim();
  }
  if (name && name.length > 0 && !name.startsWith('auto') && !name.startsWith('cluster_')) {
    cleaned[id] = name;
  }
}

console.log('Cleaned entries count:', Object.keys(cleaned).length);
console.log('Sample:');
for (const k of Object.keys(cleaned).slice(0, 15)) {
  console.log(`  "${k}": "${cleaned[k]}"`);
}

fs.writeFileSync('C:\\Users\\Zeus\\projects\\x4-supply-matrix\\scratch\\sectors_cleaned.json', JSON.stringify(cleaned, null, 2));
