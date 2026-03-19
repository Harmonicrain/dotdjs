
import React, { useState, useEffect, useRef } from 'react';
import { GAME_CONFIG } from '../../config';

// Stylized points icon
export const PointsIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
);

// Animated point notification
const PointNotification = ({ value, id }: { value: number; id: string }) => {
    const isPositive = value > 0;
    const text = isPositive ? `+${value}` : `${value}`;
    
    return (
        <div 
            key={id}
            className={`text-2xl font-black font-mono tracking-tight pointer-events-none select-none
                       flex items-center gap-1 whitespace-nowrap
                       ${isPositive ? 'text-amber-400' : 'text-red-500'}`}
            style={{
                animation: 'pointFloat 1.5s ease-out forwards',
                textShadow: isPositive 
                    ? '0 0 20px rgba(251,191,36,0.8), 0 2px 0 rgba(0,0,0,0.5)' 
                    : '0 0 20px rgba(239,68,68,0.8), 0 2px 0 rgba(0,0,0,0.5)'
            }}
        >
            {text}
        </div>
    );
};

// Perk icon with glow effect
const PerkIcon = ({ type, active }: { type: string; active: boolean }) => {
    if (!active) return null;
    
    const perkStyles: Record<string, { bg: string; glow: string; icon: string }> = {
        juggernog: { 
            bg: 'bg-gradient-to-br from-red-600 to-red-900', 
            glow: 'shadow-[0_0_15px_rgba(220,38,38,0.8),inset_0_0_10px_rgba(255,255,255,0.2)]',
            icon: '❤'
        },
        speedCola: { 
            bg: 'bg-gradient-to-br from-emerald-500 to-emerald-800', 
            glow: 'shadow-[0_0_15px_rgba(16,185,129,0.8),inset_0_0_10px_rgba(255,255,255,0.2)]',
            icon: '⚡'
        },
        quickRevive: {
            bg: 'bg-gradient-to-br from-cyan-400 to-cyan-700',
            glow: 'shadow-[0_0_15px_rgba(34,211,238,0.8),inset_0_0_10px_rgba(255,255,255,0.2)]',
            icon: '✚'
        },
        doubleTap: {
            bg: 'bg-gradient-to-br from-amber-500 to-amber-800',
            glow: 'shadow-[0_0_15px_rgba(245,158,11,0.8),inset_0_0_10px_rgba(255,255,255,0.2)]',
            icon: '💥'
        },
    };
    
    const style = perkStyles[type] || perkStyles.juggernog;
    
    return (
        <div 
            className={`w-6 h-6 rounded ${style.bg} ${style.glow} 
                       flex items-center justify-center text-white text-xs font-bold
                       border border-white/30 transition-all duration-300
                       hover:scale-110`}
            title={type}
            style={{ animation: 'perkPulse 2s ease-in-out infinite' }}
        >
            {style.icon}
        </div>
    );
};

interface PlayerStatusProps {
    name: string;
    hp: number;
    pts: number;
    perks: Record<string, boolean>;
    opacity?: number;
    isLocal?: boolean;
}

