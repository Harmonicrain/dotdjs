import { InteractionContext, InteractionHandler } from '../types';
import { MysteryBoxState } from '../../../types/index';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';

export const MysteryBoxHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, inputDevice }) => {
        const box = stateManager.mysteryBox;
        const boxHoverCost = stateManager.configManager.mysteryBox.COST;
        const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
        if (box.state === MysteryBoxState.BOX_WEAPON_PRESENT) return `Hold [${prompt}] to Take Weapon`;
        return `Hold [${prompt}] for Mystery Box [${boxHoverCost}]`;
    },
    interact: ({ stateManager }) => {
        const gameMode = stateManager.gameModeRef.current;
        const boxCost = stateManager.configManager.mysteryBox.COST;
        const vc = stateManager.configManager.visuals;
        
        if (gameMode === 'CLIENT') {
             const box = stateManager.mysteryBox;
             if (box.state === MysteryBoxState.BOX_IDLE) {
                 if (stateManager.gameState.points >= boxCost) {
                     stateManager.gameState.points -= boxCost;
                     stateManager.setPoints(stateManager.gameState.points);
                     stateManager.send({ type: 'INTERACT_BOX_START', playerName: stateManager.remote.gameState.isDowned ? "Survivor" : stateManager.gameState.playerName }); 
                     return true;
                 } else {
                     stateManager.setInteractionMsg("NEED " + boxCost + " POINTS");
                     stateManager.timerManager.schedule('clear_box_msg', vc.BOX_HUD_MSG_DURATION, () => stateManager.setInteractionMsg(null));
                 }
             } else if (box.state === MysteryBoxState.BOX_WEAPON_PRESENT) {
                 stateManager.send({ type: 'INTERACT_BOX_TAKE', playerName: stateManager.remote.gameState.isDowned ? "Survivor" : stateManager.gameState.playerName }); 
                 return true;
             }
        } else {
             const res = stateManager.mysteryBoxSystem?.interact(undefined, boxCost);
             if (res === true) return true;
             else if (typeof res === 'string') {
                 if (res === "NO_POINTS") {
                     stateManager.setInteractionMsg("NEED " + boxCost + " POINTS");
                     stateManager.timerManager.schedule('clear_box_msg', vc.BOX_HUD_MSG_DURATION, () => stateManager.setInteractionMsg(null));
                 } else {
                     stateManager.eventBus.emit('WEAPON_PICKUP_REQUEST', res);
                     return true;
                 }
             }
        }
        return false;
    }
};
