import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const isLoopbackAddress = (ip) => {
  if (!ip) return false;
  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip === '::ffff:127.0.0.1' || 
         ip.startsWith('127.');
};

const app = express();
const httpServer = createServer(app);

// Immediate TCP socket layer firewall: reject any connection not originating from localhost
httpServer.on('connection', (socket) => {
  const remoteIp = socket.remoteAddress;
  if (!isLoopbackAddress(remoteIp)) {
    console.warn(`[Security] Rejected non-localhost connection attempt from: ${remoteIp}`);
    socket.destroy();
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow local requests without origin header (e.g. LUA bridge, curl, local tools)
      if (!origin) return callback(null, true);
      try {
        const u = new URL(origin);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch (e) {}
      return callback(new Error('CORS: Only localhost is permitted.'));
    }
  }
});

// Enforce that HTTP requests originate strictly from localhost / loopback
app.use((req, res, next) => {
  const remoteIp = req.socket.remoteAddress;
  if (!isLoopbackAddress(remoteIp)) {
    return res.status(403).send('Forbidden: Access limited to localhost only.');
  }
  res.setHeader('Connection', 'close');
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Enforce that WebSocket connections originate strictly from localhost / loopback
io.use((socket, next) => {
  const remoteIp = socket.handshake.address;
  if (!isLoopbackAddress(remoteIp)) {
    return next(new Error('Forbidden: WebSocket access limited to localhost only.'));
  }
  next();
});

// Middleware to parse incoming JSON payloads from your X4 LUA client
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static dashboard files from a "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Pre-load comprehensive blueprints catalog (Modules, Ships, Equipment)
let allBlueprints = [];
let catalogSummary = { total: 0, owned: 0, modules: { total: 0, owned: 0 }, ships: { total: 0, owned: 0 }, equipment: { total: 0, owned: 0 } };

try {
  const catalogPath = path.join(__dirname, 'src', 'data', 'blueprints_catalog.json');
  if (fs.existsSync(catalogPath)) {
    const rawCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    allBlueprints = rawCatalog.blueprints || [];
    catalogSummary = rawCatalog.summary || catalogSummary;
    console.log(`📦 Loaded ${allBlueprints.length} categorized blueprints from catalog (Modules: ${catalogSummary.modules?.total}, Ships: ${catalogSummary.ships?.total}, Equipment: ${catalogSummary.equipment?.total}).`);
  }
} catch (e) {
  console.warn('Could not load blueprints catalog:', e.message);
}

// Fallback if catalog not yet generated: extract baseline modules from master
if (allBlueprints.length === 0) {
  try {
    const masterPath = path.join(__dirname, 'src', 'data', 'crissian_modules_master.json');
    if (fs.existsSync(masterPath)) {
      const raw = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      allBlueprints = Object.values(raw).map(m => {
        let modType = 'Structural';
        if (m.type === 'production' || m.type === 'processingmodule') modType = 'Production';
        else if (m.type === 'habitation') modType = 'Habitation';
        else if (m.type === 'storage') modType = 'Storage';
        else if (m.type === 'defencemodule') modType = 'Defense';
        else if (m.type === 'dockarea' || m.type === 'pier' || m.type === 'buildmodule') modType = 'Dock';

        return {
          id: m.macro || m.name,
          name: m.name,
          macro: m.macro,
          group: 'modules',
          subgroup: modType,
          category: modType,
          moduleType: modType,
          faction: 'General',
          hull: 100000,
          unlocked: false,
          cost: m.cost || {},
          description: `Station module: ${m.name}`,
          production: { cycleTime: 60, output: '', amount: 0, inputs: [] },
          habitation: { race: 'All', maxCapacity: 0 },
          storage: { capacity: 0, tags: 'Container' }
        };
      });
    }
  } catch (e) {}
}

function calculateCatalogSummary(bps) {
  const mods = bps.filter(b => b.group === 'modules');
  const shps = bps.filter(b => b.group === 'ships');
  const eqps = bps.filter(b => b.group === 'equipment');
  return {
    total: bps.length,
    owned: bps.filter(b => b.unlocked).length,
    modules: {
      total: mods.length,
      owned: mods.filter(b => b.unlocked).length
    },
    ships: {
      total: shps.length,
      owned: shps.filter(b => b.unlocked).length
    },
    equipment: {
      total: eqps.length,
      owned: eqps.filter(b => b.unlocked).length
    }
  };
}

// Global memory store for game definitions
let gameEncyclopedia = {
  blueprints: allBlueprints,
  modules: allBlueprints.filter(b => b.group === 'modules'),
  ships: allBlueprints.filter(b => b.group === 'ships'),
  equipment: allBlueprints.filter(b => b.group === 'equipment'),
  summary: calculateCatalogSummary(allBlueprints),
  lastSynced: allBlueprints.length > 0 ? new Date().toISOString() : null
};

// Audit trail of retrieved tables
let recentRequests = [];
let latestByTable = {};

function recordRequest(tableName, payload, source = 'game') {
  const entry = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    table: tableName,
    timestamp: new Date().toISOString(),
    source,
    recordCount: Array.isArray(payload) ? payload.length : (payload && typeof payload === 'object' ? Object.keys(payload).length : 1),
    data: payload
  };
  latestByTable[tableName] = entry;
  recentRequests.unshift(entry);
  if (recentRequests.length > 100) recentRequests.pop();
  
  io.emit('table_retrieved', entry);
  return entry;
}

if (gameEncyclopedia.blueprints.length > 0) {
  recordRequest('blueprints', gameEncyclopedia.blueprints, 'baseline_catalog');
  if (gameEncyclopedia.modules.length > 0) recordRequest('modules', gameEncyclopedia.modules, 'baseline_catalog');
  if (gameEncyclopedia.ships.length > 0) recordRequest('ships', gameEncyclopedia.ships, 'baseline_catalog');
  if (gameEncyclopedia.equipment.length > 0) recordRequest('equipment', gameEncyclopedia.equipment, 'baseline_catalog');
  recordRequest('all', gameEncyclopedia.blueprints, 'baseline_catalog');
}

// Endpoint to fetch recent retrieved data tables
app.get('/api/recent-requests', (req, res) => {
  return res.status(200).json({ 
    requests: recentRequests,
    latestByTable
  });
});

app.get('/api/recent-requests/latest', (req, res) => {
  return res.status(200).json(recentRequests[0] || null);
});

// Endpoint to fetch current encyclopedia
app.get('/api/encyclopedia', (req, res) => {
  return res.status(200).json(gameEncyclopedia);
});

// Endpoint to fetch blueprints by group (modules, ships, equipment)
app.get('/api/blueprints/:group', (req, res) => {
  const group = req.params.group.toLowerCase();
  if (group === 'modules') return res.status(200).json(gameEncyclopedia.modules);
  if (group === 'ships') return res.status(200).json(gameEncyclopedia.ships);
  if (group === 'equipment') return res.status(200).json(gameEncyclopedia.equipment);
  if (group === 'all' || group === 'blueprints') return res.status(200).json(gameEncyclopedia.blueprints);
  return res.status(404).json({ error: `Unknown blueprint group: ${group}` });
});

// Endpoint to toggle or set blueprint ownership
app.post('/api/blueprints/ownership', (req, res) => {
  const { id, unlocked } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing blueprint id or macro' });

  const bp = gameEncyclopedia.blueprints.find(b => b.id === id || b.macro === id);
  if (!bp) return res.status(404).json({ error: `Blueprint not found: ${id}` });

  bp.unlocked = (typeof unlocked === 'boolean') ? unlocked : !bp.unlocked;

  // Recalculate cached groups and summary
  gameEncyclopedia.modules = gameEncyclopedia.blueprints.filter(b => b.group === 'modules');
  gameEncyclopedia.ships = gameEncyclopedia.blueprints.filter(b => b.group === 'ships');
  gameEncyclopedia.equipment = gameEncyclopedia.blueprints.filter(b => b.group === 'equipment');
  gameEncyclopedia.summary = calculateCatalogSummary(gameEncyclopedia.blueprints);
  gameEncyclopedia.lastSynced = new Date().toISOString();

  // Refresh latestByTable references
  if (latestByTable['blueprints']) latestByTable['blueprints'].data = gameEncyclopedia.blueprints;
  if (latestByTable[bp.group]) latestByTable[bp.group].data = gameEncyclopedia[bp.group];

  io.emit('encyclopedia_updated', gameEncyclopedia);
  io.emit('blueprint_ownership_changed', { id: bp.id, unlocked: bp.unlocked, summary: gameEncyclopedia.summary });

  return res.status(200).json({ status: 'success', blueprint: bp, summary: gameEncyclopedia.summary });
});

// Savegame Blueprint Scanner & Auto-Synchronizer
function findLatestSavegamePath() {
  const possiblePaths = [
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'Documents', 'Egosoft', 'X4'),
    path.join(process.env.USERPROFILE || '', 'Documents', 'Egosoft', 'X4')
  ];

  for (const base of possiblePaths) {
    if (fs.existsSync(base)) {
      try {
        const subdirs = fs.readdirSync(base);
        for (const sub of subdirs) {
          const saveDir = path.join(base, sub, 'save');
          if (fs.existsSync(saveDir)) {
            const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.xml.gz'));
            if (files.length > 0) {
              files.sort((a, b) => fs.statSync(path.join(saveDir, b)).mtimeMs - fs.statSync(path.join(saveDir, a)).mtimeMs);
              return path.join(saveDir, files[0]);
            }
          }
        }
      } catch (err) {}
    }
  }
  return null;
}

