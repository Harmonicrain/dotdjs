
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';

interface KillEntry {
    id: string;
    enemyType: 'zombie' | 'hellhound';
    isHeadshot: boolean;
    points: number;
    timestamp: number;
}

export const KillFeed: React.FC = () => {
    const [kills, setKills] = useState<KillEntry[]>([]);
    const totalKills = useGameStore(state => state.kills);
    const isDogRound = useGameStore(state => state.isDogRound);
    const prevKills = React.useRef(totalKills);

    // Listen for kill events
    useEffect(() => {
        if (totalKills > prevKills.current) {
            const diff = totalKills - prevKills.current;
            
            for (let i = 0; i < diff; i++) {
                const id = Math.random().toString(36).substr(2, 9);
                const entry: KillEntry = {
                    id,
                    enemyType: isDogRound ? 'hellhound' : 'zombie',
                    isHeadshot: Math.random() > 0.6, // Random for demo
                    points: isDogRound ? 100 : (Math.random() > 0.6 ? 100 : 60),
                    timestamp: Date.now()
                };
                
                setKills(prev => [...prev.slice(-4), entry]);
                
                // Remove after animation
                setTimeout(() => {
                    setKills(prev => prev.filter(k => k.id !== id));
                }, 3000);
            }
        }
        prevKills.current = totalKills;
    }, [totalKills, isDogRound]);

    if (kills.length === 0) return null;

    return (
        <div className="absolute top-1/3 right-6 z-30 pointer-events-none select-none
                      flex flex-col gap-1 items-end">
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
