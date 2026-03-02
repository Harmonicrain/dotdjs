
import * as BABYLON from '@babylonjs/core';
import { ZoneDefinition, DoorConnection, DoorState } from '../types/index';
import { Pathfinder } from '../engine/Pathfinder';

/**
 * ZoneSystem
 *
 * Maintains the zone graph for a loaded map and provides spatial queries
 * used by ZombieManager for spawn logic and by ZombieSystem for pathfinding.
 *
 * A "zone" is an integer-labelled region of the map.  Zones are connected by
 * doors; zombies and players move between zones only through open doors.
 *
 * Zone bounds may be expressed either as a `ZoneBounds` object
 * (`minX/maxX/minZ/maxZ`) or as a `{ min, max }` tuple array as defined in
 * the map definition schema.  Both formats are supported.
 */
export class ZoneSystem {
    private zoneCenters: Map<number, BABYLON.Vector3> = new Map();

    constructor(private zones: ZoneDefinition[], private doors: DoorConnection[]) {
        this.calculateZoneCenters();
    }

    /** Replace the current zone/door graph with new data (called on map load). */
    public load(zones: ZoneDefinition[], doors: DoorConnection[]): void {
        this.zones = zones;
        this.doors = doors;
        this.calculateZoneCenters();
    }

    private calculateZoneCenters(): void {
        this.zoneCenters.clear();
        for (const zone of this.zones) {
            const b = zone.bounds as any;
            let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
            if (b.min && Array.isArray(b.min)) {
                minX = b.min[0]; maxX = b.max[0];
                minZ = b.min[2]; maxZ = b.max[2];
            } else {
                minX = b.minX; maxX = b.maxX;
                minZ = b.minZ; maxZ = b.maxZ;
            }
            // Handle infinity by clamping to some reasonable bounds for center calculation
            const clamp = (v: number) => Math.max(-100, Math.min(100, v));
            this.zoneCenters.set(zone.id, new BABYLON.Vector3(
                (clamp(minX) + clamp(maxX)) / 2,
                0,
                (clamp(minZ) + clamp(maxZ)) / 2
            ));
        }
    }

    /**
     * Returns the zone ID that contains `pos`, or `1` (the default starting
     * zone) when the position falls outside all defined zone bounds.
     */
    public getZone(pos: BABYLON.Vector3): number {
        for (const zone of this.zones) {
            const b = zone.bounds as any;
            if (b.min && Array.isArray(b.min)) {
                if (pos.x >= b.min[0] && pos.x <= b.max[0] && pos.z >= b.min[2] && pos.z <= b.max[2]) {
                    return zone.id;
                }
            } else {
                if (pos.x >= b.minX && pos.x <= b.maxX && pos.z >= b.minZ && pos.z <= b.maxZ) {
                    return zone.id;
                }
            }
        }
        return 1;
    }

    /**
     * Returns the door that connects `fromZone` to `toZone` via the shortest
     * path (BFS over the door graph), or `null` if no path exists.
     *
     * The returned door is the *first hop* on the path, i.e. the door the
     * entity should move toward immediately.
     */
    public getDoorBetween(fromZone: number, toZone: number): DoorConnection | null {
        const direct = this.doors.find(d =>
            (d.fromZone === fromZone && d.toZone === toZone) ||
            (d.fromZone === toZone   && d.toZone === fromZone)
        );
        if (direct) return direct;

        const queue: { zone: number; firstDoor: DoorConnection | null }[] = [
            { zone: fromZone, firstDoor: null },
        ];
        const visited = new Set<number>([fromZone]);

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.zone === toZone) return current.firstDoor;

            const neighbors = this.doors.filter(
                d => d.fromZone === current.zone || d.toZone === current.zone
            );
            for (const door of neighbors) {
                const nextZone = door.fromZone === current.zone ? door.toZone : door.fromZone;
                if (!visited.has(nextZone)) {
                    visited.add(nextZone);
                    queue.push({ zone: nextZone, firstDoor: current.firstDoor ?? door });
                }
            }
        }

        return null;
    }

    /**
     * Returns the shortest path (list of door connections) from fromZone to toZone.
     * Use this for higher-level pathing between zones.
     */
    public getPathToZone(fromZone: number, toZone: number): DoorConnection[] | null {
        if (fromZone === toZone) return [];

        const path = Pathfinder.findPath<number>(
            fromZone,
            toZone,
            (zoneId) => {
                const neighbors = this.doors.filter(d => d.fromZone === zoneId || d.toZone === zoneId);
                return neighbors.map(d => {
                    const otherZone = d.fromZone === zoneId ? d.toZone : d.fromZone;
                    // Cost is the distance between zone centers via the door waypoint
                    const center1 = this.zoneCenters.get(zoneId) || BABYLON.Vector3.Zero();
                    const center2 = this.zoneCenters.get(otherZone) || BABYLON.Vector3.Zero();
                    const cost = BABYLON.Vector3.Distance(center1, d.waypoint) + BABYLON.Vector3.Distance(d.waypoint, center2);
                    return { id: otherZone, cost };
                });
            },
            (zoneId, goalId) => {
                const center1 = this.zoneCenters.get(zoneId) || BABYLON.Vector3.Zero();
                const center2 = this.zoneCenters.get(goalId) || BABYLON.Vector3.Zero();
                return BABYLON.Vector3.Distance(center1, center2);
            }
        );

        if (!path) return null;

        // Convert zone sequence back into door sequence
        const doorPath: DoorConnection[] = [];
        for (let i = 0; i < path.length - 1; i++) {
            const z1 = path[i];
            const z2 = path[i+1];
            const door = this.doors.find(d => 
                (d.fromZone === z1 && d.toZone === z2) || 
                (d.fromZone === z2 && d.toZone === z1)
            );
            if (door) doorPath.push(door);
        }

        return doorPath;
    }

    /**
     * Returns all zone IDs reachable from `currentZone` through currently
     * open doors (including `currentZone` itself).
     */
    public getAccessibleZones(currentZone: number, doorStates: Record<string, DoorState>): number[] {
        const accessible = new Set<number>([currentZone]);
        for (const d of this.doors) {
            if (!doorStates[d.doorId]?.isOpen) continue;
            if (d.fromZone === currentZone) accessible.add(d.toZone);
            if (d.toZone   === currentZone) accessible.add(d.fromZone);
        }
        return Array.from(accessible);
    }

    /**
     * Returns a uniformly random point within the `spawnBounds` of `zoneId`,
     * or `null` if that zone has no spawn bounds defined.
     */
    public getRandomSpawnPoint(zoneId: number): BABYLON.Vector3 | null {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone?.spawnBounds) return null;
        const sb = zone.spawnBounds;
        return new BABYLON.Vector3(
            sb.min[0] + Math.random() * (sb.max[0] - sb.min[0]),
            sb.min[1] + Math.random() * (sb.max[1] - sb.min[1]),
            sb.min[2] + Math.random() * (sb.max[2] - sb.min[2]),
        );
    }
}
