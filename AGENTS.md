# AGENTS.md — DOM OF THE DEAD

> **Purpose**: This file gives any AI coding assistant enough context to make correct, functional changes to this codebase without reading every file. Follow every pattern described here exactly.

---

## 1. Project Identity

**DOM OF THE DEAD** is a browser-based, multiplayer round-based zombie survival FPS. It runs entirely in the browser using Babylon.js for 3D rendering and React 19 for UI.

### Tech Stack
| Layer       | Technology |
|-------------|------------|
| 3D Engine   | `@babylonjs/core` + `@babylonjs/loaders` (GLB models) |
| Navigation  | `@recast-navigation/core` + `@recast-navigation/generators` (NavMesh) |
| UI          | React 19 + JSX |
| State Bridge| Zustand 5 (`store/useGameStore.ts`) |
| Networking  | PeerJS (WebRTC P2P) |
| Bundler     | Vite 6 |
| Language    | TypeScript (strict mode) |
| Styling     | CSS3 |

### Running Locally
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production bundle
npm run preview    # local production preview
npm run test       # run tests in watch mode
npm run test:run   # run tests once (CI mode)
npm run test:ui    # open Vitest UI
```
Verify changes by running the test suite AND by playing the game.

---

## 2. Architecture Overview

### Hybrid ECS (Entity-Component-System)
- **Entities** are typed TypeScript objects (`Zombie`, `Projectile`, `WindowBarrier`), not pure IDs.
- **Systems** are factory functions that return a `System` object with an `update(dt, now)` method.
- **SystemManager** (`engine/SystemManager.ts`) stores, priority-sorts, and runs all systems each frame.
- New systems must be registered in `game/Game.ts` → `initializeSystems()`.

### State Flow
```
StateManager (engine truth) → UIBridge (throttle/batch) → Zustand store → React HUD components
```
- `StateManager` (`state/StateManager.ts`) — single source of truth for ALL game state.
- `UIBridge` (`state/UIBridge.ts`) — bridges engine state to React, throttling high-frequency updates.
- `useGameStore` (`store/useGameStore.ts`) — Zustand store consumed by React components.

**IMPORTANT**: Engine/system code must NEVER import React or write to Zustand directly. Always go through `UIBridge`.

### Game Lifecycle
```
Game.ts (constructor) → initializeEngine() → loadLevel() → initializeSystems() → GameLoop.ts (per-frame)
```
- `Game.ts` — orchestrator, creates engine, scene, camera, managers, registers systems.
- `GameEngine.ts` — Babylon.js engine wrapper, projectile object pool.
- `GameLifecycle.ts` — handles start game, return to menu, map switching transitions.
- `GameLoop.ts` — per-frame callback: input → systems → health regen.

### EventBus
Typed pub/sub for cross-system communication (`engine/EventBus.ts`). All event types are defined in the `GameEvents` interface:

| Event | Payload | Purpose |
|-------|---------|---------|
| `ZOMBIE_DEATH` | `{ id, position }` | Zombie killed |
| `HELLHOUND_DEATH` | `{ id, position }` | Hellhound killed |
| `PLAYER_DAMAGE` | `{ amount, source }` | Player took damage |
| `GAME_STARTED` | `{ startPoints } \| null` | Game begins |
| `GAME_OVER` | `null` | All players dead |
| `BOARD_STATE_CHANGE` | `{ windowId }` | Window barrier changed |
| `LID_STATE_CHANGE` | `{ groundSpawnId }` | Ground spawn lid state |
| `DOOR_OPEN_REQUEST` | `string` (doorId) | Player wants to open door |
| `WEAPON_PICKUP_REQUEST` | `string` (weaponId) | Player wants weapon |
| `PACK_A_PUNCH_REQUEST` | `AbstractMesh` | Player uses PaP machine |
| `POWER_ON_REQUEST` | `null` | Player activates power |
| `COMMAND_REQUEST` | `string` | Console command entered |
| `COMMAND_CLOSE_CONSOLE` | `null` | Console should close |
| `REMOTE_SHOOT` | `ShootMessage` | Remote player fired |
| `PLAYER_HIT` | `{ zombieId, damage }` | Local hit confirmation / UI hooks |
| `RESPAWN_REQUEST` | `{ round, points }` | Player requests respawn |
| `REVIVE_EVENT` | `ReviveEvent` | Revive started/cancelled/complete |
| `NET_GAME_STATE_UPDATE` | `CachedHostState` | Network state received |
| `NET_CLIENT_INPUT` | `CachedClientState` | Client input received |
| `HOST_LOADED_RECEIVED` | `null` | Host finished loading |

### Networking Authority Model
- **Host** is the authoritative source for game logic (spawning, damage, rounds).
- **Client** is host-authoritative but not purely passive: it renders locally, handles touch/controller UI, spawns immediate local visuals, and reports hits/requests back to the host.
- All authority-dependent systems must early-return for non-authority:
```typescript
if (gameModeRef.current === 'CLIENT') return;
```
- Network messages flow: `send()` → PeerJS → `NetworkMessageHandler`, which may update `StateManager` directly, bridge data into UI actions, and/or emit `EventBus` events for systems.
- Delta compression via `NetworkDeltaCompressor` at 20 Hz (`SYNC_CONFIG.NETWORK_TICK_MS = 50`).

---

## 3. Directory Reference

```
config/                    # Global gameplay defaults
├── gameplay.ts            # GAME_CONFIG, ZOMBIE_CONFIG, COMBAT_CONFIG, ROUND_CONFIG, etc.
├── enemies.ts             # Hellhound and mystery box defaults
├── maps.ts                # Map list for lobby menu
├── modelTransforms.ts     # Weapon model positioning data
├── models.ts              # Model URL defaults
├── textures.ts            # Texture URL defaults
└── weapons/               # Weapon configs (pistol, shotgun, fullauto, semiauto, wonderweapons)
    └── index.ts           # Exports WEAPON_CONFIGS[] and UPGRADED_WEAPON_CONFIGS{}

