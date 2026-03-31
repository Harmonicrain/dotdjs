
import { KeyboardMouseHandler } from './input/KeyboardMouseHandler';
import { ControllerHandler } from './input/ControllerHandler';
import { TouchHandler } from './input/TouchHandler';
import type { InputDeviceHandler } from './input/InputDeviceHandler';

// Re-export shared types so existing consumer imports continue to work
export { GameAction, INPUT_PROMPTS, getInputPrompt } from './input/InputTypes';
export type { GameStateProxy, InputDevice } from './input/InputTypes';
import type { GameStateProxy, InputDevice } from './input/InputTypes';
import { GameAction } from './input/InputTypes';

export class InputManager {
  // ═══════════════════════════════════════════════════════════════════════════════
  // DEVICE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  private kmHandler = new KeyboardMouseHandler();
  private controllerHandler = new ControllerHandler();
  private touchHandler = new TouchHandler();

  // ═══════════════════════════════════════════════════════════════════════════════
  // DERIVED ACTION STATES - Computed from active device only
  // ═══════════════════════════════════════════════════════════════════════════════
  private actionStates = new Map<GameAction, boolean>();
  private previousActionStates = new Map<GameAction, boolean>();

  // ═══════════════════════════════════════════════════════════════════════════════
  // OUTPUT STATE - Written from handler results each frame
  // ═══════════════════════════════════════════════════════════════════════════════
  private mouseLook = { x: 0, y: 0 };
  private gamepadLook = { x: 0, y: 0 };
  private _movementVector = { x: 0, y: 0 };

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

  private _onDocumentMouseUp = (e: MouseEvent) => {
    this.kmHandler.handleMouseUp(e.button);
  };

  private canvas: HTMLCanvasElement | null = null;
  private onPause: ((paused: boolean) => void) | null = null;
  private stateProxy: GameStateProxy | null = null;
  private onInputDeviceChange: ((device: InputDevice) => void) | null = null;

  // Debug Controls
  private lastMouseMovementForDebug = { x: 0, y: 0 };
  private debugControlsActive = false;

  private settings = {
    inputDevice: 'KM' as InputDevice,
    mouseSensitivity: 1.0,
    controllerSensitivity: 1.0,
    controllerDeadzone: 0.15,
    touchSensitivity: 5.0
  };

