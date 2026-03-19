# Memory Leaks & Resource Cleanup

Specific places where GPU resources, observers, or JS objects can accumulate across rounds or level reloads.

---

## 1. CommandRegistry — pathfinding debug materials leak

**File:** `engine/CommandRegistry.ts` ~lines 270-274

Each frame when `show_pathfinding` is active, a `new BABYLON.StandardMaterial("pathMat_" + z.id, ...)` is created per path tube. The tubes are stored and disposed on the next frame, but disposing a mesh does NOT automatically dispose its material. Materials accumulate in the scene.

**Fix:** Either reuse a single shared material for all path tubes, or explicitly dispose the material before the mesh:
```ts
tube.material?.dispose();
tube.dispose();
```

---

## 2. PowerUpFactory — orphaned HighlightLayer

**File:** `factories/gameplay/PowerUpFactory.ts` ~line 28

A `HighlightLayer` is created but the reference is lost immediately. The layer lives in the Babylon.js scene graph indefinitely with no way to dispose it.

**Fix:** Either store and use the reference, or remove the creation.

---

## 3. LevelBuilder — fixture light observer lifecycle

**File:** `engine/LevelBuilder.ts` ~lines 259-266

An observer is added to `scene.onBeforeRenderObservable` for fixture light flickering. Cleanup relies on `light.onDisposeObservable.addOnce()`. But if the scene is disposed before the light (e.g., during a hard level reload), the scene observer is never removed.

**Fix:** Store the observer reference and remove it in the level teardown path, not just light disposal.

---

## 4. GameEngine — intermediate meshes after merge

**File:** `game/GameEngine.ts` ~lines 34-52

Projectile mesh creation uses `Mesh.MergeMeshes([body, tip])`. If the merge succeeds, Babylon.js handles the source meshes. But if `merge()` returns `null` (line 52 fallback), the `body` and `tip` meshes from lines 34-45 are abandoned in the scene — neither disposed nor returned.

**Fix:** Explicitly dispose `body` and `tip` in the fallback path.

---

## 5. RemotePlayerFactory — materials per spawn

**File:** `factories/RemotePlayerFactory.ts` ~lines 7-21

Four materials (skinMat, shirtMat, pantsMat, hairMat) are created every time a remote player spawns. If players reconnect frequently, materials accumulate.

**Fix:** Cache these in ResourceManager or create them once and clone as needed.

---

## 6. MysteryBoxFactory — unregistered materials

**File:** `factories/mysterybox/MysteryBoxFactory.ts` ~lines 10-113

Six materials (furMat, woodMat, metalMat, glowMat, beamMat, gpMat) are created directly without ResourceManager registration. They persist permanently and are never cleaned up.

**Fix:** Register through ResourceManager or cache at module level with explicit disposal in level teardown.

---

## 7. GoreManager — reset() vs dispose() observer gap

**File:** `managers/visual/GoreManager.ts` ~lines 155-181

`reset()` clears gore pieces but doesn't remove the `goreFadeObserver`. Only `dispose()` does. Since `reset()` is called between games, the observer accumulates if the manager is reused without a full `dispose()` cycle.

**Fix:** Move observer removal to `reset()`, or make the observer idempotent with an early-exit when no items exist (which it may already do — verify).

---

## 8. ParticleManager — explosionQueueObserver survives reset()

**File:** `managers/visual/ParticleManager.ts` ~lines 109, 676-693

`reset()` stops and resets particle systems but doesn't remove `explosionQueueObserver`. If `reset()` is called without `dispose()`, the observer stays attached and continues firing.

**Fix:** Remove and re-add the observer in `reset()`, or guard the callback with a "reset" flag.

---

## 9. DecalManager — decalMat not cleaned in reset()

**File:** `managers/visual/DecalManager.ts` ~line 34

The `decalMat` material is cached in ResourceManager but never explicitly handled in `reset()` or `dispose()`. If the material's backing texture is released, the material becomes a dangling reference.

**Fix:** Verify ResourceManager handles this, or add explicit cleanup.

---

## 10. RemotePlayerState — InterpolationBuffer accumulation

**File:** `state/RemotePlayerState.ts` ~line 30

`InterpolationBuffer` is created but never disposed. If `RemotePlayerState` objects are recreated on reconnects, old buffers aren't cleaned up.

**Fix:** Add a `dispose()` method to RemotePlayerState that clears the buffer.
