import { GameAction } from './InputTypes';
import type { InputDeviceHandler, InputUpdateResult } from './InputDeviceHandler';

type KMBinding = {
  keyboard?: string;
  mouse?: number;
};

const KM_BINDINGS: Record<GameAction, KMBinding> = {
  [GameAction.MOVE_FORWARD]: { keyboard: 'KeyW' },
  [GameAction.MOVE_BACK]: { keyboard: 'KeyS' },
  [GameAction.MOVE_LEFT]: { keyboard: 'KeyA' },
  [GameAction.MOVE_RIGHT]: { keyboard: 'KeyD' },
  [GameAction.FIRE]: { mouse: 0 },
  [GameAction.AIM]: { mouse: 2 },
  [GameAction.RELOAD]: { keyboard: 'KeyR' },
  [GameAction.INTERACT]: { keyboard: 'KeyF' },
  [GameAction.KNIFE]: { keyboard: 'KeyV' },
  [GameAction.SPRINT]: { keyboard: 'ShiftLeft' },
  [GameAction.JUMP]: { keyboard: 'Space' },
  [GameAction.CROUCH]: { keyboard: 'KeyC' },
  [GameAction.WEAPON_1]: { keyboard: 'Digit1' },
  [GameAction.WEAPON_2]: { keyboard: 'Digit2' },
  [GameAction.WEAPON_3]: { keyboard: 'Digit3' },
  [GameAction.WEAPON_4]: { keyboard: 'Digit4' },
  [GameAction.WEAPON_NEXT]: { keyboard: 'Tab' },
  [GameAction.TOGGLE_CONSOLE]: { keyboard: 'Backquote' },
};

export class KeyboardMouseHandler implements InputDeviceHandler {
  private activeKeys = new Set<string>();
  private activeMouseButtons = new Set<number>();
  private mouseMovement = { x: 0, y: 0 };

  private readonly result: InputUpdateResult = {
    actionStates: new Map<GameAction, boolean>(),
    movementVector: { x: 0, y: 0 },
    mouseLook: { x: 0, y: 0 },
    gamepadLook: { x: 0, y: 0 },
  };

  handleKeyDown(code: string): void {
    this.activeKeys.add(code);
  }

  handleKeyUp(code: string): void {
    this.activeKeys.delete(code);
  }

  handleMouseDown(button: number): void {
    this.activeMouseButtons.add(button);
  }

  handleMouseUp(button: number): void {
    this.activeMouseButtons.delete(button);
  }

  handleMouseMove(dx: number, dy: number): void {
    this.mouseMovement.x += dx;
    this.mouseMovement.y += dy;
  }

  isMouseButtonDown(button: number): boolean {
    return this.activeMouseButtons.has(button);
  }

  isFireActive(): boolean {
    const fireBinding = KM_BINDINGS[GameAction.FIRE];
    if (fireBinding.mouse !== undefined) {
      return this.activeMouseButtons.has(fireBinding.mouse);
    }
    if (fireBinding.keyboard) {
      return this.activeKeys.has(fireBinding.keyboard);
    }
    return false;
  }

  update(sensitivity: number): InputUpdateResult {
    const r = this.result;

    // Consume mouse movement accumulator
    r.mouseLook.x = this.mouseMovement.x * sensitivity;
    r.mouseLook.y = this.mouseMovement.y * sensitivity;
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;

    // Zero out gamepad look
    r.gamepadLook.x = 0;
    r.gamepadLook.y = 0;

    // Compute keyboard movement vector (binary, normalized for diagonals)
    let kx = 0, ky = 0;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_RIGHT]?.keyboard ?? '')) kx += 1;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_LEFT]?.keyboard ?? '')) kx -= 1;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_FORWARD]?.keyboard ?? '')) ky -= 1;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_BACK]?.keyboard ?? '')) ky += 1;
    const kMag = Math.sqrt(kx * kx + ky * ky);
    if (kMag > 0) {
      r.movementVector.x = kx / kMag;
      r.movementVector.y = ky / kMag;
    } else {
      r.movementVector.x = 0;
      r.movementVector.y = 0;
    }

    // Compute action states from KB/M only
    for (const action of Object.values(GameAction)) {
      const binding = KM_BINDINGS[action];
      let isActive = false;

      if (binding.keyboard && this.activeKeys.has(binding.keyboard)) {
        isActive = true;
      }
      if (!isActive && binding.mouse !== undefined && this.activeMouseButtons.has(binding.mouse)) {
        isActive = true;
      }

      r.actionStates.set(action, isActive);
    }

    return r;
  }

  clearMouseButtons(): void {
    this.activeMouseButtons.clear();
  }

  clearState(): void {
    this.activeKeys.clear();
    this.activeMouseButtons.clear();
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }

  clearMouseMovement(): void {
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }
}
