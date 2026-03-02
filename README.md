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
    *   **Juggernog** (2500 pts): Increases health from 100 to 250.
    *   **Speed Cola** (3000 pts): Reduces reload times significantly.
    *   **Quick Revive** (1500 pts): Faster revives and solo self-revive capability.
*   **Mystery Box**: Random weapon generator (costs 950 points).
*   **Power System**: Unlockable map areas, Pack-a-Punch machine, and perks.
*   **Pack-a-Punch** (4500 pts): Upgrades current weapon. Ammo refill costs 2500 pts.

### 🎁 Power-Ups
*   **Insta-Kill**: Zombies take massive damage from any source (30 second duration).
*   **Max Ammo**: Refills all weapon ammo.
*   **Double Points**: 2x point multiplier (30 second duration).
*   **Nuke**: Kills all active zombies instantly (+400 points).
*   **Carpenter**: Repairs all window barriers (+200 points).

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
| `barn` | THE BARN | An isolated barn in an octagonal arena. No perks, no mercy. |

---

## 🛠️ Tech Stack & Languages

### Languages
*   **TypeScript** (Strictly typed with `strict: true`)
*   **React 19 / JSX** (UI, HUD Components)
*   **HTML5 / CSS3** (Tailwind CSS for UI)

### Core Imports & Libraries
*   **[@babylonjs/core](https://www.npmjs.com/package/@babylonjs/core)**: 3D rendering and physics engine.
*   **[@babylonjs/loaders](https://www.npmjs.com/package/@babylonjs/loaders)**: GLTF/GLB asset support.
*   **[@recast-navigation/core](https://www.npmjs.com/package/@recast-navigation/core)**: Navigation mesh runtime.
*   **[@recast-navigation/generators](https://www.npmjs.com/package/@recast-navigation/generators)**: Navigation mesh generation.
*   **[zustand](https://github.com/pmndrs/zustand)**: High-performance state management for the HUD bridge.
*   **[peerjs](https://peerjs.com/)**: WebRTC data transmission.

---

## 📂 Project Structure

```bash
├── config/                 # Global defaults (gameplay, weapons, enemies, maps)
│   └── weapons/           # Individual weapon configs (pistol, shotgun, fullauto, semiauto, wonderweapons)
├── documentation/         # Project docs (ARCHITECTURE.md, MAP_CREATION.md, etc.)
├── engine/                # Custom Engine core
│   ├── CommandRegistry.ts # Debug console commands
│   ├── EventBus.ts       # Global event system
│   ├── GeometryUtils.ts  # Mesh geometry utilities
│   ├── InputManager.ts   # Keyboard/mouse/controller input handling
│   ├── LevelBuilder.ts  # Map geometry and entity builder
│   ├── MapBuilder.ts    # In-game map building tool
│   ├── ObjectPool.ts     # Object pooling for performance
│   ├── Pathfinder.ts     # Navigation pathfinding utilities
│   ├── SystemManager.ts # ECS system registration and update
│   └── TimerManager.ts  # Scheduled event handling
├── game/                 # Lifecycle and Core Render Loop
│   ├── Game.ts           # Main game orchestrator
│   ├── GameEngine.ts    # Babylon.js engine wrapper
│   ├── GameLifecycle.ts # Game state transitions
│   └── GameLoop.ts      # Render loop with fixed timestep
├── managers/            # Game Managers
│   ├── HellhoundManager.ts   # Hellhound enemy spawning/management
│   ├── MapConfigManager.ts  # Map configuration handling
│   ├── MapLoader.ts     # Data-driven level setup
│   ├── MapRegistry.ts   # Map registration
│   ├── PowerUpManager.ts # Power-up spawn and handling
│   ├── ResourceManager.ts # Asset loading
│   ├── SoundManager.ts  # Audio playback
│   ├── VisualManager.ts # VFX, particles, lighting
│   └── ZombieManager.ts # Zombie entity management
├── maps/                 # Data-driven map definitions
│   ├── warehouse/        # Warehouse 115 map
│   ├── mapTest/        # Test arena map
│   ├── barn/            # The Barn map
│   ├── _template/       # Map template for new maps
│   ├── MapTextureResolver.ts # Texture resolution
│   └── validateMapDefinition.ts # Map validation
├── meshes/               # Mesh Factories
│   ├── BuildingFactory.ts    # Procedural building geometry
│   ├── gameplay/        # Power-ups, power switches
│   ├── mysterybox/     # Mystery Box
│   ├── packapunch/     # Pack-a-Punch machine
│   ├── perks/          # Perk machines (Juggernog, Speed Cola, Quick Revive)
│   ├── RemotePlayerFactory.ts # Remote player meshes
│   ├── WeaponMeshFactory.ts   # FPS weapon meshes
│   └── ZombieMeshFactory.ts    # Zombie meshes
├── network/            # P2P Networking
│   ├── InterpolationBuffer.ts  # Remote entity smoothing
│   ├── NetworkDeltaCompressor.ts # Bandwidth optimization
│   ├── NetworkMessageHandler.ts # Message processing
│   └── useMultiplayer.ts       # Multiplayer hook
├── public/             # Static assets
│   └── sounds/        # Audio files (weapons, powerups, ambient)
├── state/             # State Management
│   ├── RemotePlayerState.ts # Remote player state
│   ├── StateManager.ts # Central game state (Single Source of Truth)
│   └── UIBridge.ts    # Engine-to-UI communication
├── store/            # Zustand store for React UI
├── systems/          # Modular ECS-style logic systems
│   ├── interaction/  # Interaction system
│   │   ├── handlers/ # Interaction handlers (Door, Perk, WallBuy, etc.)
│   │   └── types.ts  # Interaction types
│   ├── DownedSystem.ts      # Downed state handling
│   ├── InteractionSystem.ts # Player world interactions
│   ├── MysteryBoxSystem.ts  # Mystery Box mechanics
│   ├── NetworkSystem.ts     # Multiplayer sync
│   ├── PlayerCombatSystem.ts # Shooting, reloading, knifing
│   ├── PlayerMovementSystem.ts # Movement physics
│   ├── PowerUpSystem.ts    # Power-up effects
│   ├── ProjectileSystem.ts # Bullet/projectile handling
│   ├── RemotePlayerSystem.ts # Remote player interpolation
│   ├── ReviveSystem.ts     # Cooperative revive
│   ├── RoundSystem.ts      # Round progression
│   ├── WeaponViewSystem.ts # Weapon view/animations
│   ├── ZoneSystem.ts       # Zone management
│   ├── ZombieAISystem.ts   # Pathfinding and movement
│   ├── ZombieAnimationSystem.ts # Zombie animations
│   ├── ZombieCleanupSystem.ts   # Entity lifecycle
│   └── ZombieDamageSystem.ts    # Damage handling
├── types/            # Strict TypeScript definitions
├── ui/               # React-based HUD and Menus
│   ├── components/   # HUD components (AmmoCounter, Crosshair, Console, etc.)
│   ├── GameMenuManager.ts # Menu state management
│   ├── GameMenus.tsx      # Main menu, host/join lobbies
│   ├── GameScene.tsx      # Canvas wrapper
│   └── HUD.tsx           # Main HUD layout
├── App.tsx           # Root React component
├── index.tsx         # Entry point
├── vite.config.ts   # Vite configuration
└── tsconfig.json    # TypeScript configuration
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
| `/pos` | Show player position and rotation |
| `/tp <x> <y> <z>` | Teleport to coordinates |
| `/points <amt>` | Add points |
| `/give <weapon_id>` | Give weapon (pistol, shotgun, rifle, famas, ray_gun) |
| `/ammo` | Refill all ammo |
| `/round <n>` | Set current round |
| `/kill_all` | Kill all active zombies |
| `/powerup <type>` | Spawn powerup (instakill, max_ammo, double_points, nuke, carpenter) |
| `/show_zones` | Toggle zone mesh visibility |
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
    Navigate to `http://localhost:5173`.

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
