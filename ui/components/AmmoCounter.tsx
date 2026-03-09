
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

// Individual bullet indicator for visual feedback
const BulletIndicator: React.FC<{ filled: boolean; index: number }> = ({ filled, index }) => (
    <div
        className={`w-[3px] h-3 rounded-sm transition-all duration-150 ${filled
                ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                : 'bg-stone-700/50'
            }`}
        style={{
            transitionDelay: `${index * 10}ms`,
            transform: filled ? 'scaleY(1)' : 'scaleY(0.6)'
        }}
    />
);

export const AmmoCounter: React.FC = () => {
    const weaponName = useGameStore(s => s.weaponName);
    const ammo = useGameStore(s => s.ammo);
    const reserveAmmo = useGameStore(s => s.reserveAmmo);
    const maxClip = useGameStore(s => s.maxClip);

    const lowAmmoThreshold = maxClip > 2 ? Math.ceil(maxClip * 0.25) : 1;
    const isLowAmmo = ammo <= lowAmmoThreshold;
    const isEmpty = ammo === 0;
    const prevAmmo = useRef(ammo);
    const [isReloading, setIsReloading] = useState(false);
    const [showMuzzleFlash, setShowMuzzleFlash] = useState(false);

    // Detect shot fired
    useEffect(() => {
        if (ammo < prevAmmo.current && ammo >= 0) {
            setShowMuzzleFlash(true);
            setTimeout(() => setShowMuzzleFlash(false), 50);
        }
        // Detect reload (ammo increased significantly)
        if (ammo > prevAmmo.current && ammo - prevAmmo.current > 1) {
            setIsReloading(true);
            setTimeout(() => setIsReloading(false), 300);
        }
        prevAmmo.current = ammo;
    }, [ammo]);

    // Show bullet indicators for clips <= 30
    const showBulletIndicators = maxClip <= 30 && maxClip > 0;
    const bulletCount = showBulletIndicators ? maxClip : 0;

    return (
        <div className="absolute bottom-6 right-6 z-30 pointer-events-none select-none">
            {/* Backdrop glow */}
            <div className="absolute -inset-4 bg-gradient-radial from-black/60 via-black/30 to-transparent rounded-lg blur-xl" />

            {/* Main container */}
            <div className={`relative transition-all duration-300 ${isReloading ? 'scale-105' : ''}`}>
                {/* Weapon name with scan line effect */}
                <div className="relative overflow-hidden mb-2">
                    <div className="text-stone-500 text-[10px] font-bold tracking-[0.5em] uppercase text-right
                                  font-mono flex items-center justify-end gap-2">
                        <div className={`w-2 h-2 rounded-full transition-all duration-200 ${isEmpty ? 'bg-red-500 animate-pulse' :
                                isLowAmmo ? 'bg-amber-500 animate-pulse' :
                                    'bg-emerald-500'
                            }`} />
                        <span className="opacity-80">{weaponName}</span>
                    </div>
                </div>

                {/* Ammo numbers */}
                <div className="flex items-end justify-end gap-1 relative">
                    {/* Muzzle flash effect */}
                    {showMuzzleFlash && (
                        <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-16 h-16 
                                      bg-amber-400/40 rounded-full blur-xl"
                            style={{ animation: 'flash 0.1s ease-out' }} />
                    )}

                    {/* Current ammo */}
                    <div className="relative">
                        <span className={`text-7xl font-black tracking-tighter font-mono 
                                        transition-all duration-200
                                        ${isEmpty ? 'text-red-600' :
                                isLowAmmo ? 'text-red-500' :
                                    'text-stone-100'}
                                        drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]
                                        ${isReloading ? 'blur-[2px] opacity-50' : ''}
                                        ${isEmpty ? 'animate-pulse' : ''}`}
                            style={{
                                textShadow: isEmpty
                                    ? '0 0 30px rgba(220,38,38,0.5), 0 4px 0 rgba(0,0,0,0.8)'
                                    : '0 4px 0 rgba(0,0,0,0.8)'
                            }}>
                            {ammo}
                        </span>

                        {/* Glitch effect on low ammo */}
                        {isLowAmmo && (
                            <span className="absolute inset-0 text-7xl font-black tracking-tighter font-mono
                                           text-cyan-500/20 translate-x-[2px]"
                                style={{ clipPath: 'inset(60% 0 10% 0)' }}>
                                {ammo}
                            </span>
                        )}
                    </div>

                    {/* Separator */}
                    <span className="text-3xl text-stone-600 font-bold font-mono mb-3 mx-1">/</span>

                    {/* Reserve ammo */}
                    <span className="text-3xl text-stone-500 font-bold font-mono mb-3
                                   drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
                        {reserveAmmo}
                    </span>
                </div>

                {/* Bullet indicators */}
                {showBulletIndicators && (
                    <div className="flex justify-end gap-[2px] mt-3 flex-wrap-reverse max-w-[200px]"
                        style={{ flexDirection: 'row-reverse' }}>
                        {Array.from({ length: bulletCount }).map((_, i) => (
                            <BulletIndicator key={i} filled={i < ammo} index={bulletCount - 1 - i} />
                        ))}
                    </div>
                )}

                {/* Decorative elements */}
                <div className="mt-3 flex items-center justify-end gap-2">
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-stone-600/50 via-stone-600/30 to-transparent" />
                    <div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className={`w-1 h-1 rounded-full transition-all duration-300 ${i === 0 ? (isEmpty ? 'bg-red-500' : isLowAmmo ? 'bg-amber-500' : 'bg-stone-500') :
                                    'bg-stone-700'
                                }`} />
                        ))}
                    </div>
                </div>

                {/* RELOAD prompt */}
                {isEmpty && reserveAmmo > 0 && (
                    <div className="absolute -top-8 right-0 text-red-500 text-xs font-bold tracking-widest uppercase
                                  animate-pulse font-mono whitespace-nowrap">
                        RELOAD
                    </div>
                )}
            </div>
        </div>
    );
};
