# Contributing Guide

Thank you for your interest in contributing to **DOM OF THE DEAD**!

## 📝 Coding Standards

### TypeScript
*   **Strict Mode**: Always enabled. No `any` unless absolutely necessary (and commented why).
*   **Interfaces**: Prefer `interface` over `type` for public APIs.
*   **Enums**: Use `enum` for state constants (e.g., `ZombieState`, `PowerUpType`).

### Naming Conventions
*   **Classes**: `PascalCase` (e.g., `ZombieManager`).
*   **Functions/Variables**: `camelCase` (e.g., `spawnZombie`).
*   **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_HEALTH`).
*   **Files**: Match the primary export (e.g., `ZombieManager.ts`).

## 🏗️ Architectural Guidelines

1.  **No React in Engine**: The `game/` and `engine/` folders should NOT import React. They should remain pure TypeScript/Babylon.js.
2.  **No Babylon in UI**: The `ui/` folder should avoid importing `@babylonjs/core` directly if possible, to keep the UI layer agnostic.
3.  **Performance**:
    *   Avoid `new` in the render loop. Use object pooling or reuse vectors.
    *   Use `Ref` for mutable data that doesn't need to trigger a React render.
    *   Use `Zustand` for data that needs to update the UI.
4.  **Sound**: When adding new sounds, use `SoundManager` and preload during map loading.

## 🧪 Testing

*   Currently, the project relies on manual playtesting.
*   When adding a feature, please test both **Singleplayer** and **Host/Client** scenarios to ensure networking logic holds up.
*   Test audio playback in the browser.

## 🎵 Adding New Sounds

To add new sounds to the game:

1.  Place audio files in `public/sounds/`:
    *   `weapons/` - Weapon sounds
    *   `powerups/` - Power-up sounds
    *   `music/` - Background music
2.  Load the sound in `Game.ts` during map loading:
    ```typescript
    this.stateManager.soundManager?.loadSound('sound_name', '/sounds/path.mp3').catch(err => {
        console.warn('Could not load sound:', err);
    });
    ```
3.  Play the sound via `SoundManager`:
    ```typescript
    ctx.soundManager?.play('sound_name');
    ```

## 🐛 Reporting Bugs

Please include:
1.  Steps to reproduce.
2.  Console errors (F12).
3.  Whether it happened in Singleplayer or Multiplayer.

## 📁 Key Directories

*   `systems/` - Game logic (ECS-style systems)
*   `managers/` - High-level managers (ZombieManager, VisualManager, SoundManager)
*   `engine/` - Core engine (InputManager, SystemManager, LevelBuilder)
*   `types/` - TypeScript type definitions
*   `maps/` - Map definitions and configurations
