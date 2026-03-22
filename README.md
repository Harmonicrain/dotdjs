<div align="center">
  <h1 style="font-size: 3rem; margin-bottom: 0;">DOM OF THE DEAD</h1>
  <p><i>"Fetch me their souls!"</i></p>
  <p><b>A browser-based, multiplayer round-based zombie survival FPS built with Babylon.js and React.</b></p>
  <p><b>Build 2024.1 • CLASSIFIED</b></p>
</div>

---

## 📜 Overview

**DOM OF THE DEAD** is a high-fidelity prototype of a classic "Call of Duty: Zombies" style game running entirely in the browser. It features a custom game engine built on top of Babylon.js, handling physics, PBR rendering, and AI pathfinding, wrapped in a React 19 interface for HUD and menu management.

The project supports Peer-to-Peer multiplayer via WebRTC, allowing users to host lobbies and join friends to survive the undead hordes together.

## ✨ Features

### 🔫 Gameplay Mechanics
*   **FPS Controller**: Full movement system including sprinting, jumping, crouching, hip-fire, and ADS (Aim Down Sights) with procedural weapon recoil and sway.
*   **Weapon System**: 
    *   **Starting Pistol**: M1911 (Pack-a-Punch: "PAIN")
    *   **Shotgun**: Olympia (Pack-a-Punch: "Hades")
    *   **Rifles**: STG-44 (Pack-a-Punch: "Spatz-447"), FAMAS (Pack-a-Punch: "G16-GL35")
    *   **Wonder Weapons**: Ray Gun (Pack-a-Punch: "Porter's X2") - explosive projectiles with splash damage
    *   **Pack-a-Punch**: Weapon upgrade system changing stats, projectiles, and fire modes.
    *   **Wall Buys**: Purchase weapons and ammo from chalk outlines on walls.
    *   **Knife/Melee**: Quick melee attack (V key) with its own damage and animation.
*   **Round-Based Survival**: 
    *   Progressively difficult waves of zombies.
    *   **Hellhound Rounds**: Special rounds with fast-moving Hellhounds (every 5th round by default).
    *   **Intermissions**: Strategic downtime between rounds.
    *   **Respawn System**: Earn points between rounds to respawn if killed.

### 🧠 AI & Enemies
*   **Specialized AI Systems**: Split into AI (pathfinding), Damage (authority check), and Cleanup (lifecycle) systems for optimal performance.
*   **Zombie AI**: Pathfinding using RecastJS navigation meshes.
*   **Pathfinding**: Utilizes **RecastJS** navigation meshes for complex enemy routing through doors and windows.
*   **Barricades**: Repairable window barriers that zombies must tear down before entering.
*   **Enemy Types**: Walkers, Runners, Sprinters with varying speeds and health.

### 💰 Economy & Progression
*   **Points System**: Earn points for hits (10), kills (80), headshots (+20 bonus), repairs (10, capped at 50/round), and revives (50).
*   **Perks** (default costs, can be overridden per map):
    *   **Juggernog** (2000 pts): Increases health from 100 to 250.
    *   **Speed Cola** (3000 pts): Reduces reload times significantly.
    *   **Quick Revive** (1500 pts): Faster revives and solo self-revive capability.
    *   **Double Tap Root Beer** (2000 pts): Increases fire rate by ~33%.
    *   **Mule Kick** (4000 pts): Allows carrying a third weapon.
*   **Mystery Box**: Random weapon generator (costs 950 points).
*   **Power System**: Unlockable map areas, Pack-a-Punch machine, and perks.
*   **Pack-a-Punch** (4500 pts): Upgrades current weapon. Ammo refill costs 2500 pts.

