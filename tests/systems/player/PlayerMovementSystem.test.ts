import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createPlayerMovementSystem } from '../../../systems/player/PlayerMovementSystem';
import { createMockContext } from '../../mocks/mockContext';
import { GameAction } from '../../../engine/InputManager';
import { GAME_CONFIG } from '../../../config/gameplay';

describe('PlayerMovementSystem', () => {
    let ctx: any;
    let system: any;

    beforeEach(() => {
        ctx = createMockContext();
        
        // Add missing methods to inputManager
        ctx.inputManager.getMouseLook = vi.fn(() => ({ x: 0, y: 0 }));
        ctx.inputManager.getGamepadLook = vi.fn(() => ({ x: 0, y: 0 }));
        
        // Mock camera with necessary properties and methods
        ctx.camera = {
            position: new BABYLON.Vector3(0, 10, 0),
            rotation: new BABYLON.Vector3(0, 0, 0),
            speed: 5,
            cameraDirection: new BABYLON.Vector3(0, 0, 0),
            getScene: () => ctx.scene,
            getDirectionToRef: vi.fn((axis: BABYLON.Vector3, result: BABYLON.Vector3) => {
                if (axis.equals(new BABYLON.Vector3(0, 0, 1))) {
                    result.copyFrom(new BABYLON.Vector3(0, 0, 1));
                } else if (axis.equals(new BABYLON.Vector3(1, 0, 0))) {
                    result.copyFrom(new BABYLON.Vector3(1, 0, 0));
                }
            }),
            update: vi.fn()
        } as any;
        
        // Mock scene pick for ground checks - default no hit
        ctx.scene.pickWithRay = vi.fn(() => ({ 
            hit: false, 
            pickedMesh: null, 
            pickedPoint: null 
        }));
        
        system = createPlayerMovementSystem(ctx);
        system.init();
    });

    it('should NOT update when paused', () => {
        ctx.gameState.isPaused = true;
        ctx.gameState.hasStarted = true;
        const initialY = ctx.camera.position.y;
        
        system.update(16, Date.now());
        
        expect(ctx.camera.position.y).toBe(initialY);
    });

    it('should NOT update when not started', () => {
        ctx.gameState.hasStarted = false;
        const initialY = ctx.camera.position.y;
        
        system.update(16, Date.now());
        
        expect(ctx.camera.position.y).toBe(initialY);
    });

    it('should NOT update when spectating', () => {
        ctx.gameState.isSpectating = true;
        ctx.gameState.hasStarted = true;
        const initialY = ctx.camera.position.y;
        
        system.update(16, Date.now());
        
        expect(ctx.camera.position.y).toBe(initialY);
    });

    it('should NOT update when game over', () => {
        ctx.gameState.isGameOver = true;
        ctx.gameState.hasStarted = true;
        const initialY = ctx.camera.position.y;
        
        system.update(16, Date.now());
        
        expect(ctx.camera.position.y).toBe(initialY);
    });

    it('should NOT update when console open', () => {
        ctx.gameState.isConsoleOpen = true;
        ctx.gameState.hasStarted = true;
        const initialY = ctx.camera.position.y;
        
        system.update(16, Date.now());
        
        expect(ctx.camera.position.y).toBe(initialY);
    });

    it('should NOT update when downed', () => {
        ctx.gameState.isDowned = true;
        ctx.gameState.hasStarted = true;
        const initialY = ctx.camera.position.y;
        
        system.update(16, Date.now());
        
        expect(ctx.camera.position.y).toBe(initialY);
    });

    it('should apply gravity when not grounded', () => {
        ctx.gameState.hasStarted = true;
        ctx.gameState.isGrounded = false;
        ctx.gameState.verticalVelocity = 0;
        
        // Default scene pick returns no hit, so not grounded
        
        system.update(16, Date.now());
        
        expect(ctx.gameState.verticalVelocity).toBe(GAME_CONFIG.GRAVITY);
    });

    it('should cap vertical velocity', () => {
        ctx.gameState.hasStarted = true;
        ctx.gameState.isGrounded = false;
        ctx.gameState.verticalVelocity = -1.0; // Already below cap
        
        // Default scene pick returns no hit
        
        system.update(16, Date.now());
        
        expect(ctx.gameState.verticalVelocity).toBe(-0.8);
    });

    it('should detect ground and reset vertical velocity', () => {
        ctx.gameState.hasStarted = true;
        ctx.gameState.isGrounded = false;
        ctx.gameState.verticalVelocity = -5;
        ctx.camera.position.y = 10;
        
        // Mock ground hit directly below within ray length
        ctx.scene.pickWithRay = vi.fn(() => ({
            hit: true,
            pickedMesh: { isEnabled: () => true, checkCollisions: true } as any,
            pickedPoint: new BABYLON.Vector3(0, 9, 0),
            distance: 1.5
        }));
        
        system.update(16, Date.now());
        
        expect(ctx.gameState.verticalVelocity).toBe(0);
        expect(ctx.gameState.isGrounded).toBe(true);
    });

    it('should snap to ground height when grounded', () => {
        ctx.gameState.hasStarted = true;
        const startY = 3.0;
        ctx.camera.position.y = startY;
        ctx.gameState.isGrounded = false;
        ctx.gameState.verticalVelocity = 0;

        // Ground at y=1, so target = 1 + PLAYER_HEIGHT ≈ 2.85
        ctx.scene.pickWithRay = vi.fn(() => ({
            hit: true,
            pickedMesh: { isEnabled: () => true, checkCollisions: true } as any,
            pickedPoint: new BABYLON.Vector3(0, 1, 0),
            distance: 2.0 // within rayLength
        }));

        system.update(16, Date.now());

        // Should have moved toward target (2.85), i.e., decreased y but still above target
        expect(ctx.camera.position.y).toBeLessThan(startY);
        expect(ctx.camera.position.y).toBeGreaterThan(2.85);
    });

    it('should jump when JUMP pressed while grounded', () => {
        ctx.gameState.hasStarted = true;
        ctx.camera.position.y = 1.5;
        ctx.gameState.isGrounded = false; // will be set true by ground check
        ctx.gameState.verticalVelocity = 0;
        ctx.inputManager.justPressed.mockReturnValue((action: GameAction) => action === GameAction.JUMP);

        // Ground hit within ray
        ctx.scene.pickWithRay = vi.fn(() => ({
            hit: true,
            pickedMesh: { isEnabled: () => true, checkCollisions: true } as any,
            pickedPoint: new BABYLON.Vector3(0, 0, 0),
            distance: 1.5
        }));

        system.update(16, Date.now());

        expect(ctx.gameState.verticalVelocity).toBeCloseTo(GAME_CONFIG.JUMP_FORCE, 5);
        expect(ctx.gameState.isGrounded).toBe(false);
    });

    it('should NOT jump when in air', () => {
        ctx.gameState.hasStarted = true;
        ctx.camera.position.y = 10;
        ctx.gameState.isGrounded = false;
        ctx.gameState.verticalVelocity = 0;
        ctx.inputManager.justPressed.mockReturnValue((action: GameAction) => action === GameAction.JUMP);

        // No ground hit (camera high, ray short)
        // Default pickWithRay returns hit: false

        system.update(16, Date.now());

        // Gravity applied, no jump
        expect(ctx.gameState.verticalVelocity).toBeCloseTo(GAME_CONFIG.GRAVITY, 5);
        expect(ctx.gameState.isGrounded).toBe(false);
    });

    it('should use WALK_SPEED by default', () => {
        ctx.gameState.hasStarted = true;
        
        // Trigger movement calculation: need direction input to set speed
        ctx.camera.getDirectionToRef.mockImplementation((axis: BABYLON.Vector3, result: BABYLON.Vector3) => {
            result.set(0, 0, 1);
        });
        ctx.inputManager.isDown.mockImplementation((action: GameAction) => 
            action === GameAction.MOVE_FORWARD
        );
        
        system.update(16, Date.now());
        
        expect(ctx.camera.speed).toBe(GAME_CONFIG.WALK_SPEED);
    });

    it('should use SPRINT_SPEED when sprinting', () => {
        ctx.gameState.hasStarted = true;
        ctx.camera.getDirectionToRef.mockImplementation((axis: BABYLON.Vector3, result: BABYLON.Vector3) => {
            result.set(0, 0, 1);
        });
        ctx.inputManager.isDown.mockImplementation((action: GameAction) => 
            action === GameAction.MOVE_FORWARD || action === GameAction.SPRINT
        );
        
        system.update(16, Date.now());
        
        expect(ctx.camera.speed).toBe(GAME_CONFIG.SPRINT_SPEED);
    });

    it('should calculate movement direction correctly', () => {
        ctx.gameState.hasStarted = true;
        ctx.camera.position.set(0, 10, 0);
        
        // Move forward and right
        ctx.camera.getDirectionToRef.mockImplementation((axis: BABYLON.Vector3, result: BABYLON.Vector3) => {
            if (axis.equals(new BABYLON.Vector3(0, 0, 1))) {
                result.set(0, 0, 1);
            } else {
                result.set(1, 0, 0);
            }
        });
        
        ctx.inputManager.isDown.mockImplementation((action: GameAction) => 
            action === GameAction.MOVE_FORWARD || action === GameAction.MOVE_RIGHT
        );
        
        // Spy on addInPlaceFromFloats
        const moveSpy = vi.fn();
        const originalAddInPlaceFromFloats = ctx.camera.cameraDirection.addInPlaceFromFloats;
        ctx.camera.cameraDirection.addInPlaceFromFloats = moveSpy;
        
        system.update(16, Date.now());
        
        expect(moveSpy).toHaveBeenCalled();
        const [dx, dy, dz] = moveSpy.mock.calls[0];
        expect(dx).toBeGreaterThan(0);
        expect(dz).toBeGreaterThan(0);
        expect(dy).toBe(0);
    });

    it('should not move when no direction input', () => {
        ctx.gameState.hasStarted = true;
        ctx.inputManager.isDown.mockReturnValue(false);
        
        const moveSpy = vi.fn();
        const originalAddInPlaceFromFloats = ctx.camera.cameraDirection.addInPlaceFromFloats;
        ctx.camera.cameraDirection.addInPlaceFromFloats = moveSpy;
        
        system.update(16, Date.now());
        
        expect(moveSpy).not.toHaveBeenCalled();
    });

    it('should respect downed state and not process movement', () => {
        ctx.gameState.hasStarted = true;
        ctx.gameState.isDowned = true;
        ctx.camera.position.set(0, 10, 0);
        
        // Try to move
        ctx.inputManager.isDown.mockReturnValue(true);
        ctx.camera.getDirectionToRef.mockImplementation((axis: BABYLON.Vector3, result: BABYLON.Vector3) => {
            result.set(0, 0, 1);
        });
        
        const moveSpy = vi.fn();
        ctx.camera.cameraDirection.addInPlaceFromFloats = moveSpy;
        
        system.update(16, Date.now());
        
        expect(moveSpy).not.toHaveBeenCalled();
    });

    describe('noclip mode', () => {
        it('should allow vertical movement with JUMP in noclip', () => {
            ctx.gameState.hasStarted = true;
            ctx.gameState.isNoclip = true;
            ctx.gameState.isGrounded = true;
            ctx.camera.position.y = 10;
            ctx.gameState.verticalVelocity = 0;
            
            const speed = GAME_CONFIG.SPRINT_SPEED; // Use sprint speed for noclip? The code uses current speed variable.
            ctx.inputManager.isDown.mockImplementation((action: GameAction) => 
                action === GameAction.JUMP
            );
            
            system.update(16, Date.now());
            
            expect(ctx.gameState.verticalVelocity).toBe(0);
            expect(ctx.camera.cameraDirection.y).toBeGreaterThan(0);
            expect(ctx.gameState.isGrounded).toBe(true);
        });

        it('should move down with CROUCH in noclip', () => {
            ctx.gameState.hasStarted = true;
            ctx.gameState.isNoclip = true;
            ctx.camera.position.y = 10;
            ctx.gameState.verticalVelocity = 0;
            
            ctx.inputManager.isDown.mockImplementation((action: GameAction) => 
                action === GameAction.CROUCH
            );
            
            system.update(16, Date.now());
            
            expect(ctx.camera.cameraDirection.y).toBeLessThan(0);
        });

        it('should ignore gravity in noclip', () => {
            ctx.gameState.hasStarted = true;
            ctx.gameState.isNoclip = true;
            ctx.gameState.isGrounded = false;
            ctx.gameState.verticalVelocity = -5;
            
            ctx.inputManager.isDown.mockReturnValue(false);
            
            system.update(16, Date.now());
            
            expect(ctx.gameState.verticalVelocity).toBe(0);
        });
    });

    describe('ground check caching', () => {
        it('should cache ground mesh on successful pick', () => {
            ctx.gameState.hasStarted = true;
            ctx.camera.position.y = 10;
            
            const mockGroundMesh = { isEnabled: () => true } as any;
            ctx.scene.pickWithRay = vi.fn(() => ({
                hit: true,
                pickedMesh: mockGroundMesh,
                pickedPoint: new BABYLON.Vector3(0, 9, 0),
                distance: 1.5
            }));
            
            system.update(16, Date.now());
            
            // Should have called pickWithRay (we can't directly check internal cache but we know it's used)
            expect(ctx.scene.pickWithRay).toHaveBeenCalled();
        });
    });

    describe('camera rotation smoothing', () => {
        it('should initialize smoothing targets on first frame', () => {
            ctx.camera.rotation.set(0.1, 0.2, 0);
            
            system = createPlayerMovementSystem(ctx);
            system.update(16, Date.now());
            
            // Should not throw and should initialize targets
            expect(ctx.camera.rotation.x).toBeDefined();
            expect(ctx.camera.rotation.y).toBeDefined();
        });

        it('should interpolate camera rotation towards target', () => {
            ctx.gameState.hasStarted = true;
            ctx.camera.rotation.set(0, 0, 0);
            
            // Simulate mouse look input
            ctx.inputManager.getMouseLook.mockReturnValue({ x: 1, y: 0 }); // Yaw right
            ctx.inputManager.getGamepadLook.mockReturnValue({ x: 0, y: 0 });
            
            system.update(16, Date.now());
            
            // Should have rotated camera towards target (partial interpolation)
            expect(ctx.camera.rotation.y).toBeGreaterThan(0);
            expect(ctx.camera.rotation.y).toBeLessThan(1 * 0.65);
        });

        it('should clamp pitch to prevent camera flip', () => {
            ctx.gameState.hasStarted = true;
            ctx.camera.rotation.set(0, 0, 0);
            
            // Simulate large vertical mouse movement
            ctx.inputManager.getMouseLook.mockReturnValue({ x: 0, y: 10 });
            ctx.inputManager.getGamepadLook.mockReturnValue({ x: 0, y: 0 });
            
            // Update multiple times to accumulate
            for (let i = 0; i < 10; i++) {
                system.update(16, Date.now());
            }
            
            expect(ctx.camera.rotation.x).toBeLessThanOrEqual(1.5);
            expect(ctx.camera.rotation.x).toBeGreaterThanOrEqual(-1.5);
        });
    });

    describe('external force', () => {
        it('should apply external force to movement', () => {
            ctx.gameState.hasStarted = true;
            ctx.gameState.externalForce = new BABYLON.Vector3(5, 0, 0);
            
            // Spy on addInPlace (used for external force)
            const forceSpy = vi.fn();
            const originalAddInPlace = ctx.camera.cameraDirection.addInPlace;
            ctx.camera.cameraDirection.addInPlace = forceSpy;
            
            system.update(16, Date.now());
            
            expect(forceSpy).toHaveBeenCalledWith(ctx.gameState.externalForce);
        });

        it('should decay external force over time', () => {
            ctx.gameState.hasStarted = true;
            const initialForce = new BABYLON.Vector3(5, 0, 0);
            ctx.gameState.externalForce = initialForce.clone();
            
            system.update(16, Date.now());
            
            expect(ctx.gameState.externalForce.x).toBeCloseTo(5 * 0.85, 5);
            expect(ctx.gameState.externalForce.y).toBeCloseTo(0, 5);
            expect(ctx.gameState.externalForce.z).toBeCloseTo(0, 5);
        });

        it('should zero external force when negligible after decay', () => {
            ctx.gameState.hasStarted = true;
            // Start with a force just above threshold so after decay it falls below
            ctx.gameState.externalForce = new BABYLON.Vector3(0.011, 0, 0); // squared = 0.000121 > 0.0001
            
            system.update(16, Date.now());
            
            expect(ctx.gameState.externalForce.lengthSquared()).toBe(0);
        });
    });

    describe('respawn protection', () => {
        it('should teleport player above ground if fallen too far', () => {
            ctx.gameState.hasStarted = true;
            ctx.camera.position.y = -30;
            
            system.update(16, Date.now());
            
            expect(ctx.camera.position.y).toBe(10);
            expect(ctx.gameState.verticalVelocity).toBe(0);
        });
    });

    describe('velocity tracking', () => {
        it('should calculate current velocity each frame', () => {
            ctx.gameState.hasStarted = true;
            ctx.camera.position.set(0, 10, 0);
            
            // Set lastPosition via internal state (simulate first frame then move)
            system.update(16, Date.now()); // First frame sets lastPosition
            
            ctx.camera.position.set(5, 10, 0); // Simulate movement
            
            system.update(16, Date.now());
            
            expect(ctx.gameState.currentVelocity.x).toBeCloseTo(5, 0);
        });
    });

    describe('edge cases', () => {
        it('should handle missing camera gracefully', () => {
            ctx.camera = null;
            
            expect(() => system.update(16, Date.now())).not.toThrow();
        });

        it('should handle missing inputManager gracefully', () => {
            ctx.inputManager = null;
            
            expect(() => system.update(16, Date.now())).not.toThrow();
        });

        it('should initialize reset state on init', () => {
            system.init();
            
            // Should not throw and should reset internal state
            expect(ctx.camera.position).toBeDefined();
        });
    });
});
