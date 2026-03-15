
import { CONTROLLER_CONFIG } from '../config';

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

export type InputDevice = 'KM' | 'CONTROLLER';

export const INPUT_PROMPTS: Record<GameAction, { km: string; controller: string }> = {
  [GameAction.INTERACT]: { km: 'F', controller: 'A' },
  [GameAction.RELOAD]: { km: 'R', controller: 'X' },
  [GameAction.KNIFE]: { km: 'V', controller: 'R3' },
  [GameAction.SPRINT]: { km: 'SHIFT', controller: 'L3' },
  [GameAction.JUMP]: { km: 'SPACE', controller: 'A' },
  [GameAction.CROUCH]: { km: 'C', controller: 'B' },
  [GameAction.AIM]: { km: 'RMB', controller: 'L2' },
  [GameAction.FIRE]: { km: 'LMB', controller: 'R2' },
  [GameAction.WEAPON_1]: { km: '1', controller: 'LB' },
  [GameAction.WEAPON_2]: { km: '2', controller: 'RB' },
  [GameAction.WEAPON_3]: { km: '3', controller: 'Y' },
  [GameAction.WEAPON_4]: { km: '4', controller: 'X' },
  [GameAction.WEAPON_NEXT]: { km: 'TAB', controller: 'Y' },
  [GameAction.MOVE_FORWARD]: { km: 'W', controller: 'LS' },
  [GameAction.MOVE_BACK]: { km: 'S', controller: 'LS' },
  [GameAction.MOVE_LEFT]: { km: 'A', controller: 'LS' },
  [GameAction.MOVE_RIGHT]: { km: 'D', controller: 'LS' },
  [GameAction.TOGGLE_CONSOLE]: { km: '`', controller: 'START' },
};

export const getInputPrompt = (action: GameAction, device: InputDevice): string => {
  const prompts = INPUT_PROMPTS[action];
  if (!prompts) return '?';
  return device === 'CONTROLLER' ? prompts.controller : prompts.km;
};

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD & MOUSE BINDINGS - Only used when inputDevice === 'KM'
// ═══════════════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER BINDINGS - Only used when inputDevice === 'CONTROLLER'
// ═══════════════════════════════════════════════════════════════════════════════
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

export class InputManager {
  // ═══════════════════════════════════════════════════════════════════════════════
  // KEYBOARD & MOUSE STATE - Only tracked/used when inputDevice === 'KM'
  // ═══════════════════════════════════════════════════════════════════════════════
  private activeKeys = new Set<string>();
  private activeMouseButtons = new Set<number>();
  private mouseMovement = { x: 0, y: 0 };
  private mouseLook = { x: 0, y: 0 };

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONTROLLER STATE - Only tracked/used when inputDevice === 'CONTROLLER'
  // ═══════════════════════════════════════════════════════════════════════════════
  private controllerButtons: boolean[] = [];
  private controllerAxes: number[] = [];
  private gamepadLook = { x: 0, y: 0 };
  private controllerConnected = false;
  private _movementVector = { x: 0, y: 0 };

  // ═══════════════════════════════════════════════════════════════════════════════
  // DERIVED ACTION STATES - Computed from active device only
  // ═══════════════════════════════════════════════════════════════════════════════
  private actionStates = new Map<GameAction, boolean>();
  private previousActionStates = new Map<GameAction, boolean>();

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS - Bound references for clean removal
  // ═══════════════════════════════════════════════════════════════════════════════
  private _onKeyDown = (e: KeyboardEvent) => this._handleKeyDownEvent(e);
  private _onKeyUp = (e: KeyboardEvent) => this._handleKeyUp(e);
  private _onMouseDown = (e: MouseEvent) => this._handleMouseDownEvent(e);
  private _onMouseUp = (e: MouseEvent) => this._handleMouseUp(e);
  private _onMouseMove = (e: MouseEvent) => this._handleMouseMove(e);
  private _onBlur = () => this._handleBlur();
  private _onPointerLockChange = () => this._handlePointerLockChange();
  private _onContextMenu = (e: Event) => e.preventDefault();
  private _onVisibilityChange = () => this._handleVisibilityChange();
  
  // Additional mouseup handler that catches events at document level
  private _onDocumentMouseUp = (e: MouseEvent) => {
    this.activeMouseButtons.delete(e.button);
  };

