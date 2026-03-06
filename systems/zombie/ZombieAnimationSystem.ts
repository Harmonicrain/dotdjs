import * as BABYLON from '@babylonjs/core';
import { ZombieState, GameStateData } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { MapConfigManager } from '../../maps/MapConfigManager';

export interface IZombieAnimationContext {
    gameState: GameStateData;
    scene: BABYLON.Scene;
    zombies: Zombie[];
    configManager: MapConfigManager;
}

// ── Fire particle pool constants ─────────────────────────────────────────────
const FIRE_POOL_SIZE = 4;

// Pre-allocated static vectors used by the fire pool — zero runtime allocations.
const _fireMinBox = new BABYLON.Vector3(-0.2, 0, -0.2);
const _fireMaxBox = new BABYLON.Vector3(0.2, 1.5, 0.2);
const _fireGravity = new BABYLON.Vector3(0, 3, 0);

/**
 * ZombieAnimationSystem
 *
 * Handles hit flashes, skeletal animations for GLB zombies, 
 * procedural leg movement for hellhounds, and fire particles.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createZombieAnimationSystem = (ctx: IZombieAnimationContext): System => {

    // ── Fire particle system pool ─────────────────────────────────────────────
    // Pre-allocate a small pool so that igniting a zombie never triggers a Babylon
    // shader recompile (which happens on the first new ParticleSystem in a scene).
    const firePool: BABYLON.ParticleSystem[] = [];
    let fireCursor = 0;
    let fireTexture: BABYLON.Texture | null = null;

    const initFirePool = () => {
        const scene = ctx.scene;
        if (!scene || firePool.length > 0) return;

        fireTexture = new BABYLON.Texture('https://playground.babylonjs.com/textures/flare.png', scene);

        for (let i = 0; i < FIRE_POOL_SIZE; i++) {
            const fs = new BABYLON.ParticleSystem(`zombieFire_${i}`, 50, scene);
            fs.particleTexture = fireTexture;
            fs.minEmitBox = _fireMinBox;
            fs.maxEmitBox = _fireMaxBox;
            fs.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
            fs.color2 = new BABYLON.Color4(1, 0.2, 0, 0.5);
            fs.minSize = 0.2; fs.maxSize = 0.5;
            fs.minLifeTime = 0.3; fs.maxLifeTime = 0.6;
            fs.emitRate = 30;
            fs.gravity = _fireGravity;
            fs.disposeOnStop = false;
            // Do NOT start — acquired on demand
            firePool.push(fs);
        }
    };

    /**
     * Acquires a fire PS from the pool, attaches it to a mesh, and starts it.
     * Uses round-robin eviction so a heavily-burning wave never exhausts the pool.
     */
    const acquireFirePS = (mesh: BABYLON.AbstractMesh): BABYLON.ParticleSystem => {
        initFirePool();
        const idx = fireCursor % FIRE_POOL_SIZE;
        fireCursor++;
        const fs = firePool[idx];
        if (fs.isStarted()) { fs.stop(); fs.reset(); }
        fs.emitter = mesh;
        fs.start();
        return fs;
    };

    return {
        name: 'zombieAnim',
        dispose: () => {
            for (const fs of firePool) {
                if (fs.isStarted()) fs.stop();
                fs.dispose(false);
            }
            firePool.length = 0;
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
                        if (z.limbs) {
                            if (isMoving) {
                                const speedFactor = z.speed * vc.ZOMBIE_ANIM_SPEED_FACTOR;
                                // MODIFIED PHASE LOGIC: Use a more distinct phase shift per zombie
                                const baseT = (now % 100000) * vc.ANIM_TIME_FACTOR * speedFactor;
                                const t = baseT + (z.animOffset || 0);
                                
                                // --- ASYMMETRICAL ZOMBIE LIMP ---
                                // Different phase shifts for arms vs legs makes it look less like a single t-value
                                const armT = t + (z.animOffset || 0) * 0.5; 
                                
                                // Left leg: relatively normal swing
                                const swingL = Math.sin(t) * 0.45;
                                // Right leg: "stiff" draggy leg (lower amplitude, offset timing)
                                const swingR = Math.sin(t - 0.5) * 0.25;
                                
                                z.limbs.legL.rotation.x = -swingL;
                                z.limbs.legR.rotation.x = -swingR;
                                
                                // --- DANGLING / REACHING ARMS ---
                                // Arms reach forward but sway erratically (using armT for offset)
                                const armSway = Math.sin(armT * 0.8) * 0.15;
                                // Image style: one arm high, one arm mid/low, reaching out
                                const reachBase = -1.4; // Reach further forward
                                
                                // Left arm: high reach, sways out
                                z.limbs.armL.rotation.x = reachBase - 0.4 + armSway + Math.cos(t * 0.5) * 0.1;
                                z.limbs.armL.rotation.y = -0.3 + Math.sin(armT * 0.3) * 0.2;
                                
                                // Right arm: lower reach, sways out
                                z.limbs.armR.rotation.x = reachBase + 0.3 - armSway + Math.sin(t * 0.4) * 0.15;
                                z.limbs.armR.rotation.y = 0.4 + Math.cos(armT * 0.3) * 0.2;

                                // --- SLOUCHING & TILTING TORSO ---
                                if (z.torsoMesh) {
                                     // Bob up and down (REDUCED ABSOLUTE OVERRIDE - use relative if possible)
                                     // Base Y is 1.275 in factory
                                     const bob = Math.abs(Math.sin(t)) * 0.05;
                                     z.torsoMesh.position.y = 1.275 + bob;
                                     
                                     // Slouch forward
                                     z.torsoMesh.rotation.x = 0.25 + Math.sin(t * 0.5) * 0.05;
                                     // Lateral "drunk" swaying
                                     z.torsoMesh.rotation.z = Math.sin(armT * 0.4) * 0.12;
                                     
                                     // Head erratic tilt
                                     if (z.headMesh) {
                                         z.headMesh.rotation.z = Math.cos(armT * 0.6) * 0.2;
                                         z.headMesh.rotation.x = -0.1 + Math.sin(t * 0.7) * 0.15;
                                     }
                                }
                            } else if (isAttacking) {
                                // Attack Lunge (Slower)
                                const t = now * 0.01;
                                z.limbs.armL.rotation.x = -1.5 + Math.sin(t) * 0.4;
                                z.limbs.armR.rotation.x = -1.5 + Math.cos(t) * 0.4;
                            } else {
                                // --- IDLE ZOMBIE POSE ---
                                // Even when idle, zombies should hold their arms out
                                const t = now * 0.001; // Slower idle
                                const baseOffset = (z.animOffset || 0);
                                
                                // Reaching pose (Idle)
                                const reachBase = -1.2;
                                z.limbs.armL.rotation.x = reachBase + Math.sin(t + baseOffset) * 0.1;
                                z.limbs.armR.rotation.x = reachBase + Math.cos(t + baseOffset) * 0.12;
                                
                                // Splay arms slightly
                                z.limbs.armL.rotation.y = -0.2 + Math.sin(t * 0.5) * 0.05;
                                z.limbs.armR.rotation.y = 0.2 + Math.cos(t * 0.5) * 0.05;

                                z.limbs.legL.rotation.x = 0;
                                z.limbs.legR.rotation.x = 0;
                                
                                if (z.torsoMesh) {
                                    z.torsoMesh.rotation.x = 0.2; // Slight slouch
                                    z.torsoMesh.rotation.z = Math.sin(t * 0.3) * 0.05;
                                }
                            }
                        }
                    }
                }

                // ── HELLHOUND (procedural limbs) ────────────────────────
                else if (z.type === 'HELLHOUND' && z.limbs) {
                    if (isMoving) {
                        const speedFactor = z.speed * vc.HELLHOUND_ANIM_SPEED_FACTOR;
                        const t = (now * vc.ANIM_TIME_FACTOR * speedFactor) + (z.animOffset || 0);
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
                    if (!z.fireSystem) {
                        // Acquire from pool — no new ParticleSystem allocation, no shader recompile
                        z.fireSystem = acquireFirePS(z.mesh);
                    }
                }
            }
        }
    };
};
