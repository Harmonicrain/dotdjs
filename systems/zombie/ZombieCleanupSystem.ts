import * as BABYLON from '@babylonjs/core';
import { GameStateData } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { releaseZombieMesh, releaseHellhoundMesh } from '../../factories/ZombieMeshFactory';

export interface IZombieCleanupContext {
    gameState: GameStateData;
    gameModeRef: { current: string };
    configManager: MapConfigManager;
    zombies: Zombie[];
    /** Shared ref written by ZombieAISystem — used to remove crowd agents on despawn */
    crowdRef: { current?: BABYLON.ICrowd };
}

/**
 * ZombieCleanupSystem
 *
 * Runs on all peers.
 * Responsibility: Detects dead zombies and disposes of their meshes and particle systems.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createZombieCleanupSystem = (ctx: IZombieCleanupContext): System => {
    let lastTickTime = 0;

    return {
        name: 'zombieCleanup',
        update: (dt: number, now: number) => {
            if (ctx.gameState.isDebugMode) return;
            const zombies = ctx.zombies;

            // Compensate for pause: shift spawnTime forward so paused
            // real-time doesn't count toward stuck timeout
            if (lastTickTime !== 0 && now - lastTickTime > 150) {
                const pauseDuration = now - lastTickTime;
                for (let i = 0; i < zombies.length; i++) {
                    zombies[i].spawnTime += pauseDuration;
                }
            }
            lastTickTime = now;
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            const zc = ctx.configManager.zombieAI;

            const crowd = ctx.crowdRef.current;

            for (let i = zombies.length - 1; i >= 0; i--) {
                const z = zombies[i];

                // --- DISPOSAL ---
                if (z.isDead) {
                    // Remove from Recast Crowd before releasing mesh
                    if (crowd && z.crowdAgentIndex !== undefined) {
                        crowd.removeAgent(z.crowdAgentIndex);
                        z.crowdAgentIndex = undefined;
                    }
                    if (z.fireSystem) z.fireSystem.dispose(false);
                    if (z.type === 'HELLHOUND') {
                        releaseHellhoundMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, limbs: z.limbs! });
                    } else {
                        releaseZombieMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, torso: z.torsoMesh, limbs: z.limbs! });
                    }
                    zombies[i] = zombies[zombies.length - 1];
                    zombies.pop();
                    continue;
                }

                // --- OUT OF BOUNDS / STUCK CLEANUP (Authority Only) ---
                if (isAuthority && !ctx.gameState.isPaused) {
                    const isStuckTimeout = (now - z.spawnTime > zc.STUCK_TIMEOUT) && !z.isCrawling && z.type === 'ZOMBIE';
                    if (z.mesh.position.y < -10 || isStuckTimeout) {
                        // Remove from Recast Crowd before releasing mesh
                        if (crowd && z.crowdAgentIndex !== undefined) {
                            crowd.removeAgent(z.crowdAgentIndex);
                            z.crowdAgentIndex = undefined;
                        }
                        if (z.fireSystem) z.fireSystem.dispose(false);
                        if (z.type === 'HELLHOUND') {
                            releaseHellhoundMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, limbs: z.limbs! });
                        } else {
                            releaseZombieMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, torso: z.torsoMesh, limbs: z.limbs! });
                        }
                        zombies[i] = zombies[zombies.length - 1];
                        zombies.pop();

                        ctx.gameState.zombiesToSpawn++;
                        ctx.gameState.zombiesAlive--;
                    }
                }
            }
        }
    };
};