function findConfigXmlPath() {
  const possiblePaths = [
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'Documents', 'Egosoft', 'X4'),
    path.join(process.env.USERPROFILE || '', 'Documents', 'Egosoft', 'X4')
  ];

  for (const base of possiblePaths) {
    if (fs.existsSync(base)) {
      try {
        const subdirs = fs.readdirSync(base);
        for (const sub of subdirs) {
          const cfgPath = path.join(base, sub, 'config.xml');
          if (fs.existsSync(cfgPath)) {
            return cfgPath;
          }
        }
      } catch (err) {}
    }
  }
  return null;
}

function findConstructionPlanDir() {
  const possiblePaths = [
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'Documents', 'Egosoft', 'X4'),
    path.join(process.env.USERPROFILE || '', 'Documents', 'Egosoft', 'X4')
  ];

  for (const base of possiblePaths) {
    if (fs.existsSync(base)) {
      try {
        const subdirs = fs.readdirSync(base);
        for (const sub of subdirs) {
          const planDir = path.join(base, sub, 'constructionplan');
          if (fs.existsSync(planDir)) {
            return planDir;
          }
        }
      } catch (err) {}
    }
  }
  return null;
}

function getX4DisplayConfig() {
  try {
    const cfgPath = findConfigXmlPath();
    if (cfgPath && fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf8');
      const fullscreenMatch = content.match(/<fullscreen>\s*(true|false)\s*<\/fullscreen>/i);
      const borderlessMatch = content.match(/<borderless>\s*(true|false)\s*<\/borderless>/i);
      const fullscreen = fullscreenMatch ? fullscreenMatch[1].toLowerCase() === 'true' : false;
      const borderless = borderlessMatch ? borderlessMatch[1].toLowerCase() === 'true' : true;
      return {
        configured: true,
        path: cfgPath,
        fullscreen,
        borderless,
        requireFocusDelay: fullscreen && !borderless
      };
    }
  } catch (e) {
    console.warn('Could not read X4 config.xml:', e.message);
  }
  return {
    configured: false,
    fullscreen: false,
    borderless: true,
    requireFocusDelay: false
  };
}

let X4_SECTOR_LOOKUP = {};
try {
  const secPath = path.join(__dirname, 'src', 'data', 'sectors_lookup.json');
  if (fs.existsSync(secPath)) {
    X4_SECTOR_LOOKUP = JSON.parse(fs.readFileSync(secPath, 'utf8'));
    console.log(`🗺️ Loaded ${Object.keys(X4_SECTOR_LOOKUP).length} sector mappings from catalog.`);
  }
} catch (e) {
  console.warn('Failed loading sectors_lookup.json:', e.message);
}

function resolveSectorFromLocation(loc) {
  if (!loc) return null;
  const str = String(loc).trim();
  if (X4_SECTOR_LOOKUP[str]) return X4_SECTOR_LOOKUP[str];
  const lower = str.toLowerCase();
  if (X4_SECTOR_LOOKUP[lower]) return X4_SECTOR_LOOKUP[lower];

  const tagMatch = str.match(/\{20004,\s*(\d+)\}/);
  if (tagMatch) {
    if (X4_SECTOR_LOOKUP[tagMatch[1]]) return X4_SECTOR_LOOKUP[tagMatch[1]];
    if (X4_SECTOR_LOOKUP[`{20004,${tagMatch[1]}}`]) return X4_SECTOR_LOOKUP[`{20004,${tagMatch[1]}}`];
  }

  if (!str.startsWith('{') && !str.startsWith('[') && !str.startsWith('cdata') && str !== 'Unknown' && str !== 'Deep Space') {
    return str;
  }
  return null;
}

