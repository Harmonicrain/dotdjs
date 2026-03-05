# Refactoring Plan - DOM OF THE ROAD

Read `AGENTS.md` before starting. Do NOT break game logic, networking, or the separation of concerns (UI vs Engine). All changes must be safe, incremental, and preserve existing behavior. Do not add new features. Do not remove functionality. Focus only on simplifying, deduplicating, and cleaning up.

---

## BUGS — Controls, Camera & Logic

These are actual bugs or behavioral issues that affect gameplay, not just refactoring targets. Fix carefully.

### B1. InputManager.ts - Missing Tab Key Binding for WEAPON_NEXT ✅ DONE
**File:** `engine/InputManager.ts` (line ~91)

`WEAPON_NEXT` has an empty keyboard binding `{}` while `INPUT_PROMPTS` correctly shows Tab (line ~52). The Tab key for cycling weapons is **completely non-functional** on keyboard/mouse. Controller Y button still works.

### B2. WeaponViewSystem.ts - FOV Lerp is Frame-Rate Dependent ✅ DONE
**File:** `systems/WeaponViewSystem.ts` (line ~59)

```typescript
ctx.camera.fov = BABYLON.Scalar.Lerp(ctx.camera.fov, targetFov, 0.2);
```

The lerp factor `0.2` is applied per frame, not per second. At 120 FPS the ADS transition is twice as slow as at 60 FPS, and at 30 FPS it's twice as fast (jarring). Weapon position lerp on line ~58 has the same issue. Use `1 - Math.pow(1 - 0.2, dt * 60)` or similar frame-independent smoothing.

### B3. PlayerMovementSystem.ts - Recoil Application Fights Recovery Every Frame ✅ DONE (recoil system removed)
**File:** `systems/PlayerMovementSystem.ts`

The entire recoil system was removed from the codebase, eliminating this issue entirely. Recoil properties removed from WeaponConfig, StateManager, PlayerMovementSystem, and PlayerCombatSystem.

### B4. PlayerMovementSystem.ts - Mouse Look is Frame-Rate Dependent, Gamepad is Not ✅ VERIFIED OK + smoothing added
**File:** `systems/PlayerMovementSystem.ts`

Mouse look applies raw delta without `dt` — this is correct for raw mouse input since deltas are already frame-proportional. Camera smoothing (lerp-based interpolation with factor 0.65) was added to reduce micro-jitter while maintaining responsive feel.

### B5. ZombieDamageSystem.ts - Zombie Knockback Bypasses Movement System ✅ DONE
**File:** `systems/ZombieDamageSystem.ts`

Knockback now writes to `gameState.externalForce` instead of directly to `camera.cameraDirection`. PlayerMovementSystem applies and decays `externalForce` each frame, integrating knockback with normal movement physics.

### B6. DownedSystem / ReviveSystem - Asymmetric Camera Height Transition ✅ DONE
**Files:** `systems/DownedSystem.ts`, `systems/ReviveSystem.ts`

Camera now lerps smoothly in both directions using frame-rate independent lerp. DownedSystem handles the camera rise after revive by detecting when player is not downed but camera is below eye height. Removed instant snap from ReviveSystem.

### B7. GameLifecycle.ts - Camera Double-Reset on Spawn ✅ DONE
**File:** `game/GameLifecycle.ts`

Replaced setTimeout(50) with frame-synced observer that waits 3 render frames for physics to settle before finalizing spawn position. This prevents the camera jump caused by input being processed during the 50ms gap.

### B8. MysteryBoxSystem.ts - Stale Instance Reference After Relocation ✅ DONE
**File:** `systems/MysteryBoxSystem.ts`

BOX_RELOCATING case now fetches fresh instance after changing `activeLocationIndex`. Lid mesh rotation also uses current active instance instead of stale reference captured at start of update.

### B9. HellhoundManager.ts - Death Explosion Damage is a No-Op ✅ DONE
**File:** `managers/HellhoundManager.ts` (lines ~121-124)

```typescript
if (distToPlayer <= (hc.DEATH_EXPLOSION_RADIUS || 1.5)) {
    // TODO: Deal hc.DEATH_EXPLOSION_DAMAGE to local player via damage system
    console.log(`Player hit by hellhound explosion! ...`);
}
```

Players take zero damage from hellhound death explosions. This makes dog rounds easier than intended.

