# Dead Code

> Unused exports, unreachable paths, and stale code that adds noise for LLMs and humans alike.

---

## Unused Exports

### `managers/SoundManager.ts` ~line 115-117
```typescript
public getSound(name: string): HTMLAudioElement | undefined {
    return this.sounds.get(name);
}
```
**Issue**: No callers found in the codebase. If needed for future use, mark with `/** @internal — reserved for future debug tooling */`. Otherwise remove.

---

## Stale/Dead Variables

### `systems/zombie/zombieAIUtils.ts` ~line 102-103
```typescript
const cursor = z.pathCursor ?? 0;
```
**Issue**: `cursor` is assigned but the function body later re-checks `z.pathCursor` directly at line 143 instead of using `cursor`. Either use `cursor` consistently or remove the variable.

---

## Suppression Code with Bug

### `game/Game.ts` ~lines 77-84
```typescript
const suppressedWarn = (msg: string, ...args: any[]) => {
    if (typeof msg === 'string' && (msg.includes('context') || ...)) {
        return;
    }
    originalWarn(msg, args);  // BUG: should be ...args
};
```
**Issues**:
1. `originalWarn(msg, args)` passes args as a single array instead of spreading. Should be `originalWarn(msg, ...args)`.
2. The suppression is broad — any warning containing "context" is silently swallowed, including potentially useful ones.
3. Consider scoping the suppression more tightly (only during engine construction) and restoring `console.warn` immediately after.

---

## Debug Flag That's Never Enabled

### `engine/LevelBuilder.ts` ~line 380
```typescript
const DEBUG_SHOW_NAVFLOORS = false;
```
**Issue**: This flag is hardcoded `false` and never toggled. If it's useful for debugging, wire it to a debug command (`/shownavfloors`). If not, remove the conditional branch entirely.

---

## Refactoring Strategy

1. **Remove** `SoundManager.getSound()` if truly unused (verify with grep first)
2. **Fix** the `...args` spread bug in Game.ts console.warn suppression
3. **Use `cursor`** consistently in `zombieAIUtils.ts` or remove the variable
4. **Wire or remove** `DEBUG_SHOW_NAVFLOORS`