async function syncSavegameBlueprints(explicitPath, explicitTable) {
  const targetSave = explicitPath || findLatestSavegamePath();
  if (!targetSave || !fs.existsSync(targetSave)) {
    console.log('ℹ️ No X4 savegame found to auto-sync.');
    return { status: 'skipped', reason: 'No savegame found' };
  }

  return new Promise((resolve) => {
    try {
      const fileStream = fs.createReadStream(targetSave);
      const gunzip = zlib.createGunzip();
      const rl = readline.createInterface({ input: fileStream.pipe(gunzip), crlfDelay: Infinity });

      const foundWares = new Set();
      const foundPatches = new Set();
      let hasPatchesHeader = false;
      let savePlayer = null;
      rl.on('line', (line) => {
        if (!savePlayer) {
          const pMatch = line.match(/<player\s+name="([^"]+)"(?:\s+location="([^"]*)")?(?:\s+money="([^"]*)")?/);
          if (pMatch) {
            savePlayer = {
              name: pMatch[1],
              credits: pMatch[3] ? Number(pMatch[3]) : 0,
              location: pMatch[2] || null
            };
          }
        }
        if (line.includes('<patches>') || line.includes('<patches/>')) {
          hasPatchesHeader = true;
        }
        const patchMatch = line.match(/<patch\s+extension="([^"]+)"/i);
        if (patchMatch) {
          hasPatchesHeader = true;
          foundPatches.add(patchMatch[1].toLowerCase());
        }
        const m = line.match(/<blueprint ware="([^"]+)"/);
        if (m) foundWares.add(m[1]);
      });

      rl.on('close', () => {
        if (hasPatchesHeader) {
          const installed = detectInstalledDLCs();
          const checkDlc = (patches, key) => {
            const hasPatch = patches.some(p => foundPatches.has(p));
            const isInstalled = Boolean(installed[key]?.present);
            return {
              active: hasPatch,
              present: hasPatch || isInstalled
            };
          };

          gameState.dlcs = {
            ego_dlc_split: checkDlc(['ego_dlc_split'], 'ego_dlc_split'),
            ego_dlc_cradle: checkDlc(['ego_dlc_cradle', 'ego_dlc_terran'], 'ego_dlc_cradle'),
            ego_dlc_pirates: checkDlc(['ego_dlc_pirates', 'ego_dlc_pirate'], 'ego_dlc_pirates'),
            ego_dlc_boron: checkDlc(['ego_dlc_boron'], 'ego_dlc_boron'),
            ego_dlc_timelines: checkDlc(['ego_dlc_timelines'], 'ego_dlc_timelines'),
            ego_dlc_par_update: checkDlc(['ego_dlc_par_update', 'par_update'], 'ego_dlc_par_update')
          };
          console.log(`📦 Savegame DLC Inclusions detected:`, gameState.dlcs);
          io.emit('dlcs_updated', gameState.dlcs);
        }

        if (savePlayer && savePlayer.name) {
          gameState.player.name = savePlayer.name;
          if (typeof savePlayer.credits === 'number' && !isNaN(savePlayer.credits) && savePlayer.credits > 0) {
            gameState.player.credits = savePlayer.credits;
          }
          if (savePlayer.location) {
            const secName = resolveSectorFromLocation(savePlayer.location);
            if (secName) {
              gameState.player.sector = secName;
            }
          }
          gameState.lastUpdated = new Date().toISOString();
          console.log(`👤 Savegame Player Identity: ${gameState.player.name} (${Number(gameState.player.credits).toLocaleString()} Cr, Sector: ${gameState.player.sector})`);
          recordRequest('player', gameState.player, 'savegame_sync');
          io.emit('game_state_changed', gameState);
        }

        // When syncing a newly loaded savegame, reset existing blueprint ownership so blueprints
        // from a previously loaded session do not incorrectly persist into this savegame.
        for (const bp of gameEncyclopedia.blueprints) {
          bp.unlocked = false;
        }

        let newlyUnlocked = 0;
        for (const bp of gameEncyclopedia.blueprints) {
          for (const w of foundWares) {
            if (bp.id === w || bp.macro === w || bp.ware === w) {
              if (!bp.unlocked) newlyUnlocked++;
              bp.unlocked = true;
              break;
            }
            const cleanW = w.replace(/^module_/, '').replace(/_01$/, '').toLowerCase();
            const cleanM = (bp.macro || '').replace(/_macro$/, '').toLowerCase();
            const parts = cleanW.split('_');
            if (
              (parts.length >= 2 && parts.every(p => cleanM.includes(p))) ||
              (cleanW.includes('antigonespire') && cleanM.includes('antigonespire')) ||
              (cleanW.includes('antigonepillar') && cleanM.includes('antigonepillar'))
            ) {
              if (!bp.unlocked) newlyUnlocked++;
              bp.unlocked = true;
              break;
            }
          }
        }

        // Recalculate cached groups
        gameEncyclopedia.modules = gameEncyclopedia.blueprints.filter(b => b.group === 'modules');
        gameEncyclopedia.ships = gameEncyclopedia.blueprints.filter(b => b.group === 'ships');
        gameEncyclopedia.equipment = gameEncyclopedia.blueprints.filter(b => b.group === 'equipment');
        gameEncyclopedia.summary = calculateCatalogSummary(gameEncyclopedia.blueprints);
        gameEncyclopedia.lastSynced = new Date().toISOString();

        console.log(`💾 Scanned savegame [${path.basename(targetSave)}]: found ${foundWares.size} distinct wares, ${newlyUnlocked} newly unlocked. Total owned: ${gameEncyclopedia.summary.owned} (Modules: ${gameEncyclopedia.summary.modules.owned}, Ships: ${gameEncyclopedia.summary.ships.owned}, Equip: ${gameEncyclopedia.summary.equipment.owned}).`);
        io.emit('encyclopedia_updated', gameEncyclopedia);

        let activeEntry = null;
        const targetSyncTable = (explicitTable || 'all').toLowerCase();
        if (targetSyncTable === 'player') {
          activeEntry = recordRequest('player', gameState.player, 'savegame_sync');
          io.emit('table_updated', {
            table: 'player',
            timestamp: gameState.lastUpdated,
            summary: `${gameState.player.name} (${Number(gameState.player.credits || 0).toLocaleString()} Cr, Sector: ${gameState.player.sector})`,
            entry: activeEntry
          });
          notifyUpdateResolved('player', activeEntry);
        } else if (targetSyncTable === 'all') {
          const allData = gameEncyclopedia.blueprints;
          activeEntry = recordRequest('all', allData, 'savegame_sync');
          const owned = gameEncyclopedia.summary.owned;

          // Also refresh individual tables in cache and audit trail
          recordRequest('modules', gameEncyclopedia.modules, 'savegame_sync');
          recordRequest('ships', gameEncyclopedia.ships, 'savegame_sync');
          recordRequest('equipment', gameEncyclopedia.equipment, 'savegame_sync');
          recordRequest('blueprints', gameEncyclopedia.blueprints, 'savegame_sync');

          io.emit('table_updated', {
            table: 'all',
            timestamp: gameEncyclopedia.lastSynced,
            count: allData.length,
            summary: `${allData.length} items synced across all tables (${owned} owned)`,
            entry: activeEntry
          });
          notifyUpdateResolved('all', activeEntry);
          notifyUpdateResolved('blueprints', activeEntry);
          notifyUpdateResolved('modules', activeEntry);
          notifyUpdateResolved('ships', activeEntry);
          notifyUpdateResolved('equipment', activeEntry);
        } else {
          const targetData = gameEncyclopedia[targetSyncTable] || gameEncyclopedia.blueprints;
          activeEntry = recordRequest(targetSyncTable, targetData, 'savegame_sync');
          const owned = (gameEncyclopedia.summary[targetSyncTable] && typeof gameEncyclopedia.summary[targetSyncTable].owned === 'number')
            ? gameEncyclopedia.summary[targetSyncTable].owned
            : gameEncyclopedia.summary.owned;

          io.emit('table_updated', {
            table: targetSyncTable,
            timestamp: gameEncyclopedia.lastSynced,
            count: targetData.length,
            summary: `${targetData.length} ${targetSyncTable} synced (${owned} owned)`,
            entry: activeEntry
          });
          notifyUpdateResolved(targetSyncTable, activeEntry);
        }

        resolve({
          status: 'success',
          saveFile: path.basename(targetSave),
          totalUnlockedInSave: foundWares.size,
          waresFound: foundWares.size,
          newlyUnlocked,
          totalOwned: gameEncyclopedia.summary.owned,
          totalModulesOwned: gameEncyclopedia.summary.modules.owned,
          summary: gameEncyclopedia.summary,
          entry: activeEntry
        });
      });

      gunzip.on('error', (err) => {
        console.warn('Savegame decompression error:', err.message);
        resolve({ status: 'error', message: err.message });
      });
    } catch (e) {
      resolve({ status: 'error', message: e.message });
    }
  });
}

