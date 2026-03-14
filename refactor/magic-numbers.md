# Magic Numbers

Hardcoded values scattered across systems that should be in config files or named constants. These are the #1 reason LLMs produce inconsistent changes — they find one value to change but miss the duplicates elsewhere.

---

## HIGH PRIORITY — Duplicated Values

### Speed Variation Multiplier (duplicated in 2 managers)
- `managers/ZombieManager.ts` ~line 305: `0.9 + (Math.random() * 0.2)`
- `managers/HellhoundManager.ts` ~line 245: `0.9 + (Math.random() * 0.2)`
- **Fix**: Add `SPEED_VARIATION_MIN: 0.9, SPEED_VARIATION_RANGE: 0.2` to gameplay config.

### Double Tap Fire Rate Multiplier
- `systems/player/PlayerCombatSystem.ts` ~line 128: `1.33`
- **Fix**: Add `DOUBLE_TAP_FIRE_RATE_MULT: 1.33` to `COMBAT_CONFIG`.

### Movement Deadzone (inconsistent with settings)
- `engine/InputManager.ts` ~line 687: hardcoded `0.2` for left stick
- `engine/InputManager.ts` ~line 662: uses `this.settings.controllerDeadzone` for right stick
- **Fix**: Use `this.settings.controllerDeadzone` for both sticks.

---

## MEDIUM PRIORITY — System-Specific Constants

### PlayerMovementSystem.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~88  | `1.5` | Pitch limit (radians) |
| ~173 | `-0.8` | Terminal velocity clamp |
| ~210 | `0.2` | Position adjustment factor |
| ~230 | `0.85` | External force decay |

### DownedSystem.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~56  | `0.01` | Camera snap threshold |
| ~58  | `0.12` | Camera lerp factor (downed) |
| ~61  | `0.02` | Camera snap threshold (standing) |
| ~74  | `0.1` | Camera lerp factor (standing) |

### WeaponViewSystem.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~26  | `0.2` | Weapon lerp factor |
| ~46  | `0.6` / `1.1` | FOV values (ADS / hip) |

### ZombieAnimationSystem.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~155 | `0.6` | Arm swing amplitude |
| ~164 | `1.275` / `0.05` | Torso Y position / bob amount |
| ~173 | `0.015` / `0.5` | Attack animation values |
| ~178 | `0.002` | Idle breathe factor |

### ZombieSpawnSystem.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~37  | `0.5` | Emerge speed |
| ~51  | `-3.5` | Spawn position Y |
| ~62  | `4.0` | Break duration |
| ~63  | `5` | Total bounces |
| ~87  | `-1.5` | Position threshold |

### MysteryBoxSystem.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~160 | `100` | Cycle speed |
| ~166-167 | `0.1` / `0.01` | Rotation speed / sine frequency |

### InteractionSystem.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~33  | `1.2` | Interaction ray Y offset |
| ~34  | `-0.5` | PaP display Z offset |
| ~165-166 | Various | PAP display rotation overrides |

### DecalManager.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~10  | `40` | MAX_DECALS |
| ~14  | `60` | MAX_BLOOD_DECALS |
| ~19  | `50` | DECAL_THROTTLE_MS |

### ParticleManager.ts
| Line | Value | What It Is |
|------|-------|------------|
| ~90  | `2` | MAX_ZOMBIE_EXPLOSIONS_PER_FRAME |

---

## Recommended Approach

Don't move ALL of these to config — some are truly internal constants that no map would override. Instead:

1. **Move to config**: Values that vary per map or that players/designers would tune (speeds, costs, timers, pool sizes)
2. **Move to named constants at file top**: Values that are fixed but appear as magic numbers (lerp factors, thresholds, animation parameters)
3. **Leave inline**: One-off values in obvious context (like `Math.PI`)

The key goal is **discoverability** — when an LLM is asked to "change zombie spawn speed", it should find a named constant, not dig through line 37 of ZombieSpawnSystem.
