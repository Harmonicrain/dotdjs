# Misplaced Logic

Code that works but lives in the wrong place, making it hard to find and maintain.

---

## 1. Health regeneration in GameLoop instead of a system

**File:** `game/GameLoop.ts` ~lines 336-338

Health regen logic (3s delay, 50ms tick, +5 HP) is embedded directly in the game loop callback rather than being a proper system registered with SystemManager.

**Problems:**
- Not testable in isolation (can't mock game loop context)
- Bypasses the system priority ordering
- Has no `dispose()` — if regen rules change, you edit the game loop
- LLMs won't find it when asked "where is health regeneration?"

**Fix:** Extract to a `PlayerRegenSystem` with proper pause guards, config references, and SystemManager registration.

---

## 2. MysteryBoxSystem called directly from GameLoop

**File:** `game/GameLoop.ts` ~line 320

```ts
sm.mysteryBoxSystem?.update(dt);
```

AGENTS.md documents this as intentional, but it's a pattern violation. Every other system goes through SystemManager. The mystery box system misses pause guards partly because it's not subject to SystemManager's freeze logic.

**Fix:** Register MysteryBoxSystem with SystemManager like all other systems. If it needs special ordering, use the priority system.

---

## 3. Weapon default lookup via filter+map in Game.ts

**File:** `game/Game.ts` ~line 596-602

```ts
WEAPON_CONFIGS.filter(w => w.id === 'pistol').map(w => ({ ...w, currentAmmo: w.clipSize, ... }))
```

Filters the entire weapon config array to find one weapon, then maps it. This is:
- Inefficient (should be `.find()`)
- Fragile (returns empty array if 'pistol' doesn't exist, silently breaking)
- In the wrong place (weapon initialization belongs in a WeaponManager or state reset utility)

**Fix:** Use `WEAPON_CONFIGS.find(w => w.id === 'pistol')` with a null check, or create a `getDefaultWeapon()` utility.

---

## 4. PerkHandler duplicates cost defaults

**File:** `systems/interaction/handlers/PerkHandler.ts` ~lines 9-14 and 27-32

The perk cost defaults dictionary is defined in two places within the same file. DRY violation that will cause bugs when one is updated and not the other.

**Fix:** Define once at the top of the file or reference from `GAME_CONFIG`.

---

## 5. CommandRegistry mutates StateManager directly

**File:** `engine/CommandRegistry.ts` ~lines 38, 80-84

Debug commands directly mutate `sm.gameState` properties, bypassing UIBridge. While this is debug-only code, it sets a bad example. An LLM learning from CommandRegistry will replicate the direct mutation pattern in production code.

**Fix:** Use StateManager setter methods even in debug commands, or add a clear comment: `// DEBUG ONLY: bypasses UIBridge intentionally`.

---

## 6. ZombieMeshFactory — module-level scene tracking

**File:** `factories/ZombieMeshFactory.ts` ~lines 36-40

A module-level `templateScene` variable tracks which scene the mesh pool was built for. This is global mutable state hidden inside a factory file. It's used to invalidate the pool on scene change, but the pattern is invisible to anyone reading the factory's public API.

**Fix:** Move scene tracking into a pool manager class, or at minimum document the global state prominently.

---

## 7. UIBridge throttle rules scattered across 400+ lines

**File:** `state/UIBridge.ts`

Some setters bypass throttling (setPoints, setReserveAmmo, setKills) and others don't. The rules for which bypass and why are scattered across the file with no overview.

**Fix:** Add a comment table at the top of UIBridge listing every setter and whether it throttles:
```ts
// THROTTLED: setHealth, setRound, setZombieCount, ...
// IMMEDIATE: setPoints (visible feedback), setKills (HUD counter), ...
```

---

## 8. GameScene.tsx — ref-then-callback initialization

**File:** `ui/GameScene.tsx` ~lines 35-38

```ts
const startGameRef = useRef<typeof startGame>(null!);
// ... later
const startGame = useCallback(...);
```

The ref is initialized with `null!` (non-null assertion on null), then the callback is defined after, then the ref is updated in a useEffect. This temporal dependency is a pattern that confuses LLMs and creates potential for stale closures.

**Fix:** Use a more straightforward pattern, or add a comment explaining the initialization order requirement.
