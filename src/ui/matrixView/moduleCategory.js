// Categorise a station module (by macro id and display name) so similar module types group together.
export function getModuleCategoryOrder(macro, name) {
  const m = (macro || '').toLowerCase();
  const n = (name || '').toLowerCase();

  // 1. Habitation / Workforce
  if (m.startsWith('hab_') || m.startsWith('landmarks_') || n.includes('habitat') || n.includes('housing') || n.includes('spire') || n.includes('pillar') || n.includes('dome') || n.includes('biome') || n.includes('living') || n.includes('parlour') || n.includes('dormitory') || n.includes('oasis')) return 1;
  // 2. Storage Modules
  if (m.startsWith('storage_') || n.includes('storage')) return 2;
  // 3. Docks & Piers
  if (m.startsWith('dockarea_') || m.startsWith('pier_') || n.includes('dock') || n.includes('pier') || n.includes('landing')) return 3;
  // 4. Defence Platforms & Turrets / Shields / Weapons
  if (m.startsWith('defence_') || m.startsWith('defense_') || m.startsWith('turret_') || m.startsWith('shield_') || m.startsWith('weapon_') || n.includes('defence') || n.includes('defense') || n.includes('turret') || n.includes('shield')) return 4;
  // 5. Observation & Sensors / Radar
  if (m.includes('observationdeck') || m.startsWith('radar_') || n.includes('observation') || n.includes('radar') || n.includes('sensor')) return 5;
  // 6. Connection Structures & Trusses
  if (m.startsWith('struct_') || n.includes('connection') || n.includes('structure') || n.includes('cross') || n.includes('vertical') || n.includes('base') || n.includes('truss')) return 6;

  return 7;
}

// Display label for the same grouping.
export function getModuleCategoryLabel(macro, name) {
  const m = (macro || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (m.startsWith('hab_') || m.startsWith('landmarks_') || n.includes('habitat') || n.includes('housing') || n.includes('spire') || n.includes('pillar') || n.includes('dome') || n.includes('living')) return 'Habitation';
  if (m.startsWith('storage_') || n.includes('storage')) return 'Storage';
  if (m.startsWith('dockarea_') || m.startsWith('pier_') || n.includes('dock') || n.includes('pier')) return 'Dock / Pier';
  if (m.startsWith('shield_') || n.includes('shield')) return 'Shield Generator';
  if (m.startsWith('turret_') || n.includes('turret') || m.startsWith('weapon_')) return 'Turret / Weapon';
  if (m.startsWith('defence_') || m.startsWith('defense_') || n.includes('defence') || n.includes('defense')) return 'Defense Platform';
  if (m.includes('observationdeck') || m.startsWith('radar_') || n.includes('observation') || n.includes('radar')) return 'Radar / Observation';
  if (m.startsWith('struct_') || n.includes('connection') || n.includes('structure') || n.includes('cross') || n.includes('vertical') || n.includes('base') || n.includes('truss')) return 'Structure';
  return 'Station Module';
}
