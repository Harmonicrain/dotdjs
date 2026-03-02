# Map Creation Guide

Maps in **DOM OF THE DEAD** are data-driven. A map consists of 3D geometry (GLB), a navigation mesh, and a TypeScript configuration file.

## 📁 Map Folder Structure

A map should be placed in `maps/<map_name>/`.
Example: `maps/warehouse/`

```
maps/warehouse/
├── config/              # Overrides for game balance
│   ├── gameplay.ts     # Starting points, perk costs, etc.
│   └── (other config files)
├── mapDefinition.ts     # The core definition file
└── (optional geometry files)
```

## 🗺️ The Map Definition (`mapDefinition.ts`)

The `MapDefinition` object defines:
*   **Meta**: Map name, ID, description.
*   **Geometry**: Floor, walls, ceilings (via `LevelBuilder`).
*   **Grounds**: Different floor materials/areas.
*   **Interactables**:
    *   **Doors**: Connects zones. Can be debris (destroyable) or doors (openable).
    *   **Windows**: Spawn points for zombies and barriers for players.
    *   **WallBuys**: Locations and weapons available for purchase.
    *   **MysteryBoxLocations**: Possible spots for the box to spawn.
    *   **Perks**: Locations for Juggernog, Speed Cola, Quick Revive.
    *   **PowerSwitch**: Location for the power switch.
    *   **PackAPunch**: Location for the weapon upgrade machine.
*   **Zones**: Logical areas of the map (Start Room, Hallway, etc.).
*   **Spawns**: Player spawn points (host and client).
*   **Navigation**: NavMesh parameters for AI pathfinding.
*   **Config**: Map-specific game balance overrides.

## 🏗️ LevelBuilder

Maps are built using the `LevelBuilder` class (`engine/LevelBuilder.ts`):
1.  Parses the `MapDefinition`
2.  Creates geometry from definitions
3.  Sets up materials
4.  Places interactables
5.  Creates collision meshes
6.  Returns references to all created objects

## 🧭 Navigation Mesh

The AI relies on a Navigation Mesh built at runtime or loaded from a pre-baked source.
*   Currently, the project uses **RecastJS**.
*   The geometry is passed to Recast to bake a navmesh at runtime.

## 🖌️ Adding a New Map

1.  **Duplicate Template**: Copy `maps/_template` to `maps/my_new_map`.
2.  **Export Geometry**: Create your level in Blender.
    *   Export the visual mesh as `map.glb`.
    *   Ensure units are in meters.
3.  **Define Zones**: Note down the coordinates for your zones and doorways.
4.  **Edit `mapDefinition.ts`**: Fill in the coordinates for your windows, wall buys, doors, perks, etc.
5.  **Configure Gameplay**: Adjust `config/gameplay.ts` for map-specific balance (starting points, perk costs).
6.  **Register**: Import your map in `managers/MapRegistry.ts` and add it to the `AvailableMaps` list.

## 🎮 Testing Your Map

Use debug commands to test:
*   `/pos` - Check your position for placing objects
*   `/tp <x> <y> <z>` - Teleport to test locations
*   `/round <n>` - Start a specific round

## 📦 Map Configuration

Each map can override game balance in `config/gameplay.ts`:

```typescript
export const myMapGameplay: MapGameplayConfig = {
    STARTING_POINTS: 500,
    JUGGERNOG_COST: 2500,
    SPEED_COLA_COST: 3000,
    QUICK_REVIVE_COST: 1500,
    PACK_A_PUNCH_COST: 5000,
    PACK_A_PUNCH_AMMO_COST: 2500,
};
```
