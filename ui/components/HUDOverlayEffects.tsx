
import React from 'react';
import { GAME_CONFIG } from '../../config';
import { useGameStore } from '../../store/useGameStore';

export const HUDOverlayEffects: React.FC = () => {
    const health = useGameStore(s => s.health);
    const perks = useGameStore(s => s.perks);
    const flashColor = useGameStore(s => s.flashColor);
    const showFade = useGameStore(s => s.showFade);

    const maxHP = perks['juggernog'] ? GAME_CONFIG.PLAYER_JUGG_HEALTH : GAME_CONFIG.PLAYER_BASE_HEALTH;
    const bloodOpacity = Math.max(0, (maxHP - health) / maxHP);
    const isCritical = bloodOpacity > 0.6;

    return (
        <>
            {/* Film grain noise overlay */}
            <div
                className="absolute inset-0 pointer-events-none z-10 opacity-[0.04] mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    animation: isCritical ? 'none' : undefined
                }}
            />

            {/* Subtle scan lines */}
            <div
                className="absolute inset-0 pointer-events-none z-10 opacity-[0.02]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
                    backgroundSize: '100% 4px'
                }}
            />

            {/* Vignette - base */}
            <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,5,0,0.3) 70%, rgba(0,0,0,0.85) 100%)'
                }}
            />

            {/* Blood/damage vignette overlay */}
            <div
                className="absolute inset-0 pointer-events-none z-15 transition-opacity duration-500 ease-in-out"
                style={{
                    background: 'radial-gradient(ellipse at center, transparent 30%, rgba(80,0,0,0.3) 60%, rgba(60,0,0,0.9) 100%)',
                    opacity: bloodOpacity * 1.2,
                    mixBlendMode: 'multiply'
                }}
            />

            {/* Blood pulse inner shadow */}
            <div
                className="absolute inset-0 pointer-events-none z-15 transition-opacity duration-300"
                style={{
                    boxShadow: `inset 0 0 ${bloodOpacity * 120}px rgba(80,0,0,0.9)`,
                    opacity: bloodOpacity
                }}
            />

            {/* Critical health chromatic aberration effect */}
            {isCritical && (
                <>
                    {/* Red channel shift */}
                    <div
                        className="absolute inset-0 pointer-events-none z-16 mix-blend-screen opacity-10"
                        style={{
                            background: 'linear-gradient(90deg, rgba(255,0,0,0.3) 0%, transparent 10%, transparent 90%, rgba(255,0,0,0.3) 100%)',
                            animation: 'pulse 0.5s ease-in-out infinite'
                        }}
                    />

                    {/* Heartbeat pulse overlay */}
                    <div
                        className="absolute inset-0 pointer-events-none z-16"
                        style={{
                            background: 'radial-gradient(circle at center, transparent 60%, rgba(100,0,0,0.4) 100%)',
                            animation: 'criticalPulse 0.8s ease-in-out infinite'
                        }}
                    />
                </>
            )}

            {/* Flash overlay (damage flash, pickup flash, etc.) */}
            <div
                className="absolute inset-0 pointer-events-none transition-all duration-75 z-40"
                style={{
                    backgroundColor: flashColor || 'transparent',
                    opacity: flashColor ? 0.3 : 0
                }}
            />

            {/* Fade to black overlay */}
            <div
                className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-[2000ms] z-50 
                          ${showFade ? 'opacity-100' : 'opacity-0'}`}
            />
        </>
    );
};
