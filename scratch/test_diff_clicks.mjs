import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJson = url => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9327;
  const userDataDir = 'C:\\Users\\Zeus\\AppData\\Local\\Temp\\edge_cdp_diff_clean_' + Date.now();
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
  await sleep(1500);

  const artifactDir = 'C:\\Users\\Zeus\\.gemini\\antigravity\\brain\\cdc0f705-8a4b-44d9-9658-59fe39e40643';

  // 1. Setup station with 10x Hull Parts
  console.log('1. Setting up station with 10x Hull Parts...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.state.activeBlueprint = {
        name: 'Test Hull Parts Station',
        totalModules: 10,
        modules: { 'HullParts': 10 },
        rawMacros: { 'prod_gen_hullparts_macro': 10 }
      };
      window.state.selectedWareId = null;
      window.state.moduleDiffCollapsed = false;
      window.state.workforceSummaryCollapsed = true;
      window.state.rawMiningCollapsed = true;
      window.calculateFactoryRequirements();
      window.renderApp();

      const diffPanel = document.querySelector('.bp-diff-panel');
      if (diffPanel) {
        diffPanel.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    })()`
  });
  await sleep(600);

  // 2. Verify that there are NO plus or minus selector buttons
  const selectorCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = document.querySelectorAll('.bp-diff-btn, .bp-diff-btn-minus, .bp-diff-btn-plus');
      const items = Array.from(document.querySelectorAll('.bp-diff-item')).map(item => ({
        ware: item.dataset.ware,
        delta: item.dataset.delta,
        text: item.textContent.trim()
      }));
      return {
        selectorButtonsCount: buttons.length,
        itemsCount: items.length,
        items
      };
    })()`,
    returnByValue: true
  });

  console.log('2. Selector buttons check (must be 0):', selectorCheck.result.value.selectorButtonsCount);
  console.log('2. Clickable diff items count:', selectorCheck.result.value.itemsCount);
  console.log('2. Sample diff items:', selectorCheck.result.value.items);

  if (selectorCheck.result.value.selectorButtonsCount !== 0) {
    throw new Error('Expected 0 plus/minus selector buttons!');
  }
  if (selectorCheck.result.value.itemsCount === 0) {
    throw new Error('Expected diff items to be rendered!');
  }

  // Capture screenshot of clean text-based clickable diff items
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'diff_text_items_showcase.png'), Buffer.from(snap1.data, 'base64'));

  // 3. Test clicking a PLUS difference (e.g. Graphene)
  const plusItem = selectorCheck.result.value.items.find(i => parseInt(i.delta) > 0);
  console.log('3. Clicking PLUS item:', plusItem);
  const plusWare = plusItem.ware;
  const plusDelta = parseInt(plusItem.delta);

  const initialPlusPlan = await send('Runtime.evaluate', {
    expression: `(window.state.activeBlueprint.modules && window.state.activeBlueprint.modules['${plusWare}']) || 0`,
    returnByValue: true
  });

  await send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.querySelector('.bp-diff-item[data-ware="${plusWare}"]');
      item.click();
    })()`
  });
  await sleep(600);

  const afterPlusPlan = await send('Runtime.evaluate', {
    expression: `(window.state.activeBlueprint.modules && window.state.activeBlueprint.modules['${plusWare}']) || 0`,
    returnByValue: true
  });
  console.log(`3. Plan count for ${plusWare}: initial ${initialPlusPlan.result.value} -> after click ${afterPlusPlan.result.value}`);

  if (afterPlusPlan.result.value !== initialPlusPlan.result.value + plusDelta) {
    throw new Error(`Expected count for ${plusWare} to increase by ${plusDelta}`);
  }

  // 4. Test clicking a MINUS difference (surplus ware where plan exceeds needs)
  // Refined Metals needs 6x. Let's set Refined Metals plan to 10x!
  console.log('4. Setting up surplus Refined Metals (plan: 10, needs: 6)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.state.activeBlueprint.modules['RefMet'] = 10;
      window.state.activeBlueprint.rawMacros['prod_gen_refinedmetals_macro'] = 10;
      window.calculateFactoryRequirements();
      window.renderApp();
    })()`
  });
  await sleep(600);

  const minusItem = await send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.querySelector('.bp-diff-item[data-ware="RefMet"]');
      if (!item) return null;
      return {
        ware: item.dataset.ware,
        delta: item.dataset.delta,
        text: item.textContent.trim()
      };
    })()`,
    returnByValue: true
  });
  console.log('4. Minus item found:', minusItem.result.value);

  if (!minusItem.result.value || parseInt(minusItem.result.value.delta) >= 0) {
    throw new Error('Expected negative delta on surplus RefMet');
  }

  const minusDelta = parseInt(minusItem.result.value.delta);
  console.log(`4. Clicking minus item (${minusDelta}x)...`);

  await send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.querySelector('.bp-diff-item[data-ware="RefMet"]');
      item.click();
    })()`
  });
  await sleep(600);

  const afterMinusPlan = await send('Runtime.evaluate', {
    expression: `window.state.activeBlueprint.modules['RefMet']`,
    returnByValue: true
  });
  console.log(`4. Plan count for RefMet after minus click: ${afterMinusPlan.result.value} (reduced by ${Math.abs(minusDelta)})`);

  if (afterMinusPlan.result.value !== 10 + minusDelta) {
    throw new Error(`Expected RefMet plan count to be ${10 + minusDelta}, got ${afterMinusPlan.result.value}`);
  }

  // Take final screenshot
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'diff_text_items_after_click.png'), Buffer.from(snap2.data, 'base64'));

  console.log('ALL TESTS PASSED SUCCESSFULLY! No selectors, cleanly updates plus or minus as shown within text.');
  browser.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
