import * as BABYLON from '@babylonjs/core';
import { GameStateData, GameMessage, HellhoundState, PowerUpType } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { TimerManager } from '../../engine/TimerManager';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { EventBus } from '../../engine/EventBus';
import { getHorizontalDist } from '../../engine/GeometryUtils';

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
    applyDamageToLocalPlayer(amount: number, flashColor: string): void;
    addPoints(amount: number): void;
    hasDoublePoints(): boolean;
}

/**
 * applyDamageToZombie
 * 
 * Shared logic for applying damage to a zombie from any source (projectile, knife, etc.)
 */
export const applyDamageToZombie = (z: Zombie, amount: number, ctx: IZombieDamageContext, isHeadshot: boolean = false) => {
    if (z.isDead) return;

    const gc = ctx.configManager.gameplay;
    const isInstaKill = !!(ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL] && ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL]! > Date.now());
    
    const finalDamage = isInstaKill ? z.maxHealth : amount;
    z.health -= finalDamage;
    z.lastHitTime = Date.now();

    ctx.eventBus.emit('PLAYER_HIT', { zombieId: z.id, damage: finalDamage });

    // Points logic
    const basePoints = isHeadshot ? gc.POINTS_HEADSHOT : gc.POINTS_HIT;
    const pointsToGive = ctx.hasDoublePoints() ? basePoints * 2 : basePoints;
    ctx.addPoints(pointsToGive);
};

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

    return {
        name: 'zombieDamage',
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

                        ctx.applyDamageToLocalPlayer(damage, isHellhound ? "rgba(200, 50, 0, 0.4)" : "rgba(255, 0, 0, 0.4)");
                        ctx.timerManager.schedule('dmg_flash', visuals.HIT_FLASH_DURATION * 2, () => ctx.setFlashColor(null));

                        // Apply knockback — subtractToRef + normalizeToRef avoid 2 allocations
                        camera.position.subtractToRef(z.mesh.position, _pushDir);
                        _pushDir.y = 0;
                        _pushDir.normalize();
                        gameState.externalForce.addInPlaceFromFloats(
                            _pushDir.x * combat.KNOCKBACK_FORCE,
                            0,
                            _pushDir.z * combat.KNOCKBACK_FORCE
                        );
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
