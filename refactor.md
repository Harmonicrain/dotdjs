# Refactoring Plan - DOM OF THE ROAD

Read `AGENTS.md` before starting. Do NOT break game logic, networking, or the separation of concerns (UI vs Engine). All changes must be safe, incremental, and preserve existing behavior. Do not add new features. Do not remove functionality. Focus only on simplifying, deduplicating, and cleaning up.

---

## Priority: HIGH

### 1. GameLifecycle.ts - start() is 163 Lines + Duplicated Weapon Setup ⬜ STILL RELEVANT
**File:** `game/GameLifecycle.ts` (lines ~103-266)

Extract:
- `_waitForTexturesReady(timeout)` - the polling/timeout logic at lines ~141-156
- `_resetToPistol()` - weapon initialization is duplicated between `start()` (lines ~218-232) and `_respawnPlayer()` (lines ~323-333)
- `_activateWeapon(weaponIndex)` - mesh enable/disable pattern duplicated at lines ~238-245 and ~334

### 2. MapBuilder.ts - 207-line update() Method ⬜ STILL RELEVANT (reduced to ~111 lines but sub-methods not extracted)
**File:** `engine/MapBuilder.ts` (lines ~520-630)

Split into:
- `updateKeyboardInput()`
- `updateFireInput()`
- `updatePreviewUI()`

Also, the `getPreviewProps()` switch at lines ~428-510 (82 lines) should be replaced with a config object mapping EntityType to default dimensions.

The repeated position-update code at lines ~607-621 should be extracted to `updateEntityPosition(entity)`.

---

## Priority: MEDIUM

### 3. NetworkDeltaCompressor.ts - Duplicated Comparison Functions ⬜ STILL RELEVANT
**File:** `network/NetworkDeltaCompressor.ts` (lines ~70-99)

`perksChanged()`, `doorsChanged()`, `windowsChanged()` have nearly identical logic (compare record keys + values). Extract a generic `recordChanged<T>(a, b, compareFn?)` helper.

### 4. InputManager.ts - Duplicated Device Switching + Deadzone Logic ⬜ STILL RELEVANT
**File:** `engine/InputManager.ts`

- Device switching logic at lines ~202-211, ~274-275, ~288-290 is repeated. Extract `clearNonActiveDeviceState(device)`.
- Deadzone application at lines ~578-588 is duplicated for X and Y axes. Extract `applyDeadzoneAndSensitivity(raw, threshold, sensitivity)`.
- Pointer lock conditionals at lines ~342-351 are convoluted and overlapping. Simplify with boolean algebra.

### 5. GameLoop.ts - 181-line createGameLoop + Duplicated Scale UI Updates ⬜ STILL RELEVANT
**File:** `game/GameLoop.ts` (lines ~35-216)

- Extract wheel handler and keydown handler for scale-weapon mode into separate functions.
- The scale UI update at lines ~65-70 and ~110-115 is identical - extract to `updateScaleWeaponUI(sm, mode)`.
- The axis key mapping switch at lines ~79-105 should use a mapping object instead.

### 6. ProjectileSystem.ts - 165-line update() with Deep Nesting ⬜ STILL RELEVANT
**File:** `systems/ProjectileSystem.ts` (lines ~174-339)

Extract:
- `handleProjectileCollision(proj, hit)`
- `handleZombieHit(proj, zombie)`
- `handleEnvironmentHit(proj, pickInfo)`

### 7. useMultiplayer.ts - 307-line Hook ⬜ STILL RELEVANT (now 358 lines; BENIGN_NETWORK_ERRORS extracted ✅ but hook not split)
**File:** `network/useMultiplayer.ts` (lines ~10-316)

Consider splitting into smaller hooks:
- `usePeerHost()` - host initialization
- `usePeerClient()` - client initialization
- `useHeartbeat()` - heartbeat management

### 8. ZombieManager.ts + HellhoundManager.ts - Overlapping Death Handlers ⬜ STILL RELEVANT
**Files:** `managers/ZombieManager.ts` (lines ~93-119) and `managers/HellhoundManager.ts` (lines ~73-114)

Both have nearly identical `onDeath()` logic: increment kills, emit events, handle power-up drops, create explosions. Extract a shared `handleEnemyDeath(enemy, pos, killer, callbacks)` utility.

