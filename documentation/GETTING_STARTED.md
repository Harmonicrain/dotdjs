# Getting Started

This guide will help you set up the **DOM OF THE DEAD** development environment on your local machine.

## 📋 Prerequisites

*   **Node.js**: Version 18.0.0 or higher is recommended.
*   **npm**: usually comes with Node.js.
*   **Git**: For version control.

## 📥 Installation

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd ZOMBZ
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```
    *This will install React, Babylon.js, Vite, and other necessary packages.*

## 🏃 Running the Game

### Development Mode
To start the local development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

*   The game will be accessible at `http://localhost:5173` (or another port if taken).
*   Changes to UI code will reflect immediately.
*   Changes to Game Engine code may require a page reload (F5) to fully reset the WebGL context.

### Production Build
To build the project for deployment:

```bash
npm run build
```
This creates a `dist/` folder with optimized assets.

To preview the production build locally:
```bash
npm run preview
```

## 🧪 Testing

### Singleplayer
Simply start the game and select "Solo" from the menu.

### Multiplayer
1.  One player selects "Host" to create a room.
2.  Share the Room ID with a friend.
3.  Friend selects "Join" and enters the Room ID.

## 🎮 Controls

*   **WASD**: Move
*   **Mouse**: Look around
*   **Left Click**: Fire weapon
*   **Right Click**: Aim down sights
*   **R**: Reload
*   **F**: Interact (open doors, buy weapons, etc.)
*   **1-2**: Switch weapons
*   **Space**: Jump
*   **Shift**: Sprint
*   **Tab**: Toggle debug console

## 🐞 Console Commands

Open the debug console with `Tab` and enter commands:

*   `/debug` - Toggle debug mode
*   `/pos` - Show player position
*   `/tp <x> <y> <z>` - Teleport
*   `/points <amt>` - Add points
*   `/give <weapon_id>` - Give weapon (pistol, rifle, shotgun, smg, sniper, launcher)
*   `/ammo` - Refill ammo
*   `/round <n>` - Set round
*   `/kill_all` - Kill all zombies
*   `/powerup <type>` - Spawn powerup (instakill, max_ammo, double_points, nuke, carpenter)
*   `/god` - Toggle god mode
*   `/noclip` - Toggle noclip mode

## 🌐 Networking Setup (Optional)

By default, the game uses the public PeerJS cloud server (`0.peerjs.com`) for signaling. This works out of the box for most users.

However, for lower latency development or offline testing, you can run a local PeerServer.

1.  **Start the PeerServer**
    ```bash
    node peerserver.cjs
    ```
    *This starts a signaling server on port 9000.*

2.  **Configure the Client**
    You will need to modify `network/useMultiplayer.ts` to point to `localhost:9000` instead of the public cloud.
    *(Note: The current codebase defaults to the public cloud for ease of use).*

## 🎵 Audio

Sounds are loaded from `public/sounds/`:
*   `weapons/` - Weapon fire sounds (e.g., `m1911.mp3`)
*   `powerups/` - Power-up pickup sounds (e.g., `instakill.mp3`, `nuke.mp3`)
*   `power.mp3` - Power activation sound

## 🐛 Troubleshooting common issues

*   **"Recast is not defined"**: Ensure the `recast.js` file is properly loading. It is usually fetched from a CDN or included in the `public/` folder.
*   **WebGL Context Lost**: If you save too many times in rapid succession, the browser might kill the WebGL context. Refresh the page manually.
*   **Audio Context Warnings**: Browsers require user interaction (click) before playing audio. The game handles this with a "Click to Start" overlay.
*   **Sound not playing**: Check browser console for SoundManager logs. Ensure audio files are in the correct path and the audio engine is enabled.
