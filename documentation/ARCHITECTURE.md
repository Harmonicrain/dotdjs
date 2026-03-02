# Architecture & Engineering

The project follows a **Hybrid Entity-Component-System (ECS)** architecture. While it doesn't strictly adhere to "Pure ECS" (Data-only Components), it adopts the "Systems" pattern to decouple logic from data.

## 🏛️ Core Concepts

### 1. The Game Loop
The game operates on two separate loops:
*   **Render Loop (Babylon.js)**: Runs at the display refresh rate (e.g., 60Hz or 144Hz). It handles physics stepping, logic updates, and scene rendering.
*   **React Loop (UI)**: React updates are decoupled from the game loop. The `UIBridge` communicates state changes (ammo, health, round number) to React via `Zustand` stores to prevent performance bottlenecks.

### 2. State Management (`StateManager`)
The `StateManager` (located in `state/StateManager.ts`) is the "Single Source of Truth" for the game simulation.
*   It holds references to all active entities (Zombies, Projectiles, Players).
*   It manages global flags (Game Over, Round Number, Power Status).
*   It provides access to Managers (ZombieManager, PowerUpManager, VisualManager, SoundManager).
*   **Important**: Systems consume the `StateManager` to read/write data.

### 3. Systems
Logic is broken down into small, single-responsibility functions called **Systems**.
*   **Location**: `systems/` directory.
*   **Structure**: A function that returns an object with an `update(dt)` method.
*   **Registration**: Systems are registered in `Game.ts` via the `SystemManager`.

**Key Systems:**
*   `ZombieAISystem`: Handles pathfinding and state machines for enemies.
*   `PlayerCombatSystem`: Manages shooting, reloading, recoil, and weapon sounds.
*   `PlayerMovementSystem`: Handles player movement, jumping, and sprinting.
*   `ProjectileSystem`: Manages bullet physics and hit detection.
*   `PowerUpSystem`: Handles power-up spawning, pickup, and effects.
*   `InteractionSystem`: Handles raycasting for interactables (Windows, Perks, Doors, Power Switch).
*   `NetworkSystem`: Syncs state between Host and Client.
*   `RoundSystem`: Manages round progression and zombie spawning.

### 4. Managers
While Systems handle frame-by-frame logic, **Managers** handle high-level lifecycle events and complex orchestrations.
*   `ZombieManager`: Spawning logic, wave management, and death events.
*   `HellhoundManager`: Spawning and management of hellhound enemies.
*   `MapLoader`: Parsing map config and instantiating geometry.
*   `VisualManager`: Particle effects, decals, blood splatters, and lighting changes.
*   `SoundManager`: Audio playback for weapons, power-ups, and game events.
*   `PowerUpManager`: Power-up activation and effect application.

### 5. LevelBuilder
Maps are built using the `LevelBuilder` class (`engine/LevelBuilder.ts`) which parses `MapDefinition` objects and creates:
*   Geometry (floors, walls, ceilings)
*   Interactables (doors, windows, perks, mystery box, power switch, pack-a-punch)
*   Navigation meshes

## 🔄 Data Flow

1.  **Input**: `InputManager` captures keyboard/mouse events.
2.  **Update**: `GameLoop` calls `SystemManager.updateAll()`.
3.  **Systems**:
    *   `PlayerMovementSystem` reads Input -> updates Camera position.
    *   `PlayerCombatSystem` reads Input -> fires weapons, plays sounds.
    *   `ZombieAISystem` reads Player position -> updates Zombie velocity.
4.  **Render**: Babylon.js draws the scene.
5.  **UI Sync**: If values changed (e.g., ammo), `UIBridge` updates the React store.

## 🧩 Entities

Entities in this project are **Typed Objects** rather than pure IDs.
*   **Zombie**: Contains `mesh`, `health`, `state`, `type` (ZOMBIE or HELLHOUND).
*   **Projectile**: Contains `mesh`, `direction`, `speed`, `damage`.
*   **PowerUp**: Contains `type`, `mesh`, `position`.

This hybrid approach allows for easier debugging and interaction with the Babylon.js API compared to a pure ID-based ECS.

## 🔧 Debug Commands

The game includes a command system accessible via console (or in-game console):
*   `/debug` - Toggle debug mode
*   `/pos` - Show player position
*   `/tp <x> <y> <z>` - Teleport
*   `/points <amt>` - Add points
*   `/give <weapon_id>` - Give weapon
*   `/ammo` - Refill ammo
*   `/round <n>` - Set round
*   `/kill_all` - Kill all zombies
*   `/powerup <type>` - Spawn powerup (instakill, max_ammo, double_points, nuke, carpenter)
*   `/god` - Toggle god mode
*   `/noclip` - Toggle noclip mode
