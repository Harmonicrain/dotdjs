
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

interface RoundDisplayProps {
    round: number;
    isDogRound: boolean;
    activeZombies: number;
    totalZombies: number;
}

// Roman numeral tally marks for round display
const RoundTally: React.FC<{ round: number; isDogRound: boolean }> = ({ round, isDogRound }) => {
    const vCount = Math.floor(round / 5);
    const iCount = round % 5;
    
    return (
        <div className="flex items-center gap-1">
            {/* V marks (groups of 5) */}
            {[...Array(vCount)].map((_, i) => (
                <span 
                    key={`v-${i}`} 
                    className={`text-5xl font-black ${isDogRound ? 'text-red-600' : 'text-red-800'}
                              drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
                    style={{ 
                        animation: `tallyAppear 0.3s ease-out ${i * 0.1}s both`,
                        textShadow: isDogRound 
                            ? '0 0 30px rgba(220,38,38,0.8), 0 4px 0 rgba(0,0,0,0.8)' 
                            : '0 0 20px rgba(127,29,29,0.5), 0 4px 0 rgba(0,0,0,0.8)'
                    }}
                >
                    V
                </span>
            ))}
            {/* I marks (remainder) */}
            {[...Array(iCount)].map((_, i) => (
                <span 
                    key={`i-${i}`} 
                    className={`text-5xl font-black ${isDogRound ? 'text-red-600' : 'text-red-800'}
                              drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
                    style={{ 
                        animation: `tallyAppear 0.3s ease-out ${(vCount + i) * 0.1}s both`,
                        textShadow: isDogRound 
                            ? '0 0 30px rgba(220,38,38,0.8), 0 4px 0 rgba(0,0,0,0.8)' 
                            : '0 0 20px rgba(127,29,29,0.5), 0 4px 0 rgba(0,0,0,0.8)'
                    }}
                >
                    I
                </span>
            ))}
        </div>
    );
};

// Animated stat bar
const StatBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ 
    label, value, max, color 
}) => {
    const percent = max > 0 ? (value / max) * 100 : 0;
    
    return (
        <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-stone-500 uppercase tracking-wider w-16">{label}</span>
            <div className="w-20 h-1.5 bg-black/50 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${color} transition-all duration-500 ease-out rounded-full`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="text-stone-400 w-8 text-right">{value}</span>
        </div>
    );
};

