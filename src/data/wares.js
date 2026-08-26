import MODULE_BUILD_COSTS from '../crissian_build_costs.json';
import MODULE_NAMES from '../macro_names.json';

export function getFriendlyModuleName(macro) {
  if (MODULE_NAMES[macro]) return MODULE_NAMES[macro];
  if (MODULE_NAMES[macro.toLowerCase()]) return MODULE_NAMES[macro.toLowerCase()];

  let clean = macro.replace(/_macro$/i, '').replace(/_/g, ' ');
  return clean.replace(/\b\w/g, l => l.toUpperCase());
}

// X4 Wares Master Database (Commonwealth, Terran, Teladi, Paranid, Boron, Xenon, Avarice & Scrap Recycling)
export const WARES_DB = {
  // LEVEL 0: RAW MATERIALS, SCRAP FRAGMENTS & SPECIALTY LIQUIDS
  'EC': { name: 'Energy Cells', level: 0, cat: 'Solar Harvesting', source: 'Sunlight', baseRate: 10500, desc: 'Universal energy catalyst required by all station modules.' },
  'Ore': { name: 'Ore', level: 0, cat: 'Solid Mineral', source: 'Asteroid Fields', baseRate: 1, desc: 'Raw iron and titanium ore extracted from asteroids.' },
  'Silicon': { name: 'Silicon', level: 0, cat: 'Solid Mineral', source: 'Asteroid Fields', baseRate: 1, desc: 'Raw silicon crystals used in semiconductor production.' },
  'Ice': { name: 'Ice', level: 0, cat: 'Solid Mineral', source: 'Comets & Ice Belts', baseRate: 1, desc: 'Frozen water purified into drinking water and food supplies.' },
  'Methane': { name: 'Methane', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Hydrocarbon gas harvested from nebulae.' },
  'Hydrogen': { name: 'Hydrogen', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Volatile fuel gas for antimatter production.' },
  'Helium': { name: 'Helium', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Inert gas processed into superfluid coolants.' },
  'Protectyon': { name: 'Protectyon (Condensate)', level: 0, cat: 'Avarice Liquid Anomaly', source: 'Leap of Faith / Avarice Tide', baseRate: 1200, desc: 'Ultra-rare protective condensate harvested from Avarice tide nebulae. Protects stations against catastrophic solar tide bursts.' },
  'RawScrap': { name: 'Raw Scrap Fragments', level: 0, cat: 'Wreckage Debris', source: 'Battle Wrecks & Scrap Fields', baseRate: 1, desc: 'Raw starship wreckage and Allographyne metallic fragments towed by tug ships to scrap processors.' },

  // LEVEL 1: REFINED GOODS & RECYCLED SCRAP
  'Water': { name: 'Water', level: 1, cat: 'Refined Essential', baseRate: 5790, recipe: { 'Ice': 9600, 'EC': 1800 }, desc: 'Purified water for station workforce habitats.' },
  'RefMet': { name: 'Refined Metals / Teladianium', level: 1, cat: 'Refined Industrial', baseRate: 2112, recipe: { 'Ore': 5760, 'EC': 2160 }, desc: 'Standard structural alloy used throughout Commonwealth space.' },
  'SilWaf': { name: 'Silicon Wafers', level: 1, cat: 'Refined Tech', baseRate: 2140, recipe: { 'Silicon': 4800, 'EC': 1800 }, desc: 'Purified silicon plates for microchip manufacturing.' },
  'Graph': { name: 'Graphene', level: 1, cat: 'Refined Gas Product', baseRate: 1440, recipe: { 'Methane': 4800, 'EC': 1200 }, desc: 'High-strength carbon sheet used in hulls and composite armor.' },
  'AntiCell': { name: 'Antimatter Cells', level: 1, cat: 'Refined Energy', baseRate: 2970, recipe: { 'Hydrogen': 9600, 'EC': 3000 }, desc: 'Magnetic containment cells holding antimatter fuel.' },
  'SupCool': { name: 'Superfluid Coolant', level: 1, cat: 'Refined Liquid', baseRate: 1425, recipe: { 'Helium': 4800, 'EC': 900 }, desc: 'Cryogenic fluid used in high-power weapon systems.' },
  'MetMicrolatt': { name: 'Metallic Microlattice', level: 1, cat: 'Terran Basic', baseRate: 3800, recipe: { 'Ore': 1000, 'Helium': 2600, 'EC': 10500 }, desc: 'Ultra-lightweight structural frame material used by Terran Protectorate.' },
  'CompSubstrate': { name: 'Computronic Substrate', level: 1, cat: 'Terran High-Tech', baseRate: 588, recipe: { 'Ore': 18000, 'Silicon': 18000, 'Hydrogen': 12000, 'EC': 24000 }, desc: 'Supercomputing quantum substrate required for Terran capital ships.' },
  'ScrapMetal': { name: 'Scrap Metal', level: 1, cat: 'Refined Recycled Metal', baseRate: 60, recipe: { 'RawScrap': 10800, 'EC': 9600 }, desc: 'Processed scrap metal produced by Scrap Processors. Used by Scrap Recyclers to produce Hull Parts and Claytronics.' },
  'ProtPaste': { name: 'Protein Paste', level: 1, cat: 'Terran Food Base', baseRate: 2628, recipe: { 'Ice': 960, 'EC': 960, "Methane":2400 }, desc: 'Synthetic protein compound used for Terran workforce nutrition.' },

  // LEVEL 2: INTERMEDIATES & WORKFORCE PROVISIONS
  'HullParts': { name: 'Hull Parts', level: 2, cat: 'Structural Component', baseRate: 1176, recipe: { 'RefMet': 1120, 'Graph': 160, 'EC': 320 }, desc: 'Interlocking armored hull plates essential for ship and station builds.' },
  'EngParts': { name: 'Engine Parts', level: 2, cat: 'Propulsion Component', baseRate: 832, recipe: { 'RefMet': 384, 'AntiCell': 320, 'EC': 240 }, desc: 'Precision thruster assemblies and drive turbines.' },
  'Microchips': { name: 'Microchips', level: 2, cat: 'Electronics', baseRate: 432, recipe: { 'SilWaf': 1200, 'EC': 300 }, desc: 'Integrated circuits powering advanced avionics and claytronics.' },
  'QuanTubes': { name: 'Quantum Tubes', level: 2, cat: 'High-Tech Conduit', baseRate: 470, recipe: { 'Graph': 580, 'SupCool': 150, 'EC': 200 }, desc: 'Superconducting conduit tubes for field matrices.' },
  'PlasmaCond': { name: 'Plasma Conductors', level: 2, cat: 'Energy Conduit', baseRate: 176, recipe: { 'Graph': 384, 'SupCool': 560, 'EC': 240 }, desc: 'Heavy-duty energy lines for plasma weaponry and shields.' },
  'ScanArray': { name: 'Scanning Arrays', level: 2, cat: 'Sensory Gear', baseRate: 216, recipe: { 'SilWaf': 360, 'RefMet': 600, 'EC': 360 }, desc: 'Sensor arrays for long-range radar and targeting systems.' },
  'SmartChips': { name: 'Smart Chips', level: 2, cat: 'Autonomous Circuits', baseRate: 858, recipe: { 'SilWaf': 120, 'EC': 300 }, desc: 'Low-cost guidance microcontrollers for drones and torpedoes.' },
  'AdvComp': { name: 'Advanced Composites', level: 2, cat: 'Composite Plating', baseRate: 648, recipe: { 'RefMet': 960, 'Graph': 960, 'EC': 600 }, desc: 'Lightweight high-durability alloy for missile frames.' },
  'Meat': { name: 'Meat', level: 2, cat: 'Argon Agriculture', baseRate: 2320, recipe: { 'Water': 800, 'EC': 640 }, desc: 'Cultured meat for Argon Food Rations.' },
  'BoGas': { name: 'BoGas', level: 2, cat: 'Boron Refined Gas', baseRate: 2640, recipe: { 'Water': 2400, 'EC': 960 }, desc: 'Essential Boron gas compound refined for BoFu production.' },
  'SilCarbide': { name: 'Silicon Carbide', level: 2, cat: 'Terran Intermediate', baseRate: 576, recipe: { 'Silicon': 3600, 'Methane': 4800, 'EC': 2400, 'MetMicrolatt': 24 }, desc: 'High-density ceramic heat armor for Terran starships.' },
  'Spices': { name: 'Spices', level: 2, cat: 'Universal Seasoning', baseRate: 3000, recipe: { 'Water': 480, 'EC': 240 }, desc: 'Flavoring additives required for all racial food and medical supplies.' },
  'Wheat': { name: 'Wheat', level: 2, cat: 'Argon Agriculture', baseRate: 3720, recipe: { 'Water': 960, 'EC': 720 }, desc: 'High-yield cereal grain for Food Rations and Spacefuel.' },
  'Plankton': { name: 'Plankton', level: 2, cat: 'Boron Aquatic Agriculture', baseRate: 2475, recipe: { 'Water': 450, 'EC': 2880 }, desc: 'Nutrient-rich aquatic algae cultivated by Boron stations.' },
  'MajaSnails': { name: 'Maja Snails', level: 2, cat: 'Paranid Livestock', baseRate: 1168, recipe: { 'Water': 800, 'EC': 320 }, desc: 'Slow-growing Paranid mollusks for Soja Husk and Majalit.' },
  'SojaBeans': { name: 'Soja Beans', level: 2, cat: 'Paranid Crop', baseRate: 1248, recipe: { 'Water': 960, 'EC': 360 }, desc: 'High-protein Paranid crop for Soja Husk.' },
  'SunriseFlowers': { name: 'Sunrise Flowers', level: 2, cat: 'Teladi Crop', baseRate: 1200, recipe: { 'Water': 960, 'EC': 360 }, desc: 'Aromatic Teladi flora refined into Nostrop Oil.' },
  'SwampPlant': { name: 'Swamp Plant', level: 2, cat: 'Teladi Specialty Crop', baseRate: 960, recipe: { 'Water': 800, 'EC': 320 }, desc: 'Moist Teladi crop refined into Spaceweed.' },
  'TerranMRE': { name: 'Terran MRE', level: 2, cat: 'Terran Provisions', baseRate: 2625, recipe: { 'ProtPaste': 900, 'EC': 900 }, desc: 'Standard Meal Ready to Eat for Terran station personnel.' },
  'Spaceweed': { name: 'Spaceweed', level: 2, cat: 'Teladi Trade / Illegal', baseRate: 600, recipe: { 'SwampPlant': 1200, 'Spices': 600, 'EC': 1200 }, desc: 'High-margin narcotic trade favored by Teladi traders.' },
  'Spacefuel': { name: 'Spacefuel', level: 2, cat: 'Argon Trade / Illegal', baseRate: 600, recipe: { 'Wheat': 1200, 'Water': 600, 'EC': 1200 }, desc: 'Illicit alcoholic beverage traded at pirate bases and trade hubs.' },

  // LEVEL 3: HIGH-TECH COMPONENTS
  'AntiConv': { name: 'Antimatter Converters', level: 3, cat: 'Power Converters', baseRate: 1596, recipe: { 'Microchips': 360, 'AdvComp': 240, 'AntiCell': 320, 'EC': 960 }, desc: 'Power step-down transformers for high-yield engines.' },
  'Claytronics': { name: 'Claytronics', level: 3, cat: 'Nanotech Assemblies', baseRate: 432, recipe: { 'Microchips': 640, 'QuanTubes': 400, 'EC': 560 }, desc: 'Programmable nanites required to build all station modules.' },
  'AdvElec': { name: 'Advanced Electronics', level: 3, cat: 'Computers & Avionics', baseRate: 270, recipe: { 'Microchips': 220, 'QuanTubes': 100, 'EC': 300 }, desc: 'Command computers and mainframes for capital ships.' },
  'FieldCoils': { name: 'Field Coils', level: 3, cat: 'Magnetic Systems', baseRate: 1050, recipe: { 'PlasmaCond': 240, 'QuanTubes': 258, 'EC': 360 }, desc: 'Magnetic field generators for shields and heavy weaponry.' },
  'ShieldComp': { name: 'Shield Components', level: 3, cat: 'Defense Tech', baseRate: 579, recipe: { 'PlasmaCond': 60, 'QuanTubes': 60, 'EC': 210 }, desc: 'Emitters and capacitors forming starship shields.' },
  'WeapComp': { name: 'Weapon Components', level: 3, cat: 'Military Systems', baseRate: 340, recipe: { 'PlasmaCond': 60, 'HullParts': 40, 'EC': 120 }, desc: 'Barrels, heat sinks, and focus lenses for ship weaponry.' },
  'TurrComp': { name: 'Turret Components', level: 3, cat: 'Military Systems', baseRate: 340, recipe: { 'ScanArray': 20, 'Microchips': 40, 'QuanTubes': 40, 'EC': 120 }, desc: 'Rotational gimbal mounts for defensive turrets.' },
  'MissComp': { name: 'Missile Components', level: 3, cat: 'Munitions', baseRate: 1124, recipe: { 'AdvComp': 8, 'HullParts': 8, 'EC': 80 }, desc: 'Guidance fins and warheads for ordnance.' },
  'DroneComp': { name: 'Drone Components', level: 3, cat: 'Autonomous Tech', baseRate: 315, recipe: { 'Microchips': 60, 'ScanArray': 120, 'EngParts': 60, 'HullParts': 60, 'EC': 180 }, desc: 'Framework assemblies for building defense and cargo drones.' },
  'FoodRations': { name: 'Food Rations', level: 3, cat: 'Argon Food', baseRate: 6900, recipe: { 'Wheat': 600, 'Meat': 600, 'Spices': 600, 'EC': 1500 }, desc: 'Nutritional food packs for Argon workforce habitats.' },
  'MedicalSupplies': { name: 'Medical Supplies', level: 3, cat: 'Workforce Healthcare', baseRate: 2496, recipe: { 'Water': 720, 'Spices': 480, 'EC': 1200, 'Wheat' : 360}, desc: 'Pharmaceuticals required to maintain maximum workforce health and +50% station efficiency.' },
  'BoFu': { name: 'BoFu', level: 3, cat: 'Boron Primary Food', baseRate: 1230, recipe: { 'BoGas': 600, 'Plankton': 1800, 'EC': 600 }, desc: 'Primary nutritional paste required for Boron workforce habitats.' },
  'SojaHusk': { name: 'Soja Husk', level: 3, cat: 'Paranid Food', baseRate: 4200, recipe: { 'SojaBeans': 480, 'MajaSnails': 600, 'EC': 960, 'Spices':240 }, desc: 'Nutritional husk for Paranid workforce habitats.' },
  'NostropOil': { name: 'Nostrop Oil', level: 3, cat: 'Teladi Food', baseRate: 6000, recipe: { 'SunriseFlowers': 480, 'Spices': 480, 'EC': 1200, 'Water' : 720 }, desc: 'Primary food provision required for Teladi workforce habitats.' },
  'MajaDust': { name: 'Maja Dust', level: 3, cat: 'Paranid Trade / Illegal', baseRate: 384, recipe: { 'MajaSnails': 720, 'Spices': 360, 'EC': 240 }, desc: 'Illicit Paranid narcotic extracted from crushed Maja Snails.' },

  // LEVEL 4: FINAL APPLICATIONS & HQ MODULES
  'StationConst': { name: 'Station Modules Expansion', level: 4, cat: 'Build Storage', baseRate: 1, recipe: { 'Claytronics': 100, 'HullParts': 250, 'EC': 500, 'Protectyon': 50 }, desc: 'Station construction requirements and Avarice tide shielding.' },
  'ShipChassis': { name: 'Ship Hulls & Propulsion', level: 4, cat: 'Wharf / Shipyard', baseRate: 1, recipe: { 'HullParts': 300, 'EngParts': 100 }, desc: 'Commonwealth shipyard manufacturing.' },
  'TerranShipyard': { name: 'Terran Shipyard Assembly', level: 4, cat: 'Terran Wharf / Shipyard', baseRate: 1, recipe: { 'CompSubstrate': 80, 'SilCarbide': 150, 'MetMicrolatt': 300 }, desc: 'Terran Protectorate L, M, and XL ship manufacturing.' },
  'AdminClaim': { name: 'Administrative Sector Claim', level: 4, cat: 'HQ & Sector Ownership', baseRate: 1, recipe: { 'HullParts': 500, 'Claytronics': 200 }, desc: 'Establishes faction sector control and administrative ownership in X4.' },
  'WelfareHub': { name: 'Welfare & Morale (Gambling Hall)', level: 4, cat: 'Workforce Morale', baseRate: 1, recipe: { 'NostropOil': 100, 'MedicalSupplies': 100 }, desc: 'Gambling hall and casino modules boosting station workforce happiness.' },
  'BoronArtAcademy': { name: 'Boron Art Academy (Welfare)', level: 4, cat: 'Boron Morale', baseRate: 1, recipe: { 'BoFu': 100, 'MedicalSupplies': 100 }, desc: 'Boron cultural art academy boosting Boron workforce morale and happiness.' },
  'ShipWeapons': { name: 'Ship Guns & Turrets', level: 4, cat: 'Equipment Dock', baseRate: 1, recipe: { 'WeapComp': 50, 'TurrComp': 50, 'FieldCoils': 25 }, desc: 'Weapon outfitting.' },
  'ShipShields': { name: 'Shields & Avionics', level: 4, cat: 'Equipment Dock', baseRate: 1, recipe: { 'ShieldComp': 40, 'AdvElec': 20, 'AntiConv': 15, 'Protectyon': 30 }, desc: 'Shield & computer outfitting with Protectyon tide shielding.' },
  'FleetConsumables': { name: 'Drones & Ordnance', level: 4, cat: 'Consumables', baseRate: 1, recipe: { 'SmartChips': 20, 'MissComp': 40, 'ScanArray': 10 }, desc: 'Munitions & drone outfitting.' }
};

// Comprehensive X4 Structures Folder Macro Mapping (assets/structures/*_macro)
export const MACRO_TO_WARE = {
  // Production Modules (assets/structures/production/*_macro & processing/*_macro)
  'prod_gen_refinedmetals_macro': 'RefMet',
  'prod_tel_teladianium_macro': 'RefMet',
  'prod_par_refinedmetals_macro': 'RefMet',
  'prod_gen_siliconwafers_macro': 'SilWaf',
  'prod_tel_siliconwafers_macro': 'SilWaf',
  'prod_gen_graphene_macro': 'Graph',
  'prod_gen_antimattercells_macro': 'AntiCell',
  'prod_gen_superfluidcoolant_macro': 'SupCool',
  'prod_gen_water_macro': 'Water',
  'prod_gen_energycells_macro': 'EC',
  'prod_ter_energycells_macro': 'EC',
  'xenon_small_station_01_solarpanel_01_macro': 'EC',

  'prod_gen_hullparts_macro': 'HullParts',
  'prod_tel_hullparts_macro': 'HullParts',
  'prod_par_hullparts_macro': 'HullParts',
  'prod_split_hullparts_macro': 'HullParts',
  'prod_gen_engineparts_macro': 'EngParts',
  'prod_tel_engineparts_macro': 'EngParts',
  'prod_par_engineparts_macro': 'EngParts',
  'prod_gen_microchips_macro': 'Microchips',
  'prod_gen_quantumtubes_macro': 'QuanTubes',
  'prod_gen_plasmaconductors_macro': 'PlasmaCond',
  'prod_gen_scanningarrays_macro': 'ScanArray',
  'prod_tel_scanningarrays_macro': 'ScanArray',
  'prod_gen_advancedcomposites_macro': 'AdvComp',

  'prod_gen_claytronics_macro': 'Claytronics',
  'prod_gen_advancedelectronics_macro': 'AdvElec',
  'prod_gen_fieldcoils_macro': 'FieldCoils',
  'prod_gen_shieldcomponents_macro': 'ShieldComp',
  'prod_gen_weaponcomponents_macro': 'WeapComp',
  'prod_gen_turretcomponents_macro': 'TurrComp',
  'prod_gen_missilecomponents_macro': 'MissComp',
  'prod_gen_smartchips_macro': 'SmartChips',
  'prod_gen_antimatterconverters_macro': 'AntiConv',
  'prod_gen_dronecomponents_macro': 'DroneComp',

  // Scrap Recycling & Scrap Processors (assets/structures/processing/*_macro)
  'prod_gen_scrapprocessor_macro': 'ScrapMetal',
  'prod_ter_scrapprocessor_macro': 'ScrapMetal',
  'prod_gen_scraprecycler_macro': 'HullParts',
  'prod_ter_scraprecycler_macro': 'HullParts',

  // Food, Agriculture, Medical & Illicit Macros
  'prod_tel_nostropoil_macro': 'NostropOil',
  'prod_tel_sunriseflowers_macro': 'SunriseFlowers',
  'prod_tel_swampplant_macro': 'SwampPlant',
  'prod_tel_spaceweed_macro': 'Spaceweed',
  'prod_arg_foodrations_macro': 'FoodRations',
  'prod_arg_wheat_macro': 'Wheat',
  'prod_arg_meat_macro': 'Meat',
  'prod_gen_spices_macro': 'Spices',
  'prod_arg_spacefuel_macro': 'Spacefuel',
  'prod_gen_spacefuel_macro': 'Spacefuel',
  'prod_arg_medicalsupplies_macro': 'MedicalSupplies',
  'prod_par_medicalsupplies_macro': 'MedicalSupplies',
  'prod_tel_medicalsupplies_macro': 'MedicalSupplies',
  'prod_bor_medicalsupplies_macro': 'MedicalSupplies',
  'prod_split_medicalsupplies_macro': 'MedicalSupplies',
  'prod_par_sojahusk_macro': 'SojaHusk',
  'prod_par_sojabeans_macro': 'SojaBeans',
  'prod_par_majasnails_macro': 'MajaSnails',
  'prod_bor_bofu_macro': 'BoFu',
  'prod_bor_bogas_macro': 'BoGas',
  'prod_bor_plankton_macro': 'Plankton',

  // Xenon & Terran Macros
  'prod_xen_siliconmatrix_macro': 'SilMatrix',
  'prod_xen_orematrix_macro': 'OreMatrix',
  'prod_xen_processingunit_macro': 'ProcessingUnit',
  'prod_ter_metallicmicrolattice_macro': 'MetMicrolatt',
  'prod_ter_siliconcarbide_macro': 'SilCarbide',
  'prod_ter_computronicsubstrate_macro': 'CompSubstrate',
  'prod_ter_proteinpaste_macro': 'ProtPaste',
  'prod_ter_mre_macro': 'TerranMRE',
  'prod_ter_terranmre_macro': 'TerranMRE',
  'prod_ava_protectyon_macro': 'Protectyon',
  'struct_ava_protectyon_collector_macro': 'Protectyon',

  // Build Modules & Shipyards (assets/structures/buildmodule/*_macro)
  'buildmodule_arg_wharf_macro': 'ShipChassis',
  'buildmodule_arg_ships_l_macro': 'ShipChassis',
  'buildmodule_arg_ships_xl_macro': 'ShipChassis',
  'buildmodule_tel_wharf_macro': 'ShipChassis',
  'buildmodule_tel_shipyard_macro': 'ShipChassis',
  'buildmodule_par_wharf_macro': 'ShipChassis',
  'buildmodule_par_shipyard_macro': 'ShipChassis',
  'buildmodule_split_wharf_macro': 'ShipChassis',
  'buildmodule_split_shipyard_macro': 'ShipChassis',
  'buildmodule_bor_wharf_macro': 'ShipChassis',
  'buildmodule_bor_shipyard_macro': 'ShipChassis',
  'buildmodule_ter_wharf_macro': 'TerranShipyard',
  'buildmodule_ter_shipyard_macro': 'TerranShipyard',
  'buildmodule_ter_ships_l_macro': 'TerranShipyard',
  'buildmodule_ter_ships_xl_macro': 'TerranShipyard',
  'buildmodule_xen_ships_xl_macro': 'XenShipyard',
  'buildmodule_xen_wharf_macro': 'XenShipyard',

  // Faction Logic / Administrative Claims & Cores (assets/structures/factionlogic/*_macro & admin)
  'defence_par_claim_story_01_macro': 'AdminClaim',
  'struct_gen_admin_01_macro': 'AdminClaim',
  'struct_arg_admin_01_macro': 'AdminClaim',
  'struct_tel_admin_01_macro': 'AdminClaim',
  'struct_par_admin_01_macro': 'AdminClaim',
  'struct_ter_admin_01_macro': 'AdminClaim',
  'struct_split_admin_01_macro': 'AdminClaim',
  'struct_bor_admin_01_macro': 'AdminClaim',
  'struct_xen_admin_01_macro': 'AdminClaim',

  // Welfare & Morale Modules (assets/structures/welfare/*_macro)
  'struct_tel_gamblinghall_macro': 'WelfareHub',
  'struct_gen_welfare_macro': 'WelfareHub',
  'struct_arg_casino_macro': 'WelfareHub',
  'struct_par_sanctuary_macro': 'WelfareHub',
  'struct_bor_artacademy_macro': 'BoronArtAcademy'
};

// Presets
export const PRESET_BLUEPRINTS = {
  'ormac_paranid_hq': {
    name: 'Ormac Paranid HQ.xml (Paranid Sector Claim & Faction Capital)',
    label: '👁️ Ormac Paranid HQ',
    totalModules: 63,
    type: 'Paranid Faction Capital HQ (3,750 Paranid Workforce Capacity & Fleet Outfitting)',
    modules: {
      'AdminClaim': 1,
      'WelfareHub': 1,
      'ShipChassis': 2,
      'ShipWeapons': 2,
      'ShipShields': 2,
      'FleetConsumables': 2,
      'SojaHusk': 4,
      'MedicalSupplies': 2,
      'SojaBeans': 4,
      'MajaSnails': 4,
      'Spices': 2,
      'Water': 2,
      'EC': 6
    },
    rawMacros: {
      'defence_par_claim_story_01_macro': 1,
      'dockarea_arg_m_station_02_hightech_macro': 3,
      'hab_par_l_01_macro': 3,
      'hab_par_m_01_macro': 3,
      'pier_par_harbor_03_macro': 2,
      'radar_arg_dish_01_macro': 1,
      'storage_par_s_container_01_macro': 6,
      'struct_gen_observationdeck_02_macro': 1,
      'struct_gen_observationdeck_03_macro': 1,
      'struct_par_base_01_macro': 3,
      'struct_par_base_02_macro': 3,
      'struct_par_base_03_macro': 6,
      'struct_par_cross_01_macro': 6,
      'struct_par_cross_02_macro': 3,
      'struct_par_cross_03_macro': 18,
      'struct_par_vertical_01_macro': 1
    }
  },
  'teladi_hq': {
    name: 'Teladi HQ.xml (Teladi Administrative Sector Claim & Trade Hub)',
    label: '🚀 Teladi HQ',
    totalModules: 80,
    type: 'Teladi Faction HQ (3,750 Teladi Workforce Capacity)',
    modules: {
      'AdminClaim': 1,
      'WelfareHub': 1,
      'NostropOil': 4,
      'MedicalSupplies': 2,
      'SunriseFlowers': 4,
      'Spices': 2,
      'Water': 2,
      'EC': 6
    },
    rawMacros: {
      'struct_tel_admin_01_macro': 1,
      'struct_tel_gamblinghall_macro': 1,
      'hab_tel_l_01_macro': 3,
      'hab_tel_m_01_macro': 3,
      'prod_tel_nostropoil_macro': 4,
      'prod_tel_medicalsupplies_macro': 2,
      'prod_tel_sunriseflowers_macro': 4,
      'prod_gen_spices_macro': 2,
      'prod_gen_water_macro': 2,
      'prod_gen_energycells_macro': 6
    }
  },
  'xen_hq': {
    name: 'adeine__xen_hq_no_tl.xml (Xenon Shipyard & Sector HQ)',
    label: '🤖 Xenon HQ',
    totalModules: 242,
    type: 'Xenon Megastructure Shipyard (3 XL Bays, 15 Solar Collectors)',
    modules: {
      'XenShipyard': 3,
      'ProcessingUnit': 8,
      'SilMatrix': 12,
      'OreMatrix': 12,
      'EC': 15
    },
    rawMacros: {
      'buildmodule_xen_ships_xl_macro': 3,
      'prod_xen_processingunit_macro': 8,
      'prod_xen_siliconmatrix_macro': 12,
      'prod_xen_orematrix_macro': 12,
      'xenon_small_station_01_solarpanel_01_macro': 15
    }
  },
  'atreus_hq': {
    name: 'ComfyCo_Atreus_Headquarters.xml (Boron Atreus HQ)',
    label: '🌊 Atreus HQ',
    totalModules: 48,
    type: 'Boron Faction Headquarters & Sector Claim Hub',
    modules: {
      'AdminClaim': 2,
      'BoronArtAcademy': 2,
      'WelfareHub': 2,
      'BoFu': 2,
      'MedicalSupplies': 2,
      'EC': 6
    },
    rawMacros: {
      'struct_bor_admin_01_macro': 2,
      'struct_bor_artacademy_macro': 2,
      'struct_gen_welfare_macro': 2,
      'hab_bor_l_01_macro': 3,
      'prod_bor_bofu_macro': 2,
      'prod_bor_medicalsupplies_macro': 2,
      'prod_gen_energycells_macro': 6
    }
  },
  'ter_shipyard': {
    name: 'TER Shipyard.xml (Terran Shipyard)',
    label: '🚀 TER Shipyard',
    totalModules: 37,
    type: 'Terran Shipyard (4L, 3M, 2XL Docks)',
    modules: {
      'CompSubstrate': 8,
      'SilCarbide': 12,
      'MetMicrolatt': 24,
      'EC': 16
    },
    rawMacros: {
      'buildmodule_ter_shipyard_macro': 2,
      'buildmodule_ter_wharf_macro': 1,
      'prod_ter_computronicsubstrate_macro': 8,
      'prod_ter_siliconcarbide_macro': 12,
      'prod_ter_metallicmicrolattice_macro': 24,
      'prod_ter_energycells_macro': 16
    }
  },
  'megastation': {
    name: 'MegaStation.xml Blueprint',
    label: '🚀 MegaStation',
    totalModules: 5838,
    type: 'Commonwealth MegaStation',
    modules: {
      'RefMet': 60, 'SilWaf': 90, 'Graph': 67, 'AntiCell': 20, 'SupCool': 31, 'Water': 26, 'EC': 72,
      'HullParts': 112, 'EngParts': 27, 'Microchips': 188, 'QuanTubes': 110, 'PlasmaCond': 58, 'ScanArray': 21, 'AdvComp': 13,
      'Claytronics': 118, 'AdvElec': 35, 'FieldCoils': 35, 'ShieldComp': 35, 'WeapComp': 25, 'TurrComp': 44, 'MissComp': 25, 'SmartChips': 55, 'AntiConv': 20
    },
    rawMacros: {
      'prod_gen_refinedmetals_macro': 60, 'prod_gen_siliconwafers_macro': 90, 'prod_gen_graphene_macro': 67,
      'prod_gen_antimattercells_macro': 20, 'prod_gen_superfluidcoolant_macro': 31, 'prod_gen_water_macro': 26, 'prod_gen_energycells_macro': 72,
      'prod_gen_hullparts_macro': 112, 'prod_gen_engineparts_macro': 27, 'prod_gen_microchips_macro': 188,
      'prod_gen_quantumtubes_macro': 110, 'prod_gen_plasmaconductors_macro': 58, 'prod_gen_scanningarrays_macro': 21,
      'prod_gen_advancedcomposites_macro': 13, 'prod_gen_claytronics_macro': 118, 'prod_gen_advancedelectronics_macro': 35,
      'prod_gen_fieldcoils_macro': 35, 'prod_gen_shieldcomponents_macro': 35, 'prod_gen_weaponcomponents_macro': 25,
      'prod_gen_turretcomponents_macro': 44, 'prod_gen_missilecomponents_macro': 25, 'prod_gen_smartchips_macro': 55, 'prod_gen_antimatterconverters_macro': 20
    }
  }
};

// Filter out deleted presets from localStorage
try {
  const deletedPresets = JSON.parse(localStorage.getItem('x4_deleted_presets') || '[]');
  deletedPresets.forEach(key => {
    delete PRESET_BLUEPRINTS[key];
  });
} catch (e) {
  console.error('Error reading localStorage deleted presets', e);
}

export const DEPENDENCIES = [
  // L0 -> L1
  { from: 'Ore', to: 'RefMet' },
  { from: 'EC', to: 'RefMet' },
  { from: 'Silicon', to: 'SilWaf' },
  { from: 'EC', to: 'SilWaf' },
  { from: 'Methane', to: 'Graph' },
  { from: 'EC', to: 'Graph' },
  { from: 'Hydrogen', to: 'AntiCell' },
  { from: 'EC', to: 'AntiCell' },
  { from: 'Helium', to: 'SupCool' },
  { from: 'EC', to: 'SupCool' },
  { from: 'Ice', to: 'Water' },
  { from: 'EC', to: 'Water' },
  { from: 'Ore', to: 'MetMicrolatt' },
  { from: 'Helium', to: 'MetMicrolatt' },
  { from: 'EC', to: 'MetMicrolatt' },
  { from: 'Ice', to: 'ProtPaste' },
  { from: 'EC', to: 'ProtPaste' },
  { from: 'Silicon', to: 'SilMatrix' },
  { from: 'EC', to: 'SilMatrix' },
  { from: 'Ore', to: 'OreMatrix' },
  { from: 'EC', to: 'OreMatrix' },
  { from: 'RawScrap', to: 'ScrapMetal' },
  { from: 'EC', to: 'ScrapMetal' },

  // L1 -> L2
  { from: 'Water', to: 'SunriseFlowers' },
  { from: 'EC', to: 'SunriseFlowers' },
  { from: 'Water', to: 'SwampPlant' },
  { from: 'EC', to: 'SwampPlant' },
  { from: 'Water', to: 'Wheat' },
  { from: 'EC', to: 'Wheat' },
  { from: 'Water', to: 'Spices' },
  { from: 'EC', to: 'Spices' },
  { from: 'Water', to: 'SojaBeans' },
  { from: 'EC', to: 'SojaBeans' },
  { from: 'Water', to: 'Meat' },
  { from: 'EC', to: 'Meat' },
  { from: 'Water', to: 'MajaSnails' },
  { from: 'EC', to: 'MajaSnails' },
  { from: 'Water', to: 'BoGas' },
  { from: 'EC', to: 'BoGas' },
  { from: 'Water', to: 'Plankton' },
  { from: 'EC', to: 'Plankton' },
  { from: 'RefMet', to: 'HullParts' },
  { from: 'ScrapMetal', to: 'HullParts' },
  { from: 'Graph', to: 'HullParts' },
  { from: 'EC', to: 'HullParts' },
  { from: 'RefMet', to: 'EngParts' },
  { from: 'AntiCell', to: 'EngParts' },
  { from: 'EC', to: 'EngParts' },
  { from: 'SilWaf', to: 'Microchips' },
  { from: 'EC', to: 'Microchips' },
  { from: 'Graph', to: 'QuanTubes' },
  { from: 'SupCool', to: 'QuanTubes' },
  { from: 'EC', to: 'QuanTubes' },
  { from: 'Graph', to: 'PlasmaCond' },
  { from: 'SupCool', to: 'PlasmaCond' },
  { from: 'EC', to: 'PlasmaCond' },
  { from: 'SilWaf', to: 'ScanArray' },
  { from: 'RefMet', to: 'ScanArray' },
  { from: 'EC', to: 'ScanArray' },
  { from: 'RefMet', to: 'AdvComp' },
  { from: 'Graph', to: 'AdvComp' },
  { from: 'EC', to: 'AdvComp' },
  { from: 'Silicon', to: 'SilCarbide' },
  { from: 'Methane', to: 'SilCarbide' },
  { from: 'MetMicrolatt', to: 'SilCarbide' },
  { from: 'ScrapMetal', to: 'SilCarbide' },
  { from: 'EC', to: 'SilCarbide' },
  { from: 'ProtPaste', to: 'TerranMRE' },
  { from: 'EC', to: 'TerranMRE' },
  { from: 'SunriseFlowers', to: 'NostropOil' },
  { from: 'Spices', to: 'NostropOil' },
  { from: 'EC', to: 'NostropOil' },
  { from: 'Wheat', to: 'FoodRations' },
  { from: 'Meat', to: 'FoodRations' },
  { from: 'Spices', to: 'FoodRations' },
  { from: 'EC', to: 'FoodRations' },
  { from: 'Water', to: 'MedicalSupplies' },
  { from: 'Spices', to: 'MedicalSupplies' },
  { from: 'EC', to: 'MedicalSupplies' },
  { from: 'BoGas', to: 'MedicalSupplies' },
  { from: 'SwampPlant', to: 'Spaceweed' },
  { from: 'Spices', to: 'Spaceweed' },
  { from: 'EC', to: 'Spaceweed' },
  { from: 'Wheat', to: 'Spacefuel' },
  { from: 'Water', to: 'Spacefuel' },
  { from: 'EC', to: 'Spacefuel' },

  // L2 -> L3
  { from: 'BoGas', to: 'BoFu' },
  { from: 'Plankton', to: 'BoFu' },
  { from: 'EC', to: 'BoFu' },
  { from: 'MajaSnails', to: 'MajaDust' },
  { from: 'Spices', to: 'MajaDust' },
  { from: 'EC', to: 'MajaDust' },
  { from: 'SojaBeans', to: 'SojaHusk' },
  { from: 'MajaSnails', to: 'SojaHusk' },
  { from: 'EC', to: 'SojaHusk' },
  { from: 'Microchips', to: 'Claytronics' },
  { from: 'ScrapMetal', to: 'Claytronics' },
  { from: 'QuanTubes', to: 'Claytronics' },
  { from: 'EC', to: 'Claytronics' },
  { from: 'Microchips', to: 'AdvElec' },
  { from: 'QuanTubes', to: 'AdvElec' },
  { from: 'EC', to: 'AdvElec' },
  { from: 'PlasmaCond', to: 'FieldCoils' },
  { from: 'QuanTubes', to: 'FieldCoils' },
  { from: 'EC', to: 'FieldCoils' },
  { from: 'PlasmaCond', to: 'ShieldComp' },
  { from: 'QuanTubes', to: 'ShieldComp' },
  { from: 'EC', to: 'ShieldComp' },
  { from: 'PlasmaCond', to: 'WeapComp' },
  { from: 'HullParts', to: 'WeapComp' },
  { from: 'EC', to: 'WeapComp' },
  { from: 'ScanArray', to: 'TurrComp' },
  { from: 'Microchips', to: 'TurrComp' },
  { from: 'QuanTubes', to: 'TurrComp' },
  { from: 'EC', to: 'TurrComp' },
  { from: 'AdvComp', to: 'MissComp' },
  { from: 'HullParts', to: 'MissComp' },
  { from: 'EC', to: 'MissComp' },
  { from: 'SilWaf', to: 'SmartChips' },
  { from: 'EC', to: 'SmartChips' },
  { from: 'Microchips', to: 'AntiConv' },
  { from: 'AdvComp', to: 'AntiConv' },
  { from: 'AntiCell', to: 'AntiConv' },
  { from: 'EC', to: 'AntiConv' },
  { from: 'Ore', to: 'CompSubstrate' },
  { from: 'Silicon', to: 'CompSubstrate' },
  { from: 'Hydrogen', to: 'CompSubstrate' },
  { from: 'ScrapMetal', to: 'CompSubstrate' },
  { from: 'EC', to: 'CompSubstrate' },
  { from: 'Microchips', to: 'DroneComp' },
  { from: 'ScanArray', to: 'DroneComp' },
  { from: 'EngParts', to: 'DroneComp' },
  { from: 'HullParts', to: 'DroneComp' },
  { from: 'EC', to: 'DroneComp' },
  { from: 'SilMatrix', to: 'ProcessingUnit' },
  { from: 'EC', to: 'ProcessingUnit' },

  // L3 -> L4 & L0 -> L4
  { from: 'Claytronics', to: 'StationConst' },
  { from: 'HullParts', to: 'StationConst' },
  { from: 'Protectyon', to: 'StationConst' },
  { from: 'HullParts', to: 'ShipChassis' },
  { from: 'EngParts', to: 'ShipChassis' },
  { from: 'CompSubstrate', to: 'TerranShipyard' },
  { from: 'SilCarbide', to: 'TerranShipyard' },
  { from: 'MetMicrolatt', to: 'TerranShipyard' },
  { from: 'ProcessingUnit', to: 'XenShipyard' },
  { from: 'SilMatrix', to: 'XenShipyard' },
  { from: 'OreMatrix', to: 'XenShipyard' },
  { from: 'HullParts', to: 'AdminClaim' },
  { from: 'Claytronics', to: 'AdminClaim' },
  { from: 'NostropOil', to: 'WelfareHub' },
  { from: 'MedicalSupplies', to: 'WelfareHub' },
  { from: 'BoFu', to: 'BoronArtAcademy' },
  { from: 'MedicalSupplies', to: 'BoronArtAcademy' },
  { from: 'WeapComp', to: 'ShipWeapons' },
  { from: 'TurrComp', to: 'ShipWeapons' },
  { from: 'FieldCoils', to: 'ShipWeapons' },
  { from: 'ShieldComp', to: 'ShipShields' },
  { from: 'AdvElec', to: 'ShipShields' },
  { from: 'AntiConv', to: 'ShipShields' },
  { from: 'Protectyon', to: 'ShipShields' },
  { from: 'MissComp', to: 'FleetConsumables' },
  { from: 'SmartChips', to: 'FleetConsumables' },
  { from: 'ScanArray', to: 'FleetConsumables' }
];

export function mapMacroToWare(macro) {
  const lowerMacro = macro.toLowerCase();
  if (MACRO_TO_WARE[macro]) return MACRO_TO_WARE[macro];
  if (MACRO_TO_WARE[lowerMacro]) return MACRO_TO_WARE[lowerMacro];

  if (lowerMacro.includes('claim') || lowerMacro.includes('admin')) return 'AdminClaim';
  if (lowerMacro.includes('gamblinghall') || lowerMacro.includes('welfare') || lowerMacro.includes('casino') || lowerMacro.includes('sanctuary')) return 'WelfareHub';
  if (lowerMacro.includes('artacademy')) return 'BoronArtAcademy';
  if (lowerMacro.includes('scrapprocessor')) return 'ScrapMetal';
  if (lowerMacro.includes('scraprecycler')) return 'HullParts';
  if (lowerMacro.includes('shipyard') || lowerMacro.includes('wharf')) {
    if (lowerMacro.includes('ter')) return 'TerranShipyard';
    if (lowerMacro.includes('xen')) return 'XenShipyard';
    return 'ShipChassis';
  }
  if (lowerMacro.includes('solarpanel') || lowerMacro.includes('energycell')) return 'EC';
  if (lowerMacro.includes('protectyon') || lowerMacro.includes('condensate')) return 'Protectyon';

  return null;
}

export function isFoodOrAgriMacro(macro) {
  const lower = macro.toLowerCase();
  if (lower.includes('hab_') || lower.includes('habitat') || lower.includes('dome')) {
    return false;
  }
  if (lower.includes('soja') || lower.includes('majasnail') || lower.includes('nostrop') || lower.includes('sunriseflower') || lower.includes('swampplant') || lower.includes('foodration') || lower.includes('wheat') || lower.includes('meat') || lower.includes('spice') || lower.includes('bofu') || lower.includes('bogas') || lower.includes('plankton') || lower.includes('proteinpaste') || lower.includes('medicalsupplies') || lower.includes('terranmre')) {
    return true;
  }

  const wareId = mapMacroToWare(macro);
  if (!wareId) return false;

  const ware = WARES_DB[wareId];
  if (!ware) return false;

  const foodAgriWares = [
    'SojaHusk', 'SojaBeans', 'MajaSnails', 'MajaDust', 'MedicalSupplies',
    'NostropOil', 'SunriseFlowers', 'SwampPlant', 'Spaceweed',
    'FoodRations', 'Wheat', 'Meat', 'Spices', 'Spacefuel',
    'BoFu', 'BoGas', 'Plankton',
    'TerranMRE', 'ProtPaste'
  ];

  if (foodAgriWares.includes(wareId)) return true;

  const cat = (ware.cat || '').toLowerCase();
  if (cat.includes('food') || cat.includes('agri') || cat.includes('crop') || cat.includes('livestock') || cat.includes('provisions') || cat.includes('healthcare') || cat.includes('seasoning') || cat.includes('aquatic')) {
    return true;
  }

  return false;
}

export function getModuleBuildCost(macro, qty, factionConstructionMethod = 'commonwealth') {
  let cost = { claytronics: 0, hullparts: 0, ec: 0, compSubstrate: 0, silCarbide: 0, metMicrolatt: 0, protectyon: 0, water: 0 };

  let targetMacro = macro;
  if (macro.includes('_gen_')) {
    if (factionConstructionMethod === 'terran') {
      const ter = macro.replace('_gen_', '_ter_');
      if (MODULE_BUILD_COSTS[ter]) targetMacro = ter;
    } else if (factionConstructionMethod === 'boron') {
      const bor = macro.replace('_gen_', '_bor_');
      if (MODULE_BUILD_COSTS[bor]) targetMacro = bor;
    }
  }

  const exactCost = MODULE_BUILD_COSTS[targetMacro] || MODULE_BUILD_COSTS[targetMacro.toLowerCase()] || MODULE_BUILD_COSTS[macro] || MODULE_BUILD_COSTS[macro.toLowerCase()];

  if (exactCost) {
    if (exactCost.claytronics) cost.claytronics = exactCost.claytronics * qty;
    if (exactCost.hullparts) cost.hullparts = exactCost.hullparts * qty;
    if (exactCost.energycells) cost.ec = exactCost.energycells * qty;
    if (exactCost.computronicsubstrate) cost.compSubstrate = exactCost.computronicsubstrate * qty;
    if (exactCost.siliconcarbide) cost.silCarbide = exactCost.siliconcarbide * qty;
    if (exactCost.metallicmicrolattice) cost.metMicrolatt = exactCost.metallicmicrolattice * qty;
    if (exactCost.protectyon) cost.protectyon = exactCost.protectyon * qty;
    if (exactCost.water) cost.water = exactCost.water * qty;

    // Any other wares in exact build cost (e.g. Teladianium, Microchips, etc.)
    Object.entries(exactCost).forEach(([ware, amount]) => {
      const lowerW = ware.toLowerCase();
      if (!['claytronics', 'hullparts', 'energycells', 'computronicsubstrate', 'siliconcarbide', 'metallicmicrolattice', 'protectyon', 'water'].includes(lowerW)) {
        cost[ware] = amount * qty;
      }
    });

    return cost;
  }

  const lower = macro.toLowerCase();

  if (lower.includes('ter') || lower.includes('terran')) {
    if (lower.includes('shipyard') || lower.includes('wharf')) {
      cost.compSubstrate = 160 * qty;
      cost.silCarbide = 300 * qty;
      cost.metMicrolatt = 600 * qty;
      cost.ec = 1000 * qty;
    } else {
      cost.compSubstrate = 80 * qty;
      cost.silCarbide = 150 * qty;
      cost.metMicrolatt = 300 * qty;
      cost.ec = 400 * qty;
    }
  } else if (lower.includes('shipyard') || lower.includes('wharf') || lower.includes('buildmodule')) {
    cost.claytronics = 600 * qty;
    cost.hullparts = 1500 * qty;
    cost.ec = 1200 * qty;
  } else if (lower.includes('protectyon') || lower.includes('ava_')) {
    cost.claytronics = 250 * qty;
    cost.hullparts = 600 * qty;
    cost.ec = 600 * qty;
    cost.protectyon = 50 * qty;
  } else {
    // Standard Commonwealth / Paranid / Teladi / Boron / Xenon modules
    cost.claytronics = 200 * qty;
    cost.hullparts = 500 * qty;
    cost.ec = 500 * qty;
  }

  return cost;
}
