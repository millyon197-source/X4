import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// 1. Load Station Modules from Master
const masterPath = path.join(rootDir, 'src', 'data', 'crissian_modules_master.json');
const rawModules = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

// Helpful lookup for wares
const waresLookup = {
  'prod_gen_energycells_macro': { output: 'Energy Cells', cycleTime: 60, amount: 175, inputs: [] },
  'prod_arg_foodrations_macro': { output: 'Food Rations', cycleTime: 360, amount: 530, inputs: [{ ware: 'Wheat', amount: 40 }, { ware: 'Meat', amount: 40 }, { ware: 'Energy Cells', amount: 100 }] },
  'prod_arg_meat_macro': { output: 'Meat', cycleTime: 450, amount: 290, inputs: [{ ware: 'Water', amount: 100 }, { ware: 'Energy Cells', amount: 80 }] },
  'prod_arg_medicalsupplies_macro': { output: 'Medical Supplies', cycleTime: 360, amount: 470, inputs: [{ ware: 'Wheat', amount: 40 }, { ware: 'Spices', amount: 40 }, { ware: 'Water', amount: 60 }, { ware: 'Energy Cells', amount: 80 }] },
  'prod_arg_wheat_macro': { output: 'Wheat', cycleTime: 300, amount: 375, inputs: [{ ware: 'Water', amount: 80 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_advancedcomposites_macro': { output: 'Advanced Composites', cycleTime: 300, amount: 54, inputs: [{ ware: 'Refined Metals', amount: 80 }, { ware: 'Graphene', amount: 80 }, { ware: 'Energy Cells', amount: 50 }] },
  'prod_gen_advancedelectronics_macro': { output: 'Advanced Electronics', cycleTime: 900, amount: 70, inputs: [{ ware: 'Microchips', amount: 200 }, { ware: 'Quantum Tubes', amount: 100 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_antimattercells_macro': { output: 'Antimatter Cells', cycleTime: 120, amount: 99, inputs: [{ ware: 'Hydrogen', amount: 320 }, { ware: 'Energy Cells', amount: 100 }] },
  'prod_gen_antimatterconverters_macro': { output: 'Antimatter Converters', cycleTime: 600, amount: 160, inputs: [{ ware: 'Antimatter Cells', amount: 160 }, { ware: 'Microchips', amount: 120 }, { ware: 'Energy Cells', amount: 80 }] },
  'prod_gen_claytronics_macro': { output: 'Claytronics', cycleTime: 900, amount: 160, inputs: [{ ware: 'Antimatter Converters', amount: 100 }, { ware: 'Quantum Tubes', amount: 100 }, { ware: 'Microchips', amount: 160 }, { ware: 'Energy Cells', amount: 140 }] },
  'prod_gen_dronecomponents_macro': { output: 'Drone Components', cycleTime: 600, amount: 120, inputs: [{ ware: 'Hull Parts', amount: 20 }, { ware: 'Engine Parts', amount: 20 }, { ware: 'Microchips', amount: 20 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_engineparts_macro': { output: 'Engine Parts', cycleTime: 900, amount: 208, inputs: [{ ware: 'Refined Metals', amount: 96 }, { ware: 'Antimatter Cells', amount: 80 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_fieldcoils_macro': { output: 'Field Coils', cycleTime: 600, amount: 180, inputs: [{ ware: 'Quantum Tubes', amount: 40 }, { ware: 'Plasma Conductors', amount: 40 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_graphene_macro': { output: 'Graphene', cycleTime: 240, amount: 96, inputs: [{ ware: 'Methane', amount: 320 }, { ware: 'Energy Cells', amount: 80 }] },
  'prod_gen_hullparts_macro': { output: 'Hull Parts', cycleTime: 900, amount: 294, inputs: [{ ware: 'Refined Metals', amount: 280 }, { ware: 'Graphene', amount: 40 }, { ware: 'Energy Cells', amount: 80 }] },
  'prod_gen_microchips_macro': { output: 'Microchips', cycleTime: 600, amount: 72, inputs: [{ ware: 'Silicon Wafers', amount: 200 }, { ware: 'Energy Cells', amount: 50 }] },
  'prod_gen_missilecomponents_macro': { output: 'Missile Components', cycleTime: 600, amount: 130, inputs: [{ ware: 'Hull Parts', amount: 20 }, { ware: 'Advanced Composites', amount: 10 }, { ware: 'Energy Cells', amount: 40 }] },
  'prod_gen_plasmaconductors_macro': { output: 'Plasma Conductors', cycleTime: 900, amount: 44, inputs: [{ ware: 'Graphene', amount: 96 }, { ware: 'Superfluid Coolant', amount: 140 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_quantumtubes_macro': { output: 'Quantum Tubes', cycleTime: 720, amount: 94, inputs: [{ ware: 'Graphene', amount: 116 }, { ware: 'Superfluid Coolant', amount: 30 }, { ware: 'Energy Cells', amount: 40 }] },
  'prod_gen_refinedmetals_macro': { output: 'Refined Metals', cycleTime: 150, amount: 88, inputs: [{ ware: 'Ore', amount: 240 }, { ware: 'Energy Cells', amount: 90 }] },
  'prod_gen_scanningarrays_macro': { output: 'Scanning Arrays', cycleTime: 600, amount: 36, inputs: [{ ware: 'Silicon Wafers', amount: 60 }, { ware: 'Refined Metals', amount: 100 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_shieldcomponents_macro': { output: 'Shield Components', cycleTime: 600, amount: 120, inputs: [{ ware: 'Quantum Tubes', amount: 20 }, { ware: 'Plasma Conductors', amount: 20 }, { ware: 'Energy Cells', amount: 70 }] },
  'prod_gen_siliconwafers_macro': { output: 'Silicon Wafers', cycleTime: 180, amount: 107, inputs: [{ ware: 'Silicon', amount: 240 }, { ware: 'Energy Cells', amount: 90 }] },
  'prod_gen_smartchips_macro': { output: 'Smart Chips', cycleTime: 600, amount: 143, inputs: [{ ware: 'Silicon Wafers', amount: 20 }, { ware: 'Energy Cells', amount: 50 }] },
  'prod_gen_superfluidcoolant_macro': { output: 'Superfluid Coolant', cycleTime: 240, amount: 95, inputs: [{ ware: 'Helium', amount: 320 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_turretcomponents_macro': { output: 'Turret Components', cycleTime: 900, amount: 96, inputs: [{ ware: 'Hull Parts', amount: 20 }, { ware: 'Microchips', amount: 20 }, { ware: 'Quantum Tubes', amount: 20 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_water_macro': { output: 'Water', cycleTime: 120, amount: 193, inputs: [{ ware: 'Ice', amount: 320 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_gen_weaponcomponents_macro': { output: 'Weapon Components', cycleTime: 900, amount: 100, inputs: [{ ware: 'Hull Parts', amount: 20 }, { ware: 'Plasma Conductors', amount: 20 }, { ware: 'Energy Cells', amount: 60 }] },
  'prod_ter_computronicsubstrate_macro': { output: 'Computronic Substrate', cycleTime: 600, amount: 98, inputs: [{ ware: 'Ore', amount: 3000 }, { ware: 'Silicon', amount: 3000 }, { ware: 'Hydrogen', amount: 2000 }, { ware: 'Energy Cells', amount: 4000 }] },
  'prod_ter_metallicmicrolattice_macro': { output: 'Metallic Microlattice', cycleTime: 180, amount: 190, inputs: [{ ware: 'Ore', amount: 50 }, { ware: 'Helium', amount: 130 }, { ware: 'Energy Cells', amount: 525 }] },
  'prod_ter_siliconcarbide_macro': { output: 'Silicon Carbide', cycleTime: 300, amount: 48, inputs: [{ ware: 'Silicon', amount: 300 }, { ware: 'Metallic Microlattice', amount: 2 }, { ware: 'Methane', amount: 400 }, { ware: 'Energy Cells', amount: 200 }] }
};

// Common initial unlocked modules in a typical X4 playthrough
const initialOwnedModuleMacros = new Set([
  'struct_arg_base_01_macro',
  'struct_arg_base_02_macro',
  'struct_arg_cross_01_macro',
  'struct_arg_vertical_01_macro',
  'dockarea_arg_m_station_01_macro',
  'dockarea_arg_m_station_01_lowtech_macro',
  'pier_arg_harbor_01_macro',
  'prod_gen_energycells_macro',
  'prod_gen_hullparts_macro',
  'prod_gen_refinedmetals_macro',
  'storage_arg_s_container_01_macro',
  'storage_arg_s_solid_01_macro',
  'storage_arg_s_liquid_01_macro',
  'defence_arg_claim_01_macro',
  'hab_arg_s_01_macro'
]);

const modulesList = Object.values(rawModules).map(m => {
  let modType = 'Structural';
  if (m.type === 'production' || m.type === 'processingmodule') modType = 'Production';
  else if (m.type === 'habitation') modType = 'Habitation';
  else if (m.type === 'storage') modType = 'Storage';
  else if (m.type === 'defencemodule') modType = 'Defense';
  else if (m.type === 'dockarea' || m.type === 'pier' || m.type === 'buildmodule') modType = 'Dock';

  let faction = 'General';
  const lmacro = (m.macro || '').toLowerCase();
  if (lmacro.includes('_arg_')) faction = 'Argon';
  else if (lmacro.includes('_ter_')) faction = 'Terran';
  else if (lmacro.includes('_tel_')) faction = 'Teladi';
  else if (lmacro.includes('_par_')) faction = 'Paranid';
  else if (lmacro.includes('_spl_')) faction = 'Split';
  else if (lmacro.includes('_bor_')) faction = 'Boron';

  let prod = { cycleTime: 60, output: '', amount: 0, inputs: [] };
  if (waresLookup[m.macro]) {
    prod = waresLookup[m.macro];
  } else if (modType === 'Production') {
    prod.output = m.name.replace(/ Production$/i, '').trim();
    prod.amount = 100;
  }

  let hab = { race: faction === 'General' ? 'All' : faction, maxCapacity: 0 };
  if (modType === 'Habitation') {
    if (lmacro.includes('_l_')) hab.maxCapacity = 1000;
    else if (lmacro.includes('_m_')) hab.maxCapacity = 500;
    else hab.maxCapacity = 250;
  }

  let storage = { capacity: 0, tags: 'Container' };
  if (modType === 'Storage') {
    if (lmacro.includes('_liquid_')) storage.tags = 'Liquid';
    else if (lmacro.includes('_solid_')) storage.tags = 'Solid';
    else if (lmacro.includes('condensate')) storage.tags = 'Condensate';

    if (lmacro.includes('_l_')) storage.capacity = 1000000;
    else if (lmacro.includes('_m_')) storage.capacity = 400000;
    else storage.capacity = 100000;
  }

  return {
    id: m.macro || m.name,
    name: m.name,
    macro: m.macro,
    group: 'modules',
    subgroup: modType,
    moduleType: modType,
    category: modType,
    faction,
    hull: 100000,
    unlocked: initialOwnedModuleMacros.has(m.macro),
    cost: m.cost || {},
    description: `Station module: ${m.name} (${faction} standard)`,
    production: prod,
    habitation: hab,
    storage: storage
  };
});

// Add Landmark & Housing Spire Modules
const extraLandmarkModules = [
  {
    id: 'landmarks_arg_antigonespire_01_macro',
    name: 'Argon XL Housing Spire',
    macro: 'landmarks_arg_antigonespire_01_macro',
    ware: 'module_hab_arg_antigonespire_01',
    group: 'modules',
    subgroup: 'Habitation',
    moduleType: 'Habitation',
    category: 'Habitation',
    faction: 'Argon',
    hull: 100000,
    unlocked: false,
    cost: { claytronics: 165, energycells: 9375, hullparts: 1256 },
    description: 'Station module: Argon XL Housing Spire (Antigone vertical landmark habitat)',
    production: { cycleTime: 60, output: '', amount: 0, inputs: [] },
    habitation: { race: 'Argon', maxCapacity: 2000 },
    storage: { capacity: 0, tags: 'Container' }
  },
  {
    id: 'landmarks_arg_antigonepillar_01_macro',
    name: 'Argon L Housing Spire',
    macro: 'landmarks_arg_antigonepillar_01_macro',
    ware: 'module_hab_arg_antigonepillar_01',
    group: 'modules',
    subgroup: 'Habitation',
    moduleType: 'Habitation',
    category: 'Habitation',
    faction: 'Argon',
    hull: 100000,
    unlocked: false,
    cost: { claytronics: 117, energycells: 6627, hullparts: 888 },
    description: 'Station module: Argon L Housing Spire (Antigone vertical landmark habitat)',
    production: { cycleTime: 60, output: '', amount: 0, inputs: [] },
    habitation: { race: 'Argon', maxCapacity: 1000 },
    storage: { capacity: 0, tags: 'Container' }
  }
];
modulesList.push(...extraLandmarkModules);

// 2. Ships Catalog
const shipsRaw = [
  // Argon Small (S)
  { id: 'ship_arg_s_fighter_01_a_macro', name: 'Elite Vanguard', faction: 'Argon', size: 'S', role: 'Light Fighter', hull: 2200, shields: 1, speed: 280, cargo: 140, weapons: 2, turrets: 0, unlocked: true, desc: 'Nimble Argon scout and patrol interceptor.' },
  { id: 'ship_arg_s_fighter_02_a_macro', name: 'Nova Vanguard', faction: 'Argon', size: 'S', role: 'Medium Fighter', hull: 2800, shields: 2, speed: 245, cargo: 180, weapons: 2, turrets: 0, unlocked: true, desc: 'Mainline Argon combat fighter with balanced agility.' },
  { id: 'ship_arg_s_fighter_03_a_macro', name: 'Eclipse Vanguard', faction: 'Argon', size: 'S', role: 'Heavy Fighter', hull: 4200, shields: 2, speed: 210, cargo: 220, weapons: 4, turrets: 0, unlocked: true, desc: 'Heavily armed strike fighter capable of carrier-based assault.' },
  { id: 'ship_arg_s_scout_01_a_macro', name: 'Discoverer Vanguard', faction: 'Argon', size: 'S', role: 'Scout', hull: 1500, shields: 1, speed: 410, cargo: 100, weapons: 2, turrets: 0, unlocked: true, desc: 'High-velocity exploration vessel with advanced sensor arrays.' },
  { id: 'ship_arg_s_trans_01_a_macro', name: 'Callisto Vanguard', faction: 'Argon', size: 'S', role: 'Courier', hull: 1900, shields: 1, speed: 330, cargo: 420, weapons: 1, turrets: 0, unlocked: false, desc: 'High-speed light transport for urgent supplies.' },

  // Argon Medium (M)
  { id: 'ship_arg_m_corvette_01_a_macro', name: 'Cerberus Vanguard', faction: 'Argon', size: 'M', role: 'Frigate', hull: 24000, shields: 2, speed: 230, cargo: 1100, weapons: 2, turrets: 4, unlocked: true, desc: 'Multipurpose escort frigate featuring an internal S-dock.' },
  { id: 'ship_arg_m_gunboat_01_a_macro', name: 'Minotaur Raider', faction: 'Argon', size: 'M', role: 'Gunboat', hull: 21000, shields: 2, speed: 250, cargo: 950, weapons: 2, turrets: 4, unlocked: false, desc: 'Aggressive patrol gunboat with anti-fighter flak mounts.' },
  { id: 'ship_arg_m_trans_01_a_macro', name: 'Mercury Vanguard', faction: 'Argon', size: 'M', role: 'Freighter', hull: 18000, shields: 2, speed: 175, cargo: 8200, weapons: 1, turrets: 2, unlocked: true, desc: 'Workhorse medium container transporter of the Argon Federation.' },
  { id: 'ship_arg_m_miner_01_a_macro', name: 'Drill Vanguard (Mineral)', faction: 'Argon', size: 'M', role: 'Miner', hull: 19000, shields: 2, speed: 185, cargo: 3800, weapons: 1, turrets: 2, unlocked: true, desc: 'Solid ore and silicon mining vessel with integrated collection lasers.' },
  { id: 'ship_arg_m_miner_02_a_macro', name: 'Drill Vanguard (Gas)', faction: 'Argon', size: 'M', role: 'Gas Miner', hull: 19000, shields: 2, speed: 190, cargo: 3600, weapons: 1, turrets: 2, unlocked: false, desc: 'Liquid methane and hydrogen harvesting frigate.' },

  // Argon Large & XL
  { id: 'ship_arg_l_destroyer_01_a_macro', name: 'Behemoth Vanguard', faction: 'Argon', size: 'L', role: 'Destroyer', hull: 160000, shields: 3, speed: 135, cargo: 12500, weapons: 2, turrets: 8, unlocked: false, desc: 'Formidable fleet bombardment destroyer armed with dual capital railguns.' },
  { id: 'ship_arg_l_trans_01_a_macro', name: 'Shuyaku Vanguard', faction: 'Argon', size: 'L', role: 'Freighter', hull: 82000, shields: 3, speed: 110, cargo: 44000, weapons: 0, turrets: 6, unlocked: false, desc: 'Bulk container carrier capable of supplying entire mega-factories.' },
  { id: 'ship_arg_xl_carrier_01_a_macro', name: 'Colossus Vanguard', faction: 'Argon', size: 'XL', role: 'Fleet Carrier', hull: 390000, shields: 4, speed: 85, cargo: 45000, weapons: 0, turrets: 16, unlocked: false, desc: 'Flagship carrier maintaining full S/M fighter squadrons.' },
  { id: 'ship_arg_xl_builder_01_a_macro', name: 'Mammoth Vanguard', faction: 'Argon', size: 'XL', role: 'Station Builder', hull: 280000, shields: 3, speed: 65, cargo: 75000, weapons: 0, turrets: 8, unlocked: false, desc: 'Super-heavy construction ship deploying factory plots.' },

  // Terran Protectorate Ships
  { id: 'ship_ter_s_fighter_01_a_macro', name: 'Gladius', faction: 'Terran', size: 'S', role: 'Heavy Fighter', hull: 5800, shields: 2, speed: 220, cargo: 260, weapons: 4, turrets: 0, unlocked: true, desc: 'Armored Terran strike fighter with immense shielding.' },
  { id: 'ship_ter_s_scout_01_a_macro', name: 'Takoba', faction: 'Terran', size: 'S', role: 'Scout Fighter', hull: 3100, shields: 2, speed: 385, cargo: 180, weapons: 2, turrets: 0, unlocked: false, desc: 'High-speed interceptor used by the Sol Protective Agency.' },
  { id: 'ship_ter_s_fighter_02_a_macro', name: 'Kukri', faction: 'Terran', size: 'S', role: 'Medium Fighter', hull: 3600, shields: 2, speed: 270, cargo: 200, weapons: 2, turrets: 0, unlocked: true, desc: 'Reliable Terran standard combat fighter.' },
  { id: 'ship_ter_m_corvette_01_a_macro', name: 'Katana', faction: 'Terran', size: 'M', role: 'Corvette', hull: 26000, shields: 2, speed: 320, cargo: 1200, weapons: 4, turrets: 2, unlocked: false, desc: 'Ultra-fast attack corvette with unmatched forward burst firepower.' },
  { id: 'ship_ter_m_frigate_01_a_macro', name: 'Falx', faction: 'Terran', size: 'M', role: 'Frigate', hull: 31000, shields: 3, speed: 215, cargo: 1400, weapons: 4, turrets: 4, unlocked: false, desc: 'Armored support frigate with internal drone bays.' },
  { id: 'ship_ter_m_gunboat_01_a_macro', name: 'Jian', faction: 'Terran', size: 'M', role: 'Gunboat', hull: 28000, shields: 2, speed: 240, cargo: 900, weapons: 2, turrets: 6, unlocked: false, desc: 'Point-defense escort bristling with automated turrets.' },
  { id: 'ship_ter_m_miner_01_a_macro', name: 'Bolo (Mineral)', faction: 'Terran', size: 'M', role: 'Miner', hull: 24000, shields: 2, speed: 170, cargo: 4200, weapons: 1, turrets: 2, unlocked: false, desc: 'Terran mining vessel tailored for Asteroid Belt resources.' },
  { id: 'ship_ter_l_destroyer_01_a_macro', name: 'Osaka', faction: 'Terran', size: 'L', role: 'Destroyer', hull: 220000, shields: 3, speed: 120, cargo: 14000, weapons: 2, turrets: 10, unlocked: false, desc: 'Terran mainline fleet destroyer with massive point defense.' },
  { id: 'ship_ter_l_destroyer_02_a_macro', name: 'Syn', faction: 'Terran', size: 'L', role: 'Heavy Destroyer', hull: 310000, shields: 4, speed: 95, cargo: 16000, weapons: 3, turrets: 12, unlocked: false, desc: 'Triple-main-battery siege warship delivering devastating kinetic volleys.' },
  { id: 'ship_ter_xl_battleship_01_a_macro', name: 'Asgard', faction: 'Terran', size: 'XL', role: 'Battleship', hull: 750000, shields: 6, speed: 70, cargo: 50000, weapons: 1, turrets: 24, unlocked: false, desc: 'The apex Terran dreadnought, armed with the devastating Point-to-Point ATF Trans-Orbital Wave Cannon.' },
  { id: 'ship_ter_xl_carrier_01_a_macro', name: 'Tokyo', faction: 'Terran', size: 'XL', role: 'Fleet Carrier', hull: 460000, shields: 5, speed: 80, cargo: 48000, weapons: 0, turrets: 18, unlocked: false, desc: 'Heavily protected Terran fleet carrier platform.' },

  // Teladi Company Ships
  { id: 'ship_tel_s_fighter_01_a_macro', name: 'Falcon Vanguard', faction: 'Teladi', size: 'S', role: 'Heavy Fighter', hull: 4800, shields: 2, speed: 195, cargo: 310, weapons: 2, turrets: 0, unlocked: true, desc: 'Tanky fighter with maximum cargo hold for trade-protection.' },
  { id: 'ship_tel_s_scout_01_a_macro', name: 'Kestrel Vanguard', faction: 'Teladi', size: 'S', role: 'Fast Scout', hull: 1400, shields: 1, speed: 495, cargo: 80, weapons: 2, turrets: 0, unlocked: true, desc: 'The fastest reconnaissance ship in known space.' },
  { id: 'ship_tel_m_corvette_01_a_macro', name: 'Osprey Vanguard', faction: 'Teladi', size: 'M', role: 'Frigate', hull: 34000, shields: 3, speed: 140, cargo: 1800, weapons: 2, turrets: 4, unlocked: false, desc: 'Flying fortress with extraordinary hull and shield buffering.' },
  { id: 'ship_tel_m_trans_01_a_macro', name: 'Vulture Vanguard', faction: 'Teladi', size: 'M', role: 'Freighter', hull: 22000, shields: 2, speed: 130, cargo: 10400, weapons: 1, turrets: 2, unlocked: true, desc: 'High-capacity medium merchant hauler.' },
  { id: 'ship_tel_l_destroyer_01_a_macro', name: 'Phoenix Vanguard', faction: 'Teladi', size: 'L', role: 'Destroyer', hull: 190000, shields: 4, speed: 90, cargo: 18000, weapons: 2, turrets: 8, unlocked: false, desc: 'Disc-shaped Teladi heavy combat destroyer.' },
  { id: 'ship_tel_xl_carrier_01_a_macro', name: 'Condor Vanguard', faction: 'Teladi', size: 'XL', role: 'Fleet Carrier', hull: 420000, shields: 5, speed: 60, cargo: 60000, weapons: 0, turrets: 14, unlocked: false, desc: 'Massive mobile trade depot and battle carrier.' },

  // Paranid Ships
  { id: 'ship_par_s_fighter_01_a_macro', name: 'Perseus Vanguard', faction: 'Paranid', size: 'S', role: 'Medium Fighter', hull: 2600, shields: 1, speed: 310, cargo: 130, weapons: 2, turrets: 0, unlocked: true, desc: 'Graceful combat interceptor favored by the Holy Order.' },
  { id: 'ship_par_s_fighter_02_a_macro', name: 'Ares', faction: 'Paranid', size: 'S', role: 'Super Heavy Fighter', hull: 6200, shields: 3, speed: 175, cargo: 240, weapons: 4, turrets: 0, unlocked: false, desc: 'Heaviest shielded S-class fighter in the Commonwealth.' },
  { id: 'ship_par_s_scout_01_a_macro', name: 'Pegasus Vanguard', faction: 'Paranid', size: 'S', role: 'Scout', hull: 1600, shields: 1, speed: 460, cargo: 90, weapons: 2, turrets: 0, unlocked: true, desc: 'High-acceleration recon ship designed for priority routing.' },
  { id: 'ship_par_m_corvette_01_a_macro', name: 'Nemesis Vanguard', faction: 'Paranid', size: 'M', role: 'Corvette', hull: 19000, shields: 2, speed: 290, cargo: 850, weapons: 5, turrets: 2, unlocked: false, desc: 'Fierce strike corvette with 5 forward weapon mounts.' },
  { id: 'ship_par_m_frigate_01_a_macro', name: 'Gorgon Vanguard', faction: 'Paranid', size: 'M', role: 'Frigate', hull: 23000, shields: 2, speed: 260, cargo: 1050, weapons: 2, turrets: 4, unlocked: false, desc: 'Fleet escort and missile interception platform.' },
  { id: 'ship_par_l_destroyer_01_a_macro', name: 'Odysseus Vanguard', faction: 'Paranid', size: 'L', role: 'Destroyer', hull: 175000, shields: 3, speed: 130, cargo: 13500, weapons: 2, turrets: 10, unlocked: false, desc: 'Elegant combat destroyer with dedicated M-dock.' },
  { id: 'ship_par_xl_carrier_01_a_macro', name: 'Zeus Vanguard', faction: 'Paranid', size: 'XL', role: 'Fleet Carrier', hull: 380000, shields: 4, speed: 95, cargo: 42000, weapons: 0, turrets: 16, unlocked: false, desc: 'Paranid mobile fleet command carrier.' },

  // Split Ships
  { id: 'ship_spl_s_fighter_01_a_macro', name: 'Chimera', faction: 'Split', size: 'S', role: 'Heavy Fighter', hull: 3300, shields: 1, speed: 330, cargo: 160, weapons: 5, turrets: 0, unlocked: false, desc: 'Terrifying dogfighter equipped with 5 forward weapons.' },
  { id: 'ship_spl_s_fighter_02_a_macro', name: 'Asp', faction: 'Split', size: 'S', role: 'Light Fighter', hull: 1800, shields: 1, speed: 375, cargo: 120, weapons: 2, turrets: 0, unlocked: true, desc: 'Swift hit-and-run Split predator.' },
  { id: 'ship_spl_m_corvette_01_a_macro', name: 'Dragon', faction: 'Split', size: 'M', role: 'Corvette', hull: 16000, shields: 1, speed: 360, cargo: 750, weapons: 6, turrets: 2, unlocked: false, desc: 'Deadly corvette fielding an unprecedented battery of 6 forward main guns.' },
  { id: 'ship_spl_m_frigate_01_a_macro', name: 'Cobra', faction: 'Split', size: 'M', role: 'Frigate', hull: 22000, shields: 2, speed: 280, cargo: 900, weapons: 3, turrets: 4, unlocked: false, desc: 'Aggressive boarding frigate capable of carrying large marine contingents.' },
  { id: 'ship_spl_l_destroyer_01_a_macro', name: 'Rattlesnake', faction: 'Split', size: 'L', role: 'Destroyer', hull: 155000, shields: 2, speed: 175, cargo: 11000, weapons: 4, turrets: 8, unlocked: false, desc: 'High-speed brawler destroyer with 4 capital railguns and heavy flak.' },
  { id: 'ship_spl_xl_carrier_01_a_macro', name: 'Raptor', faction: 'Split', size: 'XL', role: 'Super Carrier', hull: 450000, shields: 4, speed: 75, cargo: 55000, weapons: 0, turrets: 42, unlocked: false, desc: 'Massive armada flagship boasting over 100 dock bays and 42 turrets.' },

  // Boron Ships
  { id: 'ship_bor_s_fighter_01_a_macro', name: 'Barracuda', faction: 'Boron', size: 'S', role: 'Fighter', hull: 2700, shields: 2, speed: 290, cargo: 170, weapons: 2, turrets: 0, unlocked: true, desc: 'Graceful hydrodynamic fighter equipped with Boron energy shielding.' },
  { id: 'ship_bor_s_scout_01_a_macro', name: 'Mako', faction: 'Boron', size: 'S', role: 'Interceptor', hull: 1900, shields: 2, speed: 430, cargo: 110, weapons: 2, turrets: 0, unlocked: false, desc: 'Rapid response interceptor designed for patrol sweeps.' },
  { id: 'ship_bor_m_corvette_01_a_macro', name: 'Hydra', faction: 'Boron', size: 'M', role: 'Corvette', hull: 22000, shields: 2, speed: 310, cargo: 1000, weapons: 4, turrets: 2, unlocked: false, desc: 'Agile Boron combat corvette with advanced ion cannons.' },
  { id: 'ship_bor_l_destroyer_01_a_macro', name: 'Ray', faction: 'Boron', size: 'L', role: 'Destroyer', hull: 185000, shields: 3, speed: 140, cargo: 13000, weapons: 2, turrets: 8, unlocked: false, desc: 'Flowing Boron capital ship equipped with ion arc weapons.' },
  { id: 'ship_bor_xl_carrier_01_a_macro', name: 'Shark', faction: 'Boron', size: 'XL', role: 'Fleet Carrier', hull: 410000, shields: 5, speed: 85, cargo: 50000, weapons: 0, turrets: 20, unlocked: false, desc: 'Majestic Boron carrier providing restorative shield auras.' }
];

const shipsList = shipsRaw.map(s => ({
  id: s.id,
  name: s.name,
  macro: s.id,
  group: 'ships',
  subgroup: `${s.size} Class`,
  size: s.size,
  role: s.role,
  category: `${s.size} Ship`,
  faction: s.faction,
  hull: s.hull,
  unlocked: s.unlocked,
  description: s.desc,
  cost: { hullparts: Math.round(s.hull / 100), energycells: 50 },
  specs: {
    size: s.size,
    role: s.role,
    shields: `${s.shields}x Mount`,
    weapons: `${s.weapons}x Forward`,
    turrets: `${s.turrets}x Turret`,
    speed: `${s.speed} m/s`,
    cargo: `${s.cargo.toLocaleString()} m³`
  }
}));

// 3. Equipment Catalog
const equipmentRaw = [
  // S & M Weapons
  { id: 'weapon_arg_s_laser_01_mk1_macro', name: 'Pulse Laser Mk1', faction: 'Argon', slotSize: 'S', eqType: 'Weapons', dps: 180, range: 3200, unlocked: true, desc: 'Rapid-firing laser bolt cannon standard across Argon vessels.' },
  { id: 'weapon_arg_s_laser_01_mk2_macro', name: 'Pulse Laser Mk2', faction: 'Argon', slotSize: 'S', eqType: 'Weapons', dps: 275, range: 3500, unlocked: true, desc: 'Enhanced pulse capacitor variant offering higher rate-of-fire.' },
  { id: 'weapon_arg_m_laser_01_mk2_macro', name: 'Medium Pulse Laser Mk2', faction: 'Argon', slotSize: 'M', eqType: 'Weapons', dps: 580, range: 4200, unlocked: true, desc: 'Heavy pulse gun designed for medium strike craft.' },
  { id: 'weapon_gen_s_beam_01_mk1_macro', name: 'Beam Laser Mk1', faction: 'General', slotSize: 'S', eqType: 'Weapons', dps: 140, range: 2800, unlocked: true, desc: 'Instant-hit precision thermal beam.' },
  { id: 'weapon_gen_m_beam_01_mk2_macro', name: 'Beam Laser Mk2', faction: 'General', slotSize: 'M', eqType: 'Weapons', dps: 340, range: 3600, unlocked: false, desc: 'Continuous focused cutting beam for component stripping.' },
  { id: 'weapon_gen_s_plasma_01_mk2_macro', name: 'Plasma Cannon Mk2', faction: 'General', slotSize: 'S', eqType: 'Weapons', dps: 410, range: 5800, unlocked: false, desc: 'High-damage slow projectile weapon ideal against capital ships.' },
  { id: 'weapon_gen_m_plasma_01_mk2_macro', name: 'Medium Plasma Cannon Mk2', faction: 'General', slotSize: 'M', eqType: 'Weapons', dps: 890, range: 7200, unlocked: false, desc: 'Devastating heavy bombardment plasma accelerator.' },
  { id: 'weapon_gen_s_bolt_01_mk2_macro', name: 'Bolt Repeater Mk2', faction: 'Argon', slotSize: 'S', eqType: 'Weapons', dps: 320, range: 2400, unlocked: true, desc: 'High kinetic cyclic cannon effective against light hulls.' },
  { id: 'weapon_ter_s_laser_01_mk1_macro', name: 'Proton Barrage Mk1', faction: 'Terran', slotSize: 'S', eqType: 'Weapons', dps: 450, range: 4100, unlocked: false, desc: 'Advanced Sol high-density projectile weapon with extreme velocity.' },
  { id: 'weapon_ter_m_laser_01_mk1_macro', name: 'Meson Stream Mk1', faction: 'Terran', slotSize: 'M', eqType: 'Weapons', dps: 1200, range: 4800, unlocked: false, desc: 'Terran particle beam incinerating hostile targets.' },
  { id: 'weapon_spl_s_laser_01_mk2_macro', name: 'Thermal Disintegrator Mk2', faction: 'Split', slotSize: 'S', eqType: 'Weapons', dps: 380, range: 2900, unlocked: false, desc: 'Split weapon that directly bleeds hull damage through active shields.' },
  { id: 'weapon_spl_m_laser_01_mk2_macro', name: 'Neutron Gatling Mk2', faction: 'Split', slotSize: 'M', eqType: 'Weapons', dps: 920, range: 2700, unlocked: false, desc: 'Rotary autocannon shredding targets at close dogfighting ranges.' },
  { id: 'weapon_bor_s_laser_01_mk1_macro', name: 'Ion Gatling Mk1', faction: 'Boron', slotSize: 'S', eqType: 'Weapons', dps: 310, range: 3200, unlocked: false, desc: 'Rapid ion discharge disorienting target weapon systems.' },

  // Turrets (M & L)
  { id: 'turret_arg_m_laser_01_mk1_macro', name: 'M Pulse Turret Mk1', faction: 'Argon', slotSize: 'M', eqType: 'Turrets', dps: 220, range: 3600, unlocked: true, desc: 'Automated 360-degree point-defense pulse turret.' },
  { id: 'turret_arg_m_flak_01_mk1_macro', name: 'M Flak Turret Mk1', faction: 'Argon', slotSize: 'M', eqType: 'Turrets', dps: 480, range: 2600, unlocked: false, desc: 'Proximity detonation anti-fighter flak turret.' },
  { id: 'turret_gen_m_plasma_01_mk1_macro', name: 'M Plasma Turret Mk1', faction: 'General', slotSize: 'M', eqType: 'Turrets', dps: 520, range: 6400, unlocked: false, desc: 'Anti-capital bombardment turret.' },
  { id: 'turret_gen_m_beam_01_mk1_macro', name: 'M Beam Turret Mk1', faction: 'General', slotSize: 'M', eqType: 'Turrets', dps: 160, range: 3200, unlocked: true, desc: 'Precision beam for shooting down inbound torpedoes and drones.' },
  { id: 'turret_gen_l_plasma_01_mk1_macro', name: 'L Plasma Turret Mk1', faction: 'General', slotSize: 'L', eqType: 'Turrets', dps: 1450, range: 9200, unlocked: false, desc: 'Heavy capital ship plasma battery.' },
  { id: 'turret_ter_l_beam_01_mk1_macro', name: 'L Beam Turret (TER)', faction: 'Terran', slotSize: 'L', eqType: 'Turrets', dps: 850, range: 6800, unlocked: false, desc: 'Long-range defensive laser emitter of the Terran fleet.' },
  { id: 'turret_spl_m_flak_01_mk1_macro', name: 'M Flak Turret (SPL)', faction: 'Split', slotSize: 'M', eqType: 'Turrets', dps: 560, range: 2400, unlocked: false, desc: 'Rapid cycling Split flak gun shredding fighter screens.' },

  // Shields
  { id: 'shield_arg_s_standard_01_mk1_macro', name: 'Argon Shield Generator Mk1', faction: 'Argon', slotSize: 'S', eqType: 'Shields', capacity: 2200, rechargeRate: 48, unlocked: true, desc: 'Standard balanced S-class energy barrier.' },
  { id: 'shield_arg_s_standard_01_mk2_macro', name: 'Argon Shield Generator Mk2', faction: 'Argon', slotSize: 'S', eqType: 'Shields', capacity: 3100, rechargeRate: 72, unlocked: true, desc: 'Reinforced shielding for front-line Argon patrol craft.' },
  { id: 'shield_arg_m_standard_01_mk2_macro', name: 'Argon Medium Shield Mk2', faction: 'Argon', slotSize: 'M', eqType: 'Shields', capacity: 16500, rechargeRate: 260, unlocked: true, desc: 'Multi-layer deflector generator for M-class frigates.' },
  { id: 'shield_ter_s_standard_01_mk3_macro', name: 'Terran Shield Generator Mk3', faction: 'Terran', slotSize: 'S', eqType: 'Shields', capacity: 4800, rechargeRate: 110, unlocked: false, desc: 'Maximum capacity energy barrier engineered in Sol.' },
  { id: 'shield_ter_m_standard_01_mk3_macro', name: 'Terran Medium Shield Mk3', faction: 'Terran', slotSize: 'M', eqType: 'Shields', capacity: 28000, rechargeRate: 420, unlocked: false, desc: 'Apex medium shield generator with formidable kinetic absorption.' },
  { id: 'shield_tel_l_standard_01_mk2_macro', name: 'Teladi Large Shield Mk2', faction: 'Teladi', slotSize: 'L', eqType: 'Shields', capacity: 115000, rechargeRate: 780, unlocked: false, desc: 'Enormous Teladi capacitor shield for capital battleships.' },
  { id: 'shield_par_m_standard_01_mk2_macro', name: 'Paranid Medium Shield Mk2', faction: 'Paranid', slotSize: 'M', eqType: 'Shields', capacity: 14000, rechargeRate: 380, unlocked: false, desc: 'Fast-recovery barrier system developed in Trinity Sanctum.' },

  // Engines & Thrusters
  { id: 'engine_arg_s_combat_01_mk1_macro', name: 'Argon S Combat Engine Mk1', faction: 'Argon', slotSize: 'S', eqType: 'Engines', thrust: 1850, boost: 4.8, travel: 12.0, unlocked: true, desc: 'Instant boost combat thruster with zero activation delay.' },
  { id: 'engine_arg_s_combat_01_mk3_macro', name: 'Argon S Combat Engine Mk3', faction: 'Argon', slotSize: 'S', eqType: 'Engines', thrust: 2900, boost: 5.6, travel: 15.5, unlocked: false, desc: 'Top tier dogfighting propulsion for interceptors.' },
  { id: 'engine_gen_s_travel_01_mk2_macro', name: 'Travel Engine Mk2', faction: 'General', slotSize: 'S', eqType: 'Engines', thrust: 1600, boost: 3.2, travel: 28.0, unlocked: true, desc: 'Optimized for high-speed interplanetary cruising.' },
  { id: 'engine_arg_m_allround_01_mk2_macro', name: 'Argon M All-Round Engine Mk2', faction: 'Argon', slotSize: 'M', eqType: 'Engines', thrust: 8400, boost: 3.9, travel: 16.0, unlocked: true, desc: 'Balanced medium vessel sub-light propulsion.' },
  { id: 'engine_ter_m_combat_01_mk3_macro', name: 'Terran M Combat Engine Mk3', faction: 'Terran', slotSize: 'M', eqType: 'Engines', thrust: 14200, boost: 6.2, travel: 18.0, unlocked: false, desc: 'High-thrust impulse drive giving Katana corvettes superior agility.' },
  { id: 'engine_spl_l_allround_01_mk1_macro', name: 'Split L All-Round Engine Mk1', faction: 'Split', slotSize: 'L', eqType: 'Engines', thrust: 42000, boost: 2.8, travel: 14.0, unlocked: false, desc: 'Aggressive capital thruster for fast forward charges.' },

  // Deployables & Drones
  { id: 'drone_cargo_01_macro', name: 'Cargo Drone', faction: 'General', slotSize: 'S', eqType: 'Deployables & Drones', capacity: 200, unlocked: true, desc: 'Automated freight loader transferring wares between ships and stations.' },
  { id: 'drone_repair_01_macro', name: 'Repair Drone', faction: 'General', slotSize: 'S', eqType: 'Deployables & Drones', capacity: 0, unlocked: true, desc: 'Autonomous nanite welding craft restoring hull and module integrity.' },
  { id: 'drone_defense_01_macro', name: 'Defense Drone', faction: 'General', slotSize: 'S', eqType: 'Deployables & Drones', capacity: 0, unlocked: true, desc: 'Autonomous combat drone screening hostiles.' },
  { id: 'deployable_sat_standard_macro', name: 'Navigation Satellite', faction: 'General', slotSize: 'S', eqType: 'Deployables & Drones', capacity: 0, unlocked: true, desc: 'Orbital satellite relaying real-time market trade prices and radar.' },
  { id: 'deployable_sat_advanced_macro', name: 'Advanced Satellite', faction: 'General', slotSize: 'M', eqType: 'Deployables & Drones', capacity: 0, unlocked: false, desc: 'Deep-space radar relay providing 75km sector visibility.' },
  { id: 'deployable_resource_probe_macro', name: 'Resource Probe', faction: 'General', slotSize: 'S', eqType: 'Deployables & Drones', capacity: 0, unlocked: true, desc: 'Spectral sensor reporting local ore, silicon, and gas yields for miners.' },
  { id: 'deployable_lasertower_01_macro', name: 'Laser Tower Mk1', faction: 'General', slotSize: 'S', eqType: 'Deployables & Drones', capacity: 0, unlocked: true, desc: 'Deployable defensive turret deterring pirate raids at jump gates.' }
];

const equipmentList = equipmentRaw.map(e => ({
  id: e.id,
  name: e.name,
  macro: e.id,
  group: 'equipment',
  subgroup: e.eqType,
  category: e.eqType,
  slotSize: e.slotSize,
  faction: e.faction,
  hull: 10000,
  unlocked: e.unlocked,
  description: e.desc,
  cost: { hullparts: 12, energycells: 20 },
  specs: {
    slotSize: `${e.slotSize} Mount`,
    dps: e.dps ? `${e.dps} DPS` : null,
    range: e.range ? `${(e.range / 1000).toFixed(1)} km` : null,
    capacity: e.capacity ? `${e.capacity.toLocaleString()} MJ` : null,
    recharge: e.rechargeRate ? `${e.rechargeRate} MW` : null,
    thrust: e.thrust ? `${e.thrust.toLocaleString()} kN` : null,
    travel: e.travel ? `${e.travel}x Multiplier` : null
  }
}));

// Combine into unified catalog
const allBlueprints = [
  ...modulesList,
  ...shipsList,
  ...equipmentList
];

const catalog = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  summary: {
    total: allBlueprints.length,
    owned: allBlueprints.filter(b => b.unlocked).length,
    modules: {
      total: modulesList.length,
      owned: modulesList.filter(b => b.unlocked).length
    },
    ships: {
      total: shipsList.length,
      owned: shipsList.filter(b => b.unlocked).length
    },
    equipment: {
      total: equipmentList.length,
      owned: equipmentList.filter(b => b.unlocked).length
    }
  },
  blueprints: allBlueprints
};

const outputPath = path.join(rootDir, 'src', 'data', 'blueprints_catalog.json');
fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`✅ Built comprehensive blueprints catalog:`);
console.log(`   - Modules: ${modulesList.length} (Owned: ${catalog.summary.modules.owned})`);
console.log(`   - Ships: ${shipsList.length} (Owned: ${catalog.summary.ships.owned})`);
console.log(`   - Equipment: ${equipmentList.length} (Owned: ${catalog.summary.equipment.owned})`);
console.log(`   - TOTAL: ${allBlueprints.length} blueprints (Total Owned: ${catalog.summary.owned})`);
