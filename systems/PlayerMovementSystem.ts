import * as BABYLON from '@babylonjs/core';
import { GAME_CONFIG, CONTROLLER_CONFIG } from '../config';
import { GameAction, InputManager } from '../engine/InputManager';
import { GameStateData } from '../types/index';
import { System } from '../types/systems';

export interface IMovementContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    inputManager: InputManager | null;
    onDebugControlsUpdate?: (cameraRotation: { x: number; y: number }) => void;
}

/**
 * PlayerMovementSystem
 *
 * Handles local player movement, jumping, mouse/gamepad look, and physics.
 * Uses smoothed camera rotation to prevent input jitter.
 */
export const createPlayerMovementSystem = (ctx: IMovementContext): System => {
    let lastPosition = new BABYLON.Vector3(0, 0, 0);
    let firstFrame = true;

    // ── Pre-allocated scratch vectors — zero allocations in the hot update path ──
    // Axis constants passed to getDirectionToRef (never mutated)
    const _axisForward = new BABYLON.Vector3(0, 0, 1);
    const _axisRight   = new BABYLON.Vector3(1, 0, 0);
    // Output vectors for camera direction queries
    const _camForward  = new BABYLON.Vector3();
    const _camRight    = new BABYLON.Vector3();
    // Accumulated move direction (zeroed at the top of each frame)
    const _moveDir     = new BABYLON.Vector3();
    // Velocity scratch (replaces currentPos.subtract(lastPosition))
    const _velocity    = new BABYLON.Vector3();

    // Pre-allocated ray for ground checks
    const _groundRay = new BABYLON.Ray(new BABYLON.Vector3(), new BABYLON.Vector3(0, -1, 0), 1);

    // Camera smoothing state - accumulated rotation targets
    let targetRotationX = 0;
    let targetRotationY = 0;
    let smoothingInitialized = false;

    // Smoothing factor: 1.0 = instant (no smoothing), lower = more smoothing
    // 0.5-0.7 is good for reducing jitter while staying responsive
    const CAMERA_SMOOTHING = 0.65;

    return {
        name: 'playerMove',
        init: () => {
            firstFrame = true;
            smoothingInitialized = false;
        },
        update: (dt: number) => {
            if (!ctx.gameState.hasStarted || ctx.gameState.isPaused || ctx.gameState.isSpectating || ctx.gameState.isGameOver || ctx.gameState.isConsoleOpen) return;

            const camera = ctx.camera;
            const inputManager = ctx.inputManager;
            if (!camera || !inputManager) return;

            // Initialize smoothing targets to current camera rotation on first frame
            if (!smoothingInitialized) {
                targetRotationX = camera.rotation.x;
                targetRotationY = camera.rotation.y;
                smoothingInitialized = true;
            }

            // --- LOOK HANDLING (Always allowed unless paused/spectating) ---
            const mouseLook = inputManager.getMouseLook();
            const gamepadLook = inputManager.getGamepadLook();
            
            // Accumulate mouse input into target rotation
            if (mouseLook.x !== 0) targetRotationY += mouseLook.x * CONTROLLER_CONFIG.BASE_MOUSE_SENSITIVITY;
            if (mouseLook.y !== 0) targetRotationX += mouseLook.y * CONTROLLER_CONFIG.BASE_MOUSE_SENSITIVITY;

            // Gamepad look (already frame-rate independent via dt)
            if (gamepadLook.x !== 0) targetRotationY += gamepadLook.x * CONTROLLER_CONFIG.SENSITIVITY_X * dt;
            if (gamepadLook.y !== 0) targetRotationX += gamepadLook.y * CONTROLLER_CONFIG.SENSITIVITY_Y * dt;

            // Clamp target pitch to prevent camera flip
            const PITCH_LIMIT = 1.5;
            if (targetRotationX > PITCH_LIMIT) targetRotationX = PITCH_LIMIT;
            if (targetRotationX < -PITCH_LIMIT) targetRotationX = -PITCH_LIMIT;

            // Smoothly interpolate camera rotation towards target
            camera.rotation.x += (targetRotationX - camera.rotation.x) * CAMERA_SMOOTHING;
            camera.rotation.y += (targetRotationY - camera.rotation.y) * CAMERA_SMOOTHING;

            // Notify debug controls of camera state
            if (ctx.onDebugControlsUpdate) {
                ctx.onDebugControlsUpdate({ x: camera.rotation.x, y: camera.rotation.y });
            }

            // --- INIT LAST POS ---
            if (firstFrame) {
                lastPosition.copyFrom(camera.position);
                firstFrame = false;
            }

            // --- CALCULATE VELOCITY ---
            // subtractToRef writes into _velocity — no allocation
            camera.position.subtractToRef(lastPosition, _velocity);
            if (ctx.gameState.currentVelocity) {
                ctx.gameState.currentVelocity.copyFrom(_velocity);
            } else {
                ctx.gameState.currentVelocity = _velocity.clone();
            }
            lastPosition.copyFrom(camera.position);

            // STOP MOVEMENT IF DOWNED
            if (ctx.gameState.isDowned) {
                return;
            }

            // --- SPEED CALC ---
            let speed = GAME_CONFIG.WALK_SPEED;
            if (inputManager.isDown(GameAction.SPRINT)) {
                speed = GAME_CONFIG.SPRINT_SPEED;
            }

            // --- DIRECTION CALC ---
            // getDirectionToRef writes into pre-allocated vectors — no allocation
            camera.getDirectionToRef(_axisForward, _camForward);
            _camForward.y = 0; _camForward.normalize();
            camera.getDirectionToRef(_axisRight, _camRight);
            _camRight.y = 0; _camRight.normalize();

            // Zero the move accumulator, then add components in-place — no allocation
            _moveDir.set(0, 0, 0);
            if (inputManager.isDown(GameAction.MOVE_FORWARD)) _moveDir.addInPlace(_camForward);
            if (inputManager.isDown(GameAction.MOVE_BACK))    _moveDir.subtractInPlace(_camForward);
            if (inputManager.isDown(GameAction.MOVE_LEFT))    _moveDir.subtractInPlace(_camRight);
            if (inputManager.isDown(GameAction.MOVE_RIGHT))   _moveDir.addInPlace(_camRight);

            if (_moveDir.lengthSquared() > 0.001) {
                _moveDir.normalize();
                camera.speed = speed;
                camera.cameraDirection.addInPlaceFromFloats(
                    _moveDir.x * speed * dt,
                    _moveDir.y * speed * dt,
                    _moveDir.z * speed * dt
                );
            }

            // --- NOCLIP HANDLING ---
            if (ctx.gameState.isNoclip) {
                if (inputManager.isDown(GameAction.JUMP)) {
                    camera.cameraDirection.y += speed * dt;
                }
                if (inputManager.isDown(GameAction.CROUCH)) {
                    camera.cameraDirection.y -= speed * dt;
                }
                ctx.gameState.verticalVelocity = 0;
                ctx.gameState.isGrounded = true;
                // Note: camera.update() is called by scene.render() — no need to call it here.
                return;
            }

            // --- PHYSICS & JUMP ---
            ctx.gameState.verticalVelocity += GAME_CONFIG.GRAVITY;
            if (ctx.gameState.verticalVelocity < -0.8) ctx.gameState.verticalVelocity = -0.8;

            const rayLength = GAME_CONFIG.PLAYER_HEIGHT + 0.2;
            // Reuse pre-allocated ray to avoid per-frame allocation
            _groundRay.origin.copyFrom(camera.position);
            _groundRay.length = rayLength;
            const pick = camera.getScene().pickWithRay(_groundRay, (m) => m.checkCollisions && m.isEnabled());
            
            if (pick && pick.hit && ctx.gameState.verticalVelocity <= 0 && pick.distance <= rayLength) {
                ctx.gameState.verticalVelocity = 0;
                ctx.gameState.isGrounded = true;
                
                const targetY = pick.pickedPoint!.y + GAME_CONFIG.PLAYER_HEIGHT;
                const diff = targetY - camera.position.y;
                if (Math.abs(diff) > 0.001) {
                    camera.position.y += diff * 0.2;
                }
            } else {
                ctx.gameState.isGrounded = false;
            }

            if (ctx.gameState.isGrounded && inputManager.justPressed(GameAction.JUMP)) {
                ctx.gameState.verticalVelocity = GAME_CONFIG.JUMP_FORCE;
                ctx.gameState.isGrounded = false;
                camera.position.y += 0.1;
            }

            camera.cameraDirection.y += ctx.gameState.verticalVelocity;

            // --- EXTERNAL FORCE (knockback, etc.) ---
            // Apply external force to camera movement and decay it
            const externalForce = ctx.gameState.externalForce;
            if (externalForce.lengthSquared() > 0.0001) {
                camera.cameraDirection.addInPlace(externalForce);
                // Decay external force (0.85 = quick but smooth decay)
                externalForce.scaleInPlace(0.85);
                // Zero out when negligible to prevent drift
                if (externalForce.lengthSquared() < 0.0001) {
                    externalForce.set(0, 0, 0);
                }
            }
            
            if (camera.position.y < -20) {
                 camera.position.y = 10;
                 ctx.gameState.verticalVelocity = 0;
            }

            // Note: camera.update() is called by scene.render() — calling it here
            // would double-process cameraDirection (applying inertia twice) and
            // double-trigger collision checks, causing position jitter / camera snapping.
        }
    };
};
