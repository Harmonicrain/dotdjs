import * as BABYLON from '@babylonjs/core';
import { PowerUpType, GameStateData, MysteryBox } from '../types/index';
import { createPowerUpMesh } from '../meshes';
import { System } from '../types/systems';
import { PowerUpManager } from '../managers/PowerUpManager';
import { TimerManager } from '../engine/TimerManager';
import { MapConfigManager } from '../managers/MapConfigManager';

export interface IPowerUpContext {
    gameState: GameStateData;
    scene: BABYLON.Scene;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    powerUpManager: PowerUpManager;
    timerManager: TimerManager;
    configManager: MapConfigManager;
    mysteryBox: MysteryBox;
    setInteractionMsg(v: string | null): void;
    setActivePowerUps(v: Partial<Record<PowerUpType, number>>): void;
    soundManager?: { play: (name: string) => void } | null;
}

/**
 * PowerUpSystem
 *
 * Handles power-up spawning, pickup detection, and active effect lifecycle.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createPowerUpSystem = (ctx: IPowerUpContext): System => {
    const activePowerUpIds = new Set<string>();

    return {
        name: 'powerUp',
        update: (dt: number, now: number) => {
            if (!ctx.gameState.hasStarted) return;

            const camera = ctx.camera;
            if (!camera) return;
            const currentGameMode = ctx.gameModeRef.current;
            const gameState = ctx.gameState;
            
            const pc = ctx.configManager.powerUps;
            const vc = ctx.configManager.visuals;

            // Sync set with existing powerups
            if (activePowerUpIds.size !== gameState.powerUps.length) {
                activePowerUpIds.clear();
                for (const p of gameState.powerUps) activePowerUpIds.add(p.id);
            }

            // Process Pending Spawns (From Network)
            if (gameState.pendingPowerUps.length > 0 && ctx.scene) {
                for (const pending of gameState.pendingPowerUps) {
                    if (!activePowerUpIds.has(pending.id)) {
                        const mesh = createPowerUpMesh(ctx.scene, pending.type, pending.position);
                        gameState.powerUps.push({
                            id: pending.id,
                            type: pending.type,
                            mesh,
                            position: pending.position,
                            spawnTime: pending.spawnTime,
                            isCollected: false
                        });
                        activePowerUpIds.add(pending.id);
                    }
                }
                gameState.pendingPowerUps = []; 
            }


            // Host/Solo: Spawn checks & cleanup active effects
            if ((currentGameMode === 'SOLO' || currentGameMode === 'HOST') && !gameState.isGameOver) {
                 if (gameState.accumulatedDropPoints >= gameState.nextDropThreshold) {
                     const forward = camera.getDirection(BABYLON.Vector3.Forward());
                     forward.y = 0;
                     forward.normalize();
                     const spawnPos = camera.position.add(forward.scale(2));
                     spawnPos.y = 0; // Ground level — mesh factory adds +0.3
                     ctx.powerUpManager.spawnPowerUp(spawnPos);
                     
                     gameState.accumulatedDropPoints = 0;
                     gameState.nextDropThreshold = Math.floor(gameState.nextDropThreshold * pc.POINTS_THRESHOLD_MULTIPLIER);
                 }
                 
                  for (const key in gameState.activePowerUps) {
                      const type = key as PowerUpType;
                      if (gameState.activePowerUps[type]! < now) {
                          delete gameState.activePowerUps[type];
                      }
                  }

                 ctx.setActivePowerUps({...gameState.activePowerUps});
            }

            // Client & Host: Update existing powerup meshes
            for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
                const p = gameState.powerUps[i];
                if (p.mesh) {
                    // Frame-rate independent rotation
                    p.mesh.rotation.y += 0.02 * (dt * 60);
                    const lifeTime = now - p.spawnTime;
                    
                    if (lifeTime > pc.DURATION) { 
                        p.mesh.dispose(); 
                        gameState.powerUps.splice(i, 1); 
                        continue; 
                    }
                    
                    if (lifeTime > pc.BLINK_START) {
                        p.mesh.setEnabled(Math.floor(now / 200) % 2 === 0);
                    }
                    
                    if (!gameState.isSpectating && !gameState.isGameOver) {
                        const powerUpPos = p.mesh ? p.mesh.position : p.position;
                        // Use horizontal (XZ) squared distance — faster than sqrt
                        const dx = camera.position.x - powerUpPos.x;
                        const dz = camera.position.z - powerUpPos.z;
                        const horizDistSq = dx * dx + dz * dz;
                        if (horizDistSq < pc.PICKUP_RADIUS * pc.PICKUP_RADIUS) {
                            ctx.powerUpManager.activatePowerUp(p.type); 

                            
                            ctx.setInteractionMsg(p.type.replace('_', ' ') + "!"); 
                            ctx.timerManager.schedule('pu_msg_clear', vc.HUD_MSG_DURATION, () => ctx.setInteractionMsg(null));
                            
                            // Play powerup pickup sound
                            if (p.type === PowerUpType.INSTA_KILL) {
                                ctx.soundManager?.play('instakill');
                            } else if (p.type === PowerUpType.NUKE) {
                                ctx.soundManager?.play('nuke');
                            }
                            
                            p.mesh.dispose(); 
                            gameState.powerUps.splice(i, 1);
                        }
                    }
                }
            }
        }
    };
};
