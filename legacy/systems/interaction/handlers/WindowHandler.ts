import { InteractionContext, InteractionHandler } from '../types';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';

export const WindowHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, mesh, inputDevice }) => {
        const name = mesh.name;
        if (name.includes("window_") && name.includes("trigger")) {
            const windowId = name.split("_trigger")[0]; 
            const w = stateManager.windows.find(win => win.id === windowId); 
            if (w) {
                const disabledBoard = w.boards.find(b => !b.isEnabled());
                if (disabledBoard) {
                    const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
                    return `Hold [${prompt}] to Repair`;
                }
            }
        }
        return null;
    },
    interact: ({ stateManager, mesh }) => {
        const name = mesh.name;
        const now = Date.now();
        const gameMode = stateManager.gameModeRef.current;
        const gc = stateManager.configManager.gameplay;

        if (name.includes("window_") && name.includes("trigger")) {
            // Keep standard cooldown to prevent building faster than zombies break them
            if (now - stateManager.gameState.lastRepairTime < gc.REPAIR_COOLDOWN) return false;

            const windowId = name.split("_trigger")[0]; 
            const w = stateManager.windows.find(win => win.id === windowId); 
            if (w) {
                const disabledBoard = w.boards.find(b => !b.isEnabled());
                if (disabledBoard) {
                    disabledBoard.setEnabled(true);
                    
                    stateManager.eventBus.emit('BOARD_STATE_CHANGE', { windowId });

                    if (stateManager.gameState.repairPointsRound < gc.MAX_REPAIR_POINTS_PER_ROUND) {
                        stateManager.gameState.repairPointsRound += gc.POINTS_REPAIR;
                        stateManager.addPoints(stateManager.hasDoublePoints() ? gc.POINTS_REPAIR * 2 : gc.POINTS_REPAIR);
                    }
                    if (gameMode === 'CLIENT') stateManager.send({ type: 'INTERACT_WINDOW', targetId: windowId });
                    
                    return true;
                }
            }
        }
        return false;
    }
};
