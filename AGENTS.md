# DOM OF THE ROAD - Agent Guidelines

A browser-based, multiplayer round-based zombie survival FPS built with Babylon.js and React.

---

## 1. Project Context & Purpose

**Description**: "DOM OF THE ROAD" is a browser-based, multiplayer round-based zombie survival FPS, heavily inspired by "Call of Duty: Zombies".

**Goal**: Maintain a high-fidelity, high-performance prototype running smoothly in the browser via WebRTC (Peer-to-Peer) multiplayer.

---

## 2. Tech Stack & Environment

- **Language**: Strictly Typed TypeScript (`tsconfig.json` enforces `strict: true` and `noImplicitAny: true`).
- **Engine**: `@babylonjs/core` & `@babylonjs/loaders` for 3D rendering, physics, and ECS logic.
- **UI Framework**: React 19 + Tailwind CSS, served via Vite.
- **State Management**: `zustand` specifically for high-performance bridging between the Babylon.js Game Loop and the React UI.
- **Networking**: `peerjs` for Host/Client P2P data transmission.
- **Pathing**: `@babylonjs/recastjs` for navigation meshes.

---

## 3. Core Architectural Rules (Strictly Enforced)

### Separation of Concerns (UI vs. Engine)

- **NEVER** import `react` or `zustand` into `game/`, `engine/`, or `systems/`. These must remain pure TypeScript/Babylon.js.
- **NEVER** import `@babylonjs/core` directly into `ui/` if possible. The UI must remain agnostic and consume data via the `UIBridge`.

### The State Manager

- **Location**: `state/StateManager.ts`
- **Role**: The "Single Source of Truth". All systems must consume the `StateManager` to read/write data. It holds references to all active entities.
- **UI Bridge Rule**: Engine/systems should update HUD-facing values via `StateManager`/`UIBridge` methods (e.g., `setHealth`, `setPoints`), not by writing directly to UI store code.

### Hybrid ECS (Entity-Component-System)

- Logic is grouped into single-responsibility Systems (in `systems/`) that export an `update(dt)` method.
- Entities are typed objects (e.g., `Zombie`, `Projectile`), not pure IDs.
- New systems must be registered in `game/Game.ts` via `SystemManager`.
- If order matters, assign an explicit `priority` and verify execution order assumptions.

### Map Configuration

- Maps are **data-driven**, defined in `maps/` (JSON/Config). Agents should modify config files rather than hardcoding geometry in systems.
- The `LevelBuilder` parses these configs to generate Babylon.js geometry and navigation meshes.

---

## 4. Networking & Multiplayer (Crucial)

- **Authority**: The **Host** is the "source of truth" for game logic (zombie spawning, damage, round progression).
- **Clients**: "Dumb terminals" that relay input and render state.
- **Testing**: Any new gameplay feature MUST be tested for both Singleplayer and Multiplayer (sync handled by `NetworkSystem`).
- **Authority Guarding**: Simulation systems must early-return on non-authority clients.
- **Networking Change Checklist**: For new networked features, keep `systems/NetworkSystem.ts`, `network/NetworkDeltaCompressor.ts`, and `network/NetworkMessageHandler.ts` in sync.

---

## 5. Performance Guidelines

### Memory Allocation

- **NO** `new` object allocations (like `new BABYLON.Vector3`) inside the render loop (`update` functions).
- Use object pooling or mutate existing vectors (e.g., `vector.copyFrom()`).

### React Renders

- Use `Ref` for mutable UI data that does not need to trigger a re-render.
- Only use `zustand` for data that must visibly update the HUD (Ammo, Points, Health).

### Entity Lifecycle

- When adding new entities (e.g., particles, projectiles), ensure they are properly disposed of to prevent memory leaks.
- Use the existing cleanup systems (e.g., `ZombieCleanupSystem`).

### Event & Timer Hygiene

- New `EventBus` subscriptions and scheduled timers must be scoped and cleaned up to avoid duplicate handlers and leaks across restarts.

---

## 6. Systems & Managers Reference

### System Registry (all in `systems/`)

