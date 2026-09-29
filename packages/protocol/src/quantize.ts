import type { PlayerInput } from '@dotd/sim';

const AXIS_SCALE = 127;

const finiteOr = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

export const quantizeAxis = (v: number): number =>
  Math.round(clamp(finiteOr(v, 0), -1, 1) * AXIS_SCALE) / AXIS_SCALE;

/**
 * Rounds an input to exactly what survives the wire. The client must predict with the quantized
 * input so it simulates the same thing the server will.
 */
export function quantizeInput(input: PlayerInput): PlayerInput {
  return {
    seq: input.seq >>> 0,
    moveX: quantizeAxis(input.moveX),
    moveY: quantizeAxis(input.moveY),
    yaw: Math.fround(finiteOr(input.yaw, 0)),
    pitch: Math.fround(clamp(finiteOr(input.pitch, 0), -Math.PI / 2, Math.PI / 2)),
    buttons: input.buttons & 0xffff,
    weaponSlot: clamp(Math.trunc(finiteOr(input.weaponSlot, 0)), 0, 255),
    viewTick: Math.max(0, finiteOr(input.viewTick, 0)),
  };
}

export const axisToWire = (v: number): number => Math.round(quantizeAxis(v) * AXIS_SCALE);
export const axisFromWire = (v: number): number => v / AXIS_SCALE;

/** Centimetre-precision position component (range ±327 m). */
export const POSITION_SCALE = 100;
export const posToWire = (v: number): number =>
  clamp(Math.round(v * POSITION_SCALE), -32768, 32767);
export const posFromWire = (v: number): number => v / POSITION_SCALE;

const TWO_PI = Math.PI * 2;
export const angleToWire = (radians: number): number => {
  const wrapped = ((radians % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.round((wrapped / TWO_PI) * 65536) & 0xffff;
};
export const angleFromWire = (v: number): number => {
  const a = (v / 65536) * TWO_PI;
  return a > Math.PI ? a - TWO_PI : a;
};