// Endpoint to trigger savegame blueprint sync on-demand
app.post('/api/sync-savegame', async (req, res) => {
  const result = await syncSavegameBlueprints(req.body?.path, req.body?.table);
  return res.status(200).json(result);
});

// Endpoint to save a generated blueprint XML directly to the constructionplan directory
app.post('/api/save-blueprint', (req, res) => {
  try {
    const { fileName, xmlContent } = req.body || {};
    if (!fileName || !xmlContent) {
      return res.status(400).json({ error: 'Missing fileName or xmlContent' });
    }
    const safeName = path.basename(fileName).endsWith('.xml') ? path.basename(fileName) : `${path.basename(fileName)}.xml`;
    const planDir = findConstructionPlanDir();
    if (planDir && fs.existsSync(planDir)) {
      const targetPath = path.join(planDir, safeName);
      fs.writeFileSync(targetPath, xmlContent, 'utf8');
      console.log(`💾 Saved blueprint XML directly to: ${targetPath}`);
      return res.status(200).json({ success: true, savedPath: targetPath });
    }
    return res.status(200).json({ success: false, reason: 'constructionplan directory not found on host' });
  } catch (err) {
    console.error('Error saving blueprint:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Handle incoming static database dumps
let pendingUpdateResolvers = [];

function notifyUpdateResolved(table, entry) {
  for (let i = pendingUpdateResolvers.length - 1; i >= 0; i--) {
    const r = pendingUpdateResolvers[i];
    if (r.table === table || (table === 'all' && ['blueprints', 'modules', 'ships', 'equipment', 'all'].includes(r.table))) {
      r.resolve(entry);
      pendingUpdateResolvers.splice(i, 1);
    }
  }
}

app.post('/api/encyclopedia', (req, res) => {
  recordLuaActivity();
  const { blueprints, modules, ships, equipment, table, ownedWares } = req.body || {};

  const incomingDlcs = (req.body && req.body.dlcs) ? normalizeDlcs(req.body.dlcs) : null;
  if (incomingDlcs) {
    gameState.dlcs = { ...gameState.dlcs, ...incomingDlcs };
    io.emit('dlcs_updated', gameState.dlcs);
  }

  // Support direct owned wares list sent from in-game Lua via C.GetBlueprints
  if (Array.isArray(ownedWares)) {
    const requestedTable = (table || 'all').toLowerCase();
    if (requestedTable === 'all' || requestedTable === 'blueprints') {
      for (const bp of gameEncyclopedia.blueprints) {
        bp.unlocked = false;
      }
    } else if (gameEncyclopedia[requestedTable]) {
      for (const bp of gameEncyclopedia[requestedTable]) {
        bp.unlocked = false;
      }
    }

    ownedWares.forEach(w => {
      let existing = gameEncyclopedia.blueprints.find(b => b.id === w || b.macro === w);
      if (!existing && w) {
        const cleanW = w.replace(/^module_/, '').replace(/_01$/, '').toLowerCase();
        existing = gameEncyclopedia.blueprints.find(b => {
          const cleanM = (b.macro || '').replace(/_macro$/, '').toLowerCase();
          const parts = cleanW.split('_');
          return parts.length >= 2 && parts.every(p => cleanM.includes(p));
        });
      }
      if (existing) {
        existing.unlocked = true;
      }
    });
  }

  if (Array.isArray(blueprints)) {
    // Merge or update incoming blueprints
    blueprints.forEach(incoming => {
      let existing = gameEncyclopedia.blueprints.find(b => b.id === incoming.id || b.macro === incoming.macro || b.macro === incoming.id || b.id === incoming.macro);
      if (!existing && incoming.id) {
        const cleanW = incoming.id.replace(/^module_/, '').replace(/_01$/, '').toLowerCase();
        existing = gameEncyclopedia.blueprints.find(b => {
          const cleanM = (b.macro || '').replace(/_macro$/, '').toLowerCase();
          const parts = cleanW.split('_');
          return parts.length >= 2 && parts.every(p => cleanM.includes(p));
        });
      }

      if (existing) {
        if (typeof incoming.unlocked === 'boolean') existing.unlocked = incoming.unlocked;
        if (incoming.hull) existing.hull = incoming.hull;
        if (incoming.production) existing.production = incoming.production;
      } else {
        gameEncyclopedia.blueprints.push(incoming);
      }
    });
  }

  gameEncyclopedia.modules = gameEncyclopedia.blueprints.filter(b => b.group === 'modules');
  gameEncyclopedia.ships = gameEncyclopedia.blueprints.filter(b => b.group === 'ships');
  gameEncyclopedia.equipment = gameEncyclopedia.blueprints.filter(b => b.group === 'equipment');
  gameEncyclopedia.summary = calculateCatalogSummary(gameEncyclopedia.blueprints);
  gameEncyclopedia.lastSynced = new Date().toISOString();

  const requestedTable = (table || 'modules').toLowerCase();
  const validTables = ['modules', 'ships', 'equipment', 'blueprints', 'all'];
  const targetTable = validTables.includes(requestedTable) ? requestedTable : 'modules';

  let targetData = gameEncyclopedia[targetTable] || gameEncyclopedia.blueprints;
  let ownedCount = 0;
  if (targetTable === 'all') {
    targetData = gameEncyclopedia.blueprints;
    ownedCount = gameEncyclopedia.summary.owned;
  } else {
    ownedCount = (gameEncyclopedia.summary[targetTable] && typeof gameEncyclopedia.summary[targetTable].owned === 'number')
      ? gameEncyclopedia.summary[targetTable].owned
      : gameEncyclopedia.summary.owned;
  }

  const targetEntry = recordRequest(targetTable, targetData, 'game_engine');
  const count = targetData.length;

  if (targetTable === 'all') {
    recordRequest('modules', gameEncyclopedia.modules, 'game_engine');
    recordRequest('ships', gameEncyclopedia.ships, 'game_engine');
    recordRequest('equipment', gameEncyclopedia.equipment, 'game_engine');
    recordRequest('blueprints', gameEncyclopedia.blueprints, 'game_engine');
  }

  console.log(`📚 Encyclopedia updated for [${targetTable}]! Count: ${count} (Owned: ${ownedCount})`);
  
  io.emit('encyclopedia_updated', gameEncyclopedia);
  io.emit('table_updated', {
    table: targetTable,
    timestamp: gameEncyclopedia.lastSynced,
    count,
    summary: `${count} ${targetTable} synced (${ownedCount} owned)`,
    entry: targetEntry
  });

  notifyUpdateResolved(targetTable, targetEntry);
  if (targetTable === 'all') {
    notifyUpdateResolved('blueprints', targetEntry);
    notifyUpdateResolved('modules', targetEntry);
    notifyUpdateResolved('ships', targetEntry);
    notifyUpdateResolved('equipment', targetEntry);
  }

  return res.status(200).json({ status: 'success', count: gameEncyclopedia.blueprints.length, summary: gameEncyclopedia.summary, entry: targetEntry });
});

function normalizeDlcs(raw = {}) {
  // If no incoming DLC object or it contains no keys, do not overwrite existing detected DLCs
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
    return null;
  }

  // Reject explicitly invalid or unverified payloads from engine fallback
  if (raw.valid === false || raw.method === 'none' || raw.source === 'none' || raw.source === 'unverified') {
    return null;
  }

  // Check if at least one alias key is provided in raw
  const allAliases = [
    'ego_dlc_split', 'split',
    'ego_dlc_cradle', 'ego_dlc_terran', 'cradle', 'terran',
    'ego_dlc_pirates', 'ego_dlc_pirate', 'pirates', 'pirate',
    'ego_dlc_boron', 'boron',
    'ego_dlc_timelines', 'timelines',
    'ego_dlc_par_update', 'ego_dlc_par', 'par_update', 'paranid_update', 'ego_dlc_paranid'
  ];
  const hasAnyKey = allAliases.some(a => raw[a] !== undefined && raw[a] !== null);
  if (!hasAnyKey) {
    return null;
  }

  const getDlcStatus = (aliases, defaultKey) => {
    let present = gameState?.dlcs?.[defaultKey]?.present || false;
    let active = gameState?.dlcs?.[defaultKey]?.active || false;
    let foundInPayload = false;

    for (const a of aliases) {
      const val = raw[a];
      if (val !== undefined && val !== null) {
        foundInPayload = true;
        if (typeof val === 'object') {
          if (val.present !== undefined) present = Boolean(val.present);
          if (val.active !== undefined) active = Boolean(val.active);
        } else if (typeof val === 'boolean') {
          active = val;
          present = val;
        } else if (val === 'present') {
          present = true;
          active = false;
        } else if (val === 'active') {
          active = true;
          present = true;
        } else if (val === 'inactive' || val === 'missing') {
          active = false;
          present = false;
        }
      }
    }

    return { active, present };
  };

  const candidate = {
    ego_dlc_split: getDlcStatus(['ego_dlc_split', 'split'], 'ego_dlc_split'),
    ego_dlc_cradle: getDlcStatus(['ego_dlc_cradle', 'ego_dlc_terran', 'cradle', 'terran'], 'ego_dlc_cradle'),
    ego_dlc_pirates: getDlcStatus(['ego_dlc_pirates', 'ego_dlc_pirate', 'pirates', 'pirate'], 'ego_dlc_pirates'),
    ego_dlc_boron: getDlcStatus(['ego_dlc_boron', 'boron'], 'ego_dlc_boron'),
    ego_dlc_timelines: getDlcStatus(['ego_dlc_timelines', 'timelines'], 'ego_dlc_timelines'),
    ego_dlc_par_update: getDlcStatus(['ego_dlc_par_update', 'ego_dlc_par', 'par_update', 'paranid_update', 'ego_dlc_paranid'], 'ego_dlc_par_update')
  };

  // Guard: If candidate reports zero active or present DLCs across all expansions,
  // but gameState.dlcs already has verified DLCs (from savegame or disk scan),
  // do NOT overwrite verified DLCs with an unverified all-false fallback payload!
  const candidateHasAny = Object.values(candidate).some(d => d.active || d.present);
  const existingHasAny = Object.values(gameState?.dlcs || {}).some(d => d.active || d.present);
  if (!candidateHasAny && existingHasAny) {
    if (raw.valid !== true && raw.source !== 'verified_game_engine') {
      return null;
    }
  }

  return candidate;
}

function detectInstalledDLCs() {
  const result = {
    ego_dlc_split: { active: false, present: false },
    ego_dlc_cradle: { active: false, present: false },
    ego_dlc_pirates: { active: false, present: false },
    ego_dlc_boron: { active: false, present: false },
    ego_dlc_timelines: { active: false, present: false },
    ego_dlc_par_update: { active: false, present: false }
  };

  const possibleExtensionsDirs = [
    'C:\\SteamLibrary\\steamapps\\common\\X4 Foundations\\extensions',
    'D:\\Games\\Steam\\steamapps\\common\\X4 Foundations\\extensions',
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'Documents', 'Egosoft', 'X4', 'extensions'),
    path.join(process.env.USERPROFILE || '', 'Documents', 'Egosoft', 'X4', 'extensions')
  ];

  for (const dir of possibleExtensionsDirs) {
    if (fs.existsSync(dir)) {
      try {
        const entries = fs.readdirSync(dir).map(e => e.toLowerCase());
        if (entries.includes('ego_dlc_split')) result.ego_dlc_split.present = true;
        if (entries.includes('ego_dlc_terran') || entries.includes('ego_dlc_cradle')) result.ego_dlc_cradle.present = true;
        if (entries.includes('ego_dlc_pirate') || entries.includes('ego_dlc_pirates')) result.ego_dlc_pirates.present = true;
        if (entries.includes('ego_dlc_boron')) result.ego_dlc_boron.present = true;
        if (entries.includes('ego_dlc_timelines')) result.ego_dlc_timelines.present = true;
        if (entries.includes('ego_dlc_par_update') || entries.includes('par_update')) result.ego_dlc_par_update.present = true;
      } catch (e) {}
    }
  }

  return result;
}

// Global state cache for your X4 Universe data
let gameState = {
  player: { name: "Unknown", credits: 0, sector: "Unknown" },
  ships: [],
  stations: [],
  dlcs: detectInstalledDLCs(),
  lastUpdated: null
};

// Global command queue for requests dispatched from Dashboard to in-game Lua mod
let commandQueue = [];
let lastLuaPoll = null;

function recordLuaActivity() {
  lastLuaPoll = new Date().toISOString();
}

function getLuaSecondsAgo() {
  const effectiveLastTime = lastLuaPoll || (gameState.lastUpdated && gameState.lastUpdated !== 'Never' ? gameState.lastUpdated : null);
  if (!effectiveLastTime) return null;
  return Math.max(0, Math.round((Date.now() - new Date(effectiveLastTime).getTime()) / 1000));
}

function isLuaActive() {
  const sec = getLuaSecondsAgo();
  return sec !== null && sec <= 15;
}

function queueCommand(action, table) {
  const targetAction = action || 'HARVEST_TABLE';
  const targetTable = table || 'blueprints';

  // Do not flood queue if identical command is already pending pickup
  const existing = commandQueue.find(c => c.action === targetAction && c.table === targetTable);
  if (existing) {
    return existing;
  }

  const command = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action: targetAction,
    table: targetTable,
    createdAt: new Date().toISOString()
  };
  commandQueue.push(command);
  console.log(`📡 Queued in-game command: [${command.action}] for table: [${command.table}] (ID: ${command.id})`);
  io.emit('command_queued', command);
  return command;
}

// Endpoint to request an on-demand update for a specific data table from the running game
app.post('/api/request-update', async (req, res) => {
  const { table, action } = req.body || {};
  const selectedTable = (table || 'blueprints').toLowerCase();

  // If game client is offline, skip the live queue timeout and immediately update via Savegame Sync
  if (!isLuaActive()) {
    if (selectedTable === 'dlcs') {
      const activeEntry = recordRequest('dlcs', gameState.dlcs, 'savegame_sync');
      return res.status(200).json({
        status: 'success',
        source: 'savegame_sync',
        entry: activeEntry,
        dlcs: gameState.dlcs,
        clientOffline: true,
        message: 'Game client offline. Loaded DLC inclusion from host/savegame.'
      });
    }

    console.log(`ℹ️ Game client is offline (no active Lua heartbeat). Updating [${selectedTable}] directly via Savegame Sync...`);
    const syncResult = await syncSavegameBlueprints(null, selectedTable);
    const targetData = (selectedTable === 'all' || selectedTable === 'blueprints')
      ? gameEncyclopedia.blueprints
      : (gameEncyclopedia[selectedTable] || gameEncyclopedia.blueprints);
    const activeEntry = syncResult?.entry || recordRequest(selectedTable, targetData, 'savegame_sync');

    return res.status(200).json({
      status: 'fallback_to_sync',
      source: 'savegame_sync',
      entry: activeEntry,
      dlcs: gameState.dlcs,
      clientOffline: true,
      message: `Game client offline. Synced [${selectedTable.toUpperCase()}] from savegame.`
    });
  }

  const command = queueCommand((selectedTable === 'dlcs') ? 'GET_EXTENSIONS' : (action || 'HARVEST_TABLE'), selectedTable);

  // Wait up to 8.0s for live in-game Lua/MD response
  const waitPromise = new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const idx = pendingUpdateResolvers.findIndex(r => r.table === selectedTable);
        if (idx !== -1) pendingUpdateResolvers.splice(idx, 1);
        resolve(null);
      }
    }, 8000);

    pendingUpdateResolvers.push({
      table: selectedTable,
      resolve: (entry) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(entry);
        }
      }
    });
  });

  const liveEntry = await waitPromise;
  if (liveEntry) {
    return res.status(200).json({ status: 'success', source: liveEntry.source, entry: liveEntry, dlcs: gameState.dlcs, command });
  }

  // If live engine didn't respond within 8s:
  console.log(`⚠️ In-game engine did not respond for [${selectedTable}] within 8s. Falling back to Savegame Sync...`);
  const syncResult = await syncSavegameBlueprints(null, selectedTable);
  const targetData = (selectedTable === 'all' || selectedTable === 'blueprints')
    ? gameEncyclopedia.blueprints
    : (gameEncyclopedia[selectedTable] || gameEncyclopedia.blueprints);
  const activeEntry = syncResult?.entry || recordRequest(selectedTable, targetData, 'savegame_sync');

  return res.status(200).json({
    status: 'fallback_to_sync',
    source: 'savegame_sync',
    entry: activeEntry,
    dlcs: gameState.dlcs,
    command
  });
});

