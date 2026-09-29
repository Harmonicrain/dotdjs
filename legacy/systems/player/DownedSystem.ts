
import * as BABYLON from '@babylonjs/core';
import { GAME_CONFIG } from '../../config';
import { GameStateData } from '../../types/index';
import { TimerManager } from '../../engine/TimerManager';
import { System } from '../../types/systems';
import { frameIndependentLerp } from '../../engine/MathUtils';


import { MapConfigManager } from '../../managers/MapConfigManager';
import { restoreWeaponsAfterRevive } from './playerDamageUtils';
import { StateManager } from '../../state/StateManager';

export interface IDownedContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    timerManager: TimerManager;
    configManager: MapConfigManager;
    setIsBeingRevived(v: boolean): void;
    setHealth(v: number): void;
    setIsDowned(v: boolean): void;
    setIsSpectating(v: boolean): void;
    setIsGameOver(v: boolean): void;
    setPerks(v: Record<string, boolean>): void;
    setInteractionMsg(v: string | null): void;
}

// DownedSystem
const CAMERA_REVIVE_LERP = 0.12;            // lerp speed for camera rising after revive
const CAMERA_REVIVE_SNAP_THRESHOLD = 0.02;  // snap to eye height when within this distance
const CAMERA_DOWNED_LERP = 0.1;             // lerp speed for camera sinking when downed
const CAMERA_REVIVE_START_THRESHOLD = 0.01; // begin lerp only when this far below eye height

/**
 * Runs every frame while the local player is in the "downed" (DBNO) state.

 * Responsibilities:
 *   - Lerps the camera down to crawl height when downed.
 *   - Lerps the camera back up to eye height after being revived.
 *   - Tracks the bleed-out timer and triggers death or spectate on expiry.
 *   - Handles solo Quick Revive auto-revive once the self-revive delay elapses.
 *   - Drives isBeingRevived on the UI store so the HUD can show the correct state.
 *
 * The system is a no-op when the player is not downed and camera is at normal height,
 * so it has negligible cost during normal play.
 */
export const createDownedSystem = (ctx: IDownedContext): System => {
    return {
        name: 'downed',
        update: (dt: number, now: number) => {
            const gameState = ctx.gameState;
            const camera    = ctx.camera;

            if (!gameState.hasStarted || gameState.isPaused || gameState.isGameOver || gameState.isSpectating) return;

            // When NOT downed, lerp camera back up to eye height (smooth revive transition)
            if (!gameState.isDowned) {
                ctx.setIsBeingRevived(false);
                
                // Smooth camera rise after revive
                if (camera && camera.position.y < GAME_CONFIG.PLAYER_EYE_HEIGHT - CAMERA_REVIVE_START_THRESHOLD) {
                    const lerpFactor = frameIndependentLerp(CAMERA_REVIVE_LERP, dt);
                    camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, GAME_CONFIG.PLAYER_EYE_HEIGHT, lerpFactor);

                    // Snap to final position when close enough to prevent endless micro-adjustments
                    if (Math.abs(camera.position.y - GAME_CONFIG.PLAYER_EYE_HEIGHT) < CAMERA_REVIVE_SNAP_THRESHOLD) {
                        camera.position.y = GAME_CONFIG.PLAYER_EYE_HEIGHT;
                    }
                }
                return;
            }

            const elapsed   = now - gameState.downedStartTime;
            const remaining = gameState.downedTimeLimit - elapsed;

            // Lerp camera down to crawl height (frame-rate independent)
            if (camera) {
                const lerpFactor = frameIndependentLerp(CAMERA_DOWNED_LERP, dt);
                camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, GAME_CONFIG.PLAYER_DOWNED_HEIGHT, lerpFactor);
            }

            // Bleed-out expiry
            if (remaining <= 0) {
                const isSolo = ctx.gameModeRef.current === 'SOLO';
                ctx.setHealth(0);
                ctx.setIsDowned(false);
                ctx.setIsBeingRevived(false);
                if (!isSolo) {
                    ctx.setIsSpectating(true);
                } else {
                    ctx.setIsGameOver(true);
                }
                return;
            }

            // Solo Quick Revive: signal the HUD immediately on the first frame of being downed
            const isSolo         = ctx.gameModeRef.current === 'SOLO';
            const hasQuickRevive = gameState.perkStates['quickRevive'];
            const gc = ctx.configManager.gameplay;

            if (isSolo && hasQuickRevive) {
                // Keep isBeingRevived true for the full self-revive window so the HUD shows it
                ctx.setIsBeingRevived(true);

                if (elapsed >= gc.SOLO_SELF_REVIVE_TIME) {
                    gameState.isDowned                  = false;
                    gameState.health                    = gameState.maxHealth;
                    gameState.perkStates['quickRevive'] = false;
                    gameState.quickRevivesRemaining--;

                    restoreWeaponsAfterRevive(ctx as StateManager);
                    ctx.setHealth(gameState.health);
                    ctx.setIsDowned(false);
                    ctx.setIsBeingRevived(false);
                    ctx.setPerks(gameState.perkStates);

                    const msg = gameState.quickRevivesRemaining <= 0
                        ? 'QUICK REVIVE DEPLETED'
                        : 'SELF REVIVED!';
                    ctx.setInteractionMsg(msg);
                    ctx.timerManager.schedule('self_rev_clear', ctx.configManager.visuals.HUD_MSG_DURATION, () => ctx.setInteractionMsg(null));
                    // Camera will lerp up on next frame via the !isDowned branch above
                }
            }
        },
        dispose: () => {
            // No EventBus subscriptions currently, but scaffold ensures the
            // pattern is in place for future additions.
        },
    };
};
