
import * as BABYLON from '@babylonjs/core';
import type { ModelTransform } from '../config/modelTransforms';

import { MapConfiguration } from '../maps/types';

export enum MysteryBoxState {
    BOX_IDLE = 0,
    BOX_OPENING = 1,
    BOX_ROLLING = 2,
    BOX_WEAPON_PRESENT = 3,
    BOX_CLOSING_SUCCESS = 4,
    BOX_CLOSING_TIMEOUT = 5,
    BOX_TEDDY_REVEAL = 6,
    BOX_TEDDY_WAIT = 7,
    BOX_TELEPORT_OUT = 8,
    BOX_RELOCATING = 9
}

export type InteractableType = 'DOOR' | 'WALLBUY' | 'PERK' | 'POWER' | 'PAP' | 'MYSTERY_BOX' | 'WINDOW';

export interface InteractableMetadata {
    type: InteractableType;
    id?: string;
    cost?: number;
    data?: any; 
    perkType?: string; // For perks
    weapon?: string; // For wallbuys
    connects?: [number, number]; // For doors
}

export type MysteryBox = {
    state: MysteryBoxState;
    activeLocationIndex: number;
    mesh: BABYLON.TransformNode | null;
    lidMesh: BABYLON.TransformNode | null;
    weaponAnchor: BABYLON.TransformNode | null;
    glowLight: BABYLON.PointLight | null;
    currentWeaponIndex: number; 
    resultWeaponId: string | null;
    ownerName: string | null;
    stateTimer: number;
    lidAngle: number;
    teddyMesh: BABYLON.TransformNode | null;
    beamMesh: BABYLON.AbstractMesh | null;
    glowPlaneMesh: BABYLON.AbstractMesh | null;
    trigger: BABYLON.AbstractMesh | null;
    instances: Array<{
        mesh: BABYLON.TransformNode | null;
        lidMesh: BABYLON.TransformNode | null;
        weaponAnchor: BABYLON.TransformNode | null;
        glowLight: BABYLON.PointLight | null;
        beamMesh: BABYLON.AbstractMesh | null;
        glowPlaneMesh: BABYLON.AbstractMesh | null;
        trigger: BABYLON.AbstractMesh | null;
        teddyMesh: BABYLON.TransformNode | null;
    }>;
};

/** Returns a fully initialised MysteryBox with all default values. */
export function createDefaultMysteryBox(): MysteryBox {
    return {
        state: MysteryBoxState.BOX_IDLE,
        activeLocationIndex: 0,
        mesh: null,
        lidMesh: null,
        weaponAnchor: null,
        glowLight: null,
        currentWeaponIndex: 0,
        resultWeaponId: null,
        ownerName: null,
        stateTimer: 0,
        lidAngle: 0,
        teddyMesh: null,
        beamMesh: null,
        glowPlaneMesh: null,
        trigger: null,
        instances: [],
    };
}

