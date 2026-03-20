import * as BABYLON from '@babylonjs/core';
import { CommandMap } from './types';

export const VISUAL_COMMANDS: CommandMap = {
    'show_navmesh': (args, sm) => {
        if (!sm.navPlugin) return 'NavMesh plugin not initialized.';
        const debug = sm.scene.getMeshByName('NavMeshDebug');
        if (debug) {
            debug.isVisible = !debug.isVisible;
            return `NavMesh debug visibility: ${debug.isVisible}`;
        }

        const navmesh = sm.navPlugin.createDebugNavMesh(sm.scene);
        navmesh.name = 'NavMeshDebug';

        const mat = new BABYLON.StandardMaterial('NavMeshDebugMat', sm.scene);
        mat.diffuseColor = new BABYLON.Color3(0, 0.5, 1);
        mat.emissiveColor = new BABYLON.Color3(0, 0.3, 0.8);
        mat.alpha = 0.4;
        mat.wireframe = false;
        mat.backFaceCulling = false;
        mat.zOffset = -1;
        navmesh.material = mat;
        navmesh.position.y += 0.05;

        const testPoints = [
            { name: 'Zone1 center', pos: new BABYLON.Vector3(0, 0, -10) },
            { name: 'Zone1 player', pos: new BABYLON.Vector3(0, 1.85, -10) },
            { name: 'Door area', pos: new BABYLON.Vector3(0, 0, 1) },
            { name: 'Door area + height', pos: new BABYLON.Vector3(0, 1.85, 1) },
            { name: 'Zone2 center', pos: new BABYLON.Vector3(0, 0, 10) },
            { name: 'Zone2 center + height', pos: new BABYLON.Vector3(0, 1.85, 10) },
            { name: 'Zone3', pos: new BABYLON.Vector3(20, 0, 0) },
            { name: 'Target from log', pos: new BABYLON.Vector3(8.26, 1.85, 1.87) },
        ];
        console.log('[NavMesh] Testing getClosestPoint (with Y=1.85):');
        for (const tp of testPoints) {
            const closest = sm.navPlugin.getClosestPoint(tp.pos);
            console.log(`  ${tp.name}: input=${tp.pos.toString()} -> closest=${closest.toString()}`);
        }

        return 'NavMesh debug created.';
    },
    'show_pathfinding': (args, sm) => {
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
    'wireframe': (args, sm) => {
        sm.scene.forceWireframe = !sm.scene.forceWireframe;
        return `Wireframe: ${sm.scene.forceWireframe ? 'ON' : 'OFF'}`;
    },
};
