# MULTIPLAYER SYSTEM GUIDE

This document explains the Peer-to-Peer (P2P) multiplayer architecture of DOM OF THE ROAD, utilizing WebRTC via the PeerJS library.

---

## 1. WebRTC & PeerJS Overview

The game uses **PeerJS** to establish direct, low-latency WebRTC data channels between players.

### How it Works:
1.  **Signaling**: Before a direct connection can be made, players must find each other. This is handled by a **Signaling Server** (`0.peerjs.com` by default). The Host creates a Room ID, and the Client connects to that ID.
2.  **NAT Traversal**: Most players are behind routers (NAT). The system uses **STUN Servers** (provided by Google in `useMultiplayer.ts`) to discover public IP addresses.
3.  **Data Channel**: Once the handshake is complete, data is sent directly between browsers using **SCTP over UDP**. This is faster than standard HTTP/WebSockets because it avoids server hops.

---

## 2. Multiplayer Lifecycle

### A. The Lobby Phase (`ui/GameMenus.tsx` & `network/useMultiplayer.ts`)
- **Host**: Generates a 4-character Room ID. It listens for incoming connections.
- **Client**: Enters the Room ID and attempts to connect.
- **Handshake**: Once connected, the Client sends a `READY` message with their name. The Host acknowledges and waits for the "Start Game" button.
- **Heartbeat**: Every 2 seconds (`HEARTBEAT_INTERVAL`), both players send a `PING` message to ensure the connection is alive. This is handled in `useMultiplayer.ts`.

### B. Session Start (`game/GameLifecycle.ts`)
1.  Host clicks "Start".
2.  Host sends a `START_GAME` message with the `mapId`.
3.  Both players transition to the `GameScene`.
4.  `GAME_STARTED` event is emitted locally, resetting network caches and delta compressors.

---

## 3. Network Architecture (Authority)

The game uses a **Host-Authoritative** model with "Dumb Terminal" clients.

### The Host Role:
- **Authority**: Decides zombie spawns, round transitions, door states, and power-up drops.
- **Broadcast**: Sends a `STATE` packet every 50ms (20Hz).
- **Snapshot**: Includes the positions/states of all active zombies.

### The Client Role:
- **Prediction**: Moves locally for instant responsiveness.
- **Reporting**: Sends an `INPUT` packet every 50ms (20Hz) containing their position, rotation, health, and points.
- **Validation**: Receives the Host's `STATE` to sync world objects (doors, mystery box).

---

## 4. Interaction Flow (The Handshake)

Interaction is never instant for the Client. It follows this flow:
1.  **Client Request**: Player looks at a door and presses INTERACT.
2.  **Message Sent**: Client sends an `INTERACT_DOOR` message to the Host.
3.  **Host Process**: Host receives the message in `NetworkMessageHandler.ts`, validates if the player has enough points, and updates its local state (opening the door).
4.  **Broadcast Sync**: The Host's next `STATE` packet includes the updated door state.
5.  **Client Sync**: The Client receives the `STATE` and finally opens the door visually.

---

## 5. Tick Rate & Delta Compression

To save bandwidth, the game uses **Delta Compression** (`network/NetworkDeltaCompressor.ts`).

1.  **Fixed Tick**: `NetworkSystem.ts` only sends data every 50ms (`NETWORK_TICK_MS`).
2.  **Delta Encoding**: Instead of sending the full state every time, the compressor only sends fields that have **changed** since the last successful packet.
3.  **Full Sync**: Every 5 seconds (`FULL_SYNC_INTERVAL_MS`), a full snapshot is forced to correct any drift caused by packet loss.
4.  **Gap Detection**: Each packet has a sequence number (`_seq`). If a gap is detected, the receiver wipes its cache and waits for a full sync.

---

## 6. Movement Interpolation

Network packets arrive at 20Hz (every 50ms), but the game renders at 60Hz+. Directly applying positions would look jittery.

### `InterpolationBuffer.ts`
- **Buffering**: Received positions are pushed into a buffer with a timestamp.
- **Delayed Sampling**: The renderer samples the buffer at `(now - 100ms)`. 
- **Smoothing**: It finds the two snapshots bracketing that "past" time and **Lerps** (Linearly Interpolates) between them. This results in silky-smooth movement even with network jitter.

---

## 7. Game Over & Spectator States

- **Downed (DBNO)**: When health hits zero, the player enters the "downed" state (`PLAYER_DOWNED`).
- **Solo**: If a player bleeds out or dies without Quick Revive, `isGameOver` is set to `true`.
- **Multiplayer (Co-op)**:
  - If a player bleeds out, they enter **Spectator Mode** (`isSpectating = true`).
  - The `GameLoop.ts` handles camera logic for spectators, following the other player.
  - **Round Respawn**: At the end of a round, the Host sends a `RESPAWN` message to bring spectators back.
  - **Game Over**: If ALL players are either downed or spectating simultaneously, the Host sets `isGameOver = true` for everyone.

---

## 8. Message Types (`types/ui.ts`)

| Message Type | Direction | Logic |
|--------------|-----------|-------|
| `STATE` | Host → Client | Syncs zombies, doors, round, and host stats. |
| `INPUT` | Client → Host | Syncs client position, health, and points. |
| `SHOOT` | Both | Fired immediately for tracers and impact effects. |
| `INTERACT_*` | Client → Host | Request to open a door, buy a perk, or use the box. |
| `HIT_CONFIRM`| Both | Informs the other player of points earned from a hit. |
| `PLAYER_DOWNED` | Both | Alerts that a player has entered the DBNO state. |

---

## 9. Key File Locations

| File | Purpose |
|------|---------|
| `C:\ZOMBZ\network\useMultiplayer.ts` | PeerJS hook (heartbeats, PING/PONG, connection management). |
| `C:\ZOMBZ\systems\NetworkSystem.ts` | The 20Hz tick system that triggers sends. |
| `C:\ZOMBZ\network\NetworkMessageHandler.ts` | The giant switch-statement that processes incoming data. |
| `C:\ZOMBZ\network\NetworkDeltaCompressor.ts` | Logic for computing what has changed since the last packet. |
| `C:\ZOMBZ\network\InterpolationBuffer.ts` | The math for smoothing remote entity movement. |
| `C:\ZOMBZ\systems\RemotePlayerSystem.ts` | Applies interpolated poses to the other player's mesh. |

---

## 10. The "Never Forget" Checklist (FAIL-SAFE)

1.  **Authority Guarding**: If you implement logic that spawns an entity (like a zombie or projectile), always check: `if (gameModeRef.current === 'CLIENT') return;`. Only the Host should spawn authoritative objects.
2.  **Syncing State**: If a Client performs an action (like buying a door), they **MUST** send an `INTERACT_DOOR` message. They should NOT open the door locally; they wait for the Host to send back the updated door state in the next `STATE` packet.
3.  **Delta Field Registration**: If you add a new field to `CachedHostState` or `CachedClientState`, you **MUST** update `NetworkDeltaCompressor.ts` so it knows how to diff that field.
4.  **Sequence Gaps**: If you see jitter or "teleporting" after a lag spike, check the sequence number logic in `NetworkMessageHandler.ts`.
5.  **Event vs Tick**: Use **Events** (SHOOT) for one-time actions. Use **Ticks** (STATE/INPUT) for continuous data like position or health.
6.  **State Logic**: For syncing Perks or Powerups, see [perks.md](./perks.md) and [powerups.md](./powerups.md).
