import { WARES_DB, PRESET_BLUEPRINTS, getWareWorkforceMultiplier, mapMacroToWare, MACRO_TO_WARE } from '../data/wares.js';
import { state, saveActiveBlueprintToStorage } from './state.js';
import { getSectorSunlight, calculateSolarOutput } from '../data/sectors.js';

export function getFactionModuleCountForWare(wareId) {
  if (!state.activeBlueprint) return 0;
  
  const rawMacros = state.activeBlueprint.rawMacros || {};
  let factionCount = 0;

  Object.entries(rawMacros).forEach(([macro, count]) => {
    if (count <= 0) return;
    const mapped = mapMacroToWare(macro);
    if (mapped === wareId) {
      const lower = macro.toLowerCase();
      const isFactionMacro = lower.startsWith('prod_arg_') ||
                            lower.startsWith('prod_tel_') ||
                            lower.startsWith('prod_par_') ||
                            lower.startsWith('prod_split_') ||
                            lower.startsWith('prod_spl_') ||
                            lower.startsWith('prod_bor_') ||
                            lower.startsWith('prod_ter_') ||
                            lower.startsWith('prod_ava_') ||
                            lower.startsWith('buildmodule_arg_') ||
                            lower.startsWith('buildmodule_tel_') ||
                            lower.startsWith('buildmodule_par_') ||
                            lower.startsWith('buildmodule_split_') ||
                            lower.startsWith('buildmodule_bor_') ||
                            lower.startsWith('buildmodule_ter_');

      const isFactionWare = ['FoodRations', 'Meat', 'Wheat', 'Spacefuel', 
                             'NostropOil', 'SunriseFlowers', 'SwampPlant', 'Spaceweed',
                             'SojaHusk', 'SojaBeans', 'MajaSnails', 'MajaDust',
                             'BoFu', 'BoGas', 'Plankton',
                             'TerranMRE', 'ProtPaste', 'Stimulants',
                             'ScruffinFruit', 'MetMicrolatt', 'CompSubstrate', 'SilCarbide'].includes(wareId);

      if (isFactionMacro || isFactionWare) {
        factionCount += count;
      }
    }
  });

  const inPlan = (state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0;
  if (factionCount === 0 && inPlan > 0) {
    const isFactionWare = ['FoodRations', 'Meat', 'Wheat', 'Spacefuel', 
                           'NostropOil', 'SunriseFlowers', 'SwampPlant', 'Spaceweed',
                           'SojaHusk', 'SojaBeans', 'MajaSnails', 'MajaDust',
                           'BoFu', 'BoGas', 'Plankton',
                           'TerranMRE', 'ProtPaste', 'Stimulants',
                           'ScruffinFruit', 'MetMicrolatt', 'CompSubstrate', 'SilCarbide'].includes(wareId);
    if (isFactionWare) factionCount = inPlan;
  }

  return Math.min(factionCount, inPlan);
}

export function calculateLiveOutputRate(wareId, inPlanCount, optimumRate) {
  const ware = WARES_DB[wareId];
  if (!ware) return 0;

  const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
  const baseRate = ware.baseRate || 1;

  const factionCount = getFactionModuleCountForWare(wareId);
  const factionContributionRate = factionCount * baseRate * wareEff;

  const isFactionExcluded = (optimumRate > factionContributionRate) && (factionCount > 0);
  const effectiveCount = isFactionExcluded ? Math.max(0, inPlanCount - factionCount) : inPlanCount;

  return effectiveCount * baseRate * wareEff;
}

export function accumulateRawMiningRates() {
  const demand = state.calculatedDemand;
  const rawTotals = {
    Ore: 0,
    Silicon: 0,
    Methane: 0,
    Hydrogen: 0,
    Helium: 0,
    Ice: 0,
    RawScrap: 0,
    Protectyon: 0
  };

  if (state.activeBlueprint) {
    // In Blueprint Mode: Calculate raw extraction from actual active blueprint modules
    const bpModules = state.activeBlueprint.modules || {};
    Object.entries(bpModules).forEach(([wareId, count]) => {
      const ware = WARES_DB[wareId];
      if (!ware || !ware.recipe || count <= 0 || ware.level === 4) return;
      const wareEff = (ware.level >= 1 && ware.level <= 3) ? getWareWorkforceMultiplier(ware, state.workforceBonus) : 1;

      Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
        if (rawTotals[inputId] !== undefined) {
          rawTotals[inputId] += count * inputQty * wareEff;
        }
      });
    });
  } else {
    // Single Target Mode: Calculate from chain modulesNeeded
    Object.entries(demand).forEach(([wareId, calc]) => {
      const ware = WARES_DB[wareId];
      if (!ware || !ware.recipe || !calc || ware.level === 4) return;
      const count = calc.modulesNeeded || 0;
      if (count <= 0) return;

      const wareEff = (ware.level >= 1 && ware.level <= 3) ? getWareWorkforceMultiplier(ware, state.workforceBonus) : 1;

      Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
        if (rawTotals[inputId] !== undefined) {
          rawTotals[inputId] += count * inputQty * wareEff;
        }
      });
    });
  }

  if (demand['Protectyon'] && demand['Protectyon'].rateNeeded > 0 && rawTotals['Protectyon'] === 0) {
    rawTotals['Protectyon'] = demand['Protectyon'].rateNeeded;
  }

  state.rawDemand = rawTotals;

  // Also assign rawTotals to state.calculatedDemand so all L0 cards and Inspector use the exact planned extraction rate!
  Object.entries(rawTotals).forEach(([rawId, rate]) => {
    if (!state.calculatedDemand[rawId]) {
      state.calculatedDemand[rawId] = { rateNeeded: 0, modulesNeeded: 0 };
    }
    state.calculatedDemand[rawId].rateNeeded = rate;
  });
}

