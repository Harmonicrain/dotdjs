import * as BABYLON from '@babylonjs/core';
import { PowerUpType, Zombie } from '../../types';
import { HellhoundManager } from '../../managers/HellhoundManager';
import { ZombieManager } from '../../managers/ZombieManager';

export type DamageOwner = 'HOST' | 'CLIENT';

export interface SharedZombieDamageContext {
    gameState: {
        activePowerUps: Partial<Record<PowerUpType, number>>;
    };
    hellhoundManager: HellhoundManager;
    zombieManager: ZombieManager;
    addPoints(amount: number): void;
    hasDoublePoints(): boolean;
    send(data: { type: 'HIT_CONFIRM'; amount: number }): void;
}

export interface ApplyProjectileHitOptions {
    zombie: Zombie;
    damage: number;
    owner: DamageOwner;
    isHeadshot: boolean;
    isLegHit: boolean;
    hitMeshName?: string;
    hitDirection?: BABYLON.Vector3;
}

export interface ApplyExplosionHitOptions {
    zombie: Zombie;
    impactPoint: BABYLON.Vector3;
    splashRadius: number;
    splashDamage: number;
    owner: DamageOwner;
}

const CRAWLER_SPEED = 0.015;
const HEADSHOT_MULTIPLIER = 1.5;
const LEGSHOT_MULTIPLIER = 0.7;
const EXPLOSION_KILL_POINTS = 30;

function isInstaKillActive(gameState: SharedZombieDamageContext['gameState']): boolean {
    return !!(gameState.activePowerUps[PowerUpType.INSTA_KILL]
        && gameState.activePowerUps[PowerUpType.INSTA_KILL]! > Date.now());
}

function applyCrawlerState(zombie: Zombie, damage: number, hitMeshName?: string): void {
    if (zombie.type !== 'ZOMBIE' || zombie.isCrawling) return;
    if (damage <= 40 && zombie.health >= 40) return;

    zombie.isCrawling = true;
    zombie.speed = CRAWLER_SPEED;

    if (!hitMeshName || !zombie.missingLimbs) return;
    if (hitMeshName.includes('_l')) zombie.missingLimbs.legL = true;
    else if (hitMeshName.includes('_r')) zombie.missingLimbs.legR = true;
}

function awardHitPoints(
    ctx: SharedZombieDamageContext,
    owner: DamageOwner,
    isHeadshot: boolean,
    amountOverride?: number,
): void {
    const base = amountOverride ?? (isHeadshot ? 20 : 10);

    if (owner === 'HOST') {
        ctx.addPoints(ctx.hasDoublePoints() ? base * 2 : base);
        return;
    }

    ctx.send({ type: 'HIT_CONFIRM', amount: base });
}

function killZombie(
    ctx: SharedZombieDamageContext,
    zombie: Zombie,
    owner: DamageOwner,
    isHeadshot: boolean,
    hitDirection?: BABYLON.Vector3,
    headPos?: BABYLON.Vector3,
): void {
    if (zombie.health > 0 || zombie.isDead) return;

    if (zombie.type === 'HELLHOUND') {
        ctx.hellhoundManager.onHellhoundDeath(zombie, zombie.mesh.position, owner);
        return;
    }

    ctx.zombieManager.onZombieDeath(zombie, zombie.mesh.position, owner, isHeadshot, headPos, hitDirection);
}

export function applyProjectileHit(
    ctx: SharedZombieDamageContext,
    options: ApplyProjectileHitOptions,
): void {
    const { zombie, damage, owner, isHeadshot, isLegHit, hitMeshName, hitDirection } = options;

    if (zombie.isDead) return;

    let finalDamage = damage;
    if (isInstaKillActive(ctx.gameState)) {
        finalDamage = zombie.maxHealth;
    } else if (isHeadshot) {
        finalDamage *= HEADSHOT_MULTIPLIER;
    } else if (isLegHit) {
        finalDamage *= LEGSHOT_MULTIPLIER;
    }

    zombie.lastHitTime = Date.now();
    zombie.health -= finalDamage;

    if (isLegHit) {
        applyCrawlerState(zombie, finalDamage, hitMeshName);
    }

    awardHitPoints(ctx, owner, isHeadshot);

    const headPos = zombie.headMesh ? zombie.headMesh.absolutePosition : undefined;
    killZombie(ctx, zombie, owner, isHeadshot, hitDirection, headPos);
}

export function applyExplosionHit(
    ctx: SharedZombieDamageContext,
    options: ApplyExplosionHitOptions,
): void {
    const { zombie, impactPoint, splashRadius, splashDamage, owner } = options;

    if (zombie.isDead) return;

    const distSq = BABYLON.Vector3.DistanceSquared(impactPoint, zombie.mesh.position);
    const splashRadiusSq = splashRadius * splashRadius;
    if (distSq > splashRadiusSq) return;

    const dist = Math.sqrt(distSq);
    const damageRatio = 1 - (dist / splashRadius);
    const finalDamage = isInstaKillActive(ctx.gameState)
        ? zombie.maxHealth
        : (splashDamage * damageRatio);

    zombie.lastHitTime = Date.now();
    zombie.health -= finalDamage;

    if (dist > splashRadius * 0.3) {
        applyCrawlerState(zombie, finalDamage);
    }

    if (zombie.health > 0 || zombie.isDead) return;

    const blastDir = zombie.mesh.position.subtract(impactPoint).normalize();
    killZombie(ctx, zombie, owner, false, blastDir);
    awardHitPoints(ctx, owner, false, EXPLOSION_KILL_POINTS);
}
