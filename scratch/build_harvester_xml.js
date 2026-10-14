import fs from 'fs';

const extracted = JSON.parse(fs.readFileSync('./scratch/extracted_wares.json', 'utf8'));
const basegameModules = [
  'module_gen_prod_hullparts_01',
  'module_gen_prod_refinedmetals_01',
  'module_gen_prod_energycells_01',
  'module_gen_prod_antimattercells_01',
  'module_gen_prod_antimatterconverters_01',
  'module_gen_prod_advancedcomposites_01',
  'module_gen_prod_advancedelectronics_01',
  'module_gen_prod_claytronics_01',
  'module_gen_prod_dronecomponents_01',
  'module_gen_prod_engineparts_01',
  'module_gen_prod_fieldcoils_01',
  'module_gen_prod_graphene_01',
  'module_gen_prod_microchips_01',
  'module_gen_prod_missilecomponents_01',
  'module_gen_prod_plasmaconductors_01',
  'module_gen_prod_quantumtubes_01',
  'module_gen_prod_scanningarrays_01',
  'module_gen_prod_shieldcomponents_01',
  'module_gen_prod_siliconwafers_01',
  'module_gen_prod_smartchips_01',
  'module_gen_prod_spices_01',
  'module_gen_prod_superfluidcoolant_01',
  'module_gen_prod_turretcomponents_01',
  'module_gen_prod_water_01',
  'module_gen_prod_weaponcomponents_01',
  'module_arg_prod_foodrations_01',
  'module_arg_prod_meat_01',
  'module_arg_prod_medicalsupplies_01',
  'module_arg_prod_spacefuel_01',
  'module_arg_prod_wheat_01',
  'module_par_prod_majadust_01',
  'module_par_prod_majasnails_01',
  'module_par_prod_medicalsupplies_01',
  'module_par_prod_sojabeans_01',
  'module_par_prod_sojahusk_01',
  'module_tel_prod_medicalsupplies_01',
  'module_tel_prod_nostropoil_01',
  'module_tel_prod_spaceweed_01',
  'module_tel_prod_sunriseflowers_01',
  'module_tel_prod_swampplant_01',
  'module_tel_prod_teladianium_01',
  'module_spl_prod_cheltmeat_01',
  'module_spl_prod_medicalsupplies_01',
  'module_spl_prod_scruffinfruit_01',
  'module_ter_prod_computronicsubstrate_01',
  'module_ter_prod_metallicmicrolattice_01',
  'module_ter_prod_proteinpaste_01',
  'module_ter_prod_siliconcarbide_01',
  'module_ter_prod_stimulants_01',
  'module_ter_prod_mre_01',
  'module_bor_prod_bofu_01',
  'module_bor_prod_bogas_01',
  'module_bor_prod_medicalsupplies_01',
  'module_bor_prod_plankton_01',
  'module_arg_stor_container_s_01',
  'module_arg_stor_container_m_01',
  'module_arg_stor_container_l_01',
  'module_arg_stor_solid_s_01',
  'module_arg_stor_solid_m_01',
  'module_arg_stor_solid_l_01',
  'module_arg_stor_liquid_s_01',
  'module_arg_stor_liquid_m_01',
  'module_arg_stor_liquid_l_01',
  'module_arg_hab_s_01',
  'module_arg_hab_m_01',
  'module_arg_hab_l_01',
  'module_arg_dock_m_01',
  'module_arg_dock_m_02',
  'module_arg_pier_l_01',
  'module_arg_pier_l_02',
  'module_arg_pier_l_03',
  'module_arg_conn_base_01',
  'module_arg_conn_cross_01',
  'module_arg_conn_cross_04',
  'module_arg_conn_vertical_01',
  'module_arg_conn_vertical_02',
  'module_gen_conn_observationdeck_01',
  'module_gen_conn_observationdeck_02',
  'module_gen_conn_observationdeck_03',
  'module_gen_conn_venturerbase_01',
  'module_gen_conn_venturerbase_02',
  'module_gen_conn_venturerbase_03',
  'module_gen_conn_venturercross_01',
  'module_gen_conn_venturervertical_01',
  'module_gen_conn_venturervertical_02',
  'module_gen_dock_m_venturer_01',
  'module_gen_ventureplatform_cross_01'
];

const allModules = [...new Set([...basegameModules, ...extracted.modules])];
const allShips = extracted.ships;
const allEquip = extracted.equipment;

