# Type Safety Issues

Places where TypeScript's type system is bypassed or underused, creating runtime risk and LLM confusion.

---

## 1. `any` types in world.ts — 4 instances

**File:** `types/world.ts`

| Line | Field | Current | Better |
|------|-------|---------|--------|
| ~26 | `InteractableMetadata.data` | `data?: any` | Discriminated union based on `type` field |
| ~246 | `DebugInfo.metadata` | `metadata?: any` | `Record<string, string \| number \| boolean>` |
| ~257 | `DoorMeshEntry.obstacle` | `obstacle?: any` | Recast TileCacheObstacle type or opaque branded type |
| ~308 | `MapDefinition.navmeshParameters` | `navmeshParameters?: any` | `Partial<RecastConfig>` matching @recast-navigation types |

These are the most dangerous because `world.ts` types flow through LevelBuilder, MapLoader, and every interaction handler. An LLM generating a new map definition will pass anything for these fields.

---

## 2. `WeaponUpgrade` defined in two places

**File:** `config/weapons/types.ts` line 3 AND `types/player.ts` line 34

Identical `WeaponUpgrade` type exists in both files. When an LLM imports from the wrong location, the type still works — until someone changes one and not the other.

**Action:** Single definition in `types/player.ts`, re-exported from `config/weapons/types.ts` if needed there.

---

## 3. `Record<string, ...>` without key constraints

**File:** `types/ui.ts` ~lines 122-125, 140

```ts
doorStates: Record<string, DoorState>;
windowBarrierStates: Record<string, WindowBarrierState>;
lidStates: Record<string, LidState>;
```

No validation that keys correspond to actual door/window/lid IDs from the map definition. Branded string types would catch typos:

```ts
type DoorId = string & { __brand: 'DoorId' };
doorStates: Record<DoorId, DoorState>;
```

---

## 4. Non-null assertions hiding potential crashes

**File:** `game/Game.ts` ~line 456-481

```ts
releaseZombieMesh({ mesh: z.mesh as Mesh, head: z.headMesh, torso: z.torsoMesh, limbs: z.limbs! });
```

`z.limbs!` asserts non-null without checking. If a zombie is in a corrupted state (e.g., partially initialized from a network sync), this crashes.

**File:** `ui/components/GameOverScreen.tsx` ~line 76

```ts
((remoteKills! / remoteShots) * 100).toFixed(1)
```

`remoteKills!` non-null assertion despite the field being optional. Should use nullish coalescing.

---

## 5. MysteryBoxState numeric enum

**File:** `types/world.ts` ~lines 7-18

```ts
enum MysteryBoxState {
    BOX_IDLE = 0,
    BOX_ROLLING = 1,
    // ...
    BOX_RELOCATING = 9
}
```

Numeric enums are harder for LLMs to reason about in state machine transitions. String enums (`BOX_IDLE = 'BOX_IDLE'`) are self-documenting in debug logs and runtime inspection.

---

## 6. Inconsistent `MutableRefObject` types

**File:** `types/index.ts` line 9 vs `types/ui.ts` lines 147-170

A custom `MutableRefObject<T>` is defined in `types/index.ts` but UI state slices use `React.MutableRefObject`. Engine code should not import from React, so there's a legitimate need for the custom type — but it's unused. Either use it consistently in engine types, or remove it.

---

## 7. Loose `Partial<Record<PowerUpType, number>>`

**File:** `types/ui.ts` ~line 131

```ts
activePowerUps: Partial<Record<PowerUpType, number>>;
```

This allows any combination of power-ups with numeric values, but doesn't encode:
- What the number represents (expiry timestamp? remaining duration? stack count?)
- Which power-ups can actually be active simultaneously
- Whether multiple of the same type stack

A named type with JSDoc would help:

```ts
/** Maps active power-up type to its expiry timestamp (ms since epoch) */
type ActivePowerUps = Partial<Record<PowerUpType, number>>;
```

---

## 8. Explosive weapon properties scattered across 3 types

**Files:** `types/player.ts` (WeaponConfig), `types/entities.ts` (Projectile), `config/weapons/wonderweapons.ts`

`isExplosive`, `splashRadius`, `splashDamage` are defined independently in WeaponConfig, Projectile, and individual weapon configs. No single source of truth — an LLM adding an explosive weapon must update all three correctly.

**Action:** Define explosive properties once on `WeaponConfig` and derive Projectile explosive fields from the weapon that fired it.
