# Maps & Zoning System

This document covers how to create maps, define zones, and how the zoning system works in DOM OF THE ROAD.

---

## Table of Contents

1. [Map Structure](#map-structure)
2. [Map Definition](#map-definition)
3. [Zones](#zones)
4. [Doors & Zone Connections](#doors--zone-connections)
5. [Interactables](#interactables)
6. [Grounds & Textures](#grounds--textures)
7. [Geometry](#geometry)
8. [Adding a New Map](#adding-a-new-map)
9. [Zoning System API](#zoning-system-api)

---

## Map Structure

Each map is defined in `maps/<mapName>/` with the following files:

```
maps/<mapName>/
├── config/
│   ├── weapons.ts      # Weapon availability & pricing
│   ├── enemies.ts      # Hellhound & mystery box config
│   └── gameplay.ts    # Round timing, zombie speeds, etc.
├── geometry.ts         # Wall/floor layout
└── mapDefinition.ts    # Main definition (imports config + geometry)
```

---

## Map Definition

The main map definition in `mapDefinition.ts` includes:

```typescript
export const MyMapDefinition: MapDefinition = {
    meta: {
        id: "my_map",
        name: "My Map",
        version: "1.0",
        description: "Description"
    },
    
    // Texture overrides
    textures: {
        wall: "/textures/brick.jpg",
        floor: "/textures/concrete.jpg",
    },
    
    // 3D geometry (walls, floors, ceilings)
    geometry: WAREHOUSE_GEOMETRY,
    
    // Ground planes (can be separate per zone for different textures)
    grounds: WAREHOUSE_GROUNDS,
    
    // Doors, windows, perks, wallbuys, etc.
    interactables: { ... },
    
    // Ceiling lights
    fixtures: [ ... ],
    
    // Zone definitions
    zones: [ ... ],
    
    // Player spawn points
    spawns: {
        host: { pos: [0, 2.2, -22], rot: 0 },
        client: { pos: [-4, 2.2, 18], rot: 0 }
    },
    
    // Navmesh configuration
    navigation: {
        navmeshParameters: { ... }
    },
    
    // Gameplay config overrides
    config: { ... }
};
```

---

## Zones

Zones are the core of the zombie spawning and pathfinding system. They define:

1. **Spawnable areas** - Where zombies can spawn (via windows)
2. **Pathfinding boundaries** - Navmesh uses zone bounds to snap player position
3. **Door connections** - Which zones connect via doors

### Zone Definition

```typescript
zones: [
    {
        id: 1,
        bounds: { minX: -10, maxX: 10, minZ: -30, maxZ: 0 },
        spawnBounds: { min: [-5, 2, -20], max: [5, 2, -5] }
    }
]
```

| Field | Description |
|-------|-------------|
| `id` | Unique zone identifier (integer) |
| `bounds` | Axis-aligned bounding box for the zone (X and Z only) |
| `spawnBounds` | Random spawn point area within the zone for zombies |

### Zone Bounds Formats

Two formats are supported:

```typescript
// Format 1: ZoneBounds object
bounds: { minX: -10, maxX: 10, minZ: -30, maxZ: 0 }

// Format 2: Array format (min/max as [x, y, z])
bounds: { min: [-10, 0, -30], max: [10, 0, 0] }
```

### Zone ID 1 is Default

If a position falls outside all defined zone bounds, `ZoneSystem.getZone()` returns `1` (the default starting zone).

---

## Doors & Zone Connections

Doors connect two zones and block zombie/player movement when closed.

```typescript
doors: [
    { 
        id: "door1", 
        cost: 500, 
        connects: [1, 2],        // Connects Zone 1 <-> Zone 2
        pos: [0, 2, 0],          // Door position
        size: [4, 4, 0.4],       // Door dimensions
        closedY: 2,              // Y position when closed
        openY: 6                 // Y position when open (slides up)
    }
]
```

**Key concepts:**
- Door `id` must be unique
- `connects: [1, 2]` means Zone 1 connects to Zone 2
- Doors are created at `pos` with `size` dimensions
- Opening animation moves the door to `openY` height

---

## Interactables

All interactive objects in the map:

### Windows

```typescript
windows: [
    { 
        id: "window_1", 
        zone: 1,                 // Window is in Zone 1
        pos: [10, 0, -20],       // Position
        rotation: 0              // Rotation (radians)
    }
]
```

**Zombies spawn from windows** in zones that are accessible from the player's current zone (via open doors).

### Perks

```typescript
perks: [
    { 
        type: "juggernog", 
        id: "juggernog", 
        zone: 2,                 // Perk is in Zone 2
        pos: [0, 0, 35], 
        rotation: Math.PI 
    }
]
```

Valid perk types: `juggernog`, `speed_cola`, `quick_revive`

### Wallbuys

```typescript
wallbuys: [
    { 
        weapon: "shotgun", 
        cost: 500, 
        id: "buy_shotgun", 
        zone: 1,                 // Wallbuy is in Zone 1
        pos: [-9.4, 2.5, -15], 
        rotation: Math.PI / 2 
    }
]
```

### Mystery Boxes

```typescript
mysteryBoxes: [
    { 
        pos: [3, 0, -28.9], 
        rotation: Math.PI 
    }
    // Note: Mystery boxes don't have a zone field - position determines zone
]
```

### Pack-a-Punch

```typescript
packAPunch: { 
    pos: [-14.0, 0, -5.5], 
    rotation: Math.PI / 2,
    zone: 4                   // Optional: zone for the PaP machine
}
```

### Power Switch

```typescript
powerSwitch: { 
    pos: [28.4, 1.5, 5], 
    rotation: Math.PI / 2,
    powerDoor: { 
        pos: [-10, 3, -5], 
        size: [0.4, 6, 4], 
        openY: 8 
    }
}
```

---

## Grounds & Textures

Grounds define floor planes. Each ground can have its own texture, enabling different floor styles per zone.

```typescript
grounds: [
    // Zone 1: Back left area
    { width: 20, height: 30, pos: [0, 0, -15], texture: 'wood' },
    
    // Zone 2: Front left area  
    { width: 20, height: 40, pos: [0, 0, 20], texture: 'wood' },
    
    // Zone 3: Right room
    { width: 20, height: 70, pos: [20, 0, 5], texture: 'concrete' },
    
    // Zone 4: Pack-a-Punch room
    { width: 6, height: 6, pos: [-14.5, 0.01, -5], texture: 'wood_small' },
]
```

**Ground position is the center point.** For example, a 20x30 ground at `(0, 0, -15)` covers:
- X: -10 to 10
- Z: -30 to 0

**Tip:** Align ground edges with wall positions to avoid gaps.

---

## Geometry

Walls, floors, and ceilings are defined as `GeometryDefinition[]`:

```typescript
geometry: [
    // Wall: type, position [x,y,z], size [w,h,d], texture
    { type: "wall", pos: [-10, 4.5, -23.5], size: [1, 9, 33], texture: "brick" },
    
    // Ceiling
    { type: "ceiling", pos: [8, 9.1, 0], size: [45, 0.2, 80] },
]
```

| Type | NavMesh | Collisions |
|------|---------|------------|
| `wall` | ✅ Added | ✅ Enabled |
| `floor` | ✅ Added | ✅ Enabled |
| `ceiling` | ❌ Not added | ✅ Enabled |
| `box` | ✅ Added | ✅ Enabled |

**Important:** Ceilings are excluded from navmesh generation to avoid phantom walkable surfaces.

---

## Adding a New Map

### Step 1: Create Map Folder

```
maps/my_new_map/
├── config/
│   ├── weapons.ts
│   ├── enemies.ts
│   └── gameplay.ts
├── geometry.ts
└── mapDefinition.ts
```

### Step 2: Define Geometry

1. Determine your wall positions (left wall X, right wall X, back wall Z, front wall Z)
2. Plan zone boundaries (where do doors divide areas?)
3. Create ground planes that align with walls

### Step 3: Define Zones

Match zone bounds to:
- Wall positions (X boundaries at walls)
- Ground floor positions (Z boundaries where floors meet)
- Door positions (zones connect at doors)

Example zone layout:
```
Zone 1: X: -10 to 10, Z: -30 to 0    (back left)
Zone 2: X: -10 to 10, Z: 0 to 40    (front left)
Zone 3: X: 10 to 30, Z: -30 to 40   (right room)
Zone 4: X: -16 to -13, Z: -8 to -2   (Pack-a-Punch room)
```

### Step 4: Register Map

In `managers/MapRegistry.ts`:

```typescript
import { MyNewMapDefinition } from '../maps/my_new_map/mapDefinition';

export const MAP_DEFINITIONS: Record<string, MapDefinition> = {
    'warehouse': WarehouseMapDefinition,
    'my_new_map': MyNewMapDefinition,
};
```

### Step 5: Add to Menu

Add entry to `config/maps.ts` so it appears in the map selection menu.

### Step 6: Test

Run the game and verify:
1. Player spawns in correct zone
2. Zombies spawn from windows in accessible zones
3. Navmesh pathfinding works (zombies can reach player)
4. Doors open/close correctly between zones

---

## Zoning System API

The `ZoneSystem` class provides these methods:

### `getZone(pos: Vector3): number`

Returns the zone ID containing the position, or `1` if outside all bounds.

```typescript
const zone = zoneSystem.getZone(playerPosition);
```

### `getAccessibleZones(currentZone: number, doorStates: Record<string, DoorState>): number[]`

Returns all zones reachable from current zone through open doors.

```typescript
const accessible = zoneSystem.getAccessibleZones(playerZone, doorStates);
```

### `getDoorBetween(fromZone: number, toZone: number): DoorConnection | null`

Returns the first door on the path between two zones.

```typescript
const door = zoneSystem.getDoorBetween(1, 3);
```

### `getRandomSpawnPoint(zoneId: number): Vector3 | null`

Returns a random point within the zone's spawnBounds.

```typescript
const spawnPoint = zoneSystem.getRandomSpawnPoint(zoneId);
```

---

## Common Issues & Solutions

### "Target far from navmesh" Warning

**Problem:** Zombie reports "Target far from navmesh (Xm)" where X > 5

**Causes:**
1. Player position is outside all zone bounds
2. Navmesh doesn't cover the player's area

**Solutions:**
1. Extend zone bounds to cover player spawn area
2. Add ground/navmesh coverage in that area

### Zombies Not Spawning

**Problem:** No zombies appear even though round started

**Causes:**
1. No windows in zones accessible from player
2. Zone bounds don't include player position
3. All windows are barricaded

**Solutions:**
1. Check `getZone(playerPos)` returns correct zone
2. Verify windows exist in accessible zones
3. Add debug: `/show_zones` to visualize zones

### Zone Validation Errors

The game validates map definitions at runtime:

```typescript
// In validateMapDefinition.ts
- Door references non-existent zone
- Window references non-existent zone  
- Perk references non-existent zone
- Wallbuy references non-existent zone
```

**Solution:** Ensure all zone IDs in interactables match defined zones.

---

## Debug Commands

| Command | Description |
|---------|-------------|
| `/show_zones` | Toggle zone boundary visualization |
| `/show_navmesh` | Toggle navmesh debug mesh |
| `/show_pathfinding` | Show zombie paths (green=zombie, orange=hellhound) |
| `/pos` | Show player position |

Use `/pos` to get coordinates, then verify they fall within your zone bounds.
