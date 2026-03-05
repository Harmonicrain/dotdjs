import { MapDefinition } from '../../types/world';
import { barnGameplay } from './config/gameplay';
import { barnHellhound, barnMysteryBox } from './config/enemies';
import { barnWeapons } from './config/weapons';

export const BarnMapDefinition: MapDefinition = {
    meta: {
        id: "barn",
        name: "The Barn",
        version: "1.0",
        description: "An open field with a barn. No perks, no mercy - just you and the undead."
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
    
    // Flat ground - no walls, just open field
    geometry: [],
    grounds: [
        {
            pos: [0, 0, 0],
            width: 120,
            height: 120,
            texture: 'floor',
            uvScale: [12, 12]
        }
    ],
    
    interactables: {
        doors: [],
        windows: [],
        perks: [],  // No perks in this map
        wallbuys: [],
        mysteryBoxes: [],
        // Barn building
        buildings: [
            {
                id: "american_old_barn",
                model: "/models/american_old_barn.glb",
                pos: [0, 0, 0],  // Center of the arena
                rotation: [0, 0, 0],
                scaling: [0.1, 0.1, 0.1],  // Adjust as needed based on model size
                checkCollisions: true,
                castShadows: true,
                receiveShadows: true
            }
        ]
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
        host: { pos: [0, 2.2, -30], rot: 0 },
        client: { pos: [3, 2.2, -30], rot: 0 }
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
        m1911_fps:    { scaling: [ 0.00012, 0.00012, 0.00012] },
        m1911_world:  { scaling: [ 0.00012, 0.00012, 0.00012] },
        ray_gun_fps:  { scaling: [ 0.3615,  0.3615,  0.3615 ] },
        ray_gun_world:{ scaling: [ 0.482,   0.482,   0.482  ] },
    },
    
    config: {
        gameplay: barnGameplay,
        mysteryBox: barnMysteryBox,
        enemies: {
            hellhound: barnHellhound,
        },
        weapons: barnWeapons
    }
};
