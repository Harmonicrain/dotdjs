import * as BABYLON from '@babylonjs/core';
import { GAME_CONFIG } from '../../config';
import { GameStateData, RemoteGameState } from '../../types/index';
import { WeaponAdsDebugState } from '../../types/debug';
import { System, RemotePlayerVisuals } from '../../types/systems';
import { frameIndependentLerp } from '../../engine/MathUtils';
import { UIBridge } from '../../state/UIBridge';

export interface IWeaponViewContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    remote: {
        visuals: RemotePlayerVisuals | null;
        weaponId: string;
        gameState: RemoteGameState;
    };
    weaponAdsDebug: WeaponAdsDebugState;
    ui: UIBridge;
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

    // Weapon mesh recoil kick state
    let weaponKickZ = 0;
    let weaponKickRotX = 0;
    const KICK_DECAY = 0.15; // per-frame lerp factor toward zero (matches LERP_FACTOR)

    // ── Weapon ADS Debug keyboard state ──
    const _adsDebugKeys: Record<string, boolean> = {};
    let _adsDebugListenersAttached = false;
    let _adsDebugStep = 0.005;

    const ADS_DEBUG_KEYS = new Set(['a', 'd', 'w', 's', 'e', 'q', 'shift']);

    const onAdsDebugKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        _adsDebugKeys[key] = true;
        if (ADS_DEBUG_KEYS.has(key)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    };
    const onAdsDebugKeyUp = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        _adsDebugKeys[key] = false;
        if (ADS_DEBUG_KEYS.has(key)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    };

    const attachAdsDebugListeners = () => {
        if (_adsDebugListenersAttached) return;
        window.addEventListener('keydown', onAdsDebugKeyDown, true);
        window.addEventListener('keyup', onAdsDebugKeyUp, true);
        _adsDebugListenersAttached = true;
    };

    const detachAdsDebugListeners = () => {
        if (!_adsDebugListenersAttached) return;
        window.removeEventListener('keydown', onAdsDebugKeyDown, true);
        window.removeEventListener('keyup', onAdsDebugKeyUp, true);
        _adsDebugListenersAttached = false;
    };

    const updateAdsDebugMovement = (dt: number) => {
        const debug = ctx.weaponAdsDebug;
        _adsDebugStep = _adsDebugKeys['shift'] ? 0.02 : 0.005;
        const speed = _adsDebugStep * (dt / 16.67); // Normalize to ~60fps

        let changed = false;
        if (_adsDebugKeys['a']) { debug.adsPos.x -= speed; changed = true; }
        if (_adsDebugKeys['d']) { debug.adsPos.x += speed; changed = true; }
        if (_adsDebugKeys['w']) { debug.adsPos.y += speed; changed = true; }
        if (_adsDebugKeys['s']) { debug.adsPos.y -= speed; changed = true; }
        if (_adsDebugKeys['e']) { debug.adsPos.z += speed; changed = true; }
        if (_adsDebugKeys['q']) { debug.adsPos.z -= speed; changed = true; }

        if (changed) {
            // Write debug pos to the weapon's live adsPos so the lerp target updates
            const activeWeapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
            if (activeWeapon) {
                activeWeapon.adsPos.x = debug.adsPos.x;
                activeWeapon.adsPos.y = debug.adsPos.y;
                activeWeapon.adsPos.z = debug.adsPos.z;

                ctx.ui.setWeaponAdsDebugInfo({
                    x: debug.adsPos.x,
                    y: debug.adsPos.y,
                    z: debug.adsPos.z,
                    weaponName: activeWeapon.name,
                    weaponId: activeWeapon.id,
                    step: _adsDebugStep,
                });
            }
        }
    };

    return {
        name: 'weaponView',
        update: (dt: number, now: number) => {
            if (!ctx.gameState.hasStarted || ctx.gameState.isPaused || ctx.gameState.isSpectating || ctx.gameState.isGameOver || ctx.gameState.isConsoleOpen) return;

            // ── Weapon ADS Debug ──
            if (ctx.weaponAdsDebug.isActive) {
                attachAdsDebugListeners();
                ctx.gameState.isAiming = true;
                updateAdsDebugMovement(dt);
            } else if (_adsDebugListenersAttached) {
                detachAdsDebugListeners();
            }

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
                const targetFov = isAds ? GAME_CONFIG.ADS_FOV : GAME_CONFIG.BASE_FOV;

                let finalTargetX = targetPos.x;
                let finalTargetY = targetPos.y;

                // Sway & Bob
                const isMoving = ctx.gameState.currentVelocity?.lengthSquared() > 0.0001 && ctx.gameState.isGrounded;
                if (isMoving && !isAds) {
                    finalTargetX += Math.sin(now * 0.01) * 0.01;
                    finalTargetY += Math.sin(now * 0.02) * 0.01;
                }

                // Consume weapon kick trigger from CombatSystem
                if (ctx.gameState.weaponKickTrigger) {
                    weaponKickZ = -ctx.gameState.weaponKickTrigger.kickBackZ;
                    weaponKickRotX = ctx.gameState.weaponKickTrigger.kickRotX;
                    ctx.gameState.weaponKickTrigger = null;
                }

                // Decay weapon kick toward zero
                const kickDecay = frameIndependentLerp(KICK_DECAY, dt);
                weaponKickZ *= (1 - kickDecay);
                weaponKickRotX *= (1 - kickDecay);
                // Zero out tiny residuals
                if (Math.abs(weaponKickZ) < 0.0005) weaponKickZ = 0;
                if (Math.abs(weaponKickRotX) < 0.0005) weaponKickRotX = 0;

                // Position Lerp (frame-rate independent) + weapon kick offset
                const lerpAmount = frameIndependentLerp(LERP_FACTOR, dt);
                _tempLerpTarget.copyFromFloats(finalTargetX, finalTargetY, targetPos.z + weaponKickZ);
                BABYLON.Vector3.LerpToRef(mesh.position, _tempLerpTarget, lerpAmount, mesh.position);
                ctx.camera.fov = BABYLON.Scalar.Lerp(ctx.camera.fov, targetFov, lerpAmount);

                // Apply rotational kick (upward tilt on fire)
                mesh.rotation.x = weaponKickRotX;

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
        },
        dispose: () => {
            detachAdsDebugListeners();
        }
    };
};
