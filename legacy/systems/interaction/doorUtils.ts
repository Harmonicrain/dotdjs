import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../../state/StateManager';

/**
 * Door Animation Utilities
 *
 * Handles door mesh animations (lerp-to-target-Y) and special-case door disposal.
 * Extracted from InteractionSystem so door logic lives alongside DoorHandler.
 */

/**
 * Animates a door mesh to a target Y position using a per-frame lerp.
 * Special cases: door1/door2 are disposed instead of animated.
 */
export const animateDoorMeshToY = (
    ctx: StateManager,
    mesh: BABYLON.AbstractMesh,
    targetY: number,
    trackObserver: boolean = false,
    doorId?: string
) => {
    // Handle special door cases that should be disposed instead of animated
    if (doorId === 'door1' || doorId === 'door2') {
        if (mesh && !mesh.isDisposed()) mesh.dispose();
        ctx.mapVisuals.doorMeshes.delete(doorId);
        return;
    }

    // Clean up existing observer if tracked
    if (trackObserver && doorId) {
        const entry = ctx.mapVisuals.doorMeshes.get(doorId);
        if (entry?.observer) {
            ctx.scene.onBeforeRenderObservable.remove(entry.observer);
            entry.observer = null;
        }
    }

    const observer = ctx.scene.onBeforeRenderObservable.add(() => {
        if (!mesh) return;
        const diff = targetY - mesh.position.y;
        if (Math.abs(diff) < 0.05) {
            mesh.position.y = targetY;
            ctx.scene.onBeforeRenderObservable.remove(observer);
            if (trackObserver && doorId) {
                const entry = ctx.mapVisuals.doorMeshes.get(doorId);
                if (entry) entry.observer = null;
            }
        } else {
            mesh.position.y += diff * 0.1;
        }
    });

    // Track observer reference if needed
    if (trackObserver && doorId) {
        const entry = ctx.mapVisuals.doorMeshes.get(doorId);
        if (entry) entry.observer = observer;
    }
};

/**
 * Opens a door by its ID, looking up the mesh and target Y from mapVisuals.
 */
export const openDoor = (ctx: StateManager, doorId: string) => {
    const entry = ctx.mapVisuals.doorMeshes.get(doorId);
    if (!entry) return;
    animateDoorMeshToY(ctx, entry.mesh, entry.openY, true, doorId);
};
