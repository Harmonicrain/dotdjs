# MULTIPLAYER SYSTEM GUIDE

This document is a comprehensive reference for the Peer-to-Peer (P2P) multiplayer architecture of DOM OF THE DEAD, built on WebRTC via the PeerJS library.

---

## 1. Architecture Overview

The game uses a **Host-Authoritative P2P** model with three game modes:

| Mode | Role |
|------|------|
| `SOLO` | No networking. All game logic runs locally. |
| `HOST` | Authoritative player. Runs all game logic (zombie spawning, round progression, door states, power-ups). Broadcasts state to the CLIENT at 20 Hz. |
| `CLIENT` | "Dumb terminal". Sends its input (position, stats) to the HOST at 20 Hz. Receives the HOST's authoritative game state and renders it locally. Moves locally for instant responsiveness. |

### Connection Layer

Players connect directly via **WebRTC data channels** (SCTP over UDP). No game data passes through a server after the initial handshake.

1. **Signaling**: A PeerJS signaling server (`0.peerjs.com` cloud, or local `peerserver.cjs`) brokers the initial handshake so peers can discover each other.
2. **NAT Traversal**: Public **STUN servers** (Google, Twilio) help players behind routers discover their public IPs.
3. **Data Channel**: Once established, all game messages flow directly between browsers with minimal latency.

---

## 2. Key Files

| File | Purpose |
|------|---------|
| `network/useMultiplayer.ts` | React hook — PeerJS connection lifecycle, heartbeats, PING/PONG, error handling. |
| `systems/NetworkSystem.ts` | ECS system — 20 Hz tick that captures game state and sends STATE or INPUT via delta compression. |
| `network/NetworkMessageHandler.ts` | Receiver — processes every incoming `GameMessage`, merges deltas into cached state, emits events to game systems. |
| `network/NetworkDeltaCompressor.ts` | Delta encoder — compares current state to last-sent snapshot, sends only changed fields. |
| `network/InterpolationBuffer.ts` | Smoother — buffers received poses and interpolates between them so remote players render at 60 Hz. |
| `systems/RemotePlayerSystem.ts` | ECS system — reads interpolated poses from the buffer and applies them to the remote player mesh every frame. |
| `systems/ZombieSyncSystem.ts` | ECS system — CLIENT-only. Subscribes to `NET_GAME_STATE_UPDATE` and reconciles local zombie meshes with HOST-broadcast positions. |
| `ui/GameScene.tsx` | React component — wires the `useMultiplayer` hook to the game engine via `createNetworkMessageHandler`. |
| `config/gameplay.ts` | Config — `SYNC_CONFIG` constants (tick rate, full sync interval, interpolation buffer delay, precision). |
| `types/ui.ts` | Types — `GameMessage` union type defining every network message schema. |
| `peerserver.cjs` | Dev-only PeerJS signaling server (port 9000). |
| `server.cjs` | Production server — Express serves `dist/` and embeds PeerJS signaling on port 8080. |

---

## 3. Connection Lifecycle

### A. Lobby Phase

**Host Flow** (`useMultiplayer.ts` → `initializeHost`):
1. Generates a random 6-character Room ID (e.g., `"ABC123"`).
2. Creates a PeerJS `Peer` with that ID as its peer name.
3. Sets status to `"WAITING..."` and listens for incoming `connection` events.
4. When a client connects, the data channel opens and status becomes `"CONNECTED"`.
5. A heartbeat (`PING` every 2 seconds) starts immediately.

**Client Flow** (`useMultiplayer.ts` → `initializeClient`):
1. Takes the host's Room ID as input.
2. Creates a PeerJS `Peer` with a random 8-character client ID.
3. Calls `peer.connect(hostId, { serialization: 'json' })`.
4. Sets status to `"SEEKING..."` → `"CONNECTING..."` → `"CONNECTED"`.
5. A 15-second timeout fires if the connection never opens (NAT/firewall issues).
6. Once connected, the UI prompts the client to send a `READY` message with their player name.

