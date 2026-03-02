import * as BABYLON from '@babylonjs/core';
import { ZombieState, GameStateData } from '../types/index';
import { System } from '../types/systems';
import { Zombie } from '../types/entities';
import { MapConfigManager } from '../managers/MapConfigManager';

export interface IZombieAnimationContext {
    gameState: GameStateData;
    scene: BABYLON.Scene;
    zombies: Zombie[];
    configManager: MapConfigManager;
}

/**
 * ZombieAnimationSystem
 *
 * Handles hit flashes, skeletal animations for GLB zombies, 
 * procedural leg movement for hellhounds, and fire particles.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createZombieAnimationSystem = (ctx: IZombieAnimationContext): System => {

    let fireTexture: BABYLON.Texture | null = null;

    return {
        name: 'zombieAnim',
        dispose: () => {
            if (fireTexture) {
                fireTexture.dispose();
                fireTexture = null;
            }
        },
        update: (dt: number, now: number) => {
            const scene = ctx.scene;
            if (!scene) return;
            
            const vc = ctx.configManager.visuals;

            for (const z of ctx.zombies) {
                if (z.isDead) continue;

                if (ctx.gameState.isDebugMode) {
                    if (z.type === 'ZOMBIE') {
                        const root = z.mesh as any;
                        if (root._glbLoaded && root._zombieWalkAnim) {
                            root._zombieWalkAnim.pause();
                        }
                    }
                    continue;
                }

                const isMoving = z.state === ZombieState.CHASING
                    || z.state === ZombieState.APPROACHING_WINDOW
                    || z.state === ZombieState.ENTERING;
                const isAttacking = z.state === ZombieState.ATTACKING_BARRIER;

                // ── GLB ZOMBIE (necromorph) or PROCEDURAL ────────────────
                if (z.type === 'ZOMBIE') {
                    const root = z.mesh as any;

                    if (root._glbLoaded) {
                        const walkAnim: BABYLON.AnimationGroup = root._zombieWalkAnim;
                        if (!walkAnim) continue;

                        if (isMoving) {
                            const speedRatio = Math.max(0.4, z.speed * vc.ZOMBIE_ANIM_SPEED_FACTOR);
                            if (!walkAnim.isPlaying) {
                                walkAnim.loopAnimation = true;
                                walkAnim.play(true);
                            }
                            walkAnim.speedRatio = speedRatio;
                            z.currentAnim = 'walk';

                        } else if (isAttacking) {
                            if (!walkAnim.isPlaying) {
                                walkAnim.loopAnimation = true;
                                walkAnim.play(true);
                            }
                            walkAnim.speedRatio = 2.0;
                            z.currentAnim = 'attack';

                        } else {
                            if (!walkAnim.isPlaying) {
                                walkAnim.loopAnimation = true;
                                walkAnim.play(true);
                            }
                            walkAnim.speedRatio = 0.15;
                            z.currentAnim = 'idle';
                        }
                    } else {
                        // Procedural Animation for Primitives
                        // We need access to limbs (stored in z.limbs)
                        if (z.limbs) {
                            if (isMoving) {
                                const speedFactor = z.speed * vc.ZOMBIE_ANIM_SPEED_FACTOR; // Reuse factor
                                const t = now * vc.ANIM_TIME_FACTOR * speedFactor;
                                
                                // Bipedal Walk Cycle (Opposite arm/leg)
                                const amp = 0.6; // Swing amplitude
                                z.limbs.armL.rotation.x = Math.sin(t) * amp;
                                z.limbs.armR.rotation.x = -Math.sin(t) * amp;
                                z.limbs.legL.rotation.x = -Math.sin(t) * amp;
                                z.limbs.legR.rotation.x = Math.sin(t) * amp;
                                
                                // Bobbing
                                if (z.torsoMesh) {
                                     // Bob up and down (2x frequency of steps)
                                     z.torsoMesh.position.y = 1.275 + Math.abs(Math.sin(t)) * 0.05;
                                     // Head follows torso
                                     if (z.headMesh) {
                                         // Head is parented to torso, so no manual update needed if parenting works
                                         // But createZombieMesh parents head to torso.
                                     }
                                }
                            } else if (isAttacking) {
                                // Attack Lunge
                                const t = now * 0.015;
                                z.limbs.armL.rotation.x = -1.5 + Math.sin(t) * 0.5;
                                z.limbs.armR.rotation.x = -1.5 + Math.cos(t) * 0.5;
                            } else {
                                // Idle Breathe
                                const t = now * 0.002;
                                z.limbs.armL.rotation.x = Math.sin(t) * 0.1;
                                z.limbs.armR.rotation.x = Math.cos(t) * 0.1;
                                z.limbs.legL.rotation.x = 0;
                                z.limbs.legR.rotation.x = 0;
                            }
                        }
                    }
                }

                // ── HELLHOUND (procedural limbs) ────────────────────────
                else if (z.type === 'HELLHOUND' && z.limbs) {
                    if (isMoving) {
                        const speedFactor = z.speed * vc.HELLHOUND_ANIM_SPEED_FACTOR;
                        const t = now * vc.ANIM_TIME_FACTOR * speedFactor;
                        z.limbs.armL.rotation.x = Math.sin(t) * 0.5;
                        z.limbs.legR.rotation.x = Math.sin(t) * 0.5;
                        z.limbs.armR.rotation.x = -Math.sin(t) * 0.5;
                        z.limbs.legL.rotation.x = -Math.sin(t) * 0.5;
                    } else {
                        z.limbs.armL.rotation.x = 0;
                        z.limbs.armR.rotation.x = 0;
                        z.limbs.legL.rotation.x = 0;
                        z.limbs.legR.rotation.x = 0;
                    }
                }

                // --- FIRE PARTICLES ---
                if (z.isBurning) {
                    if (!z.fireSystem && scene) {
                        const fs = new BABYLON.ParticleSystem("zombieFire", 50, scene);
                        if (!fireTexture) {
                            fireTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/flare.png", scene);
                        }
                        fs.particleTexture = fireTexture;
                        fs.emitter = z.mesh;
                        fs.minEmitBox = new BABYLON.Vector3(-0.2, 0, -0.2);
                        fs.maxEmitBox = new BABYLON.Vector3(0.2, 1.5, 0.2);
                        fs.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
                        fs.color2 = new BABYLON.Color4(1, 0.2, 0, 0.5);
                        fs.minSize = 0.2; fs.maxSize = 0.5;
                        fs.minLifeTime = 0.3; fs.maxLifeTime = 0.6;
                        fs.emitRate = 30;
                        fs.gravity = new BABYLON.Vector3(0, 3, 0);
                        fs.start();
                        z.fireSystem = fs;
                    }
                }
            }
        }
    };
};
