import { MapDefinition } from '../types/world';

/**
 * Performs runtime validation of a MapDefinition to catch authoring errors.
 * Returns an array of error messages.
 */
export function validateMapDefinition(def: MapDefinition): string[] {
    const errors: string[] = [];
    const zoneIds = new Set(def.zones?.map(z => z.id) || []);

    if (!def.meta?.id) errors.push("Map definition missing meta.id");
    if (!def.zones || def.zones.length === 0) errors.push("Map definition must have at least one zone");

    // Doors
    if (def.interactables.doors) {
        def.interactables.doors.forEach(d => {
            if (d.connects[0] === d.connects[1]) {
                errors.push(`Door "${d.id}" connects zone ${d.connects[0]} to itself`);
            }
            if (!zoneIds.has(d.connects[0])) errors.push(`Door "${d.id}" references non-existent zone ${d.connects[0]}`);
            if (!zoneIds.has(d.connects[1])) errors.push(`Door "${d.id}" references non-existent zone ${d.connects[1]}`);
        });
    }

    // Windows
    if (def.interactables.windows) {
        def.interactables.windows.forEach(w => {
            if (!zoneIds.has(w.zone)) errors.push(`Window "${w.id}" references non-existent zone ${w.zone}`);
        });
    }

    // Perks
    if (def.interactables.perks) {
        def.interactables.perks.forEach(p => {
            if (!zoneIds.has(p.zone)) errors.push(`Perk "${p.id}" references non-existent zone ${p.zone}`);
        });
    }

    // Wallbuys
    if (def.interactables.wallbuys) {
        def.interactables.wallbuys.forEach(w => {
            if (!zoneIds.has(w.zone)) errors.push(`Wallbuy "${w.id}" references non-existent zone ${w.zone}`);
        });
    }

    // Spawns
    if (!def.spawns?.host) errors.push("Map definition missing host spawn");
    if (!def.spawns?.client) errors.push("Map definition missing client spawn");

    return errors;
}