### B10. ProjectileSystem.ts - REMOTE_SHOOT Listener Never Unsubscribed ✅ DONE
**File:** `systems/ProjectileSystem.ts` (line ~122)

The system subscribes to `REMOTE_SHOOT` via `ctx.eventBus.on(...)` but has no `dispose()` method. If the system is recreated (e.g., level reload), duplicate listeners accumulate — each remote shot spawns multiple projectiles.

### B11. GameLoop.ts - Wheel/Keydown Listeners Never Cleaned Up ✅ DONE
**File:** `game/GameLoop.ts` (lines ~119-124)

`wheel` and `keydown` listeners are attached to canvas/window but never removed when the game loop is destroyed. On game restart, duplicate listeners stack up, causing double-processing of scroll and key events.

### B12. VisualManager.ts - Untracked onBeforeRenderObservable Observer ✅ DONE
**File:** `managers/VisualManager.ts` (line ~65)

The flash light fade observer is added to `scene.onBeforeRenderObservable` but the reference is never stored. The `dispose()` method cannot remove it. On VisualManager recreation, orphaned observers accumulate.

---

## Priority: CRITICAL

### 1. MapBuilder.ts - Massive Duplication Between createPreviewMesh() and createPlacedMesh() ✅ DONE
**File:** `engine/MapBuilder.ts`

Extracted shared `createEntityMesh(entity, scene)` method that creates meshes based on a static `ENTITY_DIMENSIONS` config object. Both `createPreviewMesh()` and `createPlacedMesh()` now call this shared method and only differ in material/alpha settings.

### 2. types/world.ts - Duplicate Interface Definition ✅ DONE
**File:** `types/world.ts`

Removed duplicate `PowerSwitchDefinition` interface (was defined twice with identical properties).

### 3. ZombieAISystem.ts - 445-line update() Function ✅ DONE
**File:** `systems/ZombieAISystem.ts`

Extracted into focused helper functions:
- `updateBurningDamage(z, now, ctx)` - burning damage tick
- `computeSeparationForce(z, zombies, separationDist)` - boid separation
- `computeNavPath(z, targetPos, dt, ctx)` - shared navmesh pathfinding
- `applyRotationSmoothing(z, moveDir, frameFactor)` - rotation lerp
- `getTargetPosition(z, ctx, targetPosOut)` - host/client target selection
- `updateHellhoundAI(z, dt, separation, frameFactor)` - hellhound state machine
- `updateSoloDownedWander(z, dt, now, separation, frameFactor)` - wander behavior
- `updateZombieChase(z, dt, separation, frameFactor)` - chase behavior
- `updateWindowInteraction(z, dt, now, separation, frameFactor)` - barrier states

Also added pre-allocated scratch vectors to reduce per-frame allocations.

### 4. LevelBuilder.ts - 246-line buildInteractables() ✅ DONE
**File:** `engine/LevelBuilder.ts`

Split into focused sub-methods:
- `buildDoors(doors)`
- `buildWindows(windows)`
- `buildPerks(perks, def)`
- `buildWallbuys(wallbuys)`
- `buildBuildings(buildings)`
- `buildPowerSwitch(powerSwitch, def)`
- `buildPackAPunch(packAPunch, def)`
- `buildMysteryBoxes(mysteryBoxes)`
- `getWallbuyDrawer(weapon)` - returns canvas drawer function

Also extracted `createPBRMaterialWithTexture()` helper to eliminate PBR material creation duplication.

---

## Priority: HIGH

### 5. Game.ts - resetSession() is 87 Lines ✅ DONE
**File:** `game/Game.ts` (lines ~370-457)

Split into focused private methods: `_clearZombies()`, `_clearPowerUps()`, `_clearProjectiles()`, `_resetWeaponMaterials()`, `_resetVisualAndTimers()`, `_resetGameStateFlags()`, `_resetMysteryBox()`.

### 6. Game.ts - Duplicated Sound Loading Pattern ✅ DONE
**File:** `game/Game.ts` (lines ~470-484)

Replaced five repetitive `loadSound().catch()` calls with data-driven `soundsToLoad` array and loop.

### 7. GameLifecycle.ts - start() is 163 Lines + Duplicated Weapon Setup
**File:** `game/GameLifecycle.ts` (lines ~103-266)

Extract:
- `_waitForTexturesReady(timeout)` - the polling/timeout logic at lines ~141-156
- `_resetToPistol()` - weapon initialization is duplicated between `start()` (lines ~218-232) and `_respawnPlayer()` (lines ~323-333)
- `_activateWeapon(weaponIndex)` - mesh enable/disable pattern duplicated at lines ~238-245 and ~334