**Handshake Sequence:**
```
CLIENT                          HOST
  │                               │
  │── peer.connect(hostId) ──────►│  connection event fires
  │                               │
  │◄──── data channel open ──────►│  both sides: CONNECTED
  │                               │
  │── { type: 'READY',           │
  │     name: 'Player2' } ──────►│  HOST stores client name,
  │                               │  enables "Start" button
  │                               │
  │  (Host clicks Start)          │
  │◄── { type: 'START_GAME',     │
  │      mapId: 'warehouse' } ───│  CLIENT loads map
  │                               │
  │  ══ GAME LOOP BEGINS ════════╪═══════════════════════
  │                               │
  │── INPUT (20 Hz) ─────────────►│  CLIENT position/stats
  │◄── STATE (20 Hz) ────────────│  HOST game state
```

### B. Connection States

| Status | Meaning |
|--------|---------|
| `DISCONNECTED` | No active connection |
| `WAITING...` | Host is waiting for a client |
| `SEEKING...` | Client is looking for the host |
| `CONNECTING...` | WebRTC handshake in progress |
| `CONNECTED` | Data channel open, game can start |
| `RECONNECTING...` | Benign network hiccup, retrying |
| `RETRYING...` | ICE connection failed/disconnected |
| `TIMEOUT - NAT/Firewall blocked` | Connection timed out (15s) |
| `HOST NOT FOUND` | Peer ID doesn't exist |
| `ERR: ID Taken` | Room ID collision |
| `ERR: WEBRTC` | WebRTC negotiation failed |
| `ERR: BROWSER` | Browser doesn't support WebRTC |
| `ERR: BANNED/403` | Server rejected connection |
| `ERR: SERVER 404` | Signaling server not found |

### C. Error Recovery

- **Benign errors** (`network`, `server-error`, `socket-error`, `socket-closed`, `peer-timeout`): Status set to `"RECONNECTING..."`, PeerJS auto-reconnects to the signaling server after 3 seconds.
- **Critical errors** (`unavailable-id`, `peer-unavailable`, `browser-incompatible`, `webrtc`): Displayed to the user; requires manual retry.
- **ICE failures**: Logged and status set to `"RETRYING..."`. The underlying WebRTC stack may recover automatically.

### D. Cleanup

`cleanup()` is called on disconnect, quit-to-menu, or component unmount:
1. Stop heartbeat timer.
2. Cancel connection timeout.
3. Close data connection.
4. Destroy PeerJS peer (removes all listeners).
5. Reset status to `"DISCONNECTED"`.

---

## 4. Authority Model

### What the HOST Controls

The HOST is the **single source of truth** for:

- Zombie spawning, AI, pathfinding, health, and death
- Round transitions (when all zombies are killed, advance to next round)
- Door states (which doors are open/closed)
- Window barrier board states
- Power switch state (`powerOn`)
- Mystery box state machine (idle → rolling → weapon → closing)
- Power-up drops (random spawn on zombie death)
- Player respawning at end of round

### What the CLIENT Controls

The CLIENT is authoritative only for its own **local movement and camera**. Everything else it reports to the HOST (health, points, perks, kills), but the HOST trusts these values without validation (see known issues in `refactor-multiplayer.md`).

### Authority Guard Pattern

Every system that spawns entities or modifies authoritative state must early-return for non-authority roles:

```typescript
if (ctx.gameModeRef.current === 'CLIENT') return;
```

This prevents the CLIENT from spawning its own zombies, opening doors locally, or progressing rounds.

---

## 5. Tick System (20 Hz)

### NetworkSystem (`systems/NetworkSystem.ts`)

This ECS system runs every frame but gates its sends to a fixed 20 Hz tick:

```typescript
if (now - lastSendRef.current <= SYNC_CONFIG.NETWORK_TICK_MS) return;  // 50ms gate
lastSendRef.current = now;
```

**HOST path** — builds a full state snapshot from live game data:
- Camera position → `hostPos`
- `gameState.doorStates` → `doors`
- `gameState.health/points/kills/...` → host player stats
- `ctx.zombies[]` → zombie positions (read from mesh positions)
- `ctx.windows[]` → window board bitmasks
- `ctx.mysteryBox` → mystery box state
- Passes everything to `NetworkDeltaCompressor.computeHostDelta()`

