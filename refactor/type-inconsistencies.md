# Type Inconsistencies & Mismatches

Type definitions that contradict actual usage, creating confusion for LLMs trying to implement features correctly.

---

## 1. Hellhound Limb Type Reuse — Semantic Mismatch

**File**: `types/entities.ts` — `Zombie` type
**File**: `factories/ZombieMeshFactory.ts` ~lines 534-550
**Issue**: The `Zombie.limbs` type uses `armL/armR/legL/legR` field names. For hellhounds, `armL` and `armR` are actually **front legs**, not arms. The shared type forces misleading field names on hellhounds.
**Impact**: An LLM asked to "dismember a hellhound's front leg" would look for a leg field, not `armL`.
**Fix Options**:
- Add a comment to the `limbs` type explaining the mapping
- Or create a `HellhoundLimbs` type alias with proper naming and a mapped type

---

## 2. Position Type Mismatch — Vector3 vs Tuple

**Map definitions** (`types/world.ts`): Use `position: [number, number, number]` tuples
**Factory functions** (`factories/perks/*.ts`): Accept `position: BABYLON.Vector3`
**Issue**: Every call site must convert `[x,y,z]` → `new Vector3(x,y,z)`. This is a friction point and source of bugs.
**Fix**: Either standardize on tuples in definitions + convert at factory boundary, or document the conversion pattern clearly in AGENTS.md.

---

## 3. `any` Type Casts in ZombieAnimationSystem

**File**: `systems/zombie/ZombieAnimationSystem.ts` ~lines 100, 115
```typescript
const root = z.mesh as any;
```
Used twice. The mesh IS typed but lacks skeleton-related properties in its type definition.
**Fix**: Create a proper interface for zombie meshes that includes skeleton access, or use a type guard.

---

## 4. Health Type — No Zombie/Hellhound Distinction

**File**: `types/entities.ts` — `Zombie` type has `maxHealth: number`
**File**: `config/enemies.ts` — defines separate `HEALTH_BASE`, `HEALTH_INC`, `HEALTH_CAP` for hellhounds
**File**: `config/gameplay.ts` — defines separate zombie health scaling
**Issue**: The `Zombie` entity type has a single `maxHealth` field with no indication whether it was calculated from zombie or hellhound formulas. The type system doesn't distinguish.
**Impact**: An LLM modifying health scaling doesn't know which config to change based on the type alone.
**Fix**: Add a comment to the `Zombie` type's health fields noting that health is calculated differently based on `type: 'ZOMBIE' | 'HELLHOUND'` — see `ZombieManager` vs `HellhoundManager`.

---

## 5. Rotation Default Inconsistency in Factories

**Perk factories** (`factories/perks/*.ts`): All use `rotationY: number = 0` (default parameter)
**PowerSwitchFactory** (`factories/gameplay/PowerSwitchFactory.ts`): Uses `rotationY: number` (NO default)
**Issue**: PowerSwitch requires explicit rotation while perks don't. Inconsistent API.
**Fix**: Add `= 0` default to PowerSwitchFactory for consistency.

---

## 6. InteractionSystem Type Cast

**File**: `systems/InteractionSystem.ts` ~line 232
```typescript
(ctx2d as CanvasRenderingContext2D).lineCap = "round"; // Fix LSP error
```
Comment admits this is a workaround. The canvas context type should be properly narrowed.
**Fix**: Use a null check + type guard instead of a cast.

---

## Priority

Items 1-2 cause the most LLM confusion. The limb naming issue means AI-generated hellhound code will frequently reference the wrong fields. The position type mismatch means every new factory function risks getting the parameter type wrong.