export interface ZoneBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface ZoneDefinition {
    id: number;
    name?: string;
    bounds: {
        min: [number, number, number] | number; 
        max: [number, number, number] | number; 
    } | ZoneBounds;
    spawnBounds?: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

export interface DoorConnection {
    doorId: string;
    fromZone: number;
    toZone: number;
    waypoint: BABYLON.Vector3;
    entryThreshold: number;
}

export interface DoorState {
    isOpen: boolean;
    cost: number;
    connectsZones: [number, number];
}

export interface WindowBarrierState {
    planksRemaining: number;
    maxPlanks: number;
    isFullyRepaired: boolean;
    zone: number;
}

export interface MapTextureSet {
    wall?: string;
    floor?: string;
    ceiling?: string;
    door?: string;
    plank?: string;
    powerDoor?: string;
}

export interface MapMetadata {
    id: string;
    name: string;
    description?: string;
    version: string;
}

export interface GeometryDefinition {
    type: 'wall' | 'floor' | 'ceiling' | 'box' | 'ramp';
    pos: [number, number, number];
    size: [number, number, number];
    rotation?: [number, number, number]; 
    texture?: string; // 'wall', 'floor', 'ceiling' keys from MapTextureSet
    material?: string;
    uvScale?: number;
}

export interface DoorDefinition {
    id: string;
    cost: number;
    connects: [number, number];
    pos: [number, number, number];
    size: [number, number, number];
    rotation?: number;
    closedY?: number;  // Default: pos[1]
    openY?: number;    // Default: pos[1] + 4
}

export interface WindowDefinition {
    id: string;
    zone: number;
    pos: [number, number, number];
    rotation?: number;
    planks?: number;
}

export interface PerkDefinition {
    type: 'juggernog' | 'speed_cola' | 'quick_revive';
    id: string;
    zone: number;
    pos: [number, number, number];
    rotation?: number;
}

export interface WallbuyDefinition {
    weapon: string;
    cost: number;
    id: string;
    zone: number;
    pos: [number, number, number];
    rotation?: number;
}

export interface MysteryBoxLocationDefinition {
    pos: [number, number, number];
    rotation?: number;
}

export interface PowerSwitchDefinition {
    pos: [number, number, number];
    rotation?: number;
    powerDoor?: {
        pos: [number, number, number];
        size: [number, number, number];
        openY?: number;
        connects?: [number, number];
    };
}

export interface PackAPunchDefinition {
    pos: [number, number, number];
    rotation?: number;
    zone?: number;
}

export interface FixtureDefinition {
    pos: [number, number];  // [x, z]
    zone: number;
    intensity?: number;
    range?: number;
}

export interface EnvironmentDefinition {
    fog?: { mode: 'exp2'; density: number; color: [number, number, number] };
    skybox?: boolean;
    ambientLight?: { intensity: number; diffuse: [number, number, number]; ground: [number, number, number] };
    directionalLight?: { direction: [number, number, number]; intensity: number };
    shadow?: { resolution?: number; darkness?: number; blurKernel?: number };
}

export interface GroundDefinition {
    width: number;
    height: number;
    pos: [number, number, number];
    texture?: string;
    uvScale?: [number, number];  // [uScale, vScale] - if not provided, uses default based on material
}

export interface DebugInfo {
    name: string;
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    scaling: { x: number, y: number, z: number };
    material: string;
    parent?: string;
    metadata?: any;
}

/** Runtime entry for a door mesh and its animation observer */
export interface DoorMeshEntry {
    mesh: BABYLON.AbstractMesh;
    observer: BABYLON.Observer<BABYLON.Scene> | null;
    closedY: number;
    openY: number;
    size?: [number, number, number];
    rotation?: number;
    obstacle?: any; // Handle for the NavMesh obstacle
}

export interface BuildingDefinition {
    id: string;
    model: string;  // Path to GLB file
    pos: [number, number, number];
    rotation?: [number, number, number];
    scaling?: [number, number, number];
    checkCollisions?: boolean;
    receiveShadows?: boolean;
    castShadows?: boolean;
}

export interface InteractablesDefinition {
    doors?: DoorDefinition[];
    windows?: WindowDefinition[];
    perks?: PerkDefinition[];
    wallbuys?: WallbuyDefinition[];
    mysteryBoxes?: MysteryBoxLocationDefinition[];
    powerSwitch?: PowerSwitchDefinition;
    packAPunch?: PackAPunchDefinition;
    buildings?: BuildingDefinition[];
}

export interface WallObstacleDefinition {
    pos: [number, number, number];
    size: [number, number, number];
    rotation?: number;
}

export interface MapDefinition {
    meta: MapMetadata;
    textures?: MapTextureSet;
    assetUrls?: {
        models?: Record<string, string>;
        textures?: Record<string, string>;
    };
    geometry: GeometryDefinition[];
    grounds?: GroundDefinition[];
    navFloors?: GroundDefinition[];  // Invisible floors for navmesh generation (with gaps at walls)
    interactables: InteractablesDefinition;
    fixtures?: FixtureDefinition[];
    environment?: EnvironmentDefinition;
    zones: ZoneDefinition[]; 
    spawns: {
        host: { pos: [number, number, number]; rot: number };
        client: { pos: [number, number, number]; rot: number };
    };
    navigation?: {
        navmeshParameters?: any;
        wallObstacles?: WallObstacleDefinition[];  // Static obstacles for walls between zones
    };
    config?: MapConfiguration;
    modelOverrides?: Record<string, Partial<ModelTransform>>;
}

