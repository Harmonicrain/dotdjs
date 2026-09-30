import * as THREE from 'three';
import {
  activeWeapon,
  addScaled,
  Button,
  createCharacterCollider,
  createLevelPhysics,
  disposeLevelPhysics,
  getLevel,
  initPhysics,
  isDown,
  PLAYER,
  raycastLevel,
  rayHitsZombie,
  TICK_DT,
  wasPressed,
  WEAPONS,
} from '@dotd/sim';
import type { LevelPhysics, PlayerInput, Shot, SimEvent, Vec3 } from '@dotd/sim';
import { quantizeInput } from '@dotd/protocol';
import type { ServerMessage, Snapshot, TickedEvent } from '@dotd/protocol';
import { nextFeedbackKey, useAppStore } from '../state/store';
import type { GameMode, ScoreEntry } from '../state/store';
import type { Settings } from '../state/settings';
import { GameAudio } from './audio/audio';
import { InputController } from './input/input';
import { RenderClock } from './net/clock';
import { serverUrl, WebSocketLink, WorkerLink } from './net/link';
import type { ServerLink } from './net/link';
import { Predictor } from './net/predictor';
import { SnapshotBuffer } from './net/snapshots';
import { WorldRenderer } from './render/renderer';

export interface SessionOptions {
  mode: GameMode;
  name: string;
  roomCode?: string;
  canvas: HTMLCanvasElement;
  settings: Settings;
}

/** Render delay behind the newest snapshot. Solo has no network jitter to absorb. */
const SOLO_INTERP_TICKS = 4;
const ONLINE_INTERP_TICKS = 7;
const HUD_INTERVAL_MS = 50;
const PING_INTERVAL_MS = 2000;
const GAME_OVER_DELAY_MS = 2500;
const POPUP_MS = 1100;
const MESSAGE_MS = 3500;
const STEP_DISTANCE = 2.1;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * One match, from connecting to leaving. Samples input at the simulation rate, predicts the
 * local player, sends inputs to the room, and draws everything else from interpolated snapshots.
 */
export class GameSession {
  private readonly link: ServerLink;
  private readonly input: InputController;
  private readonly audio: GameAudio;
  private readonly buffer = new SnapshotBuffer();
  private readonly clock: RenderClock;
  private readonly names = new Map<number, string>();
  private renderer: WorldRenderer | null = null;
  private physics: LevelPhysics | null = null;
  private predictor: Predictor | null = null;
  private playerId = 0;

  private queuedEvents: TickedEvent[] = [];
  private outgoing: PlayerInput[] = [];
  private seq = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private time = 0;
  private frameHandle = 0;
  private lastButtons = 0;
  private lastLook = { yaw: 0, pitch: 0 };
  private shake = 0;
  private groanTimer = 2;
  private stepDistance = 0;
  private lastHud = 0;
  private frames = 0;
  private fpsWindowStart = 0;
  private fps = 0;
  private rtt: number | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private gameOverShown = false;
  private disposed = false;

  constructor(private readonly options: SessionOptions) {
    const { mode, name, roomCode, canvas, settings } = options;
    this.link =
      mode === 'solo'
        ? new WorkerLink(name)
        : new WebSocketLink(serverUrl({ name, ...(roomCode ? { room: roomCode } : {}) }));
    this.link.onMessage = (message) => this.onMessage(message);
    this.link.onClose = (reason) => {
      if (!this.disposed) useAppStore.getState().leaveGame(reason ?? 'Disconnected from the game');
    };
    this.clock = new RenderClock(mode === 'solo' ? SOLO_INTERP_TICKS : ONLINE_INTERP_TICKS);

    this.input = new InputController(canvas, settings);
    this.input.onPause = () => this.setPaused(true);
    this.input.onScoreboard = (visible) => useAppStore.setState({ scoreboard: visible });
    this.audio = new GameAudio(settings.volume);

    if (mode !== 'solo') {
      this.pingTimer = setInterval(
        () => this.link.send({ type: 'ping', clientTime: performance.now() }),
        PING_INTERVAL_MS,
      );
    }
    this.lastFrame = performance.now();
    this.frameHandle = requestAnimationFrame((t) => this.frame(t));
  }

