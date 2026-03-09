import { InteractionContext, InteractionHandler } from '../types';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';
import { ZombieState } from '../../../types/index';

export const SpawnHoleLidHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, mesh, inputDevice }) => {
        const name = mesh.name;
        if (name.includes("groundSpawn_") && name.includes("_trigger")) {
            const gsId = name.replace("_trigger", "").replace("groundSpawn_", "");
            const gs = stateManager.groundSpawns.find(g => g.id === gsId);
            if (gs && !gs.hasLid) {
                const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
                return `Hold [${prompt}] to Cover Hole`;
            }
        }
        return null;
    },
    interact: ({ stateManager, mesh }) => {
        const name = mesh.name;
        const now = Date.now();
        const gc = stateManager.configManager.gameplay;

        if (name.includes("groundSpawn_") && name.includes("_trigger")) {
            if (now - stateManager.gameState.lastRepairTime < gc.REPAIR_COOLDOWN) return false;

            const gsId = name.replace("_trigger", "").replace("groundSpawn_", "");
            const gs = stateManager.groundSpawns.find(g => g.id === gsId);
            if (gs && !gs.hasLid) {
                gs.hasLid = true;
                if (gs.lidMesh) {
                    // Reset lid position and enable it
                    gs.lidMesh.position.y = gs.position.y + 0.04;
                    gs.lidMesh.setEnabled(true);

                    // Disable the red ambient smoke since the hole is now covered
                    stateManager.visualManager.setHoleSmokeEnabled(gs.position, false);
                }

                // If a zombie is already partially emerged from this hole, shove it back down!
                for (const z of stateManager.zombies) {
                    if (z.state === ZombieState.SPAWNING) {
                        // Check if the zombie is at this hole (using a small distance check for X and Z)
                        const dx = z.mesh.position.x - gs.position.x;
                        const dz = z.mesh.position.z - gs.position.z;
                        if (dx * dx + dz * dz < 0.25) {
                            z.state = ZombieState.BREAKING_LID;
                            z.targetLidId = gs.id;
                            z.lidBreakTimer = 0;
                            z.mesh.position.y = -3.5; // Push back underground
                        }
                    }
                }

                stateManager.eventBus.emit('LID_STATE_CHANGE', { groundSpawnId: gs.id });

                if (stateManager.gameState.repairPointsRound < gc.MAX_REPAIR_POINTS_PER_ROUND) {
                    if (gs.lastPointsRound !== stateManager.gameState.round) {
                        gs.lastPointsRound = stateManager.gameState.round;
                        stateManager.gameState.repairPointsRound += gc.POINTS_REPAIR;
                        stateManager.addPoints(stateManager.hasDoublePoints() ? gc.POINTS_REPAIR * 2 : gc.POINTS_REPAIR);
                    }
                }

                if (stateManager.gameModeRef.current === 'CLIENT') {
                    stateManager.send({ type: 'INTERACT_LID', targetId: gs.id } as any);
                }

                return true;
            }
        }
        return false;
    }
};
