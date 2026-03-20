import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../state/StateManager';
import { WEAPON_CONFIGS } from '../config';
import { PowerUpType } from '../types/ui';

export type CommandHandler = (args: string[], sm: StateManager) => string | null;

const COMMANDS: Record<string, CommandHandler> = {
    'debug': (args, sm) => {
        sm.debugSelection.isActive = !sm.debugSelection.isActive;
        
        if (sm.debugSelection.isActive) {
            return `Debug mode: ON. Logic frozen. Shoot an object to inspect.`;
        } else {
            sm.debugSelection.selectedMesh = null;
            sm.ui.setDebugInfo(null);
            return `Debug mode: OFF. Logic resumed.`;
        }
    },
    'pos': (args, sm) => {
        const p = sm.camera.position;
        const r = sm.camera.rotation;
        return `Pos: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)} | Rot: ${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}`;
    },
    'tp': (args, sm) => {
        if (args.length < 3) return "Usage: /tp <x> <y> <z>";
        const x = parseFloat(args[0]);
        const y = parseFloat(args[1]);
        const z = parseFloat(args[2]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) return "Invalid coordinates.";
        sm.camera.position.set(x, y, z);
        return `Teleported to ${x}, ${y}, ${z}`;
    },
    'points': (args, sm) => {
        if (args.length < 1) return "Usage: /points <amt>";
        const amt = parseInt(args[0]);
        if (isNaN(amt)) return "Invalid amount.";
        sm.addPoints(amt);
        return `Added ${amt} points.`;
    },
    'give': (args, sm) => {
        if (args.length < 1) return "Usage: /give <weapon_id>";
        const id = args[0].toLowerCase();
        const config = WEAPON_CONFIGS.find(w => w.id === id);
        if (!config) return `Unknown weapon: ${id}`;
        
        // Look up the FPS mesh for this weapon
        const weaponMesh = sm.gameState.weaponMeshes[id] || null;

        // Add to player inventory if not already there, or replace current
        const existingIdx = sm.gameState.weapons.findIndex(w => w.id === id);
        if (existingIdx !== -1) {
            sm.gameState.activeWeaponIndex = existingIdx;
        } else {
            const newState = {
                ...config,
                currentAmmo: config.clipSize,
                currentReserve: config.maxReserve,
                isPacked: false,
                mesh: weaponMesh
            };
            
            // Disable the old weapon mesh before replacing
            const oldWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
            if (oldWeapon?.mesh) oldWeapon.mesh.setEnabled(false);

            const hasMuleKick = !!sm.gameState.perkStates['muleKick'];
            const weaponLimit = hasMuleKick ? 3 : 2;
            if (sm.gameState.weapons.length >= weaponLimit) {
                // Replace current weapon
                sm.gameState.weapons[sm.gameState.activeWeaponIndex] = newState;
            } else {
                sm.gameState.weapons.push(newState);
                sm.gameState.activeWeaponIndex = sm.gameState.weapons.length - 1;
            }
        }

        // Enable the new weapon's mesh
        const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        if (activeWeapon?.mesh) activeWeapon.mesh.setEnabled(true);
        
        sm.setActiveWeaponIndex(sm.gameState.activeWeaponIndex);
        sm.setWeaponName(config.name);
        sm.setWeaponId(config.id);
        sm.setAmmo(config.clipSize);
        sm.setReserveAmmo(config.maxReserve);
        
        return `Gave ${config.name}`;
    },
    'ammo': (args, sm) => {
        sm.gameState.weapons.forEach(w => {
            w.currentAmmo = w.clipSize;
            w.currentReserve = w.maxReserve;
        });
        const current = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        sm.setAmmo(current.currentAmmo);
        sm.setReserveAmmo(current.currentReserve);
        return "Ammo refilled.";
    },
    'round': (args, sm) => {
        if (args.length < 1) return "Usage: /round <n>";
        const n = parseInt(args[0]);
        if (isNaN(n) || n < 1) return "Invalid round.";
        
        // Force RoundSystem to transition
        sm.gameState.round = n - 1;
        sm.gameState.zombiesToSpawn = 0;
        sm.gameState.zombiesAlive = 0;
        sm.gameState.isIntermission = true;
        sm.gameState.nextRoundTime = 0; // Immediate transition
        
        return `Setting round to ${n}...`;
    },
    'kill_all': (args, sm) => {
        let count = 0;
        sm.zombies.forEach(z => {
            if (!z.isDead) {
                z.health = 0;
                count++;
            }
        });
        return `Killed ${count} zombies.`;
    },
    'show_zones': (args, sm) => {
        let count = 0;
        sm.scene.meshes.forEach(m => {
            if (m.name.includes('zone') || m.metadata?.type === 'ZONE') {
                m.isVisible = !m.isVisible;
                if (m.isVisible) m.visibility = 0.3;
                count++;
            }
        });
        return `Toggled visibility for ${count} zone meshes.`;
    },
    'show_navmesh': (args, sm) => {
        if (!sm.navPlugin) return "NavMesh plugin not initialized.";
        const debug = sm.scene.getMeshByName("NavMeshDebug");
        if (debug) {
            debug.isVisible = !debug.isVisible;
            return `NavMesh debug visibility: ${debug.isVisible}`;
        } else {
            const navmesh = sm.navPlugin.createDebugNavMesh(sm.scene);
            navmesh.name = "NavMeshDebug";
            
            // Make it bright blue and visible
            const mat = new BABYLON.StandardMaterial("NavMeshDebugMat", sm.scene);
            mat.diffuseColor = new BABYLON.Color3(0, 0.5, 1); // Bright blue
            mat.emissiveColor = new BABYLON.Color3(0, 0.3, 0.8); // Glowing blue
            mat.alpha = 0.4; // Semi-transparent
            mat.wireframe = false; // Solid fill
            mat.backFaceCulling = false;
            mat.zOffset = -1; // Ensure it renders slightly above the floor geometry
            navmesh.material = mat;
            navmesh.position.y += 0.05; // Slightly lift to avoid z-fighting with the ground
            
            // Test navmesh points
            const testPoints = [
                { name: "Zone1 center", pos: new BABYLON.Vector3(0, 0, -10) },
                { name: "Zone1 player", pos: new BABYLON.Vector3(0, 1.85, -10) },
                { name: "Door area", pos: new BABYLON.Vector3(0, 0, 1) },
                { name: "Door area + height", pos: new BABYLON.Vector3(0, 1.85, 1) },
                { name: "Zone2 center", pos: new BABYLON.Vector3(0, 0, 10) },
                { name: "Zone2 center + height", pos: new BABYLON.Vector3(0, 1.85, 10) },
                { name: "Zone3", pos: new BABYLON.Vector3(20, 0, 0) },
                { name: "Target from log", pos: new BABYLON.Vector3(8.26, 1.85, 1.87) },
            ];
            console.log("[NavMesh] Testing getClosestPoint (with Y=1.85):");
            for (const tp of testPoints) {
                const closest = sm.navPlugin.getClosestPoint(tp.pos);
                console.log(`  ${tp.name}: input=${tp.pos.toString()} -> closest=${closest.toString()}`);
            }
            
            return "NavMesh debug created.";
        }
    },
    'show_pathfinding': (args, sm) => {
        sm.showPathfinding.isActive = !sm.showPathfinding.isActive;

        if (!sm.showPathfinding.isActive) {
            // Remove the render observer before clearing state
            if (sm.showPathfinding.observer) {
                sm.scene.onBeforeRenderObservable.remove(sm.showPathfinding.observer);
                sm.showPathfinding.observer = null;
            }
            for (const mesh of sm.showPathfinding.pathMeshes) {
                mesh.dispose();
            }
            sm.showPathfinding.pathMeshes = [];
            sm.showPathfinding.lastUpdate = 0;
            return "Pathfinding visualization: OFF";
        }

        // Remove any lingering observer from a previous toggle before creating a new one
        if (sm.showPathfinding.observer) {
            sm.scene.onBeforeRenderObservable.remove(sm.showPathfinding.observer);
            sm.showPathfinding.observer = null;
        }

        sm.showPathfinding.lastUpdate = 0;

        sm.showPathfinding.observer = sm.scene.onBeforeRenderObservable.add(() => {
            // Only update every 10 frames to reduce flicker and improve performance
            sm.showPathfinding.lastUpdate++;
            if (sm.showPathfinding.lastUpdate < 10) return;
            sm.showPathfinding.lastUpdate = 0;

            // Dispose old path meshes
            for (const mesh of sm.showPathfinding.pathMeshes) {
                mesh.dispose();
            }
            sm.showPathfinding.pathMeshes = [];

            const navPlugin = sm.navPlugin;
            if (!navPlugin) return;

            const camera = sm.camera;
            let zombieCount = 0;
            let hellhoundCount = 0;

            for (const z of sm.zombies) {
                if (z.isDead) continue;

                let path: BABYLON.Vector3[] | null = null;
                let color = new BABYLON.Color3(0, 1, 0);

                if (z.type === 'HELLHOUND' && z.hellhoundState) {
                    hellhoundCount++;
                    color = new BABYLON.Color3(1, 0.3, 0);

                    if (z.hellhoundState === 'CHASING' || z.hellhoundState === 'ATTACK_WINDUP') {
                        const targetPos = camera.position.clone();
                        targetPos.y = z.mesh.position.y;
                        const closestPoint = navPlugin.getClosestPoint(targetPos);
                        const navTarget = new BABYLON.Vector3(closestPoint.x, z.mesh.position.y, closestPoint.z);
                        path = navPlugin.computePath(z.mesh.position, navTarget);
                    }
                } else if (z.state) {
                    zombieCount++;
                    color = new BABYLON.Color3(0, 1, 0);

                    if (z.state === 'CHASING') {
                        const targetPos = camera.position.clone();
                        targetPos.y = z.mesh.position.y;
                        const closestPoint = navPlugin.getClosestPoint(targetPos);
                        const navTarget = new BABYLON.Vector3(closestPoint.x, z.mesh.position.y, closestPoint.z);
                        path = navPlugin.computePath(z.mesh.position, navTarget);
                    } else if (z.state === 'APPROACHING_WINDOW' || z.state === 'ATTACKING_BARRIER') {
                        const window = sm.windows.find(w => w.id === z.targetWindowId);
                        if (window) {
                            path = [z.mesh.position.clone(), window.attackPoint.clone()];
                        }
                    } else if (z.state === 'ENTERING') {
                        const window = sm.windows.find(w => w.id === z.targetWindowId);
                        if (window) {
                            path = [z.mesh.position.clone(), window.entryPoint.clone()];
                        }
                    }
                }

                if (path && path.length > 1) {
                    const points = [z.mesh.position.clone()];
                    for (const p of path) {
                        points.push(p.clone());
                    }
                    // Use tube for thicker, more visible lines
                    const tube = BABYLON.MeshBuilder.CreateTube("pathTube_" + z.id, {
                        path: points,
                        radius: 0.15,
                        tessellation: 8,
                        updatable: false
                    }, sm.scene);
                    const tubeMat = new BABYLON.StandardMaterial("pathMat_" + z.id, sm.scene);
                    tubeMat.emissiveColor = color;
                    tubeMat.disableLighting = true;
                    tube.material = tubeMat;
                    sm.showPathfinding.pathMeshes.push(tube);
                }
            }
        });

        return "Pathfinding visualization: ON (thicker lines)";
    },
    'wireframe': (args, sm) => {
        sm.scene.forceWireframe = !sm.scene.forceWireframe;
        return `Wireframe: ${sm.scene.forceWireframe ? 'ON' : 'OFF'}`;
    },
    'god': (args, sm) => {
        sm.gameState.isGodMode = !sm.gameState.isGodMode;
        return `God mode: ${sm.gameState.isGodMode ? 'ON' : 'OFF'}`;
    },
    'noclip': (args, sm) => {
        sm.gameState.isNoclip = !sm.gameState.isNoclip;
        if (sm.gameState.isNoclip) {
            sm.camera.checkCollisions = false;
            sm.camera.applyGravity = false;
        } else {
            sm.camera.checkCollisions = true;
            sm.camera.applyGravity = true;
        }
        return `Noclip: ${sm.gameState.isNoclip ? 'ON' : 'OFF'}`;
    },
    'perk': (args, sm) => {
        if (args.length < 1) return "Usage: /perk <id>  (juggernog, speedCola, quickRevive, doubleTap, muleKick)";

        const perkId = args[0];
        const gc = sm.configManager.gameplay;

        // Map perk id → perk type (snake_case used for effect logic)
        const idToType: Record<string, string> = {
            juggernog:   'juggernog',
            speedcola:   'speed_cola',
            speedCola:   'speed_cola',
            quickrevive: 'quick_revive',
            quickRevive: 'quick_revive',
            doubletap:   'double_tap',
            doubleTap:   'double_tap',
            mulekick:    'mule_kick',
            muleKick:    'mule_kick',
        };

        // Canonical camelCase state key for each perk
        const idToStateKey: Record<string, string> = {
            juggernog:   'juggernog',
            speedcola:   'speedCola',
            speedCola:   'speedCola',
            quickrevive: 'quickRevive',
            quickRevive: 'quickRevive',
            doubletap:   'doubleTap',
            doubleTap:   'doubleTap',
            mulekick:    'muleKick',
            muleKick:    'muleKick',
        };

        const perkType  = idToType[perkId];
        const stateKey  = idToStateKey[perkId];

        if (!perkType || !stateKey) {
            return `Unknown perk: ${perkId}. Use: juggernog, speedCola, quickRevive, doubleTap, muleKick`;
        }

        sm.gameState.perkStates[stateKey] = true;

        if (perkType === 'juggernog') {
            sm.gameState.maxHealth = gc.PLAYER_JUGG_HEALTH;
            sm.gameState.health    = gc.PLAYER_JUGG_HEALTH;
            sm.setHealth(gc.PLAYER_JUGG_HEALTH);
        }

        sm.setPerks(sm.gameState.perkStates);

        return `Perk granted: ${stateKey}`;
    },
    'powerup': (args, sm) => {
        if (args.length < 1) return "Usage: /powerup <type> (instakill, max_ammo, double_points, nuke, carpenter, fire_sale)";
        
        const typeMap: Record<string, PowerUpType> = {
            'instakill': PowerUpType.INSTA_KILL,
            'max_ammo': PowerUpType.MAX_AMMO,
            'double_points': PowerUpType.DOUBLE_POINTS,
            'nuke': PowerUpType.NUKE,
            'carpenter': PowerUpType.CARPENTER,
            'fire_sale': PowerUpType.FIRE_SALE
        };
        
        const typeKey = args[0].toLowerCase();
        const powerUpType = typeMap[typeKey];
        
        if (!powerUpType) return `Unknown powerup type: ${args[0]}. Use: instakill, max_ammo, double_points, nuke, carpenter, fire_sale`;
        
        // Spawn powerup in front of player on the ground
        const forward = sm.camera.getDirection(new BABYLON.Vector3(0, 0, 1));
        forward.y = 0; // Flatten to horizontal plane
        forward.normalize();
        const spawnPos = sm.camera.position.add(forward.scale(2));
        spawnPos.y = 0; // Ground level (mesh adds +0.3)
        
        if (sm.powerUpManager) {
            sm.powerUpManager.spawnPowerUp(spawnPos, powerUpType);
            return `Spawned ${powerUpType} powerup.`;
        } else {
            return "PowerUpManager not available.";
        }
    },
    'scaleweapon': (args, sm) => {
        // Toggle off if already active
        if (sm.scaleWeaponMode.isActive && args.length === 0) {
            const mode = sm.scaleWeaponMode;
            const mesh = sm.gameState.weaponMeshes[mode.weaponId];
            if (mesh && mode.originalScale) {
                mesh.scaling.set(mode.originalScale.x, mode.originalScale.y, mode.originalScale.z);
            }
            sm.scaleWeaponMode.isActive = false;
            sm.ui.setScaleWeaponMode(null);
            return "Scale weapon tool: OFF";
        }

        // Determine weapon target
        let weaponId: string;
        if (args.length >= 1) {
            weaponId = args[0].toLowerCase();
        } else {
            // Default to current weapon
            const current = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
            if (!current) return "No weapon equipped.";
            weaponId = current.id;
        }

        const mesh = sm.gameState.weaponMeshes[weaponId];
        if (!mesh) {
            const available = Object.keys(sm.gameState.weaponMeshes).join(', ');
            return `Unknown weapon: ${weaponId}. Available: ${available}`;
        }

        // Read current scale from child model mesh (root TransformNode is always 1,1,1)
        const modelMesh = mesh.getChildren()?.[0] ?? mesh;
        const currentScale = modelMesh.scaling;
        sm.scaleWeaponMode = {
            isActive: true,
            weaponId,
            scale: { x: currentScale.x, y: currentScale.y, z: currentScale.z },
            originalScale: { x: currentScale.x, y: currentScale.y, z: currentScale.z },
            step: 0.01,
            axis: 'all',
        };

        // Push to UI and signal console to close
        sm.ui.setScaleWeaponMode({
            weaponId,
            scale: { x: currentScale.x, y: currentScale.y, z: currentScale.z },
            step: 0.01,
            axis: 'all',
        });

        // Close console & return to game (handled by COMMAND_CLOSE_CONSOLE event)
        sm.eventBus.emit('COMMAND_CLOSE_CONSOLE', null);

        return null; // suppress console result text since we're closing
    },
    'debug_pbr': (args, sm) => {
        const scene = sm.scene;
        const env = scene.environmentTexture;
        const lights = scene.lights;
        const pbrMats = scene.materials.filter(m => m instanceof BABYLON.PBRMaterial);
        
        let report = `Env Texture: ${env ? env.name : 'NONE'}\n`;
        report += `Ready: ${env ? env.isReady() : 'N/A'}\n`;
        report += `Intensity: ${scene.environmentIntensity}\n`;
        report += `Lights: ${lights.length} (${lights.map(l => l.name).join(', ')})\n`;
        report += `PBR Mats: ${pbrMats.length}\n`;
        if (pbrMats.length > 0) {
            const m = pbrMats[0] as BABYLON.PBRMaterial;
            report += `First PBR: ${m.name}, Intensity: ${m.environmentIntensity}, Direct: ${m.directIntensity}`;
        }
        return report;
    },
    'debug_controls': (args, sm) => {
        sm.debugControlsMode.isActive = !sm.debugControlsMode.isActive;
        
        if (sm.debugControlsMode.isActive) {
            sm.debugControlsMode.lastFpsUpdate = Date.now();
            sm.debugControlsMode.frameCount = 0;
            sm.debugControlsMode.fps = 0;
            sm.ui.setDebugControls({ isActive: true });
            console.log('[DEBUG_CONTROLS] Enabled - Mouse/Controller input logging active');
            return `Debug Controls: ON\n- Mouse delta clamping active (max 150px)\n- Camera rotation tracking enabled\n- FPS counter visible (top-right)\n- Input source detection active`;
        } else {
            sm.ui.setDebugControls({ isActive: false });
            console.log('[DEBUG_CONTROLS] Disabled');
            return `Debug Controls: OFF`;
        }
    },
    'render_stats': (args, sm) => {
        sm.renderStatsMode.isActive = !sm.renderStatsMode.isActive;

        if (sm.renderStatsMode.isActive) {
            return `Render Stats: ON — Showing draw calls, materials, shadows, lights`;
        } else {
            sm.ui.setRenderStats({ isActive: false });
            return `Render Stats: OFF`;
        }
    },
    'help': () => {
        return `Commands: /debug, /debug_controls, /render_stats, /pos, /tp, /points, /give, /ammo, /round, /kill_all, /show_zones, /show_navmesh, /show_pathfinding, /wireframe, /god, /noclip, /powerup, /perk <name>, /scaleweapon [weapon_id], /debug_pbr`;
    }
};

export const executeCommand = (input: string, sm: StateManager): string => {
    if (!input.startsWith('/')) return "Commands must start with /";
    
    const parts = input.substring(1).split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    const handler = COMMANDS[cmd];
    if (handler) {
        try {
            return handler(args, sm) || "Command executed.";
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return `Error executing command: ${message}`;
        }
    }

    return `Unknown command: ${cmd}. Type /help for list.`;
};

