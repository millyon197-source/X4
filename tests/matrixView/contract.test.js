// Contract test: the public boundary of the matrix view is the facade (src/ui/matrixView/index.js).
// The exact export list is pinned in boundary.test.js; this checks that main.js's names are functions.
import { describe, it, expect } from 'vitest';
import * as matrixView from '../../src/ui/matrixView/index.js';

// Names src/main.js imports from the module.
const USED_BY_MAIN = [
  'renderMatrixTabHTML', 'drawLines', 'highlightGraph', 'filterWares', 'selectWare',
  'updateInspector', 'centerOnWare', 'getCenteredWareId', 'showNoBlueprintPopup',
  'alignSubdueLevel4', 'updateModuleCountFromDiff',
];

describe('matrixView public surface', () => {
  it.each(USED_BY_MAIN)('exports %s as a function', (name) => {
    expect(typeof matrixView[name]).toBe('function');
  });
});
