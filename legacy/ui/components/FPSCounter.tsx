import React, { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';

/**
 * FPSCounter - A lightweight, zero-rerender FPS display.
 * Uses direct DOM manipulation via refs to avoid React re-render overhead.
 * Samples frame times and updates the display every ~500ms.
 *
 * On touch mode, shifts left to clear the pause button in the top-right corner.
 */
export const FPSCounter = ({ isTouchMode = false }: { isTouchMode?: boolean }) => {
    const showFPS = useGameStore(s => s.settings.showFPS);
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

    if (!showFPS) return null;

    // On touch: sit left of the pause button (pause btn is ~56px from right edge)
    // On desktop: standard top-right
    const positionStyle: React.CSSProperties = isTouchMode
        ? { position: 'absolute', top: 16, right: 72, zIndex: 30 }
        : { position: 'absolute', top: 24, right: 24, zIndex: 30 };

    return (
        <div className="pointer-events-none select-none" style={positionStyle}>
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
