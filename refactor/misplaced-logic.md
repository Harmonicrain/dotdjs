# Misplaced Logic

> Code that lives in the wrong file — self-contained subsystems buried inside dispatchers, state mutation in managers, animation logic in data classes, and debug tooling wired into the game loop. These make it hard to find where a feature is implemented and lead to files doing multiple unrelated jobs.

---

## InteractionSystem — Still Contains Door Animation + Power + Weapon Pickup

### `systems/InteractionSystem.ts` lines 45-87 — `animateDoorMeshToY()`
**Problem**: InteractionSystem is a dispatcher that routes to handlers, but it still contains a 43-line door animation state machine (lerp loop with scene observer, special-case disposal for door1/door2, observer tracking/cleanup). DoorHandler delegates back to this via an event, splitting the door logic across two files.
**Better home**: `systems/interaction/handlers/DoorHandler.ts` or a new `DoorAnimationController.ts` alongside it.

### `systems/InteractionSystem.ts` lines 95-115 — `actionTurnOnPower()`
**Problem**: 20 lines of power-on logic: state mutation, switch animation, door opening, HUD message, sound playback. PowerHandler already exists as a handler but the actual work lives here.
**Better home**: Inline into PowerHandler, or extract to a `PowerController.ts`.

### `systems/InteractionSystem.ts` lines 117-163 — `handleWeaponPickup()`
**Problem**: 46 lines of weapon inventory management (slot lookup, ammo refill, weapon swap, HUD sync). This is weapon state logic, not interaction dispatching. WallBuyHandler also has its own ammo-refill path, creating duplication.
**Better home**: A shared `weaponPickupUtils.ts` in `systems/interaction/` that both WallBuyHandler and the event handler call.

---

## StateManager — Player Damage + Downed Weapon Swap

### `state/StateManager.ts` lines 153-193 — `applyDamageToLocalPlayer()`
**Problem**: 40 lines mixing damage calculation, quick-revive branching, downed-state transition, weapon swapping, network messaging, and dual-downed game-over check. StateManager is a data container — this is a gameplay system.
**Better home**: A `PlayerDamageSystem.ts` or method on a `PlayerHealthController`, similar to how DownedSystem already handles the bleed-out timer.

### `state/StateManager.ts` lines 196-251 — `swapToDownedWeapon()` + `restoreWeaponsAfterRevive()`
**Problem**: 55 lines of weapon array manipulation + HUD sync for the downed/revive flow. This is tightly coupled to `applyDamageToLocalPlayer()` above but is pure weapon-state logic.
**Better home**: Move alongside `applyDamageToLocalPlayer` into whatever system absorbs it, or into a `WeaponStateUtils.ts`.

### `state/StateManager.ts` lines 57-88 — Debug state fields
**Problem**: `debugSelection`, `showPathfinding`, `scaleWeaponMode`, `debugControlsMode` — four debug-only state blocks (32 lines of type definitions) mixed in with authoritative game state. Makes it unclear which fields are shipped vs dev-only.
**Better home**: Group into a `DebugState` interface or a separate `DebugStateManager.ts`.

---

## GameLoop — Scale Weapon Debug Tool

### `game/GameLoop.ts` lines 39-131 — Scale weapon tool (wheel + keyboard handlers)
**Problem**: 92 lines of scroll-wheel interception, axis toggling (X/Y/Z/all), step-size adjustment, ESC-to-cancel, and mesh scaling — a complete dev tool embedded in the main game loop factory. It adds two global event listeners (`wheel`, `keydown`) on every game start, even in production.
**Better home**: `systems/debug/ScaleWeaponSystem.ts` with its own init/dispose, conditionally created.

### `game/GameLoop.ts` lines 146-179 — Debug controls update
**Problem**: 33 lines of FPS calculation, input debug data gathering, and UI sync for the debug overlay, running every frame when active. This is a self-contained debug feature.
**Better home**: Same debug system or a `DebugOverlaySystem.ts`.

---

## PowerUpManager — Effect Activation Logic

### `managers/PowerUpManager.ts` lines 51-83 — `activatePowerUp()`
**Problem**: A single method with branching per power-up type: MAX_AMMO refills all weapons + syncs HUD, NUKE iterates all zombies and marks them dead, CARPENTER rebuilds all windows. Each branch reaches into different game systems (weapons, zombies, windows). As new power-up types are added, this method grows.
**Better home**: Individual effect handlers (e.g., `MaxAmmoEffect`, `NukeEffect`, `CarpenterEffect`) in a `powerups/effects/` folder, dispatched by type.

---

## HellhoundManager — Death Handler Does Too Much

### `managers/HellhoundManager.ts` lines 90-149 — `onHellhoundDeath()`
**Problem**: 60 lines combining: death state, kill tracking, point awarding, kill event emission, network messaging, explosion damage check, visual effect creation, and power-up drop logic (with special final-dog-round guaranteed Max Ammo). This is five distinct responsibilities in one method.
**Better home**: Factor the explosion-damage check and power-up drop into utility functions. The kill-tracking / point-awarding pattern is duplicated with ZombieManager's death handler — both could share a `processKill()` utility.

---

## Summary

| File | Lines | What's Misplaced | Suggested Home |
|------|-------|------------------|----------------|
| InteractionSystem.ts | 45-87 | Door animation state machine | DoorHandler or DoorAnimationController |
| InteractionSystem.ts | 95-115 | Power-on logic | PowerHandler or PowerController |
| InteractionSystem.ts | 117-163 | Weapon pickup/inventory | weaponPickupUtils.ts |
| StateManager.ts | 153-193 | Player damage + downed transition | PlayerDamageSystem.ts |
| StateManager.ts | 196-251 | Downed weapon swap/restore | Same system or WeaponStateUtils |
| StateManager.ts | 57-88 | Debug state definitions | DebugState interface or DebugStateManager |
| GameLoop.ts | 39-131 | Scale weapon debug tool | systems/debug/ScaleWeaponSystem.ts |
| GameLoop.ts | 146-179 | Debug controls/FPS overlay | DebugOverlaySystem.ts |
| PowerUpManager.ts | 51-83 | Per-type effect activation | powerups/effects/ handlers |
| HellhoundManager.ts | 90-149 | Death handler (5 responsibilities) | processKill() utility + helpers |
