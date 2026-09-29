import React, { useState, useEffect } from 'react';

interface GameLogoProps {
    scale?: number;
    className?: string;
}

export const GameLogo = ({ scale = 1, className = "" }: GameLogoProps) => {
    const [pulseIntensity, setPulseIntensity] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setPulseIntensity(Math.sin(Date.now() / 1500) * 0.5 + 0.5);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <div 
            className={`relative flex justify-center items-center ${className}`} 
            style={{ 
                transform: `scale(${scale * 0.9375})`,
            }}
        >
            <img 
                src="/logo.png" 
                alt="DOM OF THE DEAD" 
                className="relative z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]"
            />
        </div>
    );
};
