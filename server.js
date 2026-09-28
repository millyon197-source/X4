import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" } // Allows dashboard connections from anywhere during dev
});

// Middleware to parse incoming JSON payloads from your X4 LUA client
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static dashboard files from a "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Global memory store for static game definitions
let gameEncyclopedia = {
  blueprints: [],
  lastSynced: null
};

// Handle incoming static database dumps
app.post('/api/encyclopedia', (req, res) => {
  const { blueprints } = req.body || {};

  gameEncyclopedia = {
    blueprints: blueprints || [],
    lastSynced: new Date().toISOString()
  };

  console.log(`📚 Encyclopedia/Blueprints updated! Loaded ${gameEncyclopedia.blueprints.length} components.`);
  
  // Broadcast update if clients want to know encyclopedia refreshed
  io.emit('encyclopedia_updated', gameEncyclopedia);
  io.emit('table_updated', {
    table: 'blueprints',
    timestamp: gameEncyclopedia.lastSynced,
    count: gameEncyclopedia.blueprints.length,
    summary: `${gameEncyclopedia.blueprints.length} modules loaded`
  });

  return res.status(200).json({ status: 'success', count: gameEncyclopedia.blueprints.length });
});

// Endpoint to fetch current encyclopedia
app.get('/api/encyclopedia', (req, res) => {
  return res.status(200).json(gameEncyclopedia);
});

// Global state cache for your X4 Universe data
let gameState = {
  player: { name: "Unknown", credits: 0, sector: "Unknown" },
  ships: [],
  stations: [],
  lastUpdated: null
};

// Global command queue for requests dispatched from Dashboard to in-game Lua mod
let commandQueue = [];

function queueCommand(action, table) {
  const command = {
    id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action: action || 'HARVEST_TABLE',
    table: table || 'blueprints',
    createdAt: new Date().toISOString()
  };
  commandQueue.push(command);
  console.log(`📡 Queued in-game command: [${command.action}] for table: [${command.table}] (ID: ${command.id})`);
  io.emit('command_queued', command);
  return command;
}

// Endpoint to request an on-demand update for a specific data table
app.post('/api/request-update', (req, res) => {
  const { table, action } = req.body || {};
  const selectedTable = table || 'blueprints';
  const command = queueCommand(action || 'HARVEST_TABLE', selectedTable);
  return res.status(200).json({ status: 'queued', command });
});

// Endpoint for X4 mod to send a full state update
app.post('/api/update', (req, res) => {
  const { player, ships, stations } = req.body;
  
  // Update internal memory state
  gameState = {
    player: player || gameState.player,
    ships: ships || gameState.ships,
    stations: stations || gameState.stations,
    lastUpdated: new Date().toISOString()
  };

  // Broadcast fresh game data immediately to all connected UI clients
  io.emit('game_state_changed', gameState);
  io.emit('table_updated', {
    table: 'player',
    timestamp: gameState.lastUpdated,
    summary: `${gameState.player.name} (${Number(gameState.player.credits || 0).toLocaleString()} Cr)`
  });

  return res.status(200).json({ status: 'success', message: 'Data synced' });
});

// Endpoint for X4 mod to poll for commands/actions sent from the dashboard
app.get('/api/commands', (req, res) => {
  const pendingCommands = commandQueue.splice(0);
  if (pendingCommands.length > 0) {
    console.log(`📤 Dispatched ${pendingCommands.length} command(s) to in-game Lua client:`, pendingCommands.map(c => `${c.action}:${c.table}`));
  }
  return res.status(200).json({ commands: pendingCommands });
});


// --- DASHBOARD WEBSOCKET MANAGEMENT ---

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
    console.log(`❌ Dashboard UI disconnected: ${socket.id}`);
  });
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`🚀 X4 Node Server running at http://localhost:${PORT}`);
  console.log(`📥 In-game LUA client should POST data to http://localhost:${PORT}/api/update`);
});
