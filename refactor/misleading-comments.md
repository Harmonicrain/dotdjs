# Misleading Comments

> Comments that don't match the code they describe. These are especially dangerous for LLMs — we trust comments as ground truth when reasoning about code, and incorrect comments lead to incorrect implementations.

---

## Actively Wrong

### `managers/HellhoundManager.ts` ~line 256-257
```typescript
// Intentional: hellhounds use a flat speed (no round scaling).
```
**Reality**: A `speedVariation` factor IS applied at line 260, so the speed is NOT flat. The comment should say something like:
```typescript
// Hellhounds use a base speed with random variation, but no round-based scaling.
```

### `game/Game.ts` ~line 82
```typescript
// Suppress audio context warnings during engine creation
originalWarn(msg, args);  // passes args as array, not spread
```
**Reality**: The suppression function has a bug where non-suppressed warnings are forwarded incorrectly (`args` as a single array argument instead of `...args`). The comment describes the intent but hides the bug.

### `engine/LevelBuilder.ts` ~line 269-270
```typescript
// Temp array
const shadowCasters: BABYLON.AbstractMesh[] = [];
const navMeshes: BABYLON.Mesh[] = [];
```
**Reality**: These arrays are built up across the entire level build process and passed to downstream systems. They are not temporary — they persist for the lifetime of the level. Better:
```typescript
// Accumulated during level build, passed to shadow/nav systems
```

---

## Incomplete / Misleading

### `managers/ZombieManager.ts` ~line 307
```typescript
// Treat as window/default so it doesn't start underground
```
**Reality**: This is a fallback case for when spawn type is unknown, not specifically "treat as window". The comment implies intentional window-like behavior when it's actually a safety default.
```typescript
// Fallback: use above-ground spawn position for unknown spawn types
```

### `systems/zombie/ZombieAnimationSystem.ts` ~line 178
```typescript
// Head is parented to torso, so no manual update needed if parenting works
```
**Reality**: This comment exists next to a conditional check that does nothing. It should either explain WHY the check exists (defensive guard) or be removed along with the dead branch.

### `systems/player/PlayerCombatSystem.ts` ~line 93
```typescript
// Ideally we should have names in metadata
```
**Reality**: This TODO-style comment provides no context about what "names in metadata" means or why it would be better. An LLM reading this will wonder if it's an active TODO or a resolved note. Rewrite as:
```typescript
// Reload animation is selected by index rather than name — fragile if animation order changes
```

### `game/Game.ts` ~lines 513-515
```typescript
// Dispose the cloned PaP material to release memory and remove observers
```
**Reality**: At this point `papMat` refers to the PREVIOUS material (before reassignment), not necessarily a "cloned PaP material". The comment should clarify the sequencing.

---

## Refactoring Strategy

1. **Fix factually wrong comments first** — HellhoundManager speed, LevelBuilder "temp array"
2. **Clarify incomplete comments** — add context to TODOs or convert to proper issue tracking
3. **Remove comments that restate the obvious** — focus on WHY, not WHAT
