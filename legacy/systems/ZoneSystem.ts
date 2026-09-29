
import * as BABYLON from '@babylonjs/core';
import { ZoneDefinition, DoorConnection, DoorState } from '../types/index';

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
     * Returns all zone IDs reachable from `currentZone` by BFS through
     * open doors only (including `currentZone` itself).
     *
     * Zones are connected exclusively through doors — physical boundary
     * adjacency alone does NOT grant access. Zones that share a wall
     * (e.g. zone 1 and 3 in Warehouse) stay isolated until the
     * connecting door chain is opened.
     */
    public getAccessibleZones(currentZone: number, doorStates: Record<string, DoorState>): number[] {
        const accessible = new Set<number>([currentZone]);
        const queue = [currentZone];

        while (queue.length > 0) {
            const zone = queue.shift()!;

            for (const d of this.doors) {
                if (!doorStates[d.doorId]?.isOpen) continue;
                const neighbor = d.fromZone === zone ? d.toZone : d.toZone === zone ? d.fromZone : -1;
                if (neighbor === -1 || accessible.has(neighbor)) continue;
                accessible.add(neighbor);
                queue.push(neighbor);
            }
        }

        return Array.from(accessible);
    }

    /** Check if two zones share a boundary edge (touching on X or Z axis). */
    private zonesShareBoundary(za: ZoneDefinition, zb: ZoneDefinition): boolean {
        const a = this.getZoneBounds(za);
        const b = this.getZoneBounds(zb);

        // Check X-axis adjacency (share a Z-overlapping edge)
        const xAdj = Math.abs(a.maxX - b.minX) < 0.01 || Math.abs(b.maxX - a.minX) < 0.01;
        const zOverlap = a.minZ < b.maxZ && b.minZ < a.maxZ;

        // Check Z-axis adjacency (share an X-overlapping edge)
        const zAdj = Math.abs(a.maxZ - b.minZ) < 0.01 || Math.abs(b.maxZ - a.minZ) < 0.01;
        const xOverlap = a.minX < b.maxX && b.minX < a.maxX;

        return (xAdj && zOverlap) || (zAdj && xOverlap);
    }

    private getZoneBounds(zone: ZoneDefinition): { minX: number; maxX: number; minZ: number; maxZ: number } {
        const b = zone.bounds as any;
        if (b.min && Array.isArray(b.min)) {
            return { minX: b.min[0], maxX: b.max[0], minZ: b.min[2], maxZ: b.max[2] };
        }
        return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
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
