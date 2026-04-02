import { CommandDefinition } from './types';

export const tpCommand: CommandDefinition = {
    name: 'tp',
    handler: (args, sm) => {
        if (args.length < 3) return 'Usage: /tp <x> <y> <z>';
        const x = parseFloat(args[0]);
        const y = parseFloat(args[1]);
        const z = parseFloat(args[2]);
        if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return 'Invalid coordinates.';
        sm.camera.position.set(x, y, z);
        return `Teleported to ${x}, ${y}, ${z}`;
    },
};
