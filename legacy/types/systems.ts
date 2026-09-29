
import * as BABYLON from '@babylonjs/core';

/**
 * Revive Event Types
 */
export type ReviveEvent = 
    | { type: 'START'; revivorName: string }
    | { type: 'CANCEL'; revivorName: string }
    | { type: 'COMPLETE'; revivorName: string; downedPlayerName: string };

export interface System {
    name: string;
    enabled?: boolean;
    priority?: number; // Lower runs first
    init?(): void;
    update(dt: number, now: number): void;
    onEnable?(): void;
    onDisable?(): void;
    dispose?(): void;
}

/**
 * Interface for the Mystery Box System.
 */
export interface MysteryBoxSystem {
    update: (dt: number) => void;
    /**
     * Attempts to interact with the box.
     * @param remotePlayerName - If provided, interaction is on behalf of a remote player (host logic).
     * @param costOverride - Per-map box cost. Falls back to MYSTERY_BOX_CONFIG.COST.
     * @returns True if interaction started, "NO_POINTS" if insufficient funds, or weaponId string if weapon taken.
     */
    interact: (remotePlayerName?: string, costOverride?: number) => boolean | string;
}

/**
 * Interface for the Remote Player Visuals structure.
 */
export interface RemotePlayerVisuals {
    root: BABYLON.TransformNode;
    armsContainer: BABYLON.TransformNode;
    weapons: BABYLON.TransformNode[];
    updateName: (name: string) => void;
}

/**
 * Specific interface for InteractionSystem if it needs external access
 */
export interface IInteractionSystem extends System {
    interact(isContinuous?: boolean): boolean;
    checkHover(): string | null;
}
