import { InteractionContext, InteractionHandler } from '../types';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';

export const PowerHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, inputDevice }) => {
        if (!stateManager.gameState.powerOn) {
            const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
            return `Hold [${prompt}] to Turn On Power`;
        }
        return null;
    },
    interact: ({ stateManager }) => {
        const gameMode = stateManager.gameModeRef.current;
        if (!stateManager.gameState.powerOn) {
            stateManager.gameState.powerOn = true;
            stateManager.eventBus.emit('POWER_ON_REQUEST', null);
            if (gameMode === 'CLIENT') stateManager.send({ type: 'INTERACT_POWER' });
            return true;
        }
        return false;
    }
};