engine/                    # Custom engine core
├── CommandRegistry.ts     # Console command dispatcher
├── EventBus.ts            # Typed pub/sub event system
├── GeometryUtils.ts       # Mesh/geometry creation utilities
├── InputManager.ts        # Input coordinator; delegates to engine/input/*
├── LevelBuilder.ts        # Builds map geometry, doors, windows, lights from MapDefinition
├── MathUtils.ts           # Math helpers
├── MinHeap.ts             # Priority queue for pathfinding
├── ObjectPool.ts          # Generic object pool for performance
├── SystemManager.ts       # ECS system registration, priority sorting, update loop
├── TimerManager.ts        # Scheduled one-shot event handling
├── weaponResetUtils.ts    # Weapon reset helpers for session teardown / revive flows
├── commands/              # Debug, visual, cheat, and /help console commands
└── input/                 # Keyboard/mouse, controller, and touch handlers + shared types

game/                      # Lifecycle and render loop
├── Game.ts                # Main orchestrator — creates everything, registers systems
├── GameEngine.ts          # Babylon.js engine wrapper, projectile pool
├── GameLifecycle.ts       # Start game, return to menu, transitions
└── GameLoop.ts            # Per-frame callback with pause/freeze logic

managers/                  # Game managers (created in Game.ts, injected into StateManager)
├── HellhoundManager.ts   # Hellhound enemy spawning and management
├── MapConfigManager.ts    # Runtime merge of global + per-map configs
├── MapLoader.ts           # Data-driven level setup from MapDefinition
├── MapRegistry.ts         # Map registration (MAP_DEFINITIONS record)
├── PowerUpManager.ts      # Power-up spawning, activation, effects
├── ResourceManager.ts     # GPU asset caching (textures, materials) with dispose()
├── SoundManager.ts        # Audio playback (load, play, stopAll, resumeAll)
├── VisualManager.ts       # VFX orchestrator → delegates to sub-managers
├── ZombieManager.ts       # Zombie entity creation, death handling, mesh pooling
└── visual/
    ├── DecalManager.ts    # Blood/bullet decals on surfaces
    ├── GoreManager.ts     # Dismemberment gore pieces
    └── ParticleManager.ts # All particle systems (blood, explosions, spawn effects, etc.)

maps/                      # Data-driven map definitions
├── _template/             # Starter template for new maps
├── warehouse/             # Warehouse 115 map
├── mapTest/               # Test arena map
├── wipmap/                # WIPMAP test map
├── ADDING_MAPS.md         # Step-by-step guide for adding maps
├── MapTextureResolver.ts  # Texture loading for maps
├── types.ts               # MapConfiguration, MapGameplayConfig, etc.
└── validateMapDefinition.ts

factories/                  # Mesh factories (procedural geometry)
├── BuildingFactory.ts     # Procedural building geometry
├── RemotePlayerFactory.ts # Remote player visual representation
├── WeaponMeshFactory.ts   # First-person weapon meshes
├── ZombieMeshFactory.ts   # Zombie/hellhound mesh pooling (acquire/release pattern)
├── gameplay/              # Power switch, power-up meshes
├── mysterybox/            # Mystery Box mesh
├── packapunch/            # Pack-a-Punch machine mesh
└── perks/                 # Perk machine meshes (Juggernog, Speed Cola, Quick Revive, Double Tap, Mule Kick)

