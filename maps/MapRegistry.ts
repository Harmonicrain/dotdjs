
import * as BABYLON from '@babylonjs/core';
import { WindowBarrier, MysteryBox, MapDefinition, MutableRefObject } from '../types/index';
import { WarehouseMapDefinition } from '../maps/warehouse/mapDefinition';
import { MapTestDefinition } from '../maps/mapTest/mapDefinition';
import { BarnMapDefinition } from '../maps/barn/mapDefinition';
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
    'barn':      BarnMapDefinition,
};

/** Get a map definition by id, falling back to default */
export const getMapDefinition = (id: string): MapDefinition =>
    MAP_DEFINITIONS[id] || MAP_DEFINITIONS[DEFAULT_MAP_ID];

/** Get list of available map ids */
export const getAvailableMapIds = (): string[] =>
    Object.keys(MAP_DEFINITIONS);

/** Get map metadata for UI display */
export const getMapMetadata = (id: string) => {
    const def = MAP_DEFINITIONS[id];
    return def?.meta ?? null;
};

export const loadMap = (
    id: string,
    scene: BABYLON.Scene,
    shadowCasters: BABYLON.AbstractMesh[],
    windowsRef: WindowBarrier[],
    mysteryBoxRef: MutableRefObject<MysteryBox>,
    navPlugin?: BABYLON.RecastJSPlugin,
    onBuildingLoaded?: (meshes: BABYLON.Mesh[]) => void
) => {
    windowsRef.length = 0;

    const def = MAP_DEFINITIONS[id] || MAP_DEFINITIONS[DEFAULT_MAP_ID];

    // Textures: map definition overrides > global defaults
    const textures = resolveTextures(def.textures);

    const builder = new LevelBuilder(scene, shadowCasters, windowsRef, mysteryBoxRef, onBuildingLoaded);
    const levelData = builder.build(def, textures);

    if (navPlugin && def.navigation?.navmeshParameters) {
        try {
            console.log(`[NavMesh] Creating navmesh with ${levelData.navMeshes.length} meshes:`);
            levelData.navMeshes.forEach(m => {
                const bounds = m.getBoundingInfo().boundingBox;
                const min = bounds.minimumWorld;
                const max = bounds.maximumWorld;
                console.log(`  - ${m.name}: bounds X(${min.x.toFixed(1)} to ${max.x.toFixed(1)}), Z(${min.z.toFixed(1)} to ${max.z.toFixed(1)})`);
            });
            navPlugin.createNavMesh(levelData.navMeshes, def.navigation.navmeshParameters as any);
            console.log(`[NavMesh] Created successfully`);
            
            // Add static wall obstacles to block paths through walls
            if (def.navigation.wallObstacles) {
                def.navigation.wallObstacles.forEach((obs, idx) => {
                    const pos = new BABYLON.Vector3(obs.pos[0], obs.pos[1], obs.pos[2]);
                    const extent = new BABYLON.Vector3(obs.size[0] / 2, obs.size[1] / 2, obs.size[2] / 2);
                    try {
                        navPlugin.addBoxObstacle(pos, extent, obs.rotation || 0);
                        console.log(`[NavMesh] Added wall obstacle ${idx}: pos=(${pos.x}, ${pos.y}, ${pos.z}), size=(${obs.size[0]}, ${obs.size[1]}, ${obs.size[2]})`);
                    } catch (err) {
                        console.error(`[NavMesh] Failed to add wall obstacle ${idx}:`, err);
                    }
                });
            }
            
            // Test path connectivity between zones
            const pathTests = [
                { from: new BABYLON.Vector3(0, 0, -15), to: new BABYLON.Vector3(0, 0, 20), desc: 'Zone1 to Zone2' },
                { from: new BABYLON.Vector3(0, 0, 20), to: new BABYLON.Vector3(20, 0, 6), desc: 'Zone2 to Zone3 (via door)' },
                { from: new BABYLON.Vector3(0, 0, -15), to: new BABYLON.Vector3(20, 0, 6), desc: 'Zone1 to Zone3 (full path)' },
                { from: new BABYLON.Vector3(0, 0, -15), to: new BABYLON.Vector3(15, 0, -3), desc: 'Zone1 to Zone3 lower area' },
            ];
            pathTests.forEach(test => {
                const fromClosest = navPlugin.getClosestPoint(test.from);
                const toClosest = navPlugin.getClosestPoint(test.to);
                console.log(`[NavMesh] Path test ${test.desc}:`);
                console.log(`  From: (${test.from.x}, ${test.from.z}) -> closest: (${fromClosest.x.toFixed(1)}, ${fromClosest.z.toFixed(1)})`);
                console.log(`  To: (${test.to.x}, ${test.to.z}) -> closest: (${toClosest.x.toFixed(1)}, ${toClosest.z.toFixed(1)})`);
                const path = navPlugin.computePath(fromClosest, toClosest);
                if (path && path.length > 0) {
                    console.log(`  ✓ Path found: ${path.length} waypoints`);
                } else {
                    console.warn(`  ✗ NO PATH FOUND`);
                }
            });
            
        } catch (e) {
            console.error('NavMesh Bake Failed:', e);
        }
    }

    return levelData;
};
