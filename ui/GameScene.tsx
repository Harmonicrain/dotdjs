
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MAPS, DEFAULT_MAP_ID, GAME_CONFIG, WEAPON_CONFIGS } from '../config';
import { MAP_DEFINITIONS } from '../managers/MapRegistry';
import { useMultiplayer } from '../network/useMultiplayer';
import { HUD } from './HUD';
import { GameMenuManager } from './GameMenuManager';
import { LoadingScreen } from './components/LoadingScreen';
import { useGameStore } from '../store/useGameStore';
import { GameLifecycle } from '../game/GameLifecycle';
import { createNetworkMessageHandler } from '../network/NetworkMessageHandler';
import { GameMessage } from '../types/index';

interface GameSceneProps {
    onGameReset: () => void;
}

const GameScene: React.FC<GameSceneProps> = ({ onGameReset }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lifecycleRef = useRef<GameLifecycle | null>(null);

    const updatePlayer = useGameStore(s => s.updatePlayer);
    const updateGame   = useGameStore(s => s.updateGame);
    const updateRemote = useGameStore(s => s.updateRemote);

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

    // ── Start / Stop ──────────────────────────────────────────────────────
    const startGame = useCallback(async (
        overrideMode?: 'SOLO' | 'HOST' | 'CLIENT',
        overrideMapId?: string,
        playerName = 'Unknown',
    ) => {
        const mode  = overrideMode ?? gameMode;
        const mapId = overrideMapId ?? selectedMap;

        updatePlayer({ playerName });
        updateGame({ gameMode: mode, isDogRound: false, isSpectating: false, isGameOver: false, round: 0, showFade: true, isPaused: false });
        const mapDef = MAP_DEFINITIONS[mapId] ?? MAP_DEFINITIONS[DEFAULT_MAP_ID];
        const startPoints = mapDef.config?.gameplay?.STARTING_POINTS ?? GAME_CONFIG.STARTING_POINTS;
        updatePlayer({ points: startPoints });
        if (mode !== 'SOLO') {
            updateRemote({ 
                remotePoints: startPoints, 
                remoteTotalEarnedPoints: startPoints,
                remoteHealth: GAME_CONFIG.PLAYER_BASE_HEALTH,
                remotePerks: {}
            });
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
        updateGame({ isPaused: false, isGameOver: false, isSpectating: false, activePowerUps: {}, interactionMsg: null, hoverMsg: null, showFade: false, activeZombiesCount: 0, round: 1 });
        const startWeapon = WEAPON_CONFIGS[0];
        updatePlayer({ 
            health: GAME_CONFIG.PLAYER_BASE_HEALTH, 
            points: GAME_CONFIG.STARTING_POINTS, 
            ammo: startWeapon.clipSize, 
            reserveAmmo: startWeapon.maxReserve, 
            activeWeaponIndex: 0, 
            perks: {}, 
            isDowned: false, 
            weaponName: startWeapon.name 
        });

        const lifecycle = new GameLifecycle();
        lifecycleRef.current = lifecycle;

        lifecycle.init(canvas, send, updatePlayer, updateGame, {
            onLoadingChange:   setIsLoading,
            onStartedChange:   setHasStarted,
            onMapLoadedChange: setIsMapLoaded,
            onSetPaused:       (paused: boolean) => updateGame({ isPaused: paused }),
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
                    if (hasStarted && !isLoading) canvasRef.current?.requestPointerLock();
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
                    isMapLoaded={isMapLoaded}
                    onStartSolo={(name) => startGame('SOLO', selectedMap, name || 'Player')}
                    onHostInit={initializeHost}
                    onHostStart={(name) => {
                        startGame('HOST', selectedMap, name || 'Player');
                        send?.({ type: 'START_GAME', mapId: selectedMap });
                    }}
                    onJoinInit={initializeClient}
                    onClientReady={(name) => {
                        updatePlayer({ playerName: name || 'Player' });
                        send?.({ type: 'READY', name: name || 'Player' });
                    }}
                    onAbort={cleanup}
                    onGameReset={onGameReset}
                />
            )}

            {hasStarted && !isLoading && (
                <HUD
                    onQuit={quitToMenu}
                    onResume={() => setPaused(false)}
                    onRestart={() => { quitToMenu(); startGame(); }}
                    onCommand={(cmd) => lifecycleRef.current?.game?.stateManager?.eventBus.emit('COMMAND_REQUEST', cmd)}
                />
            )}
        </>
    );
};

export default GameScene;