export function computeLayerTotals() {
  // Determine the active sector where the blueprint or factory is located
  let activeSector = state.selectedSector;
  if (!activeSector && state.activeBlueprint && state.activeBlueprint.sector) {
    activeSector = state.activeBlueprint.sector;
  }
  if (!activeSector) {
    activeSector = "Nopileos' Fortune VI / Duke's Awakening";
  }

  const sectorSunlight = getSectorSunlight(activeSector);
  const ecWare = WARES_DB['EC'];
  const ecMaxWf = (ecWare && typeof ecWare.maxWorkforce === 'number') ? ecWare.maxWorkforce : 0.43;
  const ecSolarPerModule = calculateSolarOutput(sectorSunlight, state.workforceBonus, 1, 10500, ecMaxWf);

  const terEcWare = WARES_DB['TerEC'];
  const terEcMaxWf = (terEcWare && typeof terEcWare.maxWorkforce === 'number') ? terEcWare.maxWorkforce : 0.0;
  const terSolarPerModule = calculateSolarOutput(sectorSunlight, state.workforceBonus, 1, 3000, terEcMaxWf);

  const totals = {
    L1: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L2: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L3: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    sector: activeSector,
    sunlight: sectorSunlight,
    solarOutputPerPanel: ecSolarPerModule,
    terSolarOutputPerPanel: terSolarPerModule,
    totalECNeeded: 0,
    solarModulesNeeded: 0,
    terSolarModulesNeeded: 0
  };

  Object.entries(state.calculatedDemand).forEach(([wareId, calc]) => {
    const ware = WARES_DB[wareId];
    if (!ware || !calc || ware.level === 0 || ware.level === 4) return;

    const level = ware.level;
    const modCount = state.activeBlueprint 
      ? ((state.activeBlueprint.modules && state.activeBlueprint.modules[wareId]) || 0)
      : (calc.modulesNeeded || 0);
    if (modCount <= 0) return;

    const layerKey = `L${level}`;
    if (totals[layerKey]) {
      totals[layerKey].activeModules += modCount;

      // Hourly Production Rate
      const inPlanCount = state.activeBlueprint ? (state.activeBlueprint.modules[wareId] || 0) : modCount;
      const baselineCalc = (state.activeBlueprint && state.activeBlueprint.baselineDemand && state.activeBlueprint.baselineDemand[wareId]) || calc;
      const optimumRate = (baselineCalc && baselineCalc.rateNeeded > 0) 
        ? baselineCalc.rateNeeded 
        : (modCount * (ware.baseRate || 1) * getWareWorkforceMultiplier(ware, state.workforceBonus));
      const prodRate = calculateLiveOutputRate(wareId, inPlanCount > 0 ? inPlanCount : modCount, optimumRate);
      totals[layerKey].totalProd += prodRate;

      // Hourly Recipe Consumption
      if (ware.recipe) {
        const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
        const inputEff = (ware.level >= 1 && ware.level <= 3) ? wareEff : 1;
        Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
          const consRate = modCount * inputQty * inputEff;
          if (inputId === 'EC') {
            totals[layerKey].ecConsumed += consRate;
            totals.totalECNeeded += consRate;
          } else {
            totals[layerKey].totalCons += consRate;
          }
        });
      }
    }
  });

  let inPlanSolarCount = state.activeBlueprint ? (state.activeBlueprint.modules['EC'] || 0) : 0;
  let inPlanTerSolarCount = state.activeBlueprint ? (state.activeBlueprint.modules['TerEC'] || 0) : 0;

  if (inPlanTerSolarCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
      if (mapMacroToWare(m) === 'TerEC') inPlanTerSolarCount += count;
    });
  }
  if (inPlanSolarCount === 0 && state.activeBlueprint && state.activeBlueprint.rawMacros) {
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, count]) => {
      if (mapMacroToWare(m) === 'EC') inPlanSolarCount += count;
    });
  }

  totals.inPlanSolarCount = inPlanSolarCount;
  totals.inPlanTerSolarCount = inPlanTerSolarCount;
  totals.totalECProduced = (inPlanSolarCount * ecSolarPerModule) + (inPlanTerSolarCount * terSolarPerModule);
  totals.ecBalance = totals.totalECProduced - totals.totalECNeeded;
  totals.solarModulesNeeded = totals.totalECNeeded > 0 ? Math.ceil(totals.totalECNeeded / ecSolarPerModule) : 0;
  totals.terSolarModulesNeeded = totals.totalECNeeded > 0 ? Math.ceil(totals.totalECNeeded / terSolarPerModule) : 0;

  if (totals.totalECNeeded > 0) {
    state.calculatedDemand['EC'] = { modulesNeeded: totals.solarModulesNeeded, rateNeeded: totals.totalECNeeded };
    state.calculatedDemand['TerEC'] = { 
      modulesNeeded: (state.activeBlueprint && inPlanTerSolarCount === 0) ? 0 : totals.terSolarModulesNeeded, 
      rateNeeded: (state.activeBlueprint && inPlanTerSolarCount === 0) ? 0 : totals.totalECNeeded 
    };
  } else {
    state.calculatedDemand['EC'] = { modulesNeeded: 0, rateNeeded: 0 };
    state.calculatedDemand['TerEC'] = { modulesNeeded: 0, rateNeeded: 0 };
  }

  state.layerTotals = totals;
}

