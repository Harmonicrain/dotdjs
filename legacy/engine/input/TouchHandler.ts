import { GameAction } from './InputTypes';
import type { InputDeviceHandler, InputUpdateResult } from './InputDeviceHandler';

export class TouchHandler implements InputDeviceHandler {
  private touchActionStates = new Map<GameAction, boolean>();
  private touchLookAccumulator = { x: 0, y: 0 };
  private touchMoveVector = { x: 0, y: 0 };

  private readonly result: InputUpdateResult = {
    actionStates: new Map<GameAction, boolean>(),
    movementVector: { x: 0, y: 0 },
    mouseLook: { x: 0, y: 0 },
    gamepadLook: { x: 0, y: 0 },
  };

  injectTouchLook(dx: number, dy: number): void {
    this.touchLookAccumulator.x += dx;
    this.touchLookAccumulator.y += dy;
  }

  setTouchMoveVector(x: number, y: number): void {
    this.touchMoveVector.x = x;
    this.touchMoveVector.y = y;
  }

  setTouchAction(action: GameAction, held: boolean): void {
    this.touchActionStates.set(action, held);
  }

  isFireActive(): boolean {
    return this.touchActionStates.get(GameAction.FIRE) || false;
  }

  update(sensitivity: number): InputUpdateResult {
    const r = this.result;

    // Consume touch look accumulator into mouseLook
    r.mouseLook.x = this.touchLookAccumulator.x * sensitivity;
    r.mouseLook.y = this.touchLookAccumulator.y * sensitivity;
    this.touchLookAccumulator.x = 0;
    this.touchLookAccumulator.y = 0;

    // Zero out gamepad look
    r.gamepadLook.x = 0;
    r.gamepadLook.y = 0;

    // Copy touch movement vector (already normalized by TouchControls)
    r.movementVector.x = this.touchMoveVector.x;
    r.movementVector.y = this.touchMoveVector.y;

    // Copy touch action states
    for (const action of Object.values(GameAction)) {
      r.actionStates.set(action, this.touchActionStates.get(action) || false);
    }

    return r;
  }

  clearState(): void {
    this.touchActionStates.clear();
    this.touchLookAccumulator.x = 0;
    this.touchLookAccumulator.y = 0;
    this.touchMoveVector.x = 0;
    this.touchMoveVector.y = 0;
  }
}