let lastPlayerUpdateBroadcast = 0;
const PLAYER_BROADCAST_INTERVAL_MS = 3000;

// Endpoint for X4 mod to send a full state update
app.post('/api/update', (req, res) => {
  recordLuaActivity();
  const { player, ships, stations } = req.body;
  const now = Date.now();
  
  // Update internal memory state gracefully
  const incomingPlayer = player || {};
  let resolvedName = incomingPlayer.name;
  if (!resolvedName || resolvedName === 'Commander' || resolvedName === 'Unknown' || resolvedName.startsWith('cdata')) {
    if (gameState.player.name && gameState.player.name !== 'Unknown' && gameState.player.name !== 'Commander' && !gameState.player.name.startsWith('cdata')) {
      resolvedName = gameState.player.name;
    } else {
      resolvedName = (resolvedName && !resolvedName.startsWith('cdata')) ? resolvedName : 'Commander';
    }
  }

  let resolvedCredits = typeof incomingPlayer.credits === 'number' ? incomingPlayer.credits : gameState.player.credits;
  if ((resolvedCredits === 0 || isNaN(resolvedCredits)) && gameState.player.credits > 0) {
    resolvedCredits = gameState.player.credits;
  }

  let resolvedSector = incomingPlayer.sector;
  if (resolvedSector) {
    const fromMap = resolveSectorFromLocation(resolvedSector);
    if (fromMap) resolvedSector = fromMap;
  }
  if (!resolvedSector || resolvedSector === 'Unknown' || resolvedSector === 'Deep Space' || resolvedSector.startsWith('cdata')) {
    if (gameState.player.sector && gameState.player.sector !== 'Unknown' && gameState.player.sector !== 'Deep Space' && !gameState.player.sector.startsWith('cdata')) {
      resolvedSector = gameState.player.sector;
    } else {
      resolvedSector = (resolvedSector && !resolvedSector.startsWith('cdata')) ? resolvedSector : 'Deep Space';
    }
  }

  const previousSector = gameState.player?.sector;
  const sectorChanged = previousSector && resolvedSector && previousSector !== resolvedSector && resolvedSector !== 'Unknown' && resolvedSector !== 'Deep Space';
  if (sectorChanged) {
    console.log(`🌌 Player Sector changed: [${previousSector}] -> [${resolvedSector}]`);
  }

  const incomingDlcs = (req.body && req.body.dlcs) ? normalizeDlcs(req.body.dlcs) : null;
  if (incomingDlcs) {
    gameState.dlcs = { ...gameState.dlcs, ...incomingDlcs };
    io.emit('dlcs_updated', gameState.dlcs);
  }

  gameState = {
    player: {
      name: resolvedName,
      credits: resolvedCredits,
      sector: resolvedSector
    },
    ships: ships || gameState.ships,
    stations: stations || gameState.stations,
    dlcs: gameState.dlcs,
    lastUpdated: new Date().toISOString()
  };

  // Broadcast to UI and record audit history every 3 seconds (or immediately if sector changes or on-demand update is waiting)
  const hasPendingPlayerResolver = pendingUpdateResolvers.some(r => r.table === 'player' || r.table === 'all');
  if (sectorChanged || hasPendingPlayerResolver || (now - lastPlayerUpdateBroadcast >= PLAYER_BROADCAST_INTERVAL_MS)) {
    lastPlayerUpdateBroadcast = now;
    const entry = recordRequest('player', gameState.player, 'game_engine');

    io.emit('game_state_changed', gameState);
    io.emit('table_updated', {
      table: 'player',
      timestamp: gameState.lastUpdated,
      summary: `${gameState.player.name} (${Number(gameState.player.credits || 0).toLocaleString()} Cr, Sector: ${gameState.player.sector})`,
      entry
    });

    notifyUpdateResolved('player', entry);

    return res.status(200).json({ status: 'success', message: 'Data synced', entry });
  }

  return res.status(200).json({ status: 'throttled', message: 'Heartbeat received' });
});

