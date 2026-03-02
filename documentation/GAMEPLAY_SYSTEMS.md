# Gameplay Systems

This document details the mechanics and logic behind the core gameplay loop.

## 🧟 Zombie AI

The Zombie AI is a state machine handled by `ZombieAISystem`.

### States
1.  **SPAWNING**: Play rise animation, invincible.
2.  **CHASING**: Use Recast navigation to find a path to the nearest player.
3.  **APPROACHING_WINDOW**: If a barrier blocks the path, move to the window's attack point.
4.  **ATTACKING_BARRIER**: Play attack animation, damage window boards.
5.  **ENTERING**: Vault through the window after breaking the barrier.

### Pathfinding
*   **RecastJS**: The map has a baked Navigation Mesh. Zombies query this mesh via the `ZombieAISystem` to find smooth paths around obstacles like walls, pillars, and crates.
*   **Throttled Updates**: Pathfinding is computed periodically (every 500ms) for each zombie to maintain performance.
*   **Zone Integration**: The NavMesh works in tandem with the "Zone System". If a player is in a locked zone, the pathfinder is directed to the connecting door's waypoint instead of the player.

### Hellhounds
*   **HellhoundManager**: Manages special enemy type that spawns on dog rounds.
*   **Spawning**: Lightning effect before spawning, fades in with animation.
*   **AI**: Uses NavMesh for navigation, different attack patterns than regular zombies.
*   **Damage**: Higher damage than regular zombies, different visual feedback (orange flash instead of red).

## 🔫 Weapons & Ballistics

### Projectiles vs Hitscan
*   **Projectiles**: Most weapons use physical projectiles. They have travel time and gravity.
*   **Hitscan**: Instant damage (used for some wonder weapons or specific logic).

### Weapon Sounds
*   Each weapon has an associated sound file loaded via `SoundManager`.
*   Sounds are pre-loaded during map loading for instant playback.
*   Example: M1911 pistol fires with `/sounds/weapons/m1911.mp3`.

### Recoil
Recoil is procedural, affecting the camera's rotation.
*   **Kick**: Upward movement per shot.
*   **Recovery**: Smooth return to center over time.
*   **Sway**: Passive movement when idle or moving.

## 🔨 Interaction System

The `InteractionSystem` performs a raycast from the center of the screen every frame (or every few frames) to detect interactable objects.

*   **Windows**: Hold 'F' to repair boards.
*   **Wall Buys**: Press 'F' to buy weapon/ammo.
*   **Perk Machines**: Press 'F' to buy perk (Juggernog, Speed Cola, Quick Revive).
*   **Mystery Box**: Press 'F' to roll for a weapon.
*   **Pack-a-Punch**: Press 'F' to upgrade weapon (requires power to be on).
*   **Power Switch**: Press 'F' to turn on power.

## ⚡ Power System

The power system is a core gameplay mechanic:
*   **Power Switch**: Located in the map, must be activated by the player.
*   **Effects**:
    *   Unlocks Pack-a-Punch machine
    *   Opens power doors (blocking access to certain areas)
    *   Enables power-dependent amenities
*   **Sound**: Plays `/sounds/power.mp3` when activated.

## 🎁 Power Ups

Power-ups are dropped randomly on zombie death (`ZombieManager`).
*   **Insta-Kill**: Zombies take 9999 damage from any source. Plays `/sounds/powerups/instakill.mp3`.
*   **Max Ammo**: Refills reserves for all players.
*   **Double Points**: 2x point multiplier.
*   **Nuke**: Kills all active zombies. Plays `/sounds/powerups/nuke.mp3`.
*   **Carpenter**: Repairs all windows.

## 🔄 Round Logic

Managed by `RoundSystem`.
1.  **Intermission**: Timer between rounds.
2.  **Spawning**: Zombies spawn based on a curve: `Base + (Round * Multiplier)`.
3.  **Dog Rounds**: Every 3rd round (configurable) is a dog round with Hellhounds.
4.  **Cleanup**: When `zombiesAlive == 0` and `zombiesSpawned == maxForRound`, the round ends.

## 💥 Visual Effects

The `VisualManager` handles:
*   **Blood Splatters**: Decals on zombies when hit, blood pools on floor.
*   **Muzzle Flash**: Point lights at weapon muzzle.
*   **Zombie Explosions**: Particle effects when zombies die.
*   **Spawn Effects**: Smoke effects when zombies spawn.
*   **Impact Particles**: Debris when bullets hit surfaces.

## 🎮 Debug Commands

Use `/powerup <type>` to spawn powerups for testing:
*   `/powerup instakill`
*   `/powerup max_ammo`
*   `/powerup double_points`
*   `/powerup nuke`
*   `/powerup carpenter`
