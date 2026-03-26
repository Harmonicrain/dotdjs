import React, { useEffect, useMemo, useState } from 'react';
import { POWERUP_CONFIG } from '../../config';
import { PowerUpType } from '../../types/index';
import { useGameStore } from '../../store/useGameStore';

interface PowerUpIconProps {
    type: PowerUpType;
    expireTime: number;
    compact?: boolean;
}

type PowerUpVisualConfig = {
    label: string;
    accent: string;
    glow: string;
    iconBg: string;
    iconBorder: string;
    icon: React.ReactNode;
};

const EFFECT_DURATION_MS = POWERUP_CONFIG.EFFECT_DURATION;

const iconClassName = 'w-[18px] h-[18px]';

const SkullsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
        <path d="M12 4C8.13 4 5 6.92 5 10.55c0 2.14 1.08 4.02 2.75 5.19V19a1 1 0 0 0 1 1h1.25v-2h1.5v2h1v-2H14v2h1.25a1 1 0 0 0 1-1v-3.26A6.6 6.6 0 0 0 19 10.55C19 6.92 15.87 4 12 4Z" fill="currentColor" />
        <circle cx="9.3" cy="10.4" r="1.35" fill="#05070d" />
        <circle cx="14.7" cy="10.4" r="1.35" fill="#05070d" />
        <path d="M12 12.2 10.9 14h2.2L12 12.2Z" fill="#05070d" />
    </svg>
);

const DoublePointsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
        <path d="m6.5 8.2 3.2 3.2-3.2 3.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m14.3 8.2 3.2 3.2-3.2 3.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 4.8h16" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.55" />
        <path d="M4 19.2h16" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.55" />
    </svg>
);

const MaxAmmoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
        <path d="M5 12c1.2-2 2.52-3 4-3 2.83 0 3.17 6 6 6 1.48 0 2.8-1 4-3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        <path d="M5 12c1.2 2 2.52 3 4 3 2.83 0 3.17-6 6-6 1.48 0 2.8 1 4 3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
);

const NukeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
        <circle cx="12" cy="12" r="2.15" fill="currentColor" />
        <path d="M12 4.3 9.2 9.5h5.6L12 4.3Z" fill="currentColor" fillOpacity="0.9" />
        <path d="M5.5 16.8h5.6l-2.8-4.85-2.8 4.85Z" fill="currentColor" fillOpacity="0.9" />
        <path d="M18.5 16.8h-5.6l2.8-4.85 2.8 4.85Z" fill="currentColor" fillOpacity="0.9" />
        <circle cx="12" cy="12" r="7.15" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.7" />
    </svg>
);

const CarpenterIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
        <path d="M14.7 5.2a2.1 2.1 0 0 1 2.97 0l1.13 1.13a2.1 2.1 0 0 1 0 2.97l-2.02 2.02-4.1-4.1 2.02-2.04Z" fill="currentColor" />
        <path d="m11.8 8.1 4.1 4.1-6.84 6.84a1.9 1.9 0 0 1-2.68 0l-.44-.44a1.9 1.9 0 0 1 0-2.68l5.86-5.84Z" fill="currentColor" fillOpacity="0.88" />
        <path d="M6.2 18.4 4.8 19.8" stroke="#05070d" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

const FireSaleIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" className={iconClassName} aria-hidden="true">
        <path d="M12 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M15.9 7.2c-.72-.92-1.99-1.5-3.54-1.5-2.18 0-3.73 1.08-3.73 2.8 0 4.22 7.85 1.72 7.85 5.75 0 1.86-1.73 3.03-4.28 3.03-1.9 0-3.37-.58-4.3-1.72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const powerUpConfigMap: Record<PowerUpType, PowerUpVisualConfig> = {
    [PowerUpType.INSTA_KILL]: {
        label: 'INSTA-KILL',
        accent: '#ef4444',
        glow: 'rgba(239,68,68,0.28)',
        iconBg: 'linear-gradient(180deg, rgba(127,29,29,0.92) 0%, rgba(69,10,10,0.88) 100%)',
        iconBorder: 'rgba(248,113,113,0.5)',
        icon: <SkullsIcon />,
    },
    [PowerUpType.DOUBLE_POINTS]: {
        label: 'DOUBLE POINTS',
        accent: '#f59e0b',
        glow: 'rgba(245,158,11,0.28)',
        iconBg: 'linear-gradient(180deg, rgba(120,53,15,0.92) 0%, rgba(69,26,3,0.88) 100%)',
        iconBorder: 'rgba(252,211,77,0.5)',
        icon: <DoublePointsIcon />,
    },
    [PowerUpType.MAX_AMMO]: {
        label: 'MAX AMMO',
        accent: '#22c55e',
        glow: 'rgba(34,197,94,0.26)',
        iconBg: 'linear-gradient(180deg, rgba(20,83,45,0.92) 0%, rgba(5,46,22,0.88) 100%)',
        iconBorder: 'rgba(74,222,128,0.5)',
        icon: <MaxAmmoIcon />,
    },
    [PowerUpType.NUKE]: {
        label: 'NUKE',
        accent: '#facc15',
        glow: 'rgba(250,204,21,0.28)',
        iconBg: 'linear-gradient(180deg, rgba(133,77,14,0.92) 0%, rgba(113,63,18,0.88) 50%, rgba(120,53,15,0.88) 100%)',
        iconBorder: 'rgba(254,240,138,0.55)',
        icon: <NukeIcon />,
    },
    [PowerUpType.CARPENTER]: {
        label: 'CARPENTER',
        accent: '#c0843d',
        glow: 'rgba(192,132,61,0.24)',
        iconBg: 'linear-gradient(180deg, rgba(120,53,15,0.92) 0%, rgba(68,32,14,0.88) 100%)',
        iconBorder: 'rgba(217,119,6,0.45)',
        icon: <CarpenterIcon />,
    },
    [PowerUpType.FIRE_SALE]: {
        label: 'FIRE SALE',
        accent: '#3b82f6',
        glow: 'rgba(59,130,246,0.28)',
        iconBg: 'linear-gradient(180deg, rgba(30,58,138,0.92) 0%, rgba(23,37,84,0.88) 100%)',
        iconBorder: 'rgba(96,165,250,0.55)',
        icon: <FireSaleIcon />,
    },
};

