import { WARES_DB } from '../data/wares.js';
import { state } from './state.js';

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

  Object.entries(demand).forEach(([wareId, calc]) => {
    const ware = WARES_DB[wareId];
    if (!ware || !ware.recipe || !calc) return;
    const count = calc.modulesNeeded || 0;
    if (count <= 0) return;

    Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
      if (rawTotals[inputId] !== undefined) {
        rawTotals[inputId] += count * inputQty;
      }
    });
  });

  if (demand['Protectyon'] && demand['Protectyon'].rateNeeded > 0 && rawTotals['Protectyon'] === 0) {
    rawTotals['Protectyon'] = demand['Protectyon'].rateNeeded;
  }

  Object.entries(rawTotals).forEach(([rawId, totalRate]) => {
    if (totalRate > 0) {
      demand[rawId] = { modulesNeeded: 0, rateNeeded: totalRate };
    }
  });
}

export function computeLayerTotals() {
  const effMultiplier = 1 + (state.workforceBonus / 100);

  const totals = {
    L1: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L2: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L3: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    L4: { totalProd: 0, totalCons: 0, ecConsumed: 0, activeModules: 0 },
    totalECNeeded: 0,
    solarModulesNeeded: 0
  };

  Object.entries(state.calculatedDemand).forEach(([wareId, calc]) => {
    const ware = WARES_DB[wareId];
    if (!ware || !calc) return;

    const level = ware.level;
    const modCount = calc.modulesNeeded || 0;
    if (modCount <= 0) return;

    const layerKey = `L${level}`;
    if (totals[layerKey]) {
      totals[layerKey].activeModules += modCount;

      // Hourly Production Rate
      const prodRate = modCount * (ware.baseRate || 1) * effMultiplier;
      totals[layerKey].totalProd += prodRate;

      // Hourly Recipe Consumption
      if (ware.recipe) {
        Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
          const consRate = modCount * inputQty;
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

  const ecBaseSolarOutput = 10500 * effMultiplier;
  totals.solarModulesNeeded = totals.totalECNeeded > 0 ? Math.ceil(totals.totalECNeeded / ecBaseSolarOutput) : 0;

  if (totals.totalECNeeded > 0) {
    state.calculatedDemand['EC'] = { modulesNeeded: 0, rateNeeded: totals.totalECNeeded };
  }

  state.layerTotals = totals;
}

export function calculateFactoryRequirements() {
  state.calculatedDemand = {};
  const effMultiplier = 1 + (state.workforceBonus / 100);

  // CASE 1: Full Station Blueprint loaded (always use blueprint modules for all totals)
  if (state.activeBlueprint) {
    let queue = [];

    Object.entries(state.activeBlueprint.modules).forEach(([id, count]) => {
      const ware = WARES_DB[id];
      if (ware) {
        const directRate = count * (ware.baseRate || 1) * effMultiplier;
        state.calculatedDemand[id] = {
          modulesNeeded: count,
          rateNeeded: directRate
        };
        queue.push({ id: id, requiredRate: directRate });
      }
    });

    while (queue.length > 0) {
      const { id, requiredRate } = queue.shift();
      const ware = WARES_DB[id];

      if (ware && ware.recipe) {
        Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
          const ratePerUnit = inputQty / ((ware.baseRate || 1) * effMultiplier);
          const totalInputRateNeeded = requiredRate * ratePerUnit;

          if (!state.calculatedDemand[inputId]) {
            state.calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
          }

          state.calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

          const inputWare = WARES_DB[inputId];
          if (inputWare && inputWare.level > 0) {
            const modRate = (inputWare.baseRate || 1) * effMultiplier;
            state.calculatedDemand[inputId].modulesNeeded = Math.ceil(state.calculatedDemand[inputId].rateNeeded / modRate);
          }

          queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
        });
      }
    }

    accumulateRawMiningRates();

    // Evaluate Level 4 final applications activity status
    const calc = state.calculatedDemand;
    const bpModules = state.activeBlueprint.modules;

    const isStationConstActive = (calc['Claytronics'] && calc['Claytronics'].rateNeeded > 0) || (calc['HullParts'] && calc['HullParts'].rateNeeded > 0);
    const isShipChassisActive = (bpModules['ShipChassis'] > 0) || (calc['HullParts'] && calc['HullParts'].rateNeeded > 0) || (calc['EngParts'] && calc['EngParts'].rateNeeded > 0);
    const isTerranShipyardActive = (calc['CompSubstrate'] && calc['CompSubstrate'].rateNeeded > 0) || (calc['SilCarbide'] && calc['SilCarbide'].rateNeeded > 0) || (calc['MetMicrolatt'] && calc['MetMicrolatt'].rateNeeded > 0);
    const isXenShipyardActive = (bpModules['XenShipyard'] > 0) || (calc['ProcessingUnit'] && calc['ProcessingUnit'].rateNeeded > 0) || (calc['SilMatrix'] && calc['SilMatrix'].rateNeeded > 0);
    const isAdminClaimActive = (bpModules['AdminClaim'] > 0);
    const isWelfareActive = (bpModules['WelfareHub'] > 0) || (calc['NostropOil'] && calc['NostropOil'].rateNeeded > 0);
    const isBoronArtActive = (bpModules['BoronArtAcademy'] > 0) || (calc['BoFu'] && calc['BoFu'].rateNeeded > 0);
    const isShipWeaponsActive = (bpModules['ShipWeapons'] > 0) || (calc['WeapComp'] && calc['WeapComp'].rateNeeded > 0) || (calc['TurrComp'] && calc['TurrComp'].rateNeeded > 0) || (calc['FieldCoils'] && calc['FieldCoils'].rateNeeded > 0);
    const isShipShieldsActive = (bpModules['ShipShields'] > 0) || (calc['ShieldComp'] && calc['ShieldComp'].rateNeeded > 0) || (calc['AdvElec'] && calc['AdvElec'].rateNeeded > 0) || (calc['AntiConv'] && calc['AntiConv'].rateNeeded > 0) || (calc['Protectyon'] && calc['Protectyon'].rateNeeded > 0);
    const isFleetConsumablesActive = (bpModules['FleetConsumables'] > 0) || (calc['SmartChips'] && calc['SmartChips'].rateNeeded > 0) || (calc['MissComp'] && calc['MissComp'].rateNeeded > 0) || (calc['ScanArray'] && calc['ScanArray'].rateNeeded > 0);

    if (isStationConstActive) calc['StationConst'] = { modulesNeeded: 1, rateNeeded: 1 };
    if (isShipChassisActive) calc['ShipChassis'] = { modulesNeeded: bpModules['ShipChassis'] || 1, rateNeeded: 1 };
    if (isTerranShipyardActive) calc['TerranShipyard'] = { modulesNeeded: 1, rateNeeded: 1 };
    if (isXenShipyardActive) calc['XenShipyard'] = { modulesNeeded: bpModules['XenShipyard'] || 1, rateNeeded: 1 };
    if (isAdminClaimActive) calc['AdminClaim'] = { modulesNeeded: bpModules['AdminClaim'] || 1, rateNeeded: 1 };
    if (isWelfareActive) calc['WelfareHub'] = { modulesNeeded: bpModules['WelfareHub'] || 1, rateNeeded: 1 };
    if (isBoronArtActive) calc['BoronArtAcademy'] = { modulesNeeded: bpModules['BoronArtAcademy'] || 1, rateNeeded: 1 };
    if (isShipWeaponsActive) calc['ShipWeapons'] = { modulesNeeded: bpModules['ShipWeapons'] || 1, rateNeeded: 1 };
    if (isShipShieldsActive) calc['ShipShields'] = { modulesNeeded: bpModules['ShipShields'] || 1, rateNeeded: 1 };
    if (isFleetConsumablesActive) calc['FleetConsumables'] = { modulesNeeded: bpModules['FleetConsumables'] || 1, rateNeeded: 1 };

    computeLayerTotals();
    return;
  }

  // CASE 2: Single Target Mode with a specific card selected
  if (state.selectedWareId && WARES_DB[state.selectedWareId]) {
    const selectedWare = WARES_DB[state.selectedWareId];

    if (selectedWare.level === 4) {
      state.calculatedDemand[state.selectedWareId] = {
        modulesNeeded: state.targetModules,
        rateNeeded: 1
      };

      let queue = [];
      if (selectedWare.recipe) {
        Object.entries(selectedWare.recipe).forEach(([inputId, inputQty]) => {
          const reqRate = inputQty * state.targetModules;
          const inputWare = WARES_DB[inputId];

          if (!state.calculatedDemand[inputId]) {
            state.calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
          }
          state.calculatedDemand[inputId].rateNeeded += reqRate;

          if (inputWare && inputWare.level > 0) {
            const modRate = (inputWare.baseRate || 1) * effMultiplier;
            state.calculatedDemand[inputId].modulesNeeded = Math.ceil(state.calculatedDemand[inputId].rateNeeded / modRate);
          }

          queue.push({ id: inputId, requiredRate: reqRate });
        });
      }

      while (queue.length > 0) {
        const { id, requiredRate } = queue.shift();
        const ware = WARES_DB[id];

        if (ware && ware.recipe) {
          Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
            const ratePerUnit = inputQty / ((ware.baseRate || 1) * effMultiplier);
            const totalInputRateNeeded = requiredRate * ratePerUnit;

            if (!state.calculatedDemand[inputId]) {
              state.calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
            }

            state.calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

            const inputWare = WARES_DB[inputId];
            if (inputWare && inputWare.level > 0) {
              const modRate = (inputWare.baseRate || 1) * effMultiplier;
              state.calculatedDemand[inputId].modulesNeeded = Math.ceil(state.calculatedDemand[inputId].rateNeeded / modRate);
            }

            queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
          });
        }
      }
    } else {
      // Level 1, 2, 3 selected target
      const targetOutputRate = state.targetModules * (selectedWare.baseRate * effMultiplier);

      state.calculatedDemand[state.selectedWareId] = {
        rateNeeded: targetOutputRate,
        modulesNeeded: state.targetModules
      };

      let queue = [{ id: state.selectedWareId, requiredRate: targetOutputRate }];

      while (queue.length > 0) {
        const { id, requiredRate } = queue.shift();
        const ware = WARES_DB[id];

        if (ware && ware.recipe) {
          Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
            const ratePerUnit = inputQty / ((ware.baseRate || 1) * effMultiplier);
            const totalInputRateNeeded = requiredRate * ratePerUnit;

            if (!state.calculatedDemand[inputId]) {
              state.calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
            }

            state.calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

            const inputWare = WARES_DB[inputId];
            if (inputWare && inputWare.level > 0) {
              const modRate = (inputWare.baseRate || 1) * effMultiplier;
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
