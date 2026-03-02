# Map Template

Copy this folder to create a new map.

## Quick Start

```bash
cp -r maps/_template maps/yourMapName
```

Then:
1. Update `meta.id` and `meta.name` in `mapDefinition.ts`.
2. Configure your specific overrides in the `config/` folder.
3. Rename `MapTemplateDefinition` → `YourMapDefinition` and export it.
4. Follow the full guide in `maps/ADDING_MAPS.md`.

## Files

- **mapDefinition.ts** — The main entry point. Ties metadata, asset URLs, and geometry together.
- **geometry.ts** — Define your walls, floors, and procedural generators here.
- **config/** — Folder containing map-specific gameplay, enemy, and weapon balance overrides.