### 9. ZombieManager.ts - 92-line Deeply Nested Spawn Function ⬜ STILL RELEVANT
**File:** `managers/ZombieManager.ts` (lines ~121-213)

Extract:
- `getAccessibleSpawnWindows()` - zone/window filtering
- `tryPlaySpawnSound(pos)` - sound cooldown logic
- `createZombieEntity(spawnPos, window, round)` - entity creation

### 10. CommandRegistry.ts - 100-line show_pathfinding Command ⬜ STILL RELEVANT
**File:** `engine/CommandRegistry.ts` (lines ~173-273)

Extract the pathfinding visualization observer into a separate `PathfindingDebugger` class or utility function. Also, each zombie creates a new material for its debug tube - reuse a single shared material.

### 11. InteractionSystem.ts - PAP Material Observer Relies on Dispose ⬜ STILL RELEVANT
**File:** `systems/InteractionSystem.ts` (lines ~265-269)

The pulsing emissive observer on Pack-a-Punch materials is cleaned up via `papMat.onDisposeObservable`. If materials are reassigned rather than explicitly disposed, the observer persists indefinitely. Each Pack-a-Punch creates a new observer, so re-packing a weapon leaks the old one.

---

## Priority: LOW

### 12. StateManager.ts - null! Assertions ⬜ STILL RELEVANT
**File:** `state/StateManager.ts` (lines ~98-108)

Five properties use `null!` non-null assertion without initialization guarantees. Consider making them properly nullable or initializing in constructor.

### 13. MapTextureResolver.ts - Dead registerMapFolder() Function ⬜ STILL RELEVANT (no call sites exist — safe to delete)
**File:** `maps/MapTextureResolver.ts` (line ~19)

`registerMapFolder()` is a no-op stub kept for "call-site compatibility." Find and remove all call sites, then delete the function.

### 14. ZombieDamageSystem.ts + ZombieAISystem.ts - Math.sqrt for Distance Comparisons ⬜ STILL RELEVANT
**Files:** `systems/ZombieDamageSystem.ts` (line ~42 uses `Math.pow`), `systems/ZombieAISystem.ts` (line ~92, `getHorizontalDist` still uses `Math.sqrt` — note `getHorizontalDistSq` exists and is used in most hot paths, but `getHorizontalDist` is now unused and can be removed)

Uses `Math.sqrt(Math.pow(...))` for distance comparisons where only relative ordering matters. Use squared distance instead and compare against squared thresholds.

### 15. GameEngine.ts - Projectile Pool Reset Fields ⬜ STILL RELEVANT
**File:** `game/GameEngine.ts` (lines ~104-107)

Resetting fields to `undefined` during pool return. Consider resetting to typed defaults (`false`, `0`, `1`) instead for type safety.

### 16. MapRegistry.ts - Excessive Console Logging ⬜ STILL RELEVANT (11 unconditional console calls)
**File:** `managers/MapRegistry.ts` (lines ~70-113)

13 lines of navmesh debug logging in production code. Wrap in a `DEV` environment check or use a configurable log level.

### 17. Game.ts - camera.speed is Dead Code ⬜ STILL RELEVANT
**File:** `game/Game.ts` (line ~138)

`camera.speed` is set to `GAME_CONFIG.WALK_SPEED` but PlayerMovementSystem drives movement entirely via `camera.cameraDirection` — Babylon's built-in `camera.speed` property is never consulted. Remove the assignment to avoid confusion.

### 18. Game.ts - Missing maxZ (Far Plane) ⬜ STILL RELEVANT
**File:** `game/Game.ts` (line ~140)

Only `camera.minZ = 0.1` is set; `maxZ` defaults to Babylon's 10,000 units. For indoor maps this is excessive and reduces depth buffer precision, increasing risk of z-fighting. Set `camera.maxZ = 500` (sufficient for all current maps).

---

## Performance Investigation — Slowdown & Stutter Sources

This section documents all code identified as likely contributors to frame-rate drops or stuttering. Issues are ordered by estimated impact.

---

### P1. PowerUpSystem.ts — Rotating Meshes Dirtied Every Frame ⬜ STILL RELEVANT
**File:** `systems/PowerUpSystem.ts` (line ~100)