export function calculateFactoryRequirements() {
  state.calculatedDemand = {};

  // CASE 1: Full Station Blueprint loaded (always use blueprint modules for all totals)
  if (state.activeBlueprint) {
    if (!state.activeBlueprint.modules) state.activeBlueprint.modules = {};
    if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
    const bpModules = state.activeBlueprint.modules;

    // Initialize all wares in calculatedDemand
    Object.keys(WARES_DB).forEach(id => {
      state.calculatedDemand[id] = { rateNeeded: 0, modulesNeeded: 0 };
    });

    // 1. Process Level 3 (propagates to Level 2, Level 1, Level 0) - excluding Level 4
    Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 3).forEach(id => {
      const ware = WARES_DB[id];
      const planned = bpModules[id] || 0;
      const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);

      if (planned > 0 && ware.recipe) {
        const inputEff = wareEff;
        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (!state.calculatedDemand[inpId]) state.calculatedDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
          state.calculatedDemand[inpId].rateNeeded += planned * inpQty * inputEff;
        });
      }
    });

    // 2. Process Level 2 (propagates to Level 1, Level 0)
    Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 2).forEach(id => {
      const ware = WARES_DB[id];
      const planned = bpModules[id] || 0;
      const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
      const modRate = (ware.baseRate || 1) * wareEff;
      const neededFromL3 = state.calculatedDemand[id] && state.calculatedDemand[id].rateNeeded > 0 ? Math.ceil(state.calculatedDemand[id].rateNeeded / modRate) : 0;
      const activeModCount = planned > 0 ? Math.max(planned, neededFromL3) : (state.populateMatrix ? neededFromL3 : 0);

      if (activeModCount > 0 && ware.recipe) {
        const inputEff = wareEff;
        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (!state.calculatedDemand[inpId]) state.calculatedDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
          state.calculatedDemand[inpId].rateNeeded += activeModCount * inpQty * inputEff;
        });
      }
    });

    // 3. Process Level 1 (propagates to Level 0 raw & EC)
    Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 1).forEach(id => {
      const ware = WARES_DB[id];
      const planned = bpModules[id] || 0;
      const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
      const modRate = (ware.baseRate || 1) * wareEff;
      const neededFromL23 = state.calculatedDemand[id] && state.calculatedDemand[id].rateNeeded > 0 ? Math.ceil(state.calculatedDemand[id].rateNeeded / modRate) : 0;
      const activeModCount = planned > 0 ? Math.max(planned, neededFromL23) : (state.populateMatrix ? neededFromL23 : 0);

      if (activeModCount > 0 && ware.recipe) {
        const inputEff = wareEff;
        Object.entries(ware.recipe).forEach(([inpId, inpQty]) => {
          if (!state.calculatedDemand[inpId]) state.calculatedDemand[inpId] = { rateNeeded: 0, modulesNeeded: 0 };
          state.calculatedDemand[inpId].rateNeeded += activeModCount * inpQty * inputEff;
        });
      }
    });

    // 4. Calculate modulesNeeded strictly for Level 1-3 wares
    Object.entries(state.calculatedDemand).forEach(([inputId, data]) => {
      const inputWare = WARES_DB[inputId];
      if (inputWare && inputWare.level > 0 && inputWare.level <= 3) {
        const inputModEff = getWareWorkforceMultiplier(inputWare, state.workforceBonus);
        const modRate = (inputWare.baseRate || 1) * inputModEff;
        const neededFromDownstream = data.rateNeeded > 0 ? Math.ceil(data.rateNeeded / modRate) : 0;
        const planned = bpModules[inputId] || 0;

        data.modulesNeeded = planned > 0 ? Math.max(planned, neededFromDownstream) : (state.populateMatrix ? neededFromDownstream : 0);
      }
    });

    accumulateRawMiningRates();
    computeLayerTotals();

    if (!state.activeBlueprint.baselineDemand) {
      state.activeBlueprint.baselineDemand = JSON.parse(JSON.stringify(state.calculatedDemand));
      state.activeBlueprint.baselineLayerTotals = JSON.parse(JSON.stringify(state.layerTotals));
    }
    return;
  }

  // CASE 2: Single Target Mode with a specific card selected
  if (state.selectedWareId && WARES_DB[state.selectedWareId]) {
    const selectedWare = WARES_DB[state.selectedWareId];

    if (selectedWare.level === 4) {
      // If "Subdue Level 4" is unchecked, do not recalculate any cards only highlight cards associated.
      computeLayerTotals();
      return;
    } else {
      // Level 1, 2, 3 selected target
      const targetEff = getWareWorkforceMultiplier(selectedWare, state.workforceBonus);
      const targetOutputRate = selectedWare.baseRate * targetEff;

      state.calculatedDemand[state.selectedWareId] = {
        rateNeeded: targetOutputRate,
        modulesNeeded: 1
      };

      let queue = [{ id: state.selectedWareId, requiredRate: targetOutputRate }];

      while (queue.length > 0) {
        const { id, requiredRate } = queue.shift();
        const ware = WARES_DB[id];

        if (ware && ware.recipe) {
          const wareEff = getWareWorkforceMultiplier(ware, state.workforceBonus);
          const wareModRate = (ware.baseRate || 1) * wareEff;
          const inputEff = (ware.level >= 1 && ware.level <= 3) ? wareEff : 1;

          Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
            const inputRatePerMod = inputQty * inputEff;
            const ratePerUnit = inputRatePerMod / wareModRate;
            const totalInputRateNeeded = requiredRate * ratePerUnit;

            if (!state.calculatedDemand[inputId]) {
              state.calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
            }

            state.calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

            const inputWare = WARES_DB[inputId];
            if (inputWare && inputWare.level > 0) {
              const inputModEff = getWareWorkforceMultiplier(inputWare, state.workforceBonus);
              const modRate = (inputWare.baseRate || 1) * inputModEff;
              state.calculatedDemand[inputId].modulesNeeded = Math.ceil(state.calculatedDemand[inputId].rateNeeded / modRate);
            }

            queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
          });
        }
      }
    }

    accumulateRawMiningRates();
    computeLayerTotals();
    return;
  }

  computeLayerTotals();
}

