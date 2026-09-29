import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { GameAction, InputManager } from '../../engine/InputManager';

interface TouchControlsProps {
    inputManager: InputManager | null;
    onPause: () => void;
}

type Vec2 = { x: number; y: number };

const clampMagnitude = (v: Vec2, max: number): Vec2 => {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    if (mag <= max || mag === 0) return v;
    const s = max / mag;
    return { x: v.x * s, y: v.y * s };
};

const buttonBaseStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(0, 0, 0, 0.36)',
    color: '#f1f1f1',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '10px',
    letterSpacing: '0.14em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
};

const ActionButton = ({
    label,
    size,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style,
}: {
    label: string;
    size: number;
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerMove?: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
    style?: React.CSSProperties;
}) => (
    <button
        type="button"
        style={{ ...buttonBaseStyle, width: size, height: size, ...style }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
    >
        {label}
    </button>
);

export const TouchControls = ({ inputManager, onPause }: TouchControlsProps) => {
    const settings = useGameStore((s) => s.settings);
    const isPaused = useGameStore((s) => s.isPaused);
    const isGameOver = useGameStore((s) => s.isGameOver);
    const isSpectating = useGameStore((s) => s.isSpectating);
    const interactionMsg = useGameStore((s) => s.interactionMsg);

    const joystickRef = useRef<HTMLDivElement | null>(null);
    const joystickPointerIdRef = useRef<number | null>(null);
    const lookPointerIdRef = useRef<number | null>(null);
    const lookLastRef = useRef<Vec2>({ x: 0, y: 0 });
    const activePointers = useRef<Record<string, number | null>>({});

    const [stickPos, setStickPos] = useState<Vec2>({ x: 0, y: 0 });
    const [viewport, setViewport] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768,
    }));

    useEffect(() => {
        const updateViewport = () => {
            setViewport({
                width: window.visualViewport?.width ?? window.innerWidth,
                height: window.visualViewport?.height ?? window.innerHeight,
            });
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        window.visualViewport?.addEventListener('resize', updateViewport);

        return () => {
            window.removeEventListener('resize', updateViewport);
            window.visualViewport?.removeEventListener('resize', updateViewport);
        };
    }, []);

    const isTouchScheme = settings.inputDevice === 'TOUCH';
    const isVisible = isTouchScheme && !isPaused && !isGameOver && !isSpectating;

    const minViewport = Math.min(viewport.width, viewport.height);
    const uiScale = Math.max(0.68, Math.min(1, minViewport / 560));
    const edgePadding = Math.round(16 * uiScale);
    const joystickSize = Math.round(120 * uiScale);
    const joystickKnobSize = Math.round(48 * uiScale);
    // Secondary action buttons (ADS, RELOAD, KNIFE, JUMP, USE, SWAP, CROUCH)
    const secBtnSize = Math.round(46 * uiScale);
    // FIRE button
    const fireButtonSize = Math.round(76 * uiScale);
    const pauseButtonSize = Math.round(36 * uiScale);
    const btnGap = Math.round(7 * uiScale);

    const setAction = useCallback((action: GameAction, held: boolean) => {
        inputManager?.setTouchAction(action, held);
    }, [inputManager]);

    const bindHoldAction = useCallback((key: string, action: GameAction, held: boolean, pointerId?: number) => {
        if (held) {
            activePointers.current[key] = pointerId ?? null;
        } else {
            activePointers.current[key] = null;
        }
        setAction(action, held);
    }, [setAction]);

    useEffect(() => {
        if (!isTouchScheme) {
            inputManager?.clearTouchState();
            setStickPos({ x: 0, y: 0 });
        }
    }, [isTouchScheme, inputManager]);

    useEffect(() => {
        return () => {
            inputManager?.clearTouchState();
        };
    }, [inputManager]);

    const updateJoystick = useCallback((clientX: number, clientY: number) => {
        const el = joystickRef.current;
        if (!el || !inputManager) return;

        const rect = el.getBoundingClientRect();
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const raw = { x: clientX - center.x, y: clientY - center.y };
        const radius = rect.width * 0.5;
        const clamped = clampMagnitude(raw, radius);

        const nx = clamped.x / radius;
        const ny = clamped.y / radius;
        inputManager.setTouchMoveVector(nx, ny);

        const mag = Math.sqrt(nx * nx + ny * ny);
        inputManager.setTouchAction(GameAction.SPRINT, mag > 0.85);

        setStickPos({ x: clamped.x, y: clamped.y });
    }, [inputManager]);

    const handleJoystickDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!inputManager || joystickPointerIdRef.current !== null) return;
        joystickPointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateJoystick(e.clientX, e.clientY);
    }, [inputManager, updateJoystick]);

    const handleJoystickMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (joystickPointerIdRef.current !== e.pointerId) return;
        updateJoystick(e.clientX, e.clientY);
    }, [updateJoystick]);

    const handleJoystickUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (joystickPointerIdRef.current !== e.pointerId) return;
        joystickPointerIdRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        inputManager?.setTouchMoveVector(0, 0);
        inputManager?.setTouchAction(GameAction.SPRINT, false);
        setStickPos({ x: 0, y: 0 });
    }, [inputManager]);

    const handleLookDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!inputManager) return;
        if (joystickRef.current?.contains(e.target as Node)) return;
        if (lookPointerIdRef.current !== null) return;
        lookPointerIdRef.current = e.pointerId;
        lookLastRef.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    }, [inputManager]);

    const handleLookMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!inputManager || lookPointerIdRef.current !== e.pointerId) return;
        const dx = e.clientX - lookLastRef.current.x;
        const dy = e.clientY - lookLastRef.current.y;
        lookLastRef.current = { x: e.clientX, y: e.clientY };
        inputManager.injectTouchLook(dx, dy);
    }, [inputManager]);

    const handleLookUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (lookPointerIdRef.current !== e.pointerId) return;
        lookPointerIdRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    }, []);

    if (!isVisible) return null;

    // Layout math:
    // Right cluster = [secondary grid 3 cols] beside [FIRE btn]
    // secondary grid: 3 cols × 2 rows + gaps
    const secGridCols = 3;
    const secGridRows = 3; // ADS/RELOAD/KNIFE / JUMP/USE/SWAP / CROUCH(span?)
    const secGridWidth = secGridCols * secBtnSize + (secGridCols - 1) * btnGap;
    // Total cluster height = 2 rows of sec buttons + gap + fire row aligned to bottom
    // We use CSS grid with align-items end so FIRE aligns to bottom of cluster

    const safeBottom = `calc(env(safe-area-inset-bottom, 0px) + ${edgePadding}px)`;
    const safeRight = `calc(env(safe-area-inset-right, 0px) + ${edgePadding}px)`;
    const safeLeft = `calc(env(safe-area-inset-left, 0px) + ${edgePadding}px)`;
    const safeTop = `calc(env(safe-area-inset-top, 0px) + ${edgePadding}px)`;

    const secFontSize = `${Math.max(8, Math.round(9 * uiScale))}px`;
    const fireFontSize = `${Math.max(10, Math.round(12 * uiScale))}px`;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 60,
                pointerEvents: 'none',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
            }}
        >
            {/* Full-screen look zone (behind all buttons) */}
            <div
                style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', touchAction: 'none' }}
                onPointerDown={handleLookDown}
                onPointerMove={handleLookMove}
                onPointerUp={handleLookUp}
                onPointerCancel={handleLookUp}
            />

            {/* Pause button — top-right */}
            <button
                type="button"
                style={{
                    ...buttonBaseStyle,
                    position: 'absolute',
                    top: safeTop,
                    right: safeRight,
                    width: pauseButtonSize,
                    height: pauseButtonSize,
                    fontSize: `${Math.max(10, Math.round(11 * uiScale))}px`,
                    pointerEvents: 'auto',
                    zIndex: 65,
                }}
                onClick={onPause}
            >
                II
            </button>

            {/* Left joystick — bottom-left */}
            <div
                ref={joystickRef}
                style={{
                    position: 'absolute',
                    left: safeLeft,
                    bottom: safeBottom,
                    width: joystickSize,
                    height: joystickSize,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    pointerEvents: 'auto',
                    touchAction: 'none',
                    zIndex: 62,
                }}
                onPointerDown={handleJoystickDown}
                onPointerMove={handleJoystickMove}
                onPointerUp={handleJoystickUp}
                onPointerCancel={handleJoystickUp}
            >
                <div
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: joystickKnobSize,
                        height: joystickKnobSize,
                        borderRadius: '50%',
                        background: 'rgba(255,154,0,0.45)',
                        border: '1px solid rgba(255,154,0,0.75)',
                        transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))`,
                        pointerEvents: 'none',
                    }}
                />
            </div>

            {/* Right-side action cluster — bottom-right
                Layout: [secondary 3×3 grid] [FIRE large btn]
                Both anchored to bottom-right, cluster sits as low as possible.
                Total cluster is contained within a known footprint so HUD can sit above it. */}
            <div
                style={{
                    position: 'absolute',
                    right: safeRight,
                    bottom: safeBottom,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: btnGap,
                    pointerEvents: 'none',
                    zIndex: 63,
                }}
            >
                {/* Secondary buttons: 3×3 grid (ADS/RELOAD/KNIFE top row, JUMP/USE/SWAP mid, CROUCH bottom-left) */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(3, ${secBtnSize}px)`,
                        gridTemplateRows: `repeat(3, ${secBtnSize}px)`,
                        gap: btnGap,
                        alignItems: 'end',
                    }}
                >
                    <ActionButton label="ADS" size={secBtnSize}
                        style={{ fontSize: secFontSize }}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('aim', GameAction.AIM, true, e.pointerId); }}
                        onPointerUp={(e) => { if (activePointers.current.aim !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('aim', GameAction.AIM, false); }}
                    />
                    <ActionButton label="RELOAD" size={secBtnSize}
                        style={{ fontSize: secFontSize }}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('reload', GameAction.RELOAD, true, e.pointerId); }}
                        onPointerUp={(e) => { if (activePointers.current.reload !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('reload', GameAction.RELOAD, false); }}
                    />
                    <ActionButton label="KNIFE" size={secBtnSize}
                        style={{ fontSize: secFontSize }}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('knife', GameAction.KNIFE, true, e.pointerId); }}
                        onPointerUp={(e) => { if (activePointers.current.knife !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('knife', GameAction.KNIFE, false); }}
                    />
                    <ActionButton label="JUMP" size={secBtnSize}
                        style={{ fontSize: secFontSize }}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('jump', GameAction.JUMP, true, e.pointerId); }}
                        onPointerUp={(e) => { if (activePointers.current.jump !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('jump', GameAction.JUMP, false); }}
                    />
                    <ActionButton label="USE" size={secBtnSize}
                        style={interactionMsg
                            ? { borderColor: 'rgba(255,154,0,0.85)', color: '#ffbf64', fontSize: secFontSize }
                            : { fontSize: secFontSize }}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('interact', GameAction.INTERACT, true, e.pointerId); }}
                        onPointerUp={(e) => { if (activePointers.current.interact !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('interact', GameAction.INTERACT, false); }}
                    />
                    <ActionButton label="SWAP" size={secBtnSize}
                        style={{ fontSize: secFontSize }}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('swap', GameAction.WEAPON_NEXT, true, e.pointerId); }}
                        onPointerUp={(e) => { if (activePointers.current.swap !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('swap', GameAction.WEAPON_NEXT, false); }}
                    />
                    {/* Crouch in bottom-left of grid, FIRE occupies the other two via the sibling flex */}
                    <ActionButton label="CROUCH" size={secBtnSize}
                        style={{ fontSize: secFontSize }}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('crouch', GameAction.CROUCH, true, e.pointerId); }}
                        onPointerUp={(e) => { if (activePointers.current.crouch !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('crouch', GameAction.CROUCH, false); }}
                    />
                    {/* Empty cells to fill grid and keep layout stable */}
                    <div style={{ width: secBtnSize, height: secBtnSize }} />
                    <div style={{ width: secBtnSize, height: secBtnSize }} />
                </div>

                {/* FIRE button — large, right side, bottom-aligned */}
                <ActionButton
                    label="FIRE"
                    size={fireButtonSize}
                    style={{
                        background: 'rgba(120, 20, 20, 0.50)',
                        borderColor: 'rgba(255, 110, 110, 0.70)',
                        fontSize: fireFontSize,
                        flexShrink: 0,
                    }}
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); bindHoldAction('fire', GameAction.FIRE, true, e.pointerId); }}
                    onPointerUp={(e) => { if (activePointers.current.fire !== e.pointerId) return; e.currentTarget.releasePointerCapture(e.pointerId); bindHoldAction('fire', GameAction.FIRE, false); }}
                />
            </div>
        </div>
    );
};
