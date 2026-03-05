import * as BABYLON from '@babylonjs/core';
import { GameStateData, RemoteGameState } from '../types/index';
import { System, RemotePlayerVisuals } from '../types/systems';

export interface IWeaponViewContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    remote: {
        visuals: RemotePlayerVisuals | null;
        weaponId: string;
        gameState: RemoteGameState;
    };
}

/**
 * WeaponViewSystem
 *
 * Responsibility: Updates the position, rotation, and visibility of 
 * both local and remote weapon meshes based on game state (ADS, reloading, firing).
 */
export const createWeaponViewSystem = (ctx: IWeaponViewContext): System => {
    
    const _tempLerpTarget = new BABYLON.Vector3();
    const LERP_FACTOR = 0.2;
    const frameIndependentLerp = (t: number) => 1 - Math.pow(1 - LERP_FACTOR, t * 60);

    return {
        name: 'weaponView',
        update: (dt: number, now: number) => {
            if (!ctx.gameState.hasStarted) return;

            // ── LOCAL WEAPON Visibility ──
            const activeWeapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
            
            // Disable all weapon meshes first
            for (const key in ctx.gameState.weaponMeshes) {
                const m = ctx.gameState.weaponMeshes[key];
                if (m) m.setEnabled(false);
            }

            if (activeWeapon && activeWeapon.mesh) {
                const mesh = activeWeapon.mesh;
                const isAds = ctx.gameState.isAiming && !ctx.gameState.isReloading && !ctx.gameState.isKnifing && !ctx.gameState.isDowned;
                const targetPos = isAds ? activeWeapon.adsPos : activeWeapon.hipPos;
                const targetFov = isAds ? 0.6 : 1.1;

                let finalTargetX = targetPos.x;
                let finalTargetY = targetPos.y;

                // Sway & Bob
                const isMoving = ctx.gameState.currentVelocity?.lengthSquared() > 0.0001 && ctx.gameState.isGrounded;
                if (isMoving && !isAds) {
                    finalTargetX += Math.sin(now * 0.01) * 0.01;
                    finalTargetY += Math.sin(now * 0.02) * 0.01;
                }

                // Position Lerp (frame-rate independent)
                const lerpAmount = frameIndependentLerp(dt);
                _tempLerpTarget.copyFromFloats(finalTargetX, finalTargetY, targetPos.z);
                BABYLON.Vector3.LerpToRef(mesh.position, _tempLerpTarget, lerpAmount, mesh.position);
                ctx.camera.fov = BABYLON.Scalar.Lerp(ctx.camera.fov, targetFov, lerpAmount);

                mesh.setEnabled(!ctx.gameState.isSpectating && !ctx.gameState.isGameOver);
            }

            // ── REMOTE WEAPON ──
            const remoteVisual = ctx.remote.visuals;
            if (remoteVisual && ctx.gameModeRef.current !== 'SOLO') {
                const remoteWeaponId = ctx.remote.weaponId;
                remoteVisual.weapons.forEach(w => {
                    const isVisible = w.name.includes(remoteWeaponId) && !ctx.remote.gameState.isDowned;
                    w.setEnabled(isVisible);
                });
            }
        }
    };
};
