# X4: Foundations — Construction Plan (Blueprint) XML Specification

This document details the XML schema and minimum required elements for X4: Foundations station construction blueprints (`constructionplan/*.xml`), derived from an empirical analysis of 68 station blueprints comprising 8,534 module entries.

---

## 1. Minimal Blueprint Example

The absolute minimum functional blueprint requires an XML declaration, the root `<plans>` tag, a `<plan>` element with identity attributes, and at least one module `<entry>` containing an `<offset>` with a `<position>` tag:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plans>
  <plan id="player_0000000001" name="Minimal Blueprint" description="">
    <entry index="1" macro="dockarea_arg_m_station_01_lowtech_macro">
      <offset>
        <position x="0" y="0" z="0"/>
      </offset>
    </entry>
  </plan>
</plans>
```

> **Coordinate Default Rule:** In X4, coordinate values that equal `0` are omitted by the game engine's serializer. Thus, `<position/>` is equivalent to `<position x="0" y="0" z="0"/>`.

---

## 2. XML Hierarchy Overview

```
plans
└── plan [id, name, description]
    ├── patches (optional)
    │   └── patch [extension, version, name]
    └── entry [index, macro, connection*]
        ├── offset (required for standard modules)
        │   ├── position [x, y, z]
        │   ├── rotation [yaw, pitch, roll] (optional)
        │   └── quaternion [qw, qx, qy, qz] (optional alternative to rotation)
        ├── predecessor [index, connection] (conditional - snapping)
        └── upgrades (optional)
            └── groups
                ├── turrets [macro, group, exact, path*]
                └── shields [macro, group, exact*, path*]
```

---

## 3. Element & Attribute Reference

### Root & Plan Container

#### `<plans>`
- **Type:** Root container element.
- **Occurrence:** Exactly 1 per file.
- **Attributes:** None.

#### `<plan>`
- **Type:** Plan definition.
- **Occurrence:** Exactly 1 per file.
- **Attributes:**
  - `id` (**Required**): Unique identifier string.
    - Format: Typically `player_<timestamp>` (e.g. `player_1783812240`) or `<GUID>_<timestamp>` (e.g. `32766536-68E3-46EE-8EED-2BDCABAD43ED_1673060907`).
  - `name` (**Required**): Display name shown in the in-game Station Build / Manage Construction Plans UI.
  - `description` (**Required / Standard**): User-facing description string (usually empty string `""` if not set).

#### `<patches>` & `<patch>` *(Optional)*
- **Occurrence:** 0 or 1 `<patches>` block containing 1 or more `<patch>` elements.
- **Purpose:** Specifies DLC dependencies required by modules in the blueprint. If a player lacks the DLC, the game warns about missing modules.
- **Attributes on `<patch>`:**
  - `extension`: DLC internal identifier (e.g. `ego_dlc_split`, `ego_dlc_terran`, `ego_dlc_boron`, `ego_dlc_timelines`).
  - `version`: Version integer (e.g. `800`, `900`).
  - `name`: Display name of the DLC (e.g. `"Cradle of Humanity"`, `"Split Vendetta"`).

---

### Module Definition (`<entry>`)

#### `<entry>`
- **Occurrence:** 1 or more per `<plan>`.
- **Attributes:**
  - `index` (**Required**): 1-based sequential integer (`1`, `2`, `3`, ...).
  - `macro` (**Required**): Internal macro ID of the station module (e.g. `dockarea_arg_m_station_01_lowtech_macro`, `prod_gen_hullparts_macro`, `struct_arg_cross_01_macro`).
  - `connection` (*Conditional*): Required only when snapped to another module. Identifies the snap connector on **this** module that attaches to the predecessor (e.g. `connectionsnap001`).

#### `<offset>`
- **Occurrence:** 1 per `<entry>` (omitted only for fixed sector landmarks like Antigone Spire).
- **Purpose:** Position and orientation in station plot space (local coordinates in meters).

##### `<position>`
- **Parent:** `<offset>`
- **Attributes:** `x`, `y`, `z` (floating-point numbers in meters).
- **Default:** If an axis is omitted, the coordinate value is `0.0`.

##### `<rotation>` *(Optional)*
- **Parent:** `<offset>`
- **Attributes:** `yaw`, `pitch`, `roll` (floating-point numbers in degrees).
- **Default:** Axis omitted if rotation is `0.0`.

##### `<quaternion>` *(Optional alternative to `<rotation>`)*
- **Parent:** `<offset>`
- **Attributes:** `qw`, `qx`, `qy`, `qz` (unit quaternion components). Used when free-form arbitrary rotations are serialized.

---

### Snapping & Topology (`<predecessor>`)

When a module is snapped to a prior module in the build tree:

```xml
<entry index="3" macro="dockarea_arg_m_station_02_hightech_macro" connection="connectionsnap001">
  <predecessor index="2" connection="connectionsnap001"/>
  <offset>
    <position x="-1840.678" y="356.685" z="-2272.103"/>
  </offset>
