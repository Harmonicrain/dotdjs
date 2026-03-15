# Memory Leaks & Resource Disposal

> Observer leaks, EventBus handler accumulation, and Babylon.js resources not properly cleaned up. These cause degradation across level reloads and long play sessions.

---

## FIXED

### `systems/InteractionSystem.ts` — PaP animation observer leak
**Was**: `animObs` (scene render observer) and `animMesh` for the Pack-a-Punch weapon spin animation were only cleaned up by a 3s TimerManager schedule. If `timerManager.clear()` ran during `resetSession()` before the timer fired, the observer and mesh leaked.
**Fix**: Stored `activePapAnimObs` and `activePapAnimMesh` at closure scope. Added `cleanupPapAnimation()` helper called both by the timer AND by `dispose()`. Also cleans up any in-progress animation before starting a new one.

### `systems/zombie/ZombieSyncSystem.ts` ~line 51 — Inconsistent `dispose(false)`
**Was**: `z.fireSystem.dispose()` called without `false`, risking disposal of the shared fire texture.
**Fix**: Changed to `z.fireSystem.dispose(false)` to match the pattern used everywhere else (ZombieCleanupSystem lines 57, 77).

### `managers/ResourceManager.ts` — Missing `reset()`
**Was**: No `reset()` method, breaking the manager lifecycle contract from AGENTS.md.
**Fix**: Added no-op `reset()` with documentation explaining the cache intentionally persists across game sessions.

### `managers/SoundManager.ts` — Missing `reset()` and `dispose()`
**Was**: Had `stopAll()` but no formal lifecycle methods.
**Fix**: Added `reset()` (delegates to `stopAll()`) and `dispose()` (stops all, disposes Sound instances, clears maps).

### `systems/player/DownedSystem.ts` — Missing `dispose()` scaffold
**Was**: No `dispose()` method. Currently safe but future EventBus additions would lack the pattern.
**Fix**: Added empty `dispose()` scaffold with comment.

---

## Verified Not Leaking (false positives from initial analysis)

### `systems/NetworkSystem.ts` — EventBus handlers
**Status**: Already correct. `dispose()` at lines 186-190 properly calls `off()` for all three handlers (`gameStartedHandler`, `boardStateChangeHandler`, `doorOpenRequestHandler`). Named handler references are stored before subscription.

### `systems/InteractionSystem.ts` — PaP texture observer (createPackAPunchTexture)
**Status**: Already correct. The render observer that scrolls the PaP camo texture UV offsets is cleaned up via `dynamicTexture.onDisposeObservable`. This is the correct Babylon.js pattern — when the texture is disposed (during `_resetWeaponMaterials()` in `resetSession()`), the observer is automatically removed.

### `systems/InteractionSystem.ts` — PaP material emissive `timeObs`
**Status**: Already correct. The observer is cleaned up when `newPapMats[0]` is disposed. Comment at line 347 explains: materials are all disposed together when the weapon is swapped or re-packed, so hooking the first material is sufficient.

### `managers/visual/GoreManager.ts` — Observer nullification
**Status**: Already correct. Line 177 sets `item.observer = null` after removing from the observable. The initial analysis was wrong.
