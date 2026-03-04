
import * as BABYLON from '@babylonjs/core';
import { RemoteGameState } from '../types/index';
import { RemotePlayerVisuals } from '../types/systems';
import { InterpolationBuffer } from '../network/InterpolationBuffer';

/**
 * RemotePlayerState
 *
 * Consolidates all state related to the remote (non-local) player into a
 * single object.  Passed by reference to systems that need it via
 * `stateManager.remote`.
 */
export class RemotePlayerState {
    public pos: BABYLON.Vector3 = new BABYLON.Vector3(0, -500, 0);
    public rot: number = 0;
    public pitch: number = 0;
    public name: string = 'Unknown';
    public weaponId: string = 'pistol';

    public gameState: RemoteGameState = {
        health: 100, points: 500,
        perks: {},
        isDowned: false,
        kills: 0, shots: 0
    };

    public visuals: RemotePlayerVisuals | null = null;

    public interpolationBuffer: InterpolationBuffer = new InterpolationBuffer();
}
