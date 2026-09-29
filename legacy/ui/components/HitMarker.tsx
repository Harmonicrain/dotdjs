
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore, KillEvent } from '../../store/useGameStore';

interface HitMark {
    id: string;
    isKill: boolean;
    isHeadshot: boolean;
    timestamp: number;
}

export const HitMarker = () => {
    const [hitMarks, setHitMarks] = useState<HitMark[]>([]);
    const killEvents = useGameStore(state => state.killEvents);
    const processedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (killEvents.length === 0) return;

        const newEvents = killEvents.filter(e => !processedRef.current.has(e.id));
        if (newEvents.length === 0) return;

        for (const event of newEvents) {
            processedRef.current.add(event.id);
            const mark: HitMark = {
                id: event.id,
                isKill: true,
                isHeadshot: event.isHeadshot,
                timestamp: event.timestamp,
            };
            setHitMarks(prev => [...prev, mark]);

            // Remove after animation (keep ID in processedRef to prevent re-processing)
            setTimeout(() => {
                setHitMarks(prev => prev.filter(h => h.id !== event.id));
            }, 500);
        }
    }, [killEvents]);

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
            {hitMarks.map(hit => (
                <div
                    key={hit.id}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ animation: 'hitMarkerPop 0.3s ease-out forwards' }}
                >
                    {/* Kill marker - X shape */}
                    {hit.isKill && (
                        <div className={`relative ${hit.isHeadshot ? 'scale-125' : ''}`}>
                            {/* Cross lines */}
                            <div className={`absolute w-6 h-[3px] rounded-full rotate-45
                                          ${hit.isHeadshot ? 'bg-red-500' : 'bg-white'}
                                          shadow-[0_0_10px_rgba(255,255,255,0.8)]`}
                                 style={{ left: '-12px', top: '-1.5px' }} />
                            <div className={`absolute w-6 h-[3px] rounded-full -rotate-45
                                          ${hit.isHeadshot ? 'bg-red-500' : 'bg-white'}
                                          shadow-[0_0_10px_rgba(255,255,255,0.8)]`}
                                 style={{ left: '-12px', top: '-1.5px' }} />

                            {/* Headshot indicator */}
                            {hit.isHeadshot && (
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2
                                              text-red-500 text-[10px] font-bold tracking-wider
                                              animate-pulse whitespace-nowrap">
                                    HEADSHOT
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
