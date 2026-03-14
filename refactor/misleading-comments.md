# Misleading & Incorrect Comments

Comments that don't match what the code actually does. These actively mislead LLMs into generating wrong implementations.

---

## 1. PlayerCombatSystem.ts — Outdated Reload Comment

**File**: `systems/player/PlayerCombatSystem.ts` ~line 92
**Comment**: `"For now assume reload is the second animation (index 1) if it exists, or just replay first"`
**Reality**: The code now uses `.find(a => a.name.toLowerCase().includes('reload'))`, which is name-based lookup — not index-based at all.
**Fix**: Update comment to: `// Find reload animation by name, falling back to first animation`

---

## 2. PlayerCombatSystem.ts — "Allow shooting if we have a pistol" Comment

**File**: `systems/player/PlayerCombatSystem.ts` ~line 349
**Comment**: Says "Allow shooting if we have a pistol" when downed
**Reality**: The code checks `downedWeapon?.automatic` — this has nothing to do with pistols specifically. It checks whether the downed weapon is automatic.
**Fix**: Update comment to: `// Allow shooting while downed if the downed weapon exists`

---

## 3. HellhoundManager.ts — "Eliminates duplication" Comment

**File**: `managers/HellhoundManager.ts` ~line 233
**Comment**: `"Create smoke effect using injected VisualManager method (eliminates duplication)"`
**Reality**: The code uses `this.createSpawnSmokeEffect` which is a direct callback, not a VisualManager method. The comment misattributes the source.
**Fix**: Update comment to: `// Create smoke effect via injected callback`

---

## 4. ZombieManager.ts — Cache Rebuild Trigger Comment

**File**: `managers/ZombieManager.ts` ~lines 34-39
**Comment**: `"Cached spawn-point arrays (rebuilt only when door state changes)"`
**Reality**: The cache is also rebuilt on map reload (checks `groundSpawnsByZone.size`, `windowsByZone.size`, and instance identity). Door state changes are only ONE trigger.
**Fix**: Update to: `// Cached spawn-point arrays (rebuilt when door state changes OR map reloads)`

---

## 5. PowerSwitchFactory.ts — "Legacy pivot" Comment

**File**: `factories/gameplay/PowerSwitchFactory.ts` ~lines 11-14
**Comment**: `"Legacy pivot kept for compatibility — no longer used for rotation when GLB anim is present"`
**Reality**: The fallback code (~lines 96-98) still actively uses this pivot for rotation when GLB animation is NOT present. The pivot IS used — just not always.
**Fix**: Update to: `// Pivot used for manual rotation fallback when GLB animation is absent`

---

## 6. InputManager.ts — "Don't auto-switch" vs Auto-Switch

**File**: `engine/InputManager.ts` ~line 204 vs ~line 285
**Comment at ~204**: Says "Don't auto-switch"
**Reality at ~285**: The gamepad connected handler DOES auto-switch the input device.
**Fix**: Either remove the auto-switch behavior or update the comment to match what happens.

---

## 7. ZombieMeshFactory.ts — Arm/Leg Naming Confusion

**File**: `factories/ZombieMeshFactory.ts` ~lines 111-120, 534-550
**Issue**: Hellhound legs are created as `legFL`, `legFR`, `legBL`, `legBR` but then mapped to `armL`, `armR`, `legL`, `legR` in the returned limbs object. Comments don't explain this mapping.
**Impact**: LLMs see "armL" and assume hellhounds have arms. They don't — these are front legs.
**Fix**: Add a clear comment: `// Hellhound limb mapping: armL/armR = front legs, legL/legR = back legs (reuses zombie limb structure)`

---

## Priority

These should all be quick fixes — just updating comment text. But they have outsized impact on LLM-generated code quality because LLMs trust comments heavily when deciding how to modify logic.
