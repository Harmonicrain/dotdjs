
import React, { useState, useEffect } from 'react';
import { GAME_CONFIG } from '../config';
import { useGameStore } from '../store/useGameStore';

// Atomic Components
import { Crosshair } from './components/Crosshair';
import { RoundDisplay } from './components/RoundDisplay';
import { AmmoCounter } from './components/AmmoCounter';
import { PlayerStatus } from './components/PlayerStatus';
import { PowerUpDisplay } from './components/PowerUpDisplay';
import { GameOverScreen } from './components/GameOverScreen';
import { PauseScreen } from './components/PauseScreen';
import { FormattedText } from './components/FormattedText';
import { HUDOverlayEffects } from './components/HUDOverlayEffects';
import { DownedOverlay } from './components/DownedOverlay';
import { Console } from './components/Console';
import { DebugInfoWindow } from './components/DebugInfoWindow';
import { DebugControlsOverlay } from './components/DebugControlsOverlay';
import { ScaleWeaponOverlay } from './components/ScaleWeaponOverlay';
import { DeveloperStats } from './components/DeveloperStats';
import { HitMarker } from './components/HitMarker';
import { KillFeed } from './components/KillFeed';
import { FPSCounter } from './components/FPSCounter';

interface HUDProps {
    onResume?: () => void;
    onQuit: () => void;
    onRestart?: () => void;
    onCommand: (cmd: string) => void;
}

