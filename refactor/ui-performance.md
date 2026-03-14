# UI Performance Issues

React rendering inefficiencies that impact frame rate and could grow worse as the UI expands.

---

## 1. HUD.tsx — 16 Separate Store Subscriptions

**File**: `ui/HUD.tsx` ~lines 133-156
**Issue**: HUD subscribes to 16 individual Zustand selectors. Each selector change triggers a re-render of the entire HUD component, which then re-renders all children.

```typescript
const isGameOver = useGameStore(s => s.isGameOver);
const isPaused = useGameStore(s => s.isPaused);
const isSpectating = useGameStore(s => s.isSpectating);
// ... 13 more
```

**Impact**: Changing `remoteHealth` re-renders the entire HUD tree, including components that don't care about remote health.
**Fix Options**:
- Use Zustand's `useShallow` for grouped selectors that change together
- Move remote player subscriptions into the `PlayerStatus` component itself
- Wrap child components in `React.memo()` to prevent cascade re-renders

---

## 2. PlayerStatus — Not Memoized

**File**: `ui/components/PlayerStatus.tsx`
**Issue**: Performs calculations (`hpPercent`, perk lookups) on every render. Renders 4 `PerkIcon` children. Not wrapped in `React.memo()`.
**Fix**: Wrap with `React.memo()` and extract `PerkIcon` as a memoized sub-component.

---

## 3. PowerUpDisplay — New Array Every Render

**File**: `ui/components/PowerUpDisplay.tsx` ~lines 174-189
```typescript
const activePowerUpEntries = Object.entries(activePowerUps)
    .map(([type, expTime]) => ({ type: type as PowerUpType, expTime: expTime! }));
```
**Issue**: Creates a new array on every render even when `activePowerUps` hasn't changed. The `PowerUpIcon` child is expensive (SVG rendering + animations) and not memoized.
**Fix**: Wrap `activePowerUpEntries` in `useMemo()` keyed on `activePowerUps`. Memoize `PowerUpIcon`.

---

## 4. HUDOverlayEffects — Renders 8+ Gradient Divs

**File**: `ui/components/HUDOverlayEffects.tsx`
**Issue**: Calculates `bloodOpacity` and `isCritical` on every render, then renders 8+ divs with complex CSS gradients and filters. No memoization.
**Fix**: Wrap with `React.memo()`. The component only depends on `health` — re-renders are minimal but the render itself is heavy.

---

## 5. DownedOverlay — Duplicate Timer Effects

**File**: `ui/components/DownedOverlay.tsx` ~lines 12-34
**Issue**: Two separate `useEffect` hooks that could be consolidated:
1. Effect 1 (~line 12): Creates interval timer, updates `bleedOutTimeRemaining`
2. Effect 2 (~line 28): Watches `bleedOutTimeRemaining`, updates `pulseIntensity`

**Fix**: Consolidate into a single effect that calculates both values in one interval.

---

## 6. GameScene.tsx — Effect Runs on hasStarted Change

**File**: `ui/GameScene.tsx` ~lines 38-129
**Issue**: Network handler setup effect depends on `hasStarted`, causing it to re-run when the game starts. This recreates the message handler during gameplay.
**Fix**: Separate the handler setup from game state changes, or use a ref for `hasStarted`.

---

## 7. Crosshair — Could Be Memoized

**File**: `ui/components/Crosshair.tsx`
**Issue**: Renders complex conditional JSX with 5+ states. Only depends on 3 store selectors. Not memoized.
**Fix**: Wrap with `React.memo()` — cheap win.

---

## Priority

Item 1 (HUD subscriptions) is the most impactful. Every state change to any of 16 fields re-renders the entire HUD tree. This will scale poorly as more HUD components are added. Items 2-4 are quick `React.memo()` wins.
