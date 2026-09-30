# Rebuild plan

Why we rebuilt, what was decided, where we are, and what comes next.

## Why rebuild instead of refactor

The prototype typechecked and its tests passed, but it was the wrong shape:

- **Multiplayer** was hard-wired to exactly two players (`hostHealth` / `clientHealth` fields,
  a single `remote` player) and split authority: clients owned their own points and health, so a
  purchase could be spent twice. Delta snapshots skipped lost updates and kept applying later
  ones, so state drifted until the next full resync.
- **Game logic was tangled with rendering:** zombie positions lived on Babylon meshes, and one
  171-field state object mixed meshes, HUD strings and physics. Nothing could run on a server or
  be tested deterministically.
- **Visuals:** zombies built from primitive shapes, maps typed in as box coordinates, runtime
  textures and decoders pulled from third-party CDNs, and a 7.2 MB main bundle.

## Decisions

| Question | Decision |
| --- | --- |
| Hosting | Small dedicated Node server (one container serves client + game) |
| Art direction | Stylised |
| Naming | Keep the genre's perk/weapon names for now; replace before a public release |
| Player cap | 4 |
| Engine | Three.js (plus Rapier physics and Recast navigation) |
| Platforms | Keyboard/mouse and gamepad first; touch later |
| Snapshots | Full quantized snapshots (~0.5 KB), no delta compression |

## Milestones

### ✅ M0 — Skeleton
npm workspaces, strict TypeScript, ESLint with headless-package boundaries, Prettier, Vitest,
CI, the server talking to the client.

### ✅ M1 — Feel, solo, grey level
- Rapier character movement: walk, sprint, jump, stairs, ramps, wall sliding
- Hitscan weapons with deterministic spread, recoil, ADS, reloads; six weapons' data ported
- Zombies climb out of the ground, path with a Recast crowd, and attack; headshots
- Rounds, points and health regen, using the prototype's tuning numbers
- Solo in a Worker, online via the server, both through one protocol
- Stylised greybox renderer, procedural audio, full HUD and menus

**Gate:** someone has to play it for ten minutes and say it's fun. Tune `config.ts` and
`weapons/defs.ts` until it is.

### M2 — Multiplayer hardening
- Lobby with ready-up, so online rounds don't start before everyone is in
- Reconnect to a running game after a dropped connection
- Downed / revive for co-op, and spectating while dead
- A dev network simulator (latency, jitter, loss) and a latency-tolerance check in CI using the
  existing bots
- Soft collision between players and zombies, so zombies can trap you
- **Gate:** four players at 150 ms RTT feels fine.

### M3 — The core loop
Port from the prototype's configs: doors and zones (navmesh area flags), window barricades and
repairs, wall-buys, perks, mystery box, Pack-a-Punch, power-ups, hellhound rounds, the Ray Gun
(projectiles and splash), knife, crouch. The Warehouse layout in `legacy/maps/warehouse` is the
blueprint for the first real map.

### M4 — Art pass ("looks stunning")
- Maps built in Blender and exported as glTF, with markers for spawns, doors and windows, and
  baked lighting
- Skinned, animated zombies rendered as baked-animation instances so hordes stay cheap
- Proper first-person arms and weapon animations
- Post-processing (bloom, SSAO, colour grading), decals and gore
- Recorded audio and music replacing the synthesised placeholders
- HUD and menu polish

### M5 — Ship it
Performance budgets (60 fps on a mid-range laptop; first download under ~15 MB), a Dockerfile and
deploy (the server already serves the client), error reporting, settings polish, touch controls.

## Known gaps and tech debt

- **Bundle size:** Rapier's "compat" build inlines its WASM as base64 (≈4 MB of JS, ≈1.5 MB
  gzipped) in both the main bundle and the solo worker. Switch to the non-inlined build in M5.
- **Online rooms start immediately:** the pregame countdown begins as soon as the host connects.
  Fixed by the M2 lobby.
- **Players and zombies overlap:** zombies stop at attack range but players can walk through them.
  M2.
- **No melee, crouch or interaction yet:** the buttons are wired through input and protocol but
  do nothing in the sim until M3.
- **Genre names and legacy assets:** fine for private play, must be replaced before release.