### 🎁 Power-Ups
*   **Insta-Kill**: Zombies take massive damage from any source (30 second duration).
*   **Max Ammo**: Refills all weapon ammo.
*   **Double Points**: 2x point multiplier (30 second duration).
*   **Nuke**: Kills all active zombies instantly (+400 points).
*   **Carpenter**: Repairs all window barriers (+200 points).
*   **Fire Sale**: Reduces Mystery Box cost to 10 points and opens all box locations (30 second duration).

### 🌐 Multiplayer
*   **P2P Networking**: Host/Client architecture using **PeerJS**.
*   **State Synchronization**: Real-time syncing via a Delta-Compressor to minimize bandwidth (20Hz network tick).
*   **Spectator Mode**: Watch the host play if you fall in battle until the next round respawn.
*   **Downed/Revive System**: Cooperative revive mechanics with revive points reward.

### 🎨 Visuals & Audio
*   **PBR Materials**: Realistic lighting using Physically Based Rendering.
*   **Atmosphere**: Dynamic lighting and post-processing (Bloom, Tone Mapping).
*   **Visual Effects**: Blood splatters/decals, muzzle flash, spawn effects, particle systems, damage indicators.
*   **Audio System**: SoundManager for weapon sounds, power-up sounds, ambient effects, and game events.
*   **HUD**: Reactive React-based HUD using **Zustand** for zero-latency state bridging.

---

## 🗺️ Available Maps

| Map ID | Name | Description |
|--------|------|-------------|
| `warehouse` | WAREHOUSE 115 | An abandoned storage facility with tight corridors. |
| `map_test` | Test Arena | A large octagonal stone arena surrounded by gates. |
| `wipmap` | WIPMAP | Work in progress map. |

---

## 🛠️ Tech Stack & Languages

### Languages
*   **TypeScript** (Strictly typed with `strict: true`)
*   **React 19 / JSX** (UI, HUD Components)
*   **HTML5 / CSS3** (Tailwind CSS for UI)

