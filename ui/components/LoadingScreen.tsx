
import React, { useEffect, useState } from 'react';

const TIPS = [
    "AIM FOR THE HEAD TO CONSERVE AMMO AND DEAL CRITICAL DAMAGE.",
    "PURCHASE JUGGERNOG TO INCREASE YOUR HEALTH SURVIVABILITY.",
    "SPEED COLA DRASTICALLY REDUCES RELOAD TIMES.",
    "THE MYSTERY BOX CAN GRANT POWERFUL EXPERIMENTAL WEAPONRY.",
    "KEEP MOVING TO AVOID GETTING TRAPPED BY THE HORDE.",
    "REPAIR BARRIERS TO SLOW DOWN THE UNDEAD ENTRY.",
    "HELLHOUNDS EXPLODE ON DEATH—MAINTAIN DISTANCE.",
    "PACK-A-PUNCH WEAPONS GAIN INCREASED DAMAGE AND AMMO CAPACITY.",
    "QUICK REVIVE ALLOWS FASTER TEAMMATE REVIVAL IN CO-OP.",
    "MAXIMIZE POINTS BY USING PISTOL HEADSHOTS IN EARLY ROUNDS."
];

import { GameLogo } from './GameLogo';

const LOADING_PHASES = [
    "ESTABLISHING SECURE CONNECTION",
    "LOADING COMBAT ASSETS",
    "INITIALIZING THREAT ANALYSIS",
    "CALIBRATING DEFENSE SYSTEMS",
    "PREPARING DROP ZONE"
];

interface LoadingScreenProps {
    isVisible: boolean;
    mapName: string;
}

// Animated loading bar segments
const LoadingBarSegment = ({ filled, index }: { filled: boolean; index: number }) => (
    <div 
        className={`h-full flex-1 transition-all duration-300 ${
            filled ? 'bg-red-700' : 'bg-stone-900'
        }`}
        style={{ 
            transitionDelay: `${index * 30}ms`,
            boxShadow: filled ? '0 0 10px rgba(185,28,28,0.5)' : 'none'
        }}
    />
);

// Animated hex grid background
const HexGrid = () => (
    <div className="absolute inset-0 overflow-hidden opacity-5">
        <svg width="100%" height="100%" className="absolute inset-0">
            <defs>
                <pattern id="hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
                    <polygon 
                        points="24.8,22 37.3,29.2 37.3,43.7 24.8,50.9 12.3,43.7 12.3,29.2" 
                        fill="none" 
                        stroke="rgba(185,28,28,0.3)" 
                        strokeWidth="0.5"
                    />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hexagons)" />
        </svg>
    </div>
);

