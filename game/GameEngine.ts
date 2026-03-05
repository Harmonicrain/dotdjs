
import * as BABYLON from '@babylonjs/core';
import { ObjectPool } from '../engine/ObjectPool';
// Pointing specifically to types/index to avoid conflict with root types.ts
import { Projectile } from '../types/index';

export class GameEngine {
    public scene: BABYLON.Scene | null = null;
    public activeProjectiles: Projectile[] = [];
    public projectilePool: ObjectPool<Projectile> | null = null;

    // Scratch vector reused per spawnProjectile call to avoid allocation
    private static readonly _lookAtTarget = new BABYLON.Vector3();

    constructor() {}

    public initialize(scene: BABYLON.Scene) {
        this.scene = scene;
        this.activeProjectiles = [];
        
        // Initialize Projectile Pool
        this.projectilePool = new ObjectPool<Projectile>(
            () => {
                // Factory: Create bullet-shaped mesh (disabled by default)
                // Real bullets are short and fast - we make them visible but not beam-like
                const length = 0.15; // Short like a real bullet
                const diameter = 0.04; // Slightly wider for visibility
                
                // Create a bullet shape: cylinder body with cone tip
                const body = BABYLON.MeshBuilder.CreateCylinder("projectile_body", {
                    height: length * 0.7,
                    diameter: diameter,
                    tessellation: 8
                }, scene);
                
                const tip = BABYLON.MeshBuilder.CreateCylinder("projectile_tip", {
                    height: length * 0.3,
                    diameterTop: 0,
                    diameterBottom: diameter,
                    tessellation: 8
                }, scene);
                
                // Position tip at front of body
                tip.position.y = length * 0.5;
                
                // Merge into single mesh
                const mesh = BABYLON.Mesh.MergeMeshes([body, tip], true, true, undefined, false, true);
                if (!mesh) {
                    // Fallback to simple cylinder if merge fails
                    const fallback = BABYLON.MeshBuilder.CreateCylinder("projectile", {height: length, diameter: diameter}, scene);
                    fallback.rotation.x = Math.PI / 2;
                    fallback.position.z = length / 2;
                    fallback.bakeCurrentTransformIntoVertices();
                    fallback.setEnabled(false);
                    fallback.checkCollisions = false;
                    fallback.isPickable = false;
                    return { 
                        mesh: fallback, 
                        direction: BABYLON.Vector3.Zero(), 
                        speed: 0, 
                        damage: 0, 
                        life: 0, 
                        isRemote: false,
                        isPacked: false,
                        owner: 'HOST'
                    };
                }
                
                mesh.name = "projectile";
                
                // Rotate to align with Z axis (bullet travels forward)
                mesh.rotation.x = Math.PI / 2;
                
                // Shift position forward so origin is at the back of the bullet
                mesh.position.z = length / 2;
                
                // Bake transform: Now vertices are permanently in Z axis with origin at tail
                mesh.bakeCurrentTransformIntoVertices();
                
                mesh.setEnabled(false);
                mesh.checkCollisions = false;
                mesh.isPickable = false; // Performance optimization
                return { 
                    mesh, 
                    direction: BABYLON.Vector3.Zero(), 
                    speed: 0, 
                    damage: 0, 
                    life: 0, 
                    isRemote: false,
                    isPacked: false,
                    owner: 'HOST'
                };
            },
            (p) => {
                // Reset logic
                p.mesh.setEnabled(true);
                p.mesh.scaling.setAll(1.0); // Reset scaling from explosive projectiles
                p.life = 60;
                // Clear explosive fields to prevent stale state on recycled projectiles
                p.isExplosive = undefined;
                p.splashRadius = undefined;
                p.splashDamage = undefined;
                p.selfDamageMultiplier = undefined;
                p.trailParticleSystem = null;
                p.isPacked = false;
                p.isRemote = false;
                p.owner = 'HOST';
                // Position/Dir set by caller
            },
            (p) => {
                // Dispose
                p.mesh.dispose();
            },
            50 // Initial size
        );
    }

    public spawnProjectile(
        position: BABYLON.Vector3, 
        direction: BABYLON.Vector3, 
        speed: number, 
        damage: number, 
        isRemote: boolean, 
        isPacked: boolean,
        owner: 'HOST' | 'CLIENT' = 'HOST',
        isExplosive?: boolean,
        splashRadius?: number,
        splashDamage?: number,
        selfDamageMultiplier?: number
    ) {
        if (!this.projectilePool || !this.scene) return;

        // Limit remote projectiles to prevent flood
        if (isRemote && this.activeProjectiles.filter(p => p.isRemote).length > 50) {
            return;
        }

        const p = this.projectilePool.acquire();
        p.mesh.position.copyFrom(position);
        // Reuse direction vector for lookAt target to avoid allocating a new Vector3
        GameEngine._lookAtTarget.copyFrom(position).addInPlace(direction);
        p.mesh.lookAt(GameEngine._lookAtTarget);
        
        // Material handling - use different material for explosive projectiles
        const matName = isExplosive 
            ? (isPacked ? "projectileMatExplosivePacked" : "projectileMatExplosive") 
            : (isPacked ? "projectileMatPacked" : "projectileMat");
        const mat = this.scene.getMaterialByName(matName);
        if (mat) p.mesh.material = mat;

        // For explosive projectiles, scale up the mesh to make it more visible
        if (isExplosive) {
            p.mesh.scaling.setAll(3.0);
        }

        p.direction.copyFrom(direction);
        p.speed = speed;
        p.damage = damage;
        p.isRemote = isRemote;
        p.isPacked = isPacked;
        p.owner = owner;
        p.isExplosive = isExplosive;
        p.splashRadius = splashRadius;
        p.splashDamage = splashDamage;
        p.selfDamageMultiplier = selfDamageMultiplier;
        // life is reset in pool.acquire() -> reset()

        this.activeProjectiles.push(p);
    }

    public releaseProjectile(p: Projectile) {
        if (!this.projectilePool) return;
        p.mesh.setEnabled(false); // Hide immediately
        if (p.trailParticleSystem) {
            const ps = p.trailParticleSystem;
            // Detach emitter from the pooled mesh before it gets reused,
            // snapshot position so remaining particles fade in place.
            // We NO LONGER call dispose here as the system is now pooled.
            if (ps.emitter instanceof BABYLON.AbstractMesh) {
                ps.emitter = ps.emitter.position.clone();
            }
            ps.stop();
            p.trailParticleSystem = null;
        }
        // Swap-remove for O(1) instead of indexOf+splice O(n)

        const arr = this.activeProjectiles;
        const index = arr.indexOf(p);
        if (index !== -1) {
            arr[index] = arr[arr.length - 1];
            arr.pop();
        }
        this.projectilePool.release(p);
    }

    public dispose() {
        if (this.projectilePool) {
            this.projectilePool.dispose();
            this.projectilePool = null;
        }
        this.activeProjectiles = [];
        this.scene = null;
    }
}