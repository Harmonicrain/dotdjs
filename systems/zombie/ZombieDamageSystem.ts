import * as BABYLON from '@babylonjs/core';
import { GameStateData, GameMessage, HellhoundState } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { TimerManager } from '../../engine/TimerManager';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { EventBus } from '../../engine/EventBus';

export interface IZombieDamageContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    timerManager: TimerManager;
    configManager: MapConfigManager;
    zombies: Zombie[];
    eventBus: EventBus;
    remote: {
        pos: BABYLON.Vector3;
        gameState: { isDowned: boolean };
    };
    connectionStatusRef: { current: string };
    send(data: GameMessage): void;
    setHealth(v: number): void;
    setIsDowned(v: boolean): void;
    setIsGameOver(v: boolean): void;
    setFlashColor(v: string | null): void;
}

/**
 * ZombieDamageSystem
 *
 * Authority only (HOST or SOLO).
 * Responsibility: Detects proximity to the local player and applies damage.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createZombieDamageSystem = (ctx: IZombieDamageContext): System => {

    // Pre-allocated scratch for knockback direction — avoids 2 allocs per hit
    const _pushDir = new BABYLON.Vector3();

    const getHorizontalDist = (p1: BABYLON.Vector3, p2: BABYLON.Vector3) => {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.z - p2.z, 2));
    };

    const handlePlayerDamage = (data: { amount: number; source: string }) => {
        const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
        if (!isAuthority || ctx.gameState.isGodMode) return;
        if (ctx.gameState.health <= 0 || ctx.gameState.isDowned) return;

        ctx.gameState.lastDamageTime = Date.now();
        ctx.gameState.health = Math.max(0, ctx.gameState.health - data.amount);
        ctx.setHealth(ctx.gameState.health);
        ctx.setFlashColor("rgba(200, 50, 0, 0.4)");

        if (ctx.gameState.health <= 0 && !ctx.gameState.isDowned) {
            const isSolo = ctx.gameModeRef.current === 'SOLO';
            const hasQuickRevive = ctx.gameState.perkStates['quickRevive'];
            if (isSolo && !hasQuickRevive) {
                ctx.setHealth(0);
                ctx.setIsGameOver(true);
            } else {
                ctx.gameState.isDowned = true;
                ctx.gameState.downedStartTime = Date.now();
                ctx.gameState.downedTimeLimit = ctx.configManager.gameplay.DOWNED_BLEED_OUT_TIME;
                ctx.setIsDowned(true);
                if (!isSolo) {
                    ctx.send({
                        type: 'PLAYER_DOWNED',
                        playerName: ctx.gameState.playerName || "Survivor",
                        position: { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z }
                    });

                    // In multiplayer, if both players are now downed, trigger game over
                    if (ctx.remote.gameState.isDowned) {
                        ctx.setIsGameOver(true);
                    }
                }
            }
        }
    };

    ctx.eventBus.on('PLAYER_DAMAGE', handlePlayerDamage);

    return {
        name: 'zombieDamage',
        dispose: () => {
            ctx.eventBus.off('PLAYER_DAMAGE', handlePlayerDamage);
        },
        update: (dt: number, now: number) => {
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            if (!isAuthority || ctx.gameState.isDebugMode || ctx.gameState.isGodMode) return;

            const gameState = ctx.gameState;
            if (gameState.health <= 0 || gameState.isDowned || gameState.isSpectating || gameState.isGameOver) return;

            const camera = ctx.camera;
            const zombies = ctx.zombies;
            const currentGameMode = ctx.gameModeRef.current;
            
            const gc = ctx.configManager.gameplay;
            const zc = ctx.configManager.zombieAI;
            const hc = ctx.configManager.hellhound;
            const combat = ctx.configManager.combat;
            const visuals = ctx.configManager.visuals;

            for (const z of zombies) {
                if (z.isDead) continue;

                // === HELLHOUNDS ONLY DAMAGE DURING LUNGE ===
                // Skip damage check if hellhound is not in ATTACKING (lunge) state
                if (z.type === 'HELLHOUND' && z.hellhoundState !== HellhoundState.ATTACKING) {
                    continue;
                }

                const attackRange = zc.ATTACK_RANGE;
                const attackCooldown = zc.ATTACK_COOLDOWN; 
                const distToLocalPlayer = getHorizontalDist(z.mesh.position, camera.position);
                const heightDiff = Math.abs(z.mesh.position.y - camera.position.y);

                if (distToLocalPlayer <= attackRange && heightDiff < combat.ATTACK_HEIGHT_THRESHOLD) {
                    if (now - gameState.lastDamageTime < gc.DAMAGE_IMMUNITY_MS) continue;
                    if (now - z.lastAttackTime > attackCooldown) {
                        z.lastAttackTime = now;
                        const isHellhound = z.type === 'HELLHOUND';
                        const damage = isHellhound ? hc.DAMAGE : gc.ZOMBIE_DAMAGE;

                        gameState.lastDamageTime = now;
                        gameState.health = Math.max(0, gameState.health - damage);
                        ctx.setHealth(gameState.health);
                        ctx.setFlashColor(isHellhound ? "rgba(200, 50, 0, 0.4)" : "rgba(255, 0, 0, 0.4)");
                        ctx.timerManager.schedule('dmg_flash', visuals.HIT_FLASH_DURATION * 2, () => ctx.setFlashColor(null));

                        // Apply knockback — subtractToRef + normalizeToRef avoid 2 allocations
                        camera.position.subtractToRef(z.mesh.position, _pushDir);
                        _pushDir.y = 0;
                        _pushDir.normalize();
                        gameState.externalForce.addInPlaceFromFloats(
                            _pushDir.x * 0.5,
                            0,
                            _pushDir.z * 0.5
                        );

                        if (gameState.health <= 0 && !gameState.isDowned) {
                            const isSolo = currentGameMode === 'SOLO';
                            const hasQuickRevive = gameState.perkStates['quickRevive'];

                            if (isSolo && !hasQuickRevive) {
                                ctx.setHealth(0);
                                ctx.setIsGameOver(true);
                            } else {
                                gameState.isDowned = true;
                                gameState.downedStartTime = now;
                                gameState.downedTimeLimit = gc.DOWNED_BLEED_OUT_TIME;
                                ctx.setIsDowned(true);
                                if (!isSolo) {
                                    ctx.send({
                                        type: 'PLAYER_DOWNED',
                                        playerName: gameState.playerName || "Survivor",
                                        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z }
                                    });

                                    // In multiplayer, if both players are now downed, trigger game over
                                    if (ctx.remote.gameState.isDowned) {
                                        ctx.setIsGameOver(true);
                                    }
                                }
                            }
                        }
                    }
                }

                // Check proximity to CLIENT player and forward damage via network
                if (currentGameMode === 'HOST' && ctx.connectionStatusRef.current === 'CONNECTED') {
                    if (!ctx.remote.gameState.isDowned) {
                        const distToRemote = getHorizontalDist(z.mesh.position, ctx.remote.pos);
                        const heightDiffRemote = Math.abs(z.mesh.position.y - ctx.remote.pos.y);
                        if (distToRemote <= attackRange && heightDiffRemote < combat.ATTACK_HEIGHT_THRESHOLD) {
                            if (now - (z.lastRemoteAttackTime ?? 0) > attackCooldown) {
                                z.lastRemoteAttackTime = now;
                                const isHellhound = z.type === 'HELLHOUND';
                                const damage = isHellhound ? hc.DAMAGE : gc.ZOMBIE_DAMAGE;
                                ctx.send({ type: 'ZOMBIE_DAMAGE', amount: damage, isHellhound });
                            }
                        }
                    }
                }
            }
        }
    };
};
