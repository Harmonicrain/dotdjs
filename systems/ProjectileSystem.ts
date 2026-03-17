import * as BABYLON from '@babylonjs/core';
import { GameMessage, PowerUpType, GameStateData, Zombie, Projectile, HellhoundState } from '../types/index';
import { EventBus } from '../engine/EventBus';
import { System } from '../types/systems';
import { COMBAT_CONFIG } from '../config';
import { TimerManager } from '../engine/TimerManager';
import { GameEngine } from '../game/GameEngine';
import { VisualManager } from '../managers/VisualManager';
import { ZombieManager } from '../managers/ZombieManager';
import { HellhoundManager } from '../managers/HellhoundManager';
import { MapConfigManager } from '../managers/MapConfigManager';

/** Shape passed to setDebugInfo when an object is picked in debug mode. */
export interface DebugMeshInfo {
    name: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scaling: { x: number; y: number; z: number };
    material: string;
    parent: string;
    metadata: unknown;
}

/** Narrowed SHOOT variant from the GameMessage union. */
export type ShootMessage = Extract<GameMessage, { type: 'SHOOT' }>;

export interface IProjectileContext {
    gameState: GameStateData;
    scene: BABYLON.Scene;
    camera: BABYLON.UniversalCamera;
    gameEngine: GameEngine;
    timerManager: TimerManager;
    visualManager: VisualManager;
    zombieManager: ZombieManager;
    hellhoundManager: HellhoundManager;
    eventBus: EventBus;
    zombies: Zombie[];
    gameModeRef: { current: string };
    configManager: MapConfigManager;
    staticLevelMeshes: Set<BABYLON.AbstractMesh>;
    debugSelection: {
        isActive: boolean;
        selectedMesh: BABYLON.AbstractMesh | null;
    };
    send(data: GameMessage): void;
    addPoints(amount: number): void;
    hasDoublePoints(): boolean;
    setDebugInfo(v: DebugMeshInfo): void;
    setFlashColor(v: string | null): void;
    setHealth(v: number): void;
    setIsDowned(v: boolean): void;
    setIsGameOver(v: boolean): void;
    applyDamageToLocalPlayer(amount: number, flashColor: string): void;
}

const COLOR_FLASH_NORMAL = new BABYLON.Color3(1, 0.9, 0.6);
const COLOR_FLASH_PACKED = new BABYLON.Color3(0.5, 0, 1);

// ── Scratch objects reused every frame to avoid per-projectile allocations ──
const _rayStart = new BABYLON.Vector3();
const _scaledDir = new BABYLON.Vector3();
const _moveStep = new BABYLON.Vector3();
const _negDir = new BABYLON.Vector3();
const _reusableRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Up(), 1);
const _remoteOrigin = new BABYLON.Vector3();
const _remoteDir = new BABYLON.Vector3();

/**
 * Handle explosive projectile impact - deals AoE damage to all nearby zombies
 */