</entry>
```

- **`entry/@connection`**: Snap point on the **current** module (`index="3"`).
- **`predecessor/@index`**: Index of the **parent** module (`index="2"`).
- **`predecessor/@connection`**: Snap point on the **parent** module to which this module connects.

---

### Upgrades (Turrets & Shields)

Station modules with hardpoints (defense platforms, production modules, docks) define equipment under `<upgrades>`:

```xml
<upgrades>
  <groups>
    <shields macro="shield_arg_m_standard_02_mk2_macro" group="group01"/>
    <turrets macro="turret_arg_m_flak_02_mk1_macro" group="group01" exact="2"/>
    <turrets macro="turret_arg_l_plasma_01_mk1_macro" group="group05" exact="4"/>
  </groups>
</upgrades>
```

- **`<shields>` Attributes:**
  - `macro` (**Required**): Shield generator macro ID.
  - `group` (**Required**): Module hardpoint slot group identifier (e.g. `group01`, `group02`).
  - `exact` (*Optional*): Number of shields fitted.
  - `path` (*Optional*): Internal sub-component path if multiple sockets exist.
- **`<turrets>` Attributes:**
  - `macro` (**Required**): Turret weapon macro ID.
  - `group` (**Required**): Module hardpoint slot group identifier.
  - `exact` (**Required / Standard**): Number of turrets fitted in the group.
  - `path` (*Optional*): Internal sub-component path.

---

## 4. Empirical Frequency Across Analyzed Blueprints

Based on 68 plans containing 8,534 total module entries:

| Element / Attribute Path | Count | Prevalence |
| :--- | :--- | :--- |
| `plans` | 68 | 100% of files |
| `plans/plan` | 68 | 100% of files |
| `plans/plan/@id` | 68 | 100% of plans |
| `plans/plan/@name` | 68 | 100% of plans |
| `plans/plan/@description` | 68 | 100% of plans |
| `plans/plan/entry` | 8,534 | ~125 modules / plan average |
| `plans/plan/entry/@index` | 8,534 | 100% of entries |
| `plans/plan/entry/@macro` | 8,534 | 100% of entries |
| `plans/plan/entry/offset` | 8,533 | 99.99% of entries (1 landmark without offset) |
| `plans/plan/entry/offset/position` | 8,533 | 100% of offsets |
| `plans/plan/entry/offset/rotation` | 4,154 | 48.7% of entries (omitted when default 0 rotation) |
| `plans/plan/entry/offset/quaternion` | 57 | 0.7% of entries |
| `plans/plan/entry/@connection` | 6,872 | 80.5% of entries (only when snapped) |
| `plans/plan/entry/predecessor` | 6,872 | 80.5% of entries (seed modules have no predecessor) |
| `plans/plan/entry/upgrades` | 1,625 | 19.0% of entries (modules with weapons/shields) |
| `plans/plan/patches` | 36 | 52.9% of plans (plans requiring DLC modules) |
