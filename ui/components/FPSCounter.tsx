import React, { useState, useEffect, useRef } from 'react';

/**
 * FPSCounter - A lightweight FPS display for the top-right corner.
 * Uses requestAnimationFrame for accurate measurement with minimal overhead.
 */
export const FPSCounter: React.FC = () => {
    const [fps, setFps] = useState(0);
    const frameTimesRef = useRef<number[]>([]);
    const lastTimeRef = useRef(performance.now());
    const rafIdRef = useRef<number>(0);

    useEffect(() => {
        const measureFPS = (now: number) => {
            const delta = now - lastTimeRef.current;
            lastTimeRef.current = now;

            // Store last 30 frame times for smoothing
            frameTimesRef.current.push(delta);
            if (frameTimesRef.current.length > 30) {
                frameTimesRef.current.shift();
            }

            // Update display every ~500ms to avoid jitter
            if (frameTimesRef.current.length >= 30) {
                const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
                const currentFps = Math.round(1000 / avgDelta);
                setFps(currentFps);
            }

            rafIdRef.current = requestAnimationFrame(measureFPS);
        };

        rafIdRef.current = requestAnimationFrame(measureFPS);

        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    // Color based on FPS thresholds
    const getFpsColor = () => {
        if (fps >= 55) return 'text-green-500';
        if (fps >= 30) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <div className="absolute top-8 right-10 pointer-events-none select-none z-30">
            <div className="flex flex-col items-end">
                <div className={`font-serif text-2xl font-bold tracking-tight ${getFpsColor()}`}
                     style={{ textShadow: '2px 2px 0px rgba(0,0,0,0.8)' }}>
                    {fps}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-stone-500 text-xs tracking-[0.3em] uppercase font-bold">FPS</span>
                    <div className="h-[2px] w-8 bg-stone-700/50"></div>
                </div>
            </div>
        </div>
    );
};