**CLIENT path** — builds a minimal input snapshot:
- Camera position → `pos`
- `gameState.health/points/kills/...` → client player stats
- Passes to `NetworkDeltaCompressor.computeClientDelta()`

Both paths produce a delta-compressed `GameMessage` that is sent via `ctx.send()`.

### Window Board Bitmasks

Window barrier boards are encoded as a 6-bit bitmask per window (one bit per board, `1` = enabled/visible):

```typescript
let mask = 0;
w.boards.forEach((b, idx) => {
    if (b.isEnabled()) mask |= (1 << idx);
});
windowStatesCache[w.id] = mask;
```

The cache is only rebuilt when the `BOARD_STATE_CHANGE` event fires (dirty flag optimization).

### Zombie Snapshot

Zombie positions are read directly from mesh positions each tick:
```typescript
s.id = z.id;
s.type = z.type;
s.x = z.mesh.position.x;
s.y = z.mesh.position.y;
s.z = z.mesh.position.z;
s.rot = z.mesh.rotation.y;
s.isBurning = z.isBurning;
```

The compressor only includes zombies that moved more than `ZOMBIE_POSITION_THRESHOLD` (5cm) since the last tick.

---

## 6. Message Protocol

All messages conform to the `GameMessage` union type defined in `types/ui.ts`.

### Tick Messages (sent every 50ms)

**STATE** (HOST → CLIENT):
```typescript
{
    type: 'STATE',
    _seq: number,            // Sequence number for gap detection
    _full?: boolean,         // True on forced full sync (every 5s)

    // Host player
    hostPos: { x, y, z, rot, pitch },
    hostHealth: number,
    hostPoints: number,
    hostTotalEarned: number,
    hostName: string,
    hostPerks: Record<string, boolean>,
    hostIsDowned: boolean,
    hostKills: number,
    hostShots: number,
    activeWeaponIndex: number,
    activeWeaponId: string,

    // World state
    doors: Record<string, DoorState>,
    windowStates: Record<string, number>,  // Bitmask per window
    powerOn: boolean,

    // Zombies
    zombies: ZombieSyncData[],        // Changed/new zombies only (delta) or all (full)
    removedZombieIds: string[],       // IDs of zombies killed since last tick
    activeZombiesCount: number,
    totalRoundZombies: number,
    zombiesSpawned: number,
    zombiesKilledInRound: number,
    round: number,
    isDogRound: boolean,

    // Power-ups & Mystery Box
    activePowerUps: PowerUpType[],
    mysteryBox: {
        state: number,
        locIndex: number,
        lidAngle: number,
        weaponId: string | null,
        rollIndex: number,
        owner: string | null,
    },
}
```

**INPUT** (CLIENT → HOST):
```typescript
{
    type: 'INPUT',
    _seq: number,
    _full?: boolean,

    pos: { x, y, z, rot, pitch },
    activeWeaponIndex: number,
    activeWeaponId: string,
    clientHealth: number,
    clientPoints: number,
    clientTotalEarned: number,
    clientPerks: Record<string, boolean>,
    clientIsDowned: boolean,
    clientName: string,
    clientKills: number,
    clientShots: number,
}
```

### Event Messages (sent immediately, not tick-gated)

| Type | Direction | Fields | Purpose |
|------|-----------|--------|---------|
| `READY` | Client → Host | `name` | Client announces presence and name |
| `START_GAME` | Host → Client | `mapId` | Host starts the game session |
| `PING` | Both | *(none)* | Heartbeat (filtered out before handler) |
| `SHOOT` | Both | `origin`, `dir`, `isPacked?`, `isExplosive?`, `damage` | Render remote player's shot (tracer + impact) |
| `INTERACT_DOOR` | Client → Host | `doorId` | Request to open a door |
| `INTERACT_POWER` | Client → Host | *(none)* | Request to toggle power |
| `INTERACT_WINDOW` | Client → Host | `targetId` | Request to repair a window board |
| `INTERACT_BOX` | Client → Host | `playerName?` | Request mystery box interaction |
| `INTERACT_BOX_START` | Client → Host | `playerName` | Start box roll |
| `INTERACT_BOX_TAKE` | Client → Host | `playerName` | Take weapon from box |
| `SPAWN_POWERUP` | Host → Client | `id`, `pType`, `x`, `y`, `z` | Spawn a power-up in the world |
| `ACTIVATE_POWERUP_EFFECT` | Host → Client | `pType` | Apply power-up effect |
| `HIT_CONFIRM` | Both | `amount` | Award points for a hit/kill |
| `RESPAWN` | Host → Client | `round`, `points` | Respawn spectating player at round end |
| `PLAYER_DOWNED` | Both | `playerName`, `position` | Player entered DBNO state |
| `REVIVE_START` | Both | `revivorName`, `downedPlayerName` | Revive attempt started |
| `REVIVE_CANCEL` | Both | `revivorName` | Revive attempt cancelled |
| `REVIVE_COMPLETE` | Both | `revivorName`, `downedPlayerName` | Revive successful |
| `SELF_REVIVE` | Both | `playerName` | Player self-revived (Quick Revive perk) |

