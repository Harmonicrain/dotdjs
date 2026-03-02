import { InteractionContext, InteractionHandler } from '../types';
import { GAME_CONFIG } from '../../../config';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';

export const PackAPunchHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, metadata, inputDevice }) => {
        if (stateManager.gameState.powerOn) {
            const currentW = stateManager.gameState.weapons[stateManager.gameState.activeWeaponIndex];
            const papHoverCost = metadata.cost || stateManager.configManager.gameplay.PACK_A_PUNCH_COST;
            if (!currentW.isPacked) {
                const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
                return `Hold [${prompt}] to Pack-a-Punch [${papHoverCost}]`;
            }
            return "WEAPON ALREADY PACKED";
        }
        return "REQUIRES POWER";
    },
    interact: ({ stateManager, mesh, metadata }) => {
        const papCost = metadata.cost || stateManager.configManager.gameplay.PACK_A_PUNCH_COST;
        if (stateManager.gameState.points >= papCost && stateManager.gameState.powerOn) {
            const currentW = stateManager.gameState.weapons[stateManager.gameState.activeWeaponIndex];
            if (!currentW.isPacked) {
                stateManager.gameState.points -= papCost;
                stateManager.setPoints(stateManager.gameState.points);
                stateManager.eventBus.emit('PACK_A_PUNCH_REQUEST', mesh);
                return true;
            }
        }
        return false;
    }
};