### 8. HellhoundManager + VisualManager - Cross-File Smoke Effect Duplication ✅ DONE
**Files:** `managers/HellhoundManager.ts` (lines ~241-275) and `managers/VisualManager.ts` (lines ~473-505)

Removed duplicate `createHellhoundSpawnSmoke()` from HellhoundManager. Now uses injected `VisualManager.createSpawnSmokeEffect()`.

### 9. VisualManager.ts - Duplicate Explosion Functions ✅ DONE
**File:** `managers/VisualManager.ts` (lines ~133-278)

Extracted shared `createExplosionChunks(pos, config)` helper with `ExplosionChunkConfig` interface. Both `createZombieExplosion()` and `createHeadExplosion()` now use this shared helper with different configs.

### 10. VisualManager.ts - Observer Memory Leak Risk ✅ DONE
**File:** `managers/VisualManager.ts` (lines ~166-184, ~232-246)

Added 10-second max-lifetime timeout to explosion chunk observers to guarantee cleanup even if chunks never hit the floor.

### 11. NetworkMessageHandler.ts - Massive Repetitive Field Assignment ✅ DONE
**File:** `network/NetworkMessageHandler.ts` (lines ~236-257 and ~345-355)

Extracted `mergeIfDefined(target, source, fields[])` helper. Both STATE and INPUT handlers now use this helper instead of 22+ individual if-checks.

### 12. NetworkMessageHandler.ts - Duplicated Remote Position + State Sync ✅ DONE
**File:** `network/NetworkMessageHandler.ts` (lines ~293-301 / ~357-365 and ~314-318 / ~377-381)

Extracted `syncRemotePosition(sm, pos)` and `syncRemoteGameState(sm, health, isDowned, kills, shots, perks)` helpers. Both STATE and INPUT handlers now use these shared functions.

### 13. MapBuilder.ts - 207-line update() Method
**File:** `engine/MapBuilder.ts` (lines ~376-583)

Split into:
- `updateKeyboardInput()`
- `updateFireInput()`
- `updatePreviewUI()`

Also, the `getPreviewProps()` switch at lines ~428-510 (82 lines) should be replaced with a config object mapping EntityType to default dimensions.

The repeated position-update code at lines ~607-621 should be extracted to `updateEntityPosition(entity)`.

### 14. Pathfinder.ts - Inefficient Linear Open List Search ✅ DONE
**File:** `engine/Pathfinder.ts` (lines ~48-53)

The A* open list uses linear search to find the minimum f-value node (O(n) per iteration). Replace with a binary heap / priority queue for O(log n) performance.

### 15. PlayerCombatSystem.ts - Vector3 Allocations Per Shot
**File:** `systems/PlayerCombatSystem.ts` (lines ~141-168)

Multiple `new Vector3` / `.clone()` / `.subtract()` / `.add()` calls per shot. Pre-allocate scratch vectors at module scope and use `...ToRef()` methods to avoid garbage:
- `muzzlePos = ctx.camera.position.clone()` -> use a pre-allocated `_tempMuzzlePos`
- `targetPos = ctx.camera.position.add(forward.scale(targetDist))` -> use `addToRef` with scratch
- `const camToMuzzle = muzzlePos.subtract(...)` -> use `subtractToRef`

### 16. ZombieAISystem.ts - Vector3 Allocations in Hot Loop
**File:** `systems/ZombieAISystem.ts` (lines ~127-225)

These run per zombie per frame:
- `const separation = BABYLON.Vector3.Zero();` - allocates every frame per zombie
- `z.mesh.position.subtract(other.mesh.position).normalize()` - allocates per pair
- `camera.position.clone()` - allocates per zombie

Pre-allocate scratch vectors and use `subtractToRef()`, `normalizeToRef()`, `copyFrom()` patterns.

---

## Priority: MEDIUM

### 17. MapConfigManager.ts - Duplicated Config Initialization
**File:** `managers/MapConfigManager.ts` (lines ~14-27 and ~69-83)

Constructor and `resetToDefaults()` both have 12 identical spread-copy lines. Extract a shared `_resetAllConfigs()` private method and call from both.

### 18. MapConfigManager.ts - applyMapConfig() Nested Conditionals
**File:** `managers/MapConfigManager.ts` (lines ~32-64)

