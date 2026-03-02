# DOM OF THE DEAD - Project Overview

**DOM OF THE DEAD** is a web-based First-Person Shooter (FPS) that recreates the classic "Zombie Survival" experience directly in the browser. It leverages modern web technologies to deliver high-fidelity 3D graphics, physics, and multiplayer capabilities without requiring any plugins or downloads.

## 🎯 Project Goals

1.  **High Fidelity in Browser**: Push the limits of WebGL (via Babylon.js) to create a visually impressive game with PBR materials, dynamic lighting, and post-processing.
2.  **Seamless Multiplayer**: Provide an easy-to-use Peer-to-Peer (P2P) multiplayer experience that works instantly via link sharing.
3.  **Performant Architecture**: utilize a custom game engine loop separated from the UI thread to ensure smooth 60fps+ gameplay even on lower-end devices.

## 🏗️ Tech Stack

### Core Engine
*   **[Babylon.js](https://www.babylonjs.com/)**: The backbone of the project. Handles the scene graph, rendering pipeline, physics interactions, and audio.
*   **TypeScript**: The entire codebase is written in strict TypeScript to ensure type safety and maintainability.

### User Interface
*   **React**: Handles the Heads-Up Display (HUD), menus, and lobby screens.
*   **Zustand**: Used for high-frequency state management to bridge the gap between the Babylon.js render loop and the React DOM updates without causing re-renders.
*   **Tailwind CSS**: For rapid and consistent UI styling.

### Networking
*   **PeerJS**: Wraps WebRTC to facilitate direct browser-to-browser data connections.
*   **Custom Delta Compression**: A bespoke system to compress game state packets, ensuring low-latency updates over the network.

### AI & Navigation
*   **RecastJS**: A port of the industry-standard Recast navigation mesh library, allowing zombies to intelligently navigate complex map geometry.

## 🔑 Key Features

*   **Round-Based Survival**: Infinite scaling difficulty.
*   **Weapon Systems**: Hit-scan and projectile weapons, recoil patterns, and upgrades.
*   **Pack-a-Punch**: Weapon upgrade mechanics.
*   **Mystery Box**: Randomized loot crate.
*   **Perk System**: Buyable buffs (Juggernog, Speed Cola, Quick Revive).
*   **Dynamic Maps**: Unlockable doors and debris.
*   **Power System**: Turn on the power to unlock new areas and activate machinery.
*   **Power-Ups**: Insta-Kill, Max Ammo, Double Points, Nuke, Carpenter.
*   **Hellhounds**: Special enemy type that spawns on dog rounds.

## 📂 Directory Structure Overview

*   `config/`: Game balance constants (weapon stats, zombie health, combat settings).
*   `config/weapons/`: Individual weapon configurations.
*   `engine/`: Core boilerplate (Input handling, System Manager, Event Bus, LevelBuilder).
*   `game/`: The main entry point for the 3D logic (`Game.ts`, `GameLoop.ts`).
*   `managers/`: High-level logic controllers (Map loading, Zombie spawning, Visual effects, Sound).
*   `maps/`: Map data and assets (warehouse, mapTest, _template).
*   `maps/*/config/`: Map-specific configuration overrides.
*   `meshes/`: Factory functions for creating 3D objects (weapons, zombies, perks, mystery box).
*   `meshes/gameplay/`: Gameplay objects (power switches, doors, windows).
*   `network/`: Networking logic and synchronization.
*   `public/`: Static assets (models, textures, sounds).
*   `public/sounds/`: Audio files (weapons, powerups).
*   `state/`: The central state container (`StateManager`) and UI bridge.
*   `systems/`: The ECS-style logic processors (Movement, Combat, AI, PowerUps, Round).
*   `systems/interaction/handlers/`: Interaction handlers for doors, windows, perks, wallbuys.
*   `types/`: TypeScript type definitions.
*   `ui/`: React components and GameScene.
