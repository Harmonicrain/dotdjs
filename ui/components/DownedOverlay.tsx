
import React, { useState, useEffect } from 'react';

interface DownedOverlayProps {
    isDowned: boolean;
    bleedOutTimeRemaining: number;
    isBeingRevived: boolean;
}

export const DownedOverlay: React.FC<DownedOverlayProps> = ({ 
    isDowned, 
    bleedOutTimeRemaining, 
    isBeingRevived 
}) => {
    const [pulseIntensity, setPulseIntensity] = useState(0);
    
    // Calculate urgency-based pulse
    useEffect(() => {
        if (isDowned) {
            const maxTime = 45; // Approximate max bleed out time
            const urgency = 1 - (bleedOutTimeRemaining / maxTime);
            setPulseIntensity(Math.min(1, urgency * 1.5));
        }
    }, [isDowned, bleedOutTimeRemaining]);

    if (!isDowned) return null;

    const isCritical = bleedOutTimeRemaining < 10;
    const isUrgent = bleedOutTimeRemaining < 20;

    return (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
            {/* Desaturated/red-tinted vignette */}
            <div 
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                    background: `radial-gradient(ellipse at center, 
                        transparent 20%, 
                        rgba(80,0,0,${0.3 + pulseIntensity * 0.4}) 60%, 
                        rgba(30,0,0,${0.6 + pulseIntensity * 0.3}) 100%)`,
                    animation: isCritical ? 'criticalPulse 0.5s ease-in-out infinite' : 'none'
                }}
            />
            
            {/* Blood corners */}
            <div className="absolute top-0 left-0 w-64 h-64">
                <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 via-transparent to-transparent" />
            </div>
            <div className="absolute top-0 right-0 w-64 h-64">
                <div className="absolute inset-0 bg-gradient-to-bl from-red-900/40 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 w-64 h-64">
                <div className="absolute inset-0 bg-gradient-to-tr from-red-900/40 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-0 right-0 w-64 h-64">
                <div className="absolute inset-0 bg-gradient-to-tl from-red-900/40 via-transparent to-transparent" />
            </div>
            
            {/* Scan lines effect */}
            <div 
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
                    animation: 'scanLines 8s linear infinite'
                }}
            />
            
            {/* Heartbeat pulse rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                  rounded-full border-2 border-red-600/30"
                        style={{
                            width: '200px',
                            height: '200px',
                            animation: `heartbeatRing ${isCritical ? 0.8 : 1.2}s ease-out ${i * 0.3}s infinite`,
                        }}
                    />
                ))}
            </div>
            
            {/* Main content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {/* DOWNED text */}
                <div className="relative mb-8">
                    <h1 
                        className={`text-6xl font-black tracking-[0.3em] uppercase
                                   ${isCritical ? 'text-red-500' : 'text-red-700'}
                                   drop-shadow-[0_0_30px_rgba(127,29,29,0.8)]`}
                        style={{
                            textShadow: '0 4px 0 rgba(0,0,0,0.5), 0 0 60px rgba(127,29,29,0.5)',
                            animation: isCritical ? 'shake 0.2s ease-in-out infinite' : 'none'
                        }}
                    >
                        DOWNED
                    </h1>
                    
                    {/* Glitch effect */}
                    {isCritical && (
                        <>
                            <h1 className="absolute inset-0 text-6xl font-black tracking-[0.3em] uppercase
                                         text-cyan-500/30 translate-x-[3px]"
                                style={{ clipPath: 'inset(30% 0 50% 0)', animation: 'glitchLeft 0.15s ease-in-out infinite' }}>
                                DOWNED
                            </h1>
                            <h1 className="absolute inset-0 text-6xl font-black tracking-[0.3em] uppercase
                                         text-red-500/30 -translate-x-[3px]"
                                style={{ clipPath: 'inset(60% 0 20% 0)', animation: 'glitchRight 0.15s ease-in-out infinite' }}>
                                DOWNED
                            </h1>
                        </>
                    )}
                </div>
                
                {/* Timer display */}
                <div className="relative">
                    {/* Timer background */}
                    <div className="absolute -inset-4 bg-black/40 rounded-lg blur-lg" />
                    
                    <div className={`relative text-center px-8 py-4 rounded-lg
                                   border ${isCritical ? 'border-red-500/50' : 'border-stone-700/50'}
                                   bg-black/60 backdrop-blur-sm`}>
                        
                        {isBeingRevived ? (
                            // Being revived state
                            <div className="flex flex-col items-center">
                                <div className="text-emerald-400 text-sm tracking-[0.3em] uppercase mb-2 
                                              animate-pulse font-mono">
                                    BEING REVIVED
                                </div>
                                <div className="flex gap-1">
                                    {[...Array(3)].map((_, i) => (
                                        <div 
                                            key={i}
                                            className="w-3 h-3 rounded-full bg-emerald-500"
                                            style={{
                                                animation: `loadingDot 1s ease-in-out ${i * 0.2}s infinite`
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            // Bleed out timer
                            <>
                                <div className="text-stone-500 text-xs tracking-[0.4em] uppercase mb-1 font-mono">
                                    BLEED OUT IN
                                </div>
                                <div className={`text-5xl font-black font-mono tracking-wider
                                               ${isCritical ? 'text-red-500 animate-pulse' : 
                                                 isUrgent ? 'text-amber-500' : 
                                                 'text-stone-200'}`}
                                     style={{
                                         textShadow: isCritical ? '0 0 20px rgba(239,68,68,0.8)' : 'none'
                                     }}>
                                    {bleedOutTimeRemaining.toFixed(1)}
                                    <span className="text-lg text-stone-500 ml-1">s</span>
                                </div>
                                
                                {/* Progress bar */}
                                <div className="mt-3 w-48 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-200 rounded-full
                                                  ${isCritical ? 'bg-red-500' : 
                                                    isUrgent ? 'bg-amber-500' : 
                                                    'bg-stone-400'}`}
                                        style={{ 
                                            width: `${(bleedOutTimeRemaining / 45) * 100}%`,
                                            boxShadow: isCritical ? '0 0 10px rgba(239,68,68,0.8)' : 'none'
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Help text */}
                <div className="mt-8 text-stone-500 text-xs tracking-[0.2em] uppercase font-mono
                              animate-pulse">
                    {isBeingRevived 
                        ? 'HOLD STILL...' 
                        : 'FIGHT TO SURVIVE • CRAWL TO SAFETY'}
                </div>
            </div>
            
            {/* Edge warning flashes when critical */}
            {isCritical && (
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-red-500/50 to-transparent"
                         style={{ animation: 'edgeFlash 0.3s ease-in-out infinite' }} />
                    <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-red-500/50 to-transparent"
                         style={{ animation: 'edgeFlash 0.3s ease-in-out infinite' }} />
                    <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-red-500/50 to-transparent"
                         style={{ animation: 'edgeFlash 0.3s ease-in-out infinite' }} />
                    <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-red-500/50 to-transparent"
                         style={{ animation: 'edgeFlash 0.3s ease-in-out infinite' }} />
                </div>
            )}
        </div>
    );
};
