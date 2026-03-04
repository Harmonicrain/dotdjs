import { InteractionContext, InteractionHandler } from '../types';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';

export const PerkHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, metadata, inputDevice }) => {
        const perkName = metadata.perkType?.replace('_', ' ').toUpperCase() || "PERK";
        const gc = stateManager.configManager.gameplay;
        
        const perkCostDefaults: Record<string, number> = {
            juggernog: gc.JUGGERNOG_COST,
            speed_cola: gc.SPEED_COLA_COST,
            quick_revive: gc.QUICK_REVIVE_COST
        };
        const perkCost = metadata.cost || perkCostDefaults[metadata.perkType || ""] || 2000;
        const alreadyHas = stateManager.gameState.perkStates[metadata.id!];
        if (alreadyHas) return "ALREADY EQUIPPED";
        const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
        return `Hold [${prompt}] to Buy ${perkName} [${perkCost}]`;
    },
    interact: ({ stateManager, metadata }) => {
        const perkType = metadata.perkType as string;
        const perkId = metadata.id as string;
        const gc = stateManager.configManager.gameplay;
        const gameMode = stateManager.gameModeRef.current;

        const perkCostDefaults: Record<string, number> = {
            juggernog: gc.JUGGERNOG_COST,
            speed_cola: gc.SPEED_COLA_COST,
            quick_revive: gc.QUICK_REVIVE_COST
        };

        const perkCost = metadata.cost || perkCostDefaults[perkType];
        if (!perkCost) return false;

        if (perkType === 'quick_revive' && gameMode === 'SOLO') {
            if (stateManager.gameState.quickRevivesRemaining <= 0) return false;
        }

        const alreadyHas = stateManager.getPerkState(perkId);

        if (!alreadyHas && stateManager.gameState.points >= perkCost) {
            if (gameMode === 'CLIENT') {
                // CLIENT: send request only, do not deduct points — wait for HOST confirmation
                stateManager.send({ type: 'INTERACT_PERK', perkId, perkType, cost: perkCost });
                return true;
            }

            // HOST / SOLO: deduct locally and apply perk
            stateManager.gameState.points -= perkCost;
            stateManager.setPoints(stateManager.gameState.points);

            stateManager.gameState.perkStates[perkId] = true;
            stateManager.setPerks(stateManager.gameState.perkStates);

            if (perkType === 'juggernog') {
                stateManager.gameState.maxHealth = gc.PLAYER_JUGG_HEALTH;
                stateManager.gameState.health = gc.PLAYER_JUGG_HEALTH;
                stateManager.setHealth(gc.PLAYER_JUGG_HEALTH);
            } else if (perkType === 'quick_revive' && gameMode === 'SOLO') {
                stateManager.gameState.quickRevivesRemaining--;
            }

            return true;
        }
        return false;
    }
};
