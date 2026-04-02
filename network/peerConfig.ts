import type { PeerOptions } from 'peerjs';

type ExtendedRTCConfiguration = RTCConfiguration & {
    sdpSemantics?: 'unified-plan' | 'plan-b';
};

const DEFAULT_PEER_HOST = '0.peerjs.com';
const DEFAULT_PEER_PORT = 443;
const DEFAULT_PEER_PATH = '/';
const DEFAULT_PEER_SECURE = true;
const DEFAULT_PEER_DEBUG = 1;

const DEFAULT_ICE_CONFIG: ExtendedRTCConfiguration = {
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
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined) return fallback;

    switch (value.trim().toLowerCase()) {
        case 'true':
        case '1':
        case 'yes':
        case 'on':
            return true;
        case 'false':
        case '0':
        case 'no':
        case 'off':
            return false;
        default:
            return fallback;
    }
};

const parseNumber = (value: string | undefined, fallback: number): number => {
    if (value === undefined) return fallback;

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const getPeerOptions = (): PeerOptions => {
    const env = import.meta.env;

    return {
        host: env.VITE_PEER_HOST ?? DEFAULT_PEER_HOST,
        port: parseNumber(env.VITE_PEER_PORT, DEFAULT_PEER_PORT),
        path: env.VITE_PEER_PATH ?? DEFAULT_PEER_PATH,
        secure: parseBoolean(env.VITE_PEER_SECURE, DEFAULT_PEER_SECURE),
        debug: parseNumber(env.VITE_PEER_DEBUG, DEFAULT_PEER_DEBUG),
        config: DEFAULT_ICE_CONFIG,
    };
};
