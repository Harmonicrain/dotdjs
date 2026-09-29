import * as BABYLON from '@babylonjs/core';
import { PowerUpType } from '../../types/ui';
import { CommandDefinition } from './types';

export const powerupCommand: CommandDefinition = {
    name: 'powerup',
    handler: (args, sm) => {
        if (args.length < 1) return 'Usage: /powerup <type> (instakill, max_ammo, double_points, nuke, carpenter, fire_sale)';

        const typeMap: Record<string, PowerUpType> = {
            instakill: PowerUpType.INSTA_KILL,
            max_ammo: PowerUpType.MAX_AMMO,
            double_points: PowerUpType.DOUBLE_POINTS,
            nuke: PowerUpType.NUKE,
            carpenter: PowerUpType.CARPENTER,
            fire_sale: PowerUpType.FIRE_SALE,
        };

        const typeKey = args[0].toLowerCase();
        const powerUpType = typeMap[typeKey];

        if (!powerUpType) return `Unknown powerup type: ${args[0]}. Use: instakill, max_ammo, double_points, nuke, carpenter, fire_sale`;

        const forward = sm.camera.getDirection(new BABYLON.Vector3(0, 0, 1));
        forward.y = 0;
        forward.normalize();
        const spawnPos = sm.camera.position.add(forward.scale(2));
        spawnPos.y = 0;

        if (sm.powerUpManager) {
            sm.powerUpManager.spawnPowerUp(spawnPos, powerUpType);
            return `Spawned ${powerUpType} powerup.`;
        }
        return 'PowerUpManager not available.';
    },
};
