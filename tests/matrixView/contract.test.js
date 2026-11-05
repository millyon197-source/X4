// Contract test: the public boundary of src/ui/matrixView.js.
// Survives the refactor unchanged; only edit it when the boundary changes on purpose.
import { describe, it, expect } from 'vitest';
import * as matrixView from '../../src/ui/matrixView.js';

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

  it('keeps the full export list (snapshot of all current names)', () => {
    expect(Object.keys(matrixView).sort()).toMatchSnapshot();
  });
});
