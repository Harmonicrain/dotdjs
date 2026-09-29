
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { ModelTransform } from '../../config/modelTransforms';
import { createPerkMachine } from './createPerkMachine';

export const createJuggernog = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) =>
    createPerkMachine({
        name: 'juggernog',
        modelUrl: MODELS.JUGGERNOG,
        transformKey: 'juggernog',
        triggerName: 'juggernogTrigger',
        collisionName: 'juggCollision',
        collisionBox: { height: 2.2, width: 1.3, depth: 1.3 },
        fallbackName: 'juggFallback',
        fallbackColor: new BABYLON.Color3(1, 0, 0),
    }, scene, shadowCasters, position, rotationY, modelOverride, promises);