  /** Must be called from a click: grabs the pointer and unpauses. */
  resume(): void {
    this.audio.resume();
    this.input.requestLock();
    this.setPaused(false);
  }

  applySettings(settings: Settings): void {
    this.input.updateSettings(settings);
    this.audio.setVolume(settings.volume);
    this.renderer?.updateSettings({
      resolutionScale: settings.resolutionScale,
      shadows: settings.shadows,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.link.close();
    this.input.dispose();
    this.audio.dispose();
    this.renderer?.dispose();
    if (this.physics) disposeLevelPhysics(this.physics);
  }

  private get settings(): Settings {
    return useAppStore.getState().settings;
  }

  private setPaused(paused: boolean): void {
    // Only solo games stop the simulation; online, pausing is just a menu.
    this.link.setPaused(paused && this.options.mode === 'solo');
    useAppStore.setState({ paused });
  }

  // ── Network ────────────────────────────────────────────────────────────

  private onMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.playerId = message.playerId;
        useAppStore
          .getState()
          .patchHud({ roomCode: this.options.mode === 'solo' ? null : message.roomCode });
        void this.loadLevel(message.levelId);
        return;
      case 'roster':
        this.names.clear();
        for (const p of message.players) this.names.set(p.id, p.name);
        return;
      case 'snapshot':
        this.onSnapshot(message.snapshot);
        return;
      case 'pong':
        this.rtt = performance.now() - message.clientTime;
        return;
      case 'error':
        return; // the link reports the reason when it closes
    }
  }

  private async loadLevel(levelId: string): Promise<void> {
    await initPhysics();
    if (this.disposed) return;
    const level = getLevel(levelId);
    this.physics = createLevelPhysics(level);
    this.renderer = new WorldRenderer(this.options.canvas, level, {
      resolutionScale: this.settings.resolutionScale,
      shadows: this.settings.shadows,
    });
    useAppStore.getState().setScreen('playing');
  }

  private onSnapshot(snapshot: Snapshot): void {
    this.buffer.push(snapshot);

    if (this.physics && snapshot.self) {
      const vitals = snapshot.players.find((p) => p.id === this.playerId);
      if (!this.predictor) {
        this.predictor = new Predictor(
          this.physics,
          createCharacterCollider(this.physics),
          this.playerId,
          snapshot.self,
        );
        if (vitals) this.input.yaw = vitals.yaw;
      } else {
        this.predictor.reconcile(snapshot.ackSeq, snapshot.self, vitals);
      }
    }

    for (const event of snapshot.events) {
      if (this.isPersonal(event)) this.handleEvent(event);
      else this.queuedEvents.push(event);
    }

    if (snapshot.game.phase === 'over' && !this.gameOverShown) {
      this.gameOverShown = true;
      const me = snapshot.players.find((p) => p.id === this.playerId);
      setTimeout(() => {
        if (this.disposed) return;
        this.input.releaseLock();
        useAppStore.setState({
          gameOver: {
            round: snapshot.game.round,
            points: me?.points ?? 0,
            kills: me?.kills ?? 0,
            headshots: me?.headshots ?? 0,
          },
        });
      }, GAME_OVER_DELAY_MS);
    }
  }

  // ── Frame loop ─────────────────────────────────────────────────────────

  private frame(now: number): void {
    if (this.disposed) return;
    this.frameHandle = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;

    const predictor = this.predictor;
    const weaponDef = predictor ? WEAPONS[activeWeapon(predictor.player).id] : null;
    this.input.update(dt, weaponDef?.recoil.recovery ?? 3);

    if (predictor) {
      this.accumulator += dt;
      while (this.accumulator >= TICK_DT) {
        this.accumulator -= TICK_DT;
        this.tick(predictor);
      }
      if (this.outgoing.length > 0) {
        this.link.send({ type: 'input', inputs: this.outgoing });
        this.outgoing = [];
      }
    }

    const latest = this.buffer.latest;
    if (latest) this.clock.update(dt, latest.tick);
    this.flushEvents();

    if (this.renderer && predictor) this.draw(this.renderer, predictor, dt);
    this.updateStats(now);
    if (now - this.lastHud > HUD_INTERVAL_MS) {
      this.lastHud = now;
      this.updateHud();
    }
  }

