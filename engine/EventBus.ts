import * as BABYLON from '@babylonjs/core';
import { GameMessage } from '../types/index';
import { CachedHostState, CachedClientState } from '../types/network';
import { ReviveEvent } from '../types/systems';
import type { ShootMessage } from '../systems/ProjectileSystem';

export interface GameEvents {
    'HELLHOUND_DEATH': { id: string, position: BABYLON.Vector3 };
    'PLAYER_DAMAGE': { amount: number; source: string };
    'GAME_STARTED': { startPoints: number } | null;
    'BOARD_STATE_CHANGE': { windowId: string };
    'LID_STATE_CHANGE': { groundSpawnId: string };
    'ZOMBIE_DEATH': { id: string, position: BABYLON.Vector3 };
    'PLAYER_HIT': { zombieId: string, damage: number };
    'GAME_OVER': null;
    'COMMAND_CLOSE_CONSOLE': null;
    'WEAPON_PICKUP_REQUEST': string;
    'PACK_A_PUNCH_REQUEST': BABYLON.AbstractMesh;
    'DOOR_OPEN_REQUEST': string;
    'POWER_ON_REQUEST': null;
    'COMMAND_REQUEST': string;
    'REMOTE_SHOOT': ShootMessage;
    'RESPAWN_REQUEST': { round: number, points: number };
    'REVIVE_EVENT': ReviveEvent;
    'NET_GAME_STATE_UPDATE': CachedHostState;
    'NET_CLIENT_INPUT': CachedClientState;
    'HOST_LOADED_RECEIVED': null;
}

type Handler<T> = (data: T) => void;

export class EventBus {
    private listeners: Map<keyof GameEvents, Handler<any>[]> = new Map();

    public on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(handler);
    }

    public off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    public emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(h => h(data));
        }
    }

    /**
     * Removes all registered handlers. Call during game reset to prevent
     * orphaned handlers from accumulating across level reloads.
     */
    public clear(): void {
        this.listeners.clear();
    }

    /**
     * Removes all handlers for a specific event type.
     */
    public clearEvent<K extends keyof GameEvents>(event: K): void {
        this.listeners.delete(event);
    }
}
