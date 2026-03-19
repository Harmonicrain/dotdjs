# Pattern Inconsistencies

Places where similar code follows different patterns, making it harder for LLMs to learn and replicate the "right" way.

---

## 1. Pause guard shapes vary across player systems

**Files:**
- `PlayerMovementSystem.ts` — 5 conditions (hasStarted, isPaused, isSpectating, isGameOver, isConsoleOpen)
- `PlayerCombatSystem.ts` — 4 conditions (missing isConsoleOpen)
- `WeaponViewSystem.ts` — 1 condition (hasStarted only)
- `DownedSystem.ts` — 4 conditions (different structure)

AGENTS.md defines **one** canonical guard per system type. All player systems should use the same guard. An LLM copying from WeaponViewSystem will produce a system missing 4 guards.

**Fix:** Extract a helper or at minimum standardize the guard:
```ts
const isPlayerFrozen = (gs: GameStateData) =>
    !gs.hasStarted || gs.isPaused || gs.isSpectating || gs.isGameOver || gs.isConsoleOpen;
```

---

## 2. EventBus cleanup — most systems correct, PackAPunchSystem broken

**Files:** Most systems (RoundSystem, NetworkSystem, ProjectileSystem, InteractionSystem, ReviveSystem, ZombieSyncSystem) properly implement `dispose()` with `eventBus.off()`.

But `PackAPunchSystem` has `init()` and `dispose()` but no `update()` method. It's event-driven only, which means it doesn't conform to the `System` interface that AGENTS.md mandates. An LLM looking at this as a reference will produce systems without `update()`.

**Fix:** Add a no-op `update()` to PackAPunchSystem, or document event-driven systems as an explicit pattern variation.

---

## 3. RemotePlayerSystem — no dispose() at all

**File:** `systems/RemotePlayerSystem.ts`

While it doesn't subscribe to EventBus, every other system has `dispose()`. An LLM modeling a new system after this one will omit `dispose()`.

**Fix:** Add an empty `dispose()` for interface compliance.

---

## 4. Config imports in UI — mixed sources

**Files:**
- `PlayerStatus.tsx` — imports `GAME_CONFIG` directly for health thresholds
- `HUDOverlayEffects.tsx` — imports `GAME_CONFIG` directly
- `DownedOverlay.tsx` — imports `GAME_CONFIG` AND hardcodes `45`
- Other components — correctly use `useGameStore` for all values

The AGENTS.md architecture says UI should read from Zustand store, not config. Config values that affect rendering (like max health) should flow through UIBridge.

**Fix:** Expose `maxHealth` (or `hasJuggernog`) through the store so components don't need config imports.

---

## 5. Material creation — 4 different patterns

**Files:**
- `GeometryUtils.ts` — `createMaterial()` for level geometry PBR
- `LevelBuilder.ts` — `createPBRMaterialWithTexture()` for custom metallic
- Various factories — inline `new PBRMaterial()` / `new StandardMaterial()`
- `ResourceManager.ts` — `getOrCreateMaterial()` for cached shared materials

AGENTS.md documents when to use each, but factories don't follow it. `MysteryBoxFactory`, `RemotePlayerFactory`, and `WeaponMeshFactory` all create materials inline without ResourceManager caching.

**Fix:** Route all factory materials through ResourceManager, or document factory materials as intentionally unmanaged.

---

## 6. React component type annotations — inconsistent

**Files:**
- `Crosshair.tsx` — `const Crosshair: React.FC = () => {`
- `Console.tsx` — `export const Console: React.FC<ConsoleProps>`
- Other components — plain arrow functions without `React.FC`

**Fix:** Pick one style. `React.FC` is falling out of favor (React 18+ doesn't need it). Use plain typed props:
```tsx
export const MyComponent = ({ prop }: Props) => { ... };
```

---

## 7. Null checking patterns in GameOverScreen

**File:** `ui/components/GameOverScreen.tsx` ~lines 74-77

```ts
const accuracy = shotsFired > 0 ? ((kills / shotsFired) * 100).toFixed(1) : '0.0';
const remoteAccuracy = remoteShots && remoteShots > 0
    ? ((remoteKills! / remoteShots) * 100).toFixed(1) : '0.0';
```

Two nearly identical calculations use different null-safety patterns. First uses simple `> 0`, second uses `&& > 0` plus a `!` assertion. Should be identical logic.

---

## 8. State selector naming — inconsistent abbreviations

**Files across UI:**
- `DeveloperStats.tsx` — uses `pos` for position
- `RoundDisplay.tsx` — mixes `activeZombies`, `zombiesSpawned`, `zombiesToSpawn`
- `HUD.tsx` — uses `points` (full name)
- `PlayerStatus.tsx` — uses variable renames

No naming convention for store selectors. LLMs will generate inconsistent selector names.

---

## 9. Manager reset() semantics differ

**Files:**
- `ResourceManager.reset()` — no-op (cache survives between games)
- `SoundManager.reset()` — stops all sounds
- `GoreManager.reset()` — clears pieces but keeps observers
- `ParticleManager.reset()` — stops particles but keeps observers

The word "reset" means different things per manager. AGENTS.md documents `reset()` vs `dispose()` contract but managers interpret "reset" differently.

**Fix:** Document the specific reset scope in each manager's JSDoc, or establish levels: `softReset()` (between rounds) vs `hardReset()` (between games).