// Endpoint for frontend to fetch DLC inclusion status
app.get('/api/dlcs', (req, res) => {
  return res.status(200).json(gameState.dlcs);
});

// Helper to verify whether a browser client is connected to the Companion Dashboard at :3000
let dlcBrowserCheckTimer = null;

function isSocketFromPort3000(socket) {
  const headers = socket?.handshake?.headers || {};
  const origin = String(headers.origin || '');
  const referer = String(headers.referer || '');
  const host = String(headers.host || '');
  if (origin.includes(':3000') || referer.includes(':3000')) {
    return true;
  }
  if (!origin && !referer && host.includes(':3000')) {
    return true;
  }
  return false;
}

function isPort3000BrowserOpen() {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.connected && isSocketFromPort3000(socket)) {
      return true;
    }
  }
  return false;
}

function checkPort3000BrowserAfterDlcUpdate() {
  if (dlcBrowserCheckTimer) {
    clearTimeout(dlcBrowserCheckTimer);
    dlcBrowserCheckTimer = null;
  }
  if (!isPort3000BrowserOpen()) {
    console.warn('⚠️ Warning: Browser connection to http://localhost:3000 (Companion Dashboard) is not open.');
  }
}

// Endpoint for in-game Lua to post active DLC status determined via GetExtensions()
app.post('/api/dlcs', (req, res) => {
  recordLuaActivity();
  const rawDlcs = req.body?.dlcs || req.body || {};
  if (req.body?.valid !== undefined) rawDlcs.valid = req.body.valid;
  if (req.body?.method !== undefined) rawDlcs.method = req.body.method;
  if (req.body?.source !== undefined) rawDlcs.source = req.body.source;
  const incomingDlcs = normalizeDlcs(rawDlcs);
  const requestTable = req.body?.requestTable || 'request';
  if (incomingDlcs) {
    console.log(`🎮 [X4-LUA] Active DLCs determined via GetExtensions() for current request [${requestTable}]:`, incomingDlcs);
    gameState.dlcs = { ...gameState.dlcs, ...incomingDlcs };
    gameState.lastUpdated = new Date().toISOString();

    const entry = recordRequest('dlcs', gameState.dlcs, 'game_engine');
    io.emit('dlcs_updated', gameState.dlcs);
    io.emit('table_updated', {
      table: 'dlcs',
      timestamp: gameState.lastUpdated,
      summary: `Active DLCs updated via in-game GetExtensions() for [${requestTable.toUpperCase()}]`,
      entry
    });
    notifyUpdateResolved('dlcs', entry);

    if (dlcBrowserCheckTimer) clearTimeout(dlcBrowserCheckTimer);
    dlcBrowserCheckTimer = setTimeout(checkPort3000BrowserAfterDlcUpdate, 250);

    return res.status(200).json({ status: 'success', dlcs: gameState.dlcs, entry });
  }

  const hasPendingResolver = pendingUpdateResolvers.some(r => r.table === 'dlcs');
  if (hasPendingResolver) {
    const entry = recordRequest('dlcs', gameState.dlcs, 'cached_fallback');
    notifyUpdateResolved('dlcs', entry);
    return res.status(200).json({ status: 'unverified_retained', dlcs: gameState.dlcs, entry });
  }

  return res.status(200).json({ status: 'retained', dlcs: gameState.dlcs });
});