function chunkList(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

const modChunks = chunkList(allModules, 15);
const shipChunks = chunkList(allShips, 15);
const equipChunks = chunkList(allEquip, 15);

let xml = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="CompanionBridgeHarvester" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <cues>
    <!-- Continuous heartbeat loop -->
    <cue name="CompanionHeartbeat">
      <delay exact="2s" />
      <actions>
        <raise_lua_event name="'X4_Check_Commands'" />
        <reset_cue cue="this" />
      </actions>
    </cue>

    <!-- Initialization on game load / start with version upgrade -->
    <cue name="CompanionHarvesterInit" version="10" instantiate="true">
      <conditions>
        <check_any>
          <event_cue_signalled cue="md.Setup.GameStart" />
          <event_cue_signalled cue="md.Setup.Start" />
          <event_game_loaded />
        </check_any>
      </conditions>
      <actions>
        <raise_lua_event name="'X4_MD_Log'" param="'CompanionHarvesterInit v10 triggered on game load!'" />
        <reset_cue cue="CompanionHeartbeat" />
        <signal_cue cue="HarvestPlayerStats" />
        <signal_cue cue="HarvestBlueprints" />
      </actions>
    </cue>

    <!-- Triggered when Companion UI requests an on-demand update -->
    <cue name="CompanionOnUpdateRequest" version="10" instantiate="true">
      <conditions>
        <check_any>
          <event_ui_triggered screen="'X4_Request_Update'" />
          <event_ui_triggered control="'X4_Request_Update'" />
          <event_ui_triggered screen="'x4_companion_bridge'" />
        </check_any>
      </conditions>
      <actions>
        <set_value name="$TargetTable" exact="'modules'" />
        <do_if value="event.param == 'X4_Request_Update'">
          <do_if value="event.param2? and event.param2 != ''">
            <set_value name="$TargetTable" exact="tostring event.param2" />
          </do_if>
        </do_if>
        <do_elseif value="event.param2 == 'X4_Request_Update'">
          <do_if value="event.param3? and event.param3 != ''">
            <set_value name="$TargetTable" exact="tostring event.param3" />
          </do_if>
          <do_elseif value="event.param? and event.param != ''">
            <set_value name="$TargetTable" exact="tostring event.param" />
          </do_elseif>
        </do_elseif>
        <do_elseif value="event.param == 'x4_companion_bridge'">
          <do_if value="event.param2? and event.param2 != '' and event.param2 != 'X4_Request_Update'">
            <set_value name="$TargetTable" exact="tostring event.param2" />
          </do_if>
          <do_elseif value="event.param3? and event.param3 != ''">
            <set_value name="$TargetTable" exact="tostring event.param3" />
          </do_elseif>
        </do_elseif>
        <do_elseif value="event.param? and event.param != '' and event.param != 'X4_Request_Update'">
          <set_value name="$TargetTable" exact="tostring event.param" />
        </do_elseif>
        <do_elseif value="event.param2? and event.param2 != '' and event.param2 != 'X4_Request_Update'">
          <set_value name="$TargetTable" exact="tostring event.param2" />
        </do_elseif>

        <raise_lua_event name="'X4_MD_Log'" param="'CompanionOnUpdateRequest received for table: ' + $TargetTable" />

        <do_if value="$TargetTable == 'modules'">
          <signal_cue cue="HarvestBlueprints" />
        </do_if>
        <do_elseif value="$TargetTable == 'ships'">
          <signal_cue cue="HarvestShips" />
        </do_elseif>
        <do_elseif value="$TargetTable == 'equipment'">
          <signal_cue cue="HarvestEquipment" />
        </do_elseif>
        <do_elseif value="$TargetTable == 'blueprints' or $TargetTable == 'all'">
          <signal_cue cue="HarvestBlueprints" />
          <signal_cue cue="HarvestShips" />
          <signal_cue cue="HarvestEquipment" />
        </do_elseif>
        <do_if value="$TargetTable == 'player' or $TargetTable == 'all'">
          <signal_cue cue="HarvestPlayerStats" />
        </do_if>
      </actions>
    </cue>

    <!-- Harvest Player Telemetry Table -->
    <cue name="HarvestPlayerStats" instantiate="true">
      <conditions>
        <event_cue_signalled />
      </conditions>
      <actions>
        <set_value name="$SectorName" exact="'Unknown'" />
        <do_if value="@player.sector.name">
          <set_value name="$SectorName" exact="player.sector.name" />
        </do_if>

        <set_value name="$PlayerTable" exact="table[
          $name = @player.name,
          $credits = @player.money,
          $sector = $SectorName
        ]" />

        <raise_lua_event name="'X4_Export_Player'" param="$PlayerTable" />
      </actions>
    </cue>

    <!-- Harvest Station Modules & Blueprints Table -->
    <cue name="HarvestBlueprints" instantiate="true">
      <conditions>
        <event_cue_signalled />
      </conditions>
      <actions>
        <set_value name="$WaresList" exact="[${modChunks[0].map(m => `ware.${m}`).join(', ')}]" />