---

## 7. Delta Compression

### NetworkDeltaCompressor (`network/NetworkDeltaCompressor.ts`)

The compressor tracks the last-sent snapshot and produces minimal delta messages.

**Two paths per tick:**

1. **Full Sync** — forced when:
   - First packet ever (no previous snapshot)
   - Timer exceeds `FULL_SYNC_INTERVAL_MS` (5000ms)

   Sends every field. The receiver gets a complete picture and can reset its cache.

2. **Delta** — the normal path:
   - Compares each field to the last-sent snapshot
   - Only includes fields whose values changed
   - Position values are rounded to `FLOAT_PRECISION` (2 decimal places = 1cm) before comparison

**Sequence Numbers:**
- Every packet gets an incrementing `_seq` number
- The receiver detects gaps: if `seq > lastSeq + 1` and the packet is NOT a full sync, the delta chain is broken
- On gap: receiver resets its cached state to defaults and waits for the next full sync (max 5 seconds)

**Zombie Delta Algorithm:**
```
For each zombie in the current frame:
  - If zombie is NEW (not in last snapshot) → include it
  - If zombie MOVED more than 5cm (ZOMBIE_POSITION_THRESHOLD) → include it
  - If zombie's isBurning state changed → include it
  - Otherwise → skip it (save bandwidth)

For each zombie in last snapshot but NOT in current frame:
  - Add its ID to removedZombieIds[]
```

**Object Comparisons:**
- Doors: deep-compare `isOpen` flags
- Perks: deep-compare boolean maps
- Windows: deep-compare bitmask integers
- PowerUps: array comparison
- MysteryBox: field-by-field scalar comparison

### Precision Rounding

All float values are rounded before comparison and sending:
```typescript
const MULT = Math.pow(10, SYNC_CONFIG.FLOAT_PRECISION);  // 100
function rnd(v: number): number {
    return Math.round(v * MULT) / MULT;  // e.g., 3.14159 → 3.14
}
```

This prevents unnecessary deltas from floating-point jitter.

---

## 8. Message Handling (Receiver)

### NetworkMessageHandler (`network/NetworkMessageHandler.ts`)

Created once per session via `createNetworkMessageHandler(stateManager, actions)`.

**Maintains two caches:**
- `cachedHost: CachedHostState` — merged view of all HOST STATE messages received
- `cachedClient: CachedClientState` — merged view of all CLIENT INPUT messages received

**On `GAME_STARTED` event:** both caches and sequence counters are reset.

### STATE Processing (CLIENT receives from HOST)

1. **Gap detection**: if `seq > lastHostSeq + 1` and not a full sync, reset `cachedHost` to defaults.
2. **Merge delta**: use `mergeIfDefined()` to copy only defined fields from the incoming message into `cachedHost`.
3. **Zombie reconciliation**:
   - Full sync (`_full: true`): replace `cachedHost.zombies` entirely.
   - Delta: remove dead zombies by ID, then upsert changed/new zombies by ID.
4. **Sync remote player**: push HOST position into `InterpolationBuffer`, update health/perks/kills.
5. **Emit events**:
   - `NET_GAME_STATE_UPDATE` with the fully-merged `cachedHost` — consumed by `ZombieSyncSystem` and other systems.
   - Update Zustand store with round info, zombie counts, power state.

