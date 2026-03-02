
import * as BABYLON from '@babylonjs/core';
import { MapDefinition, DoorConnection } from '../types/world';
import { StateManager } from '../state/StateManager';
import { validateMapDefinition } from '../maps/validateMapDefinition';

/**
 * MapLoader - Initializes game state from a MapDefinition.
 *
 * Handles the data-driven parts of level setup: door states, perk states,
 * zone system, and spawn points. Called after LevelBuilder has created the
 * visual meshes and geometry.
 */
export class MapLoader {
    constructor(
        private scene: BABYLON.Scene,
        private stateManager: StateManager
    ) {}

    /**
     * Initialize all state from a map definition.
     * Call this when starting/restarting a game after the imperative map builder
     * has already created the visual meshes.
     */
    public initializeState(definition: MapDefinition): void {
        const sm = this.stateManager;
        
        // Reset and Apply Map Configuration
        sm.configManager.resetToDefaults();
        sm.configManager.applyMapConfig(definition);

        // Runtime Validation (DEV only)
        if ((import.meta as any).env?.DEV) {
            const errors = validateMapDefinition(definition);
            if (errors.length > 0) {
                console.error(`Map "${definition.meta.name}" has definition errors:\n- ${errors.join('\n- ')}`);
            }
        }

        // Set current map
        sm.gameState.currentMapId = definition.meta.id;

        // Initialize doors
        sm.gameState.doorStates = {};
        if (definition.interactables.doors) {
            definition.interactables.doors.forEach(d => {
                sm.initializeDoor(d.id, d.cost, d.connects);
            });
        }
        // Initialize power door
        if (definition.interactables.powerSwitch?.powerDoor?.connects) {
            sm.initializeDoor("powerDoor", 0, definition.interactables.powerSwitch.powerDoor.connects);
        }

        // Initialize perks
        sm.gameState.perkStates = {};
        if (definition.interactables.perks) {
            definition.interactables.perks.forEach(p => {
                sm.initializePerk(p.id);
            });
        }

        // Initialize window barrier states
        sm.gameState.windowBarriers = {};
        if (definition.interactables.windows) {
            definition.interactables.windows.forEach(w => {
                sm.initializeWindow(w.id, w.zone, w.planks ?? 6);
            });
        }

        // Reset power and interactable states
        sm.gameState.powerOn = false;
        sm.gameState.interactableStates = {};

        // Initialize zones from definition (builds door connections from door defs)
        this.initializeZones(definition);

        // Initialize spawn points from definition
        this.initializeSpawns(definition);
    }

    /**
     * Build zone system from the map definition.
     * Door connections are derived from the door definitions' `connects` field.
     */
    private initializeZones(definition: MapDefinition): void {
        const sm = this.stateManager;
        
        // Normalize zone definitions
        const zones = definition.zones || [];
        
        // Build door connections from door definitions
        const doorConnections: DoorConnection[] = [];
        if (definition.interactables.doors) {
            definition.interactables.doors.forEach(d => {
                const pos = new BABYLON.Vector3(d.pos[0], d.pos[1], d.pos[2]);
                doorConnections.push({
                    doorId: d.id,
                    fromZone: d.connects[0],
                    toZone: d.connects[1],
                    waypoint: pos,
                    entryThreshold: 2.0
                });
            });
        }

        sm.updateZoneSystem(zones, doorConnections);
    }

    /**
     * Set spawn points from the map definition.
     */
    private initializeSpawns(definition: MapDefinition): void {
        const sm = this.stateManager;
        
        if (definition.spawns) {
            sm.spawnPoints = {
                host: new BABYLON.Vector3(
                    definition.spawns.host.pos[0],
                    definition.spawns.host.pos[1],
                    definition.spawns.host.pos[2]
                ),
                client: new BABYLON.Vector3(
                    definition.spawns.client.pos[0],
                    definition.spawns.client.pos[1],
                    definition.spawns.client.pos[2]
                ),
                rotation: definition.spawns.host.rot,
                clientRotation: definition.spawns.client.rot
            };
        }
    }

    /**
     * Get spawn position for a given role.
     */
    public getSpawnPoint(definition: MapDefinition, role: 'host' | 'client'): { position: BABYLON.Vector3, rotation: number } {
        const spawn = definition.spawns[role];
        return {
            position: new BABYLON.Vector3(spawn.pos[0], spawn.pos[1], spawn.pos[2]),
            rotation: spawn.rot
        };
    }
}
