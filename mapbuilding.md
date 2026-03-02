# Map Builder Debug Command Specification

This document provides a detailed specification for implementing a real-time map building debug command system for the DOM OF THE ROAD game.

---

## 1. Overview

Create a `/build` debug command that enables real-time map construction during gameplay. The implementation uses a **separate module pattern** to keep CommandRegistry clean:

- **`engine/MapBuilder.ts`** - Core map building system (entity storage, placement logic, export generation)
- **`engine/CommandRegistry.ts`** - Minimal `/build` command that delegates to MapBuilder

This separation follows the existing ECS pattern in the codebase where systems are isolated modules.

---

## 2. Entity Data Storage

Add a module-level storage system to `CommandRegistry.ts`:

```typescript
// Module-level storage (outside the COMMANDS object)
interface PlacedEntity {
    id: string;
    type: EntityType;
    pos: [number, number, number];
    rotation: number;
    props: Record<string, unknown>;
}

type EntityType = 
    | 'wall' | 'floor' | 'ceiling' | 'box' | 'ramp' 
    | 'ground' 
    | 'door' | 'window' 
    | 'perk' | 'wallbuy' | 'mysterybox' | 'power' | 'pap'
    | 'zone' | 'spawn' | 'light';

const placedEntities: PlacedEntity[] = [];
let entityIdCounter = 0;

function generateEntityId(type: EntityType): string {
    return `${type}_${entityIdCounter++}`;
}
```

---

## 3. Command Structure

All commands use the format `/build <subcommand> [args]`. Add the following to the `COMMANDS` object in `CommandRegistry.ts`:

### 3.1 Geometry Commands

```typescript
'build wall': (args, sm) => {
    // Args: [width] [height] [depth] (defaults: 1, 3, 0.5)
    const width = args[0] ? parseFloat(args[0]) : 1;
    const height = args[1] ? parseFloat(args[1]) : 3;
    const depth = args[2] ? parseFloat(args[2]) : 0.5;
    if (isNaN(width) || isNaN(height) || isNaN(depth)) return "Invalid dimensions.";
    
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('wall'),
        type: 'wall',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { width, height, depth, texture: 'brick' }
    };
    placedEntities.push(entity);
    return `Wall placed at ${formatPos(pos)} (${width}x${height}x${depth})`;
},

'build floor': (args, sm) => {
    // Args: [width] [depth] (defaults: 10, 10)
    const width = args[0] ? parseFloat(args[0]) : 10;
    const depth = args[1] ? parseFloat(args[1]) : 10;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('floor'),
        type: 'floor',
        pos,
        rotation: 0,
        props: { width, height: 0.2, depth, texture: 'floor' }
    };
    placedEntities.push(entity);
    return `Floor placed at ${formatPos(pos)} (${width}x${depth})`;
},

'build ceiling': (args, sm) => {
    // Args: [width] [depth] (defaults: 10, 10)
    const width = args[0] ? parseFloat(args[0]) : 10;
    const depth = args[1] ? parseFloat(args[1]) : 10;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('ceiling'),
        type: 'ceiling',
        pos: [pos[0], pos[1] + 4, pos[2]], // Place above player
        rotation: 0,
        props: { width, height: 0.2, depth, texture: 'ceiling' }
    };
    placedEntities.push(entity);
    return `Ceiling placed at ${formatPos(pos)} (${width}x${depth})`;
},

'build box': (args, sm) => {
    // Args: [width] [height] [depth] (defaults: 1, 1, 1)
    const width = args[0] ? parseFloat(args[0]) : 1;
    const height = args[1] ? parseFloat(args[1]) : 1;
    const depth = args[2] ? parseFloat(args[2]) : 1;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('box'),
        type: 'box',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { width, height, depth }
    };
    placedEntities.push(entity);
    return `Box placed at ${formatPos(pos)} (${width}x${height}x${depth})`;
},

'build ramp': (args, sm) => {
    // Args: [width] [height] [depth] (defaults: 3, 3, 5)
    const width = args[0] ? parseFloat(args[0]) : 3;
    const height = args[1] ? parseFloat(args[1]) : 3;
    const depth = args[2] ? parseFloat(args[2]) : 5;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('ramp'),
        type: 'ramp',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { width, height, depth }
    };
    placedEntities.push(entity);
    return `Ramp placed at ${formatPos(pos)} (${width}x${height}x${depth})`;
},

'build ground': (args, sm) => {
    // Args: [width] [depth] (defaults: 20, 20)
    const width = args[0] ? parseFloat(args[0]) : 20;
    const depth = args[1] ? parseFloat(args[1]) : 20;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('ground'),
        type: 'ground',
        pos,
        rotation: 0,
        props: { width, height: 0.1, depth, texture: 'wood' }
    };
    placedEntities.push(entity);
    return `Ground plane placed at ${formatPos(pos)} (${width}x${depth})`;
},
```

