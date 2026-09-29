import { GameStateData, GameMessage } from '../types/index';
import { EventBus } from '../engine/EventBus';
import { TimerManager } from '../engine/TimerManager';
import { System } from '../types/systems';
import { ZombieManager } from '../managers/ZombieManager';
import { HellhoundManager } from '../managers/HellhoundManager';
import { MapConfigManager } from '../managers/MapConfigManager';

export interface IRoundContext {
    gameState: GameStateData;
    gameModeRef: { current: string };
    remote: {
        gameState: {
            isSpectating: boolean;
        };
    };
    eventBus: EventBus;
    timerManager: TimerManager;
    zombieManager: ZombieManager;
    hellhoundManager: HellhoundManager;
    configManager: MapConfigManager;
    isConnected: () => boolean;
    send(data: GameMessage): void;
    setRound(v: number): void;
    setShowRoundIntro(v: boolean): void;
    setTotalRoundZombies(v: number): void;
    setActiveZombiesCount(v: number): void;
    setZombiesSpawned(v: number): void;
    setZombiesKilledInRound(v: number): void;
    setZombiesToSpawn(v: number): void;
    setIsGameOver(v: boolean): void;
}

/**
 * RoundSystem
 *
 * Authority only (HOST or SOLO).
 * Responsibility: Manages the round progression logic, spawning zombies,
 * handling intermissions, and calculating round-based difficulty scaling.
 */
