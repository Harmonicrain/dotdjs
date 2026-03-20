import * as BABYLON from '@babylonjs/core';
import { GameAction, InputManager } from '../../engine/InputManager';
import { PowerUpType, GameStateData, GameMessage } from '../../types/index';
import { System } from '../../types/systems';
import { TimerManager } from '../../engine/TimerManager';
import { VisualManager } from '../../managers/VisualManager';
import { GameEngine } from '../../game/GameEngine';
import { ZombieManager } from '../../managers/ZombieManager';
import { HellhoundManager } from '../../managers/HellhoundManager';
import { Zombie } from '../../types/entities';
import { MapConfigManager } from '../../managers/MapConfigManager';

export interface ICombatContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    scene: BABYLON.Scene;
    inputManager: InputManager | null;
    gameEngine: GameEngine;
    timerManager: TimerManager;
    visualManager: VisualManager;
    zombieManager: ZombieManager;
    hellhoundManager: HellhoundManager;
    zombies: Zombie[];
    gameModeRef: { current: string };
    configManager: MapConfigManager;
    send(data: GameMessage): void;
    addPoints(amount: number): void;
    hasDoublePoints(): boolean;
    setActiveWeaponIndex(v: number): void;
    setWeaponName(v: string): void;
    setAmmo(v: number): void;
    setReserveAmmo(v: number): void;
    setMaxClip(v: number): void;
    setShotsFired(v: number): void;
    setIsAiming(v: boolean): void;
    setWeaponId(v: string): void;
    soundManager?: { play: (name: string) => void } | null;
}

// Pre-allocated direction vectors for camera.getDirection() calls
const _forward = new BABYLON.Vector3(0, 0, 1);
const _right = new BABYLON.Vector3(1, 0, 0);
const _up = new BABYLON.Vector3(0, 1, 0);

// Pre-allocated ray for knife attacks
const _knifeRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Forward(), 1);
const _knifeDir = new BABYLON.Vector3();

// Pre-allocated scratch vectors/ray for performShoot — avoids per-shot and per-pellet allocations
const _fwd = new BABYLON.Vector3();
const _rgt = new BABYLON.Vector3();
const _upd = new BABYLON.Vector3();
const _muzzlePos = new BABYLON.Vector3();
const _shootTargetPos = new BABYLON.Vector3();
const _camToMuzzle = new BABYLON.Vector3();
const _baseDir = new BABYLON.Vector3();
const _pelletDir = new BABYLON.Vector3();
const _bulletVel = new BABYLON.Vector3();
const _aimRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Forward(), 500);

/**
 * PlayerCombatSystem
 *
 * Handles weapon firing, reloading, weapon switching, and melee (knifing).
 * Uses MapConfigManager for map-specific tuning.
 */
