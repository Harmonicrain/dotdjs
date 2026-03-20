import * as BABYLON from '@babylonjs/core';
import { WEAPON_CONFIGS } from '../../config';
import { PowerUpType } from '../../types/ui';
import { CommandMap } from './types';

export const CHEAT_COMMANDS: CommandMap = {
    'pos': (args, sm) => {
        const p = sm.camera.position;
        const r = sm.camera.rotation;
        return `Pos: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} | Rot: ${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}`;
    },
    'tp': (args, sm) => {
        if (args.length < 3) return 'Usage: /tp <x> <y> <z>';
        const x = parseFloat(args[0]);
        const y = parseFloat(args[1]);
        const z = parseFloat(args[2]);
        if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return 'Invalid coordinates.';
        sm.camera.position.set(x, y, z);
        return `Teleported to ${x}, ${y}, ${z}`;
    },
    'points': (args, sm) => {
        if (args.length < 1) return 'Usage: /points <amt>';
        const amt = parseInt(args[0], 10);
        if (Number.isNaN(amt)) return 'Invalid amount.';
        sm.addPoints(amt);
        return `Added ${amt} points.`;
    },
    'give': (args, sm) => {
        if (args.length < 1) return 'Usage: /give <weapon_id>';
        const id = args[0].toLowerCase();
        const config = WEAPON_CONFIGS.find((w) => w.id === id);
        if (!config) return `Unknown weapon: ${id}`;

        const weaponMesh = sm.gameState.weaponMeshes[id] || null;

        const existingIdx = sm.gameState.weapons.findIndex((w) => w.id === id);
        if (existingIdx !== -1) {
            sm.gameState.activeWeaponIndex = existingIdx;
        } else {
            const newState = {
                ...config,
                currentAmmo: config.clipSize,
                currentReserve: config.maxReserve,
                isPacked: false,
                mesh: weaponMesh,
            };

            const oldWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
            if (oldWeapon?.mesh) oldWeapon.mesh.setEnabled(false);

            const hasMuleKick = !!sm.gameState.perkStates.muleKick;
            const weaponLimit = hasMuleKick ? 3 : 2;
            if (sm.gameState.weapons.length >= weaponLimit) {
                sm.gameState.weapons[sm.gameState.activeWeaponIndex] = newState;
            } else {
                sm.gameState.weapons.push(newState);
                sm.gameState.activeWeaponIndex = sm.gameState.weapons.length - 1;
            }
        }

        const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        if (activeWeapon?.mesh) activeWeapon.mesh.setEnabled(true);

        sm.setActiveWeaponIndex(sm.gameState.activeWeaponIndex);
        sm.setWeaponName(config.name);
        sm.setWeaponId(config.id);
        sm.setAmmo(config.clipSize);
        sm.setReserveAmmo(config.maxReserve);

        return `Gave ${config.name}`;
    },
    'ammo': (args, sm) => {
        sm.gameState.weapons.forEach((w) => {
            w.currentAmmo = w.clipSize;
            w.currentReserve = w.maxReserve;
        });
        const current = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        sm.setAmmo(current.currentAmmo);
        sm.setReserveAmmo(current.currentReserve);
        return 'Ammo refilled.';
    },
    'round': (args, sm) => {
        if (args.length < 1) return 'Usage: /round <n>';
        const n = parseInt(args[0], 10);
        if (Number.isNaN(n) || n < 1) return 'Invalid round.';

        sm.gameState.round = n - 1;
        sm.gameState.zombiesToSpawn = 0;
        sm.gameState.zombiesAlive = 0;
        sm.gameState.isIntermission = true;
        sm.gameState.nextRoundTime = 0;

        return `Setting round to ${n}...`;
    },
    'kill_all': (args, sm) => {
        let count = 0;
        sm.zombies.forEach((z) => {
            if (!z.isDead) {
                z.health = 0;
                count++;
            }
        });
        return `Killed ${count} zombies.`;
    },
    'god': (args, sm) => {
        sm.gameState.isGodMode = !sm.gameState.isGodMode;
        return `God mode: ${sm.gameState.isGodMode ? 'ON' : 'OFF'}`;
    },
    'noclip': (args, sm) => {
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
    'perk': (args, sm) => {
        if (args.length < 1) return 'Usage: /perk <id>  (juggernog, speedCola, quickRevive, doubleTap, muleKick)';

        const perkId = args[0];
        const gc = sm.configManager.gameplay;

        const idToType: Record<string, string> = {
            juggernog: 'juggernog',
            speedcola: 'speed_cola',
            speedCola: 'speed_cola',
            quickrevive: 'quick_revive',
            quickRevive: 'quick_revive',
            doubletap: 'double_tap',
            doubleTap: 'double_tap',
            mulekick: 'mule_kick',
            muleKick: 'mule_kick',
        };

        const idToStateKey: Record<string, string> = {
            juggernog: 'juggernog',
            speedcola: 'speedCola',
            speedCola: 'speedCola',
            quickrevive: 'quickRevive',
            quickRevive: 'quickRevive',
            doubletap: 'doubleTap',
            doubleTap: 'doubleTap',
            mulekick: 'muleKick',
            muleKick: 'muleKick',
        };

        const perkType = idToType[perkId];
        const stateKey = idToStateKey[perkId];

        if (!perkType || !stateKey) {
            return `Unknown perk: ${perkId}. Use: juggernog, speedCola, quickRevive, doubleTap, muleKick`;
        }

        sm.gameState.perkStates[stateKey] = true;

        if (perkType === 'juggernog') {
            sm.gameState.maxHealth = gc.PLAYER_JUGG_HEALTH;
            sm.gameState.health = gc.PLAYER_JUGG_HEALTH;
            sm.setHealth(gc.PLAYER_JUGG_HEALTH);
        }

        sm.setPerks(sm.gameState.perkStates);

        return `Perk granted: ${stateKey}`;
    },
    'powerup': (args, sm) => {
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
    'scaleweapon': (args, sm) => {
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
