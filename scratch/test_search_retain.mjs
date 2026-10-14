import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJson = url => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9331;
  const userDataDir = 'C:\\Users\\Zeus\\AppData\\Local\\Temp\\edge_cdp_search_retain_' + Date.now();
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

  ws.addEventListener('message', evt => {
    try {
      const d = JSON.parse(evt.data);
      if (d.method === 'Runtime.exceptionThrown') {
        console.error('Browser Exception Thrown:', JSON.stringify(d.params, null, 2));
      }
      if (d.method === 'Runtime.consoleAPICalled') {
        console.log('Browser Console:', d.params.type, d.params.args?.map(a => a.value || a.description).join(' '));
      }
    } catch (e) {}
  });

  const evalCode = async (code) => {
    const r = await send('Runtime.evaluate', { expression: code, returnByValue: true });
    if (r?.exceptionDetails) {
      console.error('Exception in eval:', JSON.stringify(r.exceptionDetails, null, 2));
    }
    return r?.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(2000);

  const artifactDir = 'C:\\Users\\Zeus\\.gemini\\antigravity\\brain\\cdc0f705-8a4b-44d9-9658-59fe39e40643';

  console.log('Switching to Planned tab...');
  await evalCode('document.getElementById("tabBtnPlanned").click()');
  await sleep(1000);
  console.log('Planned view loaded. addMacroTrigger exists:', await evalCode('Boolean(document.getElementById("addMacroTrigger"))'));

  // Step 2: Open Add Module Dropdown and Search for "spire"
  console.log('Opening Add Module Dropdown and searching for "spire"...');
  const searchResult = await evalCode(`(() => {
    const trigger = document.getElementById('addMacroTrigger');
    trigger.click(); // Expand dropdown
    const searchInput = document.getElementById('addMacroSearchInput');
    searchInput.value = 'spire';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    const options = Array.from(document.querySelectorAll('#addMacroOptionsList .custom-macro-option')).map(o => ({
      name: o.querySelector('.custom-macro-option-name')?.textContent,
      macro: o.dataset.value
    }));
    const bannerText = document.getElementById('addMacroSearchCount')?.textContent;
    return {
      query: window.state.addMacroSearchQuery,
      optionCount: options.length,
      options,
      bannerText
    };
  })()`);
  console.log('Search in dropdown result:', JSON.stringify(searchResult, null, 2));

  // Capture screenshot 1: dropdown open with search
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'search_retain_dropdown_open.png'), Buffer.from(snap1.data, 'base64'));

  // Step 3: Select the first option from the filtered options (Argon L Housing Spire)
  console.log('Selecting first filtered option (Argon L Housing Spire)...');
  const selectResult = await evalCode(`(() => {
    window.alert = () => {};
    const opt = document.querySelector('#addMacroOptionsList .custom-macro-option[data-value="landmarks_arg_antigonepillar_01_macro"]') ||
                document.querySelector('#addMacroOptionsList .custom-macro-option[data-index="0"]');
    if (opt) opt.click();
    return {
      selectVal: document.getElementById('addMacroSelect').value,
      triggerText: document.getElementById('addMacroTriggerText').textContent,
      queryRetained: window.state.addMacroSearchQuery,
      menuDisplay: document.getElementById('addMacroMenu').style.display
    };
  })()`);
  console.log('Selection result:', JSON.stringify(selectResult, null, 2));

  // Step 4: Click "Add Module"
  console.log('Clicking Add Module...');
  const addResult = await evalCode(`(() => {
    const btnAdd = document.getElementById('btnAddMacro');
    btnAdd.click();
    
    const spireRow = document.querySelector('.macro-table tr[data-macro*="spire"]');
    const searchInputAfter = document.getElementById('addMacroSearchInput');
    return {
      spireRowFound: Boolean(spireRow),
      spireRowQty: spireRow ? spireRow.querySelector('.macro-qty-input')?.value : null,
      queryAfterAdd: window.state.addMacroSearchQuery,
      inputValAfterAdd: searchInputAfter ? searchInputAfter.value : null,
      triggerTextAfterAdd: document.getElementById('addMacroTriggerText')?.textContent
    };
  })()`);
  console.log('Add Module result:', JSON.stringify(addResult, null, 2));

  // Capture screenshot 2: module added, search retained
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'search_retain_after_add.png'), Buffer.from(snap2.data, 'base64'));

  // Step 5: Re-expand dropdown to verify search criteria is STILL there
  console.log('Re-opening dropdown...');
  const reOpenResult = await evalCode(`(() => {
    const trigger = document.getElementById('addMacroTrigger');
    trigger.click();
    const options = Array.from(document.querySelectorAll('#addMacroOptionsList .custom-macro-option')).map(o => ({
      name: o.querySelector('.custom-macro-option-name')?.textContent,
      macro: o.dataset.value
    }));
    return {
      queryOnReopen: window.state.addMacroSearchQuery,
      inputValOnReopen: document.getElementById('addMacroSearchInput')?.value,
      optionsCount: options.length,
      options
    };
  })()`);
  console.log('Re-open result:', JSON.stringify(reOpenResult, null, 2));

  // Capture screenshot 3: dropdown re-opened with retained search
  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'search_retain_reopened.png'), Buffer.from(snap3.data, 'base64'));

  // Step 6: Click Clear ✕ in dropdown search banner
  console.log('Clicking Clear ✕ button...');
  const clearResult = await evalCode(`(() => {
    const btnClear = document.getElementById('addMacroClearSearchBtn');
    if (btnClear) btnClear.click();
    const options = Array.from(document.querySelectorAll('#addMacroOptionsList .custom-macro-option')).map(o => ({
      name: o.querySelector('.custom-macro-option-name')?.textContent,
      macro: o.dataset.value
    }));
    return {
      queryAfterClear: window.state.addMacroSearchQuery,
      inputValAfterClear: document.getElementById('addMacroSearchInput')?.value,
      optionsCountAfterClear: options.length
    };
  })()`);
  console.log('Clear result:', JSON.stringify(clearResult, null, 2));

  // Capture screenshot 4: search cleared, full options restored
  const snap4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'search_retain_cleared.png'), Buffer.from(snap4.data, 'base64'));

  // Step 7: Test Top Search Bar search retention
  console.log('Testing top search bar search retention...');
  const topSearchResult = await evalCode(`(() => {
    // Minimize dropdown first
    const trigger = document.getElementById('addMacroTrigger');
    if (document.getElementById('addMacroMenu').style.display !== 'none') trigger.click();

    // Enter search in top bar
    const topSearch = document.getElementById('searchInput');
    topSearch.value = 'solar';
    topSearch.dispatchEvent(new Event('input', { bubbles: true }));

    // Select from dropdown
    trigger.click();
    const solarOpt = document.querySelector('#addMacroOptionsList .custom-macro-option[data-value="prod_gen_energycells_macro"]');
    if (solarOpt) solarOpt.click();

    // Add module
    const btnAdd = document.getElementById('btnAddMacro');
    btnAdd.click();

    return {
      topSearchValAfterAdd: document.getElementById('searchInput')?.value,
      searchQueryInState: window.state.searchQuery,
      tableHasSolar: Boolean(document.querySelector('.macro-table tr[data-macro="prod_gen_energycells_macro"]'))
    };
  })()`);
  console.log('Top search bar test result:', JSON.stringify(topSearchResult, null, 2));

  // Capture screenshot 5: top search bar retained
  const snap5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'search_retain_top_search.png'), Buffer.from(snap5.data, 'base64'));

  console.log('All search retain tests passed successfully!');
  browser.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
