
export const GAME_CONFIG = {
  GRAVITY: -0.025, // Stronger gravity for snappier fall
  JUMP_FORCE: 0.25,
  WALK_SPEED: 4.2,
  SPRINT_SPEED: 8.4,
  JUGGERNOG_COST: 2000,
  SPEED_COLA_COST: 3000,
  QUICK_REVIVE_COST: 1500,
  DOUBLE_TAP_COST: 2000,
  MULE_KICK_COST: 4000,
  PACK_A_PUNCH_COST: 4500,
  PACK_A_PUNCH_AMMO_COST: 2500,
  STARTING_POINTS: 500, 
  PLAYER_HEIGHT: 1.85, // Matched to Zombie eye-level (approx 6ft)
  PLAYER_EYE_HEIGHT: 1.65,
  PLAYER_DOWNED_HEIGHT: 0.4,
  PLAYER_WIDTH: 0.5, // Slimmer width for easier doorway navigation
  MAX_REPAIR_POINTS_PER_ROUND: 50, 
  BASE_FOV: 1.1, 
  ADS_FOV: 0.6,  
  // HEALTH & DAMAGE
  PLAYER_BASE_HEALTH: 100,
  PLAYER_JUGG_HEALTH: 250,
  DAMAGE_IMMUNITY_MS: 500,
  ZOMBIE_HEALTH_BASE: 100,
  ZOMBIE_HEALTH_INC: 50,
  ZOMBIE_DAMAGE: 25,
  
  // DOWNED & REVIVE
  DOWNED_PISTOL_RESERVE: 48,     // M1911 reserve ammo while downed (limited supply)
  DOWNED_BLEED_OUT_TIME: 45000,
  REVIVE_BASE_TIME: 5000,        
  REVIVE_QUICK_TIME: 2500,       
  SOLO_SELF_REVIVE_TIME: 10000,  
  REVIVE_HEALTH: 30,              
  MAX_QUICK_REVIVES_SOLO: 3,      
  REVIVE_REWARD: 50,
  REVIVE_DISTANCE: 2.5,
  REPAIR_COOLDOWN: 1200,
  
  // POINTS
  POINTS_KILL: 80,
  POINTS_HEADSHOT: 20,
  POINTS_HIT: 10,
  POINTS_REPAIR: 10
};

export const ZOMBIE_CONFIG = {
  SPEED_VARIATION_MIN: 0.9,   // min multiplier applied to base speed (90%)
  SPEED_VARIATION_RANGE: 0.2, // random range added on top (90%–110%)
  SPAWN_SOUND_CHANCE: 0.20,
  SPAWN_SOUND_MAX_DIST: 35,
  SPAWN_SOUND_CONCURRENT: 6,
  SPAWN_SOUND_VOLUME: 0.7,
  SPAWN_SOUND_COOLDOWN_MS: 5000,
  ATTACK_RANGE: 1.5,
  ATTACK_COOLDOWN: 1000,
  BURN_INTERVAL: 400,
  BURN_DAMAGE: 15,
  WANDER_UPDATE_MIN: 1000,
  WANDER_UPDATE_MAX: 2000,
  WANDER_DIST_MIN: 8,
  WANDER_DIST_MAX: 14,
  WANDER_TARGET_THRESHOLD: 1.5,
  DOOR_APPROACH_DIST: 3.0,
  DOOR_SPEED_MOD: 1.3,
  BARRIER_ATTACK_INTERVAL: 1.5,
  STUCK_TIMEOUT: 60000
};

export const COMBAT_CONFIG = {
  DOUBLE_TAP_FIRE_RATE_MULT: 1.33, // fire-rate divisor when Double Tap perk is active
  PROJECTILE_SPEED: 2.5,
  HIP_FIRE_SPREAD: 0.05,
  KNIFE_HIT_DELAY_MS: 150,
  KNIFE_RANGE: 2.0,
  KNIFE_ANIM_DURATION: 0.5,
  MIN_PROJECTILE_SPAWN_DIST: 0.5,
  INSTA_KILL_DAMAGE: 999999,
  KNIFE_DAMAGE: 150,
  ATTACK_HEIGHT_THRESHOLD: 3.0,
  KNOCKBACK_FORCE: 0.12
};

export const VISUAL_CONFIG = {
  BLOOD_POOL_SIZE: 20,
  BLOOD_PLANE_SIZE: 0.5,
  BLOOD_NORMAL_OFFSET: 0.02,
  BLOOD_INITIAL_ALPHA: 0.9,
  BLOOD_FADE_SPEED: 0.02,
  HIT_FLASH_DURATION: 100,
  ZOMBIE_ANIM_SPEED_FACTOR: 25,
  HELLHOUND_ANIM_SPEED_FACTOR: 60,
  ANIM_TIME_FACTOR: 0.01,
  HUD_MSG_DURATION: 1500,
  BOX_HUD_MSG_DURATION: 1000,
  POWER_HUD_MSG_DURATION: 2000,
  ROUND_INTRO_MSG_DURATION: 3000,
  MAX_ZOMBIE_RESIDUE: 10
};

