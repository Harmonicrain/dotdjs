// server.cjs
// Dev:  started automatically by `npm run dev` (runs PeerJS on :9000)
// Prod: `npm start` (runs PeerJS + serves dist/ on :8080)
//
// The PeerJS path is always /peerjs — Vite proxies it in dev,
// Express serves it directly in prod. Both use the same URL so
// the client config never changes.

const express       = require('express');
const { ExpressPeerServer } = require('peer');
const path          = require('path');
const fs            = require('fs');
const http          = require('http');

const isProd = process.argv.includes('--prod');
const PORT   = isProd ? (process.env.PORT || 8080) : 9000;

const app    = express();
const server = http.createServer(app);

// ── PeerJS signalling server ──────────────────────────────────────────────────
const peerServer = ExpressPeerServer(server, {
    path:           '/peerjs',
    allow_discovery: false,          // Don't expose peer list publicly
    proxied:        isProd,          // Trust X-Forwarded-* in prod
});

app.use('/peerjs', peerServer);

peerServer.on('connection',    (client) => console.log(`[PeerJS] + ${client.getId()}`));
peerServer.on('disconnect',    (client) => console.log(`[PeerJS] - ${client.getId()}`));

// ── Static file serving (prod only) ──────────────────────────────────────────
if (isProd) {
    const dist = path.join(__dirname, 'dist');
    if (!fs.existsSync(dist)) {
        console.error('[Server] dist/ not found — run: npm run build');
        process.exit(1);
    }
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    console.log('[Server] Serving dist/');
}

server.listen(PORT, () => {
    if (isProd) {
        console.log(`\n[Server] Production ready → http://localhost:${PORT}`);
        console.log(`[PeerJS] Signalling      → http://localhost:${PORT}/peerjs\n`);
    } else {
        console.log(`\n[PeerJS] Dev signalling  → http://localhost:${PORT}/peerjs`);
        console.log(`[Vite]   Game            → http://localhost:3000\n`);
    }
});
