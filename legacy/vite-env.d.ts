/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PEER_HOST?: string;
    readonly VITE_PEER_PORT?: string;
    readonly VITE_PEER_PATH?: string;
    readonly VITE_PEER_SECURE?: string;
    readonly VITE_PEER_DEBUG?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
