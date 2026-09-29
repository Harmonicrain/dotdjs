import { useAppStore } from '../state/store';
import { playerColor } from '../game/render/players';

export function Scoreboard() {
  const scores = useAppStore((s) => s.hud.scores);
  const round = useAppStore((s) => s.hud.round);
  return (
    <div className="overlay scoreboard">
      <div className="panel wide">
        <h2>Round {round}</h2>
        <table>
          <thead>
            <tr>
              <th>Survivor</th>
              <th>Points</th>
              <th>Kills</th>
              <th>Headshots</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((p) => (
              <tr key={p.id} className={p.isLocal ? 'local' : ''}>
                <td>
                  <span className="swatch" style={{ background: playerColor(p.id) }} />
                  {p.name}
                  {p.life === 'dead' && <em> (down)</em>}
                </td>
                <td>{p.points.toLocaleString()}</td>
                <td>{p.kills}</td>
                <td>{p.headshots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
