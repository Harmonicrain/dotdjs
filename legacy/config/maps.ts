/**
 * Maps configuration for UI display.
 * 
 * IMPORTANT: When you add or remove a map in managers/MapRegistry.ts,
 * you must also update this list to match!
 * 
 * This list should match the meta info from each map's config.ts file.
 */
export const DEFAULT_MAP_ID = 'warehouse';

export const MAPS = [
  {
    id: 'warehouse',
    name: 'WAREHOUSE 115',
    description: 'An abandoned storage facility with tight corridors.',
    preview: '/textures/maps/warehouse/preview.png',
  },
  {
    id: 'map_test',
    name: 'MAP TEST',
    description: 'A large octagonal stone arena surrounded by gates.',
    preview: null,
  },
  {
    id: 'wipmap',
    name: 'WIPMAP',
    description: 'Work in progress map.',
    preview: null,
  }
];