export function getPrimaryMacroForWare(wareId) {
  if (state.activeBlueprint) {
    if (state.activeBlueprint.rootMacros) {
      const existingRoot = Object.keys(state.activeBlueprint.rootMacros).find(m => mapMacroToWare(m) === wareId);
      if (existingRoot) return existingRoot;
    }
    if (state.activeBlueprint.rawMacros) {
      const existingRaw = Object.keys(state.activeBlueprint.rawMacros).find(m => mapMacroToWare(m) === wareId);
      if (existingRaw) return existingRaw;
    }
  }
  const found = Object.keys(MACRO_TO_WARE).find(m => MACRO_TO_WARE[m] === wareId && m.startsWith('prod_'));
  return found || `prod_gen_${wareId.toLowerCase()}_macro`;
}

export function syncPopulatedMatrix() {
  if (!state.activeBlueprint) return;
  if (!state.activeBlueprint.rawMacros) state.activeBlueprint.rawMacros = {};
  if (!state.activeBlueprint.rootMacros) {
    state.activeBlueprint.rootMacros = { ...state.activeBlueprint.rawMacros };
  }

  if (!state.populateMatrix) {
    // Revert to rootMacros
    state.activeBlueprint.rawMacros = { ...state.activeBlueprint.rootMacros };
    const mods = {};
    Object.entries(state.activeBlueprint.rawMacros).forEach(([m, c]) => {
      const w = mapMacroToWare(m);
      if (w) mods[w] = (mods[w] || 0) + c;
    });
    state.activeBlueprint.modules = mods;
    state.activeBlueprint.totalModules = Object.values(state.activeBlueprint.rawMacros).reduce((s, n) => s + n, 0);
    saveActiveBlueprintToStorage();
    calculateFactoryRequirements();
    return;
  }

  // Start with rootMacros
  const newMacros = { ...state.activeBlueprint.rootMacros };
  const rootMods = {};
  Object.entries(newMacros).forEach(([m, c]) => {
    const w = mapMacroToWare(m);
    if (w) rootMods[w] = (rootMods[w] || 0) + c;
  });

  // Calculate upstream requirements from all L2/L3 wares in rootMods
  const accumulatedDemand = {};

  // Step 1: L3 wares
  Object.keys(rootMods).filter(id => WARES_DB[id] && WARES_DB[id].level === 3).forEach(l3Id => {
    const l3Ware = WARES_DB[l3Id];
    const l3Count = rootMods[l3Id];
    const l3Eff = getWareWorkforceMultiplier(l3Ware, state.workforceBonus);
    if (l3Ware.recipe) {
      Object.entries(l3Ware.recipe).forEach(([inpId, inpQty]) => {
        accumulatedDemand[inpId] = (accumulatedDemand[inpId] || 0) + (l3Count * inpQty * l3Eff);
      });
    }
  });

  // Step 2: L2 wares
  Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 2).forEach(l2Id => {
    const l2Ware = WARES_DB[l2Id];
    const l2Eff = getWareWorkforceMultiplier(l2Ware, state.workforceBonus);
    const l2ModOutput = (l2Ware.baseRate || 1) * l2Eff;
    const demandFromL3 = accumulatedDemand[l2Id] || 0;
    const neededFromL3 = demandFromL3 > 0 ? Math.ceil(demandFromL3 / l2ModOutput) : 0;
    const rootCount = rootMods[l2Id] || 0;
    const totalL2Count = Math.max(rootCount, neededFromL3);

    if (totalL2Count > 0) {
      const macro = getPrimaryMacroForWare(l2Id);
      newMacros[macro] = Math.max(newMacros[macro] || 0, totalL2Count);

      if (l2Ware.recipe) {
        Object.entries(l2Ware.recipe).forEach(([l1Id, l1Qty]) => {
          accumulatedDemand[l1Id] = (accumulatedDemand[l1Id] || 0) + (totalL2Count * l1Qty * l2Eff);
        });
      }
    }
  });

  // Step 3: L1 wares
  Object.keys(WARES_DB).filter(id => WARES_DB[id].level === 1).forEach(l1Id => {
    const l1Ware = WARES_DB[l1Id];
    const l1Eff = getWareWorkforceMultiplier(l1Ware, state.workforceBonus);
    const l1ModOutput = (l1Ware.baseRate || 1) * l1Eff;
    const demandRate = accumulatedDemand[l1Id] || 0;
    const needed = demandRate > 0 ? Math.ceil(demandRate / l1ModOutput) : 0;
    const rootCount = rootMods[l1Id] || 0;
    const totalL1Count = Math.max(rootCount, needed);

    if (totalL1Count > 0) {
      const macro = getPrimaryMacroForWare(l1Id);
      newMacros[macro] = Math.max(newMacros[macro] || 0, totalL1Count);
    }
  });

  state.activeBlueprint.rawMacros = newMacros;
  const mods = {};
  Object.entries(newMacros).forEach(([m, c]) => {
    const w = mapMacroToWare(m);
    if (w) mods[w] = (mods[w] || 0) + c;
  });
  state.activeBlueprint.modules = mods;
  state.activeBlueprint.totalModules = Object.values(newMacros).reduce((s, n) => s + n, 0);
  saveActiveBlueprintToStorage();
  calculateFactoryRequirements();
}
