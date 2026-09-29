import { CommandDefinition } from './types';

export const pointsCommand: CommandDefinition = {
    name: 'points',
    handler: (args, sm) => {
        if (args.length < 1) return 'Usage: /points <amt>';
        const amt = parseInt(args[0], 10);
        if (Number.isNaN(amt)) return 'Invalid amount.';
        sm.addPoints(amt);
        return `Added ${amt} points.`;
    },
};