  /** One simulation tick of local input: sample, predict, queue for the server. */
  private tick(predictor: Predictor): void {
    const player = predictor.player;
    const sampled = this.input.sample(player.weapons.length);
    const input = quantizeInput({
      seq: ++this.seq,
      moveX: sampled.moveX,
      moveY: sampled.moveY,
      yaw: this.input.aimYaw,
      pitch: this.input.aimPitch,
      buttons: sampled.buttons,
      weaponSlot: sampled.weaponSlot,
      viewTick: this.clock.renderTick,
    });
    this.lastButtons = input.buttons;

    const reloadingBefore = player.reloadTimer > 0;
    const before = { x: player.pos.x, z: player.pos.z };
    const weaponBefore = activeWeapon(player);
    const emptyTriggerPull =
      wasPressed(input.buttons, player.prevButtons, Button.Fire) &&
      weaponBefore.clip === 0 &&
      weaponBefore.reserve === 0;

    const shot = predictor.predict(input);
    this.outgoing.push(input);

    if (shot) this.onLocalShot(shot);
    if (!reloadingBefore && player.reloadTimer > 0) {
      this.audio.reload(WEAPONS[activeWeapon(player).id].reloadTime);
    }
    if (emptyTriggerPull) this.audio.dryFire();

    if (player.grounded && player.life === 'alive') {
      this.stepDistance += Math.hypot(player.pos.x - before.x, player.pos.z - before.z);
      if (this.stepDistance > STEP_DISTANCE * (player.sprinting ? 1.25 : 1)) {
        this.stepDistance = 0;
        this.audio.footstep();
      }
    }
  }

