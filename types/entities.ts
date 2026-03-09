
import * as BABYLON from '@babylonjs/core';

export enum ZombieState {
    SPAWNING = 'SPAWNING',
    BREAKING_LID = 'BREAKING_LID',
    APPROACHING_WINDOW = 'APPROACHING_WINDOW',
    ATTACKING_BARRIER = 'ATTACKING_BARRIER',
    ENTERING = 'ENTERING',
    CHASING = 'CHASING'
}

export enum HellhoundState {
    SPAWNING = 'SPAWNING',           // 0.5s invulnerable
    CHASING = 'CHASING',             // Continuous sprint
    ATTACK_WINDUP = 'ATTACK_WINDUP', // 0.3-0.4s stationary
    ATTACKING = 'ATTACKING',         // 0.2-0.3s lunge
    RECOVERY = 'RECOVERY',           // 0.8-1.0s vulnerable
}

export type EnemyType = 'ZOMBIE' | 'HELLHOUND';

export type WanderState = {
    angle: number;
    nextUpdateTime: number;
    wanderTarget: BABYLON.Vector3;
};

export type Zombie = {
    id: string;
    type: EnemyType;
    mesh: BABYLON.AbstractMesh;
    headMesh: BABYLON.AbstractMesh;
    torsoMesh?: BABYLON.AbstractMesh; // Added for crawling mechanics
    limbs?: {
        armL: BABYLON.AbstractMesh;
        armR: BABYLON.AbstractMesh;
        legL: BABYLON.AbstractMesh;
        legR: BABYLON.AbstractMesh;
    };
    health: number;
    maxHealth: number;
    speed: number;
    lastAttackTime: number;
    lastRemoteAttackTime?: number;
    isDead: boolean;
    state: ZombieState;
    // Hellhound specific state
    hellhoundState?: HellhoundState;
    stateTimer?: number;           // Time remaining in current state
    attackWindupDuration?: number; // Randomized 0.3-0.4s
    attackDuration?: number;       // Randomized 0.2-0.3s  
    recoveryDuration?: number;     // Randomized 0.8-1.0s
    lungeStartPos?: BABYLON.Vector3;
    lungeTargetPos?: BABYLON.Vector3;
    targetPlayerId?: string;       // Targeted player for hellhounds

    targetWindowId: string | null;
    barrierAttackTimer: number;
    isBurning?: boolean;
    lastBurnTime?: number;
    fireSystem?: BABYLON.ParticleSystem;
    smokeEffect?: BABYLON.ParticleSystem;
    lastHitTime?: number;
    // Navigation Helpers
    lastPosition?: BABYLON.Vector3;
    stuckTimer?: number;
    // Dismemberment
    isCrawling?: boolean;
    missingLimbs: {
        legL: boolean;
        legR: boolean;
        armL: boolean;
        armR: boolean;
    };
    spawnTime: number;
    // Wander state
    wander?: WanderState;
    // Navmesh Pathfinding (legacy — used only for hellhounds and non-crowd fallback)
    path?: BABYLON.Vector3[];
    pathCursor?: number;
    pathUpdateTimer?: number;
    pathfindingFailed?: boolean;  // Track if pathfinding has failed (to avoid console spam)
    warnedNavStart?: boolean;     // Track if we've warned about start position
    warnedNavEnd?: boolean;       // Track if we've warned about end position
    // Recast Crowd — index into the ICrowd agent array; undefined = not in crowd
    crowdAgentIndex?: number;
    // Spawn hole lid breaking
    targetLidId?: string;           // Ground spawn ID whose lid we're breaking
    lidBreakTimer?: number;         // Timer for lid bounce animation
    // Door Crossing
    doorGraceTimer?: number;
    lastDoorTarget?: BABYLON.Vector3;
    // GLB skeletal animation groups (walk, idle, attack)
    animationGroups?: {
        walk?: BABYLON.AnimationGroup;
        idle?: BABYLON.AnimationGroup;
        attack?: BABYLON.AnimationGroup;
    };
    currentAnim?: 'walk' | 'idle' | 'attack' | null;
};

export type Projectile = {
    mesh: BABYLON.AbstractMesh;
    direction: BABYLON.Vector3;
    speed: number;
    damage: number;
    life: number;
    isRemote: boolean;
    isPacked: boolean;
    owner: 'HOST' | 'CLIENT';
    /** Is this an explosive projectile (Ray Gun)? */
    isExplosive?: boolean;
    /** Splash damage radius in units */
    splashRadius?: number;
    /** Maximum splash damage at center */
    splashDamage?: number;
    /** Self damage multiplier when player hits themselves */
    selfDamageMultiplier?: number;
    /** Trail particle system for explosive projectiles */
    trailParticleSystem?: BABYLON.ParticleSystem | null;
};

export type WindowBarrier = {
    id: string;
    triggerMesh: BABYLON.AbstractMesh;
    boards: BABYLON.AbstractMesh[];
    position: BABYLON.Vector3;
    spawnPoint: BABYLON.Vector3;
    attackPoint: BABYLON.Vector3;
    entryPoint: BABYLON.Vector3;
    zone: number;
};

export type GroundSpawn = {
    id: string;
    position: BABYLON.Vector3;
    zone: number;
    lidMesh?: BABYLON.AbstractMesh;       // The visible lid mesh (null = open hole)
    triggerMesh?: BABYLON.AbstractMesh;   // Invisible trigger for player interaction
    hasLid: boolean;                      // Runtime state: is the lid currently placed?
    lastPointsRound?: number;             // Track the last round points were given to prevent farming
};