9 separate `if (mc.X) Object.assign(this.X, mc.X)` checks. Extract an `assignConfigIfPresent(target, source)` helper and call in a loop or chain.

### 19. NetworkDeltaCompressor.ts - Duplicated Comparison Functions
**File:** `network/NetworkDeltaCompressor.ts` (lines ~70-99)

`perksChanged()`, `doorsChanged()`, `windowsChanged()` have nearly identical logic (compare record keys + values). Extract a generic `recordChanged<T>(a, b, compareFn?)` helper.

### 20. InputManager.ts - Duplicated Device Switching + Deadzone Logic
**File:** `engine/InputManager.ts`

- Device switching logic at lines ~202-211, ~274-275, ~288-290 is repeated. Extract `clearNonActiveDeviceState(device)`.
- Deadzone application at lines ~578-588 is duplicated for X and Y axes. Extract `applyDeadzoneAndSensitivity(raw, threshold, sensitivity)`.
- Pointer lock conditionals at lines ~342-351 are convoluted and overlapping. Simplify with boolean algebra.

### 21. GameLoop.ts - 181-line createGameLoop + Duplicated Scale UI Updates
**File:** `game/GameLoop.ts` (lines ~35-216)

- Extract wheel handler and keydown handler for scale-weapon mode into separate functions.
- The scale UI update at lines ~65-70 and ~110-115 is identical - extract to `updateScaleWeaponUI(sm, mode)`.
- The axis key mapping switch at lines ~79-105 should use a mapping object instead.

### 22. InteractionSystem.ts - Two Nearly Identical Door Animation Functions ✅ DONE
**File:** `systems/InteractionSystem.ts` (lines ~46-89)

Merged `animateDoorMesh()` and `animatePowerDoor()` into single parameterized `animateDoorMeshToY(mesh, targetY, trackObserver, doorId)` function.

### 23. InteractionSystem.ts - performPackAPunch() is 171 Lines ✅ DONE
**File:** `systems/InteractionSystem.ts` (lines ~119-290)

Split into:
- `setupPackAPunchAnimation()`
- `applyPackAPunchUpgrade(weapon)`
- `createPackAPunchTexture(weapon)`

### 24. MysteryBoxSystem.ts - 170-line Switch Statement ✅ DONE
**File:** `systems/MysteryBoxSystem.ts` (lines ~74-244)

Extracted each state case into focused methods: `handleBoxIdle()`, `handleBoxOpening()`, `handleBoxRolling()`, `handleBoxWeaponPresent()`, `handleBoxClosing()`, `handleBoxTeddyReveal()`, `handleBoxTeddyWait()`, `handleBoxTeleportOut()`, `handleBoxRelocating()`. Also extracted `updateWeaponDisplay()` and `updateGlow()` helpers.

### 25. ProjectileSystem.ts - 165-line update() with Deep Nesting
**File:** `systems/ProjectileSystem.ts` (lines ~174-339)

Extract:
- `handleProjectileCollision(proj, hit)`
- `handleZombieHit(proj, zombie)`
- `handleEnvironmentHit(proj, pickInfo)`

### 26. useMultiplayer.ts - 307-line Hook
**File:** `network/useMultiplayer.ts` (lines ~10-316)

Consider splitting into smaller hooks:
- `usePeerHost()` - host initialization
- `usePeerClient()` - client initialization
- `useHeartbeat()` - heartbeat management

~~Also, line ~144 has an overly long OR chain for error types. Extract to a `BENIGN_NETWORK_ERRORS` constant array and use `.includes()`.~~ ✅ DONE - Extracted `BENIGN_NETWORK_ERRORS` constant.

### 27. ZombieManager.ts + HellhoundManager.ts - Overlapping Death Handlers
**Files:** `managers/ZombieManager.ts` (lines ~93-119) and `managers/HellhoundManager.ts` (lines ~73-114)

Both have nearly identical `onDeath()` logic: increment kills, emit events, handle power-up drops, create explosions. Extract a shared `handleEnemyDeath(enemy, pos, killer, callbacks)` utility.

### 28. ZombieManager.ts - 92-line Deeply Nested Spawn Function
**File:** `managers/ZombieManager.ts` (lines ~121-213)

Extract:
- `getAccessibleSpawnWindows()` - zone/window filtering
- `tryPlaySpawnSound(pos)` - sound cooldown logic
- `createZombieEntity(spawnPos, window, round)` - entity creation

