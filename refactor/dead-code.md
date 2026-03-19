# Dead Code & Unused Exports

Items that can be safely removed to reduce confusion and bundle size.

---

## 1. `applyDamageToZombie` — exported but never called

**File:** `systems/zombie/ZombieDamageSystem.ts` ~line 39-55

The function is exported from the module but never imported or called anywhere. Both `ProjectileSystem` and `PlayerCombatSystem` implement damage inline. This orphan export misleads LLMs into thinking it's the canonical damage path.

**Action:** Delete the export. If a shared damage util is wanted later, re-create it intentionally.

---

## 2. `semiAutoWeapons` — empty array export

**File:** `config/weapons/semiauto.ts` line 3

```ts
export const semiAutoWeapons: WeaponDefinition[] = [];
```

Exported, imported into `config/weapons/index.ts`, spread into `allDefinitions`. Contributes nothing — just an empty array that adds maintenance overhead.

**Action:** Remove the file and its import from `config/weapons/index.ts`.

---

## 3. `POINTS_THRESHOLD_START` — defined, never referenced

**File:** `config/gameplay.ts` ~line 108

The constant is defined in config but only `POINTS_THRESHOLD_MULTIPLIER` is used in `PowerUpSystem.ts`. The start value is never read anywhere.

**Action:** Remove or add usage — if it was intended to seed the threshold formula, wire it in.

---

## 4. `barrelOffset` — optional field never read

**File:** `types/player.ts` line 18

```ts
barrelOffset?: number;
```

Defined on `WeaponConfig` but no system, factory, or combat code reads it. Only `barrelLength` and `hipFireOriginCorrection` are used for projectile origin calculation.

**Action:** Remove the field from `WeaponConfig`.

---

## 5. `DEBUG_SHOW_NAVFLOORS` — dead code branch

**File:** `engine/LevelBuilder.ts` ~line 392

Hardcoded `const DEBUG_SHOW_NAVFLOORS = false;`. The conditional block that creates navfloor debug materials (lines ~408-414) will never execute. This isn't a runtime toggle — it's compiled dead code.

**Action:** Either remove entirely, or convert to a runtime debug command in `CommandRegistry.ts` so it's actually usable.

---

## 6. `HighlightLayer` created but never stored

**File:** `factories/gameplay/PowerUpFactory.ts` ~line 28

A `HighlightLayer` is instantiated but the reference is immediately lost. It persists in the scene with no way to dispose it and no visual effect hooked up.

**Action:** Remove the creation, or store the reference and wire it into the power-up glow effect.

---

## 7. Custom `MutableRefObject<T>` in `types/index.ts`

**File:** `types/index.ts` line 9

A custom `MutableRefObject<T>` type is defined, but `types/ui.ts` uses `React.MutableRefObject` from the React library instead. The custom type is unused.

**Action:** Remove the custom definition. Standardize on `React.MutableRefObject` or a non-React equivalent if engine code needs it.