  private canvas: HTMLCanvasElement | null = null;
  private onPause: ((paused: boolean) => void) | null = null;
  private stateProxy: GameStateProxy | null = null;
  
  // Debug Controls callback - called every frame when debug_controls is active
  private debugControlsCallback: ((data: {
    inputSource: 'MOUSE' | 'CONTROLLER' | 'NONE';
    rawMouseDelta: { x: number; y: number };
    rawControllerLook: { x: number; y: number };
  }) => void) | null = null;
  
  // Track last mouse movement for debug logging
  private lastMouseMovementForDebug = { x: 0, y: 0 };
  private debugControlsActive = false;
  
  private settings = {
    inputDevice: 'KM' as InputDevice,
    mouseSensitivity: 1.0,
    controllerSensitivity: 1.0,
    controllerDeadzone: 0.15
  };

  constructor() {
    // Check for already-connected controllers on construction
    this.detectConnectedController();
  }

  /**
   * Detect if a controller is already connected (handles page refresh with controller plugged in)
   */
  private detectConnectedController(): void {
    if (!navigator.getGamepads) return;
    
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.connected) {
        console.log('[InputManager] Controller already connected:', gp.id);
        this.controllerConnected = true;
        // Don't auto-switch to controller - let user choose or press a button
        break;
      }
    }
  }

  public updateSettings(updates: Partial<typeof this.settings>) {
    Object.assign(this.settings, updates);
    
    // When switching devices, clear the other device's state to prevent ghost inputs
    if (updates.inputDevice === 'KM') {
      this.controllerButtons = [];
      this.controllerAxes = [];
      this.gamepadLook = { x: 0, y: 0 };
    } else if (updates.inputDevice === 'CONTROLLER') {
      this.activeKeys.clear();
      this.activeMouseButtons.clear();
      this.mouseMovement = { x: 0, y: 0 };
      this.mouseLook = { x: 0, y: 0 };
    }
  }

  /**
   * Wire all DOM event listeners. Call once after the canvas is mounted.
   */
  public attachListeners(
    canvas: HTMLCanvasElement,
    state: GameStateProxy,
    onPause: (paused: boolean) => void,
  ): void {
    this.canvas = canvas;
    this.stateProxy = state;
    this.onPause = onPause;

    // Always attach KB/M listeners - they're lightweight and needed for device switching
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('contextmenu', this._onContextMenu);
    
    // CRITICAL: Add mouseup to document with capture phase to catch it before anything else
    // This fixes the issue where pointer lock causes mouseup to be missed on window
    document.addEventListener('mouseup', this._onDocumentMouseUp, true);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    
    // Controller connection events
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  public detachListeners(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    document.removeEventListener('mouseup', this._onDocumentMouseUp, true);
    window.removeEventListener('gamepadconnected', this._onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);

    this.canvas = null;
    this.stateProxy = null;
    this.onPause = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONTROLLER CONNECTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  private _onGamepadConnected = (e: GamepadEvent) => {
    console.log('[InputManager] Controller connected:', e.gamepad.id);
    this.controllerConnected = true;
    
    // Auto-switch to controller when one is connected
    this.settings.inputDevice = 'CONTROLLER';
    this.clearKMState();
    
    // Notify any external state stores
    if (this.stateProxy) {
      const store = (this.stateProxy as any).getState?.();
      if (store?.updateSettings) {
        store.updateSettings({ inputDevice: 'CONTROLLER' });
      }
    }
  };

  private _onGamepadDisconnected = (e: GamepadEvent) => {
    console.log('[InputManager] Controller disconnected:', e.gamepad.id);
    this.controllerConnected = false;
    this.controllerButtons = [];
    this.controllerAxes = [];
    this.gamepadLook = { x: 0, y: 0 };
    
    // Auto-switch back to KB/M
    this.settings.inputDevice = 'KM';
    
    if (this.stateProxy) {
      const store = (this.stateProxy as any).getState?.();
      if (store?.updateSettings) {
        store.updateSettings({ inputDevice: 'KM' });
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // KEYBOARD & MOUSE EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  private _handleKeyDownEvent(e: KeyboardEvent) {
    // If using controller, KB input switches to KM mode
    if (this.settings.inputDevice === 'CONTROLLER') {
      console.log('[InputManager] Keyboard input detected, switching to KB/M mode');
      this.settings.inputDevice = 'KM';
      this.clearControllerState();
    }
    
    if (this.stateProxy?.isSpectating) return;
    
    const isConsoleOpen = this.stateProxy?.isConsoleOpen;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote'].includes(e.code)) {
      if (!isConsoleOpen || e.code === 'Backquote') {
        e.preventDefault();
      }
    }
    
    if (e.repeat) return;
    this.activeKeys.add(e.code);
  }

  private _handleKeyUp(e: KeyboardEvent) {
    this.activeKeys.delete(e.code);
  }

  private _handleMouseDownEvent(e: MouseEvent) {
    // If using controller, mouse input switches to KM mode
    if (this.settings.inputDevice === 'CONTROLLER') {
      this.settings.inputDevice = 'KM';
      this.clearControllerState();
    }
    
    const s = this.stateProxy;
    if (!s?.hasStarted || s.isSpectating) return;

    // Handle pointer lock requests
    if (s.isPaused && document.pointerLockElement !== e.target && !s.isConsoleOpen) {
      if (this.canvas && e.target === this.canvas) {
        this.canvas.requestPointerLock();
      }
      return;
    }

    if (!document.pointerLockElement && e.target === this.canvas && !s.isConsoleOpen) {
      (e.target as HTMLCanvasElement).requestPointerLock();
    }

    this.activeMouseButtons.add(e.button);
  }

  private _handleMouseUp(e: MouseEvent) {
    this.activeMouseButtons.delete(e.button);
  }

  private _handleMouseMove(e: MouseEvent) {
    // Only accumulate mouse movement if in KM mode
    if (this.settings.inputDevice === 'KM') {
      this.mouseMovement.x += e.movementX;
      this.mouseMovement.y += e.movementY;
      
      // Track for debug logging
      this.lastMouseMovementForDebug.x = e.movementX;
      this.lastMouseMovementForDebug.y = e.movementY;
      
      // Log mouse movement when debug controls is active
      if (this.debugControlsActive && (e.movementX !== 0 || e.movementY !== 0)) {
        console.log(`[DEBUG_CONTROLS] MOUSE move: deltaX=${e.movementX.toFixed(2)}, deltaY=${e.movementY.toFixed(2)}, accumulated=(${this.mouseMovement.x.toFixed(2)}, ${this.mouseMovement.y.toFixed(2)})`);
      }
    }
  }

  /**
   * Enable/disable debug controls mode for input logging
   */
  public setDebugControlsActive(active: boolean): void {
    this.debugControlsActive = active;
    if (active) {
      console.log('[DEBUG_CONTROLS] InputManager debug mode ENABLED');
    }
  }

  /**
   * Set callback for debug controls data (called every frame when active)
   */
  public setDebugControlsCallback(callback: ((data: {
    inputSource: 'MOUSE' | 'CONTROLLER' | 'NONE';
    rawMouseDelta: { x: number; y: number };
    rawControllerLook: { x: number; y: number };
  }) => void) | null): void {
    this.debugControlsCallback = callback;
  }

  /**
   * Get current debug data for the frame
   */
  public getDebugControlsData(): {
    inputSource: 'MOUSE' | 'CONTROLLER' | 'NONE';
    rawMouseDelta: { x: number; y: number };
    rawControllerLook: { x: number; y: number };
  } {
    const mouseLook = this.getMouseLook();
    const gamepadLook = this.getGamepadLook();
    
    let inputSource: 'MOUSE' | 'CONTROLLER' | 'NONE' = 'NONE';
    if (this.settings.inputDevice === 'KM' && (mouseLook.x !== 0 || mouseLook.y !== 0)) {
      inputSource = 'MOUSE';
    } else if (this.settings.inputDevice === 'CONTROLLER' && (gamepadLook.x !== 0 || gamepadLook.y !== 0)) {
      inputSource = 'CONTROLLER';
    }
    
    return {
      inputSource,
      rawMouseDelta: { x: this.lastMouseMovementForDebug.x, y: this.lastMouseMovementForDebug.y },
      rawControllerLook: { x: gamepadLook.x, y: gamepadLook.y },
    };
  }

  private _handleBlur() {
    // Clear ALL input state on blur
    this.clearKMState();
    this.clearControllerState();

    const s = this.stateProxy;
    if (s?.hasStarted && !s.isPaused && !s.isSpectating && !s.isGameOver && !s.isConsoleOpen && !s.isDebugActive) {
      this.onPause?.(true);
    }
  }

  private _handlePointerLockChange() {
    const isLocked = document.pointerLockElement === this.canvas;
    const s = this.stateProxy;
    if (!s) return;

    if (!isLocked) {
      // Clear mouse buttons when pointer lock is lost
      this.activeMouseButtons.clear();

      if (s.isInternalPointerRelease) {
        return;
      }

      if (s.hasStarted && !s.isPaused && !s.isSpectating && !s.isGameOver && !s.isConsoleOpen) {
        this.onPause?.(true);
      }
    } else {
      this.canvas?.focus();
      if (s.hasStarted && s.isPaused && !s.isGameOver && !s.isConsoleOpen && !s.isDebugActive) {
        this.onPause?.(false);
        this.clearMouseMovement();
      }
    }
  }

  private _handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.clearKMState();
      this.clearControllerState();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATE CLEARING HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════
  private clearKMState() {
    this.activeKeys.clear();
    this.activeMouseButtons.clear();
    this.mouseMovement = { x: 0, y: 0 };
    this.mouseLook = { x: 0, y: 0 };
  }

  private clearControllerState() {
    this.controllerButtons = [];
    this.controllerAxes = [];
    this.gamepadLook = { x: 0, y: 0 };
  }

  public clearMouseMovement() {
    this.mouseMovement = { x: 0, y: 0 };
    this.mouseLook = { x: 0, y: 0 };
  }

  public reset() {
    this.clearKMState();
    this.clearControllerState();
    this.actionStates.clear();
    this.previousActionStates.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC STATE QUERIES
  // ═══════════════════════════════════════════════════════════════════════════════
  public isDown(action: GameAction): boolean {
    return this.actionStates.get(action) || false;
  }

  public justPressed(action: GameAction): boolean {
    return (this.actionStates.get(action) || false) && !(this.previousActionStates.get(action) || false);
  }

  /**
   * Check if a mouse button is CURRENTLY pressed (raw state, not cached).
   * Use this for automatic weapons to get real-time input state.
   */
  public isMouseButtonCurrentlyDown(button: number): boolean {
    return this.activeMouseButtons.has(button);
  }

  /**
   * Check if fire input is currently active (raw state check).
   * For KB/M: checks raw mouse button state
   * For controller: checks cached state (controller is polled, not event-driven)
   */
  public isFireInputActive(): boolean {
    if (this.settings.inputDevice === 'KM') {
      // Check raw mouse button state for immediate response
      const fireBinding = KM_BINDINGS[GameAction.FIRE];
      if (fireBinding.mouse !== undefined) {
        const isActive = this.activeMouseButtons.has(fireBinding.mouse);
        return isActive;
      }
      if (fireBinding.keyboard) {
        return this.activeKeys.has(fireBinding.keyboard);
      }
      return false;
    } else {
      // Controller is polled, so cached state is fine
      return this.actionStates.get(GameAction.FIRE) || false;
    }
  }

  public getInputDevice(): InputDevice {
    return this.settings.inputDevice;
  }

  public getMouseLook() {
    return this.mouseLook;
  }

  public getGamepadLook() {
    return this.gamepadLook;
  }

  public getMovementVector(): { x: number; y: number } {
    return this._movementVector;
  }
  
  public isControllerConnected(): boolean {
    return this.controllerConnected;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN UPDATE LOOP - Called every frame
  // ═══════════════════════════════════════════════════════════════════════════════
  public update() {
    // Snapshot previous state for justPressed detection
    this.previousActionStates = new Map(this.actionStates);

    // Process inputs based on active device ONLY
    if (this.settings.inputDevice === 'KM') {
      this.updateKMInputs();
    } else {
      this.updateControllerInputs();
    }
  }

  /**
   * Process Keyboard & Mouse inputs - ONLY called when inputDevice === 'KM'
   */
  private updateKMInputs() {
    // Consume mouse movement accumulator
    this.mouseLook.x = this.mouseMovement.x * this.settings.mouseSensitivity;
    this.mouseLook.y = this.mouseMovement.y * this.settings.mouseSensitivity;
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;

    // Zero out gamepad look since we're not using it
    this.gamepadLook.x = 0;
    this.gamepadLook.y = 0;

    // Compute keyboard movement vector (binary, normalized for diagonals)
    let kx = 0, ky = 0;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_RIGHT]?.keyboard ?? '')) kx += 1;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_LEFT]?.keyboard ?? '')) kx -= 1;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_FORWARD]?.keyboard ?? '')) ky -= 1;
    if (this.activeKeys.has(KM_BINDINGS[GameAction.MOVE_BACK]?.keyboard ?? '')) ky += 1;
    const kMag = Math.sqrt(kx * kx + ky * ky);
    if (kMag > 0) {
      this._movementVector.x = kx / kMag;
      this._movementVector.y = ky / kMag;
    } else {
      this._movementVector.x = 0;
      this._movementVector.y = 0;
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

      this.actionStates.set(action, isActive);
    }
  }

  /**
   * Process Controller inputs - ONLY called when inputDevice === 'CONTROLLER'
   */
  private updateControllerInputs() {
    // Zero out mouse look since we're not using it
    this.mouseLook.x = 0;
    this.mouseLook.y = 0;
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;

    // Poll the gamepad
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];

    if (!gp || !gp.connected) {
      // No controller available, clear state
      this.controllerButtons = [];
      this.controllerAxes = [];
      this.gamepadLook = { x: 0, y: 0 };
      this._movementVector.x = 0;
      this._movementVector.y = 0;

      // Clear all action states
      for (const action of Object.values(GameAction)) {
        this.actionStates.set(action, false);
      }
      return;
    }

    // Update raw controller state
    this.controllerButtons = gp.buttons.map(b => b.pressed || b.value > 0.5);
    this.controllerAxes = [...gp.axes];

    // Process right stick for look (axes 2 & 3)
    const dz = this.settings.controllerDeadzone;
    const rawX = gp.axes[2] || 0;
    const rawY = gp.axes[3] || 0;

    if (Math.abs(rawX) > dz) {
      this.gamepadLook.x = (rawX * Math.abs(rawX)) * this.settings.controllerSensitivity;
    } else {
      this.gamepadLook.x = 0;
    }

    if (Math.abs(rawY) > dz) {
      this.gamepadLook.y = (rawY * Math.abs(rawY)) * this.settings.controllerSensitivity;
    } else {
      this.gamepadLook.y = 0;
    }
    
    // Log controller look when debug controls is active
    if (this.debugControlsActive && (this.gamepadLook.x !== 0 || this.gamepadLook.y !== 0)) {
      console.log(`[DEBUG_CONTROLS] CONTROLLER look: rawX=${rawX.toFixed(3)}, rawY=${rawY.toFixed(3)}, processed=(${this.gamepadLook.x.toFixed(3)}, ${this.gamepadLook.y.toFixed(3)})`);
    }

    // Scaled radial deadzone for left stick movement vector
    const lsX = gp.axes[0] || 0;
    const lsY = gp.axes[1] || 0;
    const mag = Math.sqrt(lsX * lsX + lsY * lsY);
    const moveDz = this.settings.controllerDeadzone;
    if (mag < moveDz) {
      this._movementVector.x = 0;
      this._movementVector.y = 0;
    } else {
      const scaled = Math.min((mag - moveDz) / (1 - moveDz), 1);
      this._movementVector.x = (lsX / mag) * scaled;
      this._movementVector.y = (lsY / mag) * scaled;
    }

    // Compute action states from controller only
    for (const action of Object.values(GameAction)) {
      const binding = CONTROLLER_BINDINGS[action];
      let isActive = false;

      // Check button
      if (binding.button !== undefined && this.controllerButtons[binding.button]) {
        isActive = true;
      }

      // Check axis (for movement stick)
      if (!isActive && binding.axis) {
        const val = this.controllerAxes[binding.axis.index] || 0;
        if (binding.axis.direction === 1) {
          if (val > binding.axis.threshold) isActive = true;
        } else {
          if (val < -binding.axis.threshold) isActive = true;
        }
      }

      this.actionStates.set(action, isActive);
    }
  }
}
