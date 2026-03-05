import { MapDefinition } from '../../types/world';
import { templateGameplay } from './config/gameplay';
import { templateHellhound, templateMysteryBox } from './config/enemies';
import { templateWeapons } from './config/weapons';
import { TEMPLATE_GEOMETRY } from './geometry';

export const MapTemplateDefinition: MapDefinition = {
    meta: {
        id: "template_map",
        name: "Map Template",
        version: "1.0",
        description: "A starter template for creating new maps."
    },
    assetUrls: {
        models: {
            zombie: "/models/zombie.glb"
        },
        textures: {
            wall: "/textures/wall_grunge.jpg"
        }
    },
    geometry: TEMPLATE_GEOMETRY,
    interactables: {
        doors: [],
        windows: [],
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
            spawnBounds: { min: [-20, 2, -20], max: [20, 2, 20] } 
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
        gameplay: templateGameplay,
        mysteryBox: templateMysteryBox,
        enemies: {
            hellhound: templateHellhound,
        },
        weapons: templateWeapons
    }
};