export const POWERUP_CONFIG = {
  DROP_CHANCE: 0.03,
  DURATION: 30000,
  PICKUP_RADIUS: 1.5,
  BLINK_START: 20000,
  EFFECT_DURATION: 30000,
  POINTS_THRESHOLD_START: 2000,
  POINTS_THRESHOLD_MULTIPLIER: 1.14,
  NUKE_POINTS: 400,
  CARPENTER_POINTS: 200
};

export const ROUND_CONFIG = {
  /** Zombie counts per round (rounds 1-5), then scaling formula kicks in */
  ZOMBIE_COUNTS_BY_ROUND: [6, 8, 12, 16, 22] as readonly number[],
  /** Zombies added per round beyond round 5 */
  ZOMBIE_SCALING_PER_ROUND: 3,
  /** Multiplier for zombie count in co-op (HOST mode) */
  COOP_ZOMBIE_MULTIPLIER: 1.5,
  /** Max zombies alive at once — unused directly; computed dynamically in RoundSystem as min(24, 3 + round * 2) */
  MAX_CONCURRENT_ZOMBIES: 24,
  /** Base spawn delay in ms (decreases by SPAWN_DELAY_REDUCTION_PER_ROUND each round) */
  BASE_SPAWN_DELAY_MS: 3800,
  /** Minimum spawn delay in ms */
  MIN_SPAWN_DELAY_MS: 800,
  /** Ms removed from spawn delay per round */
  SPAWN_DELAY_REDUCTION_PER_ROUND: 150,
  /** Dog round frequency (every Nth round) */
  DOG_ROUND_FREQUENCY: 5,
  /** First dog round can occur between these rounds */
  DOG_ROUND_FIRST_MIN: 5,
  DOG_ROUND_FIRST_MAX: 7,
  /** Delays and counts */
  DOG_ROUND_START_DELAY: 4000,
  DOG_SPAWN_DELAY_MIN: 3000,
  DOG_SPAWN_DELAY_MAX: 5000,
  DOG_BASE_COUNT: 6,
  DOG_ROUND_INCREMENT: 2,
  DOG_COOP_BONUS: 4,
  DOG_MAX_CONCURRENT: 8,
  
  /** Time between rounds in ms */
  INTERMISSION_MS: 10000,
  /** How long the round intro banner shows in ms */
  ROUND_INTRO_DURATION_MS: 3000,
  /** Respawn points formula: BASE + round * PER_ROUND */
  RESPAWN_POINTS_BASE: 500,
  RESPAWN_POINTS_PER_ROUND: 250,
  ZOMBIE_SPEED_INC: 0.005,
};

export const CONTROLLER_CONFIG = {
  SENSITIVITY_X: 2.5,
  SENSITIVITY_Y: 1.5,
  BASE_MOUSE_SENSITIVITY: 0.002,
  DEADZONE: 0.15,
  TRIGGER_THRESHOLD: 0.1
};

export const SYNC_CONFIG = {
  INTERPOLATION_SPEED: 0.5,
  ZOMBIE_SEPARATION_FORCE: 0.8,
  ZOMBIE_SEPARATION_DIST: 1.0,
  ZOMBIE_BOTTLENECK_FORCE: 0.1,

  // ── Network tick ─────────────────────────────────────────────────────
  /** How often (ms) NetworkSystem sends STATE or INPUT. 50 ms = 20 Hz. */
  NETWORK_TICK_MS: 50,
  /** How often (ms) a full (non-delta) snapshot is forced to prevent drift. */
  FULL_SYNC_INTERVAL_MS: 5000,
  /** Position delta threshold (metres) below which a zombie is considered stationary. */
  ZOMBIE_POSITION_THRESHOLD: 0.05,
  /** Decimal places to round floats before sending. 2 dp = 1 cm precision. */
  FLOAT_PRECISION: 2,
  /** Interpolation buffer delay in ms – how far behind real-time the remote player is rendered. */
  INTERPOLATION_BUFFER_MS: 100,
};

export const DEFAULT_SETTINGS = {
  inputDevice: 'KM' as const,
  mouseSensitivity: 1.0,
  controllerSensitivity: 1.0,
  controllerDeadzone: 0.15,
  touchSensitivity: 5.0,
  masterVolume: 1.0,
  weaponVolume: 1.0,
  zombieVolume: 1.0,
  effectsVolume: 1.0,
};

// Speeds are per-frame (approx 1/60th of a second) relative to 1 unit = 1 meter
// Player Walk ~ 0.045, Player Sprint ~ 0.09
export const ZOMBIE_SPEEDS = {
    CRAWLER: 0.015,       // ~0.9 m/s (Very slow)
    WALKER: 0.035,        // ~2.1 m/s (Slower than walk)
    RUNNER: 0.07,         // ~4.2 m/s (Faster than walk, slower than sprint)
    SPRINTER: 0.10,       // ~6.0 m/s (Faster than player sprint without stamina)
    SUPER_SPRINTER: 0.125 // ~7.5 m/s (Very fast)
};


