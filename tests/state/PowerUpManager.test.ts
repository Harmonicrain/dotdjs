import { describe, expect, it, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { PowerUpManager } from '../../managers/PowerUpManager';
import { createMockContext } from '../mocks/mockContext';
import { PowerUpType } from '../../types';

describe('PowerUpManager', () => {
    it('syncs active timed power-ups to the UI immediately on pickup', () => {
        const ctx = createMockContext();
        const uiSetters = {
            setAmmo: vi.fn(),
            setReserveAmmo: vi.fn(),
            setActivePowerUps: ctx.setActivePowerUps,
        };
        const manager = new PowerUpManager(
            ctx.scene,
            ctx.gameState,
            ctx.gameModeRef,
            ctx.send,
            ctx.addPoints,
            [],
            ctx.zombies,
            uiSetters,
            ctx.configManager,
        );

        manager.activatePowerUp(PowerUpType.INSTA_KILL);

        expect(ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL]).toBeTypeOf('number');
        expect(ctx.setActivePowerUps).toHaveBeenCalledTimes(1);
        expect(ctx.setActivePowerUps).toHaveBeenCalledWith({
            [PowerUpType.INSTA_KILL]: ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL],
        });
    });

    it('does not push HUD active power-up state for instant-effect pickups', () => {
        const ctx = createMockContext();
        const board = { setEnabled: vi.fn() } as unknown as BABYLON.AbstractMesh;
        const uiSetters = {
            setAmmo: vi.fn(),
            setReserveAmmo: vi.fn(),
            setActivePowerUps: ctx.setActivePowerUps,
        };
        const manager = new PowerUpManager(
            ctx.scene,
            ctx.gameState,
            ctx.gameModeRef,
            ctx.send,
            ctx.addPoints,
            [{ boards: [board] } as any],
            ctx.zombies,
            uiSetters,
            ctx.configManager,
        );

        manager.activatePowerUp(PowerUpType.CARPENTER);

        expect(ctx.setActivePowerUps).not.toHaveBeenCalled();
        expect(board.setEnabled).toHaveBeenCalledWith(true);
    });
});
