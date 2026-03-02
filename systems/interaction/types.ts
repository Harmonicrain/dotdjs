import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../../state/StateManager';
import { InteractableMetadata } from '../../types/index';
import { InputDevice } from '../../engine/InputManager';

/**
 * Shared context for interaction handlers.
 */
export interface InteractionContext {
    stateManager: StateManager;
    mesh: BABYLON.AbstractMesh;
    metadata: InteractableMetadata;
    inputDevice: InputDevice;
    isContinuous?: boolean;
}

/**
 * Base interface for interaction handlers.
 */
export interface InteractionHandler {
    getHoverLabel(ctx: InteractionContext): string | null;
    interact(ctx: InteractionContext): boolean;
}