export const PlayerStatus = ({ 
    name, hp, pts, perks, opacity = 1, isLocal = false 
}: PlayerStatusProps) => {
    const prevPts = useRef(pts);
    const prevHp = useRef(hp);
    const [diffs, setDiffs] = useState<{id: string, val: number}[]>([]);
    const [healthFlash, setHealthFlash] = useState<'damage' | 'heal' | null>(null);
    const [showCritical, setShowCritical] = useState(false);

    // Point change detection
    useEffect(() => {
        const diff = pts - prevPts.current;
        if (diff !== 0 && Math.abs(diff) < 100000) { 
            const id = Math.random().toString(36).substr(2, 9);
            setDiffs(prev => [...prev.slice(-4), { id, val: diff }]);
            setTimeout(() => {
                setDiffs(prev => prev.filter(d => d.id !== id));
            }, 1500);
        }
        prevPts.current = pts;
    }, [pts]);

    // Health change detection
    useEffect(() => {
        if (hp < prevHp.current) {
            setHealthFlash('damage');
            setTimeout(() => setHealthFlash(null), 200);
        } else if (hp > prevHp.current) {
            setHealthFlash('heal');
            setTimeout(() => setHealthFlash(null), 300);
        }
        prevHp.current = hp;
    }, [hp]);

    const maxHP = perks['juggernog'] ? GAME_CONFIG.PLAYER_JUGG_HEALTH : GAME_CONFIG.PLAYER_BASE_HEALTH;
    const hpPercent = Math.min(100, Math.max(0, (hp / maxHP) * 100));
    const isCritical = hpPercent < 25 && hpPercent > 0;
    const isDead = hp <= 0;

    // Critical health warning
    useEffect(() => {
        setShowCritical(isCritical);
    }, [isCritical]);

    return (
        <div 
            className={`mb-4 transition-all duration-300 relative
                       ${isLocal ? 'scale-100' : 'scale-90 opacity-70'}`}
            style={{ opacity }}
        >
            {/* Background glow for local player */}
            {isLocal && (
                <div className="absolute -inset-3 bg-gradient-to-r from-black/40 via-black/20 to-transparent 
                              rounded-lg blur-lg pointer-events-none" />
            )}
            
            <div className="relative">
                {/* Player name and perks row */}
                <div className="flex items-center gap-3 mb-2">
                    {/* Name with rank indicator */}
                    <div className="flex items-center gap-2">
                        <div className={`w-1 h-6 rounded-full transition-all duration-300 ${
                            isDead ? 'bg-red-600' : 
                            isCritical ? 'bg-amber-500 animate-pulse' : 
                            'bg-emerald-500'
                        }`} />
                        <span className={`text-sm font-bold tracking-[0.2em] uppercase font-mono
                                        ${isLocal ? 'text-stone-200' : 'text-stone-400'}
                                        ${isDead ? 'line-through opacity-50' : ''}`}>
                            {name}
                        </span>
                    </div>
                    
                    {/* Perk icons */}
                    <div className="flex gap-1.5 ml-2">
                        <PerkIcon type="juggernog" active={perks['juggernog']} />
                        <PerkIcon type="speedCola" active={perks['speedCola']} />
                        <PerkIcon type="quickRevive" active={perks['quickRevive']} />
                        <PerkIcon type="doubleTap" active={perks['doubleTap']} />
                    </div>
                    
                    {/* KIA indicator */}
                    {isDead && (
                        <span className="text-red-600 font-black text-xs tracking-widest uppercase
                                       animate-pulse ml-2 font-mono
                                       border border-red-600/50 px-2 py-0.5 rounded">
                            KIA
                        </span>
                    )}
                </div>

                {/* Health bar container */}
                <div className={`relative w-72 h-4 overflow-hidden rounded-sm
                               transition-all duration-200
                               ${healthFlash === 'damage' ? 'scale-[1.02]' : ''}
                               ${healthFlash === 'heal' ? 'scale-[1.01]' : ''}`}>
                    {/* Background */}
                    <div className="absolute inset-0 bg-black/80 border border-stone-700/50" />
                    
                    {/* Health bar segments for visual interest */}
                    <div className="absolute inset-0 flex">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className="flex-1 border-r border-black/30 last:border-r-0" />
                        ))}
                    </div>
                    
                    {/* Actual health bar */}
                    <div 
                        className={`absolute inset-y-0 left-0 transition-all duration-300 ease-out
                                  ${isCritical ? 'animate-pulse' : ''}`}
                        style={{ width: `${hpPercent}%` }}
                    >
                        {/* Gradient fill */}
                        <div className={`absolute inset-0 ${
                            isCritical ? 'bg-gradient-to-r from-red-700 via-red-600 to-red-500' :
                            hpPercent > 50 ? 'bg-gradient-to-r from-stone-400 via-stone-300 to-stone-200' :
                            'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500'
                        }`} />
                        
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20" />
                        
                        {/* Animated highlight */}
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
                        </div>
                    </div>
                    
                    {/* Damage flash overlay */}
                    {healthFlash === 'damage' && (
                        <div className="absolute inset-0 bg-red-500/40" 
                             style={{ animation: 'flashFade 0.2s ease-out' }} />
                    )}
                    
                    {/* Heal flash overlay */}
                    {healthFlash === 'heal' && (
                        <div className="absolute inset-0 bg-emerald-400/30" 
                             style={{ animation: 'flashFade 0.3s ease-out' }} />
                    )}
                    
                    {/* HP text */}
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-[10px] font-mono font-bold text-white/80 
                                       drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                            {Math.round(hp)}/{maxHP}
                        </span>
                    </div>
                </div>

                {/* Points display */}
                <div className="mt-2 flex items-center gap-2 relative">
                    <PointsIcon className="w-5 h-5 text-amber-500 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <span className={`text-2xl font-black font-mono tracking-wider
                                    ${isLocal ? 'text-amber-400' : 'text-amber-500/70'}
                                    drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
                          style={{ textShadow: '0 0 20px rgba(251,191,36,0.3)' }}>
                        {pts.toLocaleString()}
                    </span>

                    {/* Point notifications */}
                    <div className="absolute left-full top-0 ml-3 flex flex-col-reverse gap-0 w-32 pointer-events-none">
                        {diffs.map(d => <PointNotification key={d.id} value={d.val} id={d.id} />)}
                    </div>
                </div>

                {/* Critical health warning */}
                {showCritical && isLocal && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 
                                  text-red-500 text-[10px] font-bold tracking-wider uppercase
                                  animate-pulse font-mono">
                        ⚠ CRITICAL
                    </div>
                )}
            </div>
        </div>
    );
};