### INPUT Processing (HOST receives from CLIENT)

1. **Gap detection**: same logic as STATE.
2. **Merge delta**: `mergeIfDefined()` into `cachedClient`.
3. **Sync remote player**: push CLIENT position into `InterpolationBuffer`, update stats.
4. **Emit**: `NET_CLIENT_INPUT` with merged `cachedClient`.

### Event Message Processing

Event messages are dispatched immediately via the EventBus:

| Message | EventBus Event | Effect |
|---------|---------------|--------|
| `SHOOT` | `REMOTE_SHOOT` | ProjectileSystem creates a remote tracer |
| `INTERACT_DOOR` | `DOOR_OPEN_REQUEST` | HOST validates and opens the door |
| `INTERACT_POWER` | `POWER_ON_REQUEST` | HOST toggles power |
| `INTERACT_WINDOW` | *(direct)* | Re-enables the first disabled board mesh |
| `INTERACT_BOX*` | *(direct)* | Calls `mysteryBoxSystem.interact()` |
| `SPAWN_POWERUP` | *(direct)* | Pushes to `gameState.pendingPowerUps[]` |
| `HIT_CONFIRM` | *(direct)* | Calls `stateManager.addPoints()` |
| `PLAYER_DOWNED` | *(direct)* | Sets `remote.gameState.isDowned = true`, shows HUD message |
| `REVIVE_*` | `REVIVE_EVENT` | ReviveSystem processes the state change |
| `RESPAWN` | `RESPAWN_REQUEST` | Respawns player, clears spectator mode |

---

## 9. Interpolation Buffer

### InterpolationBuffer (`network/InterpolationBuffer.ts`)

**Problem**: Network packets arrive at 20 Hz (every 50ms), but the game renders at 60 Hz+. Directly applying positions causes visible "teleporting" every 50ms.

**Solution**: Buffer received poses and sample them with a fixed delay, interpolating between bracketing snapshots.

**Configuration:**
- Buffer capacity: 120 snapshots (~6 seconds of history at 20 Hz)
- Interpolation delay: `INTERPOLATION_BUFFER_MS` = 100ms
- Stale snapshot cleanup: discard snapshots older than 200ms (2× buffer delay)

**Algorithm** (on each render frame):
```
target = now - 100ms

if no data → return null
if only one snapshot → return it
if target < oldest snapshot → clamp to oldest
if target > newest snapshot → hold newest (buffer draining)

Binary search for the two snapshots bracketing target time:
  before = snapshot just before target
  after  = snapshot just after target
  t = (target - before.timestamp) / (after.timestamp - before.timestamp)

return {
    x:     lerp(before.x, after.x, t),
    y:     lerp(before.y, after.y, t),
    z:     lerp(before.z, after.z, t),
    rotY:  lerpAngle(before.rotY, after.rotY, t),   // handles ±π wrap
    pitch: lerp(before.pitch, after.pitch, t),
}
```

**`lerpAngle`** handles the rotation wrap-around discontinuity at ±π so a rotation from 3.1 to −3.1 goes the short way (~0.08 rad) instead of the long way (~6.2 rad).

---

## 10. Remote Player Rendering

### RemotePlayerSystem (`systems/RemotePlayerSystem.ts`)

Runs every frame (not tick-gated). Reads the interpolated pose from the buffer and applies it to the remote player's visual mesh hierarchy.

```typescript
const pose = ctx.remote.interpolationBuffer.sample(now);

// Camera position is at eye height (~1.65m above feet),
// so the root mesh (at foot level) needs a downward offset.
_tempTargetPos.copyFromFloats(pose.x, pose.y - PLAYER_EYE_HEIGHT, pose.z);

// Gentle lerp (factor 0.5) to absorb sub-frame residual jitter
remoteVisual.root.position = Vector3.Lerp(root.position, _tempTargetPos, 0.5);

// Rotation applied directly from interpolated values
remoteVisual.root.rotation.y = pose.rotY;           // Yaw
remoteVisual.armsContainer.rotation.x = pose.pitch;  // Pitch (aim up/down)
```

