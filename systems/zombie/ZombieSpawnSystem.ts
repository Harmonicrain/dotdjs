import { ZombieState, GameStateData } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie, GroundSpawn } from '../../types/entities';
import { ZombieManager } from '../../managers/ZombieManager';
import { VisualManager } from '../../managers/VisualManager';

export interface ISpawnAIContext {
    gameState: GameStateData;
    gameModeRef: { current: string };
    zombies: Zombie[];
    groundSpawns: GroundSpawn[];
    zombieManager: ZombieManager;
    visualManager: VisualManager;
}

const SPAWN_UNDERGROUND_Y = -3.5; // Y position while zombie waits underground (BREAKING_LID)
const SPAWN_START_Y = -1.5;       // Y position when emergence begins after lid is cleared

/**
 * ZombieSpawnSystem
 *
 * Authority only (HOST or SOLO).
 * Responsibility: Ground spawn emergence (SPAWNING state) and lid-breaking
 * animation (BREAKING_LID state). Sets z.state = CHASING when complete;
 * ZombieAISystem's crowd guard picks it up next frame.
 */
export const createZombieSpawnSystem = (ctx: ISpawnAIContext): System => {
    return {
        name: 'zombieSpawnAI',
        update: (dt: number, _now: number) => {
            if (ctx.gameState.isDebugMode || ctx.gameState.isPaused) return;
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            if (!isAuthority) return;

            for (const z of ctx.zombies) {
                if (z.isDead) continue;
                if (z.state !== ZombieState.SPAWNING && z.state !== ZombieState.BREAKING_LID) continue;

                if (z.state === ZombieState.SPAWNING) {
                    const emergeSpeed = 0.5;
                    z.mesh.position.y += emergeSpeed * dt;

                    if (z.mesh.position.y >= 0) {
                        z.mesh.position.y = 0;
                        z.state = ZombieState.CHASING;
                        // Release hole so next queued zombie can emerge.
                        // ZombieAISystem's crowd guard adds this zombie to the crowd next frame.
                        if (z.spawnHoleId) {
                            ctx.zombieManager.releaseGroundSpawnHole(z.spawnHoleId);
                            z.spawnHoleId = undefined;
                        }
                    }
                } else if (z.state === ZombieState.BREAKING_LID) {
                    z.mesh.position.y = SPAWN_UNDERGROUND_Y;

                    if (z.targetLidId) {
                        const gs = ctx.groundSpawns.find(g => g.id === z.targetLidId);
                        if (gs && gs.lidMesh && gs.hasLid) {
                            if (z.lidBreakTimer === undefined) {
                                z.lidBreakTimer = 0;
                            }
                            z.lidBreakTimer += dt;

                            // 5 slow bounces over 4 seconds
                            const breakDuration = 4.0;
                            const totalBounces = 5;
                            const progress = z.lidBreakTimer / breakDuration;
                            const bounceHeight = 0.15 * Math.abs(Math.sin(progress * Math.PI * totalBounces));
                            gs.lidMesh.position.y = gs.position.y + 0.04 + bounceHeight;

                            if (z.lidBreakTimer >= breakDuration) {
                                gs.hasLid = false;
                                gs.lidMesh.position.y = gs.position.y + 0.04;
                                gs.lidMesh.setEnabled(false);
                                z.targetLidId = undefined;
                                z.lidBreakTimer = undefined;

                                ctx.visualManager.createGroundSpawnEruption(gs.position);
                                ctx.visualManager.setHoleSmokeEnabled(gs.position, true);
                            }
                        } else {
                            // Lid already removed by another zombie or reset
                            z.targetLidId = undefined;
                            z.lidBreakTimer = undefined;
                        }
                    }

                    // Once the lid is gone, begin emergence
                    if (!z.targetLidId) {
                        z.mesh.position.y = SPAWN_START_Y;
                        z.state = ZombieState.SPAWNING;
                    }
                }
            }
        }
    };
};
