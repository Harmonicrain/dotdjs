import * as BABYLON from '@babylonjs/core';

/**
 * Debug State Types
 *
 * Interfaces for debug-only state fields on StateManager.
 * Grouped here so it's clear which fields are dev tools vs shipped game state.
 */

/** State for the mesh selection debug tool (click-to-inspect meshes) */
export interface DebugSelectionState {
    isActive: boolean;
    selectedMesh: BABYLON.AbstractMesh | null;
}

/** State for the pathfinding visualization overlay */
export interface ShowPathfindingState {
    isActive: boolean;
    pathMeshes: BABYLON.AbstractMesh[];
    lastUpdate: number;
    observer: BABYLON.Observer<BABYLON.Scene> | null;
}

/** State for the weapon scale adjustment tool (/scaleweapon command) */
export interface ScaleWeaponModeState {
    isActive: boolean;
    weaponId: string;
    scale: { x: number; y: number; z: number };
    originalScale: { x: number; y: number; z: number } | null;
    step: number;
    axis: 'all' | 'x' | 'y' | 'z';
}

/** State for the debug controls overlay (FPS counter, input debug) */
export interface DebugControlsModeState {
    isActive: boolean;
    lastFpsUpdate: number;
    frameCount: number;
    fps: number;
}

/** State for the render stats overlay (draw calls, materials, shadows) */
export interface RenderStatsModeState {
    isActive: boolean;
}

/** State for the bullet spawn debug tool (/bullet_debug command) */
export interface BulletDebugState {
    isActive: boolean;
    frozenProjectile: BABYLON.AbstractMesh | null;
}

/** UI-safe data for the bullet debug overlay (no Babylon references) */
export interface BulletDebugInfo {
    right: number;
    up: number;
    forward: number;
    weaponName: string;
    isAds: boolean;
}

/** State for the weapon ADS position debug tool (/weapon_ads_debug command) */
export interface WeaponAdsDebugState {
    isActive: boolean;
    adsPos: { x: number; y: number; z: number };
    originalAdsPos: { x: number; y: number; z: number } | null;
}

/** UI-safe data for the weapon ADS debug overlay (no Babylon references) */
export interface WeaponAdsDebugInfo {
    x: number;
    y: number;
    z: number;
    weaponName: string;
    weaponId: string;
    step: number;
}

/** Default values for all debug state fields */
export const DEFAULT_DEBUG_SELECTION: DebugSelectionState = { isActive: false, selectedMesh: null };
export const DEFAULT_SHOW_PATHFINDING: ShowPathfindingState = { isActive: false, pathMeshes: [], lastUpdate: 0, observer: null };
export const DEFAULT_SCALE_WEAPON_MODE: ScaleWeaponModeState = { isActive: false, weaponId: '', scale: { x: 1, y: 1, z: 1 }, originalScale: null, step: 0.01, axis: 'all' };
export const DEFAULT_DEBUG_CONTROLS_MODE: DebugControlsModeState = { isActive: false, lastFpsUpdate: 0, frameCount: 0, fps: 0 };
export const DEFAULT_RENDER_STATS_MODE: RenderStatsModeState = { isActive: false };
export const DEFAULT_BULLET_DEBUG: BulletDebugState = { isActive: false, frozenProjectile: null };
export const DEFAULT_WEAPON_ADS_DEBUG: WeaponAdsDebugState = { isActive: false, adsPos: { x: 0, y: 0, z: 0 }, originalAdsPos: null };