### 3.2 Interactable Commands

```typescript
'build door': (args, sm) => {
    // Args: [cost] [zoneFrom] [zoneTo]
    const cost = args[0] ? parseInt(args[0]) : 500;
    const zoneFrom = args[1] ? parseInt(args[1]) : 1;
    const zoneTo = args[2] ? parseInt(args[2]) : 2;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('door'),
        type: 'door',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { cost, connects: [zoneFrom, zoneTo], size: [3, 4, 0.3] }
    };
    placedEntities.push(entity);
    return `Door placed at ${formatPos(pos)} (cost: ${cost}, zones: ${zoneFrom}->${zoneTo})`;
},

'build window': (args, sm) => {
    // Args: [zone] [planks] (defaults: 1, 5)
    const zone = args[0] ? parseInt(args[0]) : 1;
    const planks = args[1] ? parseInt(args[1]) : 5;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('window'),
        type: 'window',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { zone, planks }
    };
    placedEntities.push(entity);
    return `Window placed at ${formatPos(pos)} (zone: ${zone}, planks: ${planks})`;
},

'build perk': (args, sm) => {
    // Args: <type> (juggernog, speed_cola, quick_revive)
    const perkType = args[0]?.toLowerCase();
    if (!perkType || !['juggernog', 'speed_cola', 'quick_revive'].includes(perkType)) {
        return "Usage: /build perk <juggernog|speed_cola|quick_revive>";
    }
    const zone = args[1] ? parseInt(args[1]) : 1;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('perk'),
        type: 'perk',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { type: perkType, zone, id: `perk_${perkType}_${entityIdCounter}` }
    };
    placedEntities.push(entity);
    return `${perkType} perk placed at ${formatPos(pos)} (zone: ${zone})`;
},

'build wallbuy': (args, sm) => {
    // Args: <weapon> [cost] [zone]
    const weapon = args[0]?.toLowerCase();
    if (!weapon) return "Usage: /build wallbuy <weapon_id> [cost] [zone]";
    const validWeapons = ['shotgun', 'smg', 'assault_rifle', 'lmg', 'pistol', 'famas', 'g11', 'aug', 'spas', 'hs10', 'm72'];
    if (!validWeapons.includes(weapon)) return `Invalid weapon. Valid: ${validWeapons.join(', ')}`;
    const cost = args[1] ? parseInt(args[1]) : 500;
    const zone = args[2] ? parseInt(args[2]) : 1;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('wallbuy'),
        type: 'wallbuy',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { weapon, cost, zone, id: `wallbuy_${weapon}_${entityIdCounter}` }
    };
    placedEntities.push(entity);
    return `Wallbuy (${weapon}) placed at ${formatPos(pos)} (cost: ${cost})`;
},

'build mysterybox': (args, sm) => {
    // Args: none
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('mysterybox'),
        type: 'mysterybox',
        pos,
        rotation: getPlayerRotationY(sm),
        props: {}
    };
    placedEntities.push(entity);
    return `Mystery box placed at ${formatPos(pos)}`;
},

'build power': (args, sm) => {
    // Args: none
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('power'),
        type: 'power',
        pos,
        rotation: getPlayerRotationY(sm),
        props: {}
    };
    placedEntities.push(entity);
    return `Power switch placed at ${formatPos(pos)}`;
},

'build pap': (args, sm) => {
    // Args: [zone]
    const zone = args[0] ? parseInt(args[0]) : 1;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('pap'),
        type: 'pap',
        pos,
        rotation: getPlayerRotationY(sm),
        props: { zone }
    };
    placedEntities.push(entity);
    return `Pack-a-Punch placed at ${formatPos(pos)} (zone: ${zone})`;
},
```

### 3.3 Zone, Spawn, and Light Commands

