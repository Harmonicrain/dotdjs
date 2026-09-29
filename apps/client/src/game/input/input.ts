import { Button, PLAYER } from '@dotd/sim';

export interface InputSettings {
  mouseSensitivity: number;
  gamepadSensitivity: number;
  invertY: boolean;
}

export interface SampledInput {
  moveX: number;
  moveY: number;
  buttons: number;
  weaponSlot: number;
}

const MOUSE_RADIANS_PER_PIXEL = 0.0022;
const GAMEPAD_RADIANS_PER_SECOND = 3.2;
const STICK_DEADZONE = 0.15;
const TRIGGER_THRESHOLD = 0.3;

const KEY_BUTTONS: Record<string, number> = {
  Space: Button.Jump,
  ShiftLeft: Button.Sprint,
  ShiftRight: Button.Sprint,
  KeyR: Button.Reload,
  KeyF: Button.Interact,
  KeyE: Button.Interact,
  KeyV: Button.Melee,
  KeyC: Button.Crouch,
  ControlLeft: Button.Crouch,
};

// Standard gamepad mapping: https://w3c.github.io/gamepad/#remapping
const PAD = { A: 0, B: 1, X: 2, Y: 3, RB: 5, LT: 6, RT: 7, START: 9, L3: 10, R3: 11 } as const;

function deadzone(x: number, y: number): [number, number] {
  const magnitude = Math.hypot(x, y);
  if (magnitude < STICK_DEADZONE) return [0, 0];
  const scaled = Math.min(1, (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE));
  return [(x / magnitude) * scaled, (y / magnitude) * scaled];
}

/**
 * Turns keyboard, mouse and gamepad state into per-tick player input. Look direction is
 * accumulated every frame (not per tick) so aiming stays smooth at any frame rate.
 */
export class InputController {
  yaw = 0;
  pitch = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private readonly keys = new Set<string>();
  private mouseButtons = 0;
  private weaponSlot = 0;
  private slotStep = 0;
  private previousPadButtons: boolean[] = [];
  private readonly cleanup: (() => void)[] = [];

