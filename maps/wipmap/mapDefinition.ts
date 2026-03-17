import { MapDefinition } from '../../types/world';
import { wipmapGameplay } from './config/gameplay';

export const WipmapDefinition: MapDefinition = {
    meta: {
        id: "wipmap",
        name: "Barn",
        version: "0.1",
        description: "Work in progress map."
    },
    environment: {
        fog: { mode: 'exp2', density: 0.0, color: [0.5, 0.5, 0.5] },
        skybox: true,
        ambientLight: { intensity: 0.8, diffuse: [1, 1, 1], ground: [0.5, 0.5, 0.5] },
        directionalLight: { direction: [-0.3, -1, 0.2], intensity: 0.6 },
        fillLight: true,
    },

    textures: {
        floor: "/textures/white.png",
        wall: "/textures/white.png",
        door: "/textures/white.png",
    },

    // No textures - plain white ground

    // === ZONE 1: 25x25x25 cube (floor + 4 walls, no roof) ===
    // === ZONE 2: 25x25x25 cube (floor + 1 wall, no roof) — shares dividing walls with Zone 1 (west), Zone 3 (south), Zone 4 (north) ===
    // === ZONE 3: 25x25x25 cube (floor + 3 walls, no roof) — shares dividing wall with Zone 2's south wall ===
    // === ZONE 4: 25x25x25 cube (floor + 3 walls, no roof) — shares dividing wall with Zone 2's north wall ===
    geometry: [

        // =====================================================================
        // ZONE 1 - STARTING ROOM
        // =====================================================================

        // Wall 1 - North wall (Z: -12.5, facing south)
        { type: "wall", pos: [0, 12.5, -12.5], size: [25, 25, 1], texture: "wall" },
        // Wall 2 - South wall (Z: +12.5, facing north)
        { type: "wall", pos: [0, 12.5, 12.5], size: [25, 25, 1], texture: "wall" },
        // Wall 3 - West wall (X: -12.5, facing east)
        { type: "wall", pos: [-12.5, 12.5, 0], size: [1, 25, 25], texture: "wall" },

        // Wall 4 - Dividing wall (X: +12.5) — shared border between Zone 1 & Zone 2
        //   Split into 3 segments to create a 4-wide × 5-tall walkthrough opening at centre
        // Wall 4a - Dividing wall, left section (Z: -12.5 → -2)
        { type: "wall", pos: [12.5, 12.5, -7.25], size: [1, 25, 10.5], texture: "wall" },
        // Wall 4b - Dividing wall, right section (Z: +2 → +12.5)
        { type: "wall", pos: [12.5, 12.5,  7.25], size: [1, 25, 10.5], texture: "wall" },
        // Wall 4c - Dividing wall, top section above opening (Z: -2 → +2, Y: 5 → 25)
        { type: "wall", pos: [12.5, 15, 0], size: [1, 20, 4], texture: "wall" },

        // =====================================================================
        // ZONE 2 - SECOND ROOM (directly east of Zone 1, walls touching)
        // =====================================================================

        // Wall 7 - East wall (X: +37.5, facing west)
        //   Split into 3 segments to create window opening at Z=0 (4 wide, 3 tall from floor)
        // Wall 7a - Left section (Z: -12.5 to -2)
        { type: "wall", pos: [37.5, 12.5, -7.25], size: [1, 25, 10.5], texture: "wall" },
        // Wall 7b - Right section (Z: +2 to +12.5)
        { type: "wall", pos: [37.5, 12.5, 7.25], size: [1, 25, 10.5], texture: "wall" },
        // Wall 7c - Above window opening (Z: -2 to +2, Y: 3 to 25)
        { type: "wall", pos: [37.5, 14, 0], size: [1, 22, 4], texture: "wall" },

        // Wall 5 - Dividing wall (Z: -12.5) — shared border between Zone 2 & Zone 4
        //   Split into 3 segments to create a 4-wide × 5-tall walkthrough opening at centre
        // Wall 5a - Dividing wall, left section (X: 12.5 → 23)
        { type: "wall", pos: [17.75, 12.5, -12.5], size: [10.5, 25, 1], texture: "wall" },
        // Wall 5b - Dividing wall, right section (X: 27 → 37.5)
        { type: "wall", pos: [32.25, 12.5, -12.5], size: [10.5, 25, 1], texture: "wall" },
        // Wall 5c - Dividing wall, top section above opening (X: 23 → 27, Y: 5 → 25)
        { type: "wall", pos: [25, 15, -12.5], size: [4, 20, 1], texture: "wall" },

        // Wall 6 - Dividing wall (Z: +12.5) — shared border between Zone 2 & Zone 3
        //   Split into 3 segments to create a 4-wide × 5-tall walkthrough opening at centre
        // Wall 6a - Dividing wall, left section (X: 12.5 → 23)
        { type: "wall", pos: [17.75, 12.5, 12.5], size: [10.5, 25, 1], texture: "wall" },
        // Wall 6b - Dividing wall, right section (X: 27 → 37.5)
        { type: "wall", pos: [32.25, 12.5, 12.5], size: [10.5, 25, 1], texture: "wall" },
        // Wall 6c - Dividing wall, top section above opening (X: 23 → 27, Y: 5 → 25)
        { type: "wall", pos: [25, 15, 12.5], size: [4, 20, 1], texture: "wall" },

        // =====================================================================
        // ZONE 3 - THIRD ROOM (directly south of Zone 2, walls touching)
        // =====================================================================

        // Wall 8 - West wall (X: +12.5, facing east)
        { type: "wall", pos: [12.5, 12.5, 25], size: [1, 25, 25], texture: "wall" },
        // Wall 9 - East wall (X: +37.5, facing west)
        { type: "wall", pos: [37.5, 12.5, 25], size: [1, 25, 25], texture: "wall" },
        // Wall 10 - South wall (Z: +37.5, facing north)
        { type: "wall", pos: [25, 12.5, 37.5], size: [25, 25, 1], texture: "wall" },

        // =====================================================================
        // ZONE 4 - FOURTH ROOM (directly north of Zone 2, walls touching)
        // =====================================================================

        // Wall 11 - West wall (X: +12.5, facing east)
        { type: "wall", pos: [12.5, 12.5, -25], size: [1, 25, 25], texture: "wall" },
        // Wall 12 - East wall (X: +37.5, facing west)
        { type: "wall", pos: [37.5, 12.5, -25], size: [1, 25, 25], texture: "wall" },
        // Wall 13 - North wall (Z: -37.5, facing south)
        { type: "wall", pos: [25, 12.5, -37.5], size: [25, 25, 1], texture: "wall" },

    ],
    grounds: [
        // Zone 1 floor
        {
            pos: [0, 0, 0],
            width: 25,
            height: 25,
        },
        // Zone 2 floor
        {
            pos: [25, 0, 0],
            width: 25,
            height: 25,
        },
        // Zone 3 floor
        {
            pos: [25, 0, 25],
            width: 25,
            height: 25,
        },
        // Zone 4 floor
        {
            pos: [25, 0, -25],
            width: 25,
            height: 25,
        },
        // Window 1 zombie walkway (outside east wall)
        {
            pos: [43, 0, 0],
            width: 10,
            height: 6,
        },
    ],

    navFloors: [
        // Zone 1 (0.5 unit gap from walls to prevent direct nav connections)
        { width: 24, height: 24, pos: [0, 0, 0], texture: 'nav' },
        // Zone 1↔Zone 2 connector through Wall 4 opening
        { width: 2, height: 2, pos: [12.5, 0, 0], texture: 'nav' },
        // Zone 2 (0.5 unit gap from walls)
        { width: 24, height: 24, pos: [25, 0, 0], texture: 'nav' },
        // Zone 2↔Zone 3 connector through Wall 6 opening
        { width: 2, height: 2, pos: [25, 0, 12.5], texture: 'nav' },
        // Zone 3 (0.5 unit gap from walls)
        { width: 24, height: 24, pos: [25, 0, 25], texture: 'nav' },
        // Zone 2↔Zone 4 connector through Wall 5 opening
        { width: 2, height: 2, pos: [25, 0, -12.5], texture: 'nav' },
        // Zone 4 (0.5 unit gap from walls)
        { width: 24, height: 24, pos: [25, 0, -25], texture: 'nav' },
        // Window 1 zombie walkway (outside east wall)
        { width: 10, height: 6, pos: [43, 0, 0], texture: 'nav' },
    ],

    interactables: {
        doors: [
            { id: "door1", cost: 1000, connects: [1, 2], pos: [12.5, 2.5, 0], size: [0.4, 5, 4], closedY: 2.5, openY: 7.5 }
        ],
        windows: [
            { id: "window_1", zone: 2, pos: [37.5, 0, 0] }
        ],
        groundSpawns: [
            { id: "hole_1", zone: 1, pos: [0, 0, 0] }
        ],
        perks: [],
        wallbuys: [],
        mysteryBoxes: [
            { pos: [-11.5, 0, -8], rotation: Math.PI / 2 },
            { pos: [36.5, 0, 32], rotation: -Math.PI / 2 },
            { pos: [36.5, 0, -32], rotation: -Math.PI / 2 }
        ],
        buildings: []
    },

    fixtures: [],

    zones: [
        {
            id: 1,
            bounds: { minX: -12.5, maxX: 12.5, minZ: -12.5, maxZ: 12.5 },
            spawnBounds: { min: [-12, 2, -12], max: [12, 2, 12] }
        },
        {
            id: 2,
            bounds: { minX: 12.5, maxX: 37.5, minZ: -12.5, maxZ: 12.5 },
            spawnBounds: { min: [13, 2, -12], max: [37, 2, 12] }
        },
        {
            id: 3,
            bounds: { minX: 12.5, maxX: 37.5, minZ: 12.5, maxZ: 37.5 },
            spawnBounds: { min: [13, 2, 13], max: [37, 2, 37] }
        },
        {
            id: 4,
            bounds: { minX: 12.5, maxX: 37.5, minZ: -37.5, maxZ: -12.5 },
            spawnBounds: { min: [13, 2, -37], max: [37, 2, -13] }
        },
    ],
    spawns: {
        host: { pos: [-11.29, 1.85, 0.16], rot: Math.PI / 2 },
        client: { pos: [-11.29, 1.85, 1.16], rot: Math.PI / 2 }
    },

    navigation: {
        navmeshParameters: {
            cs: 0.2, ch: 0.2, walkableSlopeAngle: 45, walkableHeight: 2.0,
            walkableClimb: 0.5, walkableRadius: 0.5, maxEdgeLen: 12,
            maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
            maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1
        }
    },

    config: {
        gameplay: wipmapGameplay,
    }
};
