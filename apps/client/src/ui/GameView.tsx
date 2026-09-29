import { useEffect, useRef } from 'react';
import { GameSession } from '../game/session';
import { useAppStore } from '../state/store';
import type { GameRequest } from '../state/store';
import { Hud } from './Hud';
import { GameOverOverlay, PauseOverlay } from './Overlays';
import { Scoreboard } from './Scoreboard';

/** Hosts the canvas and one GameSession for the lifetime of a match. */
export function GameView({ request }: { request: GameRequest }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const screen = useAppStore((s) => s.screen);
  const paused = useAppStore((s) => s.paused);
  const gameOver = useAppStore((s) => s.gameOver);
  const scoreboard = useAppStore((s) => s.scoreboard);
  const settings = useAppStore((s) => s.settings);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const session = new GameSession({
      mode: request.mode,
      name: useAppStore.getState().settings.name.trim() || 'Survivor',
      ...(request.roomCode ? { roomCode: request.roomCode } : {}),
      canvas,
      settings: useAppStore.getState().settings,
    });
    sessionRef.current = session;
    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, [request]);

  useEffect(() => {
    sessionRef.current?.applySettings(settings);
  }, [settings]);

  const leave = () => useAppStore.getState().leaveGame();
  const resume = () => sessionRef.current?.resume();

  return (
    <div className="game">
      <canvas ref={canvasRef} className="game-canvas" />
      {screen === 'connecting' && (
        <div className="overlay connecting">
          <div className="spinner" />
          <p>{request.mode === 'solo' ? 'Digging graves…' : 'Contacting the server…'}</p>
          <button className="subtle" onClick={leave}>
            Cancel
          </button>
        </div>
      )}
      {screen === 'playing' && (
        <>
          <Hud />
          {scoreboard && <Scoreboard />}
          {gameOver ? (
            <GameOverOverlay stats={gameOver} onLeave={leave} />
          ) : (
            paused && <PauseOverlay mode={request.mode} onResume={resume} onLeave={leave} />
          )}
        </>
      )}
    </div>
  );
}
