# Magic Numbers

> Hardcoded numeric values scattered across source files that should be named constants or moved to config. These make tuning difficult and confuse LLMs about what values are intentional vs arbitrary.

---

## Visual Managers (High density)

### `managers/visual/DecalManager.ts`
| Line | Value | Context | Suggested Config Key |
|------|-------|---------|---------------------|
| 10 | `40` | MAX_DECALS | `VISUAL_CONFIG.DECAL.MAX_BULLET` |
| 14 | `60` | MAX_BLOOD_DECALS | `VISUAL_CONFIG.DECAL.MAX_BLOOD` |
| 19 | `50` | DECAL_THROTTLE_MS | `VISUAL_CONFIG.DECAL.THROTTLE_MS` |
| 60 | `0.2` | bullet decal size | `VISUAL_CONFIG.DECAL.BULLET_SIZE` |
| 88 | `0.15` | blood decal size | `VISUAL_CONFIG.DECAL.BLOOD_SIZE` |

### `managers/visual/GoreManager.ts`
| Line | Value | Context | Suggested Config Key |
|------|-------|---------|---------------------|
| 18 | `20` | poolSize | `VISUAL_CONFIG.GORE.POOL_SIZE` |
| 20 | `60` | MAX_FLOOR_GORE | `VISUAL_CONFIG.GORE.MAX_FLOOR` |
| 77 | `30000` | FADE_MS (gore fade duration) | `VISUAL_CONFIG.GORE.FADE_MS` |
| 109 | `0.4 + Math.random() * 0.45` | gore disc scale | `VISUAL_CONFIG.GORE.SCALE_MIN/MAX` |

### `managers/visual/ParticleManager.ts`
15+ hardcoded pool sizes that should be a single config object:
| Line | Value | Context |
|------|-------|---------|
| 5 | `2` | MAX_FLASH_LIGHTS |
| 11 | `3` | MAX_EXPLOSION_PS |
| 15 | `20` | MAX_TRAIL_PS |
| 19 | `15` | MAX_IMPACT_PS |
| 23 | `15` | MAX_BLOOD_PS |
| 27 | `10` | MAX_DEBRIS_PS |
| 31 | `5` | MAX_DIRT_BURST_PS |
| 35-55 | various | Explosion sub-type and spawn effect pool sizes |

**Recommendation**: Create a `VISUAL_CONFIG` object in `config/visual.ts` with subsections for `DECAL`, `GORE`, `PARTICLE_POOLS`.

---

## Systems

### `systems/InteractionSystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 79 | `0.05` | Door animation threshold | Named constant |
| 87 | `0.1` | Door animation lerp factor | Named constant |
| 109 | `Math.PI / 4` | Power switch rotation angle | Named constant |
| 165-173 | `Math.PI / 2`, `Math.PI` | PaP animation rotations | Named constants |
| 178-184 | `1.0`, `2.5`, `3.0`, `0.05` | Animation time thresholds | Named constants |
| 190 | `3000` | Cleanup timer ms | Named constant or config |
| 208 | `512` | PaP texture size | Named constant |
| 241 | `4` | Pixel step for curve smoothing | Named constant |
| 246-247 | `2.5`, `0.3` | Wobble frequency/amplitude | Named constants |

### `systems/PowerUpSystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 41 | `150` | Pause detection threshold ms | Named constant |
| 100 | `2` | Spawn offset multiplier | Named constant |
| 128 | `0.02` | Rotation speed | Named constant or config |
| 139 | `200` | Blink interval ms | Named constant or config |

### `systems/zombie/ZombieSpawnSystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 16-17 | `-3.5`, `-1.5` | Ground spawn Y positions | Named constants |
| 40 | `0.5` | Emergence speed | Named constant |
| 65 | `4.0` | Break duration seconds | Named constant |
| 69 | `0.04` | Lid offset | Named constant |

### `systems/zombie/ZombieAISystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 38-50 | `0.4`, `1.8`, `8.0`, `2.1`, `0.5`, `1.0` | Crowd agent params | Config object |
| 115 | `Math.PI * 140 / 180` | FOV angle | Named constant `ATTACK_FOV_RAD` |
| 204, 270 | `0.9` | Attack range multiplier (duplicated) | Single named constant |
| 238 | `0.05` | Random path update offset | Named constant |

### `systems/zombie/ZombieAnimationSystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 30-32 | `-0.2`, `1.5`, `3` | Fire particle box bounds | Named constants |
| 57-65 | `50`, `0.2-0.5`, `0.3-0.6`, `30` | Fire system particle values | Config object |

### `systems/zombie/ZombieWindowAISystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 101 | `0.01`, `0.15` | Mesh rotation sin multipliers | Named constants |
| 113 | `0.25` | Distance threshold | Named constant |
| 150 | `0.15` | Position Y threshold | Named constant |

### `systems/player/PlayerMovementSystem.ts`
Already uses named constants (good), but they're file-local and not in config:
| Line | Value | Context |
|------|-------|---------|
| 40 | `3` | GROUND_CACHE_MAX_MISSES |
| 51 | `0.65` | CAMERA_SMOOTHING |
| 53 | `-0.8` | TERMINAL_VELOCITY |
| 54 | `0.2` | GROUND_SNAP_FACTOR |
| 55 | `0.85` | EXTERNAL_FORCE_DECAY |
| 92 | `1.5` | PITCH_LIMIT |

### `systems/RoundSystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 59 | `5` | Max index into ZOMBIE_COUNTS_BY_ROUND | Use `.length` instead |
| 147 | `3 + gs.round * 2` | Hellhound count formula | Config or named constants |

### `systems/MysteryBoxSystem.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 76, 81, 85 | `0.1`, `0.2` | Intensity multipliers | Named constants |

---

## Engine

### `engine/GeometryUtils.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 117 | `4` | Glow light range | Named constant |
| 130 | `0.8` | Glow light intensity | Named constant |
| 160 | `0.1` | Plank rotation jitter radians | Named constant |

### `engine/LevelBuilder.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 125 | `150.0` | Skybox size | Named constant |
| 176-177 | `8`, `16` | Default texture scales | Named constants |
| 540 | `1.4` | Ground spawn hole width | Named constant |
| 546-547 | `0.2`, `0.06` | Frame thickness/height | Named constants |

### `engine/InputManager.ts`
| Line | Value | Context | Fix |
|------|-------|---------|-----|
| 185 | `0.15` | Controller deadzone | Config (user-adjustable) |

---

## Refactoring Strategy

1. **Create `config/visual.ts`** with `VISUAL_CONFIG` for all decal/gore/particle pool sizes
2. **Extract named constants** at the top of each system file for values that are system-specific
3. **Move tuning-sensitive values to config** (controller deadzone, blink intervals, fade durations)
4. **Use array `.length`** instead of hardcoded `5` in RoundSystem
5. **Deduplicate** the `0.9` attack range multiplier in ZombieAISystem
