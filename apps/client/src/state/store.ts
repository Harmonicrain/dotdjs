import { create } from 'zustand';
import type { GamePhase, LifeState } from '@dotd/sim';
import { loadSettings, saveSettings } from './settings';
import type { Settings } from './settings';

export type Screen = 'menu' | 'connecting' | 'playing';
export type GameMode = 'solo' | 'host' | 'join';

export interface ScoreEntry {
  id: number;
  name: string;
  points: number;
  kills: number;
  headshots: number;
  life: LifeState;
  isLocal: boolean;
}

export interface Hud {
  health: number;
  maxHealth: number;
  alive: boolean;
  points: number;
  weaponName: string;
  clip: number;
  clipSize: number;
  reserve: number;
  reloading: boolean;
  aiming: boolean;
  round: number;
  phase: GamePhase;
  phaseTimer: number;
  zombiesRemaining: number;
  scores: ScoreEntry[];
  roomCode: string | null;
  fps: number;
  rtt: number | null;
}

export const EMPTY_HUD: Hud = {
  health: 100,
  maxHealth: 100,
  alive: true,
  points: 0,
  weaponName: '',
  clip: 0,
  clipSize: 0,
  reserve: 0,
  reloading: false,
  aiming: false,
  round: 0,
  phase: 'waiting',
  phaseTimer: 0,
  zombiesRemaining: 0,
  scores: [],
  roomCode: null,
  fps: 0,
  rtt: null,
};

/** One-off feedback the HUD animates; `key` changes each time so repeats retrigger. */
export interface Feedback {
  hitmarker: { key: number; kind: 'hit' | 'kill' | 'headshot' } | null;
  damage: { key: number; angle: number } | null;
  popups: { key: number; amount: number }[];
  messages: { key: number; text: string }[];
}

export interface GameOverStats {
  round: number;
  points: number;
  kills: number;
  headshots: number;
}

export interface GameRequest {
  mode: GameMode;
  roomCode?: string;
  /** Changes on every start so the game view remounts. */
  id: number;
}

interface AppState {
  screen: Screen;
  request: GameRequest | null;
  error: string | null;
  /** Pointer released: show the pause / click-to-play overlay. */
  paused: boolean;
  scoreboard: boolean;
  settings: Settings;
  hud: Hud;
  feedback: Feedback;
  gameOver: GameOverStats | null;

  startGame(mode: GameMode, roomCode?: string): void;
  leaveGame(error?: string | null): void;
  setScreen(screen: Screen): void;
  updateSettings(patch: Partial<Settings>): void;
  patchHud(patch: Partial<Hud>): void;
}

let feedbackKey = 0;
export const nextFeedbackKey = (): number => ++feedbackKey;

const sameValue = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) || (Array.isArray(a) && Array.isArray(b) && JSON.stringify(a) === JSON.stringify(b));

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'menu',
  request: null,
  error: null,
  paused: true,
  scoreboard: false,
  settings: loadSettings(),
  hud: EMPTY_HUD,
  feedback: { hitmarker: null, damage: null, popups: [], messages: [] },
  gameOver: null,

  startGame(mode, roomCode) {
    set({
      screen: 'connecting',
      request: { mode, ...(roomCode ? { roomCode } : {}), id: Date.now() },
      error: null,
      paused: true,
      hud: EMPTY_HUD,
      feedback: { hitmarker: null, damage: null, popups: [], messages: [] },
      gameOver: null,
    });
  },

  leaveGame(error = null) {
    set({ screen: 'menu', request: null, error, paused: true, scoreboard: false, gameOver: null });
  },

  setScreen(screen) {
    set({ screen });
  },

  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    saveSettings(settings);
    set({ settings });
  },

  patchHud(patch) {
    const hud = get().hud;
    const changed = (Object.keys(patch) as (keyof Hud)[]).some((key) => !sameValue(hud[key], patch[key]));
    if (changed) set({ hud: { ...hud, ...patch } });
  },
}));
