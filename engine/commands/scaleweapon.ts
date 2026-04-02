import * as BABYLON from '@babylonjs/core';
import { CommandDefinition } from './types';

export const scaleweaponCommand: CommandDefinition = {
    name: 'scaleweapon',
    handler: (args, sm) => {
        if (sm.scaleWeaponMode.isActive && args.length === 0) {
            const mode = sm.scaleWeaponMode;
            const mesh = sm.gameState.weaponMeshes[mode.weaponId];
            if (mesh && mode.originalScale) {
                mesh.scaling.set(mode.originalScale.x, mode.originalScale.y, mode.originalScale.z);
            }
            sm.scaleWeaponMode.isActive = false;
            sm.ui.setScaleWeaponMode(null);
            return 'Scale weapon tool: OFF';
        }

        let weaponId: string;
        if (args.length >= 1) {
            weaponId = args[0].toLowerCase();
        } else {
            const current = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
            if (!current) return 'No weapon equipped.';
            weaponId = current.id;
        }

        const mesh = sm.gameState.weaponMeshes[weaponId];
        if (!mesh) {
            const available = Object.keys(sm.gameState.weaponMeshes).join(', ');
            return `Unknown weapon: ${weaponId}. Available: ${available}`;
        }

        const firstChild = mesh.getChildren()?.[0];
        const scaledNode = firstChild instanceof BABYLON.TransformNode ? firstChild : mesh;
        const currentScale = scaledNode.scaling;
        sm.scaleWeaponMode = {
            isActive: true,
            weaponId,
            scale: { x: currentScale.x, y: currentScale.y, z: currentScale.z },
            originalScale: { x: currentScale.x, y: currentScale.y, z: currentScale.z },
            step: 0.01,
            axis: 'all',
        };

        sm.ui.setScaleWeaponMode({
            weaponId,
            scale: { x: currentScale.x, y: currentScale.y, z: currentScale.z },
            step: 0.01,
            axis: 'all',
        });

        sm.eventBus.emit('COMMAND_CLOSE_CONSOLE', null);

        return null;
    },
};
