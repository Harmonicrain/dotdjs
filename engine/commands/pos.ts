import { CommandDefinition } from './types';

export const posCommand: CommandDefinition = {
    name: 'pos',
    handler: (args, sm) => {
        const p = sm.camera.position;
        const r = sm.camera.rotation;
        return `Pos: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} | Rot: ${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}`;
    },
};
