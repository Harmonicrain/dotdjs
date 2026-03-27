import { GameAction } from './InputTypes';

export interface InputUpdateResult {
  actionStates: Map<GameAction, boolean>;
  movementVector: { x: number; y: number };
  mouseLook: { x: number; y: number };
  gamepadLook: { x: number; y: number };
}

export interface InputDeviceHandler {
  update(sensitivity: number, deadzone?: number): InputUpdateResult;
  clearState(): void;
  isFireActive(): boolean;
}