export const LoadingScreen = ({ isVisible, mapName }: LoadingScreenProps) => {
    const [tip, setTip] = useState(TIPS[0]);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState(0);
    const [dots, setDots] = useState('');

    // Rotate tips
    useEffect(() => {
        if (isVisible) {
            setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
            setProgress(0);
            setPhase(0);
            
            // Progress animation
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    const inc = Math.random() * 12;
                    return Math.min(prev + inc, 95);
                });
            }, 200);
            
            // Phase cycling
            const phaseInterval = setInterval(() => {
                setPhase(prev => (prev + 1) % LOADING_PHASES.length);
            }, 2000);
            
            // Animated dots
            const dotsInterval = setInterval(() => {
                setDots(prev => prev.length >= 3 ? '' : prev + '.');
            }, 400);
            
            return () => {
                clearInterval(progressInterval);
                clearInterval(phaseInterval);
                clearInterval(dotsInterval);
            };
        } else {
            setProgress(100);
        }
    }, [isVisible]);

    const visibilityClass = isVisible 
        ? 'opacity-100 pointer-events-auto' 
        : 'opacity-0 pointer-events-none transition-opacity duration-1000';

    const segmentCount = 40;
    const filledSegments = Math.floor((progress / 100) * segmentCount);

    return (
        <div className={`absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center ${visibilityClass}`}>
            {/* Animated background elements */}
            <HexGrid />
            
            {/* Noise texture */}
            <div 
                className="absolute inset-0 opacity-[0.03]"
                style={{ 
                    backgroundImage: 'url("https://playground.babylonjs.com/textures/noise.png")',
                    backgroundSize: '200px'
                }}
            />
            
            {/* Radial gradient overlay */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/50 to-black" />
            
            {/* Scan line effect */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-[0.02]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)'
                }}
            />
            
            {/* Animated corner decorations */}
            <div className="absolute top-8 left-8 w-24 h-24">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-800 to-transparent" 
                     style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                <div className="absolute top-0 left-0 h-full w-[2px] bg-gradient-to-b from-red-800 to-transparent"
                     style={{ animation: 'pulse 2s ease-in-out infinite' }} />
            </div>
            <div className="absolute top-8 right-8 w-24 h-24">
                <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-800 to-transparent"
                     style={{ animation: 'pulse 2s ease-in-out infinite 0.5s' }} />
                <div className="absolute top-0 right-0 h-full w-[2px] bg-gradient-to-b from-red-800 to-transparent"
                     style={{ animation: 'pulse 2s ease-in-out infinite 0.5s' }} />
            </div>
            <div className="absolute bottom-8 left-8 w-24 h-24">
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-red-800 to-transparent"
                     style={{ animation: 'pulse 2s ease-in-out infinite 1s' }} />
                <div className="absolute bottom-0 left-0 h-full w-[2px] bg-gradient-to-t from-red-800 to-transparent"
                     style={{ animation: 'pulse 2s ease-in-out infinite 1s' }} />
            </div>
            <div className="absolute bottom-8 right-8 w-24 h-24">
                <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-red-800 to-transparent"
                     style={{ animation: 'pulse 2s ease-in-out infinite 1.5s' }} />
                <div className="absolute bottom-0 right-0 h-full w-[2px] bg-gradient-to-t from-red-800 to-transparent"
                     style={{ animation: 'pulse 2s ease-in-out infinite 1.5s' }} />
            </div>

            {/* Main content */}
            <div className="z-10 flex flex-col items-center justify-center text-center gap-8 max-w-2xl px-8">
                {/* Unified Game Logo */}
                <GameLogo scale={0.5} className="-my-12" />

                {/* Map name */}
                {mapName && (
                    <div className="text-stone-500 text-sm tracking-[0.5em] uppercase font-mono
                                  border border-stone-800 px-6 py-2 bg-black/50">
                        OPERATION: <span className="text-stone-300">{mapName}</span>
                    </div>
                )}

                {/* Animated spinner */}
                <div className="relative w-32 h-32 my-4">
                    {/* Outer ring */}
                    <div className="absolute inset-0 border-2 border-stone-800 rounded-full" />
                    
                    {/* Spinning ring */}
                    <div className="absolute inset-0 border-2 border-transparent border-t-red-700 rounded-full"
                         style={{ animation: 'spin 1.5s linear infinite' }} />
                    
                    {/* Counter-spinning ring */}
                    <div className="absolute inset-2 border-2 border-transparent border-b-red-900/50 rounded-full"
                         style={{ animation: 'spin 2s linear infinite reverse' }} />
                    
                    {/* Inner pulse */}
                    <div className="absolute inset-4 border border-stone-800 rounded-full opacity-50" />
                    
                    {/* Center skull */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-8 h-8" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-red-800 drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]">
                                <path d="M12,2C7.58,2 4,5.58 4,10C4,12.7 5.25,15.09 7.1,16.59C7.45,16.86 7.6,17.3 7.6,17.75V19.5C7.6,20.88 8.72,22 10.1,22H13.9C15.28,22 16.4,20.88 16.4,19.5V17.75C16.4,17.3 16.55,16.86 16.9,16.59C18.75,15.09 20,12.7 20,10C20,5.58 16.42,2 12,2M9,13C7.9,13 7,12.1 7,11C7,9.9 7.9,9 9,9C10.1,9 11,9.9 11,11C11,12.1 10.1,13 9,13M15,13C13.9,13 13,12.1 13,11C13,9.9 13.9,9 15,9C16.1,9 17,9.9 17,11C17,12.1 16.1,13 15,13M13,17H11V16H13V17Z" />
                            </svg>
                            {/* Glowing eyes */}
                            <div className="absolute w-[4px] h-[4px] bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" 
                                 style={{ top: '45.83%', left: '37.5%', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                            <div className="absolute w-[4px] h-[4px] bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" 
                                 style={{ top: '45.83%', left: '62.5%', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite 0.2s' }} />
                        </div>
                    </div>
                    
                    {/* Orbiting dots */}
                    {[0, 1, 2].map((i) => (
                        <div 
                            key={i}
                            className="absolute inset-0"
                            style={{ animation: `spin ${3 + i}s linear infinite`, animationDelay: `${i * 0.5}s` }}
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                                          w-2 h-2 bg-red-700/50 rounded-full" />
                        </div>
                    ))}
                </div>

                {/* Loading phase text */}
                <div className="text-center space-y-2">
                    <p className="text-red-700 text-xs tracking-[0.4em] font-mono uppercase">
                        {LOADING_PHASES[phase]}{dots}
                    </p>
                </div>

                {/* Segmented progress bar */}
                <div className="w-full max-w-md">
                    <div className="flex gap-[2px] h-2 bg-black border border-stone-800 p-[2px] rounded-sm">
                        {Array.from({ length: segmentCount }).map((_, i) => (
                            <LoadingBarSegment key={i} filled={i < filledSegments} index={i} />
                        ))}
                    </div>
                    
                    {/* Progress percentage */}
                    <div className="flex justify-between mt-2 text-[10px] font-mono">
                        <span className="text-stone-600 tracking-widest">PROGRESS</span>
                        <span className="text-red-700 font-bold">{Math.round(progress)}%</span>
                    </div>
                </div>

                {/* Tip box */}
                <div className="mt-4 max-w-lg text-center relative">
                    <div className="absolute -inset-4 bg-gradient-to-r from-transparent via-red-900/5 to-transparent" />
                    
                    <p className="text-stone-600 text-[9px] tracking-[0.4em] uppercase mb-2 font-mono">
                        ⚠ TACTICAL INTEL
                    </p>
                    <div className="border-t border-b border-stone-800/50 py-4">
                        <p className="text-stone-500 text-xs tracking-wider leading-relaxed font-mono">
                            {tip}
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Bottom info bar */}
            <div className="absolute bottom-4 left-0 right-0 px-8 flex justify-between items-center">
                <div className="text-[10px] text-stone-700 tracking-[0.2em] font-mono">
                    SECURE CONNECTION ESTABLISHED
                </div>
                <div className="text-[10px] text-stone-800 tracking-[0.2em] flex gap-3 font-mono">
                    <span>BUILD 0.9.9</span>
                    <span className="text-red-900">◆</span>
                    <span>CLASSIFIED</span>
                </div>
            </div>
        </div>
    );
};
