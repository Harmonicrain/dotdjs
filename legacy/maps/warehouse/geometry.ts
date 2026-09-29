import { GeometryDefinition, GroundDefinition } from '../../types/world';

const WALL_UV = 0.2;

/** Warehouse ground planes - continuous visual floors (no gaps visible to player) */
export const WAREHOUSE_GROUNDS: GroundDefinition[] = [
    // Zone 1 + Zone 2: Left side
    { width: 20, height: 70, pos: [0, 0, 5], texture: 'wood' },
    // Zone 3: Right side
    { width: 20, height: 70, pos: [20, 0, 5], texture: 'wood' },
    // Zone 4: Pack-a-Punch room - UV scaled to match texture density of main floors
    // Main floors: 20x70 with uScale=8, vScale=16 → each tile is 2.5x4.375 units
    // Zone 4: 10x6, needs uScale=4, vScale≈1.37 to match world-space density
    { width: 10, height: 6, pos: [-12, 0.01, -5], texture: 'wood', uvScale: [4, 1.37] },
];

/** 
 * Navigation-only floor planes - INVISIBLE, used only for navmesh generation.
 * NavFloors MUST OVERLAP with door connectors for Recast to merge them.
 * Zone floors have 0.5 unit gaps at walls to prevent direct connections.
 * Door connectors are narrow (2 units) to force zombies through center.
 */
export const WAREHOUSE_NAV_FLOORS: GroundDefinition[] = [
    // Zone 1: Back left area (X: -9.5 to 9.5, Z: -30.25 to -0.75)
    // Width=19, centered at 0; Height=29.5, centered at -15.5 to end at -0.75
    { width: 19, height: 29.5, pos: [0, 0, -15.5], texture: 'nav' },

    // Door 1 connector (X: -1 to 1, Z: -1 to 1) - narrow bridge through door center
    { width: 2, height: 2, pos: [0, 0, 0], texture: 'nav' },

    // Zone 2: Front left area (X: -10 to 10, Z: 0.5 to 40)
    // Height=39.5, center at Z=20.25 gives range Z=0.5 to Z=40
    { width: 20, height: 39.5, pos: [0, 0, 20.25], texture: 'nav' },

    // Door 2 connector (X: 9 to 11, Z: 5 to 7) - narrow bridge through door center
    { width: 2, height: 2, pos: [10, 0, 6], texture: 'nav' },

    // Zone 3: Right side (X: 10.5 to 30, Z: -30 to 40)
    // Width=19.5, center at X=20.25 gives range X=10.5 to X=30
    { width: 19.5, height: 70, pos: [20.25, 0, 5], texture: 'nav' },

    // Zone 4: Pack-a-Punch room - gap from Zone 1 to force door pathing
    { width: 10, height: 6, pos: [-15.5, 0, -5], texture: 'nav' },

    // Power door connector (X: -12 to -9) - extends into Zone 4 for better pathing
    { width: 3, height: 4, pos: [-10.5, 0.1, -5], texture: 'nav' },
];

