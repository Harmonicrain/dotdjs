import { MapDefinition } from '../../types/world';
import { warehouseGameplay } from './config/gameplay';
import { warehouseHellhound, warehouseMysteryBox } from './config/enemies';
import { warehouseWeapons } from './config/weapons';
import { WAREHOUSE_GEOMETRY, WAREHOUSE_GROUNDS, WAREHOUSE_NAV_FLOORS } from './geometry';

export const WarehouseMapDefinition: MapDefinition = {
    meta: {
        id: "warehouse",
        name: "Warehouse 115",
        version: "2.1",
        description: "A dark, abandoned warehouse overrun by the undead. Tight corridors and multiple floors make for intense close-quarters survival."
    },
    assetUrls: {
        models: {
            zombie: "/models/zombie.glb",
            juggernog: "/models/juggernog.glb",
            speed_cola: "/models/speedcola.glb",
            quick_revive: "/models/quickrevive.glb",
            pack_a_punch: "/models/packapunch.glb",
            power_switch: "/models/switch.glb"
        },
        textures: {
            wall: "/textures/wall_grunge.jpg",
            floor: "/textures/warehouse_floor.jpg",
            door: "/textures/door.jpg"
        }
    },
    environment: {
        fog: { mode: 'exp2', density: 0.0, color: [0.3, 0.35, 0.45] },
        skybox: true,
        ambientLight: { intensity: 0.4, diffuse: [0.3, 0.35, 0.45], ground: [0.15, 0.15, 0.2] },
        directionalLight: { direction: [-0.3, -1, 0.2], intensity: 0.4 },
    },
    textures: {
        wall:      "/textures/wall_grunge.jpg",
        floor:     "/textures/warehouse_floor.jpg",
        ceiling:   "https://playground.babylonjs.com/textures/ground.jpg",
        door:      "https://playground.babylonjs.com/textures/crate.png",
        plank:     "https://playground.babylonjs.com/textures/wood.jpg",
        powerDoor: "https://playground.babylonjs.com/textures/wood.jpg",
    },
    geometry: WAREHOUSE_GEOMETRY,
    grounds: WAREHOUSE_GROUNDS,
    navFloors: WAREHOUSE_NAV_FLOORS,
    
    interactables: {
        doors: [
            { id: "door1", cost: 500, connects: [1, 2], pos: [0, 2, 0], size: [4, 4, 0.4], closedY: 2, openY: 6 },
            { id: "door2", cost: 1000, connects: [2, 3], pos: [10, 2, 6], size: [0.4, 4, 4], closedY: 2, openY: 6 }
        ],
        windows: [
            { id: "window_1", zone: 1, pos: [10, 0, -20], rotation: 0 },
            { id: "window_2", zone: 2, pos: [10, 0, 25], rotation: 0 },
            { id: "window_3", zone: 3, pos: [20, 0, 9], rotation: Math.PI / 2 }
        ],
        perks: [
            { type: "juggernog", id: "juggernog", zone: 2, pos: [0, 0, 35], rotation: Math.PI },
            { type: "speed_cola", id: "speedCola", zone: 3, pos: [28, 0, 2], rotation: -Math.PI / 2 },
            { type: "quick_revive", id: "quickRevive", zone: 1, pos: [-3, 0, -28.9], rotation: 0 }
        ],
        wallbuys: [
            { weapon: "shotgun", cost: 500, id: "buy_shotgun", zone: 1, pos: [-9.4, 2.5, -15], rotation: Math.PI / 2 },
            { weapon: "famas", cost: 1200, id: "buy_famas", zone: 2, pos: [-9.4, 2.5, 10], rotation: Math.PI / 2 }
        ],
        mysteryBoxes: [
            { pos: [3, 0, -28.9], rotation: Math.PI },
            { pos: [8.0, 0, 15], rotation: Math.PI / 2 },
            { pos: [20, 0, -3.0], rotation: Math.PI }
        ],
        powerSwitch: { 
            pos: [28.4, 1.5, 5], 
            rotation: Math.PI / 2,
            powerDoor: { pos: [-10, 3, -5], size: [0.4, 6, 4], openY: 8, connects: [1, 4] }
        },
        packAPunch: { pos: [-14.0, 0, -5.5], rotation: Math.PI / 2, zone: 4 }
    },

    fixtures: [
        { pos: [0, -15], zone: 1 },
        { pos: [0, 5], zone: 2 },
        { pos: [0, 20], zone: 2 },
        { pos: [0, 35], zone: 2 },
        { pos: [20, 2], zone: 3 },
        { pos: [25, -2], zone: 3 },
        { pos: [-13, -5], zone: 4, intensity: 2.0, range: 10 }
    ],
    
    zones: [
        { id: 1, bounds: { minX: -10, maxX: 10, minZ: -30, maxZ: 0 }, spawnBounds: { min: [-5, 2, -20], max: [5, 2, -5] } },
        { id: 2, bounds: { minX: -10, maxX: 10, minZ: 0, maxZ: 40 }, spawnBounds: { min: [-5, 2, 5], max: [5, 2, 30] } },
        { id: 3, bounds: { minX: 10, maxX: 30, minZ: -30, maxZ: 40 }, spawnBounds: { min: [15, 2, -5], max: [25, 2, 10] } },
        { id: 4, bounds: { minX: -16, maxX: -10, minZ: -8, maxZ: -2 }, spawnBounds: { min: [0, 0, 0], max: [0, 0, 0] } }
    ],
    
    spawns: {
        host: { pos: [0, 2.2, -22], rot: 0 },
        client: { pos: [-4, 2.2, 18], rot: 0 }
    },

    navigation: {
        navmeshParameters: {
            cs: 0.2, ch: 0.2, walkableSlopeAngle: 45, walkableHeight: 2.0,
            walkableClimb: 0.5, walkableRadius: 0.3, maxEdgeLen: 12,
            maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
            maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1
        }
        // Wall obstacles not needed - floor gaps at zone boundaries prevent direct pathing
        // Doors have their own obstacles that are removed when opened
    },

    modelOverrides: {
        juggernog:    { scaling: [-1.50,    1.50,    1.50   ] },
        speed_cola:   { scaling: [-0.035,   0.035,   0.035  ] },
        quick_revive: { scaling: [-0.03,    0.03,    0.03   ] },
        pack_a_punch: { scaling: [-1.5,     1.5,     1.5    ] },
        power_switch: { scaling: [-0.0025,  0.0025,  0.0025 ] },
        m1911_fps:    { scaling: [ 0.00012, 0.00012, 0.00012] },
        m1911_world:  { scaling: [ 0.00012, 0.00012, 0.00012] },
    },
    
    config: {
        gameplay: warehouseGameplay,
        enemies: {
            hellhound: warehouseHellhound,
            mysteryBox: warehouseMysteryBox
        },
        weapons: warehouseWeapons
    }
};
