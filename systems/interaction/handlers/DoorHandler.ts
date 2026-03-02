import { InteractionContext, InteractionHandler } from '../types';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';

export const DoorHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, metadata, inputDevice }) => {
        const ds = stateManager.gameState.doorStates[metadata.id!];
        if (ds && !ds.isOpen) {
            const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
            return `Hold [${prompt}] to Open [${ds.cost}]`;
        }
        return null;
    },
    interact: ({ stateManager, metadata }) => {
        const doorId = metadata.id!;
        const doorState = stateManager.gameState.doorStates[doorId];
        const gameMode = stateManager.gameModeRef.current;

        if (doorState && !doorState.isOpen && stateManager.gameState.points >= doorState.cost) {
            stateManager.gameState.points -= doorState.cost;
            stateManager.setPoints(stateManager.gameState.points);
            
            doorState.isOpen = true;
            
            // Emit for local and remote animation
            stateManager.eventBus.emit('DOOR_OPEN_REQUEST', doorId);
            
            if (gameMode === 'CLIENT') stateManager.send({ type: 'INTERACT_DOOR', doorId });
            return true;
        }
        return false;
    }
};