/** Warehouse wall and room geometry */
export const WAREHOUSE_GEOMETRY: GeometryDefinition[] = [
    // === ZONE 1: BACK LEFT AREA (Z: -30 to 0, X: -10 to 10) ===
    // Left wall
    { type: "wall", pos: [-10, 4.5, -23.5], size: [1, 9, 33], texture: "brick2", uvScale: WALL_UV, uvOffset: [0.5, 0.5] },
    // Back wall
    { type: "wall", pos: [0, 4.5, -30], size: [20, 9, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.0, 0.0] },

    // === ZONE 4: PACK-A-PUNCH ROOM (X: -16 to -13, Z: -8 to -2) ===
    { type: "ceiling", pos: [-13, 9.0, -5], size: [6, 0.2, 6], uvScale: 0.1 },
    { type: "wall", pos: [-16, 4.5, -5], size: [1, 9, 6], texture: "brick", uvScale: WALL_UV, uvOffset: [0.7, 0.3] },
    { type: "wall", pos: [-13, 4.5, -2], size: [6, 9, 1], texture: "brick2", uvScale: WALL_UV, uvOffset: [0.2, 0.8] },
    { type: "wall", pos: [-13, 4.5, -8], size: [6, 9, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.4, 0.6] },
    // Partial wall separating PaP from Zone 1
    { type: "wall", pos: [-10, 7.5, -5], size: [1, 3, 4], texture: "brick2", uvScale: WALL_UV, uvOffset: [0.8, 0.1] },

    // === ZONE 2: FRONT LEFT AREA (Z: 0 to 40, X: -10 to 10) ===
    // Left wall (front section)
    { type: "wall", pos: [-10, 4.5, 18.5], size: [1, 9, 43], texture: "brick", uvScale: WALL_UV, uvOffset: [0.3, 0.7] },
    // Front wall
    { type: "wall", pos: [0, 4.5, 40], size: [20, 9, 1], texture: "brick2", uvScale: WALL_UV, uvOffset: [0.6, 0.4] },

    // === ZONES 1-2 DIVIDER (at Z: 0) ===
    { type: "wall", pos: [-6, 4.5, 0], size: [8, 9, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.1, 0.5] },
    { type: "wall", pos: [6, 4.5, 0], size: [8, 9, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.6, 0.2] },
    { type: "wall", pos: [0, 6.5, 0], size: [4, 5, 1], texture: "brick2", uvScale: WALL_UV, uvOffset: [0.9, 0.7] },

    // === MAIN CEILING (covers Zones 1, 2, 3) ===
    { type: "ceiling", pos: [8, 9.1, 0], size: [45, 0.2, 80], uvScale: 0.1 },

    // === ZONE 3: RIGHT ROOM (X: 10 to 30, Z: -30 to 40) ===
    // Right wall (full length)
    { type: "wall", pos: [10, 4.5, -31], size: [1, 9, 18], texture: "brick", uvScale: WALL_UV, uvOffset: [0.0, 0.4] },
    { type: "wall", pos: [10, 6, -20], size: [1, 6, 4], texture: "brick", uvScale: WALL_UV, uvOffset: [0.5, 0.9] },
    { type: "wall", pos: [10, 4.5, -7], size: [1, 9, 22], texture: "brick", uvScale: WALL_UV, uvOffset: [0.8, 0.2] },
    { type: "wall", pos: [10, 4.5, 15.5], size: [1, 9, 15], texture: "brick", uvScale: WALL_UV, uvOffset: [0.2, 0.6] },
    { type: "wall", pos: [10, 6.5, 6], size: [1, 5, 4], texture: "brick", uvScale: WALL_UV, uvOffset: [0.4, 0.1] },
    { type: "wall", pos: [10, 6, 25], size: [1, 6, 4], texture: "brick", uvScale: WALL_UV, uvOffset: [0.7, 0.8] },
    { type: "wall", pos: [10, 4.5, 33.5], size: [1, 9, 13], texture: "brick", uvScale: WALL_UV, uvOffset: [0.1, 0.3] },
    // Room 3 internal walls
    { type: "wall", pos: [19.5, 4.5, -5], size: [19, 9, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.6, 0.5] },
    { type: "wall", pos: [29, 4.5, 2], size: [1, 9, 15], texture: "brick", uvScale: WALL_UV, uvOffset: [0.3, 0.0] },
    { type: "wall", pos: [14, 4.5, 9], size: [8, 9, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.9, 0.4] },
    { type: "wall", pos: [25.5, 4.5, 9], size: [7, 9, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.2, 0.9] },
    { type: "wall", pos: [20, 6, 9], size: [4, 6, 1], texture: "brick", uvScale: WALL_UV, uvOffset: [0.5, 0.3] },
];
