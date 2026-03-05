import * as BABYLON from '@babylonjs/core';
import { GameStateData } from '../types/index';
import { System, RemotePlayerVisuals } from '../types/systems';
import { GAME_CONFIG } from '../config';
import { InterpolationBuffer } from '../network/InterpolationBuffer';

export interface IRemoteContext {
    gameState: GameStateData;
    gameModeRef: { current: string };
    remote: {
        visuals: RemotePlayerVisuals | null;
        interpolationBuffer: InterpolationBuffer;
    };
}

/**
 * RemotePlayerSystem
 *
 * Reads interpolated poses from StateManager.remote.interpolationBuffer
 * (which is fed by NetworkMessageHandler on every received STATE/INPUT packet)
 * and applies them to the remote player visual.
 */
export const createRemotePlayerSystem = (ctx: IRemoteContext): System => {
    const _tempTargetPos = new BABYLON.Vector3();
    return {
        name: 'remotePlayer',

        update: (_dt: number, now: number) => {
            if (!ctx.gameState.hasStarted) return;

            const remoteVisual = ctx.remote.visuals;
            if (!remoteVisual) return;

            // In SOLO mode there is no remote player — keep the mesh hidden and bail out.
            if (ctx.gameModeRef.current === 'SOLO') {
                remoteVisual.root.setEnabled(false);
                return;
            }

            const pose = ctx.remote.interpolationBuffer.sample(now);
            if (!pose) return;

            remoteVisual.root.setEnabled(true);

            // Camera position is at eye height (~1.65 m above feet), so the root
            // mesh (which sits at foot level) needs a downward offset.
            _tempTargetPos.copyFromFloats(pose.x, pose.y - GAME_CONFIG.PLAYER_EYE_HEIGHT, pose.z);

            // Gentle lerp to absorb sub-frame residual jitter; the buffer already
            // provides the bulk of the smoothing.
            BABYLON.Vector3.LerpToRef(
                remoteVisual.root.position,
                _tempTargetPos,
                0.5,
                remoteVisual.root.position,
            );

            // Rotation and pitch are set directly from the interpolated values;
            // the buffer's lerpAngle already handles wrap-around discontinuities.
            remoteVisual.root.rotation.y          = pose.rotY;
            remoteVisual.armsContainer.rotation.x = pose.pitch;
        },
    };
};
