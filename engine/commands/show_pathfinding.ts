import * as BABYLON from '@babylonjs/core';
import { CommandDefinition } from './types';

export const showPathfindingCommand: CommandDefinition = {
    name: 'show_pathfinding',
    handler: (args, sm) => {
        sm.showPathfinding.isActive = !sm.showPathfinding.isActive;

        if (!sm.showPathfinding.isActive) {
            if (sm.showPathfinding.observer) {
                sm.scene.onBeforeRenderObservable.remove(sm.showPathfinding.observer);
                sm.showPathfinding.observer = null;
            }
            for (const mesh of sm.showPathfinding.pathMeshes) {
                mesh.dispose();
            }
            sm.showPathfinding.pathMeshes = [];
            sm.showPathfinding.lastUpdate = 0;
            return 'Pathfinding visualization: OFF';
        }

        if (sm.showPathfinding.observer) {
            sm.scene.onBeforeRenderObservable.remove(sm.showPathfinding.observer);
            sm.showPathfinding.observer = null;
        }

        sm.showPathfinding.lastUpdate = 0;

        sm.showPathfinding.observer = sm.scene.onBeforeRenderObservable.add(() => {
            sm.showPathfinding.lastUpdate++;
            if (sm.showPathfinding.lastUpdate < 10) return;
            sm.showPathfinding.lastUpdate = 0;

            for (const mesh of sm.showPathfinding.pathMeshes) {
                mesh.dispose();
            }
            sm.showPathfinding.pathMeshes = [];

            const navPlugin = sm.navPlugin;
            if (!navPlugin) return;

            const camera = sm.camera;

            for (const z of sm.zombies) {
                if (z.isDead) continue;

                let path: BABYLON.Vector3[] | null = null;
                let color = new BABYLON.Color3(0, 1, 0);

                if (z.type === 'HELLHOUND' && z.hellhoundState) {
                    color = new BABYLON.Color3(1, 0.3, 0);

                    if (z.hellhoundState === 'CHASING' || z.hellhoundState === 'ATTACK_WINDUP') {
                        const targetPos = camera.position.clone();
                        targetPos.y = z.mesh.position.y;
                        const closestPoint = navPlugin.getClosestPoint(targetPos);
                        const navTarget = new BABYLON.Vector3(closestPoint.x, z.mesh.position.y, closestPoint.z);
                        path = navPlugin.computePath(z.mesh.position, navTarget);
                    }
                } else if (z.state) {
                    if (z.state === 'CHASING') {
                        const targetPos = camera.position.clone();
                        targetPos.y = z.mesh.position.y;
                        const closestPoint = navPlugin.getClosestPoint(targetPos);
                        const navTarget = new BABYLON.Vector3(closestPoint.x, z.mesh.position.y, closestPoint.z);
                        path = navPlugin.computePath(z.mesh.position, navTarget);
                    } else if (z.state === 'APPROACHING_WINDOW' || z.state === 'ATTACKING_BARRIER') {
                        const window = sm.windows.find((w) => w.id === z.targetWindowId);
                        if (window) {
                            path = [z.mesh.position.clone(), window.attackPoint.clone()];
                        }
                    } else if (z.state === 'ENTERING') {
                        const window = sm.windows.find((w) => w.id === z.targetWindowId);
                        if (window) {
                            path = [z.mesh.position.clone(), window.entryPoint.clone()];
                        }
                    }
                }

                if (path && path.length > 1) {
                    const points = [z.mesh.position.clone()];
                    for (const p of path) {
                        points.push(p.clone());
                    }

                    const tube = BABYLON.MeshBuilder.CreateTube(`pathTube_${z.id}`, {
                        path: points,
                        radius: 0.15,
                        tessellation: 8,
                        updatable: false,
                    }, sm.scene);
                    const tubeMat = new BABYLON.StandardMaterial(`pathMat_${z.id}`, sm.scene);
                    tubeMat.emissiveColor = color;
                    tubeMat.disableLighting = true;
                    tube.material = tubeMat;
                    sm.showPathfinding.pathMeshes.push(tube);
                }
            }
        });

        return 'Pathfinding visualization: ON (thicker lines)';
    },
};
