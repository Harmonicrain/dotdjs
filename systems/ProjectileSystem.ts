import * as BABYLON from '@babylonjs/core';
import { GameMessage, PowerUpType, GameStateData, Zombie, Projectile } from '../types/index';
import { BulletDebugState, BulletDebugInfo } from '../types/debug';
import { EventBus } from '../engine/EventBus';
import { System } from '../types/systems';
import { COMBAT_CONFIG } from '../config';
import { TimerManager } from '../engine/TimerManager';
import { GameEngine } from '../game/GameEngine';
import { VisualManager } from '../managers/VisualManager';
import { ZombieManager } from '../managers/ZombieManager';
import { HellhoundManager } from '../managers/HellhoundManager';
import { MapConfigManager } from '../managers/MapConfigManager';
import { applyExplosionHit, applyProjectileHit } from './zombie/zombieDamageUtils';

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
    bulletDebug: BulletDebugState;
    setBulletDebugInfo(v: BulletDebugInfo | null): void;
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
        applyExplosionHit(ctx, {
            zombie: z,
            impactPoint,
            splashRadius,
            splashDamage,
            owner: p.owner,
        });
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

    // ── Bullet Debug: WASD keyboard movement ──────────────────────────────────
    const _bdRight = new BABYLON.Vector3();
    const _bdUp = new BABYLON.Vector3();
    const _bdFwd = new BABYLON.Vector3();
    const _bdOffset = new BABYLON.Vector3();

    // Track which keys are held for smooth continuous movement
    const bdKeys: Record<string, boolean> = {};
    const onBdKeyDown = (evt: KeyboardEvent) => { bdKeys[evt.key.toLowerCase()] = true; };
    const onBdKeyUp = (evt: KeyboardEvent) => { bdKeys[evt.key.toLowerCase()] = false; };

    /** Move the frozen bullet based on held keys. Called each frame. */
    const updateBulletDebugMovement = (dt: number) => {
        const bd = ctx.bulletDebug;
        if (!bd.frozenProjectile) return;

        // Shift = fast mode, no shift = normal (precise)
        const baseSpeed = bdKeys['shift'] ? 0.02 : 0.005;
        const speed = baseSpeed * dt;

        const cam = ctx.camera;
        cam.getDirectionToRef(BABYLON.Vector3.Right(), _bdRight);
        cam.getDirectionToRef(BABYLON.Vector3.Up(), _bdUp);
        cam.getDirectionToRef(BABYLON.Vector3.Forward(), _bdFwd);

        let moved = false;
        if (bdKeys['d']) { bd.frozenProjectile.position.addInPlace(_bdRight.scale(speed)); moved = true; }
        if (bdKeys['a']) { bd.frozenProjectile.position.addInPlace(_bdRight.scale(-speed)); moved = true; }
        if (bdKeys['w']) { bd.frozenProjectile.position.addInPlace(_bdUp.scale(speed)); moved = true; }
        if (bdKeys['s']) { bd.frozenProjectile.position.addInPlace(_bdUp.scale(-speed)); moved = true; }
        if (bdKeys['e']) { bd.frozenProjectile.position.addInPlace(_bdFwd.scale(speed)); moved = true; }
        if (bdKeys['q']) { bd.frozenProjectile.position.addInPlace(_bdFwd.scale(-speed)); moved = true; }

        if (moved) updateBulletDebugOverlay();
    };

    /** Compute camera-relative offset and push to UI overlay. */
    const updateBulletDebugOverlay = () => {
        const bd = ctx.bulletDebug;
        if (!bd.frozenProjectile) return;

        const cam = ctx.camera;
        _bdOffset.copyFrom(bd.frozenProjectile.position).subtractInPlace(cam.position);

        cam.getDirectionToRef(BABYLON.Vector3.Right(), _bdRight);
        cam.getDirectionToRef(BABYLON.Vector3.Up(), _bdUp);
        cam.getDirectionToRef(BABYLON.Vector3.Forward(), _bdFwd);

        const right = BABYLON.Vector3.Dot(_bdOffset, _bdRight);
        const up = BABYLON.Vector3.Dot(_bdOffset, _bdUp);
        const forward = BABYLON.Vector3.Dot(_bdOffset, _bdFwd);

        const activeWeapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
        const isAds = ctx.gameState.isAiming && !ctx.gameState.isReloading;

        ctx.setBulletDebugInfo({
            right,
            up,
            forward,
            weaponName: activeWeapon?.name || 'unknown',
            weaponId: activeWeapon?.id || 'unknown',
            isAds,
            hipPos: { x: activeWeapon?.hipPos?.x ?? 0, y: activeWeapon?.hipPos?.y ?? 0 },
            barrelLength: activeWeapon?.barrelLength ?? 0,
        });
    };

    let bulletDebugListenersAttached = false;
    const attachBulletDebugListeners = () => {
        if (bulletDebugListenersAttached) return;
        window.addEventListener('keydown', onBdKeyDown);
        window.addEventListener('keyup', onBdKeyUp);
        bulletDebugListenersAttached = true;
    };
    const detachBulletDebugListeners = () => {
        if (!bulletDebugListenersAttached) return;
        window.removeEventListener('keydown', onBdKeyDown);
        window.removeEventListener('keyup', onBdKeyUp);
        // Clear all held keys
        for (const k in bdKeys) bdKeys[k] = false;
        bulletDebugListenersAttached = false;
    };

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
            detachBulletDebugListeners();
        },
        update: (dt: number, now: number) => {
            const isDebugActive = ctx.debugSelection.isActive;
            // In multiplayer, pause only affects local player UI — game logic continues
            const isMultiplayer = ctx.gameModeRef.current !== 'SOLO';
            const effectivelyPaused = ctx.gameState.isPaused && !isMultiplayer;
            if (!ctx.gameState.hasStarted || (effectivelyPaused && !isDebugActive)) return;

            const scene = ctx.scene;
            const engine = ctx.gameEngine;
            if (!scene || !engine) return;

            const projectiles = engine.activeProjectiles;

            // ── Bullet Debug Mode ──────────────────────────────────────────
            const bd = ctx.bulletDebug;
            if (bd.isActive) {
                attachBulletDebugListeners();

                // Freeze any new (non-frozen) local projectiles
                for (let i = projectiles.length - 1; i >= 0; i--) {
                    const p = projectiles[i];
                    if (p.isRemote) continue;
                    // If this projectile is NOT the current frozen one, it's new — freeze it
                    if (p.mesh !== bd.frozenProjectile) {
                        // Dispose the previous frozen bullet
                        if (bd.frozenProjectile) {
                            // Remove the old frozen projectile from active list
                            for (let j = projectiles.length - 1; j >= 0; j--) {
                                if (projectiles[j].mesh === bd.frozenProjectile) {
                                    engine.releaseProjectile(projectiles[j]);
                                    break;
                                }
                            }
                        }
                        // Freeze the new one
                        p.speed = 0;
                        p.life = 999999;
                        p.mesh.isPickable = true; // Allow picking for drag
                        p.mesh.scaling.setAll(3.0); // Make it easier to see and click
                        bd.frozenProjectile = p.mesh;
                        updateBulletDebugOverlay();
                    }
                }

                // Process WASD movement + update overlay each frame
                if (bd.frozenProjectile) {
                    updateBulletDebugMovement(dt);
                    updateBulletDebugOverlay();
                }

                // Don't process normal projectile logic in bullet debug mode
                return;
            } else {
                detachBulletDebugListeners();
            }

            // Skip all work when there are no projectiles
            if (projectiles.length === 0) return;

            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
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
                                if (isAuthority) {
                                    handleExplosion(
                                        pick.pickedPoint!,
                                        p.splashRadius,
                                        p.splashDamage,
                                        p.selfDamageMultiplier,
                                        ctx,
                                        p
                                    );
                                } else {
                                    // CLIENT: send explosion info to HOST for authoritative damage
                                    ctx.send({
                                        type: 'CLIENT_EXPLOSION_HIT',
                                        x: pick.pickedPoint!.x,
                                        y: pick.pickedPoint!.y,
                                        z: pick.pickedPoint!.z,
                                        splashRadius: p.splashRadius,
                                        splashDamage: p.splashDamage,
                                        selfDamageMultiplier: p.selfDamageMultiplier,
                                        isPacked: !!p.isPacked,
                                    });
                                }
                            } else if (isAuthority) {
                                const z = pick.pickedMesh.metadata?.zombie as Zombie | undefined;
                                if (z) {
                                    const isHeadshot = pick.pickedMesh.name.includes("head") || pick.pickedMesh.name.includes("Head");
                                    const isLegHit = pick.pickedMesh.name.includes("leg");

                                    const hitKey = `${z.id}_${p.owner}`;
                                    if (!hitsProcessed.has(hitKey)) {
                                        hitsProcessed.add(hitKey);
                                        applyProjectileHit(ctx, {
                                            zombie: z,
                                            damage: p.damage,
                                            owner: p.owner,
                                            isHeadshot,
                                            isLegHit,
                                            hitMeshName: pick.pickedMesh.name,
                                            hitDirection: p.direction,
                                        });

                                        if (isLegHit && z.isCrawling) {
                                            pick.pickedMesh.setEnabled(false);
                                        }
                                    }
                                }
                            } else {
                                // CLIENT: send hit info to HOST for authoritative damage
                                const z = pick.pickedMesh.metadata?.zombie as Zombie | undefined;
                                if (z && !z.isDead) {
                                    const isHeadshot = pick.pickedMesh.name.includes("head") || pick.pickedMesh.name.includes("Head");
                                    const isLegHit = pick.pickedMesh.name.includes("leg");
                                    ctx.send({
                                        type: 'CLIENT_ZOMBIE_HIT',
                                        zombieId: z.id,
                                        damage: p.damage,
                                        isHeadshot,
                                        isLegHit,
                                        meshName: pick.pickedMesh.name,
                                    });
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