export const RoundDisplay: React.FC<RoundDisplayProps> = ({ round, isDogRound, activeZombies, totalZombies }) => {
    const isPreRound = round === 0;
    const [showNewRound, setShowNewRound] = useState(false);
    const prevRoundRef = useRef(round);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    
    const zombiesSpawned = useGameStore(s => s.zombiesSpawned);
    const zombiesKilled = useGameStore(s => s.zombiesKilledInRound);
    const zombiesToSpawn = useGameStore(s => s.zombiesToSpawn);

    // Detect round change for animation - using ref to avoid dependency issues
    useEffect(() => {
        if (round !== prevRoundRef.current && round > 0) {
            // Clear any existing timer
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            
            setShowNewRound(true);
            prevRoundRef.current = round;
            
            // Set timer to hide the overlay
            timerRef.current = setTimeout(() => {
                setShowNewRound(false);
                timerRef.current = null;
            }, 3000);
        }
        
        // Cleanup on unmount
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [round]);

    return (
        <>
            {/* Main round display - top left */}
            <div className="absolute top-6 left-6 pointer-events-none select-none z-30">
                {/* Background accent */}
                <div className="absolute -inset-4 bg-gradient-to-br from-black/40 via-transparent to-transparent 
                              rounded-lg blur-lg" />
                
                <div className="relative">
                    {/* Round number */}
                    <div className={`relative ${isDogRound ? 'animate-pulse' : ''}`}>
                        {!isPreRound ? (
                            <RoundTally round={round} isDogRound={isDogRound} />
                        ) : (
                            <div className="h-14" /> // Placeholder height
                        )}
                        
                        {/* Glitch effect for dog rounds */}
                        {isDogRound && !isPreRound && (
                            <>
                                <div className="absolute inset-0 text-red-500/30 translate-x-[2px]"
                                     style={{ clipPath: 'inset(30% 0 50% 0)' }}>
                                    <RoundTally round={round} isDogRound={isDogRound} />
                                </div>
                                <div className="absolute inset-0 text-cyan-500/20 -translate-x-[2px]"
                                     style={{ clipPath: 'inset(60% 0 20% 0)' }}>
                                    <RoundTally round={round} isDogRound={isDogRound} />
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* "ROUND" label with decorative line */}
                    <div className="flex items-center gap-3 mt-2">
                        <div className={`h-[2px] w-8 ${isDogRound ? 'bg-red-600/80' : 'bg-red-900/60'}`} />
                        <span className="text-stone-500 text-[10px] tracking-[0.5em] uppercase font-bold font-mono">
                            {isDogRound ? 'HELLHOUND' : 'ROUND'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Zombie/Enemy stats - below round display */}
            {!isPreRound && (
                <div className="absolute top-28 left-6 pointer-events-none select-none z-30">
                    <div className="bg-black/30 backdrop-blur-sm rounded px-3 py-2 border-l-2 border-red-900/50">
                        <div className={`text-[9px] tracking-[0.3em] font-bold uppercase mb-2 font-mono
                                       ${isDogRound ? 'text-red-500' : 'text-stone-500'}`}>
                            {isDogRound ? '🐕 HELLHOUNDS' : '☠ ZOMBIES'}
                        </div>
                        
                        <div className="space-y-1.5">
                            <StatBar 
                                label="Spawned" 
                                value={zombiesSpawned} 
                                max={zombiesSpawned + zombiesToSpawn}
                                color="bg-amber-600"
                            />
                            <StatBar 
                                label="Killed" 
                                value={zombiesKilled} 
                                max={zombiesSpawned + zombiesToSpawn}
                                color="bg-red-600"
                            />
                            <StatBar 
                                label="Remaining" 
                                value={zombiesToSpawn} 
                                max={zombiesSpawned + zombiesToSpawn}
                                color="bg-stone-500"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* New round cinematic overlay */}
            {showNewRound && (
                <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
                    {/* Dark vignette */}
                    <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/30 to-black/60" 
                         style={{ animation: 'fadeInOut 3s ease-in-out forwards' }} />
                    
                    {/* Round announcement */}
                    <div className="relative text-center" style={{ animation: 'roundReveal 3s ease-out forwards' }}>
                        {/* Large round number */}
                        <div className={`text-[180px] font-black leading-none
                                       ${isDogRound ? 'text-red-600' : 'text-red-800'}
                                       drop-shadow-[0_0_60px_rgba(127,29,29,0.8)]`}
                             style={{ 
                                 animation: 'scaleIn 0.5s ease-out forwards',
                                 textShadow: '0 0 100px rgba(127,29,29,0.5), 0 8px 0 rgba(0,0,0,0.8)'
                             }}>
                            {round}
                        </div>
                        
                        {/* "ROUND" text */}
                        <div className="text-stone-500 text-2xl tracking-[1em] uppercase font-bold mt-4 font-mono"
                             style={{ animation: 'slideUp 0.5s ease-out 0.2s both' }}>
                            {isDogRound ? 'HELLHOUND ROUND' : 'ROUND'}
                        </div>
                        
                        {/* Decorative lines */}
                        <div className="flex items-center justify-center gap-8 mt-6"
                             style={{ animation: 'slideUp 0.5s ease-out 0.4s both' }}>
                            <div className="w-32 h-[1px] bg-gradient-to-r from-transparent to-red-900/50" />
                            <div className={`w-3 h-3 rotate-45 border ${isDogRound ? 'border-red-600' : 'border-red-900/50'}`} />
                            <div className="w-32 h-[1px] bg-gradient-to-l from-transparent to-red-900/50" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
