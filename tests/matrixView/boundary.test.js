// Boundary tests: consumers must go through the facade (src/ui/matrixView/index.js).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as facade from '../../src/ui/matrixView/index.js';

const SRC = join(process.cwd(), 'src');
const OWN_DIR = join(SRC, 'ui', 'matrixView');
const OLD_PATH = join(SRC, 'ui', 'matrixView.js'); // the old single-file module; must stay gone

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

describe('matrixView facade', () => {
  it('exposes exactly the names main.js uses', () => {
    expect(Object.keys(facade).sort()).toEqual([
      'alignSubdueLevel4', 'centerOnWare', 'drawLines', 'filterWares', 'getCenteredWareId',
      'highlightGraph', 'renderMatrixTabHTML', 'selectWare', 'showNoBlueprintPopup',
      'updateInspector', 'updateModuleCountFromDiff',
    ]);
  });
});

describe('import boundary', () => {
  it('the old single-file module path is gone', () => {
    expect(existsSync(OLD_PATH)).toBe(false);
  });

  it('no file outside src/ui/matrixView/ imports past the facade', () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      if (file.startsWith(OWN_DIR + sep)) continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]*matrixView[^'"]*)['"]/g)) {
        if (!/matrixView\/index\.js$/.test(m[1])) offenders.push(`${relative(SRC, file)} -> ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
