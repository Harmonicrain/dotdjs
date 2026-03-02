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

## 6. Systems & Managers

### Visual Effects

- Do not create raw Babylon.js particle systems in isolation.
- Coordinate with the `VisualManager` for particles, decals, and lighting changes.

### Audio

- Use `SoundManager` for all audio playback.
- Preload sounds during map loading to avoid playback lag.

---

## 7. Coding Style & Conventions

- **Strict Typing**: Avoid `any` at all costs. Use `interface` for public APIs over `type`.
- **Naming Conventions**:
    - Classes/Managers: `PascalCase` (e.g., `ZombieManager`)
    - Variables/Functions: `camelCase` (e.g., `spawnZombie`)
    - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_HEALTH`)
    - Enums: Use `enum` for state constants.
- **Path Aliases**: Use `@/*` for absolute imports (e.g., `@/systems/...`).

---

## 8. Debugging & Commands

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

## 9. Common Commands

- **Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Preview Build**: `npm run preview`

---

## 10. Agent Workflow & File Hygiene

### Map Integration Checklist

- Keep maps data-driven in `maps/<map_name>/` and define interactables/zones/spawns in map definitions.
- Register new maps in `managers/MapRegistry.ts`.
- Add map menu/config entry so it is selectable in UI/game flow.

### Safe Edit Targets

- Prefer editing source directories (`game/`, `engine/`, `systems/`, `state/`, `maps/`, `ui/`, `types/`, `config/`, `managers/`, `network/`).
- Do **NOT** edit generated/runtime artifacts (`dist/`, `.vite/`).
- Do **NOT** commit or modify local secret files (e.g., `.env.local`) unless explicitly requested.
