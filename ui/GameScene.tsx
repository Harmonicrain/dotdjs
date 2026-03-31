
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MAPS } from '../config';
import { createMenuStoreState, createSessionStartStoreState } from '../game/sessionStateUtils';
import { useMultiplayer } from '../network/useMultiplayer';
import { HUD } from './HUD';
import { GameMenuManager } from './GameMenuManager';
import { LoadingScreen } from './components/LoadingScreen';
import { ExtendedSettings, useGameStore } from '../store/useGameStore';
import { GameLifecycle } from '../game/GameLifecycle';
import { createNetworkMessageHandler } from '../network/NetworkMessageHandler';
import { GameMessage } from '../types/index';

interface GameSceneProps {
    onGameReset: () => void;
}

const GameScene = ({ onGameReset }: GameSceneProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lifecycleRef = useRef<GameLifecycle | null>(null);

    const updatePlayer = useGameStore(s => s.updatePlayer);
    const updateGame   = useGameStore(s => s.updateGame);
    const updateRemote = useGameStore(s => s.updateRemote);
    const updateSettings = useGameStore(s => s.updateSettings);
    const settings = useGameStore(s => s.settings);

    const [hasStarted,      setHasStarted]      = useState(false);
    const [isLoading,       setIsLoading]        = useState(false);
    const [isMapLoaded,     setIsMapLoaded]      = useState(false);
    const [isClientReady,   setIsClientReady]    = useState(false);
    const [gameMode,        setGameMode]         = useState<'SOLO' | 'HOST' | 'CLIENT'>('SOLO');
    const [selectedMap,     setSelectedMap]      = useState(MAPS[0].id);
    const [remoteNameLocal, setRemoteNameLocal]  = useState('Unknown');

    // ── Refs for stable closure access ──────────────────────────────────
    const startGameRef = useRef<typeof startGame>(null!);
    
    // ── Network ──────────────────────────────────────────────────────────
    const networkHandlerRef = useRef<(msg: GameMessage) => void | null>(null);
    const lifecycleInitializedRef = useRef(false);
    const { send, roomId, connectionStatus, initializeHost, initializeClient, cleanup } =
        useMultiplayer(
            (data) => {
                const sm = lifecycleRef.current?.game?.stateManager;
                if (!networkHandlerRef.current && sm) {
                    networkHandlerRef.current = createNetworkMessageHandler(sm, {
                        updateGame, updatePlayer, updateRemote,
                        setIsClientReady,
                        setRemotePlayerName: (name) => { updateRemote({ remotePlayerName: name }); setRemoteNameLocal(name); },
                        setSelectedMap,
                        startGameLocal: (mode, mapId) => {
                            const currentName = useGameStore.getState().playerName;
                            startGameRef.current(mode as any, mapId, currentName);
                        },
                        setInteractionMsg: (msg) => updateGame({ interactionMsg: msg }),
                    });
                }
                networkHandlerRef.current?.(data);
            },
            () => { /* on open */ },
        );

    useEffect(() => { 
        updateGame({ connectionStatus }); 
        if (lifecycleRef.current?.game?.stateManager) {
            lifecycleRef.current.game.stateManager.updateConnectionStatus(connectionStatus);
        }
    }, [connectionStatus, updateGame]);

    useEffect(() => {
        const game = lifecycleRef.current?.game;
        const sm = game?.stateManager;
        if (!game || !sm) return;

        game.inputManager.updateSettings(settings);
        sm.soundManager?.setMasterVolume(settings.masterVolume);
        sm.soundManager?.setCategoryVolume('weapon', settings.weaponVolume);
        sm.soundManager?.setCategoryVolume('zombie', settings.zombieVolume);
        sm.soundManager?.setCategoryVolume('effects', settings.effectsVolume);
    }, [settings]);

    // ── Start / Stop ──────────────────────────────────────────────────────
    const startGame = useCallback(async (
        overrideMode?: 'SOLO' | 'HOST' | 'CLIENT',
        overrideMapId?: string,
        playerName = 'Unknown',
    ) => {
        const mode  = overrideMode ?? gameMode;
        const mapId = overrideMapId ?? selectedMap;

        const sessionState = createSessionStartStoreState(mapId, mode, playerName);
        updatePlayer(sessionState.player);
        updateGame(sessionState.game);
        if (sessionState.remote) {
            updateRemote(sessionState.remote);
        }

        await lifecycleRef.current?.start(mapId, mode, playerName);

        setTimeout(() => updateGame({ showFade: false }), 2_000);
    }, [gameMode, selectedMap, updatePlayer, updateGame]);

    // Keep startGameRef current
    useEffect(() => {
        startGameRef.current = startGame;
    }, [startGame]);

    const quitToMenu = useCallback(() => {
        cleanup();
        lifecycleRef.current?.stop();
        updateGame({ isGameOver: false, isSpectating: false, isPaused: false, interactionMsg: null, hoverMsg: null, activePowerUps: {}, showFade: false, round: 1 });
    }, [cleanup, updateGame]);

    const setPaused = useCallback((paused: boolean) => {
        lifecycleRef.current?.game?.stateManager?.setPaused(paused);
        updateGame({ isPaused: paused });
    }, [updateGame]);

    // ── Network handler (wired after lifecycle is stable) ─────────────────
    useEffect(() => {
        const sm = lifecycleRef.current?.game?.stateManager;
        if (!sm) return;

        networkHandlerRef.current = createNetworkMessageHandler(sm, {
            updateGame, updatePlayer, updateRemote,
            setIsClientReady,
            setRemotePlayerName: (name) => { updateRemote({ remotePlayerName: name }); setRemoteNameLocal(name); },
            setSelectedMap,
            startGameLocal: (mode, mapId) => {
                const currentName = useGameStore.getState().playerName;
                startGameRef.current(mode as any, mapId, currentName);
            },
            setInteractionMsg: (msg) => updateGame({ interactionMsg: msg }),
        });
    }, [updateGame, updatePlayer, updateRemote, hasStarted]);

    // ── Engine bootstrap (single effect) ─────────────────────────────────
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        // Reset UI to defaults
        const menuState = createMenuStoreState();
        updateGame(menuState.game);
        updatePlayer(menuState.player);
        updateRemote(menuState.remote);

        const lifecycle = new GameLifecycle();
        lifecycleRef.current = lifecycle;

        lifecycle.init(canvas, send, updatePlayer, updateGame, {
            onLoadingChange:   setIsLoading,
            onStartedChange:   setHasStarted,
            onMapLoadedChange: setIsMapLoaded,
            onSetPaused:       (paused: boolean) => updateGame({ isPaused: paused }),
            onInputDeviceChange: (device: ExtendedSettings['inputDevice']) => updateSettings({ inputDevice: device }),
        });

        return () => {
            lifecycle.dispose();
            lifecycleRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mapName = MAPS.find(m => m.id === selectedMap)?.name ?? 'UNKNOWN SECTOR';

    return (
        <>
            <canvas
                ref={canvasRef}
                className="w-full h-full block outline-none touch-none"
                tabIndex={1}
                onClick={() => {
                    const settings = useGameStore.getState().settings;
                    if (hasStarted && !isLoading && settings.inputDevice !== 'TOUCH') {
                        canvasRef.current?.requestPointerLock();
                    }
                }}
            />

            <LoadingScreen isVisible={isLoading} mapName={mapName} />

            {!hasStarted && !isLoading && (
                <GameMenuManager
                    selectedMap={selectedMap}
                    onSelectMap={setSelectedMap}
                    connectionStatus={connectionStatus}
                    roomId={roomId}
                    remotePlayerName={remoteNameLocal}
                    isClientReady={isClientReady}
                    onStartSolo={(mapId, name) => startGame('SOLO', mapId, name || 'Player')}
                    onHostInit={initializeHost}
                    onHostStart={(mapId, name) => {
                        startGame('HOST', mapId, name || 'Player');
                        send?.({ type: 'START_GAME', mapId: mapId });
                    }}
                    onJoinInit={initializeClient}
                    onClientReady={(name) => {
                        updatePlayer({ playerName: name || 'Player' });
                        send?.({ type: 'READY', name: name || 'Player' });
                    }}
                    onAbort={cleanup}
                />
            )}

            {hasStarted && !isLoading && (
                <HUD
                    onQuit={quitToMenu}
                    onResume={() => setPaused(false)}
                    onCommand={(cmd) => lifecycleRef.current?.game?.stateManager?.eventBus.emit('COMMAND_REQUEST', cmd)}
                    inputManager={lifecycleRef.current?.game?.inputManager ?? null}
                    onPause={() => setPaused(true)}
                />
            )}
        </>
    );
};

export default GameScene;
