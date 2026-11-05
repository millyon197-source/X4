// Golden-output tests for the HTML-string renderers, using fixed state.
import { describe, it, expect } from 'vitest';
import {
  renderMatrixTabHTML,
  renderConstructionBudgetInspectorHTML,
  renderBuildNeedsBudgetInspectorHTML,
} from '../../src/ui/matrixView/matrixView.js';

describe('renderMatrixTabHTML', () => {
  it('renders the default state', () => {
    expect(renderMatrixTabHTML()).toMatchSnapshot();
  });
});

describe('construction budget panel', () => {
  it('renders with an empty state object', () => {
    expect(renderConstructionBudgetInspectorHTML({})).toMatchSnapshot();
  });

  it('renders expanded with no blueprint', () => {
    expect(renderConstructionBudgetInspectorHTML({ showConstructionBudget: true, priceType: 'avg' })).toMatchSnapshot();
  });
});

describe('build-needs budget panel', () => {
  it('renders with an empty state object', () => {
    expect(renderBuildNeedsBudgetInspectorHTML({})).toMatchSnapshot();
  });
});
