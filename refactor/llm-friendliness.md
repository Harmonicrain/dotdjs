# LLM Friendliness

> Code patterns that make it harder for LLMs (Claude, Gemini, etc.) to correctly implement changes. Long functions, deep nesting, unclear naming, and files that try to do too much.

---

## Oversized Functions

### `game/GameLoop.ts` — `createGameLoop()` (234 lines)
**Problem**: This single function handles debug controls, console toggle, developer stats, spectator logic, zone updates, freeze checking, system updates, and health regen. An LLM asked to "add a new per-frame check" has to understand the entire 234-line flow to find the right insertion point.

**Recommended extraction**:
```
createGameLoop()
  ├── updateDebugControls(sm, inputManager)     // ~33 lines
  ├── updateConsoleToggle(sm, inputManager)      // ~15 lines
  ├── updateDeveloperStats(sm)                   // ~14 lines
  ├── handleSpectatorGameOver(sm)                // ~6 lines
  └── handleHealthRegeneration(sm, dt)           // ~10 lines
```

### `state/StateManager.ts` — `applyDamageToLocalPlayer()` (~40 lines, 4 levels deep)
**Problem**: Mixes solo vs multiplayer logic, quick revive checks, and player downing in deeply nested conditionals. An LLM adding a new damage modifier has to trace through all branches.

**Recommended**: Extract the downed-state transition into a separate method:
```typescript
private transitionToDowned(): void { ... }
```

### `game/Game.ts` — 934 lines total
**Problem**: Game.ts is the main orchestrator and is expected to be large, but some methods like `loadLevel()` and `resetSession()` could benefit from better section comments that help LLMs understand boundaries.

**Recommended**: Add `// ─── SECTION: Level Loading ───` style headers at major boundaries.

---

## Complex Closure Scopes

### `network/NetworkMessageHandler.ts` — `createNetworkMessageHandler()`
**Problem**: Creates many closure-scoped variables (`cachedHost`, `cachedClient`, `lastHostSeq`, `lastClientSeq`) without visual separation. The function processes a large `switch` statement over message types. An LLM asked to add a new message type must understand the entire closure scope.

**Recommended**:
- Add section comments before each message type case
- Consider extracting the handler into a class with explicit state fields instead of closures

### `systems/ProjectileSystem.ts` — update function
**Problem**: Processes both local and remote projectiles with complex raycast logic, explosion handling, and zombie damage calculations. Multiple nested conditions make control flow hard to follow.

**Recommended**: Extract `processProjectileHit()` and `handleExplosion()` as named helpers within the closure.

---

## Oversized React Components

### `ui/GameScene.tsx` (~250+ lines)
**Problem**: Manages canvas initialization, game lifecycle, network connection, state synchronization, and multiple event handlers in a single component. An LLM asked to change network behavior has to read the entire component.

**Recommended**: Extract custom hooks:
```
GameScene.tsx
  ├── useGameInitialization(canvasRef)
  ├── useNetworkSync(gameRef)
  └── useGameLifecycle(gameRef)
```

---

## Naming Clarity Issues

### `types/player.ts` — `automatic` field on WeaponConfig
```typescript
automatic: boolean;
```
**Problem**: Ambiguous — does this mean "automatic fire mode" or "automatically equipped"? The JSDoc from commit `50274f5` helps but the field name itself misleads.
**Better**: `fireMode: 'auto' | 'semi'` is self-documenting and prevents boolean blindness.

### `systems/zombie/zombieAIUtils.ts` — `cursor` variable
Assigned at line 102 but `z.pathCursor` is re-read directly at line 143. Two names for the same concept.

### `state/StateManager.ts` — `null!` fields
Five manager fields are typed as `null!`. An LLM sees these types and assumes they're always available, but they're uninitialized during construction. This is a trap.

---

## Files That Should Be Split

### `state/StateManager.ts` (388 lines)
**Problem**: Acts as a god object — holds ALL game state AND provides mutation methods AND manages manager references. Responsibilities:
1. Game state container
2. State mutation API
3. Manager dependency holder
4. Damage calculation logic
5. Session reset coordination

**Recommended split**:
- `StateManager.ts` — state container + getters
- `StateMutations.ts` — all setter/mutation methods
- Keep manager references in `StateManager` since it's the injection point

### `game/GameLoop.ts` (269 lines)
Already discussed above — extract helper functions.

---

## Patterns That Help LLMs (already good)

These patterns in the codebase are excellent for LLM comprehension:
- **AGENTS.md** — comprehensive architecture doc means LLMs don't have to infer patterns
- **Factory pattern** for systems — consistent `createXxxSystem` signature
- **Named constants at file top** in PlayerMovementSystem — clear what's tunable
- **Handler pattern** for interactions — adding a new handler is copy-paste predictable
- **Type re-exports** from `types/index.ts` — single import point

---

## Refactoring Strategy

1. **Extract GameLoop helpers** — biggest readability win, low risk
2. **Split StateManager mutations** — reduces god-object cognitive load
3. **Extract GameScene hooks** — standard React best practice
4. **Add section headers** to Game.ts — zero-risk documentation improvement
5. **Rename `automatic` to `fireMode`** — prevents misinterpretation (breaking change, needs weapon config updates)