// Interaction prompt component with enhanced styling
const InteractionPrompt: React.FC<{ message: string }> = ({ message }) => (
    <div className="absolute top-[68%] left-1/2 -translate-x-1/2 flex flex-col items-center z-30"
         style={{ animation: 'fadeIn 0.2s ease-out' }}>
        <div className="relative">
            {/* Background glow */}
            <div className="absolute -inset-4 bg-gradient-radial from-red-900/20 via-transparent to-transparent blur-lg" />
            
            {/* Main prompt */}
            <div className="relative bg-black/70 backdrop-blur-sm px-6 py-2 rounded
                          border border-stone-700/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <span className="text-amber-100 text-sm tracking-[0.2em] uppercase font-mono
                               drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                    <FormattedText text={message} />
                </span>
            </div>
            
            {/* Animated corner accents */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-500/50" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-500/50" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-500/50" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-500/50" />
        </div>
    </div>
);

// Hover info component with enhanced styling
const HoverInfo: React.FC<{ message: string }> = ({ message }) => (
    <div className="absolute top-[60%] left-1/2 -translate-x-1/2 flex flex-col items-center z-30">
        <div className="bg-black/80 backdrop-blur-sm px-5 py-3 rounded-sm
                      border border-stone-600/30 shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
            <span className="text-stone-200 text-sm tracking-[0.15em] uppercase font-mono
                           flex items-center drop-shadow-sm whitespace-nowrap">
                <FormattedText text={message} />
            </span>
        </div>
    </div>
);

// Spectating overlay with enhanced visuals
const SpectatingOverlay: React.FC<{ playerName: string }> = ({ playerName }) => (
    <div className="absolute top-1/4 w-full text-center z-50 pointer-events-none">
        {/* Vignette overlay */}
        <div className="fixed inset-0 bg-gradient-radial from-transparent via-black/20 to-black/50 pointer-events-none" />
        
        <div className="relative">
            {/* KIA text with glitch effect */}
            <h2 className="text-6xl text-red-600 font-black tracking-[0.5em] uppercase
                         drop-shadow-[0_4px_20px_rgba(220,38,38,0.5)]"
                style={{ 
                    textShadow: '0 0 40px rgba(220,38,38,0.5), 0 4px 0 rgba(0,0,0,1)',
                    animation: 'pulse 2s ease-in-out infinite'
                }}>
                KIA
            </h2>
            
            {/* Decorative line */}
            <div className="flex items-center justify-center gap-4 mt-4">
                <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-red-600/50" />
                <div className="w-2 h-2 rotate-45 border border-red-600/50" />
                <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-red-600/50" />
            </div>
            
            {/* Spectating text */}
            <p className="text-stone-400 mt-4 tracking-[0.4em] text-xs uppercase font-mono
                        bg-black/60 inline-block px-6 py-2 rounded border border-stone-700/50">
                SPECTATING <span className="text-stone-200">{playerName}</span>
            </p>
        </div>
    </div>
);

// Dog round announcement
const DogRoundAnnouncement: React.FC = () => (
    <div className="absolute top-1/3 left-0 w-full flex flex-col items-center justify-center z-40 pointer-events-none select-none">
        <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-8 bg-red-900/20 blur-3xl rounded-full" />
            
            {/* Main text */}
            <div className="relative text-red-700 tracking-[0.6em] text-2xl font-black uppercase
                          drop-shadow-[0_0_30px_rgba(127,29,29,0.8)]"
                 style={{ 
                     animation: 'fadeIn 1s ease-out',
                     textShadow: '0 0 40px rgba(127,29,29,0.8), 0 4px 0 rgba(0,0,0,0.8)'
                 }}>
                FETCH ME THEIR SOULS
            </div>
            
            {/* Decorative elements */}
            <div className="flex items-center justify-center gap-6 mt-4"
                 style={{ animation: 'fadeIn 1s ease-out 0.3s both' }}>
                <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-red-800/50" />
                <span className="text-red-800/80 text-xl">🐕</span>
                <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-red-800/50" />
            </div>
        </div>
    </div>
);

export const HUD: React.FC<HUDProps> = ({ onResume, onQuit, onCommand }) => {
    // Game State Selectors
    const round = useGameStore(state => state.round);
    const showRoundIntro = useGameStore(state => state.showRoundIntro);
    const activeZombies = useGameStore(state => state.activeZombiesCount);
    const totalZombies = useGameStore(state => state.totalRoundZombies);
    const playerName = useGameStore(state => state.playerName);
    const health = useGameStore(state => state.health);
    const points = useGameStore(state => state.points);
    const totalEarnedPoints = useGameStore(state => state.totalEarnedPoints);
    
    // Generic Perk Selector
    const perks = useGameStore(state => state.perks);
    
    const isDowned = useGameStore(state => state.isDowned);
    const isBeingRevived = useGameStore(state => state.isBeingRevived);
    const ammo = useGameStore(state => state.ammo);
    const reserveAmmo = useGameStore(state => state.reserveAmmo);
    const maxClip = useGameStore(state => state.maxClip);
    const interactionMsg = useGameStore(state => state.interactionMsg);
    const isSpectating = useGameStore(state => state.isSpectating);
    
    const remotePlayerName = useGameStore(state => state.remotePlayerName);
    const remoteHealth = useGameStore(state => state.remoteHealth);
    const remotePoints = useGameStore(state => state.remotePoints);
    const remoteTotalEarnedPoints = useGameStore(state => state.remoteTotalEarnedPoints);
    const remotePerks = useGameStore(state => state.remotePerks);
    
    const gameMode = useGameStore(state => state.gameMode);
    const connectionStatus = useGameStore(state => state.connectionStatus);
    const flashColor = useGameStore(state => state.flashColor);
    const showFade = useGameStore(state => state.showFade);
    const isPaused = useGameStore(state => state.isPaused);
    const isDogRound = useGameStore(state => state.isDogRound);
    const weaponName = useGameStore(state => state.weaponName);
    const isGameOver = useGameStore(state => state.isGameOver);
    const kills = useGameStore(state => state.kills);
    const shotsFired = useGameStore(state => state.shotsFired);
    const remoteKills = useGameStore(state => state.remoteKills);
    const remoteShots = useGameStore(state => state.remoteShots);
    const hoverMsg = useGameStore(state => state.hoverMsg);
    const activePowerUps = useGameStore(state => state.activePowerUps);

    // Derived Logic
    const maxHP = perks['juggernog'] ? GAME_CONFIG.PLAYER_JUGG_HEALTH : GAME_CONFIG.PLAYER_BASE_HEALTH;
    const bloodOpacity = Math.max(0, (maxHP - health) / maxHP);

    // Release pointer lock on Game Over
    useEffect(() => {
        if (isGameOver) {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    }, [isGameOver]);

    // Bleed out timer logic for UI
    const [bleedOut, setBleedOut] = useState(GAME_CONFIG.DOWNED_BLEED_OUT_TIME / 1000);
    useEffect(() => {
        if (isDowned) {
            const start = Date.now();
            const interval = setInterval(() => {
                const elapsed = Date.now() - start;
                const remaining = Math.max(0, (GAME_CONFIG.DOWNED_BLEED_OUT_TIME - elapsed) / 1000);
                setBleedOut(remaining);
            }, 100);
            return () => clearInterval(interval);
        } else {
            setBleedOut(GAME_CONFIG.DOWNED_BLEED_OUT_TIME / 1000);
        }
    }, [isDowned]);

    return (
        <>
            {/* Screen effects layer */}
            <HUDOverlayEffects bloodOpacity={bloodOpacity} flashColor={flashColor} showFade={showFade} />
            
            {/* Downed overlay */}
            <DownedOverlay isDowned={isDowned} bleedOutTimeRemaining={bleedOut} isBeingRevived={isBeingRevived} />

            {/* Crosshair */}
            {!isSpectating && !isPaused && !isGameOver && !isDowned && <Crosshair />}

            {/* Hit marker feedback */}
            {!isGameOver && <HitMarker />}

            {/* Kill feed */}
            {!isGameOver && <KillFeed />}

            {/* FPS counter - top right */}
            {!isGameOver && <FPSCounter />}

            {/* Round display */}
            {!isGameOver && (
                <RoundDisplay 
                    round={round} 
                    isDogRound={isDogRound} 
                    activeZombies={activeZombies} 
                    totalZombies={totalZombies} 
                />
            )}

            {/* Active power-ups */}
            <PowerUpDisplay activePowerUps={activePowerUps} />

            {/* Debug/Dev tools */}
            <Console onCommand={onCommand} />
            <DebugInfoWindow />
            <DebugControlsOverlay />
            <ScaleWeaponOverlay />
            <DeveloperStats />

            {/* Spectating overlay */}
            {isSpectating && !isGameOver && (
                <SpectatingOverlay playerName={remotePlayerName} />
            )}

            {/* Dog round announcement */}
            {showRoundIntro && !isGameOver && isDogRound && (
                <DogRoundAnnouncement />
            )}
            
            {/* Main HUD container */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {/* Player status panels - bottom left */}
                {!isGameOver && (
                    <div className="absolute bottom-6 left-6 z-30 w-full pr-20 flex flex-col items-start select-none">
                        {/* Remote player (if co-op) */}
                        {gameMode !== 'SOLO' && connectionStatus === 'CONNECTED' && (
                            <PlayerStatus 
                                name={remotePlayerName} 
                                hp={remoteHealth || 0} 
                                pts={remotePoints || 0} 
                                perks={remotePerks}
                                opacity={0.7}
                            />
                        )}
                        {/* Local player */}
                        <PlayerStatus 
                            name={playerName} 
                            hp={health} 
                            pts={points} 
                            perks={perks}
                            opacity={1} 
                            isLocal={true}
                        />
                    </div>
                )}

                {/* Ammo counter - bottom right */}
                {!isGameOver && (
                    <AmmoCounter 
                        weaponName={weaponName} 
                        ammo={ammo} 
                        reserveAmmo={reserveAmmo} 
                        maxClip={maxClip} 
                    />
                )}
                
                {/* Hover message (item info) */}
                {hoverMsg && !isGameOver && !isSpectating && (
                    <HoverInfo message={hoverMsg} />
                )}

                {/* Interaction prompt */}
                {interactionMsg && !isGameOver && (
                    <InteractionPrompt message={interactionMsg} />
                )}
            </div>

            {/* Game over screen */}
            {isGameOver && (
                <GameOverScreen 
                    round={round} 
                    playerName={playerName} 
                    kills={kills} 
                    shotsFired={shotsFired} 
                    score={totalEarnedPoints}
                    gameMode={gameMode} 
                    remotePlayerName={remotePlayerName} 
                    remoteKills={remoteKills} 
                    remoteShots={remoteShots} 
                    remoteScore={remoteTotalEarnedPoints}
                    onQuit={onQuit}
                />
            )}

            {/* Pause screen */}
            {isPaused && !isGameOver && onResume && (
                <PauseScreen onResume={onResume} onQuit={onQuit} />
            )}
        </>
    );
};