`p.mesh.rotation.y += 0.02 * (dt * 60)` — now frame-rate independent but still mutates `rotation` every frame, forcing a world matrix recompute per power-up orb per tick. A Babylon `Animation` would batch this.

---

### P2. InteractionSystem.ts — Pack-a-Punch Material Observer Leaks on Re-Pack ⬜ STILL RELEVANT
**File:** `systems/InteractionSystem.ts` (lines ~292–296)

`timeObs` is registered and only cleaned up via `papMat.onDisposeObservable`. If a weapon is re-packed (material replaced rather than disposed), the old `timeObs` is never removed. Each re-pack adds another `onBeforeRenderObservable` listener. `timeObs` needs to be stored and explicitly removed at the start of `performPackAPunch()`.

---

### P3. CommandRegistry.ts — Debug Pathfinding Allocates New Material Per Zombie ⬜ STILL RELEVANT
**File:** `engine/CommandRegistry.ts` (line ~263)

`new BABYLON.StandardMaterial("pathMat_" + z.id, sm.scene)` still creates one material per zombie for debug tube rendering. A single shared material should be created once and reused.

---

### P4. MapRegistry.ts — navmesh Debug Logging in Production ⬜ STILL RELEVANT (11 unconditional console calls confirmed)
**File:** `managers/MapRegistry.ts` (lines ~70–113)

11 unconditional `console.log` calls fire every time a navmesh is built or loaded. Each call serialises arguments and writes to the devtools buffer — measurable overhead during round transitions when the navmesh is rebuilt.

---

### P5. LevelBuilder.ts — onNewMeshAddedObservable Accumulates on Map Reload ⬜ STILL RELEVANT
**File:** `engine/LevelBuilder.ts` (lines ~157–161)

```typescript
this.scene.onNewMeshAddedObservable.add((mesh) => {
    if (this.shadowCasters.includes(mesh)) {
        shadowGenerator.addShadowCaster(mesh);
    }
});
```

Every call to `loadLevel()` registers a **new** observer on `scene.onNewMeshAddedObservable` without storing or removing the previous one. After N map reloads, N identical callbacks fire for every mesh added to the scene. Each callback also calls `this.shadowCasters.includes(mesh)` which is an O(n) linear scan. Fix: store the observer reference and call `.remove()` in `dispose()` / before re-registering. Better still, register shadow casters eagerly during level build and skip the lazy observer entirely.

---

### P6. PlayerMovementSystem.ts — Full Scene Raycast Every Frame for Ground Check ⬜ STILL RELEVANT
**File:** `systems/player/PlayerMovementSystem.ts` (lines ~163–167)

```typescript
const pick = camera.getScene().pickWithRay(_groundRay, (m) => m.checkCollisions && m.isEnabled());
```

A full scene ray cast runs every frame (60×/sec) to determine whether the player is grounded. The predicate `m.checkCollisions && m.isEnabled()` is evaluated against every mesh in the scene. Consider:
- Restricting the predicate to a known set of floor meshes stored at level load
- Using Babylon's built-in `camera._needMoveForGravity` / ellipsoid collision system instead of a manual raycast
- Or caching the last ground mesh and only re-testing it until the player leaves contact

---

### P7. ProjectileSystem.ts — getLightByName() O(n) Lookup Per Remote Shoot Event ⬜ STILL RELEVANT
**File:** `systems/ProjectileSystem.ts` (line ~163)

```typescript
const flash = scene.getLightByName("remoteMuzzleFlash") as BABYLON.PointLight;
```

`getLightByName()` does a linear string-match scan over all scene lights on every `REMOTE_SHOOT` event. Cache the reference once during system init (or in `ParticleManager`) and reuse it.

---

### P8. WeaponViewSystem.ts — Iterates All Weapon Meshes Every Frame ⬜ STILL RELEVANT
**File:** `systems/player/WeaponViewSystem.ts` (lines ~37–40)

```typescript
for (const key in ctx.gameState.weaponMeshes) {
    const m = ctx.gameState.weaponMeshes[key];
    if (m) m.setEnabled(false);
}
```

Every frame, all weapon meshes are disabled then the active one re-enabled. `for...in` enumerates all enumerable properties including inherited ones. Track the previously active weapon index and only toggle two meshes (disable previous, enable current) on weapon switch rather than scanning every frame.

---

