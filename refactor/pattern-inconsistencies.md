# Pattern Inconsistencies

Places where similar things are done in different ways, creating confusion about which pattern is "correct."

---

## 1. Manager Dependency Injection — Three Different Patterns

**ZombieManager.ts**: `setDependencies()` method
**HellhoundManager.ts**: `setDependencies()` method (same name, good)
**PowerUpManager.ts**: `setZombieKiller()` method (different name)

**Issue**: An LLM creating a new manager will guess the pattern from whichever file it reads first. If it reads PowerUpManager, it'll use a different method name.
**Fix**: Standardize on `setDependencies()` everywhere, or document the pattern in AGENTS.md.

---

## 2. reset() vs dispose() — Unclear Contract

**GoreManager.ts**: Has both `reset()` (clears active items) and `dispose()` (clears pools + observer)
**ParticleManager.ts**: Has both (similar split)
**DecalManager.ts**: Has both (similar split)

**Issue**: `reset()` doesn't fully clean up in GoreManager — the observer continues running. No documentation explains the contract difference between reset and dispose.
**Fix**: Add a comment to each manager (or to AGENTS.md) clarifying:
- `reset()` = between-round/between-game cleanup, manager stays alive
- `dispose()` = full teardown, manager is destroyed

---

## 3. Observer Lifecycle Management — Three Patterns

| Manager | Observer Storage | Cleanup Location |
|---------|-----------------|-----------------|
| GoreManager | Instance field | `dispose()` only |
| ParticleManager | Instance field | `dispose()` only |
| GeometryUtils | Local variable | Self-removing on condition |
| CommandRegistry | Local variable | Never removed |

**Fix**: Standardize on instance fields with cleanup in both `reset()` and `dispose()`.

---

## 4. Material Creation — Two Patterns

**LevelBuilder.ts** (~lines 170-244): Creates `StandardMaterial` and `PBRMaterial` inline with manual setup
**GeometryUtils.ts** (~line 37): Uses helper `createPBRMaterialWithTexture()`

**Issue**: Two different approaches for the same operation.
**Fix**: Use the helper function consistently, or at minimum document when to use which approach.

---

## 5. Hellhound Speed — No Round Scaling (vs Zombies)

**ZombieManager.ts** ~line 304: `baseSpeed = zs.WALKER + (currentRound * rc.ZOMBIE_SPEED_INC)` — scales with round
**HellhoundManager.ts** ~line 244: `baseSpeed = hc.SPEED_BASE` — constant, no round scaling

**Issue**: If this is intentional design (hellhounds are always fast), it should be commented. If it's an oversight, hellhounds are too easy in late rounds.
**Fix**: Add a comment explaining the design choice, or add round scaling.

---

## 6. UI Component Update Strategy — Two Approaches

**AmmoCounter.tsx**: Standard React re-render model (store selector triggers re-render)
**FPSCounter.tsx**: Bypasses React entirely — uses `useRef` + direct DOM mutation (`el.textContent = ...`)

**Issue**: Both are valid approaches but using both in the same project confuses LLMs about which pattern to follow for new HUD components.
**Fix**: Document in AGENTS.md: "Use direct DOM refs for high-frequency updates (>10/sec). Use standard React model for everything else." Or standardize on one approach.

---

## 7. UIBridge Throttle Strategy — Inconsistent

**File**: `state/UIBridge.ts`
- `setPoints()` (~line 65): Never throttled (explicit comment explains why)
- `setAmmo()` (~line 102): Throttled
- `setShotsFired()` (~line 164): Throttled
- `setTotalEarnedPoints()` (~line 78): Throttled

**Issue**: Points never throttles but totalEarnedPoints does — asymmetric. The reasoning isn't documented for most methods.
**Fix**: Add a brief comment to each method explaining why it does/doesn't throttle.

---

## 8. Factory Function Naming — No Convention

| Pattern | Examples |
|---------|----------|
| `create` + noun | `createPowerSwitch()`, `createBuilding()` |
| `create` + noun + `Mesh` | `createPowerUpMesh()`, `createLidMesh()` |
| `create` + noun + `Machine` | `createPackAPunchMachine()` |
| `create` + noun (perk name) | `createJuggernog()`, `createSpeedCola()` |

**Fix**: Standardize. Suggestion: `create[Thing]Mesh()` for all factories that return meshes (which is all of them). Or just `create[Thing]()` since it's obvious they create meshes.

---

## 9. Perk Factory Code Duplication

All four perk factories (`DoubleTap`, `Juggernog`, `QuickRevive`, `SpeedCola`) share:
- Identical `maxSimultaneousLights = 4` setup (~line 46-48 in each)
- Identical error fallback box creation (~13 lines in each catch block)

**Fix**: Extract shared logic to a `createPerkBase()` utility in `factories/perks/` that handles common setup, leaving each factory to define only perk-specific details (model URL, color, label).

---

## Priority

Items 1, 6, and 9 most impact LLM code generation. When patterns are inconsistent, LLMs pick the wrong one ~50% of the time. Documenting "which pattern to use when" in AGENTS.md is the highest-ROI fix.