In `SOLO` mode, the remote player mesh is disabled (`root.setEnabled(false)`) and the system returns early.

---

## 11. Zombie Sync (CLIENT-only)

### ZombieSyncSystem (`systems/ZombieSyncSystem.ts`)

The CLIENT does not run zombie AI (ZombieAISystem early-returns for `CLIENT` mode). Instead, `ZombieSyncSystem` subscribes to the `NET_GAME_STATE_UPDATE` event and reconciles the local `sm.zombies[]` array with HOST-broadcast data.

**On each `NET_GAME_STATE_UPDATE`:**

1. **Remove** — any local zombie whose ID is no longer in the HOST's list:
   - Mark `isDead = true`
   - Dispose mesh, head mesh, fire particle system
   - Splice from `sm.zombies[]`

2. **Update** — any local zombie whose ID exists in both lists:
   - Set `mesh.position` to the broadcast `(x, y, z)`
   - Set `mesh.rotation.y` to broadcast `rot`
   - Update `isBurning` flag

3. **Spawn** — any zombie ID in the HOST's list that doesn't exist locally:
   - Create mesh via `createZombieMesh()` or `createHellhoundMesh()`
   - Initialize a full `Zombie` entity with broadcast position
   - Push to `sm.zombies[]`

ZombieAnimationSystem then drives walk/attack/idle animations on these network-spawned zombies.

---

## 12. React Integration

### GameScene (`ui/GameScene.tsx`)

The top-level React component wires the network layer to the game engine.

**Initialization Flow:**
1. `useMultiplayer` hook is created with two callbacks:
   - `onDataReceived` — lazily creates the `NetworkMessageHandler` (needs `StateManager` to exist first) and forwards all messages to it.
   - `onConnectionOpened` — currently unused.
2. `GameLifecycle` is created and initialized with the canvas, the `send` function from `useMultiplayer`, and Zustand update functions.
3. The `NetworkMessageHandler` is re-created whenever `hasStarted` changes (to ensure fresh `stateManager` reference).

**Menu Integration:**
```
GameMenuManager
  ├── "Solo" button     → startGame('SOLO', mapId, name)
  ├── "Host" button     → initializeHost()
  │   └── "Start" btn   → startGame('HOST', mapId, name) + send({ type: 'START_GAME', mapId })
  └── "Join" button     → initializeClient(hostId)
      └── "Ready" btn   → send({ type: 'READY', name })
```

**Zustand Store Bridge (`store/useGameStore.ts`):**

The Zustand store acts as a React-facing mirror of game state, with three slices:
- `PlayerFields` — health, points, ammo, perks, kills (local player HUD)
- `GameFields` — round, connectionStatus, gameMode, powerOn, activePowerUps
- `RemoteFields` — remotePlayerName, remoteHealth, remoteKills, remoteShots

The `NetworkMessageHandler` updates these slices via the `actions` parameter so the React HUD stays in sync without directly coupling to the game engine.

---

## 13. Configuration

### SYNC_CONFIG (`config/gameplay.ts`)

```typescript
export const SYNC_CONFIG = {
    // Zombie physics (not networking)
    INTERPOLATION_SPEED: 0.5,
    ZOMBIE_SEPARATION_FORCE: 0.8,
    ZOMBIE_SEPARATION_DIST: 1.0,
    ZOMBIE_BOTTLENECK_FORCE: 0.1,

    // Network tick
    NETWORK_TICK_MS: 50,               // 20 Hz send rate
    FULL_SYNC_INTERVAL_MS: 5000,       // Force full snapshot every 5 seconds
    ZOMBIE_POSITION_THRESHOLD: 0.05,   // Only send zombie if moved >5cm
    FLOAT_PRECISION: 2,                // Round to 2 decimal places (1cm)
    INTERPOLATION_BUFFER_MS: 100,      // Render 100ms behind network time
};
```

### PeerJS Config (in `useMultiplayer.ts`)

```typescript
{
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
        ],
        sdpSemantics: 'unified-plan',
        iceTransportPolicy: 'all',
    },
}
```

### Heartbeat

- Interval: 2000ms (`HEARTBEAT_INTERVAL`)
- Connection timeout: 15000ms (`CONNECTION_TIMEOUT_MS`)