const handleExplosion = (
    impactPoint: BABYLON.Vector3,
    splashRadius: number,
    splashDamage: number,
    selfDamageMultiplier: number | undefined,
    ctx: IProjectileContext,
    p: Projectile
) => {
    const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
    if (!isAuthority) return;

    const isInstaKill = ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL] && ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL]! > Date.now();
    const playerPos = ctx.camera.position;
    const splashRadiusSq = splashRadius * splashRadius;

    // Check distance from explosion to player for self-damage
    const distToPlayerSq = BABYLON.Vector3.DistanceSquared(impactPoint, playerPos);
    if (distToPlayerSq < splashRadiusSq) {
        const distToPlayer = Math.sqrt(distToPlayerSq);
        const damageRatio = 1 - (distToPlayer / splashRadius);
        const gc = ctx.configManager.gameplay;
        const rawSelfDamage = splashDamage * (selfDamageMultiplier ?? 0.5) * damageRatio;
        const selfDamage = Math.min(rawSelfDamage, gc.ZOMBIE_DAMAGE);
        if (selfDamage > 0) {
            ctx.applyDamageToLocalPlayer(selfDamage, "rgba(255, 100, 0, 0.5)");
            ctx.timerManager.schedule('explosion_flash', 100, () => {
                ctx.setFlashColor(null);
            });
        }
    }

    // Damage all zombies in radius
    for (const z of ctx.zombies) {
        if (z.isDead) continue;

        const distSq = BABYLON.Vector3.DistanceSquared(impactPoint, z.mesh.position);
        if (distSq <= splashRadiusSq) {
            const dist = Math.sqrt(distSq);
            // Linear falloff - max damage at center, minimum at edge
            const damageRatio = 1 - (dist / splashRadius);
            const finalDamage = isInstaKill ? z.maxHealth : (splashDamage * damageRatio);

            z.lastHitTime = Date.now();
            z.health -= finalDamage;

            // Check for crawler creation (leg damage from explosion)
            if (dist > splashRadius * 0.3 && !z.isCrawling && z.type === 'ZOMBIE') {
                if (finalDamage > 40 || z.health < 40) {
                    z.isCrawling = true;
                    z.speed = 0.015;
                }
            }

            if (z.health <= 0 && !z.isDead) {
                if (z.type === 'HELLHOUND') {
                    ctx.hellhoundManager.onHellhoundDeath(z, z.mesh.position, p.owner);
                } else {
                    // For AoE, direction is from explosion center toward zombie (blast pushes outward)
                    const blastDir = z.mesh.position.subtract(impactPoint).normalize();
                    ctx.zombieManager.onZombieDeath(z, z.mesh.position, p.owner, false, undefined, blastDir);
                }
                // Bonus points for explosion kills
                ctx.addPoints(ctx.hasDoublePoints() ? 60 : 30);
            }
        }
    }
};

/**
 * ProjectileSystem
 *
 * Handles projectile movement, collision detection with zombies, and 
 * remote shoot event synchronization.
 */
