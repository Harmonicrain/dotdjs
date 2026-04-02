
import { useState, useRef, useEffect, useCallback } from 'react';
import { Peer, PeerErrorType } from 'peerjs';
import type { DataConnection, PeerError } from 'peerjs';
import { getPeerOptions } from './peerConfig';

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 2000;
const CONNECTION_TIMEOUT_MS = 15000; // 15s timeout

// Benign network error types that should trigger reconnection instead of error display
const BENIGN_NETWORK_ERRORS = new Set<string>([
    PeerErrorType.Network,
    PeerErrorType.ServerError,
    PeerErrorType.SocketError,
    PeerErrorType.SocketClosed,
    'peer-timeout',
]);

const STATUS_TEXT = {
    disconnected: 'DISCONNECTED',
    waiting: 'WAITING...',
    seeking: 'SEEKING...',
    connecting: 'CONNECTING...',
    connected: 'CONNECTED',
    reconnecting: 'RECONNECTING...',
    retrying: 'RETRYING...',
    hostNotFound: 'HOST NOT FOUND',
    idTaken: 'ERR: ID Taken',
    browser: 'ERR: BROWSER',
    webrtc: 'ERR: WEBRTC',
    sslUnavailable: 'ERR: TLS/SIGNALING',
    server404: 'ERR: SERVER 404',
    banned: 'ERR: BANNED/403',
    hostTimeout: 'TIMEOUT - NAT/Firewall blocked',
    clientTimeout: 'TIMEOUT - Check firewall/port forwarding',
} as const;

type MultiplayerStatus = typeof STATUS_TEXT[keyof typeof STATUS_TEXT];

