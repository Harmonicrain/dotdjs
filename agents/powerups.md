# POWER-UP SYSTEM GUIDE

This document serves as a reference for LLM agents to quickly understand, modify, or extend the power-up system in DOM OF THE ROAD.

---

## 1. Core Architecture
The power-up system is split into **Lifecycle Management** (`PowerUpSystem.ts`), **Effect Execution** (`PowerUpManager.ts`), and **Visuals** (`PowerUpFactory.ts`).

- **Lifecycle**: Handles spawning, pickup detection, blinking, and expiration.
- **Management**: Handles the logic of what happens when a power-up is picked up (e.g., adding points, refilling ammo).
- **State**: Tracked in `StateManager` and synced via `NetworkSystem`. See [multiplayer.md](./multiplayer.md) for sync details.

---

## 2. Key File Locations

| File | Purpose |
|------|---------|
| `C:\ZOMBZ\types\ui.ts` | Enum `PowerUpType` and state interfaces. |
| `C:\ZOMBZ\config\gameplay.ts` | Tunable values (drop chance, durations, points). |
| `C:\ZOMBZ\managers\PowerUpManager.ts` | Core logic for activating effects. |
| `C:\ZOMBZ\systems\PowerUpSystem.ts` | ECS System for engine-side lifecycle (pickups, cleanup). |
| `C:\ZOMBZ\meshes\gameplay\PowerUpFactory.ts` | Babylon.js mesh and material creation (Colors defined here). |
| `C:\ZOMBZ\ui\components\PowerUpDisplay.tsx` | React HUD component for active timers. |
| `C:\ZOMBZ\engine\CommandRegistry.ts` | The `/powerup` console command. |
| `C:\ZOMBZ\game\Game.ts` | Audio pre-loading (line ~464). |

---

## 3. Visual Reference (Colors & Icons)

| Power-Up | Color (Emissive) | Icon | Effect Category |
|----------|-----------------|------|-----------------|
| **MAX_AMMO** | Blue (0, 0.5, 1) | 📦 | Instant |
| **INSTA_KILL** | Red (1, 0.2, 0.2) | ☠ | Timed |
| **DOUBLE_POINTS** | Purple (0.8, 0, 1) | ×2 | Timed |
| **NUKE** | Yellow (1, 1, 0) | ☢ | Instant |
| **CARPENTER** | Orange (1, 0.5, 0) | 🔨 | Instant |

---

## 4. Spawning Logic (The Math)

There are two distinct paths for a power-up to enter the world:

### A. Zombie Drop (Random)
Defined in `ZombieManager.ts` (around line 103). When a zombie/hellhound dies, a `DROP_CHANCE` (default 0.03 / 3%) is rolled. If it hits, a random power-up is spawned at the zombie's location.

### B. Point Threshold (Guaranteed)
Defined in `PowerUpSystem.ts`. In Solo/Host mode, a power-up spawns every time the player crosses a cumulative point threshold.
- **Start**: `POINTS_THRESHOLD_START` (default 2000).
- **Scaling**: `POINTS_THRESHOLD_MULTIPLIER` (default 1.14 / +14% each time).
- **Formula**: `nextThreshold = currentThreshold * 1.14`.

---

## 5. Instant vs. Timed Effects

When implementing `activatePowerUp(type)` in `PowerUpManager.ts`, there are two patterns:

### A. Instant Effects (Nuke, Max Ammo, Carpenter)
These execute immediately and do NOT set a timer in `activePowerUps`.
```typescript
if (type === PowerUpType.MAX_AMMO) {
    this.gameState.weapons.forEach(w => { w.currentAmmo = w.clipSize; w.currentReserve = w.maxReserve; });
    // Update UI immediately via the StateManager methods (sm)
    const activeW = this.gameState.weapons[this.gameState.activeWeaponIndex];
    this.sm.setAmmo(activeW.currentAmmo);
    this.sm.setReserveAmmo(activeW.currentReserve);
}
```

### B. Timed Effects (Insta Kill, Double Points)
These set an expiration timestamp in `activePowerUps`. Other systems (Combat, Projectile) check this state per-frame.
```typescript
// The 'else' block in activatePowerUp handles this automatically:
this.gameState.activePowerUps[type] = Date.now() + pc.EFFECT_DURATION; 
```

---

## 6. The "Never Forget" Checklist (FAIL-SAFE)

1.  **Points Multiplier Trap**: The `addPoints()` method in `StateManager.ts` **already checks** for Double Points and multiplies the amount. Do NOT multiply points manually when awarding Nuke/Carpenter bonuses (e.g., `this.addPoints(400)` is correct; `this.addPoints(400 * 2)` is wrong and causes 4x points).
2.  **Sound Pre-loading**: New pickup sounds MUST be pre-loaded in `C:\ZOMBZ\game\Game.ts` inside the `loadLevel` method, or they will lag or fail on first pickup.
3.  **Network Sync**: If you add a new **Instant** effect (like Max Ammo), ensure any UI or state changes are pushed to the UI Bridge (`this.sm.setAmmo`) so the local player sees it immediately.
4.  **Registration**: Ensure your new power-up is included in the `PowerUpType` enum so `Math.random()` can pick it in `spawnPowerUp()`.

---

## 7. Pro-Tips
- **Horizontal Distance**: Pickup detection in `PowerUpSystem.ts` uses horizontal (XZ) distance only. This ensures reliable pickups regardless of player jump height.
- **Map Overrides**: `MapConfigManager.ts` can override global power-up settings (like `DROP_CHANCE`) per map.
- **Z-Fighting**: The factory adds `+0.3` to the Y-axis to prevent the mesh from clipping through the floor.
