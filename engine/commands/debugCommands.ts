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
    'bullet_debug': (args, sm) => {
        sm.bulletDebug.isActive = !sm.bulletDebug.isActive;

        if (sm.bulletDebug.isActive) {
            // Freeze game logic via the existing debug selection path
            sm.debugSelection.isActive = true;
            return 'Bullet Debug: ON. Fire to freeze a bullet in place.\nClick+drag to reposition. Shift+drag for depth.\nOverlay shows camera-relative offset (right, up, forward).';
        }

        // Clean up frozen projectile
        if (sm.bulletDebug.frozenProjectile) {
            sm.bulletDebug.frozenProjectile.dispose();
            sm.bulletDebug.frozenProjectile = null;
        }
        sm.debugSelection.isActive = false;
        sm.debugSelection.selectedMesh = null;
        sm.ui.setDebugInfo(null);
        sm.ui.setBulletDebugInfo(null);
        return 'Bullet Debug: OFF. Logic resumed.';
    },
    'weapon_ads_debug': (args, sm) => {
        sm.weaponAdsDebug.isActive = !sm.weaponAdsDebug.isActive;

        if (sm.weaponAdsDebug.isActive) {
            const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
            if (!activeWeapon) {
                sm.weaponAdsDebug.isActive = false;
                return 'No active weapon found.';
            }
            // Snapshot current adsPos
            const ads = activeWeapon.adsPos;
            sm.weaponAdsDebug.adsPos = { x: ads.x, y: ads.y, z: ads.z };
            sm.weaponAdsDebug.originalAdsPos = { x: ads.x, y: ads.y, z: ads.z };
            // Freeze game logic so WASD doesn't move the player
            sm.debugSelection.isActive = true;
            // Force ADS
            sm.gameState.isAiming = true;
            sm.ui.setWeaponAdsDebugInfo({
                x: ads.x, y: ads.y, z: ads.z,
                weaponName: activeWeapon.name,
                weaponId: activeWeapon.id,
                step: 0.005,
            });
            return 'Weapon ADS Debug: ON — Logic frozen.\nA/D — move left/right (x)\nW/S — move up/down (y)\nE/Q — move forward/back (z)\nShift — fine mode (0.001)\nValues update live in overlay.';
        }

        // Restore original adsPos
        const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        if (activeWeapon && sm.weaponAdsDebug.originalAdsPos) {
            const orig = sm.weaponAdsDebug.originalAdsPos;
            activeWeapon.adsPos = { x: orig.x, y: orig.y, z: orig.z };
        }
        sm.weaponAdsDebug.originalAdsPos = null;
        // Unfreeze game logic
        sm.debugSelection.isActive = false;
        sm.debugSelection.selectedMesh = null;
        sm.ui.setWeaponAdsDebugInfo(null);
        return 'Weapon ADS Debug: OFF. Original adsPos restored. Logic resumed.';
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
