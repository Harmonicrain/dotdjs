import { GeometryDefinition } from '../../types/world';

export const BUNKER88_GEOMETRY: GeometryDefinition[] = [
    // === MAIN ROOM (ZONE 1) ===
    {
        type: 'floor',
        pos: [0, 0, 0],
        size: [50, 0.2, 50],
        texture: 'floor',
        uvScale: 0.2
    },
    {
        type: 'ceiling',
        pos: [0, 10, 0],
        size: [50, 0.2, 50],
        texture: 'ceiling',
        uvScale: 0.2
    },
    // Front wall - split for window at X:0, Z:25
    {
        type: 'wall',
        pos: [-13.5, 5, 25],
        size: [23, 10, 1],
        texture: 'wall',
        uvScale: 0.2
    },
    {
        type: 'wall',
        pos: [13.5, 5, 25],
        size: [23, 10, 1],
        texture: 'wall',
        uvScale: 0.2
    },
    {
        type: 'wall',
        pos: [0, 8, 25], // Lintel above window
        size: [4, 4, 1],
        texture: 'wall',
        uvScale: 0.2
    },
    // Back wall - restored (no hole)
    {
        type: 'wall',
        pos: [0, 5, -25],
        size: [50, 10, 1],
        texture: 'wall',
        uvScale: 0.2
    },
    {
        type: 'wall',
        pos: [25, 5, 0],
        size: [1, 10, 50],
        texture: 'wall',
        uvScale: 0.2
    },
    {
        type: 'wall',
        pos: [-25, 5, 0],
        size: [1, 10, 50],
        texture: 'wall',
        uvScale: 0.2
    },

    // === STORAGE ROOM (ZONE 2) ===
    // Connected at Z: 25 to 35, centered at X: 0
    {
        type: 'floor',
        pos: [0, 0, 30],
        size: [10, 0.2, 10],
        texture: 'floor',
        uvScale: 0.2
    },
    {
        type: 'ceiling',
        pos: [0, 10, 30],
        size: [10, 0.2, 10],
        texture: 'ceiling',
        uvScale: 0.2
    },
    {
        type: 'wall',
        pos: [0, 5, 35], // Back wall of storage
        size: [10, 10, 1],
        texture: 'wall',
        uvScale: 0.2
    },
    {
        type: 'wall',
        pos: [5, 5, 30], // Right wall
        size: [1, 10, 10],
        texture: 'wall',
        uvScale: 0.2
    },
    {
        type: 'wall',
        pos: [-5, 5, 30], // Left wall
        size: [1, 10, 10],
        texture: 'wall',
        uvScale: 0.2
    }
];
