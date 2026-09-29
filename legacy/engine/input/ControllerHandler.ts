import { GameAction } from './InputTypes';
import type { InputDeviceHandler, InputUpdateResult } from './InputDeviceHandler';

type ControllerBinding = {
  button?: number;
  axis?: { index: number; threshold: number; direction: 1 | -1 };
};

const CONTROLLER_BINDINGS: Record<GameAction, ControllerBinding> = {
  [GameAction.MOVE_FORWARD]: { axis: { index: 1, threshold: 0.2, direction: -1 } },
  [GameAction.MOVE_BACK]: { axis: { index: 1, threshold: 0.2, direction: 1 } },
  [GameAction.MOVE_LEFT]: { axis: { index: 0, threshold: 0.2, direction: -1 } },
  [GameAction.MOVE_RIGHT]: { axis: { index: 0, threshold: 0.2, direction: 1 } },
  [GameAction.FIRE]: { button: 7 },      // R2
  [GameAction.AIM]: { button: 6 },       // L2
  [GameAction.RELOAD]: { button: 2 },    // Square/X
  [GameAction.INTERACT]: { button: 0 },  // Cross/A (separate from reload on controller)
  [GameAction.KNIFE]: { button: 11 },    // R3
  [GameAction.SPRINT]: { button: 10 },   // L3
  [GameAction.JUMP]: { button: 0 },      // Cross/A
  [GameAction.CROUCH]: { button: 1 },    // Circle/B
  [GameAction.WEAPON_1]: { button: 4 },  // LB
  [GameAction.WEAPON_2]: { button: 5 },  // RB
  [GameAction.WEAPON_3]: {},
  [GameAction.WEAPON_4]: {},
  [GameAction.WEAPON_NEXT]: { button: 3 }, // Triangle/Y
  [GameAction.TOGGLE_CONSOLE]: { button: 9 }, // Start/Options
};

export class ControllerHandler implements InputDeviceHandler {
  private controllerButtons: boolean[] = [];
  private controllerAxes: number[] = [];
  private connected = false;

  private readonly result: InputUpdateResult = {
    actionStates: new Map<GameAction, boolean>(),
    movementVector: { x: 0, y: 0 },
    mouseLook: { x: 0, y: 0 },
    gamepadLook: { x: 0, y: 0 },
  };

  detectAlreadyConnected(): boolean {
    if (!navigator.getGamepads) return false;

    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.connected) {
        console.log('[InputManager] Controller already connected:', gp.id);
        this.connected = true;
        return true;
      }
    }
    return false;
  }

  handleConnected(): void {
    this.connected = true;
  }

  handleDisconnected(): void {
    this.connected = false;
    this.clearState();
  }

  isConnected(): boolean {
    return this.connected;
  }

  isFireActive(): boolean {
    // Controller uses polled/cached state — handled by coordinator via actionStates
    return false;
  }

  update(sensitivity: number, deadzone?: number): InputUpdateResult {
    const r = this.result;
    const dz = deadzone ?? 0.15;

    // Zero out mouse look
    r.mouseLook.x = 0;
    r.mouseLook.y = 0;

    // Poll the gamepad
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];

    if (!gp || !gp.connected) {
      this.controllerButtons = [];
      this.controllerAxes = [];
      r.gamepadLook.x = 0;
      r.gamepadLook.y = 0;
      r.movementVector.x = 0;
      r.movementVector.y = 0;

      for (const action of Object.values(GameAction)) {
        r.actionStates.set(action, false);
      }
      return r;
    }

    // Update raw controller state
    this.controllerButtons = gp.buttons.map(b => b.pressed || b.value > 0.5);
    this.controllerAxes = [...gp.axes];

    // Process right stick for look (axes 2 & 3)
    const rawX = gp.axes[2] || 0;
    const rawY = gp.axes[3] || 0;

    r.gamepadLook.x = Math.abs(rawX) > dz ? (rawX * Math.abs(rawX)) * sensitivity : 0;
    r.gamepadLook.y = Math.abs(rawY) > dz ? (rawY * Math.abs(rawY)) * sensitivity : 0;

    // Scaled radial deadzone for left stick movement vector
    const lsX = gp.axes[0] || 0;
    const lsY = gp.axes[1] || 0;
    const mag = Math.sqrt(lsX * lsX + lsY * lsY);
    if (mag < dz) {
      r.movementVector.x = 0;
      r.movementVector.y = 0;
    } else {
      const scaled = Math.min((mag - dz) / (1 - dz), 1);
      r.movementVector.x = (lsX / mag) * scaled;
      r.movementVector.y = (lsY / mag) * scaled;
    }

    // Compute action states from controller only
    for (const action of Object.values(GameAction)) {
      const binding = CONTROLLER_BINDINGS[action];
      let isActive = false;

      if (binding.button !== undefined && this.controllerButtons[binding.button]) {
        isActive = true;
      }

      if (!isActive && binding.axis) {
        const val = this.controllerAxes[binding.axis.index] || 0;
        if (binding.axis.direction === 1) {
          if (val > binding.axis.threshold) isActive = true;
        } else {
          if (val < -binding.axis.threshold) isActive = true;
        }
      }

      r.actionStates.set(action, isActive);
    }

    return r;
  }

  clearState(): void {
    this.controllerButtons = [];
    this.controllerAxes = [];
    this.result.gamepadLook.x = 0;
    this.result.gamepadLook.y = 0;
  }
}
