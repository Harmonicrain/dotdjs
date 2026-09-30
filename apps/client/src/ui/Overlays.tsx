import { useState } from 'react';
import type { GameMode, GameOverStats } from '../state/store';
import { useAppStore } from '../state/store';
import { SettingsPanel } from './SettingsPanel';

export function PauseOverlay({
  mode,
  onResume,
  onLeave,
}: {
  mode: GameMode;
  onResume: () => void;
  onLeave: () => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const round = useAppStore((s) => s.hud.round);
  const roomCode = useAppStore((s) => s.hud.roomCode);
  const started = round > 0;

  return (
    <div className="overlay pause" onClick={(e) => e.target === e.currentTarget && onResume()}>
      <div className="panel">
        <h2>{started ? 'Paused' : 'Ready?'}</h2>
        {mode !== 'solo' && (
          <p className="hint">
            The game keeps running online.
            {roomCode && (
              <>
                {' '}
                Friends can join with code <b>{roomCode}</b>.
              </>
            )}
          </p>
        )}
        {showSettings ? (
          <SettingsPanel />
        ) : (
          <button className="primary" onClick={onResume}>
            {started ? 'Resume' : 'Click to play'}
          </button>
        )}
        <button className="subtle" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? 'Done' : 'Settings'}
        </button>
        <button className="subtle danger" onClick={onLeave}>
          Leave game
        </button>
      </div>
    </div>
  );
}

export function GameOverOverlay({ stats, onLeave }: { stats: GameOverStats; onLeave: () => void }) {
  return (
    <div className="overlay game-over">
      <div className="panel">
        <h2>Game Over</h2>
        <p className="survived">
          You survived <b>{stats.round}</b> {stats.round === 1 ? 'round' : 'rounds'}
        </p>
        <dl className="final-stats">
          <div>
            <dt>Points</dt>
            <dd>{stats.points.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Kills</dt>
            <dd>{stats.kills}</dd>
          </div>
          <div>
            <dt>Headshots</dt>
            <dd>{stats.headshots}</dd>
          </div>
        </dl>
        <button className="primary" onClick={onLeave}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