export const createProjectileSystem = (ctx: IProjectileContext): System => {
    // Reusable set — cleared each frame instead of re-allocated
    const hitsProcessed = new Set<string>();

    // Subscribe to Remote Shoot Events once during setup
    const handleRemoteShoot = (msg: ShootMessage) => {
        const scene = ctx.scene;
        const engine = ctx.gameEngine;

        if (msg.origin && msg.dir && engine) {
            _remoteOrigin.set(msg.origin.x, msg.origin.y, msg.origin.z);
            _remoteDir.set(msg.dir.x, msg.dir.y, msg.dir.z);
            const speed = msg.speed ?? COMBAT_CONFIG.PROJECTILE_SPEED;

            engine.spawnProjectile(
                _remoteOrigin,
                _remoteDir,
                speed,
                msg.damage ?? 0,
                true, // Correctly mark as remote
                msg.isPacked || false,
                msg.owner || 'CLIENT',
                msg.isExplosive || false,
                msg.splashRadius ?? (msg.isExplosive ? 6 : undefined),
                msg.splashDamage ?? (msg.isExplosive ? 1000 : undefined),
                msg.selfDamageMultiplier ?? (msg.isExplosive ? 0.5 : undefined)
            );


            // Add tracer trail to all remote projectiles for visibility
            const p = engine.activeProjectiles[engine.activeProjectiles.length - 1];
            if (p) {
                p.trailParticleSystem = ctx.visualManager.createProjectileTrail(p.mesh, p.isPacked);
            }
        }
    };
    ctx.eventBus.on('REMOTE_SHOOT', handleRemoteShoot);

    // ── Pick predicates using O(1) metadata/set lookups ───────────────────────
    const staticMeshes = ctx.staticLevelMeshes;
    const localPickPredicate = (mesh: BABYLON.AbstractMesh): boolean => {
        if (!mesh.isPickable || !mesh.isEnabled() || !mesh.isVisible) return false;
        if (mesh.metadata?.isEnemy) return true;
        return staticMeshes.has(mesh);
    };
    const remotePickPredicate = (mesh: BABYLON.AbstractMesh): boolean => {
        if (mesh.metadata?.isEnemy) return true;
        return mesh.checkCollisions && mesh.isVisible && staticMeshes.has(mesh);
    };

    return {
        name: 'projectile',
        dispose: () => {
            ctx.eventBus.off('REMOTE_SHOOT', handleRemoteShoot);
        },
        update: (dt: number, now: number) => {
            const isDebugActive = ctx.debugSelection.isActive;
            if (!ctx.gameState.hasStarted || (ctx.gameState.isPaused && !isDebugActive)) return;

            const scene = ctx.scene;
            const engine = ctx.gameEngine;
            if (!scene || !engine) return;

            const projectiles = engine.activeProjectiles;

            // Skip all work when there are no projectiles
            if (projectiles.length === 0) return;

            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            const isInstaKill = ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL] && ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL]! > Date.now();

            hitsProcessed.clear();

            for (let i = projectiles.length - 1; i >= 0; i--) {
                const p = projectiles[i];

                let hit = false;
                let finalImpactPoint: BABYLON.Vector3 | null = null;

                if (!p.isRemote) {
                    // Reuse scratch vectors & ray — zero allocations per projectile per frame
                    p.direction.scaleToRef(0.5, _scaledDir);
                    p.mesh.position.subtractToRef(_scaledDir, _rayStart);
                    const rayLen = p.speed + 0.5;

                    _reusableRay.origin.copyFrom(_rayStart);
                    _reusableRay.direction.copyFrom(p.direction);
                    _reusableRay.length = rayLen;
                    const ray = _reusableRay;

                    // Combined raycast for enemies and environment — O(1) lookups
                    const pick = scene.pickWithRay(ray, localPickPredicate);

                    // ── DEBUG SELECTION (reuse the combined pick — no extra raycast) ──
                    if (isDebugActive && pick && pick.hit && pick.pickedMesh) {
                        const mesh = pick.pickedMesh;
                        ctx.debugSelection.selectedMesh = mesh;
                        ctx.setDebugInfo({
                            name: mesh.name,
                            position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
                            rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
                            scaling: { x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z },
                            material: mesh.material?.name || "none",
                            parent: mesh.parent?.name || "none",
                            metadata: mesh.metadata
                        });
                    }

                    if (pick && pick.hit && pick.pickedMesh) {
                        hit = true;
                        const isEnemy = pick.pickedMesh.metadata?.isEnemy;

                        if (isEnemy) {
                            ctx.visualManager.createBloodSplatter(pick.pickedPoint!, pick.getNormal(true)!, pick.pickedMesh);

                            // Handle explosive projectile hit on zombie
                            if (p.isExplosive && p.splashRadius && p.splashDamage) {
                                ctx.visualManager.createPlasmaExplosion(pick.pickedPoint!, p.isPacked);
                                handleExplosion(
                                    pick.pickedPoint!,
                                    p.splashRadius,
                                    p.splashDamage,
                                    p.selfDamageMultiplier,
                                    ctx,
                                    p
                                );
                            } else if (isAuthority) {
                                const z = pick.pickedMesh.metadata?.zombie as Zombie | undefined;
                                if (z) {
                                    z.lastHitTime = Date.now();

                                    const isHeadshot = pick.pickedMesh.name.includes("head") || pick.pickedMesh.name.includes("Head");
                                    const isLegHit = pick.pickedMesh.name.includes("leg");

                                    let multiplier = 1.0;
                                    if (isHeadshot) multiplier = 1.5;
                                    else if (isLegHit) multiplier = 0.7;

                                    const dmg = isInstaKill ? z.maxHealth : (p.damage * multiplier);
                                    z.health -= dmg;

                                    if (isLegHit && !z.isCrawling && z.type === 'ZOMBIE') {
                                        if (dmg > 40 || z.health < 40) {
                                            z.isCrawling = true;
                                            z.speed = 0.015;
                                            pick.pickedMesh.setEnabled(false);
                                            if (z.missingLimbs) {
                                                if (pick.pickedMesh.name.includes("_l")) z.missingLimbs.legL = true;
                                                else if (pick.pickedMesh.name.includes("_r")) z.missingLimbs.legR = true;
                                            }
                                        }
                                    }

                                    const hitKey = `${z.id}_${p.owner}`;
                                    if (!hitsProcessed.has(hitKey)) {
                                        hitsProcessed.add(hitKey);

                                        if (p.owner === 'HOST') {
                                            const base = isHeadshot ? 20 : 10;
                                            ctx.addPoints(ctx.hasDoublePoints() ? base * 2 : base);
                                        } else if (p.owner === 'CLIENT') {
                                            ctx.send({ type: 'HIT_CONFIRM', amount: (isHeadshot ? 20 : 10) });
                                        }
                                    }

                                    if (z.health <= 0 && !z.isDead) {
                                        if (z.type === 'HELLHOUND') {
                                            ctx.hellhoundManager.onHellhoundDeath(z, z.mesh.position, p.owner);
                                        } else {
                                            const headPos = z.headMesh ? z.headMesh.absolutePosition : undefined;
                                            ctx.zombieManager.onZombieDeath(z, z.mesh.position, p.owner, isHeadshot, headPos, p.direction);
                                        }
                                    }
                                }
                            }
                        } else {
                            // Environment Hit
                            finalImpactPoint = pick.pickedPoint!;
                            p.direction.scaleToRef(-1, _negDir);
                            const normal = pick.getNormal(true) || _negDir;

                            ctx.visualManager.createDecal(pick.pickedPoint!, normal, pick.pickedMesh);
                            ctx.visualManager.createImpactParticles(pick.pickedPoint!, normal);
                        }
                    }

                } else {
                    // ── REMOTE PROJECTILE: visual-only collision (no damage) ──
                    p.direction.scaleToRef(0.5, _scaledDir);
                    p.mesh.position.subtractToRef(_scaledDir, _rayStart);
                    const rayLen = p.speed + 0.5;

                    _reusableRay.origin.copyFrom(_rayStart);
                    _reusableRay.direction.copyFrom(p.direction);
                    _reusableRay.length = rayLen;
                    const ray = _reusableRay;

                    // Combined raycast for enemies and environment — O(1) lookups
                    const pick = scene.pickWithRay(ray, remotePickPredicate);

                    if (pick && pick.hit && pick.pickedMesh) {
                        hit = true;
                        const isEnemy = pick.pickedMesh.metadata?.isEnemy;

                        if (isEnemy) {
                            ctx.visualManager.createBloodSplatter(pick.pickedPoint!, pick.getNormal(true)!, pick.pickedMesh);

                            if (p.isExplosive && p.splashRadius && p.splashDamage) {
                                ctx.visualManager.createPlasmaExplosion(pick.pickedPoint!, p.isPacked);
                            }
                        } else {
                            finalImpactPoint = pick.pickedPoint!;
                            p.direction.scaleToRef(-1, _negDir);
                            const normal = pick.getNormal(true) || _negDir;

                            ctx.visualManager.createDecal(pick.pickedPoint!, normal, pick.pickedMesh);
                            ctx.visualManager.createImpactParticles(pick.pickedPoint!, normal);
                        }
                    }

                }

                if (hit) {
                    // Handle explosive projectile impact for environment hit (zombie hit handled above)
                    if (p.isExplosive && p.splashRadius && p.splashDamage && finalImpactPoint) {
                        ctx.visualManager.createPlasmaExplosion(finalImpactPoint, p.isPacked);
                        if (!p.isRemote) {
                            handleExplosion(
                                finalImpactPoint,
                                p.splashRadius,
                                p.splashDamage,
                                p.selfDamageMultiplier,
                                ctx,
                                p
                            );
                        }
                    }
                    engine.releaseProjectile(p);
                } else {
                    p.direction.scaleToRef(p.speed, _moveStep);
                    p.mesh.position.addInPlace(_moveStep);
                    p.life--;
                    if (p.life <= 0) {
                        engine.releaseProjectile(p);
                    }
                }
            }
        }
    };
};
