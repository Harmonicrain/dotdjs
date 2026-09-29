import * as BABYLON from '@babylonjs/core';
import { CommandDefinition } from './types';

export const debugPbrCommand: CommandDefinition = {
    name: 'debug_pbr',
    handler: (args, sm) => {
        const scene = sm.scene;
        const env = scene.environmentTexture;
        const lights = scene.lights;
        const pbrMats = scene.materials.filter((m) => m instanceof BABYLON.PBRMaterial);

        let report = `Env Texture: ${env ? env.name : 'NONE'}\n`;
        report += `Ready: ${env ? env.isReady() : 'N/A'}\n`;
        report += `Intensity: ${scene.environmentIntensity}\n`;
        report += `Lights: ${lights.length} (${lights.map((l) => l.name).join(', ')})\n`;
        report += `PBR Mats: ${pbrMats.length}\n`;
        if (pbrMats.length > 0) {
            const m = pbrMats[0] as BABYLON.PBRMaterial;
            report += `First PBR: ${m.name}, Intensity: ${m.environmentIntensity}, Direct: ${m.directIntensity}`;
        }
        return report;
    },
};