```typescript
'build zone': (args, sm) => {
    // Args: [id] [minX] [maxX] [minZ] [maxZ]
    const id = args[0] ? parseInt(args[0]) : Math.max(0, ...placedEntities.filter(e => e.type === 'zone').map(e => e.props.id as number)) + 1;
    const minX = args[1] ? parseFloat(args[1]) : -10;
    const maxX = args[2] ? parseFloat(args[2]) : 10;
    const minZ = args[3] ? parseFloat(args[3]) : -10;
    const maxZ = args[4] ? parseFloat(args[4]) : 10;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('zone'),
        type: 'zone',
        pos,
        rotation: 0,
        props: { id, bounds: { minX, maxX, minZ, maxZ }, spawnBounds: { min: [minX, 2, minZ], max: [maxX, 2, maxZ] } }
    };
    placedEntities.push(entity);
    return `Zone ${id} defined: X[${minX},${maxX}] Z[${minZ},${maxZ}]`;
},

'build spawn': (args, sm) => {
    // Args: [host|client] (default: host)
    const which = args[0]?.toLowerCase() === 'client' ? 'client' : 'host';
    const pos = getPlayerPosition(sm);
    const rotation = getPlayerRotationY(sm);
    // Remove existing spawn of same type
    const existingIdx = placedEntities.findIndex(e => e.type === 'spawn' && e.props.which === which);
    if (existingIdx !== -1) placedEntities.splice(existingIdx, 1);
    const entity: PlacedEntity = {
        id: generateEntityId('spawn'),
        type: 'spawn',
        pos,
        rotation,
        props: { which, rot: rotation }
    };
    placedEntities.push(entity);
    return `${which} spawn placed at ${formatPos(pos)}`;
},

'build light': (args, sm) => {
    // Args: [intensity] [range]
    const intensity = args[0] ? parseFloat(args[0]) : 1.0;
    const range = args[1] ? parseFloat(args[1]) : 20;
    const zone = args[2] ? parseInt(args[2]) : 1;
    const pos = getPlayerPosition(sm);
    const entity: PlacedEntity = {
        id: generateEntityId('light'),
        type: 'light',
        pos: [pos[0], -15, pos[2]] as [number, number, number], // Lights above
        rotation: 0,
        props: { intensity, range, zone }
    };
    placedEntities.push(entity);
    return `Light placed at ${formatPos(pos)} (intensity: ${intensity}, range: ${range})`;
},
```

### 3.4 Utility Commands

```typescript
'build list': (args, sm) => {
    if (placedEntities.length === 0) return "No entities placed yet.";
    const lines = placedEntities.map(e => `${e.type}: ${formatPos(e.pos)}`);
    return `Placed entities (${placedEntities.length}):\n` + lines.slice(0, 10).join('\n') + (lines.length > 10 ? `\n... and ${lines.length - 10} more` : '');
},

'build undo': (args, sm) => {
    if (placedEntities.length === 0) return "Nothing to undo.";
    const removed = placedEntities.pop();
    return `Removed: ${removed?.type} at ${formatPos(removed?.pos || [0,0,0])}`;
},

'build clear': (args, sm) => {
    const count = placedEntities.length;
    placedEntities.length = 0;
    entityIdCounter = 0;
    return `Cleared ${count} entities.`;
},
```

### 3.5 Export Command (Most Important)

```typescript
'build export': (args, sm) => {
    return generateMapDefinition();
},
```

---

## 4. Helper Functions

Add these helper functions to `CommandRegistry.ts` (outside `COMMANDS`):

```typescript
function getPlayerPosition(sm: StateManager): [number, number, number] {
    const p = sm.camera.position;
    return [parseFloat(p.x.toFixed(2)), parseFloat(p.y.toFixed(2)), parseFloat(p.z.toFixed(2))];
}

function getPlayerRotationY(sm: StateManager): number {
    return parseFloat(sm.camera.rotation.y.toFixed(2));
}

function formatPos(pos: [number, number, number]): string {
    return `[${pos[0]}, ${pos[1]}, ${pos[2]}]`;
}

function generateMapDefinition(): string {
    const geometry: PlacedEntity[] = placedEntities.filter(e => 
        ['wall', 'floor', 'ceiling', 'box', 'ramp'].includes(e.type)
    );
    const grounds: PlacedEntity[] = placedEntities.filter(e => e.type === 'ground');
    const doors: PlacedEntity[] = placedEntities.filter(e => e.type === 'door');
    const windows: PlacedEntity[] = placedEntities.filter(e => e.type === 'window');
    const perks: PlacedEntity[] = placedEntities.filter(e => e.type === 'perk');
    const wallbuys: PlacedEntity[] = placedEntities.filter(e => e.type === 'wallbuy');
    const mysteryboxes: PlacedEntity[] = placedEntities.filter(e => e.type === 'mysterybox');
    const powers: PlacedEntity[] = placedEntities.filter(e => e.type === 'power');
    const paps: PlacedEntity[] = placedEntities.filter(e => e.type === 'pap');
    const zones: PlacedEntity[] = placedEntities.filter(e => e.type === 'zone');
    const spawns: PlacedEntity[] = placedEntities.filter(e => e.type === 'spawn');
    const lights: PlacedEntity[] = placedEntities.filter(e => e.type === 'light');

    const hostSpawn = spawns.find(s => s.props.which === 'host');
    const clientSpawn = spawns.find(s => s.props.which === 'client');

    let output = `import { MapDefinition } from '@/engine/MapDefinition';

