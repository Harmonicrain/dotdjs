import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UIBridge } from '../../state/UIBridge';
import { createMockGameState } from '../mocks/mockContext';
import type { GameFields, PlayerFields } from '../../store/useGameStore';

describe('UIBridge', () => {
    let updatePlayer: ReturnType<typeof vi.fn>;
    let updateGame: ReturnType<typeof vi.fn>;
    let bridge: UIBridge;

    beforeEach(() => {
        updatePlayer = vi.fn();
        updateGame = vi.fn();
        bridge = new UIBridge(
            createMockGameState(),
            updatePlayer as unknown as (updates: Partial<PlayerFields>) => void,
            updateGame as unknown as (updates: Partial<GameFields>) => void,
        );
    });

    it('publishes zombie count after a throttled miss when the value remains changed', () => {
        const nowSpy = vi.spyOn(Date, 'now');

        nowSpy.mockReturnValue(0);
        bridge.setActiveZombiesCount(5);
        expect(updateGame).not.toHaveBeenCalled();

        nowSpy.mockReturnValue(100);
        bridge.setActiveZombiesCount(5);

        expect(updateGame).toHaveBeenCalledWith({ activeZombiesCount: 5 });

        nowSpy.mockRestore();
    });
});