---

## 14. Development & Testing

### Local Development

```bash
# Terminal 1: PeerJS signaling server
node peerserver.cjs
# Runs at http://localhost:9000/peerjs

# Terminal 2: Vite dev server
npm run dev
# Runs at http://localhost:3000

# Browser 1: http://localhost:3000
# Click "Host Game" → note the Room ID

# Browser 2: http://localhost:3000
# Click "Join Game" → enter the Room ID → click "Ready"

# Browser 1: Click "Start Game"
# Both players are now in-game syncing at 20 Hz
```

### Production

```bash
npm run build
node server.cjs --prod
# Serves dist/ + PeerJS signaling on port 8080
```

The production server uses `ExpressPeerServer` with `allow_discovery: false` (don't expose peer list) and `proxied: true` for reverse proxy compatibility.

---

## 15. Data Flow Diagram

```
┌──────────────────────┐                         ┌──────────────────────┐
│     HOST BROWSER     │                         │    CLIENT BROWSER    │
│                      │                         │                      │
│  Game Loop (60 Hz)   │                         │  Game Loop (60 Hz)   │
│       │              │                         │       │              │
│  NetworkSystem       │   WebRTC Data Channel   │  NetworkSystem       │
│  (gated to 20 Hz)    │◄═══════════════════════►│  (gated to 20 Hz)    │
│       │              │                         │       │              │
│  DeltaCompressor     │                         │  DeltaCompressor     │
│  computeHostDelta()  │  ── STATE (delta) ────► │  computeClientDelta()│
│                      │  ◄── INPUT (delta) ──── │                      │
│       │              │                         │       │              │
│  MessageHandler      │                         │  MessageHandler      │
│  (processes INPUT)   │                         │  (processes STATE)   │
│       │              │                         │       │              │
│  InterpolationBuffer │                         │  InterpolationBuffer │
│  (client position)   │                         │  (host position)     │
│       │              │                         │       │              │
│  RemotePlayerSystem  │                         │  RemotePlayerSystem  │
│  (renders client)    │                         │  (renders host)      │
│                      │                         │       │              │
│  ZombieAISystem      │                         │  ZombieSyncSystem    │
│  (runs AI locally)   │                         │  (syncs from STATE)  │
└──────────────────────┘                         └──────────────────────┘
         │                                                │
         └──────────── PeerJS Signaling Server ───────────┘
                    (initial handshake only)
```

---

## 16. The "Never Forget" Checklist

1. **Authority Guarding**: If you implement logic that spawns entities (zombies, projectiles, power-ups), always check: `if (gameModeRef.current === 'CLIENT') return;`. Only the HOST spawns authoritative objects.

2. **Syncing State**: If a CLIENT performs an action (buying a door, using a perk machine), it **MUST** send an `INTERACT_*` message to the HOST. The CLIENT should NOT modify world state locally; it waits for the HOST to reflect the change in the next `STATE` packet.

3. **Delta Field Registration**: If you add a new field to `CachedHostState` or `CachedClientState`, you **MUST** also:
   - Add it to the `mergeIfDefined()` call in `NetworkMessageHandler.ts`
   - Add comparison + snapshot logic in `NetworkDeltaCompressor.ts`
   - Add it to the full-sync path in the compressor

4. **Sequence Gaps**: If you see jitter or "teleporting" after a lag spike, check the sequence number logic in `NetworkMessageHandler.ts`. A gap resets the cache and waits for the next full sync (up to 5 seconds).

5. **Event vs Tick**: Use **Events** (`SHOOT`, `INTERACT_*`, `PLAYER_DOWNED`) for one-time actions that need immediate delivery. Use **Ticks** (`STATE`/`INPUT`) for continuous data like position, health, or round state.

6. **Interpolation**: Remote player positions are rendered 100ms behind real-time. This is intentional — it gives the buffer room to absorb network jitter. Don't "fix" the delay.

7. **State Logic**: For syncing Perks or Powerups, see [perks.md](./perks.md) and [powerups.md](./powerups.md).

8. **Known Issues**: See `refactor-multiplayer.md` for documented architectural issues including missing HOST-side validation, race conditions, and state sync gaps.