network/                   # P2P networking
├── InterpolationBuffer.ts # Remote entity position smoothing
├── NetworkDeltaCompressor.ts # Bandwidth optimization (delta encoding)
├── NetworkMessageHandler.ts  # Incoming message processing
└── useMultiplayer.ts      # React hook for multiplayer connection lifecycle

state/                     # State management
├── RemotePlayerState.ts   # Remote player state container
├── StateManager.ts        # THE single source of truth for all game state
└── UIBridge.ts            # Engine → Zustand bridge with throttling

store/
└── useGameStore.ts        # Zustand store (PlayerFields, GameFields, RemoteFields)

systems/                   # Modular ECS-style logic systems
├── index.ts               # Re-exports all system factory functions
├── InteractionSystem.ts   # Player world interactions (doors, wallbuys, perks, etc.)
├── MysteryBoxSystem.ts    # Mystery Box state machine
├── NetworkSystem.ts       # Multiplayer sync (sends state/input at 20Hz)
├── PackAPunchSystem.ts    # Event-driven PaP upgrade flow (manual init, not SystemManager)
├── PowerUpSystem.ts       # Power-up spawning, pickup, active effect lifecycle
├── ProjectileSystem.ts    # Bullet/projectile physics and hit detection
├── RemotePlayerSystem.ts  # Remote player interpolation rendering
├── RoundSystem.ts         # Round progression, intermissions, dog rounds
├── ZoneSystem.ts          # Zone management (which zone is the player in?)
├── interaction/
│   ├── types.ts           # InteractionHandler interface
│   └── handlers/          # One handler per interactable type:
│       ├── DoorHandler.ts
│       ├── MysteryBoxHandler.ts
│       ├── PackAPunchHandler.ts
│       ├── PerkHandler.ts
│       ├── PowerHandler.ts
│       ├── SpawnHoleLidHandler.ts
│       ├── WallBuyHandler.ts
│       └── WindowHandler.ts
├── player/
│   ├── PlayerMovementSystem.ts  # Movement physics, sprinting, jumping, crouching
│   ├── PlayerCombatSystem.ts    # Shooting, reloading, knifing
│   ├── WeaponViewSystem.ts      # Weapon view model animations (sway, bob, ADS)
│   ├── DownedSystem.ts          # Downed state handling (bleed-out timer)
│   └── ReviveSystem.ts          # Cooperative revive mechanics
└── zombie/
    ├── ZombieAISystem.ts          # Crowd-based pathfinding and chase logic
    ├── ZombieHellhoundAISystem.ts # Hellhound state machine (spawn→chase→attack→recovery)
    ├── ZombieWindowAISystem.ts    # Window barrier sub-machine (approach→attack→enter)
    ├── ZombieSpawnSystem.ts       # Spawn logic (ground holes and windows)
    ├── ZombieAnimationSystem.ts   # Skeleton animations (walk, idle, attack)
    ├── ZombieCleanupSystem.ts     # Dead zombie disposal, stuck timeout
    ├── ZombieDamageSystem.ts      # Damage handling, authority checks
    ├── ZombieSyncSystem.ts        # Network sync for zombie state
    └── zombieAIUtils.ts           # Shared AI utility functions

types/                     # TypeScript type definitions
├── index.ts               # Re-exports all types
├── entities.ts            # Zombie, Projectile, WindowBarrier, GroundSpawn
├── player.ts              # WeaponConfig, WeaponState, RemoteGameState
├── world.ts               # MapDefinition, DoorDefinition, ZoneDefinition, etc.
├── ui.ts                  # GameStateData, PowerUpType, GameMessage, all state slices
├── systems.ts             # System interface, MysteryBoxSystem, IInteractionSystem
└── network.ts             # Network-specific types

