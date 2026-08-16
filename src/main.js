import './style.css';
import MODULE_BUILD_COSTS from './crissian_build_costs.json';
import MODULE_NAMES from './macro_names.json';

function getFriendlyModuleName(macro) {
  if (MODULE_NAMES[macro]) return MODULE_NAMES[macro];
  if (MODULE_NAMES[macro.toLowerCase()]) return MODULE_NAMES[macro.toLowerCase()];

  let clean = macro.replace(/_macro$/i, '').replace(/_/g, ' ');
  return clean.replace(/\b\w/g, l => l.toUpperCase());
}

// X4 Wares Master Database (Commonwealth, Terran, Teladi, Paranid, Boron, Xenon, Avarice & Scrap Recycling)
const WARES_DB = {
  // LEVEL 0: RAW MATERIALS, SCRAP FRAGMENTS & SPECIALTY LIQUIDS
  'Ore': { name: 'Ore', level: 0, cat: 'Solid Mineral', source: 'Asteroid Fields', baseRate: 1, desc: 'Raw iron and titanium ore extracted from asteroids.' },
  'Silicon': { name: 'Silicon', level: 0, cat: 'Solid Mineral', source: 'Asteroid Fields', baseRate: 1, desc: 'Raw silicon crystals used in semiconductor production.' },
  'Methane': { name: 'Methane', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Hydrocarbon gas harvested from nebulae.' },
  'Hydrogen': { name: 'Hydrogen', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Volatile fuel gas for antimatter production.' },
  'Helium': { name: 'Helium', level: 0, cat: 'Gas Nebula', source: 'Gas Nebulae', baseRate: 1, desc: 'Inert gas processed into superfluid coolants.' },
  'Ice': { name: 'Ice', level: 0, cat: 'Solid Mineral', source: 'Comets & Ice Belts', baseRate: 1, desc: 'Frozen water purified into drinking water and food supplies.' },
  'EC': { name: 'Energy Cells', level: 0, cat: 'Solar Harvesting', source: 'Sunlight', baseRate: 10500, desc: 'Universal energy catalyst required by all station modules.' },
  'RawScrap': { name: 'Raw Scrap Fragments', level: 0, cat: 'Wreckage Debris', source: 'Battle Wrecks & Scrap Fields', baseRate: 1, desc: 'Raw starship wreckage and Allographyne metallic fragments towed by tug ships to scrap processors.' },
  'Protectyon': { name: 'Protectyon (Condensate)', level: 0, cat: 'Avarice Liquid Anomaly', source: 'Leap of Faith / Avarice Tide', baseRate: 1200, desc: 'Ultra-rare protective condensate harvested from Avarice tide nebulae. Protects stations against catastrophic solar tide bursts.' },

  // LEVEL 1: REFINED GOODS & RECYCLED SCRAP
  'RefMet': { name: 'Refined Metals / Teladianium', level: 1, cat: 'Refined Industrial', baseRate: 2400, recipe: { 'Ore': 5760, 'EC': 2400 }, desc: 'Standard structural alloy used throughout Commonwealth space.' },
  'ScrapMetal': { name: 'Scrap Metal', level: 1, cat: 'Refined Recycled Metal', baseRate: 2400, recipe: { 'RawScrap': 4800, 'EC': 9600 }, desc: 'Processed scrap metal produced by Scrap Processors. Used by Scrap Recyclers to produce Hull Parts and Claytronics.' },
  'SilWaf': { name: 'Silicon Wafers', level: 1, cat: 'Refined Tech', baseRate: 720, recipe: { 'Silicon': 4320, 'EC': 1800 }, desc: 'Purified silicon plates for microchip manufacturing.' },
  'Graph': { name: 'Graphene', level: 1, cat: 'Refined Gas Product', baseRate: 1600, recipe: { 'Methane': 9600, 'EC': 1600 }, desc: 'High-strength carbon sheet used in hulls and composite armor.' },
  'AntiCell': { name: 'Antimatter Cells', level: 1, cat: 'Refined Energy', baseRate: 2400, recipe: { 'Hydrogen': 9600, 'EC': 2400 }, desc: 'Magnetic containment cells holding antimatter fuel.' },
  'SupCool': { name: 'Superfluid Coolant', level: 1, cat: 'Refined Liquid', baseRate: 1600, recipe: { 'Helium': 9600, 'EC': 1600 }, desc: 'Cryogenic fluid used in high-power weapon systems.' },
  'Water': { name: 'Water', level: 1, cat: 'Refined Essential', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'Purified water for station workforce habitats.' },
  'MetMicrolatt': { name: 'Metallic Microlattice', level: 1, cat: 'Terran Basic', baseRate: 2400, recipe: { 'Ore': 4800, 'Hydrogen': 4800, 'EC': 1200 }, desc: 'Ultra-lightweight structural frame material used by Terran Protectorate.' },
  'ProtPaste': { name: 'Protein Paste', level: 1, cat: 'Terran Food Base', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'Synthetic protein compound used for Terran workforce nutrition.' },
  'SunriseFlowers': { name: 'Sunrise Flowers', level: 1, cat: 'Teladi Crop', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'Aromatic Teladi flora refined into Nostrop Oil.' },
  'SwampPlant': { name: 'Swamp Plant', level: 1, cat: 'Teladi Specialty Crop', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'Moist Teladi crop refined into Spaceweed.' },
  'Wheat': { name: 'Space Wheat', level: 1, cat: 'Argon Agriculture', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'High-yield cereal grain for Food Rations and Spacefuel.' },
  'Meat': { name: 'Meat', level: 1, cat: 'Argon Agriculture', baseRate: 1200, recipe: { 'Wheat': 1200, 'EC': 1200 }, desc: 'Cultured meat for Argon Food Rations.' },
  'Spices': { name: 'Spices', level: 1, cat: 'Universal Seasoning', baseRate: 2400, recipe: { 'Ice': 2400, 'EC': 1200 }, desc: 'Flavoring additives required for all racial food and medical supplies.' },
  'SojaBeans': { name: 'Soja Beans', level: 1, cat: 'Paranid Crop', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'High-protein Paranid crop for Soja Husk.' },
  'MajaSnails': { name: 'Maja Snails', level: 1, cat: 'Paranid Livestock', baseRate: 1200, recipe: { 'Ice': 2400, 'EC': 1200 }, desc: 'Slow-growing Paranid mollusks for Soja Husk and Majalit.' },
  'BoGas': { name: 'BoGas', level: 1, cat: 'Boron Refined Gas', baseRate: 2400, recipe: { 'Methane': 9600, 'EC': 1600 }, desc: 'Essential Boron gas compound refined for BoFu production.' },
  'Plankton': { name: 'Plankton', level: 1, cat: 'Boron Aquatic Agriculture', baseRate: 2400, recipe: { 'Ice': 3840, 'EC': 1200 }, desc: 'Nutrient-rich aquatic algae cultivated by Boron stations.' },
  'SilMatrix': { name: 'Silicon Matrix', level: 1, cat: 'Xenon Refined Mineral', baseRate: 2400, recipe: { 'Silicon': 4800, 'EC': 1200 }, desc: 'Purified silicon lattice matrix utilized exclusively in Xenon synthetic construction.' },
  'OreMatrix': { name: 'Ore Matrix', level: 1, cat: 'Xenon Structural Metal', baseRate: 2400, recipe: { 'Ore': 4800, 'EC': 1200 }, desc: 'Refined metallic alloy matrix forming Xenon ship hulls and station cores.' },

  // LEVEL 2: INTERMEDIATES & WORKFORCE PROVISIONS
  'HullParts': { name: 'Hull Parts', level: 2, cat: 'Structural Component', baseRate: 660, recipe: { 'RefMet': 560, 'Graph': 160, 'EC': 320 }, desc: 'Interlocking armored hull plates essential for ship and station builds.' },
  'EngParts': { name: 'Engine Parts', level: 2, cat: 'Propulsion Component', baseRate: 450, recipe: { 'RefMet': 360, 'AntiCell': 180, 'EC': 180 }, desc: 'Precision thruster assemblies and drive turbines.' },
  'Microchips': { name: 'Microchips', level: 2, cat: 'Electronics', baseRate: 240, recipe: { 'SilWaf': 960, 'EC': 600 }, desc: 'Integrated circuits powering advanced avionics and claytronics.' },
  'QuanTubes': { name: 'Quantum Tubes', level: 2, cat: 'High-Tech Conduit', baseRate: 200, recipe: { 'Graph': 320, 'SupCool': 320, 'EC': 200 }, desc: 'Superconducting conduit tubes for field matrices.' },
  'PlasmaCond': { name: 'Plasma Conductors', level: 2, cat: 'Energy Conduit', baseRate: 100, recipe: { 'Graph': 160, 'SupCool': 160, 'EC': 320 }, desc: 'Heavy-duty energy lines for plasma weaponry and shields.' },
  'ScanArray': { name: 'Scanning Arrays', level: 2, cat: 'Sensory Gear', baseRate: 120, recipe: { 'SilWaf': 120, 'RefMet': 120, 'EC': 300 }, desc: 'Sensor arrays for long-range radar and targeting systems.' },
  'AdvComp': { name: 'Advanced Composites', level: 2, cat: 'Composite Plating', baseRate: 200, recipe: { 'RefMet': 160, 'Graph': 160, 'EC': 320 }, desc: 'Lightweight high-durability alloy for missile frames.' },
  'SilCarbide': { name: 'Silicon Carbide', level: 2, cat: 'Terran Intermediate', baseRate: 600, recipe: { 'Ore': 4800, 'Silicon': 4800, 'Hydrogen': 2400, 'EC': 1200 }, desc: 'High-density ceramic heat armor for Terran starships.' },
  'TerranMRE': { name: 'Terran MRE', level: 2, cat: 'Terran Provisions', baseRate: 1200, recipe: { 'ProtPaste': 1200, 'EC': 1200 }, desc: 'Standard Meal Ready to Eat for Terran station personnel.' },
  'NostropOil': { name: 'Nostrop Oil', level: 2, cat: 'Teladi Food', baseRate: 1200, recipe: { 'SunriseFlowers': 1200, 'Spices': 1200, 'EC': 1200 }, desc: 'Primary food provision required for Teladi workforce habitats.' },
  'FoodRations': { name: 'Food Rations', level: 2, cat: 'Argon Food', baseRate: 1200, recipe: { 'Wheat': 1200, 'Meat': 1200, 'Spices': 1200, 'EC': 1200 }, desc: 'Nutritional food packs for Argon workforce habitats.' },
  'SojaHusk': { name: 'Soja Husk', level: 2, cat: 'Paranid Food', baseRate: 1200, recipe: { 'SojaBeans': 1200, 'MajaSnails': 1200, 'EC': 1200 }, desc: 'Nutritional husk for Paranid workforce habitats.' },
  'BoFu': { name: 'BoFu', level: 2, cat: 'Boron Primary Food', baseRate: 1200, recipe: { 'BoGas': 1200, 'Plankton': 1200, 'EC': 1200 }, desc: 'Primary nutritional paste required for Boron workforce habitats.' },
  'MedicalSupplies': { name: 'Medical Supplies', level: 2, cat: 'Workforce Healthcare', baseRate: 1200, recipe: { 'Water': 1200, 'Spices': 1200, 'EC': 1200 }, desc: 'Pharmaceuticals required to maintain maximum workforce health and +50% station efficiency.' },
  'Spaceweed': { name: 'Spaceweed', level: 2, cat: 'Teladi Trade / Illegal', baseRate: 600, recipe: { 'SwampPlant': 1200, 'Spices': 600, 'EC': 1200 }, desc: 'High-margin narcotic trade favored by Teladi traders.' },
  'Spacefuel': { name: 'Spacefuel', level: 2, cat: 'Argon Trade / Illegal', baseRate: 600, recipe: { 'Wheat': 1200, 'Water': 600, 'EC': 1200 }, desc: 'Illicit alcoholic beverage traded at pirate bases and trade hubs.' },

  // LEVEL 3: HIGH-TECH COMPONENTS
  'Claytronics': { name: 'Claytronics', level: 3, cat: 'Nanotech Assemblies', baseRate: 160, recipe: { 'Microchips': 256, 'QuanTubes': 256, 'AntiCell': 256, 'EC': 640 }, desc: 'Programmable nanites required to build all station modules.' },
  'AdvElec': { name: 'Advanced Electronics', level: 3, cat: 'Computers & Avionics', baseRate: 120, recipe: { 'Microchips': 240, 'QuanTubes': 240, 'EC': 360 }, desc: 'Command computers and mainframes for capital ships.' },
  'FieldCoils': { name: 'Field Coils', level: 3, cat: 'Magnetic Systems', baseRate: 300, recipe: { 'PlasmaCond': 240, 'QuanTubes': 240, 'EC': 300 }, desc: 'Magnetic field generators for shields and heavy weaponry.' },
  'ShieldComp': { name: 'Shield Components', level: 3, cat: 'Defense Tech', baseRate: 360, recipe: { 'PlasmaCond': 240, 'QuanTubes': 240, 'EC': 360 }, desc: 'Emitters and capacitors forming starship shields.' },
  'WeapComp': { name: 'Weapon Components', level: 3, cat: 'Military Systems', baseRate: 200, recipe: { 'PlasmaCond': 200, 'HullParts': 200, 'EC': 300 }, desc: 'Barrels, heat sinks, and focus lenses for ship weaponry.' },
  'TurrComp': { name: 'Turret Components', level: 3, cat: 'Military Systems', baseRate: 200, recipe: { 'Microchips': 100, 'QuanTubes': 100, 'HullParts': 100, 'EC': 200 }, desc: 'Rotational gimbal mounts for defensive turrets.' },
  'MissComp': { name: 'Missile Components', level: 3, cat: 'Munitions', baseRate: 600, recipe: { 'AdvComp': 200, 'HullParts': 200, 'EC': 300 }, desc: 'Guidance fins and warheads for ordnance.' },
  'SmartChips': { name: 'Smart Chips', level: 3, cat: 'Autonomous Circuits', baseRate: 1600, recipe: { 'SilWaf': 240, 'EC': 600 }, desc: 'Low-cost guidance microcontrollers for drones and torpedoes.' },
  'AntiConv': { name: 'Antimatter Converters', level: 3, cat: 'Power Converters', baseRate: 300, recipe: { 'Microchips': 180, 'AntiCell': 180, 'EC': 300 }, desc: 'Power step-down transformers for high-yield engines.' },
  'CompSubstrate': { name: 'Computronic Substrate', level: 3, cat: 'Terran High-Tech', baseRate: 120, recipe: { 'Ore': 19200, 'Silicon': 19200, 'Hydrogen': 19200, 'EC': 6000 }, desc: 'Supercomputing quantum substrate required for Terran capital ships.' },
  'DroneComp': { name: 'Drone Components', level: 3, cat: 'Autonomous Tech', baseRate: 120, recipe: { 'Microchips': 120, 'QuanTubes': 120, 'ScanArray': 120, 'EC': 300 }, desc: 'Framework assemblies for building defense and cargo drones.' },
  'ProcessingUnit': { name: 'Processing Unit', level: 3, cat: 'Xenon Core Computer', baseRate: 120, recipe: { 'SilMatrix': 2400, 'EC': 1200 }, desc: 'Xenon central AI processing unit required for Xenon ship building.' },

  // LEVEL 4: FINAL APPLICATIONS & HQ MODULES
  'StationConst': { name: 'Station Modules Expansion', level: 4, cat: 'Build Storage', baseRate: 1, recipe: { 'Claytronics': 100, 'HullParts': 250, 'EC': 500, 'Protectyon': 50 }, desc: 'Station construction requirements and Avarice tide shielding.' },
  'ShipChassis': { name: 'Ship Hulls & Propulsion', level: 4, cat: 'Wharf / Shipyard', baseRate: 1, recipe: { 'HullParts': 300, 'EngParts': 100 }, desc: 'Commonwealth shipyard manufacturing.' },
  'TerranShipyard': { name: 'Terran Shipyard Assembly', level: 4, cat: 'Terran Wharf / Shipyard', baseRate: 1, recipe: { 'CompSubstrate': 80, 'SilCarbide': 150, 'MetMicrolatt': 300 }, desc: 'Terran Protectorate L, M, and XL ship manufacturing.' },
  'XenShipyard': { name: 'Xenon XL Shipyard & Wharf', level: 4, cat: 'Xenon Ship Yard', baseRate: 1, recipe: { 'ProcessingUnit': 80, 'SilMatrix': 150, 'OreMatrix': 300 }, desc: 'Xenon XL Shipyard manufacturing Xenon I, K, P, and M starships.' },
  'AdminClaim': { name: 'Administrative Sector Claim', level: 4, cat: 'HQ & Sector Ownership', baseRate: 1, recipe: { 'HullParts': 500, 'Claytronics': 200 }, desc: 'Establishes faction sector control and administrative ownership in X4.' },
  'WelfareHub': { name: 'Welfare & Morale (Gambling Hall)', level: 4, cat: 'Workforce Morale', baseRate: 1, recipe: { 'NostropOil': 100, 'MedicalSupplies': 100 }, desc: 'Gambling hall and casino modules boosting station workforce happiness.' },
  'BoronArtAcademy': { name: 'Boron Art Academy (Welfare)', level: 4, cat: 'Boron Morale', baseRate: 1, recipe: { 'BoFu': 100, 'MedicalSupplies': 100 }, desc: 'Boron cultural art academy boosting Boron workforce morale and happiness.' },
  'ShipWeapons': { name: 'Ship Guns & Turrets', level: 4, cat: 'Equipment Dock', baseRate: 1, recipe: { 'WeapComp': 50, 'TurrComp': 50, 'FieldCoils': 25 }, desc: 'Weapon outfitting.' },
  'ShipShields': { name: 'Shields & Avionics', level: 4, cat: 'Equipment Dock', baseRate: 1, recipe: { 'ShieldComp': 40, 'AdvElec': 20, 'AntiConv': 15, 'Protectyon': 30 }, desc: 'Shield & computer outfitting with Protectyon tide shielding.' },
  'FleetConsumables': { name: 'Drones & Ordnance', level: 4, cat: 'Consumables', baseRate: 1, recipe: { 'SmartChips': 20, 'MissComp': 40, 'ScanArray': 10 }, desc: 'Munitions & drone outfitting.' }
};

// Comprehensive X4 Structures Folder Macro Mapping (assets/structures/*_macro)
const MACRO_TO_WARE = {
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
let PRESET_BLUEPRINTS = {
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

const DEPENDENCIES = [
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
  { from: 'Hydrogen', to: 'MetMicrolatt' },
  { from: 'EC', to: 'MetMicrolatt' },
  { from: 'Ice', to: 'ProtPaste' },
  { from: 'EC', to: 'ProtPaste' },
  { from: 'Ice', to: 'SunriseFlowers' },
  { from: 'EC', to: 'SunriseFlowers' },
  { from: 'Ice', to: 'SwampPlant' },
  { from: 'EC', to: 'SwampPlant' },
  { from: 'Ice', to: 'Wheat' },
  { from: 'EC', to: 'Wheat' },
  { from: 'Wheat', to: 'Meat' },
  { from: 'EC', to: 'Meat' },
  { from: 'Ice', to: 'Spices' },
  { from: 'EC', to: 'Spices' },
  { from: 'Methane', to: 'BoGas' },
  { from: 'EC', to: 'BoGas' },
  { from: 'Ice', to: 'Plankton' },
  { from: 'EC', to: 'Plankton' },
  { from: 'Silicon', to: 'SilMatrix' },
  { from: 'EC', to: 'SilMatrix' },
  { from: 'Ore', to: 'OreMatrix' },
  { from: 'EC', to: 'OreMatrix' },
  { from: 'RawScrap', to: 'ScrapMetal' },
  { from: 'EC', to: 'ScrapMetal' },

  // L1 -> L2
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
  { from: 'Ore', to: 'SilCarbide' },
  { from: 'Silicon', to: 'SilCarbide' },
  { from: 'Hydrogen', to: 'SilCarbide' },
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
  { from: 'BoGas', to: 'BoFu' },
  { from: 'Plankton', to: 'BoFu' },
  { from: 'EC', to: 'BoFu' },
  { from: 'BoGas', to: 'MedicalSupplies' },
  { from: 'SwampPlant', to: 'Spaceweed' },
  { from: 'Spices', to: 'Spaceweed' },
  { from: 'EC', to: 'Spaceweed' },
  { from: 'Wheat', to: 'Spacefuel' },
  { from: 'Water', to: 'Spacefuel' },
  { from: 'EC', to: 'Spacefuel' },

  // L2 -> L3
  { from: 'Microchips', to: 'Claytronics' },
  { from: 'ScrapMetal', to: 'Claytronics' },
  { from: 'QuanTubes', to: 'Claytronics' },
  { from: 'AntiCell', to: 'Claytronics' },
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
  { from: 'Microchips', to: 'TurrComp' },
  { from: 'QuanTubes', to: 'TurrComp' },
  { from: 'HullParts', to: 'TurrComp' },
  { from: 'EC', to: 'TurrComp' },
  { from: 'AdvComp', to: 'MissComp' },
  { from: 'HullParts', to: 'MissComp' },
  { from: 'EC', to: 'MissComp' },
  { from: 'SilWaf', to: 'SmartChips' },
  { from: 'EC', to: 'SmartChips' },
  { from: 'Microchips', to: 'AntiConv' },
  { from: 'AntiCell', to: 'AntiConv' },
  { from: 'EC', to: 'AntiConv' },
  { from: 'Ore', to: 'CompSubstrate' },
  { from: 'Silicon', to: 'CompSubstrate' },
  { from: 'Hydrogen', to: 'CompSubstrate' },
  { from: 'EC', to: 'CompSubstrate' },
  { from: 'Microchips', to: 'DroneComp' },
  { from: 'QuanTubes', to: 'DroneComp' },
  { from: 'ScanArray', to: 'DroneComp' },
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

// App State
let activeTab = 'matrix'; // 'matrix' or 'planned'
let activeBlueprint = null;
let selectedWareId = null;
let currentPreset = 'all';
let searchQuery = '';
let targetModules = 1;
let workforceBonus = 0;
let subdueZeroX = false; // Initially unchecked at app startup
let macroSortAsc = true; // Alphabetical sorting for planned macro modules
let factionConstructionMethod = 'commonwealth'; // 'commonwealth', 'terran', 'boron'
let hideFoodAgriPlanned = false; // Checkbox toggle for hiding agricultural & food supply modules in Planned tab
let bpSortField = 'needed'; // 'needed' or 'component'
let bpSortAsc = false; // default descending (highest needed first)
let calculatedDemand = {};

function mapMacroToWare(macro) {
  const lowerMacro = macro.toLowerCase();
  if (MACRO_TO_WARE[macro]) return MACRO_TO_WARE[macro];
  if (MACRO_TO_WARE[lowerMacro]) return MACRO_TO_WARE[lowerMacro];

  if (lowerMacro.includes('claim') || lowerMacro.includes('admin')) return 'AdminClaim';
  if (lowerMacro.includes('gamblinghall') || lowerMacro.includes('welfare') || lowerMacro.includes('casino') || lowerMacro.includes('sanctuary')) return 'WelfareHub';
  if (lowerMacro.includes('artacademy')) return 'BoronArtAcademy';
  if (lowerMacro.includes('scrapprocessor')) return 'ScrapMetal';
  if (lowerMacro.includes('scraprecycler')) return 'HullParts';
  if (lowerMacro.includes('shipyard') || lowerMacro.includes('wharf') || lowerMacro.includes('ships')) {
    if (lowerMacro.includes('ter')) return 'TerranShipyard';
    if (lowerMacro.includes('xen')) return 'XenShipyard';
    return 'ShipChassis';
  }
  if (lowerMacro.includes('solarpanel') || lowerMacro.includes('energycell')) return 'EC';
  if (lowerMacro.includes('protectyon') || lowerMacro.includes('condensate')) return 'Protectyon';

  if (lowerMacro.includes('hab_par') || lowerMacro.includes('habitat_par') || (lowerMacro.includes('hab_') && lowerMacro.includes('par'))) return 'SojaHusk';
  if (lowerMacro.includes('hab_tel') || lowerMacro.includes('habitat_tel')) return 'NostropOil';
  if (lowerMacro.includes('hab_arg') || lowerMacro.includes('habitat_arg')) return 'FoodRations';
  if (lowerMacro.includes('hab_bor') || lowerMacro.includes('habitat_bor')) return 'BoFu';
  if (lowerMacro.includes('hab_ter') || lowerMacro.includes('habitat_ter')) return 'TerranMRE';

  if (lowerMacro.includes('conn') || lowerMacro.includes('pier') || lowerMacro.includes('dock') || lowerMacro.includes('struct_')) return 'ShipChassis';
  if (lowerMacro.includes('storage')) return 'StationConst';
  if (lowerMacro.includes('defence') || lowerMacro.includes('defense')) return 'AdminClaim';

  return 'StationConst';
}

function isFoodOrAgriMacro(macro) {
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
    'SojaHusk', 'SojaBeans', 'MajaSnails', 'MedicalSupplies',
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

function getModuleBuildCost(macro, qty) {
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

function rebuildBlueprintFromMacros() {
  if (!activeBlueprint || !activeBlueprint.rawMacros) return;

  const moduleCounts = {};
  let totalEntries = 0;

  Object.entries(activeBlueprint.rawMacros).forEach(([macro, count]) => {
    totalEntries += count;
    const wareId = mapMacroToWare(macro);
    if (wareId) {
      moduleCounts[wareId] = (moduleCounts[wareId] || 0) + count;
    }
  });

  activeBlueprint.totalModules = totalEntries;
  activeBlueprint.modules = moduleCounts;
}

function parseXMLBlueprint(xmlText, fileName) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const planEl = doc.querySelector('plan');
    const planName = planEl ? (planEl.getAttribute('name') || fileName) : fileName;

    const entries = doc.querySelectorAll('entry');
    const rawMacroCounts = {};
    const moduleCounts = {};
    let totalEntries = entries.length;

    entries.forEach(entry => {
      const macro = entry.getAttribute('macro');
      if (macro) {
        rawMacroCounts[macro] = (rawMacroCounts[macro] || 0) + 1;
      }
    });

    activeBlueprint = {
      name: planName,
      totalModules: 0,
      modules: {},
      rawMacros: rawMacroCounts
    };

    rebuildBlueprintFromMacros();

    currentPreset = 'blueprint';
    selectedWareId = null;
    calculatedDemand = {};
    try {
      localStorage.setItem('x4_active_blueprint', JSON.stringify(activeBlueprint));
      localStorage.setItem('x4_current_preset', 'blueprint');
    } catch (e) {}
    renderApp();
    alert(`Loaded XML Blueprint: "${planName}" (${activeBlueprint.totalModules} total modules scanned!)`);
  } catch (err) {
    alert('Failed to parse XML file.');
    console.error(err);
  }
}

function removeActiveBlueprint() {
  activeBlueprint = null;
  currentPreset = 'all';
  selectedWareId = null;
  calculatedDemand = {};
  try {
    localStorage.removeItem('x4_active_blueprint');
    localStorage.setItem('x4_current_preset', 'all');
  } catch (e) {}
  renderApp();
}

function accumulateRawMiningRates() {
  let oreRate = 0, siliconRate = 0, methaneRate = 0, hydrogenRate = 0, heliumRate = 0, iceRate = 0, protectyonRate = 0, rawScrapRate = 0;

  if (calculatedDemand['RefMet']) oreRate += calculatedDemand['RefMet'].modulesNeeded * 5760;
  if (calculatedDemand['SilWaf']) siliconRate += calculatedDemand['SilWaf'].modulesNeeded * 4320;
  if (calculatedDemand['Graph']) methaneRate += calculatedDemand['Graph'].modulesNeeded * 9600;
  if (calculatedDemand['AntiCell']) hydrogenRate += calculatedDemand['AntiCell'].modulesNeeded * 9600;
  if (calculatedDemand['SupCool']) heliumRate += calculatedDemand['SupCool'].modulesNeeded * 9600;
  if (calculatedDemand['Water']) iceRate += calculatedDemand['Water'].modulesNeeded * 3840;
  if (calculatedDemand['SunriseFlowers']) iceRate += calculatedDemand['SunriseFlowers'].modulesNeeded * 3840;
  if (calculatedDemand['SwampPlant']) iceRate += calculatedDemand['SwampPlant'].modulesNeeded * 3840;
  if (calculatedDemand['Wheat']) iceRate += calculatedDemand['Wheat'].modulesNeeded * 3840;
  if (calculatedDemand['Spices']) iceRate += calculatedDemand['Spices'].modulesNeeded * 2400;
  if (calculatedDemand['SojaBeans']) iceRate += calculatedDemand['SojaBeans'].modulesNeeded * 3840;
  if (calculatedDemand['MajaSnails']) iceRate += calculatedDemand['MajaSnails'].modulesNeeded * 2400;
  if (calculatedDemand['BoGas']) methaneRate += calculatedDemand['BoGas'].modulesNeeded * 9600;
  if (calculatedDemand['Plankton']) iceRate += calculatedDemand['Plankton'].modulesNeeded * 3840;
  if (calculatedDemand['ScrapMetal']) rawScrapRate += calculatedDemand['ScrapMetal'].modulesNeeded * 4800;

  if (calculatedDemand['SilMatrix']) siliconRate += calculatedDemand['SilMatrix'].modulesNeeded * 4800;
  if (calculatedDemand['OreMatrix']) oreRate += calculatedDemand['OreMatrix'].modulesNeeded * 4800;
  if (calculatedDemand['ProcessingUnit']) siliconRate += calculatedDemand['ProcessingUnit'].modulesNeeded * 4800;
  if (calculatedDemand['Protectyon']) protectyonRate += (calculatedDemand['Protectyon'].rateNeeded || (calculatedDemand['Protectyon'].modulesNeeded * 1200));

  if (calculatedDemand['MetMicrolatt']) {
    oreRate += calculatedDemand['MetMicrolatt'].modulesNeeded * 4800;
    hydrogenRate += calculatedDemand['MetMicrolatt'].modulesNeeded * 4800;
  }
  if (calculatedDemand['SilCarbide']) {
    oreRate += calculatedDemand['SilCarbide'].modulesNeeded * 4800;
    siliconRate += calculatedDemand['SilCarbide'].modulesNeeded * 4800;
    hydrogenRate += calculatedDemand['SilCarbide'].modulesNeeded * 2400;
  }
  if (calculatedDemand['CompSubstrate']) {
    oreRate += calculatedDemand['CompSubstrate'].modulesNeeded * 19200;
    siliconRate += calculatedDemand['CompSubstrate'].modulesNeeded * 19200;
    hydrogenRate += calculatedDemand['CompSubstrate'].modulesNeeded * 19200;
  }

  if (oreRate > 0) calculatedDemand['Ore'] = { modulesNeeded: 0, rateNeeded: oreRate };
  if (siliconRate > 0) calculatedDemand['Silicon'] = { modulesNeeded: 0, rateNeeded: siliconRate };
  if (methaneRate > 0) calculatedDemand['Methane'] = { modulesNeeded: 0, rateNeeded: methaneRate };
  if (hydrogenRate > 0) calculatedDemand['Hydrogen'] = { modulesNeeded: 0, rateNeeded: hydrogenRate };
  if (heliumRate > 0) calculatedDemand['Helium'] = { modulesNeeded: 0, rateNeeded: heliumRate };
  if (iceRate > 0) calculatedDemand['Ice'] = { modulesNeeded: 0, rateNeeded: iceRate };
  if (rawScrapRate > 0) calculatedDemand['RawScrap'] = { modulesNeeded: 0, rateNeeded: rawScrapRate };
  if (protectyonRate > 0) calculatedDemand['Protectyon'] = { modulesNeeded: 0, rateNeeded: protectyonRate };
}

function calculateFactoryRequirements() {
  calculatedDemand = {};
  const effMultiplier = 1 + (workforceBonus / 100);

  // CASE A: A specific ware card is selected (including Level 4 components)
  if (selectedWareId && WARES_DB[selectedWareId]) {
    const selectedWare = WARES_DB[selectedWareId];

    if (selectedWare.level === 4) {
      // Level 4 Component: Recalculate demand based strictly on its upward optimum needed supply chain!
      calculatedDemand[selectedWareId] = {
        modulesNeeded: targetModules,
        rateNeeded: 1
      };

      let queue = [];
      if (selectedWare.recipe) {
        Object.entries(selectedWare.recipe).forEach(([inputId, inputQty]) => {
          const reqRate = inputQty * targetModules;
          const inputWare = WARES_DB[inputId];

          if (!calculatedDemand[inputId]) {
            calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
          }
          calculatedDemand[inputId].rateNeeded += reqRate;

          if (inputWare && inputWare.level > 0) {
            const modRate = inputWare.baseRate * effMultiplier;
            calculatedDemand[inputId].modulesNeeded = Math.ceil((calculatedDemand[inputId].rateNeeded / modRate) * 100) / 100;
          }

          queue.push({ id: inputId, requiredRate: reqRate });
        });
      }

      while (queue.length > 0) {
        const { id, requiredRate } = queue.shift();
        const ware = WARES_DB[id];

        if (ware && ware.recipe) {
          Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
            const ratePerUnit = inputQty / (ware.baseRate * effMultiplier);
            const totalInputRateNeeded = requiredRate * ratePerUnit;

            if (!calculatedDemand[inputId]) {
              calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
            }

            calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

            const inputWare = WARES_DB[inputId];
            if (inputWare && inputWare.level > 0) {
              const modRate = inputWare.baseRate * effMultiplier;
              calculatedDemand[inputId].modulesNeeded = Math.ceil((calculatedDemand[inputId].rateNeeded / modRate) * 100) / 100;
            }

            queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
          });
        }
      }
    } else {
      // Level 1, 2, 3 selected target
      const targetOutputRate = targetModules * (selectedWare.baseRate * effMultiplier);

      calculatedDemand[selectedWareId] = {
        rateNeeded: targetOutputRate,
        modulesNeeded: targetModules
      };

      let queue = [{ id: selectedWareId, requiredRate: targetOutputRate }];

      while (queue.length > 0) {
        const { id, requiredRate } = queue.shift();
        const ware = WARES_DB[id];

        if (ware && ware.recipe) {
          Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
            const ratePerUnit = inputQty / (ware.baseRate * effMultiplier);
            const totalInputRateNeeded = requiredRate * ratePerUnit;

            if (!calculatedDemand[inputId]) {
              calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
            }

            calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

            const inputWare = WARES_DB[inputId];
            if (inputWare && inputWare.level > 0) {
              const modRate = inputWare.baseRate * effMultiplier;
              calculatedDemand[inputId].modulesNeeded = Math.ceil((calculatedDemand[inputId].rateNeeded / modRate) * 100) / 100;
            }

            queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
          });
        }
      }
    }

    // Accumulate raw mining resource rates for selected ware's upstream chain
    accumulateRawMiningRates();
    return;
  }

  // CASE B: Full Station Blueprint Plan loaded (no specific card selected)
  if (activeBlueprint) {
    let queue = [];

    // Seed direct modules present in the active blueprint plan
    Object.entries(activeBlueprint.modules).forEach(([id, count]) => {
      const ware = WARES_DB[id];
      if (ware) {
        const directRate = count * ware.baseRate * effMultiplier;
        calculatedDemand[id] = {
          modulesNeeded: count,
          rateNeeded: directRate
        };
        queue.push({ id: id, requiredRate: directRate });
      }
    });

    // Recursively calculate upstream dependencies for ALL modules in the plan
    while (queue.length > 0) {
      const { id, requiredRate } = queue.shift();
      const ware = WARES_DB[id];

      if (ware && ware.recipe) {
        Object.entries(ware.recipe).forEach(([inputId, inputQty]) => {
          const ratePerUnit = inputQty / (ware.baseRate * effMultiplier);
          const totalInputRateNeeded = requiredRate * ratePerUnit;

          if (!calculatedDemand[inputId]) {
            calculatedDemand[inputId] = { rateNeeded: 0, modulesNeeded: 0 };
          }

          calculatedDemand[inputId].rateNeeded += totalInputRateNeeded;

          const inputWare = WARES_DB[inputId];
          if (inputWare && inputWare.level > 0) {
            const modRate = inputWare.baseRate * effMultiplier;
            calculatedDemand[inputId].modulesNeeded = Math.ceil((calculatedDemand[inputId].rateNeeded / modRate) * 100) / 100;
          }

          queue.push({ id: inputId, requiredRate: totalInputRateNeeded });
        });
      }
    }

    accumulateRawMiningRates();

    // Evaluate Level 4 final applications activity status
    const isStationConstActive = (calculatedDemand['Claytronics'] && calculatedDemand['Claytronics'].rateNeeded > 0) || (calculatedDemand['HullParts'] && calculatedDemand['HullParts'].rateNeeded > 0);
    const isShipChassisActive = (activeBlueprint.modules['ShipChassis'] > 0) || (calculatedDemand['HullParts'] && calculatedDemand['HullParts'].rateNeeded > 0) || (calculatedDemand['EngParts'] && calculatedDemand['EngParts'].rateNeeded > 0);
    const isTerranShipyardActive = (calculatedDemand['CompSubstrate'] && calculatedDemand['CompSubstrate'].rateNeeded > 0) || (calculatedDemand['SilCarbide'] && calculatedDemand['SilCarbide'].rateNeeded > 0) || (calculatedDemand['MetMicrolatt'] && calculatedDemand['MetMicrolatt'].rateNeeded > 0);
    const isXenShipyardActive = (activeBlueprint.modules['XenShipyard'] > 0) || (calculatedDemand['ProcessingUnit'] && calculatedDemand['ProcessingUnit'].rateNeeded > 0) || (calculatedDemand['SilMatrix'] && calculatedDemand['SilMatrix'].rateNeeded > 0);
    const isAdminClaimActive = (activeBlueprint.modules['AdminClaim'] > 0);
    const isWelfareActive = (activeBlueprint.modules['WelfareHub'] > 0) || (calculatedDemand['NostropOil'] && calculatedDemand['NostropOil'].rateNeeded > 0);
    const isBoronArtActive = (activeBlueprint.modules['BoronArtAcademy'] > 0) || (calculatedDemand['BoFu'] && calculatedDemand['BoFu'].rateNeeded > 0);
    const isShipWeaponsActive = (activeBlueprint.modules['ShipWeapons'] > 0) || (calculatedDemand['WeapComp'] && calculatedDemand['WeapComp'].rateNeeded > 0) || (calculatedDemand['TurrComp'] && calculatedDemand['TurrComp'].rateNeeded > 0) || (calculatedDemand['FieldCoils'] && calculatedDemand['FieldCoils'].rateNeeded > 0);
    const isShipShieldsActive = (activeBlueprint.modules['ShipShields'] > 0) || (calculatedDemand['ShieldComp'] && calculatedDemand['ShieldComp'].rateNeeded > 0) || (calculatedDemand['AdvElec'] && calculatedDemand['AdvElec'].rateNeeded > 0) || (calculatedDemand['AntiConv'] && calculatedDemand['AntiConv'].rateNeeded > 0) || (calculatedDemand['Protectyon'] && calculatedDemand['Protectyon'].rateNeeded > 0);
    const isFleetConsumablesActive = (activeBlueprint.modules['FleetConsumables'] > 0) || (calculatedDemand['SmartChips'] && calculatedDemand['SmartChips'].rateNeeded > 0) || (calculatedDemand['MissComp'] && calculatedDemand['MissComp'].rateNeeded > 0) || (calculatedDemand['ScanArray'] && calculatedDemand['ScanArray'].rateNeeded > 0);

    if (isStationConstActive) calculatedDemand['StationConst'] = { modulesNeeded: 1, rateNeeded: 1 };
    if (isShipChassisActive) calculatedDemand['ShipChassis'] = { modulesNeeded: activeBlueprint.modules['ShipChassis'] || 1, rateNeeded: 1 };
    if (isTerranShipyardActive) calculatedDemand['TerranShipyard'] = { modulesNeeded: 1, rateNeeded: 1 };
    if (isXenShipyardActive) calculatedDemand['XenShipyard'] = { modulesNeeded: activeBlueprint.modules['XenShipyard'] || 1, rateNeeded: 1 };
    if (isAdminClaimActive) calculatedDemand['AdminClaim'] = { modulesNeeded: activeBlueprint.modules['AdminClaim'], rateNeeded: 1 };
    if (isWelfareActive) calculatedDemand['WelfareHub'] = { modulesNeeded: activeBlueprint.modules['WelfareHub'] || 1, rateNeeded: 1 };
    if (isBoronArtActive) calculatedDemand['BoronArtAcademy'] = { modulesNeeded: activeBlueprint.modules['BoronArtAcademy'] || 1, rateNeeded: 1 };
    if (isShipWeaponsActive) calculatedDemand['ShipWeapons'] = { modulesNeeded: activeBlueprint.modules['ShipWeapons'] || 1, rateNeeded: 1 };
    if (isShipShieldsActive) calculatedDemand['ShipShields'] = { modulesNeeded: activeBlueprint.modules['ShipShields'] || 1, rateNeeded: 1 };
    if (isFleetConsumablesActive) calculatedDemand['FleetConsumables'] = { modulesNeeded: activeBlueprint.modules['FleetConsumables'] || 1, rateNeeded: 1 };

    return;
  }
}

function renderApp() {
  calculateFactoryRequirements();

  const app = document.getElementById('app');
  app.innerHTML = `
    <header>
      <div class="brand">
        <div class="brand-icon">X4</div>
        <div class="brand-title">
          <h1>Material Supply Chain Matrix</h1>
          <p>Real-Time Station Blueprint Recalculator & Supply Explorer</p>
        </div>
      </div>

      <nav class="nav-tabs">
        <button class="nav-tab-btn ${activeTab === 'matrix' ? 'active' : ''}" id="tabBtnMatrix">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Supply Chain Matrix
        </button>
        <button class="nav-tab-btn ${activeTab === 'planned' ? 'active' : ''}" id="tabBtnPlanned">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          Planned & Changed Modules
        </button>
      </nav>

      <div class="controls">
        <input type="file" id="xmlFileInput" accept=".xml" style="display:none;" />
        <button class="btn-upload" id="btnUploadXML">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Upload .XML Blueprint
        </button>

        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" class="search-input" id="searchInput" placeholder="Search ware..." value="${searchQuery}" />
        </div>

        ${Object.keys(PRESET_BLUEPRINTS).map(key => {
          const p = PRESET_BLUEPRINTS[key];
          return `
            <button class="btn-filter ${currentPreset === key ? 'active' : ''}" data-preset="${key}" title="Left-click to load plan • Right-click to remove preset">
              ${p.label}
            </button>
          `;
        }).join('')}
        <button class="btn-filter ${currentPreset === 'all' ? 'active' : ''}" data-preset="all">Single Target Mode</button>
      </div>
    </header>

    <div class="calc-bar">
      <div class="calc-group">
        <span>Active Blueprint:</span>
        ${activeBlueprint ? `
          <strong style="color:#38bdf8;">${activeBlueprint.name}</strong>
          <span style="font-size:0.75rem; background:rgba(56,189,248,0.2); padding:0.1rem 0.4rem; border-radius:4px;">${activeBlueprint.totalModules} Entries</span>
          <button class="btn-clear-bp" id="btnClearBP" title="Remove active blueprint">&times; Remove Blueprint</button>
        ` : `
          <span style="color:#94a3b8; font-style:italic;">No active blueprint loaded (Single Target Mode)</span>
        `}
      </div>
      ${!activeBlueprint ? `
        <div class="calc-group">
          <label for="moduleInput">Target Modules:</label>
          <input type="number" id="moduleInput" class="calc-input" min="1" max="500" value="${targetModules}" />
        </div>
      ` : ''}
      <div class="slider-group">
        <label for="workforceSlider">Workforce Efficiency Bonus:</label>
        <input type="range" id="workforceSlider" min="0" max="50" step="5" value="${workforceBonus}" />
        <span style="font-weight:700; color:#34d399;">+${workforceBonus}%</span>
      </div>
      ${activeBlueprint ? `
        <div class="calc-group" style="margin-left: 1rem;">
          <label style="font-size:0.8rem; color:#38bdf8; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; background:rgba(56,189,248,0.12); padding:0.25rem 0.65rem; border-radius:6px; border:1px solid rgba(56,189,248,0.35);">
            <input type="checkbox" id="chkSubdueZeroX" ${subdueZeroX ? 'checked' : ''} style="cursor:pointer;" />
            Subdue 0x
          </label>
        </div>
      ` : ''}
    </div>

    ${activeTab === 'matrix' ? renderMatrixTabHTML() : renderPlannedTabHTML()}

    <footer>
      <div class="legend-group">
        <div><span class="legend-dot" style="background: #10b981"></span> Active Production Links (Green)</div>
        <div style="opacity:0.6;"><span class="legend-dot" style="background: rgba(148,163,184,0.3); border: 1px dashed #94a3b8;"></span> Subdued Ghost Links (Faint dashed lines)</div>
      </div>
      <div>X4: Foundations Materials & Sector Blueprint Engine v2.4</div>
    </footer>
  `;

  setupEvents();
  if (activeTab === 'matrix') {
    updateInspector(selectedWareId);
    setTimeout(drawLines, 50);
  }
}

function renderMatrixTabHTML() {
  return `
    <div class="main-wrapper">
      <div class="matrix-viewport" id="viewport">
        <svg class="svg-overlay" id="svgCanvas"></svg>

        <div class="matrix-grid" id="matrixGrid">
          ${[0, 1, 2, 3, 4].map(level => {
            const levelWares = Object.keys(WARES_DB).filter(id => WARES_DB[id].level === level);
            const titles = ['Level 0: Raw Mining & Scrap', 'Level 1: Refined Goods & Scrap Metal', 'Level 2: Intermediates', 'Level 3: High-Tech', 'Level 4: Applications'];
            return `
              <div class="matrix-col col-${level}" data-level="${level}">
                <div class="col-badge">
                  <span>${titles[level]}</span>
                  <span class="count-tag">${levelWares.length}</span>
                </div>
                ${levelWares.map(id => {
                  const ware = WARES_DB[id];
                  const calc = calculatedDemand[id];
                  const hasCalc = calc && calc.rateNeeded > 0;
                  const inPlanCount = activeBlueprint ? (activeBlueprint.modules[id] || 0) : 0;
                  const isGhost = activeBlueprint ? (!hasCalc || (subdueZeroX && inPlanCount === 0 && !selectedWareId)) : false;
                  return `
                    <div class="ware-card ${isGhost ? 'ghost-card' : ''} ${id === selectedWareId ? 'active-selected' : ''}" id="ware-${id}" data-id="${id}">
                      <div class="ware-header">
                        <div class="ware-name">${ware.name}</div>
                      </div>
                      <div class="ware-cat">${ware.cat}</div>
                      ${hasCalc ? `
                        <div class="card-calc-info">
                          <span class="module-badge">${ware.level > 0 ? (calc.modulesNeeded >= 1 ? `${calc.modulesNeeded}x Modules` : `${calc.modulesNeeded.toFixed(1)}x Needed`) : 'Mining/Scrap'}</span>
                          <span class="rate-badge">${ware.level < 4 ? `${Math.round(calc.rateNeeded).toLocaleString()}/hr` : 'Supplied'}</span>
                        </div>
                      ` : `
                        <div class="card-calc-info">
                          <span class="module-badge" style="opacity:0.4; background:none; border-color:rgba(255,255,255,0.1); color:#64748b;">${activeBlueprint ? 'Ghost Module' : 'Hover / Select'}</span>
                        </div>
                      `}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <aside class="inspector-panel" id="inspectorPanel">
        <div class="inspector-header">
          <div class="inspector-title">
            <h2 id="insTitle">${activeBlueprint ? 'Blueprint Inspector' : 'Module Inspector'}</h2>
            <span id="insSub">${activeBlueprint ? activeBlueprint.name : 'Single Target Mode'}</span>
          </div>
          <button class="btn-close" id="btnCloseIns">&times;</button>
        </div>
        <div class="inspector-body" id="insBody"></div>
      </aside>
    </div>
  `;
}

function renderPlannedTabHTML() {
  const rawMacrosMap = activeBlueprint ? (activeBlueprint.rawMacros || {}) : {};
  const macroEntries = Object.entries(rawMacrosMap)
    .filter(([macro]) => !hideFoodAgriPlanned || !isFoodOrAgriMacro(macro))
    .sort(([macroA], [macroB]) => {
      const nameA = getFriendlyModuleName(macroA);
      const nameB = getFriendlyModuleName(macroB);
      return macroSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const knownMacrosList = Object.keys(MACRO_TO_WARE)
    .filter(macro => !hideFoodAgriPlanned || !isFoodOrAgriMacro(macro))
    .sort((a, b) => getFriendlyModuleName(a).localeCompare(getFriendlyModuleName(b)));

  // Summation Calculations
  let totalMacroModules = 0;
  let totalClaytronics = 0;
  let totalHullParts = 0;
  let totalECBuild = 0;
  let totalCompSubstrate = 0;
  let totalSilCarbide = 0;
  let totalMetMicrolatt = 0;
  let totalProtectyonBuild = 0;

  macroEntries.forEach(([macro, qty]) => {
    totalMacroModules += qty;
    const c = getModuleBuildCost(macro, qty);
    totalClaytronics += c.claytronics;
    totalHullParts += c.hullparts;
    totalECBuild += c.ec;
    totalCompSubstrate += c.compSubstrate;
    totalSilCarbide += c.silCarbide;
    totalMetMicrolatt += c.metMicrolatt;
    totalProtectyonBuild += c.protectyon;
  });

  return `
    <div class="planned-wrapper">
      <div class="planned-header-card">
        <div class="planned-title">
          <h2>📋 Planned and Changed Station Modules</h2>
          <p>Specify and adjust quantities for each station module. Calculates exact station construction resources required for building each module.</p>
        </div>

        <div class="add-macro-box">
          <label style="font-size:0.82rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none; background:rgba(255,255,255,0.04); padding:0.35rem 0.65rem; border-radius:6px; border:1px solid rgba(255,255,255,0.08);" title="When checked, hides agricultural & food supply production modules from table and dropdown">
            <input type="checkbox" id="chkHideFoodAgri" ${hideFoodAgriPlanned ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8; cursor:pointer;" />
            🌾 Exclude Food & Agri Modules
          </label>
          <label style="font-size:0.8rem; font-weight:700; color:#94a3b8; display:flex; align-items:center; gap:0.4rem;">
            Method:
            <select id="selectFactionMethod" class="select-preset" style="padding:0.35rem 0.6rem;">
              <option value="commonwealth" ${factionConstructionMethod === 'commonwealth' ? 'selected' : ''}>🏛️ Commonwealth</option>
              <option value="terran" ${factionConstructionMethod === 'terran' ? 'selected' : ''}>🪐 Terran Protectorate</option>
              <option value="boron" ${factionConstructionMethod === 'boron' ? 'selected' : ''}>🌊 Boron Kingdom</option>
            </select>
          </label>
          <select id="addMacroSelect" class="select-macro">
            <option value="">-- Select Station Module to Add --</option>
            ${knownMacrosList.map(macro => {
              const friendly = getFriendlyModuleName(macro);
              return `<option value="${macro}">${friendly} (${macro})</option>`;
            }).join('')}
          </select>
          <button class="btn-add-macro" id="btnAddMacro">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Module
          </button>
        </div>
      </div>

      <div class="macro-table-card">
        <div class="macro-table-container">
          <table class="macro-table">
            <thead>
              <tr>
                <th id="thSortMacro" style="cursor:pointer; user-select:none;" title="Click to sort alphabetically by Station Module Name">
                  Station Module Name ${macroSortAsc ? '▲' : '▼'}
                </th>
                <th>Mapped Ware / Purpose</th>
                <th>Quantity in Plan</th>
                <th>Construction Resources Needed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${macroEntries.length > 0 ? macroEntries.map(([macro, qty]) => {
                const wareId = mapMacroToWare(macro);
                const ware = wareId ? WARES_DB[wareId] : null;
                const friendlyName = getFriendlyModuleName(macro);

                // Single Unit Component Cost
                const singleCost = getModuleBuildCost(macro, 1);
                const singleParts = [];
                if (singleCost.claytronics > 0) singleParts.push(`<span style="color:#fbbf24; font-weight:700;">${singleCost.claytronics.toLocaleString()}</span> Claytronics`);
                if (singleCost.ec > 0) singleParts.push(`<span style="color:#cbd5e1; font-weight:700;">${singleCost.ec.toLocaleString()}</span> EC`);
                if (singleCost.hullparts > 0) singleParts.push(`<span style="color:#38bdf8; font-weight:700;">${singleCost.hullparts.toLocaleString()}</span> Hull Parts`);
                if (singleCost.compSubstrate > 0) singleParts.push(`<span style="color:#f472b6; font-weight:700;">${singleCost.compSubstrate.toLocaleString()}</span> Computronic Substrate`);
                if (singleCost.silCarbide > 0) singleParts.push(`<span style="color:#a7f3d0; font-weight:700;">${singleCost.silCarbide.toLocaleString()}</span> Silicon Carbide`);
                if (singleCost.metMicrolatt > 0) singleParts.push(`<span style="color:#94a3b8; font-weight:700;">${singleCost.metMicrolatt.toLocaleString()}</span> Metallic Microlattice`);
                if (singleCost.protectyon > 0) singleParts.push(`<span style="color:#f472b6; font-weight:700;">${singleCost.protectyon.toLocaleString()}</span> Protectyon`);
                if (singleCost.water > 0) singleParts.push(`<span style="color:#38bdf8; font-weight:700;">${singleCost.water.toLocaleString()}</span> Water`);
                const singleCostStr = singleParts.length > 0 ? singleParts.join(' • ') : '<span style="color:#94a3b8; font-style:italic;">Minimal Base Cost</span>';

                // Total Row Build Cost
                const totalCost = getModuleBuildCost(macro, qty);
                const totalParts = [];
                if (totalCost.claytronics > 0) totalParts.push(`<span style="color:#fbbf24; font-weight:700;">${totalCost.claytronics.toLocaleString()}</span> Claytronics`);
                if (totalCost.ec > 0) totalParts.push(`<span style="color:#cbd5e1; font-weight:700;">${totalCost.ec.toLocaleString()}</span> EC`);
                if (totalCost.hullparts > 0) totalParts.push(`<span style="color:#38bdf8; font-weight:700;">${totalCost.hullparts.toLocaleString()}</span> Hull Parts`);
                if (totalCost.compSubstrate > 0) totalParts.push(`<span style="color:#f472b6; font-weight:700;">${totalCost.compSubstrate.toLocaleString()}</span> Computronic Substrate`);
                if (totalCost.silCarbide > 0) totalParts.push(`<span style="color:#a7f3d0; font-weight:700;">${totalCost.silCarbide.toLocaleString()}</span> Silicon Carbide`);
                if (totalCost.metMicrolatt > 0) totalParts.push(`<span style="color:#94a3b8; font-weight:700;">${totalCost.metMicrolatt.toLocaleString()}</span> Metallic Microlattice`);
                if (totalCost.protectyon > 0) totalParts.push(`<span style="color:#f472b6; font-weight:700;">${totalCost.protectyon.toLocaleString()}</span> Protectyon`);
                if (totalCost.water > 0) totalParts.push(`<span style="color:#38bdf8; font-weight:700;">${totalCost.water.toLocaleString()}</span> Water`);
                const totalCostStr = totalParts.length > 0 ? totalParts.join(' • ') : '<span style="color:#94a3b8; font-style:italic;">Minimal Construction Cost</span>';

                return `
                  <tr>
                    <td>
                      <div style="font-weight:700; color:#f8fafc; font-size:0.9rem;">${friendlyName}</div>
                      <div style="margin-top:0.2rem;"><span class="macro-name-tag">${macro}</span></div>
                    </td>
                    <td>
                      ${ware ? `<div style="font-weight:600; color:#cbd5e1;">${ware.name} <span style="font-size:0.75rem; color:#94a3b8;">(Level ${ware.level} ${ware.cat})</span></div>` : '<div style="color:#94a3b8; font-style:italic;">Unmapped Structure</div>'}
                      <div style="margin-top:0.35rem; font-size:0.78rem; color:#94a3b8; background:rgba(255,255,255,0.03); padding:0.25rem 0.5rem; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                        <span style="font-weight:700; color:#38bdf8;">1x Module Cost:</span> ${singleCostStr}
                      </div>
                    </td>
                    <td>
                      <div class="macro-qty-box">
                        <button class="btn-qty btn-macro-dec" data-macro="${macro}">-</button>
                        <input type="number" class="macro-qty-input" data-macro="${macro}" min="0" value="${qty}" />
                        <button class="btn-qty btn-macro-inc" data-macro="${macro}">+</button>
                      </div>
                    </td>
                    <td>
                      <div style="font-weight:700; color:#f8fafc; font-size:0.88rem;">${totalCostStr}</div>
                      <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">Total for ${qty}x module${qty === 1 ? '' : 's'}</div>
                    </td>
                    <td>
                      <button class="btn-del-macro" data-macro="${macro}">Delete</button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem; font-style:italic;">
                    No macro modules present in the current plan. Select a macro module above to add it, or load a blueprint .XML file.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Total Construction Summary Panel -->
      <div class="summation-panel">
        <div class="summation-header">
          <span>🏗️ Total Summated Station Construction Materials</span>
          <span style="font-size:0.85rem; color:#f8fafc; background:rgba(56,189,248,0.2); padding:0.2rem 0.6rem; border-radius:6px;">
            ${totalMacroModules} Total Modules Planned
          </span>
        </div>

        <div class="summation-grid">
          <div class="summation-card">
            <h3>⚙️ Primary Commonwealth Construction Materials</h3>
            <div class="summation-item">
              <span>Total Claytronics:</span>
              <strong style="color:#fbbf24;">${totalClaytronics.toLocaleString()} units</strong>
            </div>
            <div class="summation-item">
              <span>Total Energy Cells (EC):</span>
              <strong style="color:#34d399;">${totalECBuild.toLocaleString()} units</strong>
            </div>
            <div class="summation-item">
              <span>Total Hull Parts:</span>
              <strong style="color:#38bdf8;">${totalHullParts.toLocaleString()} units</strong>
            </div>
          </div>

          ${(totalCompSubstrate > 0 || totalSilCarbide > 0 || totalMetMicrolatt > 0) ? `
            <div class="summation-card">
              <h3>🚀 Terran Protectorate Construction Materials</h3>
              <div class="summation-item">
                <span>Computronic Substrate:</span>
                <strong style="color:#f472b6;">${totalCompSubstrate.toLocaleString()} units</strong>
              </div>
              <div class="summation-item">
                <span>Silicon Carbide:</span>
                <strong style="color:#a7f3d0;">${totalSilCarbide.toLocaleString()} units</strong>
              </div>
              <div class="summation-item">
                <span>Metallic Microlattice:</span>
                <strong style="color:#94a3b8;">${totalMetMicrolatt.toLocaleString()} units</strong>
              </div>
            </div>
          ` : ''}

          ${totalProtectyonBuild > 0 ? `
            <div class="summation-card">
              <h3>✨ Special Condensate & Shielding</h3>
              <div class="summation-item">
                <span>Protectyon Condensate:</span>
                <strong style="color:#f472b6;">${totalProtectyonBuild.toLocaleString()} units</strong>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function setupEvents() {
  const tabBtnMatrix = document.getElementById('tabBtnMatrix');
  const tabBtnPlanned = document.getElementById('tabBtnPlanned');

  if (tabBtnMatrix) {
    tabBtnMatrix.addEventListener('click', () => {
      activeTab = 'matrix';
      renderApp();
    });
  }

  if (tabBtnPlanned) {
    tabBtnPlanned.addEventListener('click', () => {
      activeTab = 'planned';
      renderApp();
    });
  }

  const btnUploadXML = document.getElementById('btnUploadXML');
  const xmlFileInput = document.getElementById('xmlFileInput');

  if (btnUploadXML && xmlFileInput) {
    btnUploadXML.addEventListener('click', () => xmlFileInput.click());
    xmlFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => parseXMLBlueprint(event.target.result, file.name);
        reader.readAsText(file);
      }
    });
  }

  const btnClearBP = document.getElementById('btnClearBP');
  if (btnClearBP) {
    btnClearBP.addEventListener('click', removeActiveBlueprint);
  }

  const viewport = document.getElementById('viewport');
  if (viewport) {
    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      viewport.classList.add('drag-active');
    });
    viewport.addEventListener('dragleave', () => {
      viewport.classList.remove('drag-active');
    });
    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      viewport.classList.remove('drag-active');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.xml')) {
        const reader = new FileReader();
        reader.onload = (event) => parseXMLBlueprint(event.target.result, file.name);
        reader.readAsText(file);
      }
    });
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      if (activeTab === 'matrix') filterWares();
    });
  }

  const moduleInput = document.getElementById('moduleInput');
  if (moduleInput) {
    moduleInput.addEventListener('input', (e) => {
      targetModules = Math.max(1, parseInt(e.target.value) || 1);
      renderApp();
    });
  }

  const workforceSlider = document.getElementById('workforceSlider');
  if (workforceSlider) {
    workforceSlider.addEventListener('input', (e) => {
      workforceBonus = parseInt(e.target.value) || 0;
      renderApp();
    });
  }

  const chkSubdueZeroX = document.getElementById('chkSubdueZeroX');
  if (chkSubdueZeroX) {
    chkSubdueZeroX.addEventListener('change', (e) => {
      subdueZeroX = e.target.checked;
      renderApp();
    });
  }

  document.querySelectorAll('.btn-filter[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentPreset = btn.dataset.preset;
      selectedWareId = null;
      calculatedDemand = {};
      if (currentPreset === 'all') {
        activeBlueprint = null;
      } else if (PRESET_BLUEPRINTS[currentPreset]) {
        const p = PRESET_BLUEPRINTS[currentPreset];
        activeBlueprint = {
          name: p.name,
          totalModules: p.totalModules,
          modules: { ...p.modules },
          rawMacros: { ...(p.rawMacros || {}) }
        };
      }
      renderApp();
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const key = btn.dataset.preset;
      if (key === 'all') return;

      const preset = PRESET_BLUEPRINTS[key];
      if (preset) {
        if (confirm(`Delete plan preset "${preset.label}" (${preset.name})?`)) {
          delete PRESET_BLUEPRINTS[key];
          try {
            const deleted = JSON.parse(localStorage.getItem('x4_deleted_presets') || '[]');
            if (!deleted.includes(key)) {
              deleted.push(key);
              localStorage.setItem('x4_deleted_presets', JSON.stringify(deleted));
            }
          } catch (err) {}

          if (currentPreset === key) {
            removeActiveBlueprint();
          } else {
            renderApp();
          }
        }
      }
    });
  });

  // Planned & Changed Modules Events
  const chkHideFoodAgri = document.getElementById('chkHideFoodAgri');
  if (chkHideFoodAgri) {
    chkHideFoodAgri.addEventListener('change', (e) => {
      hideFoodAgriPlanned = e.target.checked;
      renderApp();
    });
  }

  const selectFactionMethod = document.getElementById('selectFactionMethod');
  if (selectFactionMethod) {
    selectFactionMethod.addEventListener('change', (e) => {
      factionConstructionMethod = e.target.value;
      renderApp();
    });
  }

  const thSortMacro = document.getElementById('thSortMacro');
  if (thSortMacro) {
    thSortMacro.addEventListener('click', () => {
      macroSortAsc = !macroSortAsc;
      renderApp();
    });
  }

  const btnAddMacro = document.getElementById('btnAddMacro');
  const addMacroSelect = document.getElementById('addMacroSelect');

  if (btnAddMacro && addMacroSelect) {
    btnAddMacro.addEventListener('click', () => {
      const selectedMacro = addMacroSelect.value;
      if (!selectedMacro) {
        alert('Please select a macro module to add.');
        return;
      }

      if (!activeBlueprint) {
        activeBlueprint = {
          name: 'Custom Planned Station Blueprint',
          totalModules: 0,
          modules: {},
          rawMacros: {}
        };
      }

      if (!activeBlueprint.rawMacros) activeBlueprint.rawMacros = {};
      activeBlueprint.rawMacros[selectedMacro] = (activeBlueprint.rawMacros[selectedMacro] || 0) + 1;
      rebuildBlueprintFromMacros();
      renderApp();
    });
  }

  document.querySelectorAll('.macro-qty-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const macro = e.target.dataset.macro;
      const newQty = Math.max(0, parseInt(e.target.value) || 0);

      if (activeBlueprint && activeBlueprint.rawMacros) {
        if (newQty === 0) {
          delete activeBlueprint.rawMacros[macro];
        } else {
          activeBlueprint.rawMacros[macro] = newQty;
        }
        rebuildBlueprintFromMacros();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-macro-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (activeBlueprint && activeBlueprint.rawMacros) {
        activeBlueprint.rawMacros[macro] = (activeBlueprint.rawMacros[macro] || 0) + 1;
        rebuildBlueprintFromMacros();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-macro-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (activeBlueprint && activeBlueprint.rawMacros) {
        const currentQty = activeBlueprint.rawMacros[macro] || 0;
        if (currentQty <= 1) {
          delete activeBlueprint.rawMacros[macro];
        } else {
          activeBlueprint.rawMacros[macro] = currentQty - 1;
        }
        rebuildBlueprintFromMacros();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-del-macro').forEach(btn => {
    btn.addEventListener('click', () => {
      const macro = btn.dataset.macro;
      if (activeBlueprint && activeBlueprint.rawMacros) {
        delete activeBlueprint.rawMacros[macro];
        rebuildBlueprintFromMacros();
        renderApp();
      }
    });
  });

  // Matrix View Events
  if (activeTab === 'matrix') {
    document.querySelectorAll('.ware-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        highlightGraph(card.dataset.id);
      });
      card.addEventListener('mouseleave', () => {
        highlightGraph(selectedWareId);
      });
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        selectWare(card.dataset.id);
      });
    });

    const btnCloseIns = document.getElementById('btnCloseIns');
    if (btnCloseIns) {
      btnCloseIns.addEventListener('click', () => {
        selectWare(null);
      });
    }

    window.addEventListener('resize', drawLines);
  }
}

function selectWare(id) {
  selectedWareId = id;
  renderApp();
  highlightGraph(id);
}

function filterWares() {
  document.querySelectorAll('.ware-card').forEach(card => {
    const id = card.dataset.id;
    const ware = WARES_DB[id];
    const matches = ware.name.toLowerCase().includes(searchQuery) || ware.cat.toLowerCase().includes(searchQuery);
    card.style.display = matches ? 'block' : 'none';
  });
  drawLines();
}

function drawLines() {
  const svg = document.getElementById('svgCanvas');
  const viewport = document.getElementById('viewport');
  if (!svg || !viewport) return;

  const rect = viewport.getBoundingClientRect();
  svg.setAttribute('width', viewport.scrollWidth);
  svg.setAttribute('height', viewport.scrollHeight);
  svg.innerHTML = '';

  DEPENDENCIES.forEach(dep => {
    const fromEl = document.getElementById(`ware-${dep.from}`);
    const toEl = document.getElementById(`ware-${dep.to}`);
    if (!fromEl || !toEl || fromEl.style.display === 'none' || toEl.style.display === 'none') return;

    const r1 = fromEl.getBoundingClientRect();
    const r2 = toEl.getBoundingClientRect();

    const x1 = r1.right - rect.left + viewport.scrollLeft;
    const y1 = r1.top + r1.height / 2 - rect.top + viewport.scrollTop;
    const x2 = r2.left - rect.left + viewport.scrollLeft;
    const y2 = r2.top + r2.height / 2 - rect.top + viewport.scrollTop;

    const dx = (x2 - x1) * 0.45;

    const isFromActive = calculatedDemand[dep.from] && calculatedDemand[dep.from].rateNeeded > 0;
    const isToActive = calculatedDemand[dep.to] && calculatedDemand[dep.to].rateNeeded > 0;

    const fromInPlan = activeBlueprint ? (activeBlueprint.modules[dep.from] || 0) : 1;
    const toInPlan = activeBlueprint ? (activeBlueprint.modules[dep.to] || 0) : 1;

    let isActiveLink = isFromActive && isToActive;
    if (activeBlueprint && subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
      isActiveLink = false;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', `link-line ${isActiveLink ? 'active-link' : 'ghost-link'}`);
    path.setAttribute('data-from', dep.from);
    path.setAttribute('data-to', dep.to);
    svg.appendChild(path);
  });

  highlightGraph(selectedWareId);
}

function highlightGraph(id) {
  if (!id) {
    document.querySelectorAll('.link-line').forEach(l => {
      const from = l.getAttribute('data-from');
      const to = l.getAttribute('data-to');
      const isFromActive = calculatedDemand[from] && calculatedDemand[from].rateNeeded > 0;
      const isToActive = calculatedDemand[to] && calculatedDemand[to].rateNeeded > 0;
      const fromInPlan = activeBlueprint ? (activeBlueprint.modules[from] || 0) : 1;
      const toInPlan = activeBlueprint ? (activeBlueprint.modules[to] || 0) : 1;

      let active = isFromActive && isToActive;
      if (activeBlueprint && subdueZeroX && (fromInPlan === 0 || toInPlan === 0)) {
        active = false;
      }
      l.className.baseVal = `link-line ${active ? 'active-link' : 'ghost-link'}`;
    });
    document.querySelectorAll('.ware-card').forEach(c => {
      const cardId = c.dataset.id;
      const hasCalc = calculatedDemand[cardId] && calculatedDemand[cardId].rateNeeded > 0;
      const inPlan = activeBlueprint ? (activeBlueprint.modules[cardId] || 0) : 1;
      const shouldGhost = activeBlueprint ? (!hasCalc || (subdueZeroX && inPlan === 0)) : false;
      c.classList.toggle('ghost-card', shouldGhost);
    });
    return;
  }

  const selectedWare = WARES_DB[id];
  const isLevel4 = selectedWare && selectedWare.level === 4;

  const upstreamSet = new Set([id]);
  const downstreamSet = new Set([id]);

  function traverseUp(curr) {
    DEPENDENCIES.filter(d => d.to === curr).forEach(d => {
      upstreamSet.add(d.from);
      traverseUp(d.from);
    });
  }

  function traverseDown(curr) {
    DEPENDENCIES.filter(d => d.from === curr).forEach(d => {
      downstreamSet.add(d.to);
      traverseDown(d.to);
    });
  }

  traverseUp(id);
  if (!isLevel4) {
    traverseDown(id);
  }

  const allowedNodes = isLevel4 ? upstreamSet : new Set([...upstreamSet, ...downstreamSet]);

  // Highlight/Ghost cards
  document.querySelectorAll('.ware-card').forEach(card => {
    const cardId = card.dataset.id;
    const isAllowed = allowedNodes.has(cardId);

    if (isAllowed) {
      card.classList.remove('ghost-card');
    } else {
      card.classList.add('ghost-card');
    }
  });

  // Subdue ALL purple links everywhere!
  // ONLY active-to-active links on traced pathways remain brightly lit green.
  document.querySelectorAll('.link-line').forEach(line => {
    const from = line.getAttribute('data-from');
    const to = line.getAttribute('data-to');

    const isFromActive = calculatedDemand[from] && calculatedDemand[from].rateNeeded > 0;
    const isToActive = calculatedDemand[to] && calculatedDemand[to].rateNeeded > 0;
    const isActiveToActive = isFromActive && isToActive;

    const isUpstreamLink = upstreamSet.has(from) && upstreamSet.has(to);
    const isDownstreamLink = !isLevel4 && downstreamSet.has(from) && downstreamSet.has(to);
    const isTracedLink = isUpstreamLink || isDownstreamLink;

    if (isTracedLink && isActiveToActive) {
      line.className.baseVal = 'link-line active-link'; // Green active production link
    } else {
      // Subdue ALL purple links and non-active links into faint ghost lines!
      line.className.baseVal = 'link-line ghost-link';
    }
  });
}

function updateInspector(id) {
  const insTitle = document.getElementById('insTitle');
  const insSub = document.getElementById('insSub');
  const insBody = document.getElementById('insBody');

  if (!insTitle || !insSub || !insBody) return;

  const effMultiplier = 1 + (workforceBonus / 100);

  // CASE 1: Active Blueprint loaded & no specific card selected
  if (activeBlueprint && !id) {
    insTitle.innerText = 'Blueprint Inspector';
    insSub.innerText = activeBlueprint.name;

    const rawList = [
      { name: 'Ore', rate: calculatedDemand['Ore'] ? calculatedDemand['Ore'].rateNeeded : 0 },
      { name: 'Silicon', rate: calculatedDemand['Silicon'] ? calculatedDemand['Silicon'].rateNeeded : 0 },
      { name: 'Methane', rate: calculatedDemand['Methane'] ? calculatedDemand['Methane'].rateNeeded : 0 },
      { name: 'Hydrogen', rate: calculatedDemand['Hydrogen'] ? calculatedDemand['Hydrogen'].rateNeeded : 0 },
      { name: 'Helium', rate: calculatedDemand['Helium'] ? calculatedDemand['Helium'].rateNeeded : 0 },
      { name: 'Ice (Agriculture & Water)', rate: calculatedDemand['Ice'] ? calculatedDemand['Ice'].rateNeeded : 0, color: '#38bdf8' },
      { name: 'Raw Scrap Fragments', rate: calculatedDemand['RawScrap'] ? calculatedDemand['RawScrap'].rateNeeded : 0, color: '#fbbf24' },
      { name: 'Protectyon (Condensate)', rate: calculatedDemand['Protectyon'] ? calculatedDemand['Protectyon'].rateNeeded : 0, color: '#f472b6' }
    ];

    const activeRawList = rawList.filter(item => item.rate > 0);
    const totalRaw = activeRawList.reduce((sum, item) => sum + item.rate, 0);
    const ecTotal = calculatedDemand['EC'] ? calculatedDemand['EC'].rateNeeded : 0;

    const sortedEntries = Object.entries(calculatedDemand)
      .filter(([wId, c]) => c.rateNeeded > 0 && WARES_DB[wId] && WARES_DB[wId].level > 0)
      .sort(([idA, calcA], [idB, calcB]) => {
        if (bpSortField === 'needed') {
          const neededA = calcA.modulesNeeded || 0;
          const neededB = calcB.modulesNeeded || 0;
          if (neededA !== neededB) {
            return bpSortAsc ? neededA - neededB : neededB - neededA;
          }
          return WARES_DB[idA].name.localeCompare(WARES_DB[idB].name);
        } else {
          const nameA = WARES_DB[idA].name;
          const nameB = WARES_DB[idB].name;
          return bpSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
      });

    insBody.innerHTML = `
      <div class="workforce-box" style="border-color:#38bdf8;">
        <h4>⛏️ Total Recalculated Raw Mining & Liquids</h4>
        ${activeRawList.length > 0 ? activeRawList.map(item => `
          <p><strong style="${item.color ? `color:${item.color};` : ''}">${item.name}:</strong> ${Math.round(item.rate).toLocaleString()} / hr</p>
        `).join('') : `
          <p style="color:#94a3b8; font-style:italic;">No raw resource mining required for active blueprint modules.</p>
        `}
        <hr style="border-color:rgba(255,255,255,0.1); margin:0.4rem 0;" />
        <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
        <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Total:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
      </div>

      <div style="margin-top:0.6rem;">
        <div class="section-label">All Plan Modules & Recalculated Upstream Chains</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th id="thBpSortComp" class="sortable" title="Click to sort by Component Name">
                Component ${bpSortField === 'component' ? (bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
              </th>
              <th id="thBpSortNeeded" class="sortable" title="Click to sort by Needed Modules">
                Plan / Needed ${bpSortField === 'needed' ? (bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
              </th>
              <th>Current / Optimum Rate</th>
            </tr>
          </thead>
          <tbody>
            ${sortedEntries.map(([wareId, calc]) => {
              const ware = WARES_DB[wareId];
              const inPlanCount = activeBlueprint.modules[wareId] || 0;
              const neededCountStr = calc.modulesNeeded >= 1 ? `${calc.modulesNeeded}x` : `${calc.modulesNeeded.toFixed(1)}x`;
              const isDirectPlan = inPlanCount > 0;
              const isSubdued = subdueZeroX && inPlanCount === 0;

              const currentRate = inPlanCount * ware.baseRate * effMultiplier;
              const optimumRate = calc.rateNeeded;

              let rateDisplay = '&mdash;';
              if (ware.level >= 1 && ware.level <= 3) {
                rateDisplay = `
                  <div style="font-size:0.75rem; line-height:1.35;">
                    <div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${inPlanCount > 0 ? '#38bdf8' : '#64748b'};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>
                    <div><span style="color:#94a3b8; font-size:0.68rem;">Optimum:</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
                  </div>
                `;
              }

              return `
                <tr style="${isDirectPlan ? 'background:rgba(56,189,248,0.08);' : ''} ${isSubdued ? 'opacity:0.3; filter:grayscale(100%); font-style:italic;' : ''}">
                  <td>
                    <strong>${ware.name}</strong> (L${ware.level})
                    ${isDirectPlan ? '<span style="font-size:0.65rem; color:#38bdf8; margin-left:4px;">[In Plan]</span>' : ''}
                  </td>
                  <td class="highlight-val">${inPlanCount}x / ${neededCountStr}</td>
                  <td>${rateDisplay}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const thBpSortComp = document.getElementById('thBpSortComp');
    if (thBpSortComp) {
      thBpSortComp.addEventListener('click', () => {
        if (bpSortField === 'component') {
          bpSortAsc = !bpSortAsc;
        } else {
          bpSortField = 'component';
          bpSortAsc = true;
        }
        updateInspector(id);
      });
    }

    const thBpSortNeeded = document.getElementById('thBpSortNeeded');
    if (thBpSortNeeded) {
      thBpSortNeeded.addEventListener('click', () => {
        if (bpSortField === 'needed') {
          bpSortAsc = !bpSortAsc;
        } else {
          bpSortField = 'needed';
          bpSortAsc = false;
        }
        updateInspector(id);
      });
    }

    return;
  }

  // CASE 2: No active blueprint loaded & no card selected
  if (!id || !WARES_DB[id]) {
    insTitle.innerText = 'Module Inspector';
    insSub.innerText = 'Single Target Mode';
    insBody.innerHTML = `
      <div style="padding: 0.5rem; color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">
        <p>No station blueprint is currently active.</p>
        <p style="margin-top:0.5rem;">Click on any material card in the matrix to select it as a Single Production Target, or upload a station <code>.xml</code> blueprint file.</p>
      </div>
    `;
    return;
  }

  // CASE 3: A specific card is selected (including Level 4 components)
  const ware = WARES_DB[id];
  insTitle.innerText = ware.name;
  insSub.innerText = `Level ${ware.level} • ${ware.cat}`;

  const rawList = [
    { name: 'Ore', rate: calculatedDemand['Ore'] ? calculatedDemand['Ore'].rateNeeded : 0 },
    { name: 'Silicon', rate: calculatedDemand['Silicon'] ? calculatedDemand['Silicon'].rateNeeded : 0 },
    { name: 'Methane', rate: calculatedDemand['Methane'] ? calculatedDemand['Methane'].rateNeeded : 0 },
    { name: 'Hydrogen', rate: calculatedDemand['Hydrogen'] ? calculatedDemand['Hydrogen'].rateNeeded : 0 },
    { name: 'Helium', rate: calculatedDemand['Helium'] ? calculatedDemand['Helium'].rateNeeded : 0 },
    { name: 'Ice (Agriculture & Water)', rate: calculatedDemand['Ice'] ? calculatedDemand['Ice'].rateNeeded : 0, color: '#38bdf8' },
    { name: 'Raw Scrap Fragments', rate: calculatedDemand['RawScrap'] ? calculatedDemand['RawScrap'].rateNeeded : 0, color: '#fbbf24' },
    { name: 'Protectyon (Condensate)', rate: calculatedDemand['Protectyon'] ? calculatedDemand['Protectyon'].rateNeeded : 0, color: '#f472b6' }
  ];

  const activeRawList = rawList.filter(item => item.rate > 0);
  const totalRaw = activeRawList.reduce((sum, item) => sum + item.rate, 0);
  const ecTotal = calculatedDemand['EC'] ? calculatedDemand['EC'].rateNeeded : 0;

  const upstreamEntries = Object.keys(calculatedDemand)
    .filter(uId => WARES_DB[uId] && WARES_DB[uId].level > 0 && uId !== id)
    .sort((uA, uB) => {
      const calcA = calculatedDemand[uA];
      const calcB = calculatedDemand[uB];
      if (bpSortField === 'needed') {
        const neededA = calcA ? calcA.modulesNeeded || 0 : 0;
        const neededB = calcB ? calcB.modulesNeeded || 0 : 0;
        if (neededA !== neededB) {
          return bpSortAsc ? neededA - neededB : neededB - neededA;
        }
        return WARES_DB[uA].name.localeCompare(WARES_DB[uB].name);
      } else {
        const nameA = WARES_DB[uA].name;
        const nameB = WARES_DB[uB].name;
        return bpSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
    });

  const upstreamRows = upstreamEntries.map(uId => {
    const uWare = WARES_DB[uId];
    const uCalc = calculatedDemand[uId];
    const inPlanCount = activeBlueprint ? (activeBlueprint.modules[uId] || 0) : 0;
    const currentRate = inPlanCount * uWare.baseRate * effMultiplier;
    const optimumRate = uCalc.rateNeeded;

    let uRateDisplay = '&mdash;';
    if (uWare.level >= 1 && uWare.level <= 3) {
      uRateDisplay = `
        <div style="font-size:0.75rem; line-height:1.35;">
          <div><span style="color:#94a3b8; font-size:0.68rem;">Current:</span> <strong style="color:${inPlanCount > 0 ? '#38bdf8' : '#64748b'};">${Math.round(currentRate).toLocaleString()}</strong>/hr</div>
          <div><span style="color:#94a3b8; font-size:0.68rem;">Optimum:</span> <strong style="color:#34d399;">${Math.round(optimumRate).toLocaleString()}</strong>/hr</div>
        </div>
      `;
    }

    const neededStr = uCalc.modulesNeeded >= 1 ? `${uCalc.modulesNeeded}x` : `${uCalc.modulesNeeded.toFixed(1)}x`;

    return `
      <tr>
        <td><strong>${uWare.name}</strong> (L${uWare.level})</td>
        <td class="highlight-val">${activeBlueprint ? `${inPlanCount}x / ${neededStr}` : neededStr}</td>
        <td>${uRateDisplay}</td>
      </tr>
    `;
  });

  insBody.innerHTML = `
    <p style="font-size:0.85rem; color: #cbd5e1; line-height:1.5;">${ware.desc}</p>

    <div class="workforce-box" style="border-color:#38bdf8; margin-top:0.6rem;">
      <h4>⛏️ Upstream Raw Mining & Liquids Required</h4>
      ${activeRawList.length > 0 ? activeRawList.map(item => `
        <p><strong style="${item.color ? `color:${item.color};` : ''}">${item.name}:</strong> ${Math.round(item.rate).toLocaleString()} / hr</p>
      `).join('') : `
        <p style="color:#94a3b8; font-style:italic;">No raw resource mining required for this module.</p>
      `}
      <hr style="border-color:rgba(255,255,255,0.1); margin:0.4rem 0;" />
      <p><strong style="color:#34d399;">Total Active Raw Extraction:</strong> ${Math.round(totalRaw).toLocaleString()} / hr</p>
      <p style="margin-top:0.3rem;"><strong style="color:#fbbf24;">⚡ Energy Cells Total:</strong> ${Math.round(ecTotal).toLocaleString()} / hr</p>
    </div>

    ${upstreamRows.length > 0 ? `
      <div style="margin-top:0.6rem;">
        <div class="section-label">Upstream Component Requirements (${upstreamRows.length} Wares)</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th id="thUpSortComp" class="sortable" title="Click to sort by Component Name">
                Material ${bpSortField === 'component' ? (bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
              </th>
              <th id="thUpSortNeeded" class="sortable" title="Click to sort by Needed Modules">
                ${activeBlueprint ? 'Plan / Needed' : 'Modules'} ${bpSortField === 'needed' ? (bpSortAsc ? '▲' : '▼') : '<span style="opacity:0.35; font-size:0.7rem;">▲▼</span>'}
              </th>
              <th>Current / Optimum Rate</th>
            </tr>
          </thead>
          <tbody>
            ${upstreamRows.join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;

  const thUpSortComp = document.getElementById('thUpSortComp');
  if (thUpSortComp) {
    thUpSortComp.addEventListener('click', () => {
      if (bpSortField === 'component') {
        bpSortAsc = !bpSortAsc;
      } else {
        bpSortField = 'component';
        bpSortAsc = true;
      }
      updateInspector(id);
    });
  }

  const thUpSortNeeded = document.getElementById('thUpSortNeeded');
  if (thUpSortNeeded) {
    thUpSortNeeded.addEventListener('click', () => {
      if (bpSortField === 'needed') {
        bpSortAsc = !bpSortAsc;
      } else {
        bpSortField = 'needed';
        bpSortAsc = false;
      }
      updateInspector(id);
    });
  }
}

document.addEventListener('DOMContentLoaded', renderApp);