### Core Imports & Libraries
*   **[@babylonjs/core](https://www.npmjs.com/package/@babylonjs/core)**: 3D rendering and physics engine.
*   **[@babylonjs/addons](https://www.npmjs.com/package/@babylonjs/addons)**: Additional Babylon.js utilities and helpers.
*   **[@babylonjs/loaders](https://www.npmjs.com/package/@babylonjs/loaders)**: GLTF/GLB asset support.
*   **[@recast-navigation/core](https://www.npmjs.com/package/@recast-navigation/core)**: Navigation mesh runtime.
*   **[@recast-navigation/generators](https://www.npmjs.com/package/@recast-navigation/generators)**: Navigation mesh generation.
*   **[zustand](https://github.com/pmndrs/zustand)**: High-performance state management for the HUD bridge.
*   **[peerjs](https://peerjs.com/)**: WebRTC data transmission.

---

## 📂 Project Structure

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
├── CommandRegistry.ts     # Debug console commands (/debug, /give, /tp, etc.)
├── EventBus.ts            # Typed pub/sub event system
├── GeometryUtils.ts       # Mesh/geometry creation utilities
├── InputManager.ts        # Keyboard, mouse, controller input (action-based)
├── LevelBuilder.ts        # Builds map geometry, doors, windows, lights from MapDefinition
├── MathUtils.ts           # Math helpers
├── MinHeap.ts             # Priority queue for pathfinding
├── ObjectPool.ts          # Generic object pool for performance
├── SystemManager.ts       # ECS system registration, priority sorting, update loop
└── TimerManager.ts        # Scheduled one-shot event handling

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
├── wipmap/                # WIPMAP (WIP map)
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
└── perks/                 # Perk machine meshes (Juggernog, Speed Cola, Quick Revive)

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
├── components/            # 20 HUD components (AmmoCounter, Crosshair, RoundDisplay, etc.)
└── menus/                 # MainMenu, HostLobby, JoinLobby
```

---

## 🎮 Controls

### Keyboard & Mouse
| Key | Action |
|-----|--------|
| **WASD** | Move |
| **Mouse** | Look around |
| **Left Click** | Fire weapon |
| **Right Click** | Aim down sights (ADS) |
| **R** | Reload |
| **F** | Interact (open doors, buy weapons, etc.) |
| **V** | Knife/Melee attack |
| **1-4** | Switch weapons |
| **Tab** | Next weapon |
| **Space** | Jump |
| **Shift** | Sprint |
| **C** | Crouch |
| **`** (backtick) | Toggle debug console |

### Controller
| Button | Action |
|--------|--------|
| **L3** | Sprint |
| **R3** | Knife/Melee |
| **L2** | Aim |
| **R2** | Fire |
| **X / Square** | Reload |
| **A / Cross** | Jump / Interact |
| **B / Circle** | Crouch |
| **LB** | Weapon 1 |
| **RB** | Weapon 2 |
| **Y/Triangle** | Next weapon |
| **START** | Toggle console |

---

## 🐛 Debug Commands

Open the debug console with **`** (backtick) and enter commands:

| Command | Description |
|---------|-------------|
| `/debug` | Toggle debug mode (freeze logic, inspect objects) |
| `/debug_controls` | Toggle input/jitter debugging overlay |
| `/debug_pbr` | Generate PBR material and lighting report |
| `/render_stats` | Toggle render stats overlay (draw calls, materials, shadows, lights) |
| `/pos` | Show player position and rotation |
| `/tp <x> <y> <z>` | Teleport to coordinates |
| `/points <amt>` | Add points |
| `/give <weapon_id>` | Give weapon (pistol, shotgun, rifle, famas, ray_gun) |
| `/ammo` | Refill all ammo |
| `/round <n>` | Set current round |
| `/kill_all` | Kill all active zombies |
| `/perk <id>` | Grant a perk (juggernog, speedCola, quickRevive, doubleTap, muleKick) |
| `/powerup <type>` | Spawn powerup (instakill, max_ammo, double_points, nuke, carpenter, fire_sale) |
| `/show_navmesh` | Toggle or create navmesh debug mesh |
| `/show_pathfinding` | Toggle zombie path visualization (green=zombie, orange=hellhound) |
| `/wireframe` | Toggle scene wireframe mode |
| `/scaleweapon [id]` | Weapon scaling debug tool |
| `/god` | Toggle god mode (invincibility) |
| `/noclip` | Toggle noclip mode (fly through walls) |
| `/help` | Show all available commands |

---

## 🚀 Running Locally

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open Browser**:
    Navigate to `http://localhost:3000`.

4.  **Build for Production**:
    ```bash
    npm run build
    ```

---

## 🏗️ Architecture Notes

### Hybrid ECS (Entity-Component-System)
- Logic is grouped into single-responsibility Systems that export an `update(dt)` method.
- Entities are typed objects (e.g., `Zombie`, `Projectile`), not pure IDs.
- New systems must be registered in `game/Game.ts` via `SystemManager`.

### State Management
- **StateManager** (`state/StateManager.ts`) is the "Single Source of Truth" for all game state.
- **UIBridge** (`state/UIBridge.ts`) handles Engine-to-UI communication without React imports in the engine.
- **Zustand Store** (`store/useGameStore.ts`) bridges React UI components to game state.

### Networking Authority
- **Host** is the authoritative source for game logic (spawning, damage, round progression).
- **Clients** are "dumb terminals" that relay input and render state.
- All simulation systems must early-return on non-authority clients.

---

## ✒️ Authors & Attribution

**"DOM OF THE DEAD"** was architected and written by Artificial Intelligence.

*   **Gemini (Google)**: Core Engine Architecture, Map Config System, UI/UX Design.
*   **Claude (Anthropic)**: ECS System Refactoring, Network Delta Compression, Sound System.
*   **Big Pickle (opencode.ai)**: Pathfinder Binary Heap Optimization, Bug Fixes, Refactoring.

*Thank you for playing! <3*
