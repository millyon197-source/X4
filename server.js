import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 8080;
const X4_API_URL = 'http://localhost:3000';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve a static front-end folder (we will make this next)
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint for player data
app.get('/api/live/player', async (req, res) => {
    try {
        const response = await axios.get(`${X4_API_URL}/api/player`, { timeout: 1500 });
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ error: 'X4 instance not responding' });
    }
});

// Proxy endpoint for encyclopedia data
app.get('/api/live/encyclopedia', async (req, res) => {
    try {
        const response = await axios.get(`${X4_API_URL}/api/encyclopedia`, { timeout: 3000 });
        res.json(response.data);
    } catch (error) {
        res.status(503).json({ error: 'Failed to fetch encyclopedia' });
    }
});

app.listen(PORT, () => {
    console.log(`[+] Dashboard server running at http://localhost:${PORT}`);
});
