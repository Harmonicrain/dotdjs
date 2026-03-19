
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
                {/* Title with glitch effect */}
                <div className="relative w-full text-center">
                    <h1 className="text-6xl font-black text-red-800 tracking-[0.3em] uppercase w-full
                                 drop-shadow-[0_0_40px_rgba(127,29,29,0.5)]"
                        style={{ 
                            textShadow: '0 0 60px rgba(127,29,29,0.3), 0 4px 0 rgba(0,0,0,0.8)',
                            fontFamily: 'Bebas Neue, Oswald, sans-serif'
                        }}>
                        DOM OF THE<br/>DEAD
                    </h1>
                    
                    {/* Glitch layers */}
                    <h1 className="absolute inset-0 text-6xl font-black text-red-500/20 tracking-[0.3em] uppercase w-full
                                 translate-x-[2px]"
                        style={{ clipPath: 'inset(30% 0 50% 0)', animation: 'glitchLeft 3s ease-in-out infinite' }}>
                        DOM OF THE<br/>DEAD
                    </h1>
                    <h1 className="absolute inset-0 text-6xl font-black text-cyan-500/10 tracking-[0.3em] uppercase w-full
                                 -translate-x-[2px]"
                        style={{ clipPath: 'inset(60% 0 20% 0)', animation: 'glitchRight 3s ease-in-out infinite' }}>
                        DOM OF THE<br/>DEAD
                    </h1>
                </div>

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
                    
                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                            <div className="w-4 h-4 bg-red-800 rounded-full"
                                 style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                            <div className="absolute inset-0 w-4 h-4 bg-red-600 rounded-full"
                                 style={{ animation: 'ping 1s ease-out infinite' }} />
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
