import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAppStore } from '../state/store';
import { SettingsPanel } from './SettingsPanel';

type Panel = 'main' | 'join' | 'settings';

export function MainMenu() {
  const settings = useAppStore((s) => s.settings);
  const error = useAppStore((s) => s.error);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const startGame = useAppStore((s) => s.startGame);
  const [panel, setPanel] = useState<Panel>('main');
  const [code, setCode] = useState('');

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === 4) startGame('join', code);
  };

  return (
    <main className="menu">
      <div className="menu-backdrop" aria-hidden />
      <header className="menu-title">
        <h1>
          DOM <span>of the</span> DEAD
        </h1>
        <p>Survive the night. Together, or alone.</p>
      </header>

      <section className="menu-card">
        <label className="field">
          <span>Survivor name</span>
          <input
            value={settings.name}
            maxLength={16}
            placeholder="Survivor"
            onChange={(e) => updateSettings({ name: e.target.value })}
          />
        </label>

        {panel === 'main' && (
          <nav className="menu-buttons">
            <button className="primary" onClick={() => startGame('solo')}>
              Play Solo
            </button>
            <button onClick={() => startGame('host')}>Host Online Game</button>
            <button onClick={() => setPanel('join')}>Join With Code</button>
            <button className="subtle" onClick={() => setPanel('settings')}>
              Settings
            </button>
          </nav>
        )}

        {panel === 'join' && (
          <form className="menu-buttons" onSubmit={join}>
            <label className="field">
              <span>Room code</span>
              <input
                className="code-input"
                value={code}
                autoFocus
                maxLength={4}
                placeholder="ABCD"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              />
            </label>
            <button className="primary" type="submit" disabled={code.length !== 4}>
              Join Game
            </button>
            <button type="button" className="subtle" onClick={() => setPanel('main')}>
              Back
            </button>
          </form>
        )}

        {panel === 'settings' && (
          <div className="menu-buttons">
            <SettingsPanel />
            <button className="subtle" onClick={() => setPanel('main')}>
              Back
            </button>
          </div>
        )}

        {error && <p className="menu-error">{error}</p>}
      </section>

      <footer className="menu-footer">
        <span>
          WASD move · Mouse aim · LMB fire · RMB aim · R reload · Shift sprint · Space jump · 1–3
          weapons · Tab scores
        </span>
        <span>Gamepad supported</span>
      </footer>
    </main>
  );
}
