
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';

/** Weapon IDs whose model has a built-in sight — hide HUD crosshair during ADS. */
const HIDE_CROSSHAIR_ADS_WEAPONS = new Set(['ray_gun']);

export const Crosshair: React.FC = () => {
    const ammo = useGameStore(state => state.ammo);
    const health = useGameStore(state => state.health);
    const kills = useGameStore(state => state.kills);
    const isAiming = useGameStore(state => state.isAiming);
    const weaponId = useGameStore(state => state.weaponId);

    const isEmpty = ammo === 0;
    const isCritical = health < 50 && health > 0;

    const [showKillMarker, setShowKillMarker] = useState(false);
    const [isHit, setIsHit] = useState(false);
    const [isFiring, setIsFiring] = useState(false);
    const prevKills = useRef(kills);
    const prevHealth = useRef(health);
    const prevAmmo = useRef(ammo);

    // Hide crosshair when ADS with a weapon that has its own sight
    const hideForAds = isAiming && HIDE_CROSSHAIR_ADS_WEAPONS.has(weaponId);

    // Detect kill for X animation
    useEffect(() => {
        if (kills > prevKills.current) {
            setShowKillMarker(true);
            const timer = setTimeout(() => setShowKillMarker(false), 400);
            prevKills.current = kills;
            return () => clearTimeout(timer);
        }
        prevKills.current = kills;
    }, [kills]);

    // Detect taking damage for hit feedback
    useEffect(() => {
        if (health < prevHealth.current && health > 0) {
            setIsHit(true);
            const timer = setTimeout(() => setIsHit(false), 150);
            prevHealth.current = health;
            return () => clearTimeout(timer);
        }
        prevHealth.current = health;
    }, [health]);

    // Detect firing for crosshair expansion
    useEffect(() => {
        if (ammo < prevAmmo.current) {
            setIsFiring(true);
            const timer = setTimeout(() => setIsFiring(false), 100);
            prevAmmo.current = ammo;
            return () => clearTimeout(timer);
        }
        prevAmmo.current = ammo;
    }, [ammo]);

    // Gap size increases when hit or firing (spread effect)
    const gap = isHit ? 6 : isFiring ? 8 : 4;
    const lineLength = isHit ? 10 : isFiring ? 12 : 8;

    return (
        <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30
                      pointer-events-none"
            style={{
                opacity: hideForAds ? 0 : 1,
                transform: `translate(-50%, -50%) scale(${hideForAds ? 0.3 : 1})`,
                transition: hideForAds
                    ? 'opacity 150ms ease-in, transform 150ms ease-in'
                    : 'opacity 80ms ease-out, transform 80ms ease-out',
            }}
        >

            {/* Kill marker X - shows on kill */}
            {showKillMarker && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                     style={{ animation: 'killMarkerPop 0.4s ease-out forwards' }}>
                    <div className="relative w-6 h-6">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                      w-6 h-[2px] bg-red-500 rotate-45 rounded-full"
                             style={{ boxShadow: '0 0 8px rgba(239,68,68,0.9), 0 0 16px rgba(239,68,68,0.5)' }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                      w-6 h-[2px] bg-red-500 -rotate-45 rounded-full"
                             style={{ boxShadow: '0 0 8px rgba(239,68,68,0.9), 0 0 16px rgba(239,68,68,0.5)' }} />
                    </div>
                </div>
            )}

            {/* Main crosshair + shape - hidden during kill marker */}
            <div className={`transition-all duration-75 ${showKillMarker ? 'opacity-0 scale-150' : 'opacity-100 scale-100'}`}>

                {/* Simple + crosshair */}
                <div className="relative">
                    {/* Top line */}
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 w-[2px] transition-all duration-75
                                   ${isEmpty ? 'bg-red-500' : isHit ? 'bg-red-400' : isFiring ? 'bg-white' : 'bg-white/90'}`}
                        style={{
                            height: `${lineLength}px`,
                            top: `-${gap + lineLength}px`,
                            boxShadow: isEmpty ? '0 0 6px rgba(239,68,68,0.8)' :
                                       isHit ? '0 0 4px rgba(248,113,113,0.6)' :
                                       isFiring ? '0 0 8px rgba(255,255,255,0.6)' : 'none',
                            opacity: isFiring ? 0.8 : 1,
                        }}
                    />

                    {/* Bottom line */}
                    <div
                        className={`absolute left-1/2 -translate-x-1/2 w-[2px] transition-all duration-75
                                   ${isEmpty ? 'bg-red-500' : isHit ? 'bg-red-400' : isFiring ? 'bg-white' : 'bg-white/90'}`}
                        style={{
                            height: `${lineLength}px`,
                            top: `${gap}px`,
                            boxShadow: isEmpty ? '0 0 6px rgba(239,68,68,0.8)' :
                                       isHit ? '0 0 4px rgba(248,113,113,0.6)' :
                                       isFiring ? '0 0 8px rgba(255,255,255,0.6)' : 'none',
                            opacity: isFiring ? 0.8 : 1,
                        }}
                    />

                    {/* Left line */}
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 h-[2px] transition-all duration-75
                                   ${isEmpty ? 'bg-red-500' : isHit ? 'bg-red-400' : isFiring ? 'bg-white' : 'bg-white/90'}`}
                        style={{
                            width: `${lineLength}px`,
                            left: `-${gap + lineLength}px`,
                            boxShadow: isEmpty ? '0 0 6px rgba(239,68,68,0.8)' :
                                       isHit ? '0 0 4px rgba(248,113,113,0.6)' :
                                       isFiring ? '0 0 8px rgba(255,255,255,0.6)' : 'none',
                            opacity: isFiring ? 0.8 : 1,
                        }}
                    />

                    {/* Right line */}
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 h-[2px] transition-all duration-75
                                   ${isEmpty ? 'bg-red-500' : isHit ? 'bg-red-400' : isFiring ? 'bg-white' : 'bg-white/90'}`}
                        style={{
                            width: `${lineLength}px`,
                            left: `${gap}px`,
                            boxShadow: isEmpty ? '0 0 6px rgba(239,68,68,0.8)' :
                                       isHit ? '0 0 4px rgba(248,113,113,0.6)' :
                                       isFiring ? '0 0 8px rgba(255,255,255,0.6)' : 'none',
                            opacity: isFiring ? 0.8 : 1,
                        }}
                    />

                    {/* Center dot */}
                    <div
                        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                   w-[2px] h-[2px] rounded-full transition-all duration-75
                                   ${isEmpty ? 'bg-red-500' : 'bg-white/80'}`}
                        style={{
                            boxShadow: isEmpty ? '0 0 6px rgba(239,68,68,0.8)' : 'none',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
