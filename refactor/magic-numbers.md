# Magic Numbers

Unnamed numeric literals scattered through logic. Each should be a named constant in the relevant config or at the top of the file, with a comment explaining *why* that value.

---

## HIGH PRIORITY (Gameplay-affecting, frequently touched by LLMs)

### 1. GameLoop.ts — health regeneration

**File:** `game/GameLoop.ts` ~lines 336-338

```ts
// Current:
if (now - sm.gameState.lastDamageTime > 3000) ...  // 3000ms = 3s delay
if (now - sm.gameState.lastRegenTime > 50) ...     // 50ms = regen tick rate
sm.setHealth(sm.gameState.health + 5);             // +5 HP per tick
```

These three values control the entire regen system. Should be in `GAME_CONFIG`:
- `REGEN_DELAY_MS: 3000`
- `REGEN_TICK_MS: 50`
- `REGEN_AMOUNT: 5`

---

### 2. ZombieSpawnSystem.ts — spawn mechanics

**File:** `systems/zombie/ZombieSpawnSystem.ts` ~lines 40, 65-66

- `0.5` — emerge speed (how fast zombie rises from ground)
- `4.0` — lid break animation duration
- `5` — total lid bounces during break

Should be constants at top of file or in `ZOMBIE_CONFIG`.

---

### 3. ZombieAISystem.ts — AI tuning

**File:** `systems/zombie/ZombieAISystem.ts` ~lines 204, 238

- `0.9` — attack range factor multiplied against base range
- `0.05` — random jitter added to path update interval

These affect zombie behavior significantly. Name them `ATTACK_RANGE_FACTOR` and `TARGET_UPDATE_JITTER`.

---

### 4. PowerUpSystem.ts — visual/timing

**File:** `systems/PowerUpSystem.ts` ~lines 41, 128, 139

- `150` — pause detection threshold (ms) — should be `PAUSE_DETECTION_THRESHOLD_MS`
- `0.02` — power-up rotation speed — should be `POWERUP_ROTATION_SPEED`
- `200` — blink frequency during expiry — should be `POWERUP_BLINK_FREQUENCY_MS`

---

### 5. ProjectileSystem.ts — physics

**File:** `systems/ProjectileSystem.ts` ~lines 145, 229

- `100` — explosion flash timer duration (ms)
- `0.5` — ray start offset for projectile collision

---

## MEDIUM PRIORITY (Visual/structural, less often edited)

### 6. Game.ts — camera setup

**File:** `game/Game.ts` ~lines 136-148

- `maxZ = 500` — far clip plane
- `angularSensibility = 800` — mouse sensitivity
- `ellipsoid (0.25, 0.6, 0.25)` — player collision capsule

These define the player's physical presence. Should be `CAMERA_CONFIG` or `PLAYER_PHYSICS`.

---

### 7. LevelBuilder.ts — window/plank geometry

**File:** `engine/LevelBuilder.ts` ~lines 152-166, 550-588

- Plank rotation offsets: `0.02, -0.05, 0.05, -0.03, 0.04`
- Random rotation range: `0.1`, `0.05`
- Hole width: `1.4`
- Frame thickness: `0.2`, height: `0.06`
- Trigger dimensions: `1.6, 2, 1.6`

---

### 8. GameLoop.ts — timing intervals

**File:** `game/GameLoop.ts` ~lines 166-167, 275

- `500` — FPS counter update interval (ms)
- `167` — developer stats throttle interval (~6 Hz)

---

### 9. ParticleManager.ts — physics constants

**File:** `managers/visual/ParticleManager.ts` — scattered throughout

- Gravity `new BABYLON.Vector3(0, -9.8, 0)` repeated in multiple particle configs
- Emission rates: `500`, `150`, `100` etc.
- Speed values: `0.02`, `0.05`, etc.

Consider a `PARTICLE_DEFAULTS` config object.

---

### 10. UI components

**File:** `ui/components/PowerUpDisplay.tsx` ~line 149
- `24` (SVG circle radius), `30000` (30s power-up duration) — should be named constants

**File:** `ui/components/DownedOverlay.tsx` ~line 30
- `45` — "approximate max bleed out time" duplicates `GAME_CONFIG.DOWNED_BLEED_OUT_TIME / 1000`

**File:** `ui/components/Crosshair.tsx` ~line 30
- `new Set(['ray_gun'])` — hardcoded weapon ID for crosshair override. Should reference config.

---

### 11. HellhoundManager.ts

**File:** `managers/HellhoundManager.ts` ~lines 127-132

- `1.5` — attack radius
- `50` — damage per attack

Should be in `HELLHOUND_CONFIG` or `config/enemies.ts`.

---

### 12. CommandRegistry.ts — debug coordinates

**File:** `engine/CommandRegistry.ts` ~lines 155-164, 266-272

- Multiple hardcoded `Vector3` test positions
- Path tube radius `0.15`

Acceptable for debug-only code, but a `DEBUG_DEFAULTS` section would help.

---

### 13. FOV values in gameplay.ts

**File:** `config/gameplay.ts` lines 19-20

```ts
BASE_FOV: 1.1,
ADS_FOV: 0.6,
```

These are **scale multipliers**, not degrees. The names `BASE_FOV` and `ADS_FOV` suggest degrees/radians. Rename to `FOV_SCALE_HIP` and `FOV_SCALE_ADS` or add a comment.
