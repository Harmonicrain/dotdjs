
export const HELLHOUND_CONFIG = {
  // Health
  HEALTH_BASE: 100,
  HEALTH_INC: 50,
  HEALTH_CAP: 800,
  
  // Speed (1.8x player sprint)
  // Player sprint = 8.4, so 8.4 * 1.8 = 15.12 units/sec
  // Per-frame (60fps) approx 0.25
  SPEED_BASE: 0.25,
  
  // Attack
  ATTACK_INITIATE_RANGE: 3.0,
  DAMAGE: 35,
  KNOCKBACK_FORCE: 0.25,
  LUNGE_DISTANCE: 1.5,
  LUNGE_SPEED_MULTIPLIER: 2.5,  // Speed multiplier during lunge (matches current AI system)
  
  // State Timings (ms)
  SPAWN_INVULN_TIME: 500,
  ATTACK_WINDUP_MIN: 300,
  ATTACK_WINDUP_MAX: 400,
  ATTACK_DURATION_MIN: 200,
  ATTACK_DURATION_MAX: 300,
  RECOVERY_MIN: 800,
  RECOVERY_MAX: 1000,
  
  // Death
  DEATH_EXPLOSION_RADIUS: 1.5,
  DEATH_EXPLOSION_DAMAGE: 15,
  KILL_POINTS: 70,
  
  // Spawning
  SPAWN_MIN_DISTANCE_FROM_PLAYER: 8,
  SPAWN_MAX_DISTANCE_FROM_PLAYER: 25,
  PRE_SPAWN_LIGHTNING_TIME: 500,
};

export const MYSTERY_BOX_CONFIG = {
    COST: 950,
    TIMING: {
        OPENING: 750,        // 0.75s
        ROLLING: 3500,       // 3.5s
        WEAPON_PRESENT: 10000, // 10s
        CLOSING: 600,        // 0.6s
        TEDDY_REVEAL: 2000,  // 2.0s
        TEDDY_WAIT: 2000,    // 2.0s
        TELEPORT: 500        // 0.5s
    },
    TEDDY_CHANCE: 0.15 // 15% Chance
};

