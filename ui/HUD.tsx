
import React from 'react';
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
import { BulletDebugOverlay } from './components/BulletDebugOverlay';
import { DebugControlsOverlay } from './components/DebugControlsOverlay';
import { ScaleWeaponOverlay } from './components/ScaleWeaponOverlay';
import { DeveloperStats } from './components/DeveloperStats';
import { HitMarker } from './components/HitMarker';
import { KillFeed } from './components/KillFeed';
import { FPSCounter } from './components/FPSCounter';
import { RenderStatsOverlay } from './components/RenderStatsOverlay';
import { WeaponAdsDebugOverlay } from './components/WeaponAdsDebugOverlay';
import { TouchControls } from './components/TouchControls';
import { InputManager } from '../engine/InputManager';

interface HUDProps {
    onResume?: () => void;
    onQuit: () => void;
    onRestart?: () => void;
    onCommand: (cmd: string) => void;
    inputManager?: InputManager | null;
    onPause?: () => void;
}

// Interaction prompt component with enhanced styling
const InteractionPrompt = ({ message }: { message: string }) => (
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
const HoverInfo = ({ message }: { message: string }) => (
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
const SpectatingOverlay = ({ playerName }: { playerName: string }) => (
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
const DogRoundAnnouncement = () => (
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

export const HUD = ({ onResume, onQuit, onCommand, inputManager, onPause }: HUDProps) => {
    // Only subscribe to fields needed for conditional rendering layout
    const isGameOver = useGameStore(s => s.isGameOver);
    const isPaused = useGameStore(s => s.isPaused);
    const isSpectating = useGameStore(s => s.isSpectating);
    const isDowned = useGameStore(s => s.isDowned);
    const showRoundIntro = useGameStore(s => s.showRoundIntro);
    const isDogRound = useGameStore(s => s.isDogRound);
    const interactionMsg = useGameStore(s => s.interactionMsg);
    const hoverMsg = useGameStore(s => s.hoverMsg);
    const gameMode = useGameStore(s => s.gameMode);
    const connectionStatus = useGameStore(s => s.connectionStatus);
    const isTouchMode = useGameStore(s => s.settings.inputDevice === 'TOUCH');

    // Local player fields for PlayerStatus
    const playerName = useGameStore(s => s.playerName);
    const health = useGameStore(s => s.health);
    const points = useGameStore(s => s.points);
    const perks = useGameStore(s => s.perks);

    // Remote player fields for PlayerStatus
    const remotePlayerName = useGameStore(s => s.remotePlayerName);
    const remoteHealth = useGameStore(s => s.remoteHealth);
    const remotePoints = useGameStore(s => s.remotePoints);
    const remotePerks = useGameStore(s => s.remotePerks);

    // Touch layout constants (must match TouchControls.tsx sizing)
    // joystickSize ~132px + edgePadding ~16px → left safe zone
    // action button grid ~3*(52+8)=180px wide + edgePadding → right safe zone
    // joystick + edgePadding bottom offset
    const TOUCH_BOTTOM_SAFE = 170; // px — clears joystick + action buttons height
    const TOUCH_LEFT_SAFE = 164;   // px — clears joystick width + padding
    const TOUCH_RIGHT_SAFE = 210;  // px — clears action button grid width + padding

    return (
        <>
            {/* Screen effects layer */}
            <HUDOverlayEffects />

            {/* Downed overlay */}
            <DownedOverlay />

            {/* Crosshair */}
            {!isSpectating && !isPaused && !isGameOver && !isDowned && <Crosshair />}

            {/* Hit marker feedback */}
            {!isGameOver && <HitMarker />}

            {/* Kill feed — on touch, nudge left to clear action buttons */}
            {!isGameOver && <KillFeed isTouchMode={isTouchMode} touchRightSafe={TOUCH_RIGHT_SAFE} />}

            {/* FPS counter — on touch, shift left of the pause button */}
            {!isGameOver && <FPSCounter isTouchMode={isTouchMode} />}

            {/* Round display */}
            {!isGameOver && <RoundDisplay isTouchMode={isTouchMode} />}

            {/* Active power-ups — on touch, raised above action buttons */}
            <PowerUpDisplay isTouchMode={isTouchMode} touchBottomSafe={TOUCH_BOTTOM_SAFE} />

            {/* Debug/Dev tools */}
            <Console onCommand={onCommand} />
            <DebugInfoWindow />
            <BulletDebugOverlay />
            <DebugControlsOverlay />
            <ScaleWeaponOverlay />
            <RenderStatsOverlay />
            <WeaponAdsDebugOverlay />
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
                {/* Player status panels - bottom left
                    Touch: raised above joystick, capped width to not enter center */}
                {!isGameOver && (
                    <div
                        className="absolute z-30 flex flex-col items-start select-none"
                        style={isTouchMode ? {
                            bottom: TOUCH_BOTTOM_SAFE,
                            left: 8,
                            maxWidth: `calc(50% - 8px)`,
                        } : {
                            bottom: 24,
                            left: 24,
                            width: '100%',
                            paddingRight: 80,
                        }}
                    >
                        {/* Remote player (if co-op) */}
                        {gameMode !== 'SOLO' && connectionStatus === 'CONNECTED' && (
                            <PlayerStatus
                                name={remotePlayerName}
                                hp={remoteHealth || 0}
                                pts={remotePoints || 0}
                                perks={remotePerks}
                                opacity={0.7}
                                compact={isTouchMode}
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
                            compact={isTouchMode}
                        />
                    </div>
                )}

                {/* Ammo counter — on touch, raised above action buttons and shifted left of them */}
                {!isGameOver && (
                    <AmmoCounter
                        isTouchMode={isTouchMode}
                        touchBottomSafe={TOUCH_BOTTOM_SAFE}
                        touchRightSafe={TOUCH_RIGHT_SAFE}
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
            {isGameOver && <GameOverScreen onQuit={onQuit} />}

            {/* Pause screen */}
            {isPaused && !isGameOver && onResume && (
                <PauseScreen onResume={onResume} onQuit={onQuit} />
            )}

            {/* Touch controls overlay */}
            <TouchControls inputManager={inputManager ?? null} onPause={() => onPause?.()} />
        </>
    );
};
