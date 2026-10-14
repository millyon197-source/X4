import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJson = url => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9325;
  const userDataDir = 'C:\\Users\\Zeus\\AppData\\Local\\Temp\\edge_cdp_diff_snap3_' + Date.now();
  const browser = spawn(edgePath, [
    '--remote-debugging-port=' + cdpPort,
    '--headless=new',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
    '--window-size=1600,1050',
    'http://localhost:5173/X4/'
  ]);

  let version = null;
  for (let i = 0; i < 30; i++) {
    try {
      version = await getJson('http://127.0.0.1:' + cdpPort + '/json/version');
      if (version && version.webSocketDebuggerUrl) break;
    } catch (e) {}
    await sleep(200);
  }

  const list = await getJson('http://127.0.0.1:' + cdpPort + '/json/list');
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (m, p = {}) => new Promise(res => {
    const curId = id++;
    const handler = evt => {
      const d = JSON.parse(evt.data);
      if (d.id === curId) { ws.removeEventListener('message', handler); res(d.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method: m, params: p }));
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(2000);

  const artifactDir = 'C:\\Users\\Zeus\\.gemini\\antigravity\\brain\\cdc0f705-8a4b-44d9-9658-59fe39e40643';

  // Ensure Plan vs Needs Module Differences is scrolled into view in insBody
  await send('Runtime.evaluate', {
    expression: `(() => {
      const diffPanel = document.querySelector('.bp-diff-panel');
      const insBody = document.getElementById('insBody');
      if (diffPanel && insBody) {
        // Uncollapse if collapsed
        if (state.moduleDiffCollapsed) {
          const header = diffPanel.querySelector('.bp-diff-header');
          if (header) header.click();
        }
        diffPanel.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    })()`
  });
  await sleep(800);

  // Take screenshot
  const snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'diff_chips_panel_showcase.png'), Buffer.from(snap.data, 'base64'));

  console.log('Showcase screenshot saved successfully!');
  browser.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
