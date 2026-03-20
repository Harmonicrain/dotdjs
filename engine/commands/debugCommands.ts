import * as BABYLON from '@babylonjs/core';
import { CommandMap } from './types';

export const DEBUG_COMMANDS: CommandMap = {
    'debug': (args, sm) => {
        sm.debugSelection.isActive = !sm.debugSelection.isActive;

        if (sm.debugSelection.isActive) {
            return 'Debug mode: ON. Logic frozen. Shoot an object to inspect.';
        }

        sm.debugSelection.selectedMesh = null;
        sm.ui.setDebugInfo(null);
        return 'Debug mode: OFF. Logic resumed.';
    },
    'debug_pbr': (args, sm) => {
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
    'debug_controls': (args, sm) => {
        sm.debugControlsMode.isActive = !sm.debugControlsMode.isActive;

        if (sm.debugControlsMode.isActive) {
            sm.debugControlsMode.lastFpsUpdate = Date.now();
            sm.debugControlsMode.frameCount = 0;
            sm.debugControlsMode.fps = 0;
            sm.ui.setDebugControls({ isActive: true });
            console.log('[DEBUG_CONTROLS] Enabled - Mouse/Controller input logging active');
            return 'Debug Controls: ON\n- Mouse delta clamping active (max 150px)\n- Camera rotation tracking enabled\n- FPS counter visible (top-right)\n- Input source detection active';
        }

        sm.ui.setDebugControls({ isActive: false });
        console.log('[DEBUG_CONTROLS] Disabled');
        return 'Debug Controls: OFF';
    },
    'render_stats': (args, sm) => {
        sm.renderStatsMode.isActive = !sm.renderStatsMode.isActive;

        if (sm.renderStatsMode.isActive) {
            return 'Render Stats: ON — Showing draw calls, materials, shadows, lights';
        }
        sm.ui.setRenderStats({ isActive: false });
        return 'Render Stats: OFF';
    },
};