  /** Immediate feedback for our own shot: recoil, flash, sound, tracer and predicted impacts. */
  private onLocalShot(shot: Shot): void {
    const renderer = this.renderer;
    const physics = this.physics;
    if (!renderer || !physics) return;
    const def = WEAPONS[shot.weaponId];
    const adsScale = 1 - (1 - def.recoil.adsMultiplier) * renderer.viewModel.aimAmount;
    const [kickMin, kickMax] = def.recoil.pitch;
    this.input.addRecoil(
      rand(kickMin, kickMax) * adsScale,
      rand(-def.recoil.yaw, def.recoil.yaw) * adsScale,
    );
    renderer.viewModel.fire(shot.weaponId);
    this.audio.gunshot(shot.weaponId, null);

    const muzzle = renderer.viewModel.muzzleWorldPosition(renderer.camera, new THREE.Vector3());
    renderer.effects.gunFlash(muzzle);

    const zombies = this.buffer.zombiesAt(this.clock.renderTick).filter((z) => z.mode !== 'dead');
    for (const dir of shot.dirs) {
      const wall = raycastLevel(physics, shot.origin, dir, shot.range);
      let distance = wall?.distance ?? shot.range;
      let hitZombie: { id: number; headshot: boolean } | null = null;
      for (const z of zombies) {
        const hit = rayHitsZombie(shot.origin, dir, distance, z.pos);
        if (hit && hit.distance < distance) {
          distance = hit.distance;
          hitZombie = { id: z.id, headshot: hit.headshot };
        }
      }
      const end = addScaled(shot.origin, dir, distance);
      renderer.effects.tracer(muzzle, end);
      if (hitZombie) {
        renderer.effects.blood(end, { x: -dir.x, y: -dir.y + 0.3, z: -dir.z }, hitZombie.headshot);
        renderer.zombies.flash(hitZombie.id);
      } else if (wall) {
        renderer.effects.sparks(end, wall.normal);
      }
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────

  /** Events about the local player (or the whole game) are shown on arrival, not delayed. */
  private isPersonal(event: SimEvent): boolean {
    switch (event.type) {
      case 'zombieHit':
        return event.playerId === this.playerId;
      case 'playerHurt':
      case 'points':
      case 'playerDied':
      case 'playerRespawned':
        return event.playerId === this.playerId;
      case 'roundStarted':
      case 'roundEnded':
      case 'gameOver':
        return true;
      default:
        return false;
    }
  }

  /** Plays queued events once the render clock reaches the tick they happened on. */
  private flushEvents(): void {
    const renderTick = this.clock.renderTick;
    const due = this.queuedEvents.filter((e) => e.tick <= renderTick);
    if (due.length === 0) return;
    this.queuedEvents = this.queuedEvents.filter((e) => e.tick > renderTick);
    for (const event of due) this.handleEvent(event);
  }

  private handleEvent(event: SimEvent): void {
    const renderer = this.renderer;
    const me = this.playerId;

    switch (event.type) {
      case 'shot': {
        if (event.playerId === me || !renderer) return;
        const from = new THREE.Vector3(event.origin.x, event.origin.y - 0.15, event.origin.z);
        for (const end of event.ends) renderer.effects.tracer(from, end);
        renderer.effects.gunFlash(from);
        this.audio.gunshot(event.weaponId, event.origin);
        return;
      }
      case 'zombieHit': {
        renderer?.zombies.flash(event.zombieId);
        if (event.playerId === me) {
          const kind = event.killed ? (event.headshot ? 'headshot' : 'kill') : 'hit';
          this.audio.hitmarker(kind);
          useAppStore.setState((s) => ({
            feedback: { ...s.feedback, hitmarker: { key: nextFeedbackKey(), kind } },
          }));
        } else if (renderer) {
          renderer.effects.blood(event.point, { x: 0, y: 1, z: 0 }, event.headshot);
        }
        return;
      }
      case 'zombieAttack': {
        const zombie = this.buffer
          .zombiesAt(this.clock.renderTick)
          .find((z) => z.id === event.zombieId);
        if (zombie) this.audio.zombieSwipe(zombie.pos);
        return;
      }
      case 'playerHurt': {
        if (event.playerId !== me || !this.predictor) return;
        const p = this.predictor.player.pos;
        const angle =
          Math.atan2(event.from.x - p.x, event.from.z - p.z) - (this.input.yaw + Math.PI);
        this.shake = Math.min(1, this.shake + 0.6);
        this.audio.hurt();
        useAppStore.setState((s) => ({
          feedback: { ...s.feedback, damage: { key: nextFeedbackKey(), angle } },
        }));
        return;
      }
      case 'points':
        if (event.playerId === me) this.popup(event.amount);
        return;
      case 'playerDied': {
        if (event.playerId !== me) {
          this.message(`${this.nameOf(event.playerId)} is down!`);
          return;
        }
        const teammateAlive = this.buffer.latest?.players.some(
          (p) => p.id !== me && p.life === 'alive',
        );
        if (teammateAlive) this.message('You are down! You will respawn next round.');
        return;
      }
      case 'playerRespawned':
        if (event.playerId === me) this.message('Back in the fight');
        return;
      case 'roundStarted':
        this.audio.roundStart();
        return;
      case 'roundEnded':
        this.audio.roundEnd();
        return;
      case 'gameOver':
        this.audio.gameOver();
        return;
    }
  }

  private nameOf(id: number): string {
    return this.names.get(id) ?? `Player ${id}`;
  }

  private popup(amount: number): void {
    const key = nextFeedbackKey();
    useAppStore.setState((s) => ({
      feedback: { ...s.feedback, popups: [...s.feedback.popups.slice(-6), { key, amount }] },
    }));
    setTimeout(() => {
      useAppStore.setState((s) => ({
        feedback: { ...s.feedback, popups: s.feedback.popups.filter((p) => p.key !== key) },
      }));
    }, POPUP_MS);
  }

  private message(text: string): void {
    const key = nextFeedbackKey();
    useAppStore.setState((s) => ({
      feedback: { ...s.feedback, messages: [...s.feedback.messages.slice(-3), { key, text }] },
    }));
    setTimeout(() => {
      useAppStore.setState((s) => ({
        feedback: { ...s.feedback, messages: s.feedback.messages.filter((m) => m.key !== key) },
      }));
    }, MESSAGE_MS);
  }

  // ── Drawing ────────────────────────────────────────────────────────────

  private draw(renderer: WorldRenderer, predictor: Predictor, dt: number): void {
    const renderTick = this.clock.renderTick;
    const zombies = this.buffer.zombiesAt(renderTick);
    renderer.zombies.sync(zombies, dt, this.time);
    renderer.players.sync(this.buffer.playersAt(renderTick), this.names, this.playerId, dt);

    const player = predictor.player;
    const dead = player.life === 'dead';
    const pos = predictor.renderPosition(this.accumulator / TICK_DT, dt);

    this.shake = Math.max(0, this.shake - dt * 2.5);
    const shakeAmount = this.shake * this.shake * 0.06;
    const eye = new THREE.Vector3(
      pos.x + (Math.random() - 0.5) * shakeAmount,
      pos.y + (dead ? 0.35 : PLAYER.eyeHeight) + (Math.random() - 0.5) * shakeAmount,
      pos.z,
    );

    const weapon = activeWeapon(player);
    const def = WEAPONS[weapon.id];
    const yaw = this.input.aimYaw;
    const pitch = this.input.aimPitch;
    renderer.viewModel.update({
      dt,
      weaponId: weapon.id,
      aiming: isDown(this.lastButtons, Button.Aim),
      sprinting: player.sprinting,
      grounded: player.grounded,
      speed: Math.hypot(player.vel.x, player.vel.z),
      reloadProgress: player.reloadTimer > 0 ? 1 - player.reloadTimer / def.reloadTime : null,
      drawRemaining: def.drawTime > 0 ? player.drawTimer / def.drawTime : 0,
      lookDelta: { yaw: yaw - this.lastLook.yaw, pitch: pitch - this.lastLook.pitch },
    });
    renderer.viewModel.scene.visible = !dead;
    this.lastLook = { yaw, pitch };

    const zoom = 1 - 0.22 * renderer.viewModel.aimAmount;
    renderer.render(
      { position: eye, yaw, pitch, roll: dead ? 0.45 : 0, fov: this.settings.fov * zoom },
      this.time,
      dt,
    );
    this.audio.setListener(eye, yaw);
    this.maybeGroan(zombies, eye, dt);
  }

  private maybeGroan(
    zombies: { pos: Vec3; mode: string }[],
    listener: THREE.Vector3,
    dt: number,
  ): void {
    this.groanTimer -= dt;
    if (this.groanTimer > 0) return;
    const nearby = zombies.filter(
      (z) => z.mode !== 'dead' && Math.hypot(z.pos.x - listener.x, z.pos.z - listener.z) < 28,
    );
    this.groanTimer = rand(0.9, 2.8) / Math.sqrt(Math.max(1, nearby.length));
    const zombie = nearby[Math.floor(Math.random() * nearby.length)];
    if (zombie) this.audio.zombieGroan({ x: zombie.pos.x, y: zombie.pos.y + 1.6, z: zombie.pos.z });
  }

  // ── HUD ────────────────────────────────────────────────────────────────

  private updateStats(now: number): void {
    this.frames++;
    if (now - this.fpsWindowStart >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.fpsWindowStart));
      this.frames = 0;
      this.fpsWindowStart = now;
    }
  }