Systems are **factory functions** returning `{ name, update(dt, now) }` objects. They are registered in `Game.ts` via `SystemManager` with explicit priorities (lower = runs first).

#### Player Systems (`systems/player/`)
| System | Role |
|--------|------|
| `PlayerMovementSystem` | WASD, jumping, sprinting, gravity, camera smoothing |
| `PlayerCombatSystem` | Shooting, reloading, knife attacks, raycasting |
| `WeaponViewSystem` | First-person weapon mesh positioning (hip/ADS) |
| `DownedSystem` | Downed state, 45s bleed-out timer, camera |
| `ReviveSystem` | Teammate revive with progress tracking |

#### Zombie Systems (`systems/zombie/`)
| System | Role |
|--------|------|
| `ZombieAISystem` | Pathfinding (Recast NavMesh), spatial grid separation, crowd sim |
| `ZombieAnimationSystem` | GLB skeletal animation (walk, idle, attack) |
| `ZombieDamageSystem` | Damage, dismemberment, burning |
| `ZombieCleanupSystem` | Dead zombie disposal after timeout |
| `ZombieSyncSystem` | Network sync of zombie positions (20 Hz) |

#### World Systems (`systems/`)
| System | Role |
|--------|------|
| `InteractionSystem` | Dispatcher for doors, perks, mystery box, PAP, power, windows |
| `ProjectileSystem` | Bullet physics, collision detection, explosives |
| `PowerUpSystem` | Spawn, collect, activate power-ups |
| `RoundSystem` | Round progression, zombie spawn logic, dog rounds |
| `NetworkSystem` | 20 Hz delta-compressed state sync |
| `RemotePlayerSystem` | Remote player rendering and interpolation |
| `MysteryBoxSystem` | Box state machine (idle→opening→rolling→present→closing) |
| `ZoneSystem` | Zone boundary checking, door connections |

### Interaction Handlers (`systems/interaction/handlers/`)

Each handler is a self-contained module for a specific interactable type:
- `DoorHandler` — Purchase & open doors
- `PerkHandler` — Purchase perks
- `WallBuyHandler` — Purchase wall weapons
- `PowerHandler` — Activate power switch
- `PackAPunchHandler` — Upgrade weapons
- `MysteryBoxHandler` — Random weapon box
- `WindowHandler` — Repair window barriers

### Managers (`managers/`)
| Manager | Role |
|---------|------|
| `ZombieManager` | HOST-only zombie spawning, kill tracking, spawn sounds |
| `HellhoundManager` | Hellhound-specific spawning (lunge attack AI) |
| `VisualManager` | Coordinates particles, decals, gore sub-managers |
| `ParticleManager` | Muzzle flash, impact effects, blood splatters |
| `DecalManager` | Bullet holes, blood decals (projected textures) |
| `GoreManager` | Floor gore from dismemberment |
| `PowerUpManager` | Power-up spawning based on accumulated points |
| `ResourceManager` | Asset (model/texture) loading and caching |
| `SoundManager` | Audio playback and pooling |
| `MapConfigManager` | Per-map config override loading |
| `MapLoader` | Scene construction from `MapDefinition` |
| `MapRegistry` | Map catalog and selection |

### Visual Effects
- Do not create raw Babylon.js particle systems in isolation.
- Coordinate with the `VisualManager` for particles, decals, and lighting changes.

### Audio
- Use `SoundManager` for all audio playback.
- Preload sounds during map loading to avoid playback lag.

---

## 7. EventBus Events Reference

The `EventBus` (in `engine/EventBus.ts`) is a typed pub-sub system. All events:

