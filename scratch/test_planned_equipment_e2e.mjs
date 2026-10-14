import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJson = url => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const cdpPort = 9332;
  const userDataDir = 'C:\\Users\\Zeus\\AppData\\Local\\Temp\\edge_cdp_equip_test_' + Date.now();
  const browser = spawn(edgePath, [
    '--remote-debugging-port=' + cdpPort,
    '--headless=new',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
    '--window-size=1600,1050',
    'http://localhost:5173/X4/'
  ]);

  try {
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

    const evalCode = async (code) => {
      const r = await send('Runtime.evaluate', { expression: code, returnByValue: true, awaitPromise: true });
      if (r?.exceptionDetails) {
        console.error('Exception in eval:', JSON.stringify(r.exceptionDetails, null, 2));
      }
      return r?.result?.value;
    };

    ws.addEventListener('message', evt => {
      try {
        const d = JSON.parse(evt.data);
        if (d.method === 'Page.javascriptDialogOpening') {
          console.log('Dialog auto-handled:', d.params.message);
          send('Page.handleJavaScriptDialog', { accept: true });
        }
      } catch (e) {}
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(2000);

    console.log('--- Initial page loaded ---');

    // 1. Inject sample blueprint with upgrades
    const loadResult = await evalCode(`(() => {
      const xml = \`<?xml version="1.0" encoding="utf-8"?>
<plans>
  <plan id="test_defense_complex" name="Defense Complex">
    <entry index="1" macro="defense_arg_disc_01_macro">
      <offset>
        <position x="0" y="0" z="0"/>
      </offset>
      <upgrades>
        <groups>
          <shields macro="shield_arg_m_standard_02_mk2_macro" group="group01" exact="6"/>
          <turrets macro="turret_arg_m_flak_02_mk1_macro" group="group01" exact="12"/>
        </groups>
      </upgrades>
    </entry>
    <entry index="2" macro="prod_gen_energycells_macro">
      <offset>
        <position x="500" y="0" z="0"/>
      </offset>
    </entry>
  </plan>
</plans>\`;

      window.readAndParseBlueprintFile ? null : null;
      // Use internal parser via window or import
      const file = new File([xml], "defense_complex.xml", { type: "text/xml" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('xmlFileInput');
      if (input) {
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { loadedViaInput: true };
      }
      return { loadedViaInput: false };
    })()`);

    console.log('Blueprint file input trigger:', loadResult);
    await sleep(1500);

    // 2. Switch to Planned Modules Tab
    await evalCode(`(() => {
      const tabBtn = document.getElementById('tabBtnPlanned');
      if (tabBtn) tabBtn.click();
    })()`);
    await sleep(1000);

    // 3. Inspect Planned Modules rows
    const plannedRows = await evalCode(`(() => {
      const rows = Array.from(document.querySelectorAll('.macro-row'));
      return rows.map(r => {
        const macro = r.dataset.macro;
        const name = r.querySelector('.macro-name')?.textContent?.trim();
        const input = r.querySelector('.macro-qty-input');
        const qty = input ? parseInt(input.value, 10) : null;
        return { macro, name, qty };
      });
    })()`);

    console.log('Planned Modules rows in UI:', plannedRows);
    const turretRow = plannedRows.find(r => r.macro === 'turret_arg_m_flak_02_mk1_macro');
    const shieldRow = plannedRows.find(r => r.macro === 'shield_arg_m_standard_02_mk2_macro');

    if (!turretRow || turretRow.qty !== 12) {
      throw new Error(`Expected 12 turrets in UI, got: ${JSON.stringify(turretRow)}`);
    }
    if (!shieldRow || shieldRow.qty !== 6) {
      throw new Error(`Expected 6 shields in UI, got: ${JSON.stringify(shieldRow)}`);
    }
    console.log('✓ Equipment rows successfully rendered in Planned Modules UI!');

    // 4. Test modifying turret quantity via decrement button
    console.log('--- Testing decrement button on turret row ---');
    const decResult = await evalCode(`(() => {
      const decBtn = document.querySelector('.btn-macro-dec[data-macro="turret_arg_m_flak_02_mk1_macro"]');
      if (!decBtn) return { error: 'No dec button found' };
      decBtn.click();
      const input = document.querySelector('.macro-qty-input[data-macro="turret_arg_m_flak_02_mk1_macro"]');
      return { newQty: input ? parseInt(input.value, 10) : null };
    })()`);
    console.log('After decrement click:', decResult);
    if (decResult.newQty !== 11) {
      throw new Error(`Expected turret count 11 after decrement, got ${decResult.newQty}`);
    }
    console.log('✓ Turret count decremented cleanly to 11 and preserved!');

    // 5. Test direct quantity input modification
    console.log('--- Testing direct quantity input on turret row (set to 8) ---');
    const directInputResult = await evalCode(`(() => {
      const input = document.querySelector('.macro-qty-input[data-macro="turret_arg_m_flak_02_mk1_macro"]');
      if (!input) return { error: 'No input found' };
      input.value = '8';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { val: input.value };
    })()`);
    await sleep(500);
    const qtyAfterInput = await evalCode(`(() => {
      const input = document.querySelector('.macro-qty-input[data-macro="turret_arg_m_flak_02_mk1_macro"]');
      return input ? parseInt(input.value, 10) : null;
    })()`);
    console.log('Turret count after direct input edit:', qtyAfterInput);
    if (qtyAfterInput !== 8) {
      throw new Error(`Expected turret count 8 after direct input, got ${qtyAfterInput}`);
    }
    console.log('✓ Turret count updated directly to 8!');

    // 6. Test deleting shields module via Delete button
    console.log('--- Testing delete button on shield row ---');
    const delResult = await evalCode(`(() => {
      const delBtn = document.querySelector('.btn-del-macro[data-macro="shield_arg_m_standard_02_mk2_macro"]');
      if (!delBtn) return { error: 'No delete button found' };
      delBtn.click();
      return { clicked: true };
    })()`);
    console.log('Shield delete button clicked:', delResult);
    await sleep(500);

    const shieldRowAfterDel = await evalCode(`(() => {
      const row = document.querySelector('.macro-row[data-macro="shield_arg_m_standard_02_mk2_macro"]');
      return Boolean(row);
    })()`);
    console.log('Shield row still exists in DOM?', shieldRowAfterDel);
    if (shieldRowAfterDel) {
      throw new Error('Expected shield row to be deleted from DOM!');
    }
    console.log('✓ Shield module cleanly deleted from Planned Modules!');

    // 7. Test Dropdown: Search and Re-Add shield
    console.log('--- Testing Search & Re-Add in Planned Modules Dropdown ---');
    const addMacroResult = await evalCode(`(() => {
      const select = document.getElementById('addMacroSelect');
      const btnAdd = document.getElementById('btnAddMacro');
      if (!select || !btnAdd) return { error: 'Dropdown elements missing' };
      const options = Array.from(select.options).map(o => o.value);
      const hasShieldOption = options.includes('shield_arg_m_standard_02_mk2_macro');
      
      // Select shield option and click Add
      select.value = 'shield_arg_m_standard_02_mk2_macro';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      btnAdd.click();
      return { hasShieldOption, totalOptions: options.length };
    })()`);
    console.log('Add Macro select test result:', addMacroResult);
    if (!addMacroResult.hasShieldOption) {
      throw new Error('Dropdown does not have equipment options!');
    }
    await sleep(500);

    const readdedShieldQty = await evalCode(`(() => {
      const input = document.querySelector('.macro-qty-input[data-macro="shield_arg_m_standard_02_mk2_macro"]');
      return input ? parseInt(input.value, 10) : null;
    })()`);
    console.log('Re-added shield quantity:', readdedShieldQty);
    if (readdedShieldQty !== 1) {
      throw new Error(`Expected re-added shield quantity 1, got ${readdedShieldQty}`);
    }
    console.log('✓ Successfully re-added shield from dropdown!');

    console.log('\n========================================');
    console.log('ALL E2E PLANNED MODULES TESTS PASSED! ✓');
    console.log('========================================');

    ws.close();
  } finally {
    browser.kill();
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
