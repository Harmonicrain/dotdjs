import { CommandDefinition } from './types';

export const godCommand: CommandDefinition = {
    name: 'god',
    handler: (args, sm) => {
        sm.gameState.isGodMode = !sm.gameState.isGodMode;
        return `God mode: ${sm.gameState.isGodMode ? 'ON' : 'OFF'}`;
    },
};
