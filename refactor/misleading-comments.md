# Misleading Comments

Comments that don't match the code. These actively harm LLM code generation because LLMs trust comments as ground truth.

---

## 1. `MAX_CONCURRENT_ZOMBIES` — "unused directly" but IS used

**File:** `config/gameplay.ts` ~line 121

The comment (or surrounding context) implies this value isn't used directly, but `RoundSystem.ts` uses it in `Math.min(rc.MAX_CONCURRENT_ZOMBIES, 3 + gs.round * 2)`. The comment should say it's the cap in the concurrent zombie formula.

---

## 2. HellhoundManager — "flat speed (no round scaling)" then applies variation

**File:** `managers/HellhoundManager.ts` ~lines 256-260

Comment says "Intentional: hellhounds use a flat speed (no round scaling)" but line 260 immediately applies `speedVariation`, contradicting the "flat speed" claim. The comment should say "no round-based scaling, but per-entity variation is applied."

---

## 3. UIBridge — "Points must always flush immediately"

**File:** `state/UIBridge.ts` ~lines 69-73

Comment claims points always flush immediately, but the throttling architecture means some paths may still batch. The comment should clarify which specific method bypasses throttling and why.

---

## 4. ZombieManager — "same-map reload produces new GroundSpawn instances with the same IDs"

**File:** `managers/ZombieManager.ts` ~lines 241-242

Comment describes ID-based equality check, but the actual code uses reference inequality (`!==`), checking object identity rather than ID matching. Comment describes intent but not actual behavior.

---

## 5. LevelBuilder — `DEBUG_SHOW_NAVFLOORS` comment

**File:** `engine/LevelBuilder.ts` ~line 388-392

Comment makes it sound like a toggleable flag, but it's a compile-time constant hardcoded to `false`. Should either say "dead code — remove or wire to debug command" or actually be made toggleable.

---

## 6. InputManager — document-level mouseup handler

**File:** `engine/InputManager.ts` ~lines 161-164

Comment says "Additional mouseup handler that catches events at document level" but doesn't explain the actual purpose: working around pointer lock edge cases where `mouseup` events fire outside the canvas. The "why" is missing.

---

## 7. DownedOverlay.tsx — duplicate bleed-out constant

**File:** `ui/components/DownedOverlay.tsx` ~line 30

```ts
const maxTime = 45; // Approximate max bleed out time
```

This duplicates `GAME_CONFIG.DOWNED_BLEED_OUT_TIME / 1000` but calls itself "approximate." If it drifts from the config value, the urgency indicator will be wrong. Should reference the config directly.

---

## 8. Game.ts collision ellipsoid

**File:** `game/Game.ts` ~lines 148-149

Comment mentions "collision ellipsoid" but doesn't explain why the specific dimensions (0.25, 0.6, 0.25) were chosen, or that 0.6 represents the camera height offset. New contributors will change these blindly.

---

## 9. WeaponConfig `hipFireOriginCorrection`

**File:** `config/weapons/` — various weapon files

The field is present on some weapons with no comment, and absent on others. No comment explains what this correction does (offsets projectile origin to prevent shooting through walls at close range). LLMs will omit it when adding new weapons.

---

## 10. ParticleManager — scalar decomposition comment

**File:** `managers/visual/ParticleManager.ts` ~lines 87-89

The explosion queue stores `x, y, z` as separate numbers "to avoid stale mesh refs" but this is extremely non-obvious. A comment exists but doesn't explain that mesh `.position` vectors can be recycled/mutated by Babylon.js pool reuse, which is the actual reason for decomposition.
