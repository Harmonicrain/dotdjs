
import * as BABYLON from '@babylonjs/core';
import { System } from '../types/systems';
import { Zombie, ZombieState } from '../types/index';
import { EventBus } from '../engine/EventBus';
import { CachedHostState } from '../network/NetworkMessageHandler';
import { createZombieMesh, createHellhoundMesh } from '../meshes/ZombieMeshFactory';
import { ResourceManager } from '../managers/ResourceManager';

export interface IZombieSyncContext {
    scene: BABYLON.Scene;
    gameModeRef: { current: string };
    zombies: Zombie[];
    eventBus: EventBus;
    resourceManager: ResourceManager;
}

/**
 * ZombieSyncSystem
 *
 * CLIENT-only. Subscribes to NET_GAME_STATE_UPDATE and reconciles the local
 * sm.zombies array with the zombie positions broadcast by the HOST every 20 Hz.
 *
 * - New zombie IDs  → spawn mesh + add to sm.zombies
 * - Existing IDs   → update mesh position/rotation
 * - Missing IDs    → dispose mesh + remove from sm.zombies
 *
 * ZombieAISystem skips CLIENT mode (authority check), so zombies created here
 * are purely visual — their positions come from the network, not local AI.
 * ZombieAnimationSystem will drive their walk/attack animations.
 */
export const createZombieSyncSystem = (ctx: IZombieSyncContext): System => {
    // Track zombies we created so we can reconcile removals
    const knownZombies = new Map<string, Zombie>();

    const handleNetUpdate = (data: CachedHostState) => {
        if (ctx.gameModeRef.current !== 'CLIENT') return;

        const syncedIds = new Set<string>(data.zombies.map(z => z.id));

        // 1. Remove zombies that are no longer in the HOST's list
        for (const [id, z] of knownZombies) {
            if (!syncedIds.has(id)) {
                z.isDead = true;
                z.mesh.dispose();
                if (z.headMesh) z.headMesh.dispose();
                if (z.fireSystem) { z.fireSystem.stop(); z.fireSystem.dispose(); }
                knownZombies.delete(id);
                const idx = ctx.zombies.indexOf(z);
                if (idx !== -1) ctx.zombies.splice(idx, 1);
            }
        }

        // 2. Upsert zombies from sync data
        for (const sd of data.zombies) {
            if (knownZombies.has(sd.id)) {
                // Update existing zombie's position and rotation
                const z = knownZombies.get(sd.id)!;
                z.mesh.position.set(sd.x, sd.y, sd.z);
                z.mesh.rotation.y = sd.rot;
                if (sd.isBurning !== undefined) z.isBurning = sd.isBurning;
            } else {
                // Spawn a new zombie mesh at the broadcast position
                const pos = new BABYLON.Vector3(sd.x, sd.y, sd.z);
                const isHellhound = sd.type === 'HELLHOUND';
                const result = isHellhound
                    ? createHellhoundMesh(ctx.scene, pos, ctx.resourceManager)
                    : createZombieMesh(ctx.scene, pos, ctx.resourceManager);

                const z: Zombie = {
                    id: sd.id,
                    type: (sd.type as 'ZOMBIE' | 'HELLHOUND') ?? 'ZOMBIE',
                    mesh: result.mesh,
                    headMesh: result.head,
                    torsoMesh: result.torso,
                    limbs: result.limbs,
                    health: 100,
                    maxHealth: 100,
                    speed: 0.05,
                    lastAttackTime: 0,
                    isDead: false,
                    state: ZombieState.CHASING,
                    targetWindowId: null,
                    barrierAttackTimer: 0,
                    isBurning: sd.isBurning ?? false,
                    spawnTime: Date.now(),
                    missingLimbs: { legL: false, legR: false, armL: false, armR: false },
                };
                z.mesh.rotation.y = sd.rot;

                knownZombies.set(sd.id, z);
                ctx.zombies.push(z);
            }
        }
    };

    ctx.eventBus.on('NET_GAME_STATE_UPDATE', handleNetUpdate);

    return {
        name: 'zombieSync',
        dispose: () => {
            ctx.eventBus.off('NET_GAME_STATE_UPDATE', handleNetUpdate);
            knownZombies.clear();
        },
        update: (_dt: number, _now: number) => {
            // All sync work is event-driven; nothing needed per frame
        },
    };
};