export const createRoundSystem = (ctx: IRoundContext): System => {
    const shouldRespawnRemotePlayer = () => {
        if (ctx.gameModeRef.current !== 'HOST') return false;
        return ctx.remote.gameState.isSpectating;
    };

     
    // Handler for zombie death events - named for proper disposal
    const zombieDeathHandler = () => {
        ctx.gameState.zombiesKilledInRound = (ctx.gameState.zombiesKilledInRound || 0) + 1;
        ctx.setZombiesKilledInRound(ctx.gameState.zombiesKilledInRound);
        ctx.setActiveZombiesCount(ctx.gameState.zombiesAlive);
    };

    // Handler for hellhound death events - named for proper disposal
    const hellhoundDeathHandler = () => {
        ctx.gameState.zombiesKilledInRound = (ctx.gameState.zombiesKilledInRound || 0) + 1;
        ctx.setZombiesKilledInRound(ctx.gameState.zombiesKilledInRound);
        ctx.setActiveZombiesCount(ctx.gameState.zombiesAlive);
    };

    // Listen for zombie deaths to update round-based death counter
    ctx.eventBus.on('ZOMBIE_DEATH', zombieDeathHandler);

    ctx.eventBus.on('HELLHOUND_DEATH', hellhoundDeathHandler);

    const calculateZombiesInRound = (round: number) => {
        const rc = ctx.configManager.round;
        const base = rc.ZOMBIE_COUNTS_BY_ROUND[Math.min(round, 5) - 1] || 24;
        const scaling = round > 5 ? (round - 5) * rc.ZOMBIE_SCALING_PER_ROUND : 0;
        const total = base + scaling;
        return ctx.gameModeRef.current === 'HOST' ? Math.floor(total * rc.COOP_ZOMBIE_MULTIPLIER) : total;
    };

    const calculateDogsInRound = (dogRoundNum: number) => {
        const rc = ctx.configManager.round;
        const playerCount = (ctx.gameModeRef.current === 'HOST' && ctx.isConnected()) ? 2 : 1;
        // Formula: base + (dogRoundNumber * increment) + ((playerCount-1) * coopBonus)
        return rc.DOG_BASE_COUNT + (dogRoundNum * rc.DOG_ROUND_INCREMENT) + (playerCount > 1 ? (playerCount - 1) * rc.DOG_COOP_BONUS : 0);
    };

    const startRound = (round: number) => {
        const rc = ctx.configManager.round;
        ctx.gameState.round = round;
        ctx.setRound(round);
        
        const isDogRound = round > 0 && round % rc.DOG_ROUND_FREQUENCY === 0;
        ctx.gameState.isDogRound = isDogRound;
        
        let total = 0;
        if (isDogRound) {
            ctx.gameState.dogRoundNumber = (ctx.gameState.dogRoundNumber || 0) + 1;
            ctx.gameState.dogRoundStarted = false; 
            ctx.gameState.dogRoundStartTime = 0;
            total = calculateDogsInRound(ctx.gameState.dogRoundNumber);
        } else {
            total = calculateZombiesInRound(round);
        }

        ctx.gameState.totalZombiesInRound = total;
        ctx.gameState.zombiesToSpawn = total;
        ctx.gameState.zombiesSpawned = 0;
        ctx.gameState.zombiesAlive = 0;
        ctx.gameState.zombiesKilledInRound = 0;
        
        ctx.setTotalRoundZombies(total);
        ctx.setZombiesToSpawn(total);
        ctx.setZombiesSpawned(0);
        ctx.setZombiesKilledInRound(0);
        ctx.setActiveZombiesCount(0);
        
        ctx.gameState.isIntermission = false;
        ctx.setShowRoundIntro(true);
        ctx.timerManager.schedule('round_intro', rc.ROUND_INTRO_DURATION_MS, () => ctx.setShowRoundIntro(false));
        
        // Reset per-round point caps
        ctx.gameState.repairPointsRound = 0;
    };

    let lastTickTime = 0;

    return {
        name: 'round',
        update: (dt: number, now: number) => {
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            // In multiplayer, pause only affects local player UI — game logic continues
            const isMultiplayer = ctx.gameModeRef.current !== 'SOLO';
            const effectivelyPaused = ctx.gameState.isPaused && !isMultiplayer;
            if (!isAuthority || !ctx.gameState.hasStarted || effectivelyPaused || ctx.gameState.isGameOver || ctx.gameState.isDebugMode) return;

            // Compensate for pause: if gap > 150ms, shift timestamps forward
            if (lastTickTime !== 0 && now - lastTickTime > 150) {
                const pauseDuration = now - lastTickTime;
                const gs = ctx.gameState;
                if (gs.nextRoundTime) gs.nextRoundTime += pauseDuration;
                if (gs.dogRoundStartTime) gs.dogRoundStartTime += pauseDuration;
                if (gs.lastSpawnTime) gs.lastSpawnTime += pauseDuration;
            }
            lastTickTime = now;

            const gs = ctx.gameState;
            const rc = ctx.configManager.round;

            // 1. Intermission Logic
            if (gs.isIntermission) {
                if (now >= gs.nextRoundTime) {
                    startRound(gs.round + 1);
                }
                return;
            }

            // 2. Spawn Logic
            if (gs.zombiesToSpawn > 0) {
                // Handle Dog Round Start Delay
                if (gs.isDogRound && !gs.dogRoundStarted) {
                    if (!gs.dogRoundStartTime || gs.dogRoundStartTime === 0) {
                        gs.dogRoundStartTime = now;
                    }
                    if (gs.dogRoundStartTime && now - gs.dogRoundStartTime >= rc.DOG_ROUND_START_DELAY) {
                        gs.dogRoundStarted = true;
                        gs.lastSpawnTime = now; // Reset spawn timer
                    }
                    return;
                }

                const spawnDelay = gs.isDogRound 
                    ? rc.DOG_SPAWN_DELAY_MIN + Math.random() * (rc.DOG_SPAWN_DELAY_MAX - rc.DOG_SPAWN_DELAY_MIN)
                    : Math.max(rc.MIN_SPAWN_DELAY_MS, rc.BASE_SPAWN_DELAY_MS - (gs.round * rc.SPAWN_DELAY_REDUCTION_PER_ROUND));

                const maxConcurrent = gs.isDogRound
                    ? rc.DOG_MAX_CONCURRENT
                    : Math.min(rc.MAX_CONCURRENT_ZOMBIES, 3 + gs.round * 2); // 5 on R1, scales to 24 cap by R11

                if (now - gs.lastSpawnTime > spawnDelay && gs.zombiesAlive < maxConcurrent) {
                    if (gs.isDogRound) {
                        ctx.hellhoundManager.spawnHellhoundHost(gs.round);
                    } else {
                        ctx.zombieManager.spawnZombieHost(gs.round);
                    }
                    gs.zombiesToSpawn--;
                    gs.zombiesSpawned++;
                    gs.zombiesAlive++;
                    gs.lastSpawnTime = now;
                    
                    ctx.setZombiesToSpawn(gs.zombiesToSpawn);
                    ctx.setZombiesSpawned(gs.zombiesSpawned);
                    ctx.setActiveZombiesCount(gs.zombiesAlive);
                }
            }

            // 3. End Round Logic
            if (gs.zombiesToSpawn === 0 && gs.zombiesAlive === 0 && !gs.isIntermission) {
                gs.isIntermission = true;
                gs.nextRoundTime = now + rc.INTERMISSION_MS;
                
                // Handle Respawn for dead teammates in COOP
                if (shouldRespawnRemotePlayer()) {
                    ctx.send({ type: 'RESPAWN', round: gs.round + 1, points: rc.RESPAWN_POINTS_BASE + ((gs.round + 1) * rc.RESPAWN_POINTS_PER_ROUND) });
                }
            }
        },

        // Clean up EventBus handlers to prevent memory leaks
        dispose: () => {
            ctx.eventBus.off('ZOMBIE_DEATH', zombieDeathHandler);
            ctx.eventBus.off('HELLHOUND_DEATH', hellhoundDeathHandler);
        }
    };
};
