
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoundSystem } from '../../systems/RoundSystem';
import { createMockContext } from '../mocks/mockContext';

describe('RoundSystem', () => {
    let ctx: any;
    let system: any;

    beforeEach(() => {
        ctx = createMockContext();
        ctx.setRound = vi.fn();
        ctx.setShowRoundIntro = vi.fn();
        ctx.setTotalRoundZombies = vi.fn();
        ctx.setZombiesSpawned = vi.fn();
        ctx.setZombiesKilledInRound = vi.fn();
        ctx.setZombiesToSpawn = vi.fn();
        ctx.setActiveZombiesCount = vi.fn();
        ctx.isConnected = vi.fn(() => false);
        
        system = createRoundSystem(ctx);
    });

    it('should initialize first round on start', () => {
        // Mock startRound is internal, so we check side effects of startRound logic
        // which would be called when intermission ends or manually.
        // Let's force intermission end.
        ctx.gameState.round = 0;
        ctx.gameState.isIntermission = true;
        ctx.gameState.nextRoundTime = 1000;
        ctx.gameState.hasStarted = true;

        system.update(16, 1100);

        expect(ctx.gameState.round).toBe(1);
        expect(ctx.setRound).toHaveBeenCalledWith(1);
        expect(ctx.gameState.totalZombiesInRound).toBe(6); // From ROUND_CONFIG
        expect(ctx.gameState.zombiesToSpawn).toBe(6);
        expect(ctx.gameState.isIntermission).toBe(false);
    });

    it('should scale zombies in higher rounds', () => {
        ctx.gameState.round = 5;
        ctx.gameState.isIntermission = true;
        ctx.gameState.nextRoundTime = 1000;
        ctx.gameState.hasStarted = true;

        system.update(16, 1100);

        expect(ctx.gameState.round).toBe(6);
        // R5 is 22. R6 = 22 + 3 = 25.
        expect(ctx.gameState.totalZombiesInRound).toBe(25);
    });

    it('should handle dog rounds every 5 rounds', () => {
        ctx.gameState.round = 4;
        ctx.gameState.isIntermission = true;
        ctx.gameState.nextRoundTime = 1000;
        ctx.gameState.hasStarted = true;

        system.update(16, 1100);

        expect(ctx.gameState.round).toBe(5);
        expect(ctx.gameState.isDogRound).toBe(true);
        expect(ctx.gameState.dogRoundNumber).toBe(1);
    });

    it('should spawn zombies when time and capacity allow', () => {
        ctx.gameState.round = 1;
        ctx.gameState.zombiesToSpawn = 6;
        ctx.gameState.zombiesAlive = 0;
        ctx.gameState.lastSpawnTime = 0;
        ctx.gameState.hasStarted = true;
        ctx.gameState.isIntermission = false;

        // Round 1 delay is approx 3800 - (1 * 150) = 3650ms
        system.update(16, 4000);

        expect(ctx.zombieManager.spawnZombieHost).toHaveBeenCalledWith(1);
        expect(ctx.gameState.zombiesToSpawn).toBe(5);
        expect(ctx.gameState.zombiesSpawned).toBe(1);
        expect(ctx.gameState.zombiesAlive).toBe(1);
    });

    it('should trigger intermission when all zombies are dead', () => {
        ctx.gameState.round = 1;
        ctx.gameState.zombiesToSpawn = 0;
        ctx.gameState.zombiesAlive = 0;
        ctx.gameState.isIntermission = false;
        ctx.gameState.hasStarted = true;

        system.update(16, 5000);

        expect(ctx.gameState.isIntermission).toBe(true);
        expect(ctx.gameState.nextRoundTime).toBe(5000 + 10000); // INTERMISSION_MS is 10000
    });

    it('should not respawn a healthy client between rounds', () => {
        ctx.gameModeRef.current = 'HOST';
        ctx.isConnected = vi.fn(() => true);
        ctx.remote.gameState.isSpectating = false;
        ctx.gameState.round = 1;
        ctx.gameState.zombiesToSpawn = 0;
        ctx.gameState.zombiesAlive = 0;
        ctx.gameState.isIntermission = false;
        ctx.gameState.hasStarted = true;

        system.update(16, 5000);

        expect(ctx.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RESPAWN' }));
    });

    it('should not respawn a downed client between rounds', () => {
        ctx.gameModeRef.current = 'HOST';
        ctx.isConnected = vi.fn(() => true);
        ctx.remote.gameState.isDowned = true;
        ctx.remote.gameState.isSpectating = false;
        ctx.gameState.round = 1;
        ctx.gameState.zombiesToSpawn = 0;
        ctx.gameState.zombiesAlive = 0;
        ctx.gameState.isIntermission = false;
        ctx.gameState.hasStarted = true;

        system.update(16, 5000);

        expect(ctx.send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'RESPAWN' }));
    });

    it('should respawn a spectating client between rounds', () => {
        ctx.gameModeRef.current = 'HOST';
        ctx.isConnected = vi.fn(() => true);
        ctx.remote.gameState.isDowned = false;
        ctx.remote.gameState.isSpectating = true;
        ctx.gameState.round = 1;
        ctx.gameState.zombiesToSpawn = 0;
        ctx.gameState.zombiesAlive = 0;
        ctx.gameState.isIntermission = false;
        ctx.gameState.hasStarted = true;

        system.update(16, 5000);

        expect(ctx.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESPAWN', round: 2 }));
    });

    it('should increment kill count on ZOMBIE_DEATH event', () => {
        ctx.gameState.zombiesKilledInRound = 0;
        ctx.gameState.zombiesAlive = 1;

        ctx.eventBus.emit('ZOMBIE_DEATH', { id: 'z1' });

        expect(ctx.gameState.zombiesKilledInRound).toBe(1);
        expect(ctx.setZombiesKilledInRound).toHaveBeenCalledWith(1);
    });

    it('should clean up event handlers on dispose', () => {
        const offSpy = vi.spyOn(ctx.eventBus, 'off');
        system.dispose();
        expect(offSpy).toHaveBeenCalledWith('ZOMBIE_DEATH', expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith('HELLHOUND_DEATH', expect.any(Function));
    });
});