  /** Called when the player asks to pause (Escape / Start / losing pointer lock). */
  onPause: () => void = () => {};
  /** Called when the scoreboard key is pressed or released. */
  onScoreboard: (visible: boolean) => void = () => {};

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private settings: InputSettings,
  ) {
    this.listen(document, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(document, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
    this.listen(document, 'mousemove', (e) => this.onMouseMove(e as MouseEvent));
    this.listen(canvas, 'mousedown', (e) => this.onMouseButton(e as MouseEvent, true));
    this.listen(document, 'mouseup', (e) => this.onMouseButton(e as MouseEvent, false));
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(canvas, 'wheel', (e) => {
      this.slotStep += Math.sign((e as WheelEvent).deltaY);
    });
    this.listen(document, 'pointerlockchange', () => {
      if (!this.locked) {
        this.releaseAll();
        this.onPause();
      }
    });
    this.listen(window, 'blur', () => this.releaseAll());
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  /** Pointer lock needs a user gesture; call from a click handler. */
  requestLock(): void {
    const request = this.canvas.requestPointerLock({ unadjustedMovement: true }) as
      | Promise<void>
      | undefined;
    // Some browsers reject unadjustedMovement; fall back to a plain lock.
    request?.catch(() => this.canvas.requestPointerLock());
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  updateSettings(settings: InputSettings): void {
    this.settings = settings;
  }

  /** Aim including recoil; this is what the player shoots along. */
  get aimYaw(): number {
    return this.yaw + this.recoilYaw;
  }

  get aimPitch(): number {
    return Math.max(-PLAYER.maxPitch, Math.min(PLAYER.maxPitch, this.pitch + this.recoilPitch));
  }

  addRecoil(pitch: number, yaw: number): void {
    this.recoilPitch += pitch;
    this.recoilYaw += yaw;
  }

  /** Per-frame: recoil recovery and analog-stick look. */
  update(dt: number, recoilRecovery: number): void {
    const decay = Math.exp(-recoilRecovery * dt);
    this.recoilPitch *= decay;
    this.recoilYaw *= decay;

    const pad = this.gamepad();
    if (pad && this.locked) {
      const [lx, ly] = deadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const speed = GAMEPAD_RADIANS_PER_SECOND * this.settings.gamepadSensitivity * dt;
      this.yaw -= lx * Math.abs(lx) * speed;
      this.pitch -= ly * Math.abs(ly) * speed * (this.settings.invertY ? -1 : 1);
      this.clampPitch();
    }
  }

  /** Samples movement and buttons for one simulation tick. */
  sample(weaponCount: number): SampledInput {
    if (!this.locked) return { moveX: 0, moveY: 0, buttons: 0, weaponSlot: this.weaponSlot };

    let moveX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let moveY = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let buttons = this.mouseButtons;
    for (const [code, button] of Object.entries(KEY_BUTTONS)) {
      if (this.keys.has(code)) buttons |= button;
    }

    const pad = this.gamepad();
    if (pad) {
      const [sx, sy] = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      if (sx !== 0 || sy !== 0) [moveX, moveY] = [sx, -sy];
      const held = (i: number) => pad.buttons[i]?.pressed ?? false;
      const pressed = (i: number) => held(i) && !this.previousPadButtons[i];
      if ((pad.buttons[PAD.RT]?.value ?? 0) > TRIGGER_THRESHOLD) buttons |= Button.Fire;
      if ((pad.buttons[PAD.LT]?.value ?? 0) > TRIGGER_THRESHOLD) buttons |= Button.Aim;
      if (held(PAD.A)) buttons |= Button.Jump;
      if (held(PAD.L3)) buttons |= Button.Sprint;
      if (held(PAD.X)) buttons |= Button.Reload | Button.Interact;
      if (held(PAD.RB) || held(PAD.R3)) buttons |= Button.Melee;
      if (held(PAD.B)) buttons |= Button.Crouch;
      if (pressed(PAD.Y)) this.slotStep += 1;
      if (pressed(PAD.START)) this.onPause();
      this.previousPadButtons = pad.buttons.map((b) => b.pressed);
    }

    if (this.slotStep !== 0 && weaponCount > 1) {
      this.weaponSlot = (((this.weaponSlot + this.slotStep) % weaponCount) + weaponCount) % weaponCount;
    }
    this.slotStep = 0;
    this.weaponSlot = Math.min(this.weaponSlot, Math.max(0, weaponCount - 1));

    return { moveX, moveY, buttons, weaponSlot: this.weaponSlot };
  }

  dispose(): void {
    this.releaseLock();
    for (const off of this.cleanup) off();
    this.cleanup.length = 0;
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanup.push(() => target.removeEventListener(type, handler));
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    if (event.code === 'Tab') {
      event.preventDefault();
      this.onScoreboard(down);
      return;
    }
    if (!this.locked) return;
    if (down && event.code.startsWith('Digit')) {
      const slot = Number(event.code.slice(5)) - 1;
      if (slot >= 0 && slot < 9) this.weaponSlot = slot;
    }
    if (down) this.keys.add(event.code);
    else this.keys.delete(event.code);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.locked) return;
    const scale = MOUSE_RADIANS_PER_PIXEL * this.settings.mouseSensitivity;
    this.yaw -= event.movementX * scale;
    this.pitch -= event.movementY * scale * (this.settings.invertY ? -1 : 1);
    this.clampPitch();
  }

  private onMouseButton(event: MouseEvent, down: boolean): void {
    const button = event.button === 0 ? Button.Fire : event.button === 2 ? Button.Aim : 0;
    if (!button) return;
    if (down && !this.locked) return; // the click that grabs the pointer should not fire
    this.mouseButtons = down ? this.mouseButtons | button : this.mouseButtons & ~button;
  }

  private clampPitch(): void {
    this.pitch = Math.max(-PLAYER.maxPitch, Math.min(PLAYER.maxPitch, this.pitch));
  }

  private releaseAll(): void {
    this.keys.clear();
    this.mouseButtons = 0;
  }

  private gamepad(): Gamepad | null {
    if (typeof navigator.getGamepads !== 'function') return null;
    for (const pad of navigator.getGamepads()) {
      if (pad?.connected && pad.mapping === 'standard') return pad;
    }
    return null;
  }
}
