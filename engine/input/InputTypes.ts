/** Lightweight ref-like container used so InputManager can read live state
 *  without importing React. */
export interface GameStateProxy {
    hasStarted: boolean;
    isPaused: boolean;
    isSpectating: boolean;
    isGameOver: boolean;
    isConsoleOpen: boolean;
    isDebugActive: boolean;
    isInternalPointerRelease: boolean;
}

export enum GameAction {
  MOVE_FORWARD = "MOVE_FORWARD",
  MOVE_BACK = "MOVE_BACK",
  MOVE_LEFT = "MOVE_LEFT",
  MOVE_RIGHT = "MOVE_RIGHT",
  FIRE = "FIRE",
  AIM = "AIM",
  RELOAD = "RELOAD",
  INTERACT = "INTERACT",
  KNIFE = "KNIFE",
  SPRINT = "SPRINT",
  JUMP = "JUMP",
  CROUCH = "CROUCH",
  WEAPON_1 = "WEAPON_1",
  WEAPON_2 = "WEAPON_2",
  WEAPON_3 = "WEAPON_3",
  WEAPON_4 = "WEAPON_4",
  WEAPON_NEXT = "WEAPON_NEXT",
  TOGGLE_CONSOLE = "TOGGLE_CONSOLE"
}

export type InputDevice = 'KM' | 'CONTROLLER' | 'TOUCH';

export const INPUT_PROMPTS: Record<GameAction, { km: string; controller: string; touch: string }> = {
  [GameAction.INTERACT]: { km: 'F', controller: 'A', touch: 'HOLD' },
  [GameAction.RELOAD]: { km: 'R', controller: 'X', touch: 'RELOAD' },
  [GameAction.KNIFE]: { km: 'V', controller: 'R3', touch: 'KNIFE' },
  [GameAction.SPRINT]: { km: 'SHIFT', controller: 'L3', touch: 'SPRINT' },
  [GameAction.JUMP]: { km: 'SPACE', controller: 'A', touch: 'JUMP' },
  [GameAction.CROUCH]: { km: 'C', controller: 'B', touch: 'CROUCH' },
  [GameAction.AIM]: { km: 'RMB', controller: 'L2', touch: 'ADS' },
  [GameAction.FIRE]: { km: 'LMB', controller: 'R2', touch: 'TAP' },
  [GameAction.WEAPON_1]: { km: '1', controller: 'LB', touch: '1' },
  [GameAction.WEAPON_2]: { km: '2', controller: 'RB', touch: '2' },
  [GameAction.WEAPON_3]: { km: '3', controller: 'Y', touch: '3' },
  [GameAction.WEAPON_4]: { km: '4', controller: 'X', touch: '4' },
  [GameAction.WEAPON_NEXT]: { km: 'TAB', controller: 'Y', touch: 'SWAP' },
  [GameAction.MOVE_FORWARD]: { km: 'W', controller: 'LS', touch: 'JS' },
  [GameAction.MOVE_BACK]: { km: 'S', controller: 'LS', touch: 'JS' },
  [GameAction.MOVE_LEFT]: { km: 'A', controller: 'LS', touch: 'JS' },
  [GameAction.MOVE_RIGHT]: { km: 'D', controller: 'LS', touch: 'JS' },
  [GameAction.TOGGLE_CONSOLE]: { km: '`', controller: 'START', touch: 'MENU' },
};

export const getInputPrompt = (action: GameAction, device: InputDevice): string => {
  const prompts = INPUT_PROMPTS[action];
  if (!prompts) return '?';
  if (device === 'TOUCH') return prompts.touch;
  return device === 'CONTROLLER' ? prompts.controller : prompts.km;
};
