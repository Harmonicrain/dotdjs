import { CommandDefinition } from './types';

export const wireframeCommand: CommandDefinition = {
    name: 'wireframe',
    handler: (args, sm) => {
        sm.scene.forceWireframe = !sm.scene.forceWireframe;
        return `Wireframe: ${sm.scene.forceWireframe ? 'ON' : 'OFF'}`;
    },
};
