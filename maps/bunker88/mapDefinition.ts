import { MapDefinition } from '../../types/world';
import { bunker88Gameplay } from './config/gameplay';
import { bunker88Hellhound, bunker88MysteryBox } from './config/enemies';
import { bunker88Weapons } from './config/weapons';
import { BUNKER88_GEOMETRY } from './geometry';

export const Bunker88MapDefinition: MapDefinition = {
    meta: {
        id: "bunker88",
        name: "Bunker 88",
        version: "1.0",
        description: "A solid concrete bunker."
    },
    assetUrls: {
        models: {
            zombie: "/models/zombie.glb"
        },
        textures: {
            wall: "/textures/wall_grunge.jpg",
            floor: "/textures/warehouse_floor.jpg",
            ceiling: "https://playground.babylonjs.com/textures/ground.jpg"
        }
    },
    textures: {
        wall: "/textures/wall_grunge.jpg",
        floor: "/textures/warehouse_floor.jpg",
        ceiling: "https://playground.babylonjs.com/textures/ground.jpg",
    },
    geometry: BUNKER88_GEOMETRY,
    fixtures: [
        {
            pos: [0, 0],
            zone: 1,
            intensity: 1.5,
            range: 30
        }
    ],
    interactables: {
        doors: [],
        windows: [
            {
                id: "bunker_window_1",
                zone: 1,
                pos: [0, 0, 25],
                rotation: 0, // In this engine, 0 = parallel to the wall at this position
                planks: 5
            }
        ],
        perks: [],
        wallbuys: [],
        mysteryBoxes: [{ pos: [0, 0, 0] }], 
        packAPunch: { pos: [5, 0, 5] },
        powerSwitch: { pos: [10, 1.5, 10] }
    },
    zones: [
        { 
            id: 1, 
            bounds: { minX: -25, maxX: 25, minZ: -25, maxZ: 25 },
            spawnBounds: { min: [0, 0, 0], max: [0, 0, 0] } // Force spawns through windows
        },
        {
            id: 2,
            bounds: { minX: -5, maxX: 5, minZ: 25, maxZ: 35 },
            spawnBounds: { min: [-1.25, 1.95, 30.23], max: [-1.25, 1.95, 30.23] }
        }
    ],
    spawns: {
        host: { pos: [0, 2.2, -5], rot: 0 },
        client: { pos: [2, 2.2, -5], rot: 0 }
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
        gameplay: bunker88Gameplay,
        enemies: {
            hellhound: bunker88Hellhound,
            mysteryBox: bunker88MysteryBox
        },
        weapons: bunker88Weapons
    }
};