`;

for (let i = 1; i < modChunks.length; i++) {
  xml += `        <append_list_elements name="$WaresList" other="[${modChunks[i].map(m => `ware.${m}`).join(', ')}]" />\n`;
}

xml += `
        <set_value name="$ExportTable" exact="table[]" />

        <do_for_each in="$WaresList" name="$Ware">
          <do_if value="@$Ware">
            <set_value name="$WareID" exact="$Ware.id" />
            <set_value name="$Name" exact="$Ware.name" />
            <set_value name="$Desc" exact="$Ware.description" />
            <do_if value="not $Desc">
              <set_value name="$Desc" exact="''" />
            </do_if>

            <set_value name="$IsUnlocked" exact="false" />
            <do_if value="player.blueprints.{$Ware}.any.exists">
              <set_value name="$IsUnlocked" exact="true" />
            </do_if>

            <set_value name="$MacroId" exact="''" />
            <do_if value="@$Ware.macro">
              <set_value name="$MacroId" exact="$Ware.macro.id" />
            </do_if>

            <set_value name="$ExportTable.{$WareID}" exact="table[
              $id = $WareID,
              $name = $Name,
              $description = $Desc,
              $category = 'Modules',
              $moduleType = 'Production',
              $group = 'modules',
              $hull = 100000,
              $unlocked = $IsUnlocked,
              $macro = $MacroId
            ]" />
          </do_if>
        </do_for_each>

        <raise_lua_event name="'X4_Export_Encyclopedia'" param="table[$table = 'modules', $items = $ExportTable]" />
      </actions>
    </cue>

    <!-- Harvest Ships Blueprint Table -->
    <cue name="HarvestShips" instantiate="true">
      <conditions>
        <event_cue_signalled />
      </conditions>
      <actions>
        <set_value name="$WaresList" exact="[${shipChunks[0].map(m => `ware.${m}`).join(', ')}]" />
`;

for (let i = 1; i < shipChunks.length; i++) {
  xml += `        <append_list_elements name="$WaresList" other="[${shipChunks[i].map(m => `ware.${m}`).join(', ')}]" />\n`;
}

xml += `
        <set_value name="$ExportTable" exact="table[]" />

        <do_for_each in="$WaresList" name="$Ware">
          <do_if value="@$Ware">
            <set_value name="$WareID" exact="$Ware.id" />
            <set_value name="$Name" exact="$Ware.name" />
            <set_value name="$Desc" exact="$Ware.description" />
            <do_if value="not $Desc">
              <set_value name="$Desc" exact="''" />
            </do_if>

            <set_value name="$IsUnlocked" exact="false" />
            <do_if value="player.blueprints.{$Ware}.any.exists">
              <set_value name="$IsUnlocked" exact="true" />
            </do_if>

            <set_value name="$MacroId" exact="''" />
            <do_if value="@$Ware.macro">
              <set_value name="$MacroId" exact="$Ware.macro.id" />
            </do_if>

            <set_value name="$ExportTable.{$WareID}" exact="table[
              $id = $WareID,
              $name = $Name,
              $description = $Desc,
              $category = 'Ships',
              $moduleType = 'Ship',
              $group = 'ships',
              $hull = 50000,
              $unlocked = $IsUnlocked,
              $macro = $MacroId
            ]" />
          </do_if>
        </do_for_each>

        <raise_lua_event name="'X4_Export_Encyclopedia'" param="table[$table = 'ships', $items = $ExportTable]" />
      </actions>
    </cue>

    <!-- Harvest Equipment Blueprint Table -->
    <cue name="HarvestEquipment" instantiate="true">
      <conditions>
        <event_cue_signalled />
      </conditions>
      <actions>
        <set_value name="$WaresList" exact="[${equipChunks[0].map(m => `ware.${m}`).join(', ')}]" />
`;

for (let i = 1; i < equipChunks.length; i++) {
  xml += `        <append_list_elements name="$WaresList" other="[${equipChunks[i].map(m => `ware.${m}`).join(', ')}]" />\n`;
}

xml += `
        <set_value name="$ExportTable" exact="table[]" />

        <do_for_each in="$WaresList" name="$Ware">
          <do_if value="@$Ware">
            <set_value name="$WareID" exact="$Ware.id" />
            <set_value name="$Name" exact="$Ware.name" />
            <set_value name="$Desc" exact="$Ware.description" />
            <do_if value="not $Desc">
              <set_value name="$Desc" exact="''" />
            </do_if>

            <set_value name="$IsUnlocked" exact="false" />
            <do_if value="player.blueprints.{$Ware}.any.exists">
              <set_value name="$IsUnlocked" exact="true" />
            </do_if>

            <set_value name="$MacroId" exact="''" />
            <do_if value="@$Ware.macro">
              <set_value name="$MacroId" exact="$Ware.macro.id" />
            </do_if>

            <set_value name="$ExportTable.{$WareID}" exact="table[
              $id = $WareID,
              $name = $Name,
              $description = $Desc,
              $category = 'Equipment',
              $moduleType = 'Equipment',
              $group = 'equipment',
              $hull = 10000,
              $unlocked = $IsUnlocked,
              $macro = $MacroId
            ]" />
          </do_if>
        </do_for_each>

        <raise_lua_event name="'X4_Export_Encyclopedia'" param="table[$table = 'equipment', $items = $ExportTable]" />
      </actions>
    </cue>
  </cues>
</mdscript>
`;

fs.writeFileSync('./md/BlueprintHarvester.xml', xml);
console.log('Successfully generated md/BlueprintHarvester.xml');
