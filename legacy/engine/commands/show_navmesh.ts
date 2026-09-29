import * as BABYLON from '@babylonjs/core';
import { CommandDefinition } from './types';

export const showNavmeshCommand: CommandDefinition = {
    name: 'show_navmesh',
    handler: (args, sm) => {
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
};
