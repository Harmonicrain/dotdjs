# Memory Leak Risks

Observer and handler accumulation bugs that grow over time, especially across level reloads.

---

## 1. GoreManager — Observer Survives reset()

**File**: `managers/visual/GoreManager.ts` ~lines 78, 153-168
**Issue**: `goreFadeObserver` is registered with `scene.onBeforeRenderObservable.add()` in `initGoreFadeObserver()`. The `dispose()` method removes it (~line 182), but `reset()` does NOT.
**Impact**: After `reset()`, the observer continues running every frame, iterating an empty `activeGoreDiscs` array. Wasted CPU per frame. Not a true leak but unnecessary work.
**Fix**: Either remove and re-add the observer in `reset()`, or make the observer gracefully no-op when arrays are empty (it may already, but should be explicit).

---

## 2. ParticleManager — Observer Survives reset()

**File**: `managers/visual/ParticleManager.ts` ~lines 120, 710-729
**Issue**: Same pattern as GoreManager. `flashLightFadeObserver` is added to scene (~line 120) and cleaned in `dispose()` (~line 733), but `reset()` doesn't touch it.
**Impact**: Observer runs every frame after reset, processing empty/cleared pools.
**Fix**: Same approach — clean observer in `reset()` or ensure it no-ops safely.

---

## 3. CommandRegistry — Pathfinding Observer Accumulation

**File**: `engine/CommandRegistry.ts` ~lines 173-273 (pathfinding visualization toggle)
**Issue**: Each time the user toggles pathfinding visualization ON, a new `observer` is created with `scene.onBeforeRenderObservable.add()` and stored in a local variable. Toggling OFF doesn't remove the previous observer — it just stops rendering.
**Impact**: Each toggle-on creates an additional observer. After 10 toggles, 10 observers are running.
**Fix**: Store the observer reference at module/closure scope and remove it before creating a new one.

---

## 4. GeometryUtils — Fixture Light Observer Orphaned

**File**: `engine/GeometryUtils.ts` ~lines 273-284
**Issue**: `createFixture()` creates a scene observer that monitors whether the fixture light is disposed. The observer is stored in a local `obs` variable with no external reference for cleanup.
**Impact**: If the fixture is disposed, the observer detects it and removes itself (self-cleanup). But if the scene is rebuilt without disposing the light first, the observer persists.
**Fix**: Return the observer as part of the fixture result, or register it for cleanup in a manager.

---

## 5. LevelBuilder — Shadow Caster Promise Race Condition

**File**: `engine/LevelBuilder.ts` ~lines 84-90
**Issue**: Shadow casters are added to the shadow generator after async promises resolve. If the scene is disposed during loading, the resolved promise still runs and references disposed objects.
**Impact**: Could throw errors or reference disposed meshes. Not a memory leak per se, but a resource safety issue.
**Fix**: Add a disposed check: `if (scene.isDisposed) return;` inside the promise callback.

---

## Priority

Item 3 (CommandRegistry) is the most impactful — it's the only one that actively accumulates without bound. Items 1-2 are minor performance issues. Items 4-5 are edge cases but worth hardening.
