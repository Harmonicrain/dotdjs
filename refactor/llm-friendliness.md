# LLM Friendliness Improvements

Specific changes that would make this codebase significantly easier for AI coding assistants (Claude, Gemini, Copilot) to work with correctly.

---

## 1. The Hellhound Limb Naming Problem

**The Issue**: Hellhounds reuse the zombie `limbs` type which has `armL`, `armR`, `legL`, `legR`. For hellhounds, `armL/armR` are actually **front legs**. Every LLM that reads this code will think hellhounds have arms.

**Why This Trips Up LLMs**: When asked "make hellhounds lose a front leg when shot", an LLM will search for "leg" fields. It'll find `legL/legR` (which are BACK legs) and modify those. The front legs are `armL/armR`. This is a guaranteed wrong implementation.

**Fix**: Add a comment block at the `limbs` definition in `types/entities.ts`:
```typescript
/**
 * Limb references. For zombies: arms and legs literal.
 * For hellhounds: armL/armR = FRONT legs, legL/legR = BACK legs.
 */
```

---

## 2. Config Value Discoverability

**The Issue**: An LLM asked to "make zombies faster" has to know to look in:
- `config/gameplay.ts` for `ZOMBIE_SPEEDS`
- `config/gameplay.ts` for `ZOMBIE_SPEED_INC` in `ROUND_CONFIG`
- `managers/ZombieManager.ts` for the speed calculation formula
- `managers/HellhoundManager.ts` for hellhound-specific speed
- The hardcoded `0.9 + (Math.random() * 0.2)` variation in both managers

**Fix**: Add a "Speed Pipeline" comment in `config/gameplay.ts`:
```typescript
// SPEED PIPELINE: base speed (ZOMBIE_SPEEDS) + round scaling (ZOMBIE_SPEED_INC per round)
//   + random variation (0.9-1.1x) → applied in ZombieManager.ts / HellhoundManager.ts
```

---

## 3. Projectile Speed — Undocumented Override System

**The Issue**: `COMBAT_CONFIG.PROJECTILE_SPEED = 2.5` looks like THE projectile speed. But `WeaponConfig` has `projectileSpeedOverride?: number`, and Ray Gun uses `30`.

**Why This Trips Up LLMs**: An LLM asked to "change projectile speed" will find `COMBAT_CONFIG.PROJECTILE_SPEED`, change it, and think it's done. It won't know about the override system. Ray Gun will be unaffected.

**Fix**: Add comment to `COMBAT_CONFIG`:
```typescript
PROJECTILE_SPEED: 2.5, // Default. Weapons can override via WeaponConfig.projectileSpeedOverride
```

---

## 4. GameScene.tsx — Engine/UI Boundary Violation

**The Issue**: `GameScene.tsx` directly imports and instantiates `GameLifecycle`. AGENTS.md says "Engine/system code must NEVER import React" but doesn't explicitly forbid the reverse (UI importing engine).

**Why This Trips Up LLMs**: An LLM reading AGENTS.md will think the boundary is one-way. When asked to add a new game lifecycle feature, it might add it to GameScene.tsx because that's where the lifecycle is created.

**Fix**: Add to AGENTS.md Section 4:
```
**NOTE**: `GameScene.tsx` is the ONLY UI file that directly touches engine code
(it creates GameLifecycle). All other UI files must go through the Zustand store.
Do NOT add engine imports to any other UI component.
```

---

## 5. Multiple Source-of-Truth for Types

**The Issue**: `WeaponUpgrade` is defined in both `types/player.ts` AND `config/weapons/types.ts`. `BuildingDefinition` is defined in both `types/world.ts` AND `factories/BuildingFactory.ts`. An LLM importing types will randomly pick one source.

**Why This Trips Up LLMs**: When Gemini is asked to "add a field to WeaponUpgrade", it might update one definition but not the other. The types diverge. Future code breaks silently.

**Fix**: Consolidate to single definitions. Add to AGENTS.md:
```
All type definitions live in `types/`. Never define interfaces in config/ or factories/ —
import from types/ instead.
```

---

## 6. The "Demo" Components Problem

**The Issue**: `HitMarker.tsx` and `KillFeed.tsx` have comments saying "Random for demo" and "simplified - in real implementation would use event bus". These are in the production codebase.

**Why This Trips Up LLMs**: When asked to "fix the hit marker", an LLM will try to connect it to real game events. It'll spend time searching for the event bus integration that doesn't exist, then either:
- Wire it up (scope creep beyond what was asked)
- Get confused about why there's no connection

**Fix**: Either:
- Connect them to real data (proper fix)
- Add clear `// TODO: Currently uses placeholder data. Wire to EventBus ZOMBIE_DEATH/PLAYER_DAMAGE events.`

---

## 7. Naming Convention Documentation

**The Issue**: Model transform keys use `snake_case` (`speed_cola`, `ray_gun_fps`) while everything else uses `camelCase`. Factory names are inconsistent (some say `Mesh`, some don't).

**Why This Trips Up LLMs**: When creating a new weapon or perk, an LLM has to guess the naming convention. It'll look at nearby examples and may pick the wrong one.

**Fix**: Add to AGENTS.md Section 4 under conventions:
```
### Naming Conventions
- Model transform keys: `snake_case` (e.g., `speed_cola`, `ray_gun_fps`)
- Factory functions: `create[Thing]()` (e.g., `createJuggernog()`, `createPowerSwitch()`)
- System factories: `create[Name]System()` (e.g., `createRoundSystem()`)
- Config keys: `UPPER_SNAKE_CASE` (e.g., `WALK_SPEED`, `PROJECTILE_SPEED`)
```

---

## 8. MysteryBoxSystem — Not in SystemManager

**The Issue**: AGENTS.md Section 11 notes that "MysteryBoxSystem is NOT registered with SystemManager — it's called directly in GameLoop.ts." This is the ONLY system with this exception.

**Why This Trips Up LLMs**: When asked to "add a new system", an LLM follows the documented pattern: create factory, register in SystemManager. If it looks at MysteryBoxSystem as an example, it'll do it wrong. If asked to modify MysteryBox behavior, it might look in SystemManager registration and not find it.

**Fix**: Either register MysteryBoxSystem with SystemManager (preferred — removes the exception) or add a more prominent warning in the file itself:
```typescript
// WARNING: This system is NOT managed by SystemManager.
// It is called directly from GameLoop.ts. See AGENTS.md Section 11.
```

---

## Summary: Highest-Impact Changes for LLM Correctness

1. **Consolidate duplicate type definitions** (prevents wrong imports)
2. **Document the hellhound limb mapping** (prevents wrong field access)
3. **Add config pipeline comments** (prevents partial changes)
4. **Add naming convention docs to AGENTS.md** (prevents naming guesses)
5. **Clarify the GameScene.tsx exception** (prevents architecture violations)

These five changes would prevent the majority of LLM implementation errors in this codebase.