ui/                        # React-based HUD and menus
├── HUD.tsx                # Main HUD layout (composes all HUD components)
├── GameScene.tsx           # Canvas wrapper + game initialization
├── GameMenuManager.tsx    # Menu state management (main menu, pause, game over)
├── GameMenus.tsx          # Menu entry point
├── components/            # HUD, debug, pause, touch, and game-over overlays
└── menus/                 # MainMenu, MultiplayerMenu, MapSelect, HostLobby, JoinLobby, SettingsMenu
```

---

## 4. Key Patterns & Conventions

### System Interface (`types/systems.ts`)
```typescript
interface System {
    name: string;
    enabled?: boolean;
    priority?: number;  // Lower runs first
    init?(): void;
    update(dt: number, now: number): void;
    onEnable?(): void;
    onDisable?(): void;
    dispose?(): void;
}
```

### System Factory Pattern
Most systems are factory functions that receive a context object and return a `System`:
```typescript
export const createXxxSystem = (ctx: IXxxContext): System => {
    // Private state here (closures)
    return {
        name: 'xxx',
        update: (dt: number, now: number) => {
            // PAUSE GUARD FIRST (see Section 6)
            if (ctx.gameState.isPaused || ctx.gameState.isDebugMode) return;
            // ... system logic
        },
        dispose: () => {
            // Clean up EventBus handlers, particle systems, etc.
        }
    };
};
```

Exceptions:
- `MysteryBoxSystem` is not a `System` and is updated manually from `game/GameLoop.ts`.
- `PackAPunchSystem` is event-driven and exposes `init()` / `dispose()` instead of `update()`.

### Adding a New System — Checklist
1. Create file in `systems/` (or `systems/player/`, `systems/zombie/`)
2. Export factory function `createXxxSystem`
3. Add export to `systems/index.ts`
4. Register in `Game.ts` → `initializeSystems()` with `systemManager.register(...)` unless it is a manual/event-driven exception like `MysteryBoxSystem` or `PackAPunchSystem`
5. Add authority guard if HOST-only logic
6. Add pause guard (see Section 6)
7. Add `lastTickTime` compensation if using timers (see Section 6)
8. Add `dispose()` to clean up EventBus handlers

### State Update Flow
```typescript
// Engine-side: mutate gameState directly
ctx.gameState.health = 50;

// UI-side: go through StateManager → UIBridge → Zustand
sm.setHealth(50);          // StateManager method
// internally: this.ui.setHealth(v)  → throttled → updatePlayer({ health: v })
```

### Config Fallback System
Global defaults live in `config/`. Per-map overrides live in `maps/<name>/config/`.
At runtime, `MapConfigManager` merges them — if a map omits a value, the global default is used.
```typescript
// Always use MapConfigManager for config values:
const pc = ctx.configManager.powerUps;    // merged power-up config
const zc = ctx.configManager.zombieAI;    // merged zombie config
const gc = ctx.configManager.gameplay;    // merged gameplay config
```

### Interaction Handler Pattern
Each interactable type has a handler in `systems/interaction/handlers/`. To add a new one:
1. Create `systems/interaction/handlers/YourHandler.ts`
2. Implement the handler interface
3. Register it in `InteractionSystem.ts`

---

## 5. Testing Patterns

> **Mandatory Verification**: Every logic change MUST be verified by running `npm run test:run`. If you add a new system or math utility, you MUST add a corresponding test file.

### 5a. Mocking Game Context
Use `createMockContext` from `tests/mocks/mockContext` to test systems without a real Babylon engine.
```typescript
import { createMockContext } from '../tests/mocks/mockContext';
const ctx = createMockContext();
const system = createXxxSystem(ctx);
```

### 5b. Testing Pause Guards
Always verify that your system respects the `isPaused` state.
```typescript
it('should NOT update when paused', () => {
    ctx.gameState.isPaused = true;
    system.update(16, Date.now());
    // Assert no state changes
});
```

### 5c. Testing UI Components
Mock `useGameStore` to test React components in isolation.
```typescript
vi.mock('../../store/useGameStore', () => ({
    useGameStore: vi.fn()
}));
// ... in test
(useGameStore as any).mockImplementation((selector) => selector({ ...mockState }));
```

---

## 6. ⚠️ Pause, Dispose, and Reset Patterns — CRITICAL

> **This is the #1 area where AI assistants introduce bugs.** Every rule below must be followed exactly.

### 6a. Pause Guards in `update()`

Pause behavior is **mode-dependent** in this project:
- **SOLO**: pause freezes game logic.
- **HOST/CLIENT**: pause is local UI only; world simulation continues.
- **Console open** or **debug selection active** still freeze logic via `game/GameLoop.ts`.

Use these current patterns:

**Player movement / view systems**
```typescript
if (!ctx.gameState.hasStarted || ctx.gameState.isPaused || ctx.gameState.isSpectating
    || ctx.gameState.isGameOver || ctx.gameState.isConsoleOpen) return;