  private updateHud(): void {
    const latest = this.buffer.latest;
    const predictor = this.predictor;
    if (!latest || !predictor) return;
    const me = latest.players.find((p) => p.id === this.playerId);
    const weapon = activeWeapon(predictor.player);
    const def = WEAPONS[weapon.id];
    const scores: ScoreEntry[] = latest.players.map((p) => ({
      id: p.id,
      name: this.nameOf(p.id),
      points: p.points,
      kills: p.kills,
      headshots: p.headshots,
      life: p.life,
      isLocal: p.id === this.playerId,
    }));
    useAppStore.getState().patchHud({
      health: me?.health ?? 0,
      maxHealth: me?.maxHealth ?? PLAYER.maxHealth,
      alive: predictor.player.life === 'alive',
      points: me?.points ?? 0,
      weaponName: def.name,
      clip: weapon.clip,
      clipSize: def.clipSize,
      reserve: weapon.reserve,
      reloading: predictor.player.reloadTimer > 0,
      aiming: isDown(this.lastButtons, Button.Aim),
      round: latest.game.round,
      phase: latest.game.phase,
      phaseTimer: Math.ceil(latest.game.phaseTimer),
      zombiesRemaining: latest.game.zombiesRemaining,
      scores,
      fps: this.fps,
      rtt: this.rtt === null ? null : Math.round(this.rtt),
    });
  }
}