| Event | Payload | Emitted By |
|-------|---------|------------|
| `ZOMBIE_DEATH` | `{ id, position }` | ZombieDamageSystem |
| `HELLHOUND_DEATH` | `{ id, position }` | ZombieDamageSystem |
| `PLAYER_DAMAGE` | `{ amount, source }` | ZombieAISystem / ProjectileSystem |
| `GAME_STARTED` | `{ startPoints }` or null | GameLifecycle |
| `GAME_OVER` | null | RoundSystem |
| `BOARD_STATE_CHANGE` | `{ windowId }` | WindowHandler / ZombieAISystem |
| `DOOR_OPEN_REQUEST` | doorId string | DoorHandler |
| `POWER_ON_REQUEST` | null | PowerHandler |
| `WEAPON_PICKUP_REQUEST` | weaponId string | WallBuyHandler / MysteryBoxHandler |
| `PACK_A_PUNCH_REQUEST` | AbstractMesh | PackAPunchHandler |
| `COMMAND_REQUEST` | command string | Console UI |
| `COMMAND_CLOSE_CONSOLE` | null | CommandRegistry |
| `REMOTE_SHOOT` | GameMessage | NetworkMessageHandler |
| `RESPAWN_REQUEST` | `{ round, points }` | DownedSystem |
| `REVIVE_EVENT` | ReviveEvent union | ReviveSystem |
| `NET_GAME_STATE_UPDATE` | CachedHostState | NetworkMessageHandler |
| `NET_CLIENT_INPUT` | CachedClientState | NetworkMessageHandler |
| `HOST_LOADED_RECEIVED` | null | NetworkMessageHandler |

**Cleanup Rule**: Always call `eventBus.off(event, handler)` when a system is disposed. The `eventBus.clear()` is called on game reset.

---

## 8. Entity Types

### Zombie States
- **SPAWNING** → Emerging from ground/window (slow, may be invulnerable)
- **APPROACHING_WINDOW** → Moving toward a window barrier
- **ATTACKING_BARRIER** → Hitting window boards
- **ENTERING** → Passing through an opened barrier
- **CHASING** → Pursuing the nearest player

### Hellhound States
- **SPAWNING** → Invulnerable for 500ms
- **CHASING** → Sprinting toward player (1.8× player sprint)
- **ATTACK_WINDUP** → Pre-lunge pause (300–400ms)
- **ATTACKING** → Lunge attack (200–300ms)
- **RECOVERY** → Vulnerable post-attack (800–1000ms)

### Projectile
- Pooled via `ObjectPool` (50 pre-warmed)
- Tracks: `direction`, `speed`, `damage`, `life` (frames), `isExplosive`, `isPacked`, `owner`

### PowerUp Types
`MAX_AMMO`, `INSTA_KILL`, `DOUBLE_POINTS`, `NUKE`, `CARPENTER`

---

## 9. State Architecture

### Three-Tier State Flow
```
Systems → StateManager (authoritative) → UIBridge (throttled) → Zustand Store → React HUD
```

- **StateManager** (`state/StateManager.ts`): Single source of truth. All systems read/write here.
- **UIBridge** (`state/UIBridge.ts`): Throttles pushes to React (50ms for high-frequency like ammo/position, 0ms for event-driven like points).
- **Zustand Store** (`store/useGameStore.ts`): React-facing store. HUD components subscribe here.

### Store Slices
- **PlayerFields**: points, health, ammo, perks, kills, shotsFired, playerName
- **GameFields**: round, activeZombiesCount, powerOn, interactionMsg, gameMode, connectionStatus
- **RemoteFields**: remotePlayerName, remoteHealth, remotePerks, remoteKills
- **Settings**: Persisted to `localStorage` under key `zombz_settings`

---

## 10. Map Definition Structure

Maps are defined in `maps/<map_name>/mapDefinition.ts`. Key sections:

```
MapDefinition {
  meta: { id, name, version, description }
  textures: { wall, floor, ceiling, door, plank, powerDoor }
  geometry: GeometryDefinition[]       // Walls, floors, ceilings
  grounds: GroundDefinition[]          // Walkable surfaces
  navFloors?: GroundDefinition[]       // Invisible floors for NavMesh
  interactables: {
    doors, windows, groundSpawns, perks,
    wallbuys, mysteryBoxes, powerSwitch, packAPunch, buildings
  }
  fixtures?: FixtureDefinition[]       // Lights
  environment?: { fog, skybox, lighting, shadows }
  zones: ZoneDefinition[]              // Zone bounds + spawn bounds
  spawns: { host, client: { pos, rot } }
  config?: MapConfiguration            // Per-map overrides
}
```