  constructor() {
    this.controllerHandler.detectAlreadyConnected();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SETTINGS & LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════════
  public updateSettings(updates: Partial<typeof this.settings>) {
    Object.assign(this.settings, updates);

    // When switching devices, clear the other device's state to prevent ghost inputs
    if (updates.inputDevice) this.clearOtherDeviceState(updates.inputDevice);
  }

  public attachListeners(
    canvas: HTMLCanvasElement,
    state: GameStateProxy,
    onPause: (paused: boolean) => void,
    onInputDeviceChange?: (device: InputDevice) => void,
  ): void {
    this.canvas = canvas;
    this.stateProxy = state;
    this.onPause = onPause;
    this.onInputDeviceChange = onInputDeviceChange ?? null;

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('contextmenu', this._onContextMenu);

    document.addEventListener('mouseup', this._onDocumentMouseUp, true);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('visibilitychange', this._onVisibilityChange);

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
    this.onInputDeviceChange = null;
  }

  private _setInputDevice(device: InputDevice) {
    if (this.settings.inputDevice === device) return;
    this.settings.inputDevice = device;
    this.clearOtherDeviceState(device);
    this.onInputDeviceChange?.(device);
  }

  private clearOtherDeviceState(device: InputDevice) {
    if (device === 'KM') {
      this.controllerHandler.clearState();
      this.touchHandler.clearState();
      return;
    }

    if (device === 'CONTROLLER') {
      this.kmHandler.clearState();
      this.touchHandler.clearState();
      return;
    }

    this.kmHandler.clearState();
    this.controllerHandler.clearState();
    this.touchHandler.clearState();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CONTROLLER CONNECTION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  private _onGamepadConnected = (e: GamepadEvent) => {
    console.log('[InputManager] Controller connected:', e.gamepad.id);
    this.controllerHandler.handleConnected();

    this._setInputDevice('CONTROLLER');
  };

  private _onGamepadDisconnected = (e: GamepadEvent) => {
    console.log('[InputManager] Controller disconnected:', e.gamepad.id);
    this.controllerHandler.handleDisconnected();

    this._setInputDevice('KM');
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // KEYBOARD & MOUSE EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  private _handleKeyDownEvent(e: KeyboardEvent) {
    if (this.settings.inputDevice === 'CONTROLLER' || this.settings.inputDevice === 'TOUCH') {
      console.log('[InputManager] Keyboard input detected, switching to KB/M mode');
      this._setInputDevice('KM');
    }

    if (this.stateProxy?.isSpectating) return;

    const isConsoleOpen = this.stateProxy?.isConsoleOpen;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote'].includes(e.code)) {
      if (!isConsoleOpen || e.code === 'Backquote') {
        e.preventDefault();
      }
    }

    if (e.repeat) return;
    this.kmHandler.handleKeyDown(e.code);
  }

  private _handleKeyUp(e: KeyboardEvent) {
    this.kmHandler.handleKeyUp(e.code);
  }

  private _handleMouseDownEvent(e: MouseEvent) {
    if (this.settings.inputDevice === 'TOUCH') return;

    if (this.settings.inputDevice === 'CONTROLLER') {
      this._setInputDevice('KM');
    }

    const s = this.stateProxy;
    if (!s?.hasStarted || s.isSpectating) return;

    if (s.isPaused && document.pointerLockElement !== e.target && !s.isConsoleOpen) {
      if (this.canvas && e.target === this.canvas) {
        this.canvas.requestPointerLock();
      }
      return;
    }

    if (!document.pointerLockElement && e.target === this.canvas && !s.isConsoleOpen) {
      (e.target as HTMLCanvasElement).requestPointerLock();
    }

    this.kmHandler.handleMouseDown(e.button);
  }

  private _handleMouseUp(e: MouseEvent) {
    this.kmHandler.handleMouseUp(e.button);
  }

  private _handleMouseMove(e: MouseEvent) {
    if (this.settings.inputDevice === 'KM') {
      this.kmHandler.handleMouseMove(e.movementX, e.movementY);

      this.lastMouseMovementForDebug.x = e.movementX;
      this.lastMouseMovementForDebug.y = e.movementY;

      if (this.debugControlsActive && (e.movementX !== 0 || e.movementY !== 0)) {
        console.log(`[DEBUG_CONTROLS] MOUSE move: deltaX=${e.movementX.toFixed(2)}, deltaY=${e.movementY.toFixed(2)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEBUG CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════════
  public setDebugControlsActive(active: boolean): void {
    this.debugControlsActive = active;
    if (active) {
      console.log('[DEBUG_CONTROLS] InputManager debug mode ENABLED');
    }
  }

  public getDebugControlsData(): {
    inputSource: 'MOUSE' | 'CONTROLLER' | 'NONE';
    rawMouseDelta: { x: number; y: number };
    rawControllerLook: { x: number; y: number };
  } {
    const ml = this.mouseLook;
    const gl = this.gamepadLook;

    let inputSource: 'MOUSE' | 'CONTROLLER' | 'NONE' = 'NONE';
    if (this.settings.inputDevice === 'KM' && (ml.x !== 0 || ml.y !== 0)) {
      inputSource = 'MOUSE';
    } else if (this.settings.inputDevice === 'CONTROLLER' && (gl.x !== 0 || gl.y !== 0)) {
      inputSource = 'CONTROLLER';
    }

    return {
      inputSource,
      rawMouseDelta: { x: this.lastMouseMovementForDebug.x, y: this.lastMouseMovementForDebug.y },
      rawControllerLook: { x: gl.x, y: gl.y },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FOCUS & VISIBILITY HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════
  private _handleBlur() {
    this.kmHandler.clearState();
    this.controllerHandler.clearState();
    this.touchHandler.clearState();

    const s = this.stateProxy;
    if (s?.hasStarted && !s.isPaused && !s.isSpectating && !s.isGameOver && !s.isConsoleOpen && !s.isDebugActive && this.settings.inputDevice !== 'TOUCH') {
      this.onPause?.(true);
    }
  }

  private _handlePointerLockChange() {
    if (this.settings.inputDevice === 'TOUCH') return;

    const isLocked = document.pointerLockElement === this.canvas;
    const s = this.stateProxy;
    if (!s) return;

    if (!isLocked) {
      this.kmHandler.clearMouseButtons();

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
      this.kmHandler.clearState();
      this.controllerHandler.clearState();
      this.touchHandler.clearState();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATE CLEARING HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════
  public clearMouseMovement() {
    this.kmHandler.clearMouseMovement();
    this.mouseLook.x = 0;
    this.mouseLook.y = 0;
  }

  public reset() {
    this.kmHandler.clearState();
    this.controllerHandler.clearState();
    this.touchHandler.clearState();
    this.actionStates.clear();
    this.previousActionStates.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TOUCH INPUT INJECTION - Called by React TouchControls component
  // ═══════════════════════════════════════════════════════════════════════════════
  public injectTouchLook(dx: number, dy: number): void {
    this.touchHandler.injectTouchLook(dx, dy);
  }

  public setTouchMoveVector(x: number, y: number): void {
    this.touchHandler.setTouchMoveVector(x, y);
  }

  public setTouchAction(action: GameAction, held: boolean): void {
    this.touchHandler.setTouchAction(action, held);
  }

  public clearTouchState(): void {
    this.touchHandler.clearState();
  }

  public shouldUsePointerLock(): boolean {
    return this.settings.inputDevice !== 'TOUCH';
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

  public isMouseButtonCurrentlyDown(button: number): boolean {
    return this.kmHandler.isMouseButtonDown(button);
  }

  public isFireInputActive(): boolean {
    if (this.settings.inputDevice === 'CONTROLLER') {
      return this.actionStates.get(GameAction.FIRE) || false;
    }
    return this.getActiveHandler().isFireActive();
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
    return this.controllerHandler.isConnected();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN UPDATE LOOP - Called every frame
  // ═══════════════════════════════════════════════════════════════════════════════
  private getActiveHandler(): InputDeviceHandler {
    if (this.settings.inputDevice === 'TOUCH') return this.touchHandler;
    if (this.settings.inputDevice === 'CONTROLLER') return this.controllerHandler;
    return this.kmHandler;
  }

  private getActiveSensitivity(): number {
    if (this.settings.inputDevice === 'TOUCH') return this.settings.touchSensitivity;
    if (this.settings.inputDevice === 'CONTROLLER') return this.settings.controllerSensitivity;
    return this.settings.mouseSensitivity;
  }

  public update() {
    this.previousActionStates = new Map(this.actionStates);

    const handler = this.getActiveHandler();
    const result = handler.update(this.getActiveSensitivity(), this.settings.controllerDeadzone);

    // Merge result into coordinator state
    for (const [action, active] of result.actionStates) {
      this.actionStates.set(action, active);
    }
    this._movementVector.x = result.movementVector.x;
    this._movementVector.y = result.movementVector.y;
    this.mouseLook.x = result.mouseLook.x;
    this.mouseLook.y = result.mouseLook.y;
    this.gamepadLook.x = result.gamepadLook.x;
    this.gamepadLook.y = result.gamepadLook.y;

    // Controller debug logging
    if (this.debugControlsActive && this.settings.inputDevice === 'CONTROLLER' &&
        (this.gamepadLook.x !== 0 || this.gamepadLook.y !== 0)) {
      console.log(`[DEBUG_CONTROLS] CONTROLLER look: processed=(${this.gamepadLook.x.toFixed(3)}, ${this.gamepadLook.y.toFixed(3)})`);
    }
  }
}