const PowerUpIcon = ({ type, expireTime, compact = false }: PowerUpIconProps) => {
    const isPaused = useGameStore(s => s.isPaused);
    const isConsoleOpen = useGameStore(s => s.isConsoleOpen);
    const isLogicFrozen = isPaused || isConsoleOpen;

    const [timeLeft, setTimeLeft] = useState(Math.max(0, expireTime - Date.now()));

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

    const progress = Math.max(0, Math.min(1, timeLeft / EFFECT_DURATION_MS));
    const isWarning = timeLeft < 10000;
    const isCritical = timeLeft < 4000;
    const cfg = powerUpConfigMap[type];
    if (!cfg) return null;

    const cardWidth = compact ? 212 : 244;

    return (
        <div
            className={`dotd-powerup-rail relative overflow-hidden border text-white ${isCritical ? 'dotd-powerup-critical' : isWarning ? 'dotd-powerup-warning' : ''}`}
            style={{
                width: cardWidth,
                borderColor: 'rgba(139,0,0,0.45)',
                background: 'rgba(6,4,4,0.94)',
                boxShadow: `0 0 0 1px rgba(80,0,0,0.2), 0 12px 26px rgba(0,0,0,0.45), inset 0 0 38px rgba(0,0,0,0.5), 0 0 18px ${cfg.glow}`,
                animation: 'powerUpRailIn 0.28s cubic-bezier(.2,.9,.2,1)',
            }}
        >
            <div
                className="absolute inset-y-[10px] left-[8px] w-[7px] border border-red-950/70 bg-black/55"
                aria-hidden="true"
            >
                <div
                    className="absolute inset-x-0 bottom-0 transition-[height] duration-100 ease-linear"
                    style={{
                        height: `${Math.max(progress * 100, 4)}%`,
                        background: `linear-gradient(180deg, rgba(255,255,255,0.92) 0%, ${cfg.accent} 22%, rgba(120,0,0,0.9) 100%)`,
                        boxShadow: `0 0 10px ${cfg.glow}`,
                    }}
                />
                <div
                    className="absolute inset-x-[1px] top-0 h-[1px]"
                    style={{ background: 'rgba(255,255,255,0.22)' }}
                />
            </div>
            <div
                className="absolute inset-y-0 left-0 w-[2px]"
                style={{ background: 'linear-gradient(180deg, #ff8c00 0%, #a33b00 100%)' }}
            />
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-900/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-red-950/45 to-transparent" />
            <div
                className="absolute inset-0 opacity-70"
                style={{
                    background: `radial-gradient(circle at top left, ${cfg.glow} 0%, transparent 52%), linear-gradient(90deg, rgba(120,0,0,0.12) 0%, transparent 45%)`,
                }}
            />
            <div className="absolute left-0 top-[20%] bottom-[20%] w-[1px] bg-gradient-to-b from-transparent via-red-800/45 to-transparent" />

            <div className={`relative flex items-center gap-2.5 ${compact ? 'px-3 py-2.5 pl-6' : 'px-3.5 py-3 pl-7'}`}>
                <div
                    className={`relative flex shrink-0 items-center justify-center border ${compact ? 'h-10 w-10' : 'h-11 w-11'}`}
                    style={{
                        background: cfg.iconBg,
                        borderColor: cfg.iconBorder,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 20px ${cfg.glow}`,
                    }}
                >
                    <div className="absolute inset-[1px] bg-gradient-to-b from-white/10 via-transparent to-black/20" />
                    <div className="relative text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.18)]">{cfg.icon}</div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className={`whitespace-nowrap font-bold uppercase text-stone-100 ${compact ? 'text-[11px] tracking-[0.08em]' : 'text-[13px] tracking-[0.11em]'}`}
                            style={{ fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif" }}>
                            {cfg.label}
                        </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.24em] text-stone-400/90">
                        <span className="text-stone-500">Active</span>
                        <span style={{ color: isCritical ? '#fca5a5' : cfg.accent }}>{Math.round(progress * 100)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PowerUpDisplay = ({
    isTouchMode = false,
    touchBottomSafe = 170,
}: {
    isTouchMode?: boolean;
    touchBottomSafe?: number;
}) => {
    const activePowerUps = useGameStore(s => s.activePowerUps);

    const activePowerUpEntries = useMemo(
        () => Object.entries(activePowerUps)
            .map(([type, expTime]) => ({ type: type as PowerUpType, expTime: expTime! }))
            .sort((a, b) => a.expTime - b.expTime),
        [activePowerUps],
    );

    if (activePowerUpEntries.length === 0) return null;

    const containerStyle: React.CSSProperties = isTouchMode
        ? {
            position: 'absolute',
            bottom: touchBottomSafe + 6,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            maxWidth: 'min(calc(100vw - 20px), 420px)',
        }
        : {
            position: 'absolute',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            maxWidth: 'min(calc(100vw - 48px), 840px)',
        };

    return (
        <div className="pointer-events-none select-none" style={containerStyle}>
            <div className="absolute inset-x-10 -top-6 h-16 rounded-full bg-gradient-radial from-black/35 via-black/10 to-transparent blur-2xl" />
            <div className={`relative flex flex-wrap items-center justify-center ${isTouchMode ? 'gap-2' : 'gap-3'}`}>
                {activePowerUpEntries.map(({ type, expTime }) => (
                    <PowerUpIcon key={type} type={type} expireTime={expTime} compact={isTouchMode} />
                ))}
            </div>
        </div>
    );
};