Per-map configs can override gameplay, round, weapon, and enemy settings. See `maps/ADDING_MAPS.md` for the full guide.

---

## 11. Network Message Types

All messages are discriminated unions in `types/ui.ts` (`GameMessage`):

| Type | Direction | Purpose |
|------|-----------|---------|
| `STATE` | Host→Client | Delta-compressed game state (with `_seq`, `_full` flags) |
| `INPUT` | Client→Host | Client position, weapon, health |
| `SHOOT` | Both | Projectile fired |
| `INTERACT_DOOR/PERK/WALL_BUY` | Client→Host | Interaction requests |
| `PLAYER_DOWNED` / `REVIVE_*` | Both | Down/revive lifecycle |
| `RESPAWN` | Host→Client | Player respawn |
| `SPAWN_POWERUP` / `ACTIVATE_POWERUP_EFFECT` | Host→Client | Power-up sync |
| `HIT_CONFIRM` | Host→Client | Damage confirmation |
| `HOST_LOADED` | Host→Client | Host ready signal |
| `PING` | Both | Keep-alive |

---

## 12. Game Startup Flow

1. React mounts (`App.tsx` → `GameScene.tsx`)
2. `GameLifecycle.init()` creates Babylon.js engine, scene, camera
3. `Game` constructor creates `StateManager`, `ResourceManager`, all managers
4. `InputManager.attachListeners()` wires keyboard/mouse/gamepad
5. `Game.onStartGame(mapId, mode, playerName)`:
   - `MapLoader` loads map definition and builds scene geometry
   - NavMesh generated from `navFloors` for pathfinding
   - Systems registered with `SystemManager` in priority order
6. Game loop runs at ~60 FPS: `SystemManager.updateAll(dt, now)`
7. Network sync runs at 20 Hz inside `NetworkSystem`

---

## 13. Coding Style & Conventions

- **Strict Typing**: Avoid `any` at all costs. Use `interface` for public APIs over `type`.
- **Naming Conventions**:
    - Classes/Managers: `PascalCase` (e.g., `ZombieManager`)
    - Variables/Functions: `camelCase` (e.g., `spawnZombie`)
    - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_HEALTH`)
    - Enums: Use `enum` for state constants.
- **Path Aliases**: Use `@/*` for absolute imports (e.g., `@/systems/...`).

---

## 14. Debugging & Commands

### In-Game Console
- Press `Tab` to open the debug console.

### Useful Commands
| Command | Description |
|---------|-------------|
| `/debug` | Toggle debug mode |
| `/pos` | Show player position |
| `/tp <x> <y> <z>` | Teleport |
| `/points <amt>` | Add points |
| `/give <weapon_id>` | Give weapon |
| `/ammo` | Refill ammo |
| `/round <n>` | Set round |
| `/kill_all` | Kill all zombies |
| `/show_zones` | Toggle zone mesh visibility |
| `/show_navmesh` | Toggle or create navmesh debug mesh |
| `/show_pathfinding` | Toggle zombie path visualization (green=zombie, orange=hellhound) |
| `/wireframe` | Toggle scene wireframe mode |
| `/powerup <type>` | Spawn powerup (instakill, max_ammo, double_points, nuke, carpenter) |
| `/god` | Toggle god mode |
| `/noclip` | Toggle noclip mode |
| `/help` | Show available commands |

---

## 15. Common Commands

- **Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Preview Build**: `npm run preview`

---

## 16. Agent Workflow & File Hygiene

### Map Integration Checklist

- Keep maps data-driven in `maps/<map_name>/` and define interactables/zones/spawns in map definitions.
- Register new maps in `managers/MapRegistry.ts`.
- Add map menu/config entry so it is selectable in UI/game flow.

### Safe Edit Targets

- Prefer editing source directories (`game/`, `engine/`, `systems/`, `state/`, `maps/`, `ui/`, `types/`, `config/`, `managers/`, `network/`).
- Do **NOT** edit generated/runtime artifacts (`dist/`, `.vite/`).
- Do **NOT** commit or modify local secret files (e.g., `.env.local`) unless explicitly requested.
