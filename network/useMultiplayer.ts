
import { useState, useRef, useEffect, useCallback } from 'react';

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 2000;
const CONNECTION_TIMEOUT_MS = 15000; // 15s timeout

// Benign network error types that should trigger reconnection instead of error display
const BENIGN_NETWORK_ERRORS = [
    'network',
    'server-error',
    'socket-error',
    'socket-closed',
    'peer-timeout'
];

import { PeerError, DataConnection, Peer } from '../types/index';

export const useMultiplayer = (
    onDataReceived: (data: any) => void,
    onConnectionOpened: () => void
) => {
    const [roomId, setRoomId] = useState("");
    const [connectionStatus, setConnectionStatus] = useState("DISCONNECTED");
    
    // Refs
    const connectionStatusRef = useRef("DISCONNECTED");
    const onDataReceivedRef = useRef(onDataReceived);
    const onConnectionOpenedRef = useRef(onConnectionOpened);
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<DataConnection | null>(null);
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateStatus = (status: string) => {
        setConnectionStatus(status);
        connectionStatusRef.current = status;
    };

    useEffect(() => {
        onDataReceivedRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        onConnectionOpenedRef.current = onConnectionOpened;
    }, [onConnectionOpened]);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = null;
        }
    }, []);

    const clearConnectionTimeout = useCallback(() => {
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }
    }, []);

    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatTimerRef.current = setInterval(() => {
            if (connRef.current && connRef.current.open) {
                try {
                    connRef.current.send({ type: 'PING' });
                } catch (e) {
                    console.warn("Heartbeat send failed", e);
                }
            }
        }, HEARTBEAT_INTERVAL);
    }, [stopHeartbeat]);

    const handleDataInternal = useCallback((data: unknown) => {
        // Simple check if it's an object with type property for PING
        if (typeof data === 'object' && data !== null && 'type' in data && (data as any).type === 'PING') return; 
        if (onDataReceivedRef.current) {
            onDataReceivedRef.current(data);
        }
    }, []);

    const cleanup = useCallback(() => {
        console.log("Multiplayer Cleanup");
        stopHeartbeat();
        clearConnectionTimeout();
        
        if (connRef.current) {
            try { connRef.current.close(); } catch(e) {}
            connRef.current = null;
        }
        if (peerRef.current) {
            peerRef.current.removeAllListeners();
            try { peerRef.current.destroy(); } catch(e) {}
            peerRef.current = null;
        }
        updateStatus("DISCONNECTED");
        setRoomId("");
    }, [stopHeartbeat, clearConnectionTimeout]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    const createPeer = (id?: string): Peer | null => {
        const PeerConstructor = (window as any).Peer;
        if (!PeerConstructor) return null;

        // Use explicit config to ensure we hit the public cloud correctly and avoid 404s
        return new PeerConstructor(id, { 
            debug: 1, 
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
                iceTransportPolicy: 'all'
            }
        });
    };

    const handlePeerError = (err: PeerError) => {
        console.error('Peer Error:', err);
        
        const msg = (err.message || "").toLowerCase();
        if (msg.includes("404") || msg.includes("not found")) {
             updateStatus("ERR: SERVER 404");
             return;
        }
        if (msg.includes("banned") || msg.includes("forbidden") || msg.includes("403") || msg.includes("access denied")) {
             updateStatus("ERR: BANNED/403");
             return;
        }

        const errType = err.type;
        if (errType === 'unavailable-id') {
            updateStatus("ERR: ID Taken");
        } else if (errType === 'peer-unavailable') {
            updateStatus("HOST NOT FOUND");
        } else if (BENIGN_NETWORK_ERRORS.includes(errType)) {
             // Benign networking errors, wait for reconnect
             console.warn("Network hiccup:", errType);
             updateStatus("RECONNECTING...");
        } else if (errType === 'browser-incompatible') {
            updateStatus("ERR: BROWSER");
        } else if (errType === 'webrtc') {
            updateStatus("ERR: WEBRTC");
        } else {
            updateStatus(`ERR: ${errType}`);
        }
    };

    const initializeHost = useCallback(() => {
        // Prevent double init
        if (peerRef.current && !peerRef.current.destroyed) return;
        
        cleanup();

        // Use longer, more unique ID to avoid collisions on PeerJS cloud
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(id);
        
        const peer = createPeer(id);
        if (!peer) {
            updateStatus("ERROR: Lib Missing");
            return;
        }

        peerRef.current = peer;
        updateStatus("WAITING...");

        peer.on('open', (myId: string) => {
            console.log('Host initialized:', myId);
            if (!connRef.current) updateStatus("WAITING...");
        });

        peer.on('connection', (conn: DataConnection) => {
            console.log('Host: connection event from', conn.peer, 'serialization:', conn.serialization);
            
            if (connRef.current) {
                try { connRef.current.close(); } catch(e) {}
            }
            
            connRef.current = conn;
            updateStatus("CONNECTING...");

            // Log immediate peer connection state
            setTimeout(() => {
                const pc = (conn as any).peerConnection;
                console.log('Host immediate ICE state:', pc?.iceConnectionState);
            }, 500);

            clearConnectionTimeout();
            connectionTimeoutRef.current = setTimeout(() => {
                if (connRef.current && !connRef.current.open) {
                    const pc = (conn as any).peerConnection;
                    console.warn("Host Connection Timeout - ICE state:", pc?.iceConnectionState);
                    updateStatus("TIMEOUT - NAT/Firewall blocked");
                    connRef.current.close();
                }
            }, CONNECTION_TIMEOUT_MS);

            conn.on('open', () => {
                console.log('Host Data Connection Open');
                clearConnectionTimeout();
                updateStatus("CONNECTED");
                startHeartbeat();
                if (onConnectionOpenedRef.current) onConnectionOpenedRef.current();
                try { conn.send({ type: 'PING' }); } catch(e) {}
            });

            conn.on('data', handleDataInternal);

            conn.on('close', () => {
                console.log('Host Data Connection Closed');
                connRef.current = null;
                stopHeartbeat();
                updateStatus("WAITING...");
            });
            
            conn.on('error', (err: PeerError) => {
                console.warn('Host Conn Error:', err.type, err.message);
                updateStatus(`ERR: ${err.type || 'CONN'}`);
            });
            
            conn.on('iceConnectionStateChange', () => {
                const pc = (conn as any).peerConnection;
                console.log('Host ICE state:', pc?.iceConnectionState);
                if (pc?.iceConnectionState === 'failed' || pc?.iceConnectionState === 'disconnected') {
                    console.warn('Host ICE connection failed/disconnected');
                    updateStatus("RETRYING...");
                }
            });
        });

        peer.on('disconnected', () => {
            console.log('Host disconnected from signaling.');
            // Attempt reconnect to signaling server
            setTimeout(() => {
                if (peerRef.current && !peerRef.current.destroyed && peerRef.current.disconnected) {
                    peerRef.current.reconnect();
                }
            }, 3000);
        });

        peer.on('error', handlePeerError);

    }, [cleanup, handleDataInternal, startHeartbeat, clearConnectionTimeout]);

    const initializeClient = useCallback((hostId: string) => {
        if (!hostId) return;
        
        cleanup();

        const clientId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const peer = createPeer(clientId);
        if (!peer) {
            updateStatus("ERROR: Lib Missing");
            return;
        }
        
        peerRef.current = peer;
        updateStatus("SEEKING...");

        clearConnectionTimeout();
        connectionTimeoutRef.current = setTimeout(() => {
            if (connectionStatusRef.current !== "CONNECTED") {
                console.warn("Client Connection Timeout");
                updateStatus("TIMEOUT - Check firewall/port forwarding");
                cleanup();
            }
        }, CONNECTION_TIMEOUT_MS);

        peer.on('open', (myId: string) => {
            console.log('Client initialized:', myId, '- connecting to host:', hostId);
            
            const conn = peer.connect(hostId, { serialization: 'json' });
            console.log('Client: created connection (serialization: json), waiting for open...');
            connRef.current = conn;
            updateStatus("CONNECTING...");

            // Log immediate peer connection state
            setTimeout(() => {
                const pc = (conn as any).peerConnection;
                console.log('Client immediate ICE state:', pc?.iceConnectionState);
            }, 500);

            conn.on('open', () => {
                console.log('Client Data Connection Open');
                clearConnectionTimeout();
                updateStatus("CONNECTED");
                startHeartbeat();
                if (onConnectionOpenedRef.current) onConnectionOpenedRef.current();
            });

            conn.on('data', handleDataInternal);

            conn.on('close', () => {
                console.log('Client Data Connection Closed');
                updateStatus("DISCONNECTED");
                stopHeartbeat();
                connRef.current = null;
            });
            
            conn.on('error', (err: PeerError) => {
                console.warn('Client Conn Error:', err.type, err.message);
                updateStatus(`ERR: ${err.type || 'CONN'}`);
            });
            
            conn.on('iceConnectionStateChange', () => {
                const pc = (conn as any).peerConnection;
                console.log('Client ICE state:', pc?.iceConnectionState);
                if (pc?.iceConnectionState === 'failed' || pc?.iceConnectionState === 'disconnected') {
                    console.warn('Client ICE connection failed/disconnected');
                    updateStatus("RETRYING...");
                }
            });
        });

        peer.on('disconnected', () => {
            setTimeout(() => {
                if (peerRef.current && !peerRef.current.destroyed && peerRef.current.disconnected) {
                    peerRef.current.reconnect();
                }
            }, 3000);
        });

        peer.on('error', (err: PeerError) => {
            clearConnectionTimeout();
            handlePeerError(err);
        });

    }, [cleanup, handleDataInternal, startHeartbeat, clearConnectionTimeout]);

    const send = useCallback((data: unknown) => {
        if (connRef.current && connRef.current.open) {
            try {
                connRef.current.send(data);
            } catch (e) {
                console.warn("Send failed", e);
            }
        }
    }, []);

    return { roomId, connectionStatus, initializeHost, initializeClient, send, cleanup };
};
