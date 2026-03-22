
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore, KillEvent } from '../../store/useGameStore';

interface KillEntry {
    id: string;
    enemyType: 'zombie' | 'hellhound';
    isHeadshot: boolean;
    points: number;
    timestamp: number;
}

interface KillFeedProps {
    /** When true, repositions feed to avoid the touch action buttons on the right */
    isTouchMode?: boolean;
    /** How many px from the right the action button grid occupies */
    touchRightSafe?: number;
}

export const KillFeed = ({ isTouchMode = false, touchRightSafe = 210 }: KillFeedProps) => {
    const [kills, setKills] = useState<KillEntry[]>([]);
    const killEvents = useGameStore(state => state.killEvents);
    const processedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (killEvents.length === 0) return;

        const newEvents = killEvents.filter(e => !processedRef.current.has(e.id));
        if (newEvents.length === 0) return;

        for (const event of newEvents) {
            processedRef.current.add(event.id);
            const entry: KillEntry = {
                id: event.id,
                enemyType: event.enemyType,
                isHeadshot: event.isHeadshot,
                points: event.points,
                timestamp: event.timestamp,
            };

            setKills(prev => [...prev.slice(-4), entry]);

            // Remove after animation (keep ID in processedRef to prevent re-processing)
            setTimeout(() => {
                setKills(prev => prev.filter(k => k.id !== event.id));
            }, 3000);
        }
    }, [killEvents]);

    if (kills.length === 0) return null;

    // On touch: anchor from right but offset inward past the action button grid
    // On desktop: top-right corner as before
    const containerStyle: React.CSSProperties = isTouchMode
        ? { position: 'absolute', top: '8%', right: touchRightSafe + 8, zIndex: 30 }
        : { position: 'absolute', top: '33%', right: 24, zIndex: 30 };

    return (
        <div
            className="pointer-events-none select-none flex flex-col gap-1 items-end"
            style={containerStyle}
        >
            {kills.map((kill, index) => (
                <div
                    key={kill.id}
                    className="flex items-center gap-2 bg-black/40 backdrop-blur-sm
                              px-3 py-1.5 rounded-sm border-r-2 border-red-700/50"
                    style={{
                        animation: 'killFeedSlide 0.3s ease-out',
                        opacity: 1 - (index * 0.15)
                    }}
                >
                    {/* Enemy icon */}
                    <span className="text-red-500 text-sm">
                        {kill.enemyType === 'hellhound' ? '🐕' : '☠'}
                    </span>

                    {/* Kill type */}
                    <span className="text-stone-400 text-xs font-mono uppercase tracking-wide">
                        {kill.enemyType === 'hellhound' ? 'HELLHOUND' : 'ZOMBIE'}
                    </span>

                    {/* Headshot indicator */}
                    {kill.isHeadshot && (
                        <span className="text-amber-500 text-[10px] font-bold tracking-wider">
                            HEADSHOT
                        </span>
                    )}

                    {/* Points */}
                    <span className="text-amber-400 text-xs font-bold font-mono">
                        +{kill.points}
                    </span>
                </div>
            ))}
        </div>
    );
};