### 29. CommandRegistry.ts - 100-line show_pathfinding Command
**File:** `engine/CommandRegistry.ts` (lines ~173-273)

Extract the pathfinding visualization observer into a separate `PathfindingDebugger` class or utility function. Also, each zombie creates a new material for its debug tube - reuse a single shared material.

### 30. GeometryUtils.ts - Triple-Duplicated Texture Dirty Pattern ✅ DONE
**File:** `engine/GeometryUtils.ts` (lines ~40-46, ~164-168, ~177-180)

Extracted `markMaterialDirtyOnLoad(mat, tex)` helper function. Used by `createMaterial()` and available for other call sites.

### 31. Game.ts - Dead Shadow Generator Code ✅ DONE
**File:** `game/Game.ts` (lines ~505-507)

Fixed dead code: shadow generators are now properly disposed using `forEach` loop with `sg?.dispose()`.

### 32. GameEngine.ts - Convoluted Remote Projectile Count ✅ DONE
**File:** `game/GameEngine.ts` (lines ~91-98)

Replaced manual for-loop with `this.activeProjectiles.filter(p => p.isRemote).length > 50`.

### 33. EventBus.ts - No Cleanup Method for Session Resets ✅ DONE
**File:** `engine/EventBus.ts`

Added `clear()` method to remove all handlers and `clearEvent(event)` to remove handlers for a specific event type.

### 34. InteractionSystem.ts - PAP Material Observer Relies on Dispose
**File:** `systems/InteractionSystem.ts` (lines ~265-269)

The pulsing emissive observer on Pack-a-Punch materials is cleaned up via `papMat.onDisposeObservable`. If materials are reassigned rather than explicitly disposed, the observer persists indefinitely. Each Pack-a-Punch creates a new observer, so re-packing a weapon leaks the old one.

---

## Priority: LOW

### 35. StateManager.ts - null! Assertions
**File:** `state/StateManager.ts` (lines ~98-108)

Five properties use `null!` non-null assertion without initialization guarantees. Consider making them properly nullable or initializing in constructor.

### 36. maps/MapTextureResolver.ts - Dead registerMapFolder() Function
**File:** `maps/MapTextureResolver.ts` (line ~19)

`registerMapFolder()` is a no-op stub kept for "call-site compatibility." Find and remove all call sites, then delete the function.

### 37. ZombieDamageSystem.ts + ZombieAISystem.ts - Math.sqrt for Distance Comparisons
**Files:** `systems/ZombieDamageSystem.ts` (line ~32), `systems/ZombieAISystem.ts` (line ~74)

Uses `Math.sqrt(Math.pow(...))` for distance comparisons where only relative ordering matters. Use squared distance instead and compare against squared thresholds.

### 38. GameEngine.ts - Projectile Pool Reset Fields
**File:** `game/GameEngine.ts` (lines ~56-61)

Resetting fields to `undefined` during pool return. Consider resetting to typed defaults (`false`, `0`, `1`) instead for type safety.

### 39. MapRegistry.ts - Excessive Console Logging
**File:** `managers/MapRegistry.ts` (lines ~70-113)

13 lines of navmesh debug logging in production code. Wrap in a `DEV` environment check or use a configurable log level.

### 40. UIBridge.ts - Cache Update Before Throttle Check
**File:** `state/UIBridge.ts` (lines ~58-66)

`setPoints()` updates `uiCache.points` before checking the throttle condition, which means the delta check on the next call will always be 0. Move cache update to after the condition passes.

### 41. ZombieAISystem.ts - Unused Scratch Vector
**File:** `systems/ZombieAISystem.ts` (line ~50)

`_tempTargetVec` is allocated but never used anywhere in the file. Only `_tempNavStartVec` and `_tempNavEndVec` are used (at lines ~194-195, ~385-386). Remove it.

### 42. Game.ts - camera.speed is Dead Code
**File:** `game/Game.ts` (line ~129)

`camera.speed` is set to `GAME_CONFIG.WALK_SPEED` but PlayerMovementSystem drives movement entirely via `camera.cameraDirection` — Babylon's built-in `camera.speed` property is never consulted. Remove the assignment to avoid confusion.

### 43. Game.ts - Missing maxZ (Far Plane)
**File:** `game/Game.ts` (line ~131)

Only `camera.minZ = 0.1` is set; `maxZ` defaults to Babylon's 10,000 units. For indoor maps this is excessive and reduces depth buffer precision, increasing risk of z-fighting. Set `camera.maxZ = 500` (sufficient for all current maps).

