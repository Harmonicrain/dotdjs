import React, { useEffect, useRef, useCallback } from 'react';

/**
 * FPSCounter - A lightweight, zero-rerender FPS display for the top-right corner.
 * Uses direct DOM manipulation via refs to avoid React re-render overhead.
 * Samples frame times and updates the display every ~500ms.
 */
export const FPSCounter = () => {
    const valueRef = useRef<HTMLSpanElement>(null);
    const lastTimeRef = useRef(performance.now());
    const frameCountRef = useRef(0);
    const rafIdRef = useRef<number>(0);

    const tick = useCallback((now: number) => {
        frameCountRef.current++;
        const elapsed = now - lastTimeRef.current;

        // Update display every ~500ms for stability
        if (elapsed >= 500) {
            const fps = Math.round((frameCountRef.current / elapsed) * 1000);
            frameCountRef.current = 0;
            lastTimeRef.current = now;

            const el = valueRef.current;
            if (el) {
                el.textContent = String(fps);
                // Color based on thresholds using game palette
                el.style.color = fps >= 55 ? '#a8a29e' : fps >= 30 ? '#f59e0b' : '#dc2626';
            }
        }

        rafIdRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        rafIdRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafIdRef.current);
    }, [tick]);

    return (
        <div className="absolute top-6 right-6 pointer-events-none select-none z-30">
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded px-2.5 py-1
                          border-r-2 border-stone-700/50">
                <span className="text-stone-600 text-[9px] tracking-[0.3em] uppercase font-bold font-mono">
                    FPS
                </span>
                <span
                    ref={valueRef}
                    className="text-sm font-bold font-mono tabular-nums"
                    style={{ color: '#a8a29e', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                    --
                </span>
            </div>
        </div>
    );
};
