
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { ModelTransform } from '../../config/modelTransforms';
import { createPerkMachine } from './createPerkMachine';

export const createMuleKick = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) =>
    createPerkMachine({
        name: 'muleKick',
        modelUrl: MODELS.MULE_KICK,
        transformKey: 'mule_kick',
        triggerName: 'muleKickTrigger',
        collisionName: 'mkCollision',
        collisionBox: { height: 2.2, width: 1.3, depth: 1.3 },
        fallbackName: 'mkFallback',
        fallbackColor: new BABYLON.Color3(0.5, 0.1, 0.8),
    }, scene, shadowCasters, position, rotationY, modelOverride, promises);
