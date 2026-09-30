import { useAppStore } from '../state/store';
import { playerColor } from '../game/render/players';

/** Rounds 1–5 are drawn as tally marks, like chalk on a wall; later rounds as numerals. */
function RoundCounter() {
  const round = useAppStore((s) => s.hud.round);
  const phase = useAppStore((s) => s.hud.phase);
  const timer = useAppStore((s) => s.hud.phaseTimer);
  if (round === 0) {
    return phase === 'pregame' ? <div className="round-intro">Get ready… {timer}</div> : null;
  }
  return (
    <div className={`round ${phase === 'intermission' ? 'between' : ''}`} key={round}>
      {round <= 5 ? (
        <span className="tally" aria-label={`Round ${round}`}>
          {Array.from({ length: round }, (_, i) => (
            <i key={i} className={i === 4 ? 'strike' : ''} />
          ))}
        </span>
      ) : (
        <span className="numeral">{round}</span>
      )}
      {phase === 'intermission' && <small>Next round in {timer}</small>}
    </div>
  );
}

function Ammo() {
  const weapon = useAppStore((s) => s.hud.weaponName);
  const clip = useAppStore((s) => s.hud.clip);
  const clipSize = useAppStore((s) => s.hud.clipSize);
  const reserve = useAppStore((s) => s.hud.reserve);
  const reloading = useAppStore((s) => s.hud.reloading);
  const low = clip <= Math.max(1, Math.floor(clipSize / 4));
  return (
    <div className="ammo">
      <div className="ammo-count">
        <span className={low ? 'low' : ''}>{clip}</span>
        <small>/ {reserve}</small>
      </div>
      <div className="weapon-name">{weapon}</div>
      {reloading ? (
        <div className="prompt">Reloading…</div>
      ) : clip === 0 && reserve === 0 ? (
        <div className="prompt warn">No ammo</div>
      ) : (
        low && <div className="prompt">Press R to reload</div>
      )}
    </div>
  );
}

function Scores() {
  const scores = useAppStore((s) => s.hud.scores);
  const popups = useAppStore((s) => s.feedback.popups);
  return (
    <div className="scores">
      {scores.map((p) => (
        <div
          key={p.id}
          className={`score ${p.isLocal ? 'local' : ''} ${p.life === 'dead' ? 'dead' : ''}`}
        >
          <span className="swatch" style={{ background: playerColor(p.id) }} />
          <span className="points">{p.points.toLocaleString()}</span>
          {p.isLocal &&
            popups.map((popup, i) => (
              <span key={popup.key} className="popup" style={{ top: `${-8 - i * 4}px` }}>
                +{popup.amount}
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}

function Crosshair() {
  const aiming = useAppStore((s) => s.hud.aiming);
  const alive = useAppStore((s) => s.hud.alive);
  const hitmarker = useAppStore((s) => s.feedback.hitmarker);
  return (
    <div className="crosshair-wrap">
      {!aiming && alive && (
        <div className="crosshair">
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      {hitmarker && <div key={hitmarker.key} className={`hitmarker ${hitmarker.kind}`} />}
    </div>
  );
}

function DamageLayer() {
  const health = useAppStore((s) => s.hud.health);
  const maxHealth = useAppStore((s) => s.hud.maxHealth);
  const damage = useAppStore((s) => s.feedback.damage);
  const alive = useAppStore((s) => s.hud.alive);
  const gameOver = useAppStore((s) => s.gameOver !== null);
  const hurt = 1 - health / Math.max(1, maxHealth);
  return (
    <>
      <div className="blood-vignette" style={{ opacity: alive ? hurt * 0.9 : 0.85 }} />
      {damage && (
        <div
          key={damage.key}
          className="damage-direction"
          style={{ transform: `translate(-50%, -50%) rotate(${damage.angle}rad)` }}
        />
      )}
      {!alive && !gameOver && <div className="downed">You are down</div>}
    </>
  );
}

function Messages() {
  const messages = useAppStore((s) => s.feedback.messages);
  return (
    <div className="messages">
      {messages.map((m) => (
        <div key={m.key}>{m.text}</div>
      ))}
    </div>
  );
}

function Corner() {
  const roomCode = useAppStore((s) => s.hud.roomCode);
  const showStats = useAppStore((s) => s.settings.showStats);
  const fps = useAppStore((s) => s.hud.fps);
  const rtt = useAppStore((s) => s.hud.rtt);
  return (
    <div className="corner">
      {roomCode && (
        <div className="room-code">
          Room <b>{roomCode}</b>
        </div>
      )}
      {showStats && (
        <div className="stats">
          {fps} fps{rtt !== null && ` · ${rtt} ms`}
        </div>
      )}
    </div>
  );
}

export function Hud() {
  return (
    <div className="hud">
      <DamageLayer />
      <Corner />
      <Messages />
      <Crosshair />
      <RoundCounter />
      <Scores />
      <Ammo />
    </div>
  );
}
