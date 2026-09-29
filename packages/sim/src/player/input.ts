/** Button bit flags carried in every input. */
export const Button = {
  Fire: 1 << 0,
  Aim: 1 << 1,
  Jump: 1 << 2,
  Sprint: 1 << 3,
  Reload: 1 << 4,
  Interact: 1 << 5,
  Melee: 1 << 6,
  Crouch: 1 << 7,
} as const;

/**
 * One tick of player intent. The client produces exactly one per simulation tick and the server
 * applies them in order, so both sides step the local player identically.
 */
export interface PlayerInput {
  /** Monotonic per-player sequence number. */
  seq: number;
  /** Strafe axis, -1 (left) to 1 (right). */
  moveX: number;
  /** Forward axis, -1 (back) to 1 (forward). */
  moveY: number;
  yaw: number;
  pitch: number;
  buttons: number;
  /** Weapon slot the player wants active. */
  weaponSlot: number;
  /** The (fractional) server tick the client was displaying; used to rewind for hit checks. */
  viewTick: number;
}

export const EMPTY_INPUT: Readonly<PlayerInput> = {
  seq: 0,
  moveX: 0,
  moveY: 0,
  yaw: 0,
  pitch: 0,
  buttons: 0,
  weaponSlot: 0,
  viewTick: 0,
};

export const isDown = (buttons: number, button: number): boolean => (buttons & button) !== 0;

export const wasPressed = (buttons: number, prevButtons: number, button: number): boolean =>
  (buttons & button) !== 0 && (prevButtons & button) === 0;
