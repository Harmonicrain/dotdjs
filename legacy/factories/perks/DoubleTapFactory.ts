
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { ModelTransform } from '../../config/modelTransforms';
import { createPerkMachine } from './createPerkMachine';

export const createDoubleTap = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) =>
    createPerkMachine({
        name: 'doubleTap',
        modelUrl: MODELS.DOUBLE_TAP,
        transformKey: 'double_tap',
        triggerName: 'doubleTapTrigger',
        collisionName: 'dtCollision',
        collisionBox: { height: 2.4, width: 1.5, depth: 1.1 },
        collisionY: 1.1,
        fallbackName: 'dtFallback',
        fallbackColor: new BABYLON.Color3(0.8, 0.4, 0.1),
        fallbackSize: { height: 2.2, width: 1.2, depth: 0.8 },
        fallbackY: 1.1,
    }, scene, shadowCasters, position, rotationY, modelOverride, promises);
