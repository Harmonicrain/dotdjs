import { CommandDefinition } from './types';

export const killAllCommand: CommandDefinition = {
    name: 'kill_all',
    handler: (args, sm) => {
        let count = 0;
        sm.zombies.forEach((z) => {
            if (!z.isDead) {
                z.health = 0;
                count++;
            }
        });
        return `Killed ${count} zombies.`;
    },
};
