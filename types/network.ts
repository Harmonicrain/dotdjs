
// Types for PeerJS (incomplete but sufficient for this usage)

export interface PeerError extends Error {
    type: string;
}

export interface DataConnection {
    open: boolean;
    peer: string;
    serialization: string;
    send: (data: unknown) => void;
    close: () => void;
    on(event: 'data', cb: (data: unknown) => void): void;
    on(event: 'open', cb: () => void): void;
    on(event: 'close', cb: () => void): void;
    on(event: 'error', cb: (err: PeerError) => void): void;
    on(event: string, cb: (...args: any[]) => void): void;
}

export interface Peer {
    id: string;
    disconnected: boolean;
    destroyed: boolean;
    on(event: 'open', cb: (id: string) => void): void;
    on(event: 'connection', cb: (conn: DataConnection) => void): void;
    on(event: 'disconnected', cb: () => void): void;
    on(event: 'error', cb: (err: PeerError) => void): void;
    on(event: string, cb: (...args: any[]) => void): void;
    connect: (id: string, options?: any) => DataConnection;
    reconnect: () => void;
    destroy: () => void;
    removeAllListeners: () => void;
}
