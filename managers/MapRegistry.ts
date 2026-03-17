
import * as BABYLON from '@babylonjs/core';
import { WindowBarrier, GroundSpawn, MysteryBox, MapDefinition, MutableRefObject } from '../types/index';
import { WarehouseMapDefinition } from '../maps/warehouse/mapDefinition';
import { MapTestDefinition } from '../maps/mapTest/mapDefinition';
import { WipmapDefinition } from '../maps/wipmap/mapDefinition';
import { resolveTextures } from '../maps/MapTextureResolver';
import { LevelBuilder } from '../engine/LevelBuilder';
import { DEFAULT_MAP_ID } from '../config';

/**
 * =============================================================================
 * MAP REGISTRY - Add your maps here!
 * =============================================================================
 *
 * To add a new map:
 *
 * 1. Create a new folder:  maps/yourMapName/
 *    - config.ts      (environment, textures, gameplay, model overrides)
 *    - geometry.ts    (wall layouts, room geometry)
 *    - definition.ts  (imports config + geometry, defines interactables, zones, spawns)
 *
 * 2. Import and register below in MAP_DEFINITIONS.
 *
 * 3. Add an entry to config/maps.ts so the map appears in the menu.
 *
 * To remove a map: delete the folder, remove the import + registry entry
 * below, and remove the entry from config/maps.ts.
 * =============================================================================
 */

export const MAP_DEFINITIONS: Record<string, MapDefinition> = {
    'warehouse': WarehouseMapDefinition,
    'map_test':  MapTestDefinition,
    'wipmap':    WipmapDefinition,
};

/** Get a map definition by id, falling back to default */
export const getMapDefinition = (id: string): MapDefinition =>
    MAP_DEFINITIONS[id] || MAP_DEFINITIONS[DEFAULT_MAP_ID];

/** Get list of available map ids */
export const getAvailableMapIds = (): string[] =>
    Object.keys(MAP_DEFINITIONS);

/** Get map metadata for UI display */
export const loadMap = (
    id: string,
    scene: BABYLON.Scene,
    shadowCasters: BABYLON.AbstractMesh[],
    windowsRef: WindowBarrier[],
    groundSpawnsRef: GroundSpawn[],
    mysteryBoxRef: MutableRefObject<MysteryBox>,
    navPlugin?: BABYLON.RecastJSPlugin,
    onBuildingLoaded?: (meshes: BABYLON.Mesh[]) => void
) => {
    windowsRef.length = 0;
    groundSpawnsRef.length = 0;

    const def = MAP_DEFINITIONS[id] || MAP_DEFINITIONS[DEFAULT_MAP_ID];

    // Textures: map definition overrides > global defaults
    const textures = resolveTextures(def.textures);

    const builder = new LevelBuilder(scene, shadowCasters, windowsRef, groundSpawnsRef, mysteryBoxRef, onBuildingLoaded);
    const levelData = builder.build(def, textures);

    if (navPlugin && def.navigation?.navmeshParameters) {
        try {
            navPlugin.createNavMesh(levelData.navMeshes, def.navigation.navmeshParameters as any);
            
            // Add static wall obstacles to block paths through walls
            if (def.navigation.wallObstacles) {
                def.navigation.wallObstacles.forEach((obs, idx) => {
                    const pos = new BABYLON.Vector3(obs.pos[0], obs.pos[1], obs.pos[2]);
                    const extent = new BABYLON.Vector3(obs.size[0] / 2, obs.size[1] / 2, obs.size[2] / 2);
                    try {
                        navPlugin.addBoxObstacle(pos, extent, obs.rotation || 0);
                    } catch (err) {
                        console.error(`[NavMesh] Failed to add wall obstacle ${idx}:`, err);
                    }
                });
            }
            
        } catch (e) {
            console.error('NavMesh Bake Failed:', e);
        }
    }

    return levelData;
};
