import { CommandDefinition } from './types';

export const debugCommand: CommandDefinition = {
    name: 'debug',
    handler: (args, sm) => {
        sm.debugSelection.isActive = !sm.debugSelection.isActive;

        if (sm.debugSelection.isActive) {
            return 'Debug mode: ON. Logic frozen. Shoot an object to inspect.';
        }

        sm.debugSelection.selectedMesh = null;
        sm.ui.setDebugInfo(null);
        return 'Debug mode: OFF. Logic resumed.';
    },
};
