# Pattern Inconsistencies

> Violations of the patterns documented in AGENTS.md. These make the codebase unpredictable for LLMs — when patterns aren't consistent, we can't reliably infer behavior from one file when working on another.

---

## Manager Lifecycle Contract Violations

### `managers/ResourceManager.ts` — Missing `reset()`
AGENTS.md Section 5g documents that managers implement both `reset()` (between-game) and `dispose()` (full teardown). ResourceManager only has `dispose()`.
**Impact**: An LLM adding cleanup logic won't know whether to add it to `reset()` or `dispose()` because the pattern is broken.
**Fix**: Add `reset()` — even if it's intentionally a no-op, document WHY the cache persists across games.

### `managers/SoundManager.ts` — Missing both `reset()` and `dispose()`
Has `stopAll()` and `resumeAll()` but doesn't follow the manager lifecycle contract at all.
**Fix**: Implement `reset()` (calls `stopAll()`) and `dispose()` (releases `HTMLAudioElement` references, clears the sound map).

---

## StateManager Initialization

### `state/StateManager.ts` ~lines 108-111
```typescript
public visualManager: VisualManager = null!;
public zombieManager: ZombieManager = null!;
public hellhoundManager: HellhoundManager = null!;
public powerUpManager: PowerUpManager = null!;
public ui: UIBridge = null!;
```
**Problem**: `null!` assertions defeat TypeScript's strict null checking. These fields are initialized via `setManagers()` called from `Game.ts`, but there's a window between construction and initialization where access causes runtime errors with no type-level warning.
**Fix**: Either:
- Make fields optional (`?`) and add guards at usage sites, OR
- Document the initialization order contract with a comment block, OR
- Use a builder pattern that returns a fully-initialized StateManager

---

## Error Handling Inconsistencies

### `game/Game.ts` — Mixed patterns
| Location | Pattern | Behavior |
|----------|---------|----------|
| ~line 716-720 | `try/catch` | Door obstacle creation — logs error, continues |
| ~line 759-760 | `.catch()` | Map load failure — logs error, continues |
| Other locations | No error handling | Failures throw to caller |

**Impact**: LLMs adding new async operations won't know which pattern to follow.
**Fix**: Establish a single error handling pattern for non-critical failures (log + continue) vs critical failures (throw). Document in AGENTS.md.

---

## Interaction Handler Inconsistencies

### `systems/interaction/handlers/PerkHandler.ts` ~line 41
Uses `stateManager.getPerkState()` method to access perk state.

### Other systems
Directly access `gameState.perkStates[perkId]`.

**Impact**: Two different access patterns for the same data. LLMs will copy whichever file they happen to reference.
**Fix**: Standardize on one pattern. If `getPerkState()` exists, use it everywhere. If direct access is preferred, remove the accessor.

---

## Authority Check Placement

### `systems/InteractionSystem.ts` ~lines 20-22
Authority validation is pushed down to individual handler implementations (DoorHandler, PerkHandler, etc.) rather than checked at the system level.

### Other systems (RoundSystem, ZombieSpawnSystem)
Authority is checked at the TOP of `update()` as documented in AGENTS.md.

**Impact**: Decentralized authority checking means each new handler must remember to add its own check. Easy to forget.
**Fix**: Consider adding a top-level authority check in `InteractionSystem` for handlers that are HOST-only, with a `requiresAuthority` flag on the handler interface.

---

## Dispose Pattern in Systems

### Systems WITH proper dispose:
- `RoundSystem` — cleans up `ZOMBIE_DEATH`, `HELLHOUND_DEATH` handlers
- `ReviveSystem` — cleans up `REVIVE_EVENT` handler
- `ProjectileSystem` — cleans up `REMOTE_SHOOT` handler

### Systems WITHOUT dispose (but should have):
- `NetworkSystem` — subscribes to 3 EventBus events, empty `dispose()`
- `DownedSystem` — no `dispose()` at all (currently safe but fragile)

### Systems WITHOUT dispose (correctly):
- `PlayerMovementSystem`, `PlayerCombatSystem` — no EventBus subscriptions

**Fix**: Audit every system with `eventBus.on()` calls and ensure matching `off()` in `dispose()`.

---

## Config Access Patterns

### Correct (per AGENTS.md):
```typescript
const zc = ctx.configManager.zombieAI;
```

### Incorrect (direct import):
Some files import from `config/gameplay.ts` directly instead of going through `MapConfigManager`, bypassing per-map overrides.

**Fix**: Grep for direct `GAME_CONFIG` imports in systems and replace with `ctx.configManager` access where per-map overrides should apply.

---

## Refactoring Strategy

1. **Add lifecycle methods** to ResourceManager and SoundManager
2. **Standardize authority checking** — either centralize in InteractionSystem or document the decentralized pattern in AGENTS.md
3. **Fix NetworkSystem dispose** — add EventBus cleanup
4. **Standardize perk state access** — pick one pattern
5. **Document error handling convention** in AGENTS.md
