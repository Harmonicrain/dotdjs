import { CommandDefinition } from './types';

export const debugControlsCommand: CommandDefinition = {
    name: 'debug_controls',
    handler: (args, sm) => {
        sm.debugControlsMode.isActive = !sm.debugControlsMode.isActive;

        if (sm.debugControlsMode.isActive) {
            sm.debugControlsMode.lastFpsUpdate = Date.now();
            sm.debugControlsMode.frameCount = 0;
            sm.debugControlsMode.fps = 0;
            sm.ui.setDebugControls({ isActive: true });
            console.log('[DEBUG_CONTROLS] Enabled - Mouse/Controller input logging active');
            return 'Debug Controls: ON\n- Mouse delta clamping active (max 150px)\n- Camera rotation tracking enabled\n- FPS counter visible (top-right)\n- Input source detection active';
        }

        sm.ui.setDebugControls({ isActive: false });
        console.log('[DEBUG_CONTROLS] Disabled');
        return 'Debug Controls: OFF';
    },
};