export const createPlayerCombatSystem = (ctx: ICombatContext): System => {

    const switchWeapon = (idx: number) => {
        if (idx < ctx.gameState.weapons.length && idx !== ctx.gameState.activeWeaponIndex) {
            // Cancel any in-progress reload
            if (ctx.gameState.isReloading) {
                ctx.timerManager.cancel('reload');
                ctx.gameState.isReloading = false;
            }
            ctx.gameState.activeWeaponIndex = idx;
            ctx.setActiveWeaponIndex(idx);
            const w = ctx.gameState.weapons[idx];
            ctx.setWeaponName(w.name);
            ctx.setWeaponId(w.id);
            ctx.setAmmo(w.currentAmmo);
            ctx.setReserveAmmo(w.currentReserve);
            ctx.setMaxClip(w.clipSize);
        }
    };

    const reload = () => {
        const weapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
        if (ctx.gameState.isReloading || weapon.currentAmmo === weapon.clipSize || weapon.currentReserve === 0) return;
        ctx.gameState.isReloading = true;

        // Play Reload Animation (if exists)
        if (weapon.mesh && weapon.mesh.metadata && weapon.mesh.metadata.animationGroups) {
            const anims = weapon.mesh.metadata.animationGroups as BABYLON.AnimationGroup[];
            // For now assume reload is the second animation (index 1) if it exists, or just replay first
            // Ideally we should have names in metadata.
            const reloadAnim = anims.find(a => a.name.toLowerCase().includes('reload')) || anims[1] || anims[0];
            if (reloadAnim) {
                reloadAnim.stop();
                reloadAnim.play(false);
            }
        }

        // Generic Perk Check
        const hasSpeedCola = ctx.gameState.perkStates['speedCola'];
        const reloadTime = hasSpeedCola ? (weapon.reloadTime * 0.5) : weapon.reloadTime;

        ctx.timerManager.schedule('reload', reloadTime, () => {
            const needed = weapon.clipSize - weapon.currentAmmo;
            const toAdd = Math.min(needed, weapon.currentReserve);
            weapon.currentAmmo += toAdd; weapon.currentReserve -= toAdd;

            ctx.setAmmo(weapon.currentAmmo);
            ctx.setReserveAmmo(weapon.currentReserve);

            ctx.gameState.isReloading = false;
        });
    };

    const performShoot = (now: number) => {
        const weapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
        if (!weapon.automatic && ctx.gameState.weaponFiredThisTriggerPull) return;

        // For automatic weapons, check RAW input state (not cached) to stop firing immediately on mouse release
        if (weapon.automatic && ctx.inputManager && !ctx.inputManager.isFireInputActive()) {
            ctx.gameState.isFiring = false;
            return;
        }

        const cc = ctx.configManager.combat;
        const hasDoubleTap = ctx.gameState.perkStates['doubleTap'];
        const fireDelay = (60000 / weapon.fireRate) / (hasDoubleTap ? cc.DOUBLE_TAP_FIRE_RATE_MULT : 1);
        if (ctx.gameState.isReloading || ctx.gameState.isKnifing || now - ctx.gameState.lastShotTime < fireDelay) return;
        if (weapon.currentAmmo <= 0) { if (weapon.currentReserve > 0) reload(); return; }

        ctx.gameState.lastShotTime = now;
        if (!weapon.automatic) ctx.gameState.weaponFiredThisTriggerPull = true;

        weapon.currentAmmo--;
        ctx.setAmmo(weapon.currentAmmo);
        ctx.gameState.shots++;
        ctx.setShotsFired(ctx.gameState.shots);

        // Play weapon sound
        ctx.soundManager?.play('M1911');

        if (ctx.camera && ctx.gameEngine) {
            const spread = ctx.gameState.isAiming ? 0 : cc.HIP_FIRE_SPREAD;

            // Always calculate from camera to avoid weapon mesh lerping lag
            const isAds = ctx.gameState.isAiming && !ctx.gameState.isReloading;
            const offset = isAds ? weapon.adsPos : weapon.hipPos;

            // Write camera directions into pre-allocated scratch vectors
            ctx.camera.getDirectionToRef(_forward, _fwd);
            ctx.camera.getDirectionToRef(_right, _rgt);
            ctx.camera.getDirectionToRef(_up, _upd);

            // Calculate muzzle position using barrelLength from config
            const barrelLen = weapon.barrelLength;
            const fwdOff = offset.z + barrelLen;
            _muzzlePos.copyFrom(ctx.camera.position);
            _muzzlePos.addInPlaceFromFloats(
                _rgt.x * offset.x + _upd.x * offset.y + _fwd.x * fwdOff,
                _rgt.y * offset.x + _upd.y * offset.y + _fwd.y * fwdOff,
                _rgt.z * offset.x + _upd.z * offset.y + _fwd.z * fwdOff,
            );

            // Per-weapon hip-fire origin correction
            if (!isAds && weapon.hipFireOriginCorrection) {
                const corrUp = weapon.hipFireOriginCorrection.up;
                const corrRight = weapon.hipFireOriginCorrection.right;
                _muzzlePos.addInPlaceFromFloats(
                    _upd.x * corrUp + _rgt.x * corrRight,
                    _upd.y * corrUp + _rgt.y * corrRight,
                    _upd.z * corrUp + _rgt.z * corrRight,
                );
            }

            // Compensate muzzle position for player movement so bullets appear from barrel center
            // Without this, bullets visually spawn behind the barrel when strafing because the
            // camera has moved by the time the projectile is rendered on the next frame
            if (ctx.gameState.currentVelocity) {
                _muzzlePos.addInPlace(ctx.gameState.currentVelocity);
            }

            // BULLET CONVERGENCE: Cast ray from camera center to find actual target point
            // This ensures bullets go exactly where the crosshair points regardless of muzzle offset
            const maxTargetDist = 500;
            _aimRay.origin.copyFrom(ctx.camera.position);
            _aimRay.direction.copyFrom(_fwd);
            _aimRay.length = maxTargetDist;
            const aimHit = ctx.scene.pickWithRay(_aimRay, (mesh) => {
                // Ignore weapon meshes, projectiles, and non-collidable objects
                if (!mesh.isPickable || !mesh.isEnabled() || !mesh.isVisible) return false;
                return !mesh.name.includes("weapon") &&
                    !mesh.name.includes("projectile") &&
                    !mesh.name.includes("knife") &&
                    !mesh.name.includes("_trigger") &&
                    mesh !== ctx.gameState.knifeMesh;
            });

            // Use hit point if found, otherwise use far point along camera forward
            if (aimHit && aimHit.hit && aimHit.pickedPoint) {
                _shootTargetPos.copyFrom(aimHit.pickedPoint);
            } else {
                _shootTargetPos.copyFrom(ctx.camera.position);
                _shootTargetPos.addInPlaceFromFloats(_fwd.x * maxTargetDist, _fwd.y * maxTargetDist, _fwd.z * maxTargetDist);
            }

            // Compensate target position for player movement so aim direction stays accurate
            if (ctx.gameState.currentVelocity) {
                _shootTargetPos.addInPlace(ctx.gameState.currentVelocity);
            }

            const MIN_SPAWN_DIST = cc.MIN_PROJECTILE_SPAWN_DIST;
            _muzzlePos.subtractToRef(ctx.camera.position, _camToMuzzle);
            const forwardDist = BABYLON.Vector3.Dot(_camToMuzzle, _fwd);
            if (forwardDist < MIN_SPAWN_DIST) {
                const adj = MIN_SPAWN_DIST - forwardDist;
                _muzzlePos.addInPlaceFromFloats(_fwd.x * adj, _fwd.y * adj, _fwd.z * adj);
            }

            _shootTargetPos.subtractToRef(_muzzlePos, _baseDir);
            _baseDir.normalize();

            const pelletCount = hasDoubleTap && !weapon.isExplosive ? weapon.pellets * 2 : weapon.pellets;
            for (let i = 0; i < pelletCount; i++) {
                _pelletDir.copyFrom(_baseDir);
                if (spread > 0) {
                    _pelletDir.x += (Math.random() - 0.5) * spread;
                    _pelletDir.y += (Math.random() - 0.5) * spread;
                    _pelletDir.z += (Math.random() - 0.5) * spread;
                    _pelletDir.normalize();
                } else if (i >= weapon.pellets) {
                    // Micro-spread for duplicate bullets to prevent raycast z-fighting
                    _pelletDir.x += (Math.random() - 0.5) * 0.005;
                    _pelletDir.y += (Math.random() - 0.5) * 0.005;
                    _pelletDir.z += (Math.random() - 0.5) * 0.005;
                    _pelletDir.normalize();
                }
                _bulletVel.copyFrom(_pelletDir);
                _bulletVel.scaleInPlace(cc.PROJECTILE_SPEED);
                // Inherit player velocity even in ADS to prevent visual "drag" or "curving" when strafing
                if (ctx.gameState.currentVelocity) {
                    _bulletVel.addInPlace(ctx.gameState.currentVelocity);
                }
                const finalSpeed = weapon.projectileSpeedOverride ?? _bulletVel.length();
                _bulletVel.normalize();
                ctx.gameEngine.spawnProjectile(
                    _muzzlePos,
                    _bulletVel,
                    finalSpeed,
                    weapon.damage,
                    false,
                    weapon.isPacked,
                    ctx.gameModeRef.current === 'CLIENT' ? 'CLIENT' : 'HOST',
                    weapon.isExplosive,
                    weapon.splashRadius,
                    weapon.splashDamage,
                    weapon.selfDamageMultiplier
                );

                if (weapon.isExplosive) {
                    const p = ctx.gameEngine.activeProjectiles[ctx.gameEngine.activeProjectiles.length - 1];
                    if (p && p.isExplosive) {
                        p.trailParticleSystem = ctx.visualManager.createProjectileTrail(p.mesh, weapon.isPacked);
                    }
                }
                if (ctx.gameModeRef.current !== 'SOLO') {
                    ctx.send({ type: 'SHOOT', origin: { x: _muzzlePos.x, y: _muzzlePos.y, z: _muzzlePos.z }, dir: { x: _bulletVel.x, y: _bulletVel.y, z: _bulletVel.z }, isPacked: weapon.isPacked, damage: weapon.damage, isExplosive: weapon.isExplosive, owner: ctx.gameModeRef.current === 'CLIENT' ? 'CLIENT' : 'HOST', speed: finalSpeed, splashRadius: weapon.splashRadius, splashDamage: weapon.splashDamage, selfDamageMultiplier: weapon.selfDamageMultiplier });
                }
            }

            // Animation Playback
            if (weapon.mesh && weapon.mesh.metadata && weapon.mesh.metadata.animationGroups) {
                const anims = weapon.mesh.metadata.animationGroups as BABYLON.AnimationGroup[];
                if (anims.length > 0) {
                    anims[0].stop();
                    anims[0].play(false);
                }
            }
        }
    };

    const performKnife = () => {
        if (ctx.gameState.isKnifing || !ctx.gameState.knifeMesh) return;
        ctx.gameState.isKnifing = true;
        const knife = ctx.gameState.knifeMesh; knife.setEnabled(true);
        knife.position.set(0.2, -0.2, 0.5); knife.rotation.set(0, Math.PI / 2, 0);

        const cc = ctx.configManager.combat;
        const gc = ctx.configManager.gameplay;

        const start = Date.now();
        const obs = ctx.scene.onBeforeRenderObservable.add(() => {
            const t = (Date.now() - start) / (cc.KNIFE_ANIM_DURATION * 1000);
            if (t >= 1) {
                ctx.gameState.isKnifing = false;
                knife.setEnabled(false);
                ctx.scene.onBeforeRenderObservable.remove(obs!);
                return;
            }
            knife.position.z = 0.5 + Math.sin(t * Math.PI) * 0.5;
        });

        // Use TimerManager for hit detection delay
        ctx.timerManager.schedule('knife_hit', cc.KNIFE_HIT_DELAY_MS, () => {
            const origin = ctx.camera.position;
            ctx.camera.getDirectionToRef(_forward, _knifeDir);
            _knifeRay.origin.copyFrom(origin);
            _knifeRay.direction.copyFrom(_knifeDir);
            _knifeRay.length = cc.KNIFE_RANGE;
            const hit = ctx.scene.pickWithRay(_knifeRay, (m) => {
                if (!m.isPickable || !m.isEnabled() || !m.isVisible) return false;
                return m.name.includes("zombie") || m.name.includes("hellhound");
            });
            if (hit && hit.hit && hit.pickedMesh) {
                ctx.visualManager.createBloodSplatter(hit.pickedPoint!, hit.getNormal(true)!, hit.pickedMesh);
                const z = ctx.zombies.find(z => z.mesh === hit.pickedMesh || z.headMesh === hit.pickedMesh || z.mesh === hit.pickedMesh?.parent);
                if (z) {
                    const isHeadshot = hit.pickedMesh.name.includes("head");
                    const isInstaKill = ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL] && ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL]! > Date.now();
                    const damage = isInstaKill ? cc.INSTA_KILL_DAMAGE : cc.KNIFE_DAMAGE;
                    z.health -= damage; z.lastHitTime = Date.now();
                    if (z.health <= 0 && !z.isDead) {
                        if (z.type === 'HELLHOUND') {
                            ctx.hellhoundManager.onHellhoundDeath(z, z.mesh.position, 'HOST');
                        } else {
                            const headPos = z.headMesh ? z.headMesh.absolutePosition : undefined;
                            ctx.zombieManager.onZombieDeath(z, z.mesh.position, 'HOST', isHeadshot, headPos);
                        }
                    } else {
                        ctx.addPoints(ctx.hasDoublePoints() ? gc.POINTS_HIT * 2 : gc.POINTS_HIT);
                    }
                }
            }
        });
    };

    return {
        name: 'playerCombat',
        update: (dt: number, now: number) => {
            if (!ctx.gameState.hasStarted || ctx.gameState.isPaused || ctx.gameState.isSpectating || ctx.gameState.isGameOver) return;

            const inputManager = ctx.inputManager;
            if (!inputManager) return;

            // PREVENT ACTIONS IF DOWNED
            if (ctx.gameState.isDowned) {
                // Allow shooting while downed (M1911 with limited ammo, semi-auto only)
                ctx.gameState.isFiring = inputManager.isDown(GameAction.FIRE);
                ctx.gameState.isAiming = inputManager.isDown(GameAction.AIM);
                ctx.setIsAiming(ctx.gameState.isAiming);

                if (ctx.gameState.isFiring) {
                    performShoot(now);
                }

                // Allow reload if we have ammo
                if (inputManager.justPressed(GameAction.RELOAD)) {
                    reload();
                }

                return;
            }

            // Reload
            if (inputManager.justPressed(GameAction.RELOAD)) {
                reload();
            }

            // Knife
            if (inputManager.justPressed(GameAction.KNIFE)) {
                performKnife();
            }

            // Weapon Switching
            if (inputManager.justPressed(GameAction.WEAPON_1)) switchWeapon(0);
            if (inputManager.justPressed(GameAction.WEAPON_2)) switchWeapon(1);
            if (inputManager.justPressed(GameAction.WEAPON_3)) switchWeapon(2);
            if (inputManager.justPressed(GameAction.WEAPON_4)) switchWeapon(3);
            if (inputManager.justPressed(GameAction.WEAPON_NEXT)) {
                const nextIdx = (ctx.gameState.activeWeaponIndex + 1) % ctx.gameState.weapons.length;
                switchWeapon(nextIdx);
            }

            // Fire / Aim State
            // Use raw input check to ensure immediate response to mouse release
            const weapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];

            if (weapon?.automatic) {
                // For automatic weapons, check raw input state for immediate response
                ctx.gameState.isFiring = inputManager.isFireInputActive();
            } else {
                // For semi-auto, cached state is fine
                ctx.gameState.isFiring = inputManager.isDown(GameAction.FIRE);
            }
            ctx.gameState.isAiming = inputManager.isDown(GameAction.AIM);
            ctx.setIsAiming(ctx.gameState.isAiming);

            // Reset semi-auto lock if trigger released
            if (!ctx.gameState.isFiring) {
                ctx.gameState.weaponFiredThisTriggerPull = false;
            }

            // Execute shooting if firing
            if (ctx.gameState.isFiring) {
                performShoot(now);
            }
        }
    };
};
