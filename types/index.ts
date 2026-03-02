
export * from './entities';
export * from './player';
export * from './world';
export * from './ui';
export * from './systems';
export * from './network';

export interface MapGameplay {
    perkCosts?: Record<string, number>;
    packAPunchCost?: number;
}

export interface MutableRefObject<T> {
    current: T | null;
}
