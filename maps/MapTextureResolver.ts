
import { TEXTURES } from '../config';
import { MapTextureSet } from '../types/world';

/** Fully resolved texture set — every key has a value */
export type ResolvedTextureSet = Required<MapTextureSet>;

/** Global fallback textures */
const DEFAULTS: ResolvedTextureSet = {
    wall:      TEXTURES.WALL_TEX,
    floor:     TEXTURES.FLOOR_TEX,
    ceiling:   TEXTURES.CEILING_TEX,
    door:      TEXTURES.DOOR_TEX,
    plank:     TEXTURES.PLANK_TEX,
    powerDoor: TEXTURES.FLOOR_TEX,
};

/** @deprecated No-op — kept for call-site compatibility. */
export const registerMapFolder = (_mapId: string, _folder: string) => {};

/**
 * Prepares texture config before map load.
 *
 * Previously fetched public/maps/<folder>/config.json at runtime.
 * Map config is now fully static TypeScript in maps/<mapName>/config.ts.
 *
 * The yield is required — removing it causes GLB PBR materials to render
 * incorrectly. The original fetch() provided an async delay that allowed
 * Babylon.js to finish environment texture / PBR pipeline setup before
 * GLB models loaded. Without this yield, models get wrong materials.
 *
 * NOTE: setTimeout(0) is NOT sufficient when textures are cached by the
 * browser — a single microtask yield can still fire before the environment
 * CubeTexture is uploaded to GPU. We use requestAnimationFrame to ensure
 * at least one full render frame has elapsed.
 */
export const loadTextureConfig = async (_mapId: string): Promise<void> => {
    // Yield for one full animation frame to let the PBR pipeline and
    // environment texture finish GPU-side processing.
    await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 16)));
};

/**
 * Resolve the final texture set for a map.
 * Merges map-specific overrides (from the TS definition) over global defaults.
 */
export function resolveTextures(codeOverrides?: MapTextureSet): ResolvedTextureSet {
    return {
        ...DEFAULTS,
        ...codeOverrides,
    } as ResolvedTextureSet;
}

/** @deprecated Returns null — environment now comes from static TS config. */
export function getRuntimeEnvironment(): any | null {
    return null;
}
