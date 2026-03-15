# Missing Guards

> Missing pause guards, authority checks, and safety validations that could cause bugs during edge cases (pausing, level reload, network authority transitions).

---

## Missing Pause Guards

### `systems/PowerUpSystem.ts` ~line 37-121
**Problem**: Returns early if `!ctx.gameState.hasStarted` but does NOT check `isPaused` at the top of `update()`. Active power-up effects (lines 108-120) continue to be processed while paused, which could cause effects to expire during pause.
**Expected guard** (per AGENTS.md zombie-style):
```typescript
if (ctx.gameState.isPaused) return;
```
**Note**: The `lastTickTime` compensation at line 41 partially mitigates this, but the guard should still exist for consistency.

### `systems/zombie/ZombieCleanupSystem.ts` ~lines 30-42
**Problem**: Returns early on `isDebugMode` but NOT on `isPaused`. Zombies can be cleaned up (disposed) while the game is paused. This violates the zombie system pause guard table in AGENTS.md Section 5a.
**Expected guard**:
```typescript
if (ctx.gameState.isDebugMode || ctx.gameState.isPaused) return;
```

---

## Missing Safety Validations

### `systems/zombie/ZombieAISystem.ts` ~lines 71-82
**Problem**: `addZombieToCrowd()` adds agents to the Recast crowd but never checks if the crowd is full. The constant `MAX_CROWD_AGENTS = 64` is defined at line 38, but no validation occurs before `crowd.addAgent()`.
**Impact**: If 65+ zombies exist simultaneously (possible in high rounds with slow cleanup), the 65th agent silently fails to add. The zombie will have no pathfinding and stand still.
**Fix**:
```typescript
if (crowd.getAgentCount() >= MAX_CROWD_AGENTS) {
    console.warn('Crowd agent limit reached, zombie will use fallback AI');
    return false;
}
```

### `systems/RoundSystem.ts` ~line 59
```typescript
Math.min(round, 5)
```
**Problem**: Hardcoded `5` assumes `ZOMBIE_COUNTS_BY_ROUND` always has 5 entries. If someone shortens the array, this silently accesses `undefined`.
**Fix**:
```typescript
Math.min(round, ZOMBIE_COUNTS_BY_ROUND.length)
```

---

## Missing Authority Checks

### `systems/interaction/handlers/` — Decentralized authority
**Problem**: Authority validation is NOT done at the `InteractionSystem` level. Each individual handler must implement its own authority check. This is documented nowhere and easy to forget when adding a new handler.
**Impact**: A new handler created by an LLM that forgets the authority check will execute on both HOST and CLIENT, causing duplicate state mutations.
**Recommended**: Add to the `InteractionHandler` interface:
```typescript
interface InteractionHandler {
    type: string;
    requiresAuthority?: boolean;  // If true, InteractionSystem skips on CLIENT
    canInteract(mesh, stateManager): InteractionResult;
    interact(mesh, stateManager): void;
}
```

---

## Missing Null Safety

### `systems/interaction/handlers/MysteryBoxHandler.ts` ~line 45
```typescript
stateManager.mysteryBoxSystem?.interact()
```
**Problem**: Optional chaining handles the null case but silently returns `undefined`. The subsequent check `if (!res || res === 'NO_POINTS')` treats undefined the same as "no points", which masks the real issue (system not initialized).
**Fix**: Add an explicit warning:
```typescript
if (!stateManager.mysteryBoxSystem) {
    console.warn('MysteryBoxSystem not initialized');
    return;
}
```

### `systems/RemotePlayerSystem.ts` ~lines 35-38
**Problem**: Disables remote player rendering in SOLO mode but has no pause guard. If the game is paused while a remote player exists (edge case during mode transition), the system continues processing.

---

## Summary by Priority

| Priority | Issue | File |
|----------|-------|------|
| **High** | ZombieCleanupSystem missing pause guard | `systems/zombie/ZombieCleanupSystem.ts` |
| **High** | Crowd agent overflow not checked | `systems/zombie/ZombieAISystem.ts` |
| **High** | PowerUpSystem effects tick during pause | `systems/PowerUpSystem.ts` |
| **Medium** | Hardcoded array length in RoundSystem | `systems/RoundSystem.ts` |
| **Medium** | Decentralized authority in handlers | `systems/interaction/handlers/` |
| **Low** | Silent MysteryBox null | `systems/interaction/handlers/MysteryBoxHandler.ts` |
| **Low** | RemotePlayerSystem no pause guard | `systems/RemotePlayerSystem.ts` |
