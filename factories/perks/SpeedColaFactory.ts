
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { ModelTransform } from '../../config/modelTransforms';
import { createPerkMachine } from './createPerkMachine';

export const createSpeedCola = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) =>
    createPerkMachine({
        name: 'speedCola',
        modelUrl: MODELS.SPEED_COLA,
        transformKey: 'speed_cola',
        triggerName: 'speedColaTrigger',
        collisionName: 'scCollision',
        collisionBox: { height: 2.4, width: 1.8, depth: 1.4 },
        collisionY: 1.1,
        fallbackName: 'scFallback',
        fallbackColor: new BABYLON.Color3(0.2, 0.8, 0.2),
        fallbackSize: { height: 2.2, width: 1.2, depth: 0.8 },
        fallbackY: 1.1,
    }, scene, shadowCasters, position, rotationY, modelOverride, promises);