export const CustomMapDefinition: MapDefinition = {
    meta: {
        id: "custom_map_${Date.now()}",
        name: "Custom Map",
        version: "1.0.0",
        description: "Built via /build debug command"
    },
    
    geometry: [
${geometry.map(e => `        { type: "${e.type}", pos: [${e.pos.join(', ')}], size: [${(e.props.width || 1).toFixed(1)}, ${(e.props.height || 1).toFixed(1)}, ${(e.props.depth || 1).toFixed(1)}], rotation: [0, ${e.rotation}, 0], texture: "${e.props.texture || 'brick'}" }`).join(',\n')}
    ],
    
    grounds: [
${grounds.map(e => `        { width: ${(e.props.width as number).toFixed(1)}, height: ${(e.props.depth as number).toFixed(1)}, pos: [${e.pos.join(', ')}], texture: "${e.props.texture || 'wood'}" }`).join(',\n')}
    ],
    
    interactables: {
        doors: [
${doors.map(e => `            { id: "${e.id}", cost: ${e.props.cost}, connects: [${(e.props.connects as number[]).join(', ')}], pos: [${e.pos.join(', ')}], size: [${(e.props.size as number[]).join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        windows: [
${windows.map(e => `            { id: "${e.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation}, planks: ${e.props.planks} }`).join(',\n')}
        ],
        perks: [
${perks.map(e => `            { type: "${e.props.type}", id: "${e.props.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        wallbuys: [
${wallbuys.map(e => `            { weapon: "${e.props.weapon}", cost: ${e.props.cost}, id: "${e.props.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        mysteryBoxes: [
${mysteryboxes.map(e => `            { pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        powerSwitch: ${powers.length > 0 ? `{ pos: [${powers[0].pos.join(', ')}], rotation: ${powers[0].rotation} }` : 'null'},
        packAPunch: ${paps.length > 0 ? `{ pos: [${paps[0].pos.join(', ')}], rotation: ${paps[0].rotation}, zone: ${paps[0].props.zone} }` : 'null'}
    },
    
    fixtures: [
${lights.map(e => `        { pos: [${e.pos[0]}, ${e.pos[2]}], zone: ${e.props.zone}, intensity: ${e.props.intensity}, range: ${e.props.range} }`).join(',\n')}
    ],
    
    zones: [
${zones.map(e => `        { id: ${e.props.id}, bounds: { minX: ${(e.props.bounds as {minX:number}).minX}, maxX: ${(e.props.bounds as {maxX:number}).maxX}, minZ: ${(e.props.bounds as {minZ:number}).minZ}, maxZ: ${(e.props.bounds as {maxZ:number}).maxZ} }, spawnBounds: { min: [${((e.props.spawnBounds as {min:number[]}).min).join(', ')}], max: [${((e.props.spawnBounds as {max:number[]}).max).join(', ')}] } }`).join(',\n')}
    ],
    
    spawns: {
        host: ${hostSpawn ? `{ pos: [${hostSpawn.pos.join(', ')}], rot: ${hostSpawn.props.rot} }` : '{ pos: [0, 2.2, 0], rot: 0 }'},
        client: ${clientSpawn ? `{ pos: [${clientSpawn.pos.join(', ')}], rot: ${clientSpawn.props.rot} }` : '{ pos: [4, 2.2, 0], rot: 0 }'}
    },
    
    environment: {
        fog: { mode: 'exp2', density: 0.02, color: [0.3, 0.35, 0.45] },
        skybox: true,
        ambientLight: { intensity: 0.4, diffuse: [0.3, 0.35, 0.45], ground: [0.15, 0.15, 0.2] },
        directionalLight: { direction: [-0.3, -1, 0.2], intensity: 0.4 }
    },
    
    navigation: {
        navmeshParameters: {
            cs: 0.2, ch: 0.2, walkableSlopeAngle: 45, walkableHeight: 2.0,
            walkableClimb: 0.5, walkableRadius: 0.3, maxEdgeLen: 12,
            maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
            maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1
        }
    }
};`;

    return output;
}
```

---

## 5. Implementation Steps

### Step 1: Create `engine/MapBuilder.ts`

Create a new file with the complete map building system:

```typescript
// engine/MapBuilder.ts
import { StateManager } from '../state/StateManager';

export type EntityType = 
    | 'wall' | 'floor' | 'ceiling' | 'box' | 'ramp' 
    | 'ground' 
    | 'door' | 'window' 
    | 'perk' | 'wallbuy' | 'mysterybox' | 'power' | 'pap'
    | 'zone' | 'spawn' | 'light';

export interface PlacedEntity {
    id: string;
    type: EntityType;
    pos: [number, number, number];
    rotation: number;
    props: Record<string, unknown>;
}

class MapBuilderSystem {
    private entities: PlacedEntity[] = [];
    private idCounter = 0;

    private generateId(type: EntityType): string {
        return `${type}_${this.idCounter++}`;
    }

    private getPlayerPos(sm: StateManager): [number, number, number] {
        const p = sm.camera.position;
        return [parseFloat(p.x.toFixed(2)), parseFloat(p.y.toFixed(2)), parseFloat(p.z.toFixed(2))];
    }

    private getPlayerRotY(sm: StateManager): number {
        return parseFloat(sm.camera.rotation.y.toFixed(2));
    }

    // ============ GEOMETRY COMMANDS ============

    placeWall(args: string[], sm: StateManager): string {
        const width = args[0] ? parseFloat(args[0]) : 1;
        const height = args[1] ? parseFloat(args[1]) : 3;
        const depth = args[2] ? parseFloat(args[2]) : 0.5;
        if (isNaN(width) || isNaN(height) || isNaN(depth)) return "Invalid dimensions.";
        
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('wall'),
            type: 'wall',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { width, height, depth, texture: 'brick' }
        });
        return `Wall placed at [${pos.join(', ')}] (${width}x${height}x${depth})`;
    }

    placeFloor(args: string[], sm: StateManager): string {
        const width = args[0] ? parseFloat(args[0]) : 10;
        const depth = args[1] ? parseFloat(args[1]) : 10;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('floor'),
            type: 'floor',
            pos,
            rotation: 0,
            props: { width, height: 0.2, depth, texture: 'floor' }
        });
        return `Floor placed at [${pos.join(', ')}] (${width}x${depth})`;
    }

    placeCeiling(args: string[], sm: StateManager): string {
        const width = args[0] ? parseFloat(args[0]) : 10;
        const depth = args[1] ? parseFloat(args[1]) : 10;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('ceiling'),
            type: 'ceiling',
            pos: [pos[0], pos[1] + 4, pos[2]],
            rotation: 0,
            props: { width, height: 0.2, depth, texture: 'ceiling' }
        });
        return `Ceiling placed at [${pos.join(', ')}] (${width}x${depth})`;
    }

    placeBox(args: string[], sm: StateManager): string {
        const width = args[0] ? parseFloat(args[0]) : 1;
        const height = args[1] ? parseFloat(args[1]) : 1;
        const depth = args[2] ? parseFloat(args[2]) : 1;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('box'),
            type: 'box',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { width, height, depth }
        });
        return `Box placed at [${pos.join(', ')}] (${width}x${height}x${depth})`;
    }

    placeRamp(args: string[], sm: StateManager): string {
        const width = args[0] ? parseFloat(args[0]) : 3;
        const height = args[1] ? parseFloat(args[1]) : 3;
        const depth = args[2] ? parseFloat(args[2]) : 5;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('ramp'),
            type: 'ramp',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { width, height, depth }
        });
        return `Ramp placed at [${pos.join(', ')}] (${width}x${height}x${depth})`;
    }

    placeGround(args: string[], sm: StateManager): string {
        const width = args[0] ? parseFloat(args[0]) : 20;
        const depth = args[1] ? parseFloat(args[1]) : 20;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('ground'),
            type: 'ground',
            pos,
            rotation: 0,
            props: { width, height: 0.1, depth, texture: 'wood' }
        });
        return `Ground plane placed at [${pos.join(', ')}] (${width}x${depth})`;
    }

    // ============ INTERACTABLE COMMANDS ============

    placeDoor(args: string[], sm: StateManager): string {
        const cost = args[0] ? parseInt(args[0]) : 500;
        const zoneFrom = args[1] ? parseInt(args[1]) : 1;
        const zoneTo = args[2] ? parseInt(args[2]) : 2;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('door'),
            type: 'door',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { cost, connects: [zoneFrom, zoneTo], size: [3, 4, 0.3] }
        });
        return `Door placed at [${pos.join(', ')}] (cost: ${cost}, zones: ${zoneFrom}->${zoneTo})`;
    }

    placeWindow(args: string[], sm: StateManager): string {
        const zone = args[0] ? parseInt(args[0]) : 1;
        const planks = args[1] ? parseInt(args[1]) : 5;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('window'),
            type: 'window',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { zone, planks }
        });
        return `Window placed at [${pos.join(', ')}] (zone: ${zone}, planks: ${planks})`;
    }

    placePerk(args: string[], sm: StateManager): string {
        const perkType = args[0]?.toLowerCase();
        if (!perkType || !['juggernog', 'speed_cola', 'quick_revive'].includes(perkType)) {
            return "Usage: /build perk <juggernog|speed_cola|quick_revive>";
        }
        const zone = args[1] ? parseInt(args[1]) : 1;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('perk'),
            type: 'perk',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { type: perkType, zone, id: `perk_${perkType}_${this.idCounter}` }
        });
        return `${perkType} perk placed at [${pos.join(', ')}] (zone: ${zone})`;
    }

    placeWallbuy(args: string[], sm: StateManager): string {
        const weapon = args[0]?.toLowerCase();
        if (!weapon) return "Usage: /build wallbuy <weapon_id> [cost] [zone]";
        const validWeapons = ['shotgun', 'smg', 'assault_rifle', 'lmg', 'pistol', 'famas', 'g11', 'aug', 'spas', 'hs10', 'm72'];
        if (!validWeapons.includes(weapon)) return `Invalid weapon. Valid: ${validWeapons.join(', ')}`;
        const cost = args[1] ? parseInt(args[1]) : 500;
        const zone = args[2] ? parseInt(args[2]) : 1;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('wallbuy'),
            type: 'wallbuy',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { weapon, cost, zone, id: `wallbuy_${weapon}_${this.idCounter}` }
        });
        return `Wallbuy (${weapon}) placed at [${pos.join(', ')}] (cost: ${cost})`;
    }

    placeMysterybox(args: string[], sm: StateManager): string {
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('mysterybox'),
            type: 'mysterybox',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: {}
        });
        return `Mystery box placed at [${pos.join(', ')}]`;
    }

    placePower(args: string[], sm: StateManager): string {
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('power'),
            type: 'power',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: {}
        });
        return `Power switch placed at [${pos.join(', ')}]`;
    }

    placePap(args: string[], sm: StateManager): string {
        const zone = args[0] ? parseInt(args[0]) : 1;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('pap'),
            type: 'pap',
            pos,
            rotation: this.getPlayerRotY(sm),
            props: { zone }
        });
        return `Pack-a-Punch placed at [${pos.join(', ')}] (zone: ${zone})`;
    }

    // ============ ZONE/SPAWN/LIGHT COMMANDS ============

    placeZone(args: string[], sm: StateManager): string {
        const id = args[0] ? parseInt(args[0]) : Math.max(0, ...this.entities.filter(e => e.type === 'zone').map(e => e.props.id as number)) + 1;
        const minX = args[1] ? parseFloat(args[1]) : -10;
        const maxX = args[2] ? parseFloat(args[2]) : 10;
        const minZ = args[3] ? parseFloat(args[3]) : -10;
        const maxZ = args[4] ? parseFloat(args[4]) : 10;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('zone'),
            type: 'zone',
            pos,
            rotation: 0,
            props: { id, bounds: { minX, maxX, minZ, maxZ }, spawnBounds: { min: [minX, 2, minZ], max: [maxX, 2, maxZ] } }
        });
        return `Zone ${id} defined: X[${minX},${maxX}] Z[${minZ},${maxZ}]`;
    }

    placeSpawn(args: string[], sm: StateManager): string {
        const which = args[0]?.toLowerCase() === 'client' ? 'client' : 'host';
        const pos = this.getPlayerPos(sm);
        const rotation = this.getPlayerRotY(sm);
        const existingIdx = this.entities.findIndex(e => e.type === 'spawn' && e.props.which === which);
        if (existingIdx !== -1) this.entities.splice(existingIdx, 1);
        this.entities.push({
            id: this.generateId('spawn'),
            type: 'spawn',
            pos,
            rotation,
            props: { which, rot: rotation }
        });
        return `${which} spawn placed at [${pos.join(', ')}]`;
    }

    placeLight(args: string[], sm: StateManager): string {
        const intensity = args[0] ? parseFloat(args[0]) : 1.0;
        const range = args[1] ? parseFloat(args[1]) : 20;
        const zone = args[2] ? parseInt(args[2]) : 1;
        const pos = this.getPlayerPos(sm);
        this.entities.push({
            id: this.generateId('light'),
            type: 'light',
            pos: [pos[0], -15, pos[2]],
            rotation: 0,
            props: { intensity, range, zone }
        });
        return `Light placed at [${pos.join(', ')}] (intensity: ${intensity}, range: ${range})`;
    }

    // ============ UTILITY COMMANDS ============

    listEntities(): string {
        if (this.entities.length === 0) return "No entities placed yet.";
        const lines = this.entities.map(e => `${e.type}: [${e.pos.join(', ')}]`);
        return `Placed entities (${this.entities.length}):\n` + lines.slice(0, 10).join('\n') + (lines.length > 10 ? `\n... and ${lines.length - 10} more` : '');
    }

    undo(): string {
        if (this.entities.length === 0) return "Nothing to undo.";
        const removed = this.entities.pop();
        return `Removed: ${removed?.type} at [${(removed?.pos || [0,0,0]).join(', ')}]`;
    }

    clear(): string {
        const count = this.entities.length;
        this.entities.length = 0;
        this.idCounter = 0;
        return `Cleared ${count} entities.`;
    }

    // ============ EXPORT ============

    export(): string {
        const geometry = this.entities.filter(e => ['wall', 'floor', 'ceiling', 'box', 'ramp'].includes(e.type));
        const grounds = this.entities.filter(e => e.type === 'ground');
        const doors = this.entities.filter(e => e.type === 'door');
        const windows = this.entities.filter(e => e.type === 'window');
        const perks = this.entities.filter(e => e.type === 'perk');
        const wallbuys = this.entities.filter(e => e.type === 'wallbuy');
        const mysteryboxes = this.entities.filter(e => e.type === 'mysterybox');
        const powers = this.entities.filter(e => e.type === 'power');
        const paps = this.entities.filter(e => e.type === 'pap');
        const zones = this.entities.filter(e => e.type === 'zone');
        const spawns = this.entities.filter(e => e.type === 'spawn');
        const lights = this.entities.filter(e => e.type === 'light');

        const hostSpawn = spawns.find(s => s.props.which === 'host');
        const clientSpawn = spawns.find(s => s.props.which === 'client');

        return `import { MapDefinition } from '@/engine/MapDefinition';

export const CustomMapDefinition: MapDefinition = {
    meta: {
        id: "custom_map_${Date.now()}",
        name: "Custom Map",
        version: "1.0.0",
        description: "Built via /build debug command"
    },
    
    geometry: [
${geometry.map(e => `        { type: "${e.type}", pos: [${e.pos.join(', ')}], size: [${(e.props.width || 1).toFixed(1)}, ${(e.props.height || 1).toFixed(1)}, ${(e.props.depth || 1).toFixed(1)}], rotation: [0, ${e.rotation}, 0], texture: "${e.props.texture || 'brick'}" }`).join(',\n')}
    ],
    
    grounds: [
${grounds.map(e => `        { width: ${(e.props.width as number).toFixed(1)}, height: ${(e.props.depth as number).toFixed(1)}, pos: [${e.pos.join(', ')}], texture: "${e.props.texture || 'wood'}" }`).join(',\n')}
    ],
    
    interactables: {
        doors: [
${doors.map(e => `            { id: "${e.id}", cost: ${e.props.cost}, connects: [${(e.props.connects as number[]).join(', ')}], pos: [${e.pos.join(', ')}], size: [${(e.props.size as number[]).join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        windows: [
${windows.map(e => `            { id: "${e.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation}, planks: ${e.props.planks} }`).join(',\n')}
        ],
        perks: [
${perks.map(e => `            { type: "${e.props.type}", id: "${e.props.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        wallbuys: [
${wallbuys.map(e => `            { weapon: "${e.props.weapon}", cost: ${e.props.cost}, id: "${e.props.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        mysteryBoxes: [
${mysteryboxes.map(e => `            { pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        powerSwitch: ${powers.length > 0 ? `{ pos: [${powers[0].pos.join(', ')}], rotation: ${powers[0].rotation} }` : 'null'},
        packAPunch: ${paps.length > 0 ? `{ pos: [${paps[0].pos.join(', ')}], rotation: ${paps[0].rotation}, zone: ${paps[0].props.zone} }` : 'null'}
    },
    
    fixtures: [
${lights.map(e => `        { pos: [${e.pos[0]}, ${e.pos[2]}], zone: ${e.props.zone}, intensity: ${e.props.intensity}, range: ${e.props.range} }`).join(',\n')}
    ],
    
    zones: [
${zones.map(e => `        { id: ${e.props.id}, bounds: { minX: ${(e.props.bounds as {minX:number}).minX}, maxX: ${(e.props.bounds as {maxX:number}).maxX}, minZ: ${(e.props.bounds as {minZ:number}).minZ}, maxZ: ${(e.props.bounds as {maxZ:number}).maxZ} }, spawnBounds: { min: [${((e.props.spawnBounds as {min:number[]}).min).join(', ')}], max: [${((e.props.spawnBounds as {max:number[]}).max).join(', ')}] } }`).join(',\n')}
    ],
    
    spawns: {
        host: ${hostSpawn ? `{ pos: [${hostSpawn.pos.join(', ')}], rot: ${hostSpawn.props.rot} }` : '{ pos: [0, 2.2, 0], rot: 0 }'},
        client: ${clientSpawn ? `{ pos: [${clientSpawn.pos.join(', ')}], rot: ${clientSpawn.props.rot} }` : '{ pos: [4, 2.2, 0], rot: 0 }'}
    },
    
    environment: {
        fog: { mode: 'exp2', density: 0.02, color: [0.3, 0.35, 0.45] },
        skybox: true,
        ambientLight: { intensity: 0.4, diffuse: [0.3, 0.35, 0.45], ground: [0.15, 0.15, 0.2] },
        directionalLight: { direction: [-0.3, -1, 0.2], intensity: 0.4 }
    },
    
    navigation: {
        navmeshParameters: {
            cs: 0.2, ch: 0.2, walkableSlopeAngle: 45, walkableHeight: 2.0,
            walkableClimb: 0.5, walkableRadius: 0.3, maxEdgeLen: 12,
            maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
            maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1
        }
    }
};`;
    }

    execute(subcommand: string, args: string[], sm: StateManager): string {
        switch (subcommand) {
            // Geometry
            case 'wall': return this.placeWall(args, sm);
            case 'floor': return this.placeFloor(args, sm);
            case 'ceiling': return this.placeCeiling(args, sm);
            case 'box': return this.placeBox(args, sm);
            case 'ramp': return this.placeRamp(args, sm);
            case 'ground': return this.placeGround(args, sm);
            
            // Interactables
            case 'door': return this.placeDoor(args, sm);
            case 'window': return this.placeWindow(args, sm);
            case 'perk': return this.placePerk(args, sm);
            case 'wallbuy': return this.placeWallbuy(args, sm);
            case 'mysterybox': return this.placeMysterybox(args, sm);
            case 'power': return this.placePower(args, sm);
            case 'pap': return this.placePap(args, sm);
            
            // Zone/Spawn/Light
            case 'zone': return this.placeZone(args, sm);
            case 'spawn': return this.placeSpawn(args, sm);
            case 'light': return this.placeLight(args, sm);
            
            // Utility
            case 'list': return this.listEntities();
            case 'undo': return this.undo();
            case 'clear': return this.clear();
            case 'export': return this.export();
            
            default:
                return `Unknown subcommand: ${subcommand}. Use: wall, floor, ceiling, box, ramp, ground, door, window, perk, wallbuy, mysterybox, power, pap, zone, spawn, light, list, undo, clear, export`;
        }
    }
}

export const mapBuilder = new MapBuilderSystem();
```

### Step 2: Update `engine/CommandRegistry.ts`

Add a single `/build` command that delegates to MapBuilder:

```typescript
import { mapBuilder } from './MapBuilder';

// In COMMANDS object:
'build': (args, sm) => {
    if (args.length < 1) {
        return "Usage: /build <subcommand> [args]\nSubcommands: wall, floor, ceiling, box, ramp, ground, door, window, perk, wallbuy, mysterybox, power, pap, zone, spawn, light, list, undo, clear, export";
    }
    const subcommand = args[0].toLowerCase();
    const subArgs = args.slice(1);
    return mapBuilder.execute(subcommand, subArgs, sm);
},
```

Update the help command to include `/build`:

```typescript
'help': () => {
    return `Commands: /debug, /pos, /tp, /points, /give, /ammo, /round, /kill_all, /show_zones, /show_navmesh, /show_pathfinding, /wireframe, /god, /noclip, /powerup, /scaleweapon [weapon_id], /debug_pbr, /build [subcommand]`;
}
```

---

## 6. Testing

---

## 6. Usage Example

```
> /build wall 2 4 0.5
Wall placed at [5.2, 2.0, -10.5] (2x4x0.5)

> /build floor 10 10
Floor placed at [5.2, 0, -10.5] (10x10)

> /build door 500 1 2
Door placed at [5.2, 2, -10.5] (cost: 500, zones: 1->2)

> /build zone 1 -10 10 -20 0
Zone 1 defined: X[-10,10] Z[-20,0]

> /build spawn host
host spawn placed at [5.2, 2.2, -10.5]

> /build list
Placed entities (5):
wall: [5.2, 2.0, -10.5]
floor: [5.2, 0, -10.5]
door: [5.2, 2, -10.5]
zone: [5.2, 2.2, -10.5]
spawn: [5.2, 2.2, -10.5]

> /build export
[Full TypeScript map definition output]
```

---

## 7. Notes

- Player position is obtained from `sm.camera.position` and `sm.camera.rotation.y`
- Rotation is taken from player's facing direction (Y rotation)
- Default values are provided for all optional arguments
- Entity IDs are auto-generated with type prefix and counter
- The export generates a complete, valid `MapDefinition` object
- Output is meant to be copy-pasted directly to an LLM or saved as a `.ts` file in `maps/<mapName>/mapDefinition.ts`