// Dedicated isolated GetExtensions() API query endpoint - fully separated from global table retrieval
app.all(['/api/dlcs/query', '/api/request-dlcs'], async (req, res) => {
  console.log('📡 [API] Dedicated isolated DLCs / GetExtensions() query triggered');
  if (!isLuaActive()) {
    const entry = recordRequest('dlcs', gameState.dlcs, 'savegame_sync');
    io.emit('dlcs_updated', gameState.dlcs);
    return res.status(200).json({
      status: 'offline',
      source: 'savegame_sync',
      dlcs: gameState.dlcs,
      entry,
      message: 'Game client offline. Returned host/savegame DLC inclusion status.'
    });
  }

  const command = queueCommand('GET_EXTENSIONS', 'dlcs');

  // Wait up to 5.0s for in-game GetExtensions() response via POST /api/dlcs
  const waitPromise = new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const idx = pendingUpdateResolvers.findIndex(r => r.table === 'dlcs');
        if (idx !== -1) pendingUpdateResolvers.splice(idx, 1);
        resolve(null);
      }
    }, 5000);

    pendingUpdateResolvers.push({
      table: 'dlcs',
      resolve: (entry) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(entry);
        }
      }
    });
  });

  const liveEntry = await waitPromise;
  if (liveEntry) {
    return res.status(200).json({
      status: 'success',
      source: 'GetExtensions',
      dlcs: gameState.dlcs,
      entry: liveEntry,
      command
    });
  }

  // If live engine timed out, fall back cleanly to current state
  const fallbackEntry = recordRequest('dlcs', gameState.dlcs, 'timeout_fallback');
  return res.status(200).json({
    status: 'timeout',
    source: 'cached_fallback',
    dlcs: gameState.dlcs,
    entry: fallbackEntry,
    command,
    message: 'In-game bridge did not respond within 5s. Returned cached DLC status.'
  });
});

