# DOM OF THE DEAD

A browser-based, round-based zombie survival FPS for one to four players. Hold out in the
Proving Grounds as the dead climb out of the earth, wave after wave.

> **Status: rebuild in progress.** The original prototype lives in [`legacy/`](legacy/) for
> reference. This is a ground-up rebuild with working online co-op. Milestones 0 and 1 are
> playable now; see the [rebuild plan](docs/REBUILD_PLAN.md) for what's next.

## Play it locally

Requires Node 22+.

```bash
npm install
npm run dev            # http://localhost:3000 — solo works straight away
npm run dev:server     # in a second terminal, for online games
```

Pick **Host Online Game** to get a four-letter room code; friends pick **Join With Code**.
Up to four players per room.

**Controls:** WASD move · mouse look · left click fire · right click aim · R reload · Shift sprint ·
Space jump · 1–3 or wheel switch weapons · Tab scores · Esc pause. Standard gamepads work too.

## How it's built

```
┌──────────── browser ────────────┐        ┌──────── Node server ────────┐
│ React HUD + menus               │        │ WebSocket host, room codes  │
│ Three.js renderer               │  binary │  ┌───────────────────────┐  │
│ Input → prediction (sim)  ──────┼─inputs─▶│  │ Room (authoritative)  │  │
│ Interpolation ◀─────────────────┼snapshot─┤  │  └─ World (sim)        │  │
│                                 │  20 Hz  │  └───────────────────────┘  │
│ Solo: the same Room in a Worker │        └─────────────────────────────┘
└─────────────────────────────────┘
```

- **One simulation** (`packages/sim`) runs on the server, inside the solo Worker, and for
  client-side prediction. It is deterministic and has no DOM or rendering code.
- **Server authoritative:** clients only send inputs. The room simulates at 60 Hz and sends full,
  quantized snapshots at 20 Hz (~0.5 KB with four players and 24 zombies).
- **Responsive:** your own movement and shots are predicted instantly and reconciled against the
  server. Shots are lag-compensated, so zombies are checked where you saw them.

| Package | Purpose |
| --- | --- |
| `packages/sim` | Movement (Rapier), weapons, zombies (Recast crowd), rounds, levels |
| `packages/protocol` | Binary message codec |
| `packages/room` | Authoritative room: inputs in, snapshots out |
| `apps/server` | WebSocket host with room codes; serves the built client |
| `apps/client` | Three.js + React client, prediction and interpolation |

## Development

```bash
npm run check    # format check + lint + typecheck + tests (what CI runs, plus the build)
npm run build    # production client and server bundle
npm start        # run the built server, which also serves the client, on :8787
```

Read [AGENTS.md](AGENTS.md) before changing code: it lists the rules that keep the architecture
clean.

## Credits and licensing

The rebuild currently uses no third-party art or sound: geometry, textures and audio are
generated in code. The perk, weapon and power-up names are placeholders borrowed from the genre
and will need original replacements before any public release. Models in `legacy/` carry
their own (mixed, partly non-commercial) licences and are not used by the new build.
