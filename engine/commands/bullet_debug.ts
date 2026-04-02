import { CommandDefinition } from './types';

export const bulletDebugCommand: CommandDefinition = {
    name: 'bullet_debug',
    handler: (args, sm) => {
        sm.bulletDebug.isActive = !sm.bulletDebug.isActive;

        if (sm.bulletDebug.isActive) {
            sm.debugSelection.isActive = true;
            return 'Bullet Debug: ON. Fire to freeze a bullet in place.\nClick+drag to reposition. Shift+drag for depth.\nOverlay shows camera-relative offset (right, up, forward).';
        }

        if (sm.bulletDebug.frozenProjectile) {
            sm.bulletDebug.frozenProjectile.dispose();
            sm.bulletDebug.frozenProjectile = null;
        }
        sm.debugSelection.isActive = false;
        sm.debugSelection.selectedMesh = null;
        sm.ui.setDebugInfo(null);
        sm.ui.setBulletDebugInfo(null);
        return 'Bullet Debug: OFF. Logic resumed.';
    },
};