// In-game Lua diagnostic logging buffer
let luaDebugLogs = [];
app.post('/api/debug-log', (req, res) => {
  recordLuaActivity();
  const { message } = req.body || {};
  const entry = { timestamp: new Date().toISOString(), message: message || JSON.stringify(req.body) };
  luaDebugLogs.unshift(entry);
  if (luaDebugLogs.length > 100) luaDebugLogs.pop();
  console.log(`🎮 [X4-LUA] ${entry.message}`);
  if (typeof entry.message === 'string' && entry.message.includes('Successfully transmitted isolated GetExtensions() DLC status')) {
    checkPort3000BrowserAfterDlcUpdate();
  }
  return res.status(200).json({ status: 'ok' });
});

app.get('/api/debug-log', (req, res) => {
  return res.status(200).json({ logs: luaDebugLogs });
});

// Endpoint called by X4 Lua bridge when MD detects <event_game_loaded/>
app.post('/api/game-loaded', async (req, res) => {
  recordLuaActivity();
  console.log('🔄 [X4-MD] <event_game_loaded/> detected! Syncing savegame and notifying UI to reload...');

  try {
    const syncResult = await syncSavegameBlueprints(null, 'all');
    console.log(`📦 Savegame re-synced on game_loaded: ${syncResult?.totalOwned || 0} owned blueprints.`);
  } catch (err) {
    console.warn('⚠️ Error re-syncing savegame on game_loaded:', err.message);
  }

  // Queue fresh harvest command for all tables so Lua retrieves live engine tables
  queueCommand('HARVEST_TABLE', 'all');

  const eventPayload = {
    timestamp: new Date().toISOString(),
    event: 'game_loaded',
    message: 'Game load detected by Mission Director'
  };

  io.emit('encyclopedia_updated', gameEncyclopedia);
  io.emit('game_loaded', eventPayload);
  io.emit('reload_ui', eventPayload);

  return res.status(200).json({
    status: 'success',
    message: 'game_loaded processed and UI reload broadcasted',
    timestamp: eventPayload.timestamp
  });
});

// Endpoint to trigger UI reload
app.post('/api/reload-ui', (req, res) => {
  const eventPayload = {
    timestamp: new Date().toISOString(),
    event: 'reload_ui',
    message: 'UI reload requested'
  };
  io.emit('reload_ui', eventPayload);
  return res.status(200).json({ status: 'success', message: 'reload_ui broadcasted', timestamp: eventPayload.timestamp });
});

// Endpoint for frontend to fetch full current game state
app.get('/api/state', (req, res) => {
  return res.status(200).json(gameState);
});

// Endpoint for frontend to fetch player telemetry
app.get('/api/live/player', (req, res) => {
  return res.status(200).json({ player: gameState.player, lastUpdated: gameState.lastUpdated });
});

// Endpoint for X4 mod to poll for commands/actions sent from the dashboard
app.get('/api/commands', (req, res) => {
  recordLuaActivity();
  const pendingCommands = commandQueue.splice(0);
  if (pendingCommands.length > 0) {
    console.log(`📤 Dispatched ${pendingCommands.length} command(s) to in-game Lua client:`, pendingCommands.map(c => `${c.action}:${c.table}`));
  }
  return res.status(200).json({ commands: pendingCommands });
});

// Endpoint to inspect X4 display configuration (borderless vs fullscreen)
app.get('/api/display-config', (req, res) => {
  return res.status(200).json(getX4DisplayConfig());
});

// Endpoint for dashboard to inspect in-game polling heartbeat and connection health
app.get('/api/poll-status', (req, res) => {
  const luaSecondsAgo = getLuaSecondsAgo();
  const effectiveLastTime = lastLuaPoll || (gameState.lastUpdated && gameState.lastUpdated !== 'Never' ? gameState.lastUpdated : null);
  return res.status(200).json({
    serverOnline: true,
    lastLuaPoll: effectiveLastTime,
    luaSecondsAgo,
    luaActive: isLuaActive(),
    pendingCommands: commandQueue.length,
    lastEncyclopediaSync: gameEncyclopedia.lastSynced,
    lastPlayerSync: gameState.lastUpdated,
    displayConfig: getX4DisplayConfig()
  });
});


// --- DASHBOARD WEBSOCKET MANAGEMENT ---
let dashboardDisconnectCount = 0;

io.on('connection', (socket) => {
  console.log(`🔌 Dashboard UI connected: ${socket.id}`);
  
  // Push the current state to the dashboard immediately upon connection
  socket.emit('game_state_changed', gameState);
  socket.emit('encyclopedia_updated', gameEncyclopedia);

  // Allow dashboard to issue on-demand update requests via WebSocket
  socket.on('request_table_update', (data) => {
    const table = data?.table || 'blueprints';
    const action = data?.action || 'HARVEST_TABLE';
    queueCommand(action, table);
  });

  socket.on('disconnect', () => {
    dashboardDisconnectCount++;
    console.log(`❌ Companion Dashboard UI disconnected: ${socket.id}`);
    if (dashboardDisconnectCount >= 2 && !isLuaActive()) {
      console.log(`⏳ Waiting for X4 to come online. Borderless Window helps keep connection alive.`);
    }
  });
});

// Start the server bound strictly to localhost:3000
httpServer.listen(PORT, async () => {
  console.log(`🚀 X4 Node Server running strictly on localhost:${PORT} (127.0.0.1 & [::1])`);
  console.log(`📥 In-game LUA client should POST data to http://localhost:${PORT}/api/update`);
  await syncSavegameBlueprints();
});
