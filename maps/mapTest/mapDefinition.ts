import { MapDefinition } from '../../types/world';
import { mapTestGameplay } from './config/gameplay';
import { mapTestHellhound, mapTestMysteryBox } from './config/enemies';
import { mapTestWeapons } from './config/weapons';
import { generateOctagonGeometry } from './geometry';

export const MapTestDefinition: MapDefinition = {
    meta: {
        id: "map_test",
        name: "Test Arena",
        version: "1.0",
        description: "A clinical testing environment designed to push the limits of survival tactics. Perfect for zeroing in your headshots."
    },
    assetUrls: {
        models: {
            zombie: "/models/zombie.glb"
        },
        textures: {
            wall: "/textures/wall_bricks.jpg"
        }
    },
    environment: {
        fog: { mode: 'exp2', density: 0.0, color: [0.3, 0.35, 0.45] },
        skybox: true,
        ambientLight: { intensity: 0.65, diffuse: [0.3, 0.35, 0.45], ground: [0.15, 0.15, 0.2] },
        directionalLight: { direction: [-0.3, -1, 0.2], intensity: 0.4 },
    },
    textures: {
        wall:      "/textures/wall_bricks.jpg",
        floor:     "https://playground.babylonjs.com/textures/wood.jpg",
        ceiling:   "https://playground.babylonjs.com/textures/ground.jpg",
        door:      "https://playground.babylonjs.com/textures/crate.png",
        plank:     "https://playground.babylonjs.com/textures/wood.jpg",
        powerDoor: "https://playground.babylonjs.com/textures/wood.jpg",
    },
    
    // Procedurally generated geometry plus Power Pillar
    geometry: [
        ...generateOctagonGeometry(50, 12, 2),
        {
            type: 'box',
            pos: [-10, 1.5, 10], // Pillar near perks
            size: [2, 3, 1],
            rotation: [0, 0, 0],
            texture: 'wall',
            uvScale: 1
        }
    ],
    grounds: [],
    
    interactables: {
        doors: [],
        windows: [],
        perks: [
             { type: "quick_revive", id: "quickRevive", zone: 1, pos: [-6, 0, 10], rotation: Math.PI },
             { type: "juggernog", id: "juggernog", zone: 1, pos: [-2, 0, 10], rotation: Math.PI },
             { type: "speed_cola", id: "speedCola", zone: 1, pos: [2, 0, 10], rotation: Math.PI },
        ],
        wallbuys: [],
        mysteryBoxes: [], 
        packAPunch: { pos: [6, 0, 10], rotation: Math.PI },
        powerSwitch: { 
            pos: [-10, 1.5, 9.45], // Mounted on front of pillar (10 - 0.5 depth - slight offset)
            rotation: 0 
        }
    },

    fixtures: [],
    
    zones: [
        { 
            id: 1, 
            bounds: { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity },
            spawnBounds: { min: [-40, 2, -40], max: [40, 2, 40] } 
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

    modelOverrides: {
        juggernog:    { scaling: [-1.50,    1.50,    1.50   ] },
        speed_cola:   { scaling: [-0.035,   0.035,   0.035  ] },
        quick_revive: { scaling: [-0.03,    0.03,    0.03   ] },
        pack_a_punch: { scaling: [-1.5,     1.5,     1.5    ] },
        power_switch: { scaling: [-0.0025,  0.0025,  0.0025 ] },
        m1911_fps:    { scaling: [ 0.00012, 0.00012, 0.00012] },
        m1911_world:  { scaling: [ 0.00012, 0.00012, 0.00012] },
        ray_gun_fps:  { scaling: [ 0.3615,  0.3615,  0.3615 ] },
        ray_gun_world:{ scaling: [ 0.482,   0.482,   0.482  ] },
    },
    
    config: {
        gameplay: mapTestGameplay,
        mysteryBox: mapTestMysteryBox,
        enemies: {
            hellhound: mapTestHellhound,
        },
        weapons: mapTestWeapons
    }
};
