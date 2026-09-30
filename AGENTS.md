# AGENTS.md — DOM OF THE DEAD

Guide for anyone (human or AI) changing this codebase. Read it before your first edit.

## What this is

A browser co-op zombie survival FPS (up to 4 players), in the spirit of classic round-based
zombies. TypeScript everywhere; Three.js renders, React draws menus and the HUD, Rapier does
physics, Recast does zombie pathfinding.

`legacy/` is the original prototype, kept **for reference only**. Nothing imports it, it is not
built, linted or tested, and it will be deleted once its content has been ported. Never edit it.

## Layout

```
packages/sim        Game rules. Pure TypeScript: no DOM, no three.js, no React.
packages/protocol   Binary wire format (client ↔ room messages).
packages/room       Authoritative room: owns a World, applies inputs, sends snapshots.
apps/server         Node host: WebSockets + room codes. Serves the built client too.
apps/client         Vite + Three.js + React. Solo runs a Room inside a Web Worker.
```

Dependencies only point downwards: `client/server → room → protocol → sim`.

## The rules

These are what keep the project from turning back into the prototype. Lint and typecheck enforce
most of them.

1. **One code path for solo and online.** Solo is an ordinary room running in a Worker. Gameplay
   code never asks "am I solo / host / client?".
2. **The room is the only authority.** Clients send inputs; they never send state (points,
   health, positions, hits). Anything a client says is validated or ignored.
3. **All gameplay lives in `packages/sim`.** If it affects the outcome of a game, it belongs there
   and gets a test. The client only renders, plays sound, and predicts its own player.
4. **The sim is deterministic.** No `Math.random` (use the seeded `Rng`), no `Date` or wall clock,
   no DOM. Timers are seconds of sim time counted down each tick. Lint blocks the common mistakes.
5. **Prediction reuses sim code.** The client predicts the local player with the same `stepPlayer`
   the server runs. Anything `stepPlayer` reads must be in `PredictedState` and in the snapshot's
   `self` block. `packages/room/test/room.test.ts` asserts that prediction matches the server
   exactly; keep it passing.
6. **Protocol changes are explicit.** Change `messages.ts` and `codec.ts` together, append (never
   reorder) enum lists such as `EVENT_TYPES` and `WEAPON_IDS`, bump `PROTOCOL_VERSION`, and extend
   the round-trip tests.
7. **The client owns only presentation.** Engine code talks to React through the zustand store
   (`apps/client/src/state/store.ts`); React never reaches into the engine.

## Common changes

- **Tuning** (speeds, damage, round curve, points): `packages/sim/src/config.ts`,
  `packages/sim/src/weapons/defs.ts`.
- **New weapon:** add it to `WEAPONS` and append its id to `WEAPON_IDS`, then give it a model in
  `apps/client/src/game/render/weaponModels.ts` and a voice in `apps/client/src/game/audio/audio.ts`.
- **New sim event:** add to `SimEvent` (`packages/sim/src/events.ts`), append to `EVENT_TYPES` and
  encode it in `packages/protocol/src/codec.ts`, then handle it in
  `apps/client/src/game/session.ts` (`handleEvent`, and `isPersonal` if the local player should see
  it immediately).
- **New level:** add a `LevelDef` under `packages/sim/src/level/levels/` and register it in
  `packages/sim/src/level/index.ts`. Boxes are shared by physics, the navmesh and the renderer.

## Commands

```bash
npm install
npm run dev          # client on http://localhost:3000 (solo works on its own)
npm run dev:server   # game server on :8787 (needed for online play; Vite proxies /ws)
npm run check        # format check, lint, typecheck, all tests: run before every commit
npm run test         # vitest in watch mode
npm run build        # production client + server bundle
npm start            # serve the built client and game server on :8787
```

## Testing

- Sim and room tests run the real Rapier and Recast WASM, not mocks.
- Every gameplay change needs a sim test; every protocol change needs a round-trip test.
- `packages/room` has bot tests that play full rounds over the wire protocol. If you change
  combat, rounds or netcode, they will tell you whether the game still plays.
- UI changes: run the app and look at it.