```

`PlayerMovementSystem` also guards `isDebugMode`; `PlayerCombatSystem` currently does not guard console/debug, so match the surrounding subsystem when editing.

**Projectile and round systems** (multiplayer-aware pause)
```typescript
const isMultiplayer = ctx.gameModeRef.current !== 'SOLO';
const effectivelyPaused = ctx.gameState.isPaused && !isMultiplayer;
if (!ctx.gameState.hasStarted || (effectivelyPaused && !isDebugActive)) return;
```

**Zombie systems**
```typescript
const isMultiplayer = ctx.gameModeRef.current !== 'SOLO';
if (ctx.gameState.isDebugMode || (ctx.gameState.isPaused && !isMultiplayer)) return;
```

If you add a new system, follow the pause semantics of the nearest comparable system instead of assuming `isPaused` always freezes multiplayer logic.

### 6b. `lastTickTime` Timer Compensation

Systems that use timestamps for durations/timeouts **MUST** compensate for pause gaps. When the game unpauses, `now - lastTickTime` will be huge — without compensation, all timers expire instantly.

```typescript
let lastTickTime = 0;

update: (dt: number, now: number) => {
    // Compensate for pause: if gap > 150ms, shift timestamps forward
    if (lastTickTime !== 0 && now - lastTickTime > 150) {
        const pauseDuration = now - lastTickTime;
        // Shift ALL relevant timestamps forward by pauseDuration
        for (const item of items) {
            item.spawnTime += pauseDuration;
        }
    }
    lastTickTime = now;
    // ... rest of update
}
```

**Currently using this pattern**: `PowerUpSystem`, `ZombieCleanupSystem`
**When to add it**: ANY new system that tracks time-based durations, timeouts, or cooldowns.

### 6c. GameLoop Freeze Logic

`GameLoop.ts` has a central freeze that blocks `systemManager.updateAll()`:
```typescript
const isMultiplayer = currentGameMode !== 'SOLO';
const isPausedForLogic = sm.gameState.isPaused && !isMultiplayer;
const isLogicFrozen = isPausedForLogic || sm.isConsoleOpen || sm.debugSelection.isActive;
if (isPausedForLogic || (sm.isConsoleOpen && !sm.debugSelection.isActive)) return;
```
But systems **MUST STILL** have their own guards because:
- Some systems are called **outside** SystemManager (e.g., `mysteryBoxSystem.update(dt)`, event-driven `packAPunchSystem` flows)
- The freeze conditions don't cover all states (e.g., `isGameOver`, `isSpectating`)
- NavPlugin is independently frozen: `sm.navPlugin.timeFactor = isLogicFrozen ? 0 : 1`

### 6d. Babylon.js Dispose Rules

**Meshes** — always dispose when removing. Check `isDisposed()` for shared items:
```typescript
if (mesh && !mesh.isDisposed()) mesh.dispose();
```

**Materials** — dispose CLONED materials, NEVER dispose shared ones from ResourceManager:
```typescript
if (papMat) papMat.dispose();  // OK: cloned PaP camo material
// NEVER: resourceManager.getMaterial('brick').dispose();
```

**Particle Systems** — use `dispose(false)` to keep shared textures alive:
```typescript
if (z.fireSystem) z.fireSystem.dispose(false);  // false = don't dispose shared texture
```

**Lights** — NOT children of map root. Must be manually disposed on level reload:
```typescript
const lightsToRemove = scene.lights.filter(l =>
    l.name === "hemi" || l.name === "dir" || l.name.startsWith("fixture_light")
);
lightsToRemove.forEach(l => l.dispose());
```

**Shadow Generators** — also need manual disposal:
```typescript
scene.lights.forEach(l => {
    const shadowGens = l.getShadowGenerators();
    if (shadowGens) shadowGens.forEach(sg => sg?.dispose());
});
```

### 6e. Particle System Lifecycle
```
Create:  pool.acquire() or new ParticleSystem()
Start:   ps.start()
Stop:    if (ps.isStarted()) { ps.stop(); ps.reset(); }
Reset:   ps.reset()            — returns to pool for reuse
Dispose: ps.dispose(false)     — only on full teardown, false = keep shared texture
```

### 6f. `resetSession()` Cleanup Chain

`Game.resetSession()` handles full session teardown. When adding new persistent state, you MUST add cleanup here:

1. `_clearZombies()` — remove from Recast Crowd, release meshes to pool
2. `_clearPowerUps()` — dispose meshes, clear active effects
3. `_clearProjectiles()` — release back to object pool via `GameEngine`
4. `_resetWeaponMaterials()` — restore original materials, dispose cloned PaP materials
5. `_resetVisualAndTimers()` — `visualManager.reset()`, `timerManager.clear()`, `soundManager.stopAll()`
6. `_resetGameStateFlags()` — reset ALL boolean flags, points, health, weapons to defaults
7. `_resetMysteryBox()` — reset box state machine to `BOX_IDLE`

### 6g. EventBus Handler Cleanup

Systems that call `eventBus.on()` **MUST** clean up in `dispose()`:
```typescript
const handler = (data: { id: string }) => { /* ... */ };
ctx.eventBus.on('ZOMBIE_DEATH', handler);

