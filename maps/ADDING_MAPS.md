# Adding Maps

Each map lives in its own folder under `maps/`. All configuration is TypeScript — there are no JSON runtime configs.

## Folder Structure

```
maps/
└── yourMapName/
    ├── mapDefinition.ts # Identity, Asset URLs, and integration logic
    ├── geometry.ts      # Map geometry (walls, floors, procedural generators)
    └── config/          # Map-specific gameplay overrides
        ├── gameplay.ts  # Perk costs, starting points, damage multipliers
        ├── enemies.ts   # Zombie speed, dog health, box costs
        └── weapons.ts   # Per-map weapon damage/recoil overrides
```

---

## Step-by-Step Guide

### 1. Create the map folder

```bash
cp -r maps/_template maps/yourMapName
```

Rename the definition export inside `mapDefinition.ts` (e.g. `TemplateMapDefinition` → `YourMapDefinition`).

---

### 2. Configure Overrides in `config/`

The engine uses a **Fallback System** via `MapConfigManager`. If you omit a value in your map's `config/` files, it automatically uses the global default from `root/config/`.

#### `config/gameplay.ts`
```typescript
import { MapGameplayConfig } from '../../types';

export const yourMapGameplay: MapGameplayConfig = {
    startingPoints: 500,
    JUGGERNOG_COST: 2500, 
    // ... all other GAME_CONFIG fields supported
};
```

#### `config/enemies.ts`
```typescript
import { MapHellhoundConfig, MapMysteryBoxConfig } from '../../types';

export const yourMapHellhound: MapHellhoundConfig = {
    SPEED_BASE: 0.14,
};

export const yourMapMysteryBox: MapMysteryBoxConfig = {
    COST: 950,
};
```

---

### 3. Define Asset URLs in `mapDefinition.ts`

You can override model and texture URLs per-map. This allows a map to have "Desert Zombies" or unique wall textures without changing the engine.

```typescript
export const YourMapDefinition: MapDefinition = {
    meta: {
        id: "your_map_id",
        name: "Your Map Name",
        description: "A unique survival experience."
    },
    assetUrls: {
        models: {
            zombie: "/models/unique_zombie.glb"
        },
        textures: {
            wall: "/textures/unique_wall.jpg"
        }
    },
    // ...
```

---

### 4. Register the map

In **`managers/MapRegistry.ts`**, import and register your new definition:

```typescript
import { YourMapDefinition } from '../maps/yourMapName/mapDefinition';

export const MAP_DEFINITIONS: Record<string, MapDefinition> = {
    'warehouse':   WarehouseMapDefinition,
    'map_test':    MapTestDefinition,
    'your_map_id': YourMapDefinition, // ← add this
};
```

---

### 5. Add to the menu

In **`config/maps.ts`**, add an entry to the `MAPS` array so it appears in the lobby.

---

## Technical Details

### MapConfigManager
The `MapConfigManager` merges your map's `config/` folder with the global defaults at runtime. This means all systems (`PlayerCombatSystem`, `ZombieAISystem`, etc.) automatically adapt to your map's specific balance settings without any logic changes.

### Navigation Mesh
Ensure your `mapDefinition.ts` includes `navigation.navmeshParameters`. These are passed to **RecastJS** to generate the pathfinding mesh based on the geometry you defined in `geometry.ts`.
