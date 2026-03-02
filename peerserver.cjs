// Local PeerJS signaling server - run with: node peerserver.cjs
const { PeerServer } = require('peer');

const server = PeerServer({ 
    port: 9000, 
    path: '/peerjs',
    allow_discovery: true,
});

server.on('connection', (client) => {
    console.log(`[PeerServer] Client connected: ${client.getId()}`);
});

server.on('disconnect', (client) => {
    console.log(`[PeerServer] Client disconnected: ${client.getId()}`);
});

console.log('[PeerServer] Running on http://localhost:9000/peerjs');
console.log('[PeerServer] Start your Vite dev server separately: npm run dev');
