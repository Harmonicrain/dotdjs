import { CommandDefinition } from './types';

export const roundCommand: CommandDefinition = {
    name: 'round',
    handler: (args, sm) => {
        if (args.length < 1) return 'Usage: /round <n>';
        const n = parseInt(args[0], 10);
        if (Number.isNaN(n) || n < 1) return 'Invalid round.';

        sm.gameState.round = n - 1;
        sm.gameState.zombiesToSpawn = 0;
        sm.gameState.zombiesAlive = 0;
        sm.gameState.isIntermission = true;
        sm.gameState.nextRoundTime = 0;

        return `Setting round to ${n}...`;
    },
};
