
import React, { useState, useEffect } from 'react';
import { PowerUpType } from '../../types/index';
import { useGameStore } from '../../store/useGameStore';

interface PowerUpIconProps {
    type: PowerUpType;
    expireTime: number;
}

const PowerUpIcon: React.FC<PowerUpIconProps> = ({ type, expireTime }) => {
    const isPaused = useGameStore(s => s.isPaused);
    const isConsoleOpen = useGameStore(s => s.isConsoleOpen);
    const isLogicFrozen = isPaused || isConsoleOpen;

    const [timeLeft, setTimeLeft] = useState(Math.max(0, expireTime - Date.now()));

    // Keep it explicitly in sync when expireTime changes (e.g. from pause offset shift)
    useEffect(() => {
        setTimeLeft(Math.max(0, expireTime - Date.now()));
    }, [expireTime]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!isLogicFrozen) {
                setTimeLeft(Math.max(0, expireTime - Date.now()));
            }
        }, 100);
        return () => clearInterval(interval);
    }, [expireTime, isLogicFrozen]);

    const isExpiring = timeLeft < 5000;
    const isBlinking = timeLeft < 3000;
    const seconds = Math.max(0, Math.ceil(timeLeft / 1000));

    // Power-up configurations
    const config: Record<PowerUpType, {
        icon: string;
        label: string;
        bgGradient: string;
        glowColor: string;
        borderColor: string;
    }> = {
        [PowerUpType.INSTA_KILL]: {
            icon: '☠',
            label: 'INSTA-KILL',
            bgGradient: 'from-red-600 via-red-700 to-red-900',
            glowColor: 'rgba(220,38,38,0.8)',
            borderColor: 'border-red-400/50'
        },
        [PowerUpType.DOUBLE_POINTS]: {
            icon: '×2',
            label: 'DOUBLE POINTS',
            bgGradient: 'from-amber-500 via-amber-600 to-amber-800',
            glowColor: 'rgba(245,158,11,0.8)',
            borderColor: 'border-amber-300/50'
        },
        [PowerUpType.MAX_AMMO]: {
            icon: '∞',
            label: 'MAX AMMO',
            bgGradient: 'from-emerald-500 via-emerald-600 to-emerald-800',
            glowColor: 'rgba(16,185,129,0.8)',
            borderColor: 'border-emerald-300/50'
        },
        [PowerUpType.NUKE]: {
            icon: '☢',
            label: 'NUKE',
            bgGradient: 'from-yellow-400 via-orange-500 to-red-600',
            glowColor: 'rgba(251,191,36,0.8)',
            borderColor: 'border-yellow-300/50'
        },
        [PowerUpType.CARPENTER]: {
            icon: '🔨',
            label: 'CARPENTER',
            bgGradient: 'from-amber-700 via-amber-800 to-amber-900',
            glowColor: 'rgba(180,83,9,0.8)',
            borderColor: 'border-amber-500/50'
        },
        [PowerUpType.FIRE_SALE]: {
            icon: '$',
            label: 'FIRE SALE',
            bgGradient: 'from-blue-500 via-blue-600 to-blue-800',
            glowColor: 'rgba(59,130,246,0.8)',
            borderColor: 'border-blue-300/50'
        },
    };

    const powerUpConfig = config[type];
    if (!powerUpConfig) return null;

    return (
        <div
            className={`relative group ${isBlinking ? 'animate-pulse' : ''}`}
            style={{ animation: 'powerUpAppear 0.5s ease-out' }}
        >
            {/* Outer glow */}
            <div
                className="absolute -inset-2 rounded-lg blur-lg opacity-60"
                style={{
                    background: `radial-gradient(circle, ${powerUpConfig.glowColor} 0%, transparent 70%)`,
                    animation: 'pulseGlow 1.5s ease-in-out infinite'
                }}
            />

            {/* Main container */}
            <div className={`relative w-14 h-14 rounded-lg overflow-hidden
                           bg-gradient-to-br ${powerUpConfig.bgGradient}
                           border-2 ${powerUpConfig.borderColor}
                           shadow-lg transition-transform duration-200
                           ${isExpiring ? 'scale-95' : 'scale-100'}`}
                style={{
                    boxShadow: `0 0 20px ${powerUpConfig.glowColor}, inset 0 0 20px rgba(255,255,255,0.1)`
                }}>

                {/* Inner shine */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20" />

                {/* Rotating border effect */}
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                    <div
                        className="absolute inset-[-50%] bg-gradient-conic from-white/30 via-transparent to-white/30"
                        style={{ animation: 'spin 3s linear infinite' }}
                    />
                </div>

                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`${type === PowerUpType.DOUBLE_POINTS ? 'text-xl' : 'text-2xl'} 
                                    font-black text-white drop-shadow-lg`}>
                        {powerUpConfig.icon}
                    </span>
                </div>

                {/* Timer ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                        cx="28" cy="28" r="24"
                        fill="none"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="3"
                    />
                    <circle
                        cx="28" cy="28" r="24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 24}`}
                        strokeDashoffset={`${2 * Math.PI * 24 * (1 - Math.min(timeLeft / 30000, 1))}`}
                        className="transition-all duration-100"
                        style={{ filter: 'drop-shadow(0 0 4px white)' }}
                    />
                </svg>
            </div>

            {/* Timer text */}
            <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 
                           text-[10px] font-bold font-mono tracking-wider
                           ${isExpiring ? 'text-red-400 animate-pulse' : 'text-white/80'}`}>
                {seconds}s
            </div>

            {/* Label tooltip on hover - visible on larger screens */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100
                          transition-opacity duration-200 whitespace-nowrap
                          bg-black/90 px-2 py-1 rounded text-[9px] font-bold tracking-wider text-white/90
                          pointer-events-none">
                {powerUpConfig.label}
            </div>
        </div>
    );
};

export const PowerUpDisplay: React.FC = () => {
    const activePowerUps = useGameStore(s => s.activePowerUps);
    const activePowerUpEntries = Object.entries(activePowerUps)
        .map(([type, expTime]) => ({ type: type as PowerUpType, expTime: expTime! }));

    if (activePowerUpEntries.length === 0) return null;

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 
                      flex gap-4 pointer-events-none select-none">
            {activePowerUpEntries.map(({ type, expTime }) => (
                <PowerUpIcon key={type} type={type} expireTime={expTime} />
            ))}
        </div>
    );
};
