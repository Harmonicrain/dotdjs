# Missing Guards

Systems missing pause guards, authority checks, or lastTickTime compensation as required by AGENTS.md sections 5a-5b.

---

## PAUSE GUARDS (Section 5a)

### 1. MysteryBoxSystem — NO pause guard at all

**File:** `systems/MysteryBoxSystem.ts` ~line 348

The `update()` function has no guard for `isPaused` or `isDebugMode`. Per AGENTS.md, MysteryBoxSystem is called directly in `GameLoop.ts` (not via SystemManager), so it **must** have its own pause guard.

**Impact:** If somehow called during pause (e.g., GameLoop freeze logic changes), box timers will advance and state transitions will fire while the game is paused.

**Fix:**
```ts
update: (dt: number, now: number) => {
    if (ctx.gameState.isPaused || ctx.gameState.isDebugMode) return;
    // ... existing logic
}
```

---

### 2. RemotePlayerSystem — missing isPaused check

**File:** `systems/RemotePlayerSystem.ts` ~line 28-29

Only checks `!ctx.gameState.hasStarted`. Should also check `isPaused` per the system guard table in AGENTS.md 5a.

**Fix:** Add `|| ctx.gameState.isPaused` to the early-return condition.

---

### 3. WeaponViewSystem — minimal guard

**File:** `systems/player/WeaponViewSystem.ts` ~line 32

Only checks `hasStarted`. As a player system, it should follow the full player guard pattern:

```ts
if (!ctx.gameState.hasStarted || ctx.gameState.isPaused || ctx.gameState.isSpectating
    || ctx.gameState.isGameOver || ctx.gameState.isConsoleOpen) return;
```

Currently, weapon sway/bob animations continue during pause, game over, and spectating.

---

### 4. PlayerCombatSystem — missing isConsoleOpen

**File:** `systems/player/PlayerCombatSystem.ts` ~line 343

Has 4 guard conditions but is missing `isConsoleOpen`, which other player systems check. Players can potentially trigger combat inputs while the console is open.

---

## AUTHORITY CHECKS

### 5. PackAPunchSystem — no authority check on performPackAPunch

**File:** `systems/interaction/handlers/PackAPunchHandler.ts` or `systems/MysteryBoxSystem.ts` (PaP handler)

The `performPackAPunch` function processes the weapon upgrade without verifying `isAuthority`. In multiplayer, a client could trigger PaP locally.

**Fix:** Add authority check before processing the upgrade.

---

## lastTickTime COMPENSATION (Section 5b)

### 6. MysteryBoxSystem — timers vulnerable to pause gaps

**File:** `systems/MysteryBoxSystem.ts` ~lines 366-368

```ts
box.stateTimer -= dt * 1000;
```

Uses `dt` to decrement timers without `lastTickTime` compensation. After a long pause, `dt` could be huge (entire pause duration), causing all state transitions to fire instantly.

**Impact:** Unpausing mid-mystery-box-roll could skip the animation and jump to weapon reveal.

**Fix:** Add the `lastTickTime` pattern from AGENTS.md 5b:
```ts
let lastTickTime = 0;
// In update:
if (lastTickTime !== 0 && now - lastTickTime > 150) {
    // Clamp dt to prevent timer skip
}
lastTickTime = now;
```

---

### 7. TimerManager — no pause awareness

**File:** `engine/TimerManager.ts` ~lines 31-41

`TimerManager.update(dt)` has no concept of pause state. It relies entirely on calling code to not call `update()` during pause. But AGENTS.md notes that some systems are called outside SystemManager, so there's no enforcement.

**Impact:** If any code path calls `timerManager.update()` during pause, all scheduled timers will fire.

**Suggestion:** Consider adding an `isPaused` flag to TimerManager, or document the contract more explicitly.
