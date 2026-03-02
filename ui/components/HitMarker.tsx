
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';

interface HitMark {
    id: string;
    isKill: boolean;
    isHeadshot: boolean;
    timestamp: number;
}

export const HitMarker: React.FC = () => {
    const [hitMarks, setHitMarks] = useState<HitMark[]>([]);
    const kills = useGameStore(state => state.kills);
    const prevKills = React.useRef(kills);

    // Listen for kill events (simplified - in real implementation would use event bus)
    useEffect(() => {
        if (kills > prevKills.current) {
            const id = Math.random().toString(36).substr(2, 9);
            setHitMarks(prev => [...prev, { 
                id, 
                isKill: true, 
                isHeadshot: Math.random() > 0.7, // Random for demo
                timestamp: Date.now() 
            }]);
            
            // Remove after animation
            setTimeout(() => {
                setHitMarks(prev => prev.filter(h => h.id !== id));
            }, 500);
        }
        prevKills.current = kills;
    }, [kills]);

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