export const useMultiplayer = (
    onDataReceived: (data: any) => void,
    onConnectionOpened: () => void
) => {
    const [roomId, setRoomId] = useState("");
    const [connectionStatus, setConnectionStatus] = useState<MultiplayerStatus>(STATUS_TEXT.disconnected);
    
    // Refs
    const connectionStatusRef = useRef<MultiplayerStatus>(STATUS_TEXT.disconnected);
    const onDataReceivedRef = useRef(onDataReceived);
    const onConnectionOpenedRef = useRef(onConnectionOpened);
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<DataConnection | null>(null);
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateStatus = (status: MultiplayerStatus) => {
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
        updateStatus(STATUS_TEXT.disconnected);
        setRoomId("");
    }, [stopHeartbeat, clearConnectionTimeout]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    const createPeer = (id?: string): Peer => {
        const options = getPeerOptions();
        console.info('Creating PeerJS peer', {
            id: id ?? '(auto)',
            host: options.host,
            port: options.port,
            path: options.path,
            secure: options.secure,
            debug: options.debug,
        });

        return id ? new Peer(id, options) : new Peer(options);
    };

    const schedulePeerReconnect = useCallback(() => {
        setTimeout(() => {
            if (peerRef.current && !peerRef.current.destroyed && peerRef.current.disconnected) {
                peerRef.current.reconnect();
            }
        }, 3000);
    }, []);

    const beginConnectionTimeout = useCallback((status: MultiplayerStatus, onTimeout: () => void) => {
        clearConnectionTimeout();
        connectionTimeoutRef.current = setTimeout(() => {
            if (connectionStatusRef.current === STATUS_TEXT.connected) return;
            updateStatus(status);
            onTimeout();
        }, CONNECTION_TIMEOUT_MS);
    }, [clearConnectionTimeout]);

    const attachConnectionLifecycle = useCallback((
        conn: DataConnection,
        role: 'Host' | 'Client',
        onConnected?: () => void,
    ) => {
        conn.on('data', handleDataInternal);

        conn.on('open', () => {
            console.log(`${role} Data Connection Open`);
            clearConnectionTimeout();
            updateStatus(STATUS_TEXT.connected);
            startHeartbeat();
            if (onConnectionOpenedRef.current) onConnectionOpenedRef.current();
            onConnected?.();
        });

        conn.on('close', () => {
            console.log(`${role} Data Connection Closed`);
            stopHeartbeat();
            connRef.current = null;
            updateStatus(role === 'Host' ? STATUS_TEXT.waiting : STATUS_TEXT.disconnected);
        });

        conn.on('error', (err: PeerError<string>) => {
            console.warn(`${role} Conn Error:`, err.type, err.message);
            updateStatus(`ERR: ${err.type || 'CONN'}` as MultiplayerStatus);
        });

        conn.on('iceStateChanged', (state) => {
            console.log(`${role} ICE state:`, state);
            if (state === 'failed' || state === 'disconnected') {
                console.warn(`${role} ICE connection failed/disconnected`);
                updateStatus(STATUS_TEXT.retrying);
            }
        });
    }, [clearConnectionTimeout, handleDataInternal, startHeartbeat, stopHeartbeat]);

    const handlePeerError = (err: PeerError<`${PeerErrorType}`>) => {
        console.error('Peer Error:', err);
        
        const msg = (err.message || "").toLowerCase();
        if (msg.includes("404") || msg.includes("not found")) {
             updateStatus(STATUS_TEXT.server404);
             return;
        }
        if (msg.includes("banned") || msg.includes("forbidden") || msg.includes("403") || msg.includes("access denied")) {
             updateStatus(STATUS_TEXT.banned);
             return;
        }

        const errType = err.type;
        if (errType === PeerErrorType.UnavailableID) {
            updateStatus(STATUS_TEXT.idTaken);
        } else if (errType === PeerErrorType.PeerUnavailable) {
            updateStatus(STATUS_TEXT.hostNotFound);
        } else if (errType === PeerErrorType.SslUnavailable) {
            updateStatus(STATUS_TEXT.sslUnavailable);
        } else if (BENIGN_NETWORK_ERRORS.has(errType)) {
              // Benign networking errors, wait for reconnect
               console.warn("Network hiccup:", errType);
               updateStatus(STATUS_TEXT.reconnecting);
        } else if (errType === PeerErrorType.BrowserIncompatible) {
            updateStatus(STATUS_TEXT.browser);
        } else if (errType === PeerErrorType.WebRTC) {
            updateStatus(STATUS_TEXT.webrtc);
        } else {
            updateStatus(`ERR: ${errType}` as MultiplayerStatus);
        }
    };

    const initializeHost = useCallback(() => {
        // Prevent double init
        if (peerRef.current && !peerRef.current.destroyed) return;
        
        cleanup();

        // Use longer, more unique ID to avoid collisions on PeerJS cloud
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(id);
        
        let peer: Peer;
        try {
            peer = createPeer(id);
        } catch (error) {
            console.error('Failed to initialize host peer', error);
            updateStatus(STATUS_TEXT.server404);
            return;
        }

        peerRef.current = peer;
        updateStatus(STATUS_TEXT.waiting);

        peer.on('open', (myId: string) => {
            console.log('Host initialized:', myId);
            if (!connRef.current) updateStatus(STATUS_TEXT.waiting);
        });

        peer.on('connection', (conn: DataConnection) => {
            console.log('Host: connection event from', conn.peer, 'serialization:', conn.serialization);
            
            if (connRef.current) {
                try { connRef.current.close(); } catch(e) {}
            }
            
            connRef.current = conn;
            updateStatus(STATUS_TEXT.connecting);

            // Log immediate peer connection state
            setTimeout(() => {
                const pc = (conn as any).peerConnection;
                console.log('Host immediate ICE state:', pc?.iceConnectionState);
            }, 500);

            beginConnectionTimeout(STATUS_TEXT.hostTimeout, () => {
                if (connRef.current && !connRef.current.open) {
                    const pc = (conn as any).peerConnection;
                    console.warn("Host Connection Timeout - ICE state:", pc?.iceConnectionState);
                    connRef.current.close();
                }
            });

            attachConnectionLifecycle(conn, 'Host', () => {
                try { conn.send({ type: 'PING' }); } catch(e) {}
            });
        });

        peer.on('disconnected', () => {
            console.log('Host disconnected from signaling.');
            schedulePeerReconnect();
        });

        peer.on('error', handlePeerError);

    }, [attachConnectionLifecycle, beginConnectionTimeout, cleanup, schedulePeerReconnect]);

    const initializeClient = useCallback((hostId: string) => {
        if (!hostId) return;
        
        cleanup();

        const clientId = Math.random().toString(36).substring(2, 10).toUpperCase();
        let peer: Peer;
        try {
            peer = createPeer(clientId);
        } catch (error) {
            console.error('Failed to initialize client peer', error);
            updateStatus(STATUS_TEXT.server404);
            return;
        }
        
        peerRef.current = peer;
        updateStatus(STATUS_TEXT.seeking);

        beginConnectionTimeout(STATUS_TEXT.clientTimeout, cleanup);

        peer.on('open', (myId: string) => {
            console.log('Client initialized:', myId, '- connecting to host:', hostId);
            
            const conn = peer.connect(hostId, { serialization: 'json' });
            console.log('Client: created connection (serialization: json), waiting for open...');
            connRef.current = conn;
            updateStatus(STATUS_TEXT.connecting);

            // Log immediate peer connection state
            setTimeout(() => {
                const pc = (conn as any).peerConnection;
                console.log('Client immediate ICE state:', pc?.iceConnectionState);
            }, 500);

            attachConnectionLifecycle(conn, 'Client');
        });

        peer.on('disconnected', () => {
            schedulePeerReconnect();
        });

        peer.on('error', (err: PeerError<`${PeerErrorType}`>) => {
            clearConnectionTimeout();
            handlePeerError(err);
        });

    }, [attachConnectionLifecycle, beginConnectionTimeout, cleanup, schedulePeerReconnect]);

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
