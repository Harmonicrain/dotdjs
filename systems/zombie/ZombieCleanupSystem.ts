import * as BABYLON from '@babylonjs/core';
import { GameStateData } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { releaseZombieMesh, releaseHellhoundMesh } from '../../meshes/ZombieMeshFactory';

export interface IZombieCleanupContext {
    gameState: GameStateData;
    gameModeRef: { current: string };
    configManager: MapConfigManager;
    zombies: Zombie[];
}

/**
 * ZombieCleanupSystem
 *
 * Runs on all peers.
 * Responsibility: Detects dead zombies and disposes of their meshes and particle systems.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createZombieCleanupSystem = (ctx: IZombieCleanupContext): System => {
    return {
        name: 'zombieCleanup',
        update: (dt: number, now: number) => {
            if (ctx.gameState.isDebugMode) return;
            const zombies = ctx.zombies;
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            const zc = ctx.configManager.zombieAI;

            for (let i = zombies.length - 1; i >= 0; i--) {
                const z = zombies[i];
                
                // --- DISPOSAL ---
                if (z.isDead) { 
                    if (z.fireSystem) z.fireSystem.dispose(false);
                    if (z.type === 'HELLHOUND') {
                        releaseHellhoundMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, limbs: z.limbs! });
                    } else {
                        releaseZombieMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, torso: z.torsoMesh, limbs: z.limbs! });
                    }
                    zombies.splice(i, 1); 
                    continue; 
                }

                // --- OUT OF BOUNDS / STUCK CLEANUP (Authority Only) ---
                if (isAuthority) {
                    const isStuckTimeout = (now - z.spawnTime > zc.STUCK_TIMEOUT) && !z.isCrawling && z.type === 'ZOMBIE';
                    if (z.mesh.position.y < -10 || isStuckTimeout) { 
                        if (z.fireSystem) z.fireSystem.dispose(false);
                        if (z.type === 'HELLHOUND') {
                            releaseHellhoundMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, limbs: z.limbs! });
                        } else {
                            releaseZombieMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, torso: z.torsoMesh, limbs: z.limbs! });
                        }
                        zombies.splice(i, 1); 
                        ctx.gameState.zombiesToSpawn++; 
                        ctx.gameState.zombiesAlive--; 
                    }
                }
            }
        }
    };
};