### 44. Barn Map - Missing navFloors Definition
**File:** `maps/barn/mapDefinition.ts`

Only warehouse defines `navFloors` for navmesh generation. The field is optional in the type, but if barn uses zombie pathfinding, missing navFloors may cause broken or missing nav meshes. Verify whether pathfinding works on barn and add navFloors if needed.

---

## Performance Investigation — Slowdown & Stutter Sources

This section documents all code identified as likely contributors to frame-rate drops or stuttering. Issues are ordered by estimated impact. Many relate to per-frame allocations that trigger garbage collection pauses, or O(n) operations in hot paths.

---

### P1. GameEngine.ts — Remote Projectile Count Uses `.filter()` in Hot Path
**File:** `game/GameEngine.ts` (line ~134)

```typescript
if (isRemote && this.activeProjectiles.filter(p => p.isRemote).length > 50) {
```

Item 32 replaced a manual loop with `.filter()`, but `.filter()` still allocates a new array every call. This runs on every remote projectile spawn. Replace with a maintained `remoteProjectileCount` integer that is incremented on spawn and decremented on recycle.

---

### P2. ZombieAISystem.ts — Per-Frame Vector Allocations in Path Following ✅ DONE
**File:** `systems/ZombieAISystem.ts` (line ~180)

```typescript
const dir = z.path[0].subtract(z.mesh.position).normalize();
```

`.subtract()` and `.normalize()` each allocate a new `Vector3`. This runs every frame for every zombie following a path. With 100 zombies all path-following, that is 200+ allocations per frame from this line alone. Replace with `subtractToRef` / `normalizeToRef` using pre-allocated scratch vectors (a pair per zombie or module-level scratch vectors guarded by sequential use).

---

### P3. ZombieAISystem.ts — Wander Target Allocates New Vector3 Each Wander Tick ✅ DONE
**File:** `systems/ZombieAISystem.ts` (lines ~401–405)

```typescript
z.wander.wanderTarget = new BABYLON.Vector3(...);
```

A fresh `Vector3` is created every time a zombie picks a new wander target. Reuse a pooled vector per zombie or assign component values into an existing `wanderTarget` vector using `.set()` / `copyFromFloats()`.

---

### P4. PlayerCombatSystem.ts — Multiple Vector3 Allocations Per Pellet Per Shot ✅ DONE
**File:** `systems/PlayerCombatSystem.ts` (lines ~141–228)

The firing path clones and allocates several vectors per shot, and the shotgun pellet loop (up to 8 pellets) calls `baseDir.clone()` per pellet:

```typescript
const spreadDir = baseDir.clone(); // × 8 pellets per shotgun shot
```

At a fast fire rate (10 shots/sec × 8 pellets) this is 80+ `Vector3` allocations per second from the spread loop alone. Pre-allocate `_muzzlePos`, `_targetPos`, `_camToMuzzle`, `_spreadDir`, and `_pelletDir` at module scope. Use `addToRef`, `subtractToRef`, `scaleToRef`, and `normalizeToRef` throughout. (Item 15 covers this but has not been implemented yet.)

---

### P5. RemotePlayerSystem.ts — `Vector3.Lerp()` Allocates Every Frame ✅ DONE
**File:** `systems/RemotePlayerSystem.ts` (lines ~51–55)

```typescript
mesh.position = BABYLON.Vector3.Lerp(mesh.position, target, t);
```

`Vector3.Lerp` returns a new `Vector3` every call and then immediately writes it to `mesh.position`. Replace with `BABYLON.Vector3.LerpToRef(mesh.position, target, t, mesh.position)` to update in-place with zero allocation.

---

### P6. PowerUpSystem.ts — Rotating Meshes Dirtied Every Frame
**File:** `systems/PowerUpSystem.ts` (line ~89)

```typescript
p.mesh.rotation.y += 0.02;
```

Mutating `mesh.rotation` every frame forces Babylon to recompute the world matrix for that mesh on every tick. For static-geometry power-up orbs, use a Babylon `Animation` or an `AnimationGroup` driven by the engine's animation system, which is batch-processed and avoids per-frame world matrix invalidation.

---

### P7. PowerUpSystem.ts — Pending Power-Up Lookup is O(n)
**File:** `systems/PowerUpSystem.ts` (lines ~44–59)