// In dispose():
ctx.eventBus.off('ZOMBIE_DEATH', handler);
```
Failure to do this causes orphaned handlers that accumulate across level reloads.

### 6h. Zombie Mesh Pooling

Zombies use an acquire/release pool pattern. NEVER call `mesh.dispose()` directly:
```typescript
// Correct — returns mesh to pool for reuse:
releaseZombieMesh({ mesh: z.mesh as Mesh, head: z.headMesh, torso: z.torsoMesh, limbs: z.limbs! });
releaseHellhoundMesh({ mesh: z.mesh as Mesh, head: z.headMesh, limbs: z.limbs! });

// WRONG — destroys the pooled mesh permanently:
z.mesh.dispose();
```
Always remove from Recast Crowd before releasing:
```typescript
if (crowd && z.crowdAgentIndex !== undefined) {
    crowd.removeAgent(z.crowdAgentIndex);
    z.crowdAgentIndex = undefined;
}
```

---

## 7. Key Entity Types

### `Zombie` (`types/entities.ts`)
Core fields: `id`, `mesh`, `headMesh`, `health`, `maxHealth`, `speed`, `state` (ZombieState enum), `isDead`, `type` ('ZOMBIE' | 'HELLHOUND'), `targetWindowId`, `crowdAgentIndex`, `spawnTime`, `missingLimbs`, `isCrawling`.

### `Projectile` (`types/entities.ts`)
Fields: `mesh`, `direction`, `speed`, `damage`, `life`, `isRemote`, `isPacked`, `owner`, `isExplosive?`, `splashRadius?`, `trailParticleSystem?`.

### `MapDefinition` (`types/world.ts`)
The root type for data-driven maps. Contains: `meta`, `geometry[]`, `zones[]`, `interactables` (doors, windows, perks, wallbuys, mysteryBoxes, powerSwitch, packAPunch), `spawns`, `navigation`, `config?` (per-map overrides), `environment?`.

### `WeaponConfig` / `WeaponState` (`types/player.ts`)
Config: `id`, `name`, `clipSize`, `maxReserve`, `fireRate`, `automatic`, `damage`, `scale`, `pellets`, `hipPos`, `adsPos`, `barrelLength`, `reloadTime`, `hipFireOriginCorrection?`, `isExplosive?`, `splashRadius?`, `splashDamage?`, `selfDamageMultiplier?`, `projectileSpeedOverride?`, `fireSound?`, `recoil?`.
State extends Config with: `currentAmmo`, `currentReserve`, `mesh`, `isPacked`, `packedName?`.

### `GameStateData` (`types/ui.ts`)
Union of `GameFlowState & RoundState & PlayerState & PhysicsState & WorldState & AssetsState`. This is the master state object on `StateManager`.

---

## 8. Step-by-Step Guides

### Adding a New Weapon
1. Create config file in `config/weapons/` (copy existing like `pistol.ts`)
2. Define `base: WeaponConfig` and optional `upgrade: WeaponUpgrade`
3. Import into `config/weapons/index.ts` and add to `allDefinitions`
4. Create mesh in `factories/WeaponMeshFactory.ts` — add case for your weapon ID
5. Add as wallbuy in a map's `interactables.wallbuys[]` or to mystery box pool
6. Update `Game.ts` `weaponMeshes` object if it's a permanent weapon

### Adding a New Power-Up
1. Add type to `PowerUpType` enum in `types/ui.ts`
2. Implement activation effect in `managers/PowerUpManager.ts` → `activatePowerUp()`
3. Create visual mesh in `factories/gameplay/` (the spinning pickup model)
4. Add sound in `managers/SoundManager.ts`
5. Add UI indicator in `ui/components/PowerUpDisplay.tsx`

### Adding a New Map
See `maps/ADDING_MAPS.md` for full guide. Summary:
1. Copy `maps/_template/` to `maps/yourMapName/`
2. Edit `mapDefinition.ts` — set meta, geometry, zones, spawns, interactables
3. Override configs in `config/` subdirectory (gameplay, enemies, weapons)
4. Register in `managers/MapRegistry.ts`
5. Add to `config/maps.ts` for lobby menu

### Adding a New HUD Component
1. Create `.tsx` in `ui/components/`
2. Import `useGameStore` and subscribe to relevant fields:
   ```tsx
   const health = useGameStore(s => s.health);
   ```
3. Add to `ui/HUD.tsx` layout
4. If new data is needed from engine, add setter to `UIBridge.ts` and call from engine code

### Adding a New Interaction Handler
1. Create handler in `systems/interaction/handlers/`
2. Add `InteractableType` to the union in `types/world.ts` if new
3. Register in `InteractionSystem.ts`
4. Add metadata to interactable meshes: `mesh.metadata = { interactable: { type: 'YOUR_TYPE', ... } }`

---

## 9. Pattern Conventions

### Manager Dependency Injection
Some managers use `setDependencies()` for late-bound callbacks that can't be passed at construction time (due to circular references or ordering). When creating a new manager that needs late binding, follow this pattern:
```typescript
public setDependencies(cb1: ..., cb2: ...) { ... }
```

### Manager `reset()` vs `dispose()` Contract
- `reset()` = between-round/between-game cleanup. Manager stays alive, observers keep running. Clears active items (particles, gore, decals) but preserves pools and structural observers.
- `dispose()` = full teardown. Manager is destroyed, all GPU resources (meshes, materials, particle systems) and observers are released.

### Observer Lifecycle
Observers created in manager constructors are stored as instance fields and cleaned up in `dispose()` only (not `reset()`). This is intentional — structural observers (gore fade, light fade) have early-exit guards for empty state and are cheap to keep alive.

Self-cleaning observers (e.g. `onDisposeObservable.addOnce`) are appropriate for observers tied to a specific mesh or light lifetime.

### Material Creation
- Use `createMaterial()` from `GeometryUtils.ts` for PBR materials with textures on level geometry (handles uScale, vScale, roughness, markDirty-on-load).
- Use `createPBRMaterialWithTexture()` in `LevelBuilder.ts` for materials that need custom metallic/environment intensity.
- Use inline `new PBRMaterial()`/`new StandardMaterial()` for simple materials without textures or with special setup (void, metal, frame).
- Use `resourceManager.getMaterial(name, factory)` to cache shared materials.

### HUD Component Update Strategy
- **Standard React model** (store selector triggers re-render): Use for all HUD components that update at gameplay frequency (<10/sec). Example: `AmmoCounter`, `RoundDisplay`, `PlayerStatus`.
- **Direct DOM refs** (`useRef` + `el.textContent = ...`): Use only for displays that update every frame (>30/sec) where React re-render overhead is measurable. Example: `FPSCounter`.

### Factory Function Naming
All factory functions that create 3D objects use the pattern `create[Thing]()`. The `Mesh` suffix is omitted since it's obvious from context that factories create meshes/TransformNodes:
- `createJuggernog()`, `createSpeedCola()` — perk machines
- `createPowerSwitch()`, `createMysteryBox()` — gameplay objects
- `createBuilding()` — procedural buildings
- Exception: `createPowerUpMesh()`, `createLidMesh()` — keep `Mesh` suffix when ambiguity exists (e.g. power-up has both mesh and logic concepts)

### Perk Factory Pattern
All perk factories share common post-load and error-fallback logic via `factories/perks/perkUtils.ts`:
- `configurePerkModel()` — registers shadow casters and limits `maxSimultaneousLights`
- `createPerkFallback()` — creates a colored placeholder box on model load failure

---

## 10. Config Reference

### `GAME_CONFIG` (config/gameplay.ts)
Movement: `WALK_SPEED`, `SPRINT_SPEED`, `JUMP_FORCE`, `GRAVITY`
Health: `PLAYER_BASE_HEALTH` (100), `PLAYER_JUGG_HEALTH` (250), `DAMAGE_IMMUNITY_MS` (500)
Costs: `JUGGERNOG_COST`, `SPEED_COLA_COST`, `QUICK_REVIVE_COST`, `DOUBLE_TAP_COST`, `MULE_KICK_COST`, `PACK_A_PUNCH_COST`, `PACK_A_PUNCH_AMMO_COST`
Points: `POINTS_KILL` (80), `POINTS_HEADSHOT` (20), `POINTS_HIT` (10), `POINTS_REPAIR` (10)

### `ROUND_CONFIG`
Zombies per round 1-5: `[6, 8, 12, 16, 22]`, then +3 per round.
Dog rounds every 5th round. Spawn delay starts at 3800ms, decreases 150ms/round (min 800ms).

### `ZOMBIE_SPEEDS`
`CRAWLER: 0.015`, `WALKER: 0.035`, `RUNNER: 0.07`, `SPRINTER: 0.10`, `SUPER_SPRINTER: 0.125`

### `SYNC_CONFIG`
Network tick: 50ms (20 Hz). Full sync forced every 5000ms. Interpolation buffer: 100ms.

---

## 11. Common Mistakes — Do NOT

| ❌ Do NOT | ✅ Do Instead |
|-----------|--------------|
| Import React in engine/state/systems files | Keep engine code React-free; use UIBridge |
| Mutate Zustand store directly from engine | Use `StateManager.setXxx()` → `UIBridge` |
| Forget pause guard at top of `update()` | Add the appropriate guard (see Section 6a) |
| Forget `lastTickTime` compensation for timers | Add the pattern from Section 6b) |
| Forget to re-export new systems from `systems/index.ts` | Add export line in `systems/index.ts` |
| Forget to clean up EventBus handlers in `dispose()` | Call `eventBus.off()` for every `eventBus.on()` |
| Call `z.mesh.dispose()` on zombies | Use `releaseZombieMesh()` / `releaseHellhoundMesh()` |
| Use `dispose(true)` on particle systems | Use `dispose(false)` to keep shared textures |
| Assume lights are children of map root | Manually dispose lights by name on level reload |
| Modify `GameStateData` without updating `types/ui.ts` | The type is a union of slices in `types/ui.ts` |
| Forget authority check for HOST-only logic | Guard with `if (gameMode === 'CLIENT') return` |
| Use hardcoded config values | Use `MapConfigManager` for per-map fallback |
| Create materials without registering in ResourceManager | Use `resourceManager.getMaterial(name, factory)` |
| Forget to add new persistent state cleanup in `resetSession()` | Add cleanup step in `Game.ts` |

---

## 12. File Quick-Reference

| I want to... | Edit this file |
|--------------|----------------|
| Change weapon stats | `config/weapons/<type>.ts` |
| Change zombie speed/health scaling | `config/gameplay.ts` (ZOMBIE_SPEEDS, ZOMBIE_CONFIG) |
| Change round progression | `config/gameplay.ts` (ROUND_CONFIG) + `systems/RoundSystem.ts` |
| Change perk costs | `config/gameplay.ts` or `maps/<name>/config/gameplay.ts` |
| Add a debug command | `engine/CommandRegistry.ts` |
| Change player movement feel | `systems/player/PlayerMovementSystem.ts` |
| Change shooting/aiming behavior | `systems/player/PlayerCombatSystem.ts` |
| Add a new HUD element | `ui/components/` + `ui/HUD.tsx` |
| Change how doors/perks/wallbuys work | `systems/interaction/handlers/` |
| Add/change zombie AI behavior | `systems/zombie/ZombieAISystem.ts` |
| Change weapon view animations | `systems/player/WeaponViewSystem.ts` |
| Add a new particle effect | `managers/visual/ParticleManager.ts` |
| Change blood/gore effects | `managers/visual/GoreManager.ts` + `DecalManager.ts` |
| Add a new map | `maps/` + `managers/MapRegistry.ts` + `config/maps.ts` |
| Change network sync behavior | `network/NetworkDeltaCompressor.ts` + `systems/NetworkSystem.ts` |
| Change game start/menu flow | `game/GameLifecycle.ts` + `ui/GameScene.tsx` |
| Add persistent state that survives frames | `types/ui.ts` (state slice) + `state/StateManager.ts` |
| Change mystery box behavior | `systems/MysteryBoxSystem.ts` |
| Change power-up behavior | `systems/PowerUpSystem.ts` + `managers/PowerUpManager.ts` |

---

## 13. System Registration Order

Systems are registered in `Game.initializeSystems()` in this specific order for a reason:

1. **ProjectileSystem** — processes bullets before anything else
2. **PlayerMovementSystem** — player physics
3. **PlayerCombatSystem** — shooting, reloading
4. **InteractionSystem** — world interactions
5. **ZombieSpawnSystem** — spawns new zombies (sets CHASING state)
6. **ZombieAISystem** — crowd init, adds fresh zombies to crowd, runs chase AI
7. **ZombieHellhoundAISystem** — independent hellhound state machine
8. **ZombieWindowAISystem** — window barrier approach/attack/enter
9. **ZombieDamageSystem** — processes damage on zombies
10. **ZombieCleanupSystem** — disposes dead zombies
11. **ZombieAnimationSystem** — updates skeleton animations
12. **ZombieSyncSystem** — network sync for zombie positions
13. **PowerUpSystem** — power-up lifecycle
14. **WeaponViewSystem** — weapon view model
15. **RoundSystem** — round progression
16. **NetworkSystem** — sends/receives network data
17. **RemotePlayerSystem** — interpolates remote player
18. **DownedSystem** — downed state bleed-out
19. **ReviveSystem** — cooperative revive

**MysteryBoxSystem** is NOT registered with SystemManager — it's called directly in `GameLoop.ts`.
**PackAPunchSystem** is also not registered with SystemManager — `Game.ts` creates it and calls `init()` manually.

---

*This document was generated for AI coding assistants. When in doubt, read the source file referenced above.*
