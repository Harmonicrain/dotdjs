import * as BABYLON from '@babylonjs/core';
import { GameAction, InputManager } from '../engine/InputManager';
import { PowerUpType, GameStateData, GameMessage } from '../types/index';
import { System } from '../types/systems';
import { TimerManager } from '../engine/TimerManager';
import { VisualManager } from '../managers/VisualManager';
import { GameEngine } from '../game/GameEngine';
import { ZombieManager } from '../managers/ZombieManager';
import { HellhoundManager } from '../managers/HellhoundManager';
import { Zombie } from '../types/entities';
import { MapConfigManager } from '../managers/MapConfigManager';

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
    soundManager?: { play: (name: string) => void } | null;
}

// Pre-allocated direction vectors for camera.getDirection() calls
const _forward = new BABYLON.Vector3(0, 0, 1);
const _right   = new BABYLON.Vector3(1, 0, 0);
const _up      = new BABYLON.Vector3(0, 1, 0);

// Pre-allocated ray for knife attacks
const _knifeRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), BABYLON.Vector3.Forward(), 1);
const _knifeDir = new BABYLON.Vector3();

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

    const performShoot = () => {
        const weapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
        if (!weapon.automatic && ctx.gameState.weaponFiredThisTriggerPull) return;
        
        // For automatic weapons, check RAW input state (not cached) to stop firing immediately on mouse release
        if (weapon.automatic && ctx.inputManager && !ctx.inputManager.isFireInputActive()) {
            ctx.gameState.isFiring = false;
            return;
        }
        
        const now = Date.now();
        const fireDelay = 60000 / weapon.fireRate;
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
        
        const cc = ctx.configManager.combat;
        if (ctx.camera && ctx.gameEngine) {
             const spread = ctx.gameState.isAiming ? 0 : cc.HIP_FIRE_SPREAD;
             
             // Always calculate from camera to avoid weapon mesh lerping lag
             const isAds = ctx.gameState.isAiming && !ctx.gameState.isReloading;
             const offset = isAds ? weapon.adsPos : weapon.hipPos;
             const forward = ctx.camera.getDirection(_forward);
             const right = ctx.camera.getDirection(_right);
             const up = ctx.camera.getDirection(_up);
             
             // Calculate muzzle position using barrelLength from config
             const barrelLen = weapon.barrelLength;
             let muzzlePos = ctx.camera.position.clone()
                 .add(right.scale(offset.x))
                 .add(up.scale(offset.y))
                 .add(forward.scale(offset.z + barrelLen));
             
             // Per-weapon hip-fire origin correction
             if (!isAds && weapon.hipFireOriginCorrection) {
                 muzzlePos.addInPlace(up.scale(weapon.hipFireOriginCorrection.up));
                 muzzlePos.addInPlace(right.scale(weapon.hipFireOriginCorrection.right));
             }
             
             // Compensate muzzle position for player movement so bullets appear from barrel center
             // Without this, bullets visually spawn behind the barrel when strafing because the
             // camera has moved by the time the projectile is rendered on the next frame
             if (ctx.gameState.currentVelocity) {
                 muzzlePos.addInPlace(ctx.gameState.currentVelocity);
             }
             
             // BULLET CONVERGENCE: Cast ray from camera center to find actual target point
             // This ensures bullets go exactly where the crosshair points regardless of muzzle offset
             const maxTargetDist = 500;
             const aimRay = new BABYLON.Ray(ctx.camera.position, forward, maxTargetDist);
             const aimHit = ctx.scene.pickWithRay(aimRay, (mesh) => {
                 // Ignore weapon meshes, projectiles, and non-collidable objects
                 return mesh.isPickable && 
                        !mesh.name.includes("weapon") && 
                        !mesh.name.includes("projectile") &&
                        !mesh.name.includes("knife") &&
                        mesh !== ctx.gameState.knifeMesh;
             });
             
             // Use hit point if found, otherwise use far point along camera forward
             let targetPos: BABYLON.Vector3;
             if (aimHit && aimHit.hit && aimHit.pickedPoint) {
                 targetPos = aimHit.pickedPoint.clone();
             } else {
                 targetPos = ctx.camera.position.add(forward.scale(maxTargetDist));
             }
             
             // Compensate target position for player movement so aim direction stays accurate
             if (ctx.gameState.currentVelocity) {
                 targetPos.addInPlace(ctx.gameState.currentVelocity);
             }
             
             const MIN_SPAWN_DIST = cc.MIN_PROJECTILE_SPAWN_DIST; 
             const camToMuzzle = muzzlePos.subtract(ctx.camera.position);
             const forwardDist = BABYLON.Vector3.Dot(camToMuzzle, forward);
             if (forwardDist < MIN_SPAWN_DIST) muzzlePos = muzzlePos.add(forward.scale(MIN_SPAWN_DIST - forwardDist));

             const baseDir = targetPos.subtract(muzzlePos).normalize();
             for(let i=0; i < weapon.pellets; i++) {
                 const dir = baseDir.clone();
                 if (spread > 0) { 
                     dir.x += (Math.random() - 0.5) * spread; dir.y += (Math.random() - 0.5) * spread; dir.z += (Math.random() - 0.5) * spread; 
                     dir.normalize(); 
                 }
                 const bulletVel = dir.scale(cc.PROJECTILE_SPEED);
                  // Inherit player velocity even in ADS to prevent visual "drag" or "curving" when strafing
                  if (ctx.gameState.currentVelocity) {
                      bulletVel.addInPlace(ctx.gameState.currentVelocity);
                  }
                  const finalSpeed = weapon.projectileSpeedOverride ?? bulletVel.length();
                  const finalDir = bulletVel.normalize();
                  ctx.gameEngine.spawnProjectile(
                      muzzlePos, 
                      finalDir, 
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
                      ctx.send({ type: 'SHOOT', origin: { x: muzzlePos.x, y: muzzlePos.y, z: muzzlePos.z }, dir: { x: finalDir.x, y: finalDir.y, z: finalDir.z }, isPacked: weapon.isPacked, damage: weapon.damage, isExplosive: weapon.isExplosive, owner: ctx.gameModeRef.current === 'CLIENT' ? 'CLIENT' : 'HOST', speed: finalSpeed, splashRadius: weapon.splashRadius, splashDamage: weapon.splashDamage, selfDamageMultiplier: weapon.selfDamageMultiplier });
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
        knife.position = new BABYLON.Vector3(0.2, -0.2, 0.5); knife.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
        
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
            const hit = ctx.scene.pickWithRay(_knifeRay, (m) => m.name.includes("zombie") || m.name.includes("hellhound"));
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
        update: (dt: number) => {
            if (!ctx.gameState.hasStarted || ctx.gameState.isPaused || ctx.gameState.isSpectating || ctx.gameState.isGameOver) return;

            const inputManager = ctx.inputManager;
            if (!inputManager) return;

            // PREVENT ACTIONS IF DOWNED
            if (ctx.gameState.isDowned) {
                // Allow shooting if we have a pistol (which we should in downed state)
                const downedWeapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
                if (downedWeapon?.automatic) {
                    ctx.gameState.isFiring = inputManager.isFireInputActive();
                } else {
                    ctx.gameState.isFiring = inputManager.isDown(GameAction.FIRE);
                }
                ctx.gameState.isAiming = inputManager.isDown(GameAction.AIM);
                
                if (ctx.gameState.isFiring) {
                    performShoot();
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
            
            // Reset semi-auto lock if trigger released
            if (!ctx.gameState.isFiring) {
                ctx.gameState.weaponFiredThisTriggerPull = false;
            }

            // Execute shooting if firing
            if (ctx.gameState.isFiring) {
                performShoot();
            }
        }
    };
};
