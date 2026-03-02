# Networking & Multiplayer

**DOM OF THE DEAD** uses a Peer-to-Peer (P2P) architecture powered by **WebRTC** (via PeerJS).

## 📡 Topology

*   **Host-Client**: One player acts as the **Host** (Server) and the other as the **Client**.
*   **Authoritative Host**: The Host is responsible for:
    *   Zombie Spawning & AI.
    *   Game State (Round, Points, Door states).
    *   Damage verification.
    *   Power-up spawning.
*   **Client Prediction**: The client predicts their own movement but waits for the host to confirm kills and game state changes.

## 📦 Data Synchronization

### 1. Delta Compression
To reduce bandwidth, the `NetworkDeltaCompressor` compares the current state to the last sent state. Only changed values are transmitted.

*   **Full State**: Sent periodically (e.g., every 1 second) to ensure sync.
*   **Delta State**: Sent every tick (e.g., 15-30 times per second).

### 2. Message Types
*   `STATE`: Game state updates (positions, health, round, points).
*   `INTERACT_*`: Interaction events (door open, weapon pickup).
*   `SHOOT`: Fire weapon events.
*   `ZOMBIE_*`: Zombie spawn/death events.
*   `POWERUP_*`: Power-up spawn/pickup events.
*   `REVIVE_*`: Revive events.

### 3. Interpolation
The `NetworkSystem` buffers incoming position updates for remote entities (other players, zombies). It interpolates between these buffered snapshots to render smooth movement, even if the network has jitter.

## 🛠️ Connection Flow (`useMultiplayer.ts`)

1.  **Host Init**: Host generates a random Room ID and connects to PeerServer.
2.  **Sharing**: Host sends the Room ID to a friend.
3.  **Client Join**: Client enters the ID and connects to the Host's Peer ID.
4.  **Handshake**: Host sends initial `GAME_STATE`.
5.  **Loop**: Continuous two-way data stream begins.

## 🔄 State Synchronization

### Host Responsibilities
*   Running the authoritative game simulation
*   Managing zombie AI and spawning
*   Processing damage and kills
*   Tracking round progression
*   Synchronizing door/window states
*   Managing power-up drops

### Client Responsibilities
*   Sending input (movement, shooting, interactions)
*   Rendering the game state received from host
*   Local prediction for immediate feedback

### Networked Values
*   Player positions and rotations
*   Active weapon and ammo
*   Health and points
*   Zombie positions and states
*   Door states (open/closed)
*   Window barrier states (boards remaining)
*   Perk ownership
*   Power state (on/off)
*   Round number and zombie counts
*   Mystery box state
*   Active power-ups and their timers