### P9. ProjectileSystem.ts — Vector3 Allocations in Explosion Blast Direction ⬜ STILL RELEVANT
**File:** `systems/ProjectileSystem.ts` (line ~137)

```typescript
const blastDir = z.mesh.position.subtract(impactPoint).normalize();
```

`.subtract()` and `.normalize()` each return a new `Vector3`. This runs per zombie within the explosion radius — with 30+ nearby zombies, one grenade/explosive creates 60+ Vector3 allocations in a single frame. Use `subtractToRef` / `normalizeToRef` with a module-level scratch vector.

---

### P10. HellhoundManager.ts — Vector3 Allocations in Spawn Distance Check Loop ⬜ STILL RELEVANT
**File:** `managers/HellhoundManager.ts` (lines ~191–192)

```typescript
new BABYLON.Vector3(spawnPos.x, 0, spawnPos.z),
new BABYLON.Vector3(playerPos.x, 0, playerPos.z)
```

Two `new Vector3` allocations per iteration of the spawn attempt loop (up to 20 attempts per hellhound). Also `this.camera.position.clone()` (line ~151) and `remotePos.clone()` (line ~154) are called at the top of each spawn pass. That is up to 40+ allocations per hellhound spawn event. Pre-allocate module-level scratch vectors and use `.set()` / `copyFromFloats()`.

---

### P11. ZombieAISystem.ts — Math.sqrt() for Separation Force Normalization ⬜ STILL RELEVANT
**File:** `systems/zombie/ZombieAISystem.ts` (line ~176)

```typescript
const len = Math.sqrt(pushX * pushX + pushZ * pushZ);
```

Separation force normalization uses `Math.sqrt` even though only the normalised direction is needed. With a spatial grid limiting neighbors to ~8, this fires ~8 × zombie_count times per frame. If the separation grid already guarantees a minimum push distance, the length can be approximated or the division skipped when `len` is below a threshold.

---

### P12. ZombieAISystem.ts — console.warn() in Pathfinding Fallback Paths ⬜ STILL RELEVANT
**File:** `systems/zombie/ZombieAISystem.ts` (lines ~228, ~232, ~246)

`console.warn()` calls fire in pathfinding fallback branches. If a zombie strays from the navmesh (which happens more frequently in later rounds with many agents), these can fire many times per second. Console output flushes to DevTools and incurs measurable cost. Guard with a `DEV` flag or remove.

---

### P13. DecalManager.ts + GoreManager.ts — pickWithRay for Every Blood Decal ⬜ STILL RELEVANT
**Files:** `managers/visual/DecalManager.ts` (line ~91), `managers/visual/GoreManager.ts` (line ~107)

```typescript
const floorPick = this.scene.pickWithRay(DecalManager._floorRay, (m) => m.checkCollisions && m.isEnabled());
```

Every blood splatter casts a ray downward to find the exact floor Y position. With 10–15 blood particles per zombie kill, a kill event triggers 10–15 full scene raycasts in a single frame. Cache the floor mesh reference(s) at level load and restrict the predicate to those meshes only, or use the zombie's last known ground Y directly.

---

### P14. ZombieMeshFactory.ts — String includes() Mesh Child Search Per Zombie Creation ⬜ STILL RELEVANT
**File:** `meshes/ZombieMeshFactory.ts` (lines ~216–221, ~239–243)

```typescript
const head = instance.getChildMeshes().find(m => m.name.includes("zombie_head"))!;
const torso = instance.getChildMeshes().find(m => m.name.includes("zombie_body"))!;
```

`getChildMeshes()` rebuilds the child array each call and `String.includes()` is called on every child name. With ~50 zombies per round this fires on every spawn. Return child mesh references directly from the loader by index or tag rather than doing string matching.

---

### P15. Scene — No freezeActiveMeshes() for Static Level Geometry ⬜ STILL RELEVANT
**File:** `engine/LevelBuilder.ts` / `game/Game.ts`

Babylon.js re-evaluates active meshes (frustum culling pass) every frame. For static level geometry that never moves, calling `scene.freezeActiveMeshes()` after level load eliminates this per-frame CPU cost. Meshes that do move (zombies, projectiles, pickups) must be unfrozen or managed via `mesh.alwaysSelectAsActiveMesh`. This can be toggled around spawning events. Expected gain: 5–15% CPU render thread reduction on complex maps.
