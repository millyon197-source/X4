// Characterization tests: capture what the pure helpers do today, even where it looks odd.
import { describe, it, expect } from 'vitest';
import { WARES_DB, DEPENDENCIES } from '../../src/data/wares.js';
import {
  getProductionMacroForWare, getDownstreamWares, formatWareName, SCRAP_WARE_IDS,
} from '../../src/ui/matrixView.js';

describe('getProductionMacroForWare', () => {
  it('returns null for unknown wares', () => {
    expect(getProductionMacroForWare('__nope__')).toBeNull();
  });

  it('matches the recorded macro for every ware in WARES_DB', () => {
    const out = {};
    for (const id of Object.keys(WARES_DB).sort()) out[id] = getProductionMacroForWare(id);
    expect(out).toMatchSnapshot();
  });
});

describe('getDownstreamWares', () => {
  it('returns an empty set for an unknown ware', () => {
    expect(getDownstreamWares('__nope__').size).toBe(0);
  });

  it('matches the recorded downstream set for every ware that has dependencies', () => {
    const out = {};
    const roots = [...new Set(DEPENDENCIES.map(d => d.from))].sort();
    for (const id of roots) out[id] = [...getDownstreamWares(id)].sort();
    expect(out).toMatchSnapshot();
  });
});

describe('formatWareName', () => {
  it.each(['hullparts', 'EC', 'Water', 'SiliconCarbide', 'somethingElse'])('formats %s', (input) => {
    expect(formatWareName(input)).toMatchSnapshot();
  });
});

describe('SCRAP_WARE_IDS', () => {
  it('keeps its current members', () => {
    expect([...SCRAP_WARE_IDS].sort()).toMatchSnapshot();
  });
});
