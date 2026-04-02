import { CommandDefinition } from './types';

export const noclipCommand: CommandDefinition = {
    name: 'noclip',
    handler: (args, sm) => {
        sm.gameState.isNoclip = !sm.gameState.isNoclip;
        if (sm.gameState.isNoclip) {
            sm.camera.checkCollisions = false;
            sm.camera.applyGravity = false;
        } else {
            sm.camera.checkCollisions = true;
            sm.camera.applyGravity = true;
        }
        return `Noclip: ${sm.gameState.isNoclip ? 'ON' : 'OFF'}`;
    },
};
