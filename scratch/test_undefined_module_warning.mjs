import assert from 'node:assert';

// Create minimal DOM mock for testing in Node
class MockElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c),
    };
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this._innerHTML = '';
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    const tagRegex = /<([a-z0-9-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9-]+)([^>]*)\/>/gi;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const tag = match[1] || match[4];
      const attrs = match[2] || match[5] || '';
      const inner = match[3] || '';
      const child = new MockElement(tag);
      child.parentNode = this;
      const classMatch = attrs.match(/class=["']([^"']+)["']/i);
      if (classMatch) child.className = classMatch[1];
      const idMatch = attrs.match(/id=["']([^"']+)["']/i);
      if (idMatch) child.id = idMatch[1];
      child.innerHTML = inner;
      this.children.push(child);
    }
  }

  get className() {
    return Array.from(this.classList._classes).join(' ');
  }

  set className(val) {
    this.classList._classes.clear();
    if (val) {
      val.split(/\s+/).filter(Boolean).forEach(c => this.classList._classes.add(c));
    }
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const list = this.listeners[event.type] || [];
    list.forEach(fn => fn(event));
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
    }
  }

  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      const search = (node) => {
        if (node.classList && node.classList.contains(cls)) return node;
        for (const c of node.children || []) {
          const res = search(c);
          if (res) return res;
        }
        return null;
      };
      return search(this);
    }
    return null;
  }

  querySelectorAll(sel) {
    const results = [];
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      const search = (node) => {
        if (node.classList && node.classList.contains(cls)) results.push(node);
        for (const c of node.children || []) {
          search(c);
        }
      };
      for (const c of this.children) search(c);
    }
    return results;
  }

  get textContent() {
    return this.innerHTML.replace(/<[^>]+>/g, ' ');
  }
}

const body = new MockElement('BODY');
const documentMock = {
  body,
  getElementById: (id) => {
    const search = (node) => {
      if (node.id === id) return node;
      for (const c of node.children || []) {
        const found = search(c);
        if (found) return found;
      }
      return null;
    };
    return search(body);
  },
  createElement: (tag) => {
    const el = new MockElement(tag);
    el.parentNode = body;
    return el;
  }
};

const listeners = {};
const windowMock = {
  addEventListener: (type, fn) => {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  },
  dispatchEvent: (evt) => {
    const list = listeners[evt.type] || [];
    list.forEach(fn => fn(evt));
  }
};

class CustomEventMock {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

global.document = documentMock;
global.window = windowMock;
global.CustomEvent = CustomEventMock;

// Import buildCost module
const { calculateBuildCost, calculateBuildCosts, showUndefinedModuleWarningPopup } = await import('../src/engine/buildCost.js');

console.log('1. Checking function aliases and exports...');
assert.strictEqual(typeof calculateBuildCost, 'function', 'calculateBuildCost must be a function');
assert.strictEqual(calculateBuildCost, calculateBuildCosts, 'calculateBuildCost must alias calculateBuildCosts');
assert.strictEqual(typeof showUndefinedModuleWarningPopup, 'function', 'showUndefinedModuleWarningPopup must be exported');

console.log('2. Testing valid module build cost calculation...');
const validResult = calculateBuildCost({ 'prod_gen_energycells_macro': 2 });
assert(validResult.totals.totalWareUnits > 0, 'Valid module should have positive ware units');
assert(validResult.totals.totalCredits > 0, 'Valid module should have positive credits');
assert.strictEqual(window.__lastUndefinedModuleWarning, undefined, 'No warning should be triggered for valid module');

console.log('3. Testing undefined module warning trigger in calculateBuildCost()...');
let eventFired = false;
let eventDetail = null;
window.addEventListener('undefined-module-warning', (e) => {
  eventFired = true;
  eventDetail = e.detail;
});

const resultWithUndefined = calculateBuildCost({ 'totally_unknown_custom_macro_12345': 3 });
assert(eventFired, 'undefined-module-warning event should have fired');
assert.strictEqual(eventDetail.macro, 'totally_unknown_custom_macro_12345');
assert(window.__lastUndefinedModuleWarning, 'window.__lastUndefinedModuleWarning should be set');
assert.strictEqual(window.__lastUndefinedModuleWarning.macro, 'totally_unknown_custom_macro_12345');

console.log('4. Verifying DOM popup structure and contents...');
const rack = document.getElementById('undefinedModulePopupRack');
assert(rack, '#undefinedModulePopupRack should exist in document');
const popups = rack.querySelectorAll('.undefined-module-warning-popup');
assert.strictEqual(popups.length, 1, 'Exactly 1 popup should be in the rack');

const popup = popups[0];
assert(popup.textContent.includes('Undefined Module Warning'), 'Popup should contain warning title');
assert(popup.textContent.includes('totally_unknown_custom_macro_12345'), 'Popup should display macro identifier');
assert(popup.innerHTML.includes('5s auto-dismiss'), 'Popup should mention 5s auto-dismiss');
assert(popup.innerHTML.includes('warning-popup-progress-bar'), 'Popup should contain progress bar');

console.log('5. Testing deduplication within throttle window...');
calculateBuildCost({ 'totally_unknown_custom_macro_12345': 1 });
const popupsAfterDuplicate = rack.querySelectorAll('.undefined-module-warning-popup');
assert.strictEqual(popupsAfterDuplicate.length, 1, 'Duplicate call should not add a second popup within throttle window');

console.log('6. Testing close button / dismissal...');
const closeBtn = popup.querySelector('.warning-popup-close');
assert(closeBtn, 'Close button should exist');
closeBtn.listeners['click'][0]();
assert(popup.classList.contains('warning-fade-out'), 'Popup should have warning-fade-out class upon click');

console.log('\nAll tests passed successfully! ✓');