```typescript
gameState.powerUps.find(p => p.id === pending.id)
```

For each item in `pendingPowerUps`, the code scans the entire `powerUps` array. As both lists grow this becomes quadratic. Replace with a `Set<string>` of active power-up IDs that is kept in sync with `gameState.powerUps`, enabling O(1) membership checks.

---

### P8. ZombieManager.ts — Window List Filtered on Every Zombie Spawn
**File:** `managers/ZombieManager.ts` (line ~144)

```typescript
this.windows.filter(w => accessibleZones.has(w.zone))
```

This creates a new filtered array each time a zombie is spawned. During intense rounds with rapid spawning this runs tens of times per second. Pre-compute and cache a `windowsByZone: Map<string, WindowDefinition[]>` structure when zones change, and look up the relevant subset directly.

---

### P9. ProjectileSystem.ts — 2–3 Scene Raycasts Per Active Projectile Per Frame
**File:** `systems/ProjectileSystem.ts` (lines ~224–410)

Each active projectile calls `scene.pickWithRay()` two to three times per frame (zombie hit, environment hit, sometimes a secondary confirmation cast). Babylon's `pickWithRay` tests against the full scene hierarchy by default. With 50 concurrent projectiles that is up to 150 raycasts per frame. Mitigations in increasing effort:
- Pass a predicate to `pickWithRay` to exclude meshes that projectiles cannot interact with (UI planes, decorative geometry, the player mesh).
- Consolidate the zombie and environment picks into a single cast with a layered predicate.
- Consider lowering `MAX_REMOTE_PROJECTILES` and `MAX_LOCAL_PROJECTILES` further to cap worst-case cost.

---

### P10. NetworkDeltaCompressor.ts — Full State Comparison on Every Network Tick
**File:** `network/NetworkDeltaCompressor.ts` (lines ~75–117)

`doorsChanged()`, `perksChanged()`, `windowsChanged()`, and `powerUpsChanged()` each iterate all keys in their respective records or arrays every 50 ms (20 Hz tick). With 20 doors, 10 perks, and 5 windows that is ~35 key comparisons per tick, 700 per second, before zombie position comparisons are included. Introduce dirty-flag tracking: mark state records dirty when mutations occur and skip the comparison entirely when no dirty flag is set.

---

### P11. InteractionSystem.ts — Pack-a-Punch Material Observer Leaks on Re-Pack
**File:** `systems/InteractionSystem.ts` (lines ~265–269)

The pulsing emissive observer on PAP materials is registered on `papMat.onDisposeObservable` for cleanup. If `performPackAPunch()` is called on a weapon that is already Pack-a-Punched (or if the material reference is replaced rather than disposed), the old observer is never removed. Each re-pack adds another `onBeforeRenderObservable` listener. Store the observer reference explicitly and call `.remove()` on it at the start of `performPackAPunch()` before registering a new one. (Also noted in item 34.)

---

### P12. ZombieAISystem.ts — `getHorizontalDist()` Allocates in Window Interaction Hot Path
**File:** `systems/ZombieAISystem.ts` (lines ~491–537, helper at ~52–56)

`getHorizontalDist(a, b)` calls `a.subtract(b)` which allocates a temporary vector, then takes the length of the XZ components. This is called multiple times per zombie per frame during window-approach behaviour. Replace with an inline squared-distance check on X and Z components only (no vector allocation, no `Math.sqrt`), then only call the allocating version when an actual distance value is needed (e.g., for animation blending).

---

### P13. CommandRegistry.ts — Debug Pathfinding Allocates New Material Per Zombie
**File:** `engine/CommandRegistry.ts` (lines ~173–273)

The `show_pathfinding` debug command creates a new `StandardMaterial` per zombie for its tube mesh. With 100 zombies that is 100 extra material objects alive simultaneously. Create a single shared `StandardMaterial` for all debug tubes and reuse it. This does not affect production performance but avoids confusion when profiling since extra materials inflate draw-call counts in the Babylon inspector.

---

### P14. MapRegistry.ts — 13 Lines of navmesh Debug Logging in Production
**File:** `managers/MapRegistry.ts` (lines ~70–113)

Thirteen `console.log` / `console.warn` calls run unconditionally during navmesh construction. String formatting and `console` I/O are surprisingly expensive when the renderer is already under load (navmesh baking occurs during level load). Gate these behind a `DEBUG` / `DEV` constant or a configurable log-level flag. (Also noted in item 39.)
