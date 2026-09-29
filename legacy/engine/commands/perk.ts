import { CommandDefinition } from './types';

export const perkCommand: CommandDefinition = {
    name: 'perk',
    handler: (args, sm) => {
        if (args.length < 1) return 'Usage: /perk <id>  (juggernog, speedCola, quickRevive, doubleTap, muleKick)';

        const perkId = args[0];
        const gc = sm.configManager.gameplay;

        const idToType: Record<string, string> = {
            juggernog: 'juggernog',
            speedcola: 'speed_cola',
            speedCola: 'speed_cola',
            quickrevive: 'quick_revive',
            quickRevive: 'quick_revive',
            doubletap: 'double_tap',
            doubleTap: 'double_tap',
            mulekick: 'mule_kick',
            muleKick: 'mule_kick',
        };

        const idToStateKey: Record<string, string> = {
            juggernog: 'juggernog',
            speedcola: 'speedCola',
            speedCola: 'speedCola',
            quickrevive: 'quickRevive',
            quickRevive: 'quickRevive',
            doubletap: 'doubleTap',
            doubleTap: 'doubleTap',
            mulekick: 'muleKick',
            muleKick: 'muleKick',
        };

        const perkType = idToType[perkId];
        const stateKey = idToStateKey[perkId];

        if (!perkType || !stateKey) {
            return `Unknown perk: ${perkId}. Use: juggernog, speedCola, quickRevive, doubleTap, muleKick`;
        }

        sm.gameState.perkStates[stateKey] = true;

        if (perkType === 'juggernog') {
            sm.gameState.maxHealth = gc.PLAYER_JUGG_HEALTH;
            sm.gameState.health = gc.PLAYER_JUGG_HEALTH;
            sm.setHealth(gc.PLAYER_JUGG_HEALTH);
        }

        sm.setPerks(sm.gameState.perkStates);

        return `Perk granted: ${stateKey}`;
    },
};
