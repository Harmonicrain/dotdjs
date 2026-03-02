import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../state/StateManager';

export type EntityType = 
    | 'wall' | 'floor' | 'ceiling' | 'box' | 'ramp' 
    | 'ground' 
    | 'door' | 'window' 
    | 'perk' | 'wallbuy' | 'mysterybox' | 'power' | 'pap'
    | 'zone' | 'spawn' | 'light';

export interface PlacedEntity {
    id: string;
    type: EntityType;
    pos: [number, number, number];
    rotation: number;
    props: Record<string, unknown>;
    mesh?: BABYLON.Mesh;
    isPreview?: boolean;
}

class MapBuilderSystem {
    private entities: PlacedEntity[] = [];
    private idCounter = 0;
    private isBuilding = false;
    private previewEntity: PlacedEntity | null = null;
    private selectedEntity: PlacedEntity | null = null;
    private previewType: EntityType = 'wall';
    private previewArgs: string[] = [];
    private pointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfo>> = null;
    private lastFiring = false;
    private lastKnifing = false;
    private lastKeyQ = false;
    private lastKeyE = false;
    private lastKeyR = false;
    private lastKeyF = false;

    private generateId(type: EntityType): string {
        return `${type}_${this.idCounter++}`;
    }

    private getPlayerPos(sm: StateManager): [number, number, number] {
        const p = sm.camera.position;
        return [parseFloat(p.x.toFixed(2)), parseFloat(p.y.toFixed(2)), parseFloat(p.z.toFixed(2))];
    }

    private getPlayerRotY(sm: StateManager): number {
        return parseFloat(sm.camera.rotation.y.toFixed(2));
    }

    private getForwardVector(sm: StateManager): BABYLON.Vector3 {
        const forward = sm.camera.getDirection(new BABYLON.Vector3(0, 0, 1));
        forward.y = 0;
        forward.normalize();
        return forward;
    }

    // Entity type to default dimensions mapping
    private static readonly ENTITY_DIMENSIONS: Record<EntityType, { width: number; height: number; depth: number; isSphere?: boolean }> = {
        wall: { width: 1, height: 3, depth: 0.5 },
        floor: { width: 1, height: 3, depth: 0.5 },
        ceiling: { width: 1, height: 3, depth: 0.5 },
        box: { width: 1, height: 3, depth: 0.5 },
        ramp: { width: 1, height: 3, depth: 0.5 },
        ground: { width: 1, height: 3, depth: 0.5 },
        door: { width: 3, height: 4, depth: 0.3 },
        window: { width: 3, height: 3, depth: 0.3 },
        perk: { width: 1, height: 2, depth: 1 },
        wallbuy: { width: 1.5, height: 2, depth: 0.5 },
        mysterybox: { width: 2, height: 1, depth: 2 },
        power: { width: 0.5, height: 1, depth: 0.3 },
        pap: { width: 2, height: 2.5, depth: 2 },
        zone: { width: 20, height: 0.1, depth: 20 },
        spawn: { width: 1, height: 2, depth: 1 },
        light: { width: 0.5, height: 0.5, depth: 0.5, isSphere: true },
    };

    /**
     * Shared mesh creation logic for both preview and placed entities.
     * Returns an unpositioned, unmaterialized mesh.
     */
    private createEntityMesh(entity: PlacedEntity, scene: BABYLON.Scene): BABYLON.Mesh {
        const dims = MapBuilderSystem.ENTITY_DIMENSIONS[entity.type] || { width: 1, height: 3, depth: 0.5 };
        
        // Use entity props for geometry types that support custom dimensions
        const useCustomDims = ['wall', 'floor', 'ceiling', 'box', 'ramp', 'ground'].includes(entity.type);
        const w = useCustomDims ? (entity.props.width as number || dims.width) : dims.width;
        const h = useCustomDims ? (entity.props.height as number || dims.height) : dims.height;
        const d = useCustomDims ? (entity.props.depth as number || dims.depth) : dims.depth;

        if (dims.isSphere) {
            return BABYLON.MeshBuilder.CreateSphere(entity.id, { diameter: w }, scene);
        }
        return BABYLON.MeshBuilder.CreateBox(entity.id, { width: w, height: h, depth: d }, scene);
    }

    private createPreviewMesh(entity: PlacedEntity, sm: StateManager): BABYLON.Mesh {
        const mesh = this.createEntityMesh(entity, sm.scene);

        mesh.position.set(entity.pos[0], entity.pos[1], entity.pos[2]);
        mesh.rotation.y = entity.rotation;
        
        const mat = new BABYLON.StandardMaterial(entity.id + '_mat', sm.scene);
        mat.diffuseColor = new BABYLON.Color3(0.3, 0.7, 1);
        mat.alpha = 0.5;
        mat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.5);
        mesh.material = mat;

        mesh.isPickable = true;
        mesh.metadata = { type: 'mapbuilder_entity', entity };

        return mesh;
    }

    private createPlacedMesh(entity: PlacedEntity, sm: StateManager): BABYLON.Mesh {
        const mesh = this.createEntityMesh(entity, sm.scene);

        mesh.position.set(entity.pos[0], entity.pos[1], entity.pos[2]);
        mesh.rotation.y = entity.rotation;
        
        const mat = new BABYLON.StandardMaterial(entity.id + '_mat', sm.scene);
        
        // Type-specific coloring for placed entities
        if (entity.type === 'zone') {
            mat.diffuseColor = new BABYLON.Color3(1, 0.5, 0);
            mat.alpha = 0.3;
        } else if (entity.type === 'spawn') {
            mat.diffuseColor = new BABYLON.Color3(0, 1, 1);
            mat.alpha = 0.7;
        } else if (entity.type === 'light') {
            mat.diffuseColor = new BABYLON.Color3(1, 1, 0);
            mat.emissiveColor = new BABYLON.Color3(1, 1, 0);
        } else {
            mat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        }
        
        mesh.material = mat;
        mesh.isPickable = true;
        mesh.metadata = { type: 'mapbuilder_entity', entity };

        return mesh;
    }

    private setPreviewMaterial(mesh: BABYLON.Mesh, isSelected: boolean): void {
        const mat = mesh.material as BABYLON.StandardMaterial;
        if (isSelected) {
            mat.diffuseColor = new BABYLON.Color3(0, 1, 0);
            mat.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
            mat.alpha = 0.7;
        } else {
            mat.diffuseColor = new BABYLON.Color3(0.3, 0.7, 1);
            mat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.5);
            mat.alpha = 0.5;
        }
    }

    private updatePreviewPosition(sm: StateManager): void {
        if (!this.previewEntity?.mesh) return;
        
        const forward = this.getForwardVector(sm);
        const pos = this.getPlayerPos(sm);
        
        let targetPos: BABYLON.Vector3;
        
        if (this.selectedEntity?.mesh) {
            targetPos = this.selectedEntity.mesh.position.clone();
        } else {
            targetPos = new BABYLON.Vector3(pos[0] + forward.x * 3, pos[1], pos[2] + forward.z * 3);
            
            if (this.previewEntity.type === 'zone' || this.previewEntity.type === 'spawn' || this.previewEntity.type === 'ground') {
                targetPos.y = 0.1;
            } else if (this.previewEntity.type === 'light') {
                targetPos.y = 3;
            } else {
                const h = this.previewEntity.props.height as number || 2;
                targetPos.y = h / 2;
            }
        }

        // Apply snapping for wall/floor/box/ramp/ground types
        if (['wall', 'floor', 'ceiling', 'box', 'ramp', 'ground'].includes(this.previewEntity.type)) {
            targetPos = this.applySnap(targetPos, this.previewEntity);
        }
        
        this.previewEntity.mesh.position.copyFrom(targetPos);
        this.previewEntity.pos = [parseFloat(targetPos.x.toFixed(2)), parseFloat(targetPos.y.toFixed(2)), parseFloat(targetPos.z.toFixed(2))];
    }

    private applySnap(pos: BABYLON.Vector3, entity: PlacedEntity): BABYLON.Vector3 {
        const gridSize = 1.0;
        const snapThreshold = 2.0;
        
        const w = entity.props.width as number || 1;
        const h = entity.props.height as number || 3;
        const d = entity.props.depth as number || 1;
        
        // Start with grid snapping
        let snappedX = Math.round(pos.x / gridSize) * gridSize;
        let snappedZ = Math.round(pos.z / gridSize) * gridSize;
        
        let bestSnapX: number | null = null;
        let bestSnapZ: number | null = null;
        let bestDist = snapThreshold;
        
        // Find closest edge to snap to
        for (const e of this.entities) {
            if (!e.mesh || e.type === 'zone' || e.type === 'spawn' || e.type === 'light') continue;
            
            const ew = e.props.width as number || 1;
            const ed = e.props.depth as number || 1;
            const ePos = e.mesh.position;
            
            // Check X-axis faces (left/right sides)
            const rightEdge = ePos.x + ew / 2;
            const leftEdge = ePos.x - ew / 2;
            
            const distToRight = Math.abs(pos.x - rightEdge);
            const distToLeft = Math.abs(pos.x - leftEdge);
            
            if (distToRight < bestDist && Math.abs(pos.z - ePos.z) < (ed + d) / 2) {
                bestDist = distToRight;
                bestSnapX = rightEdge + w / 2;
                bestSnapZ = ePos.z;
            }
            if (distToLeft < bestDist && Math.abs(pos.z - ePos.z) < (ed + d) / 2) {
                bestDist = distToLeft;
                bestSnapX = leftEdge - w / 2;
                bestSnapZ = ePos.z;
            }
            
            // Check Z-axis faces (front/back sides)
            const frontEdge = ePos.z + ed / 2;
            const backEdge = ePos.z - ed / 2;
            
            const distToFront = Math.abs(pos.z - frontEdge);
            const distToBack = Math.abs(pos.z - backEdge);
            
            if (distToFront < bestDist && Math.abs(pos.x - ePos.x) < (ew + w) / 2) {
                bestDist = distToFront;
                bestSnapZ = frontEdge + d / 2;
                bestSnapX = ePos.x;
            }
            if (distToBack < bestDist && Math.abs(pos.x - ePos.x) < (ew + w) / 2) {
                bestDist = distToBack;
                bestSnapZ = backEdge - d / 2;
                bestSnapX = ePos.x;
            }
        }
        
        if (bestSnapX !== null && bestSnapZ !== null) {
            snappedX = bestSnapX;
            snappedZ = bestSnapZ;
        }
        
        // Snap height - stack on top of other geometry or ground
        let snappedY = h / 2;
        
        for (const e of this.entities) {
            if (!e.mesh || e.type === 'zone' || e.type === 'spawn' || e.type === 'light') continue;
            
            const ew = e.props.width as number || 1;
            const eh = e.props.height as number || 3;
            const ed = e.props.depth as number || 1;
            const ePos = e.mesh.position;
            
            // Check horizontal overlap
            const overlapX = Math.abs(snappedX - ePos.x) < (w/2 + ew/2);
            const overlapZ = Math.abs(snappedZ - ePos.z) < (d/2 + ed/2);
            
            if (overlapX && overlapZ) {
                // Stack on top
                const topOfEntity = ePos.y + eh / 2;
                if (Math.abs(pos.y - (topOfEntity + h / 2)) < 2.0) {
                    snappedY = topOfEntity + h / 2;
                }
                // Snap to ground if close
                if (pos.y < ePos.y + eh / 2 + 1) {
                    snappedY = h / 2;
                }
            }
        }
        
        return new BABYLON.Vector3(snappedX, snappedY, snappedZ);
    }

    private setupPointerHandler(sm: StateManager): void {
        if (this.pointerObserver) return;
        
        this.pointerObserver = sm.scene.onPointerObservable.add((pointerInfo: BABYLON.PointerInfo) => {
            if (!this.isBuilding) return;
            
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                const pickResult = sm.scene.pick(sm.scene.pointerX, sm.scene.pointerY, (mesh) => {
                    return mesh.metadata?.type === 'mapbuilder_entity';
                });
                
                if (pickResult?.hit && pickResult.pickedMesh) {
                    const entity = pickResult.pickedMesh.metadata?.entity as PlacedEntity;
                    if (entity && !entity.isPreview) {
                        if (this.selectedEntity?.mesh) {
                            const mat = this.selectedEntity.mesh.material as BABYLON.StandardMaterial;
                            mat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
                            mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
                        }
                        
                        this.selectedEntity = entity;
                        this.setPreviewMaterial(entity.mesh!, true);
                    }
                }
            }
        });
    }

    private cleanupPointerHandler(): void {
        if (this.pointerObserver) {
            this.pointerObserver = null;
        }
    }

    private deleteEntity(entity: PlacedEntity): void {
        if (entity.mesh) {
            entity.mesh.dispose();
        }
        const idx = this.entities.indexOf(entity);
        if (idx !== -1) {
            this.entities.splice(idx, 1);
        }
    }

    private createNewPreview(sm: StateManager): void {
        if (this.previewEntity?.mesh) {
            this.previewEntity.mesh.dispose();
        }
        
        const pos = this.getPlayerPos(sm);
        const forward = this.getForwardVector(sm);
        
        let initialPos: [number, number, number];
        let h = 2;
        
        switch (this.previewType) {
            case 'zone':
            case 'spawn':
            case 'ground':
                initialPos = [pos[0] + forward.x * 3, 0.1, pos[2] + forward.z * 3];
                break;
            case 'light':
                initialPos = [pos[0] + forward.x * 3, 3, pos[2] + forward.z * 3];
                break;
            default:
                h = this.previewArgs[1] ? parseFloat(this.previewArgs[1]) : 
                    (this.previewType === 'wall' ? 3 : 
                     this.previewType === 'box' ? 1 : 
                     this.previewType === 'mysterybox' ? 1 :
                     this.previewType === 'pap' ? 2.5 :
                     this.previewType === 'door' ? 4 :
                     this.previewType === 'window' ? 3 : 2);
                initialPos = [pos[0] + forward.x * 3, h / 2, pos[2] + forward.z * 3];
        }
        
        this.previewEntity = {
            id: this.generateId(this.previewType),
            type: this.previewType,
            pos: initialPos,
            rotation: this.getPlayerRotY(sm),
            props: this.getPreviewProps(),
            isPreview: true
        };
        
        this.previewEntity.mesh = this.createPreviewMesh(this.previewEntity, sm);
    }

    private getPreviewProps(): Record<string, unknown> {
        switch (this.previewType) {
            case 'wall':
                return { 
                    width: this.previewArgs[0] ? parseFloat(this.previewArgs[0]) : 1,
                    height: this.previewArgs[1] ? parseFloat(this.previewArgs[1]) : 3,
                    depth: this.previewArgs[2] ? parseFloat(this.previewArgs[2]) : 0.5,
                    texture: 'brick'
                };
            case 'floor':
            case 'ceiling':
                return {
                    width: this.previewArgs[0] ? parseFloat(this.previewArgs[0]) : 10,
                    height: 0.2,
                    depth: this.previewArgs[1] ? parseFloat(this.previewArgs[1]) : 10,
                    texture: this.previewType === 'floor' ? 'floor' : 'ceiling'
                };
            case 'box':
                return {
                    width: this.previewArgs[0] ? parseFloat(this.previewArgs[0]) : 1,
                    height: this.previewArgs[1] ? parseFloat(this.previewArgs[1]) : 1,
                    depth: this.previewArgs[2] ? parseFloat(this.previewArgs[2]) : 1
                };
            case 'ramp':
                return {
                    width: this.previewArgs[0] ? parseFloat(this.previewArgs[0]) : 3,
                    height: this.previewArgs[1] ? parseFloat(this.previewArgs[1]) : 3,
                    depth: this.previewArgs[2] ? parseFloat(this.previewArgs[2]) : 5
                };
            case 'ground':
                return {
                    width: this.previewArgs[0] ? parseFloat(this.previewArgs[0]) : 20,
                    height: 0.1,
                    depth: this.previewArgs[1] ? parseFloat(this.previewArgs[1]) : 20,
                    texture: 'wood'
                };
            case 'door':
                return {
                    cost: this.previewArgs[0] ? parseInt(this.previewArgs[0]) : 500,
                    connects: [this.previewArgs[1] ? parseInt(this.previewArgs[1]) : 1, this.previewArgs[2] ? parseInt(this.previewArgs[2]) : 2],
                    size: [3, 4, 0.3]
                };
            case 'window':
                return {
                    zone: this.previewArgs[0] ? parseInt(this.previewArgs[0]) : 1,
                    planks: this.previewArgs[1] ? parseInt(this.previewArgs[1]) : 5
                };
            case 'perk':
                return {
                    type: this.previewArgs[0] || 'juggernog',
                    zone: this.previewArgs[1] ? parseInt(this.previewArgs[1]) : 1,
                    id: `perk_${this.previewArgs[0] || 'juggernog'}_${this.idCounter}`
                };
            case 'wallbuy':
                return {
                    weapon: this.previewArgs[0] || 'shotgun',
                    cost: this.previewArgs[1] ? parseInt(this.previewArgs[1]) : 500,
                    zone: this.previewArgs[2] ? parseInt(this.previewArgs[2]) : 1,
                    id: `wallbuy_${this.previewArgs[0] || 'shotgun'}_${this.idCounter}`
                };
            case 'mysterybox':
                return {};
            case 'power':
                return {};
            case 'pap':
                return { zone: this.previewArgs[0] ? parseInt(this.previewArgs[0]) : 1 };
            case 'zone':
                return {
                    id: Math.max(0, ...this.entities.filter(e => e.type === 'zone').map(e => e.props.id as number)) + 1,
                    bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
                    spawnBounds: { min: [-10, 2, -10], max: [10, 2, 10] }
                };
            case 'spawn':
                return { which: 'host', rot: 0 };
            case 'light':
                return {
                    intensity: this.previewArgs[0] ? parseFloat(this.previewArgs[0]) : 1.0,
                    range: this.previewArgs[1] ? parseFloat(this.previewArgs[1]) : 20,
                    zone: this.previewArgs[2] ? parseInt(this.previewArgs[2]) : 1
                };
            default:
                return {};
        }
    }

    private cleanup(sm: StateManager): void {
        this.cleanupPointerHandler();
        
        for (const entity of this.entities) {
            if (entity.mesh) {
                entity.mesh.dispose();
            }
        }
        
        if (this.previewEntity?.mesh) {
            this.previewEntity.mesh.dispose();
        }
        
        this.entities = [];
        this.previewEntity = null;
        this.selectedEntity = null;
        this.isBuilding = false;
    }

    enterBuildingMode(type: EntityType, args: string[], sm: StateManager): string {
        this.isBuilding = true;
        this.previewType = type;
        this.previewArgs = args;
        
        sm.gameState.isBuildMode = true;
        
        this.setupPointerHandler(sm);
        this.createNewPreview(sm);
        
        sm.ui.setBuildModeControls({
            entityType: type,
            placedCount: this.entities.length,
            selectedEntity: false
        });
        
        return `Building mode: ${type}. Click to select (green). Walk to move. Shoot to place. Knife to delete. /build exit to exit.`;
    }

    exitBuildingMode(sm: StateManager): string {
        if (this.previewEntity?.mesh) {
            this.previewEntity.mesh.dispose();
            this.previewEntity = null;
        }
        
        if (this.selectedEntity?.mesh) {
            const mat = this.selectedEntity.mesh.material as BABYLON.StandardMaterial;
            mat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
            mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
            this.selectedEntity = null;
        }
        
        this.cleanupPointerHandler();
        this.isBuilding = false;
        sm.gameState.isBuildMode = false;
        sm.ui.setBuildModeControls(null);
        
        return "Exited building mode. Use /build export to get the map definition.";
    }

    isInBuildingMode(): boolean {
        return this.isBuilding;
    }

    update(sm: StateManager): void {
        if (!this.isBuilding) return;
        
        this.updatePreviewPosition(sm);
        
        // Check for keyboard input
        const inputManager = sm.inputManager;
        
        if (inputManager) {
            const isKeyQ = inputManager.isKeyDown('KeyQ');
            const isKeyE = inputManager.isKeyDown('KeyE');
            const isKeyR = inputManager.isKeyDown('KeyR');
            const isKeyF = inputManager.isKeyDown('KeyF');
            
            const targetEntity = this.selectedEntity || this.previewEntity;
            
            // Rotate left (Q)
            if (isKeyQ && !this.lastKeyQ && targetEntity?.mesh) {
                targetEntity.rotation -= Math.PI / 8;
                targetEntity.mesh.rotation.y = targetEntity.rotation;
            }
            
            // Rotate right (E)
            if (isKeyE && !this.lastKeyE && targetEntity?.mesh) {
                targetEntity.rotation += Math.PI / 8;
                targetEntity.mesh.rotation.y = targetEntity.rotation;
            }
            
            // Move up (R) - for selected/preview entity
            if (isKeyR && !this.lastKeyR && targetEntity?.mesh) {
                targetEntity.mesh.position.y += 0.5;
                targetEntity.pos = [
                    parseFloat(targetEntity.mesh.position.x.toFixed(2)),
                    parseFloat(targetEntity.mesh.position.y.toFixed(2)),
                    parseFloat(targetEntity.mesh.position.z.toFixed(2))
                ];
            }
            
            // Move down (F)
            if (isKeyF && !this.lastKeyF && targetEntity?.mesh) {
                targetEntity.mesh.position.y = Math.max(0.1, targetEntity.mesh.position.y - 0.5);
                targetEntity.pos = [
                    parseFloat(targetEntity.mesh.position.x.toFixed(2)),
                    parseFloat(targetEntity.mesh.position.y.toFixed(2)),
                    parseFloat(targetEntity.mesh.position.z.toFixed(2))
                ];
            }
            
            this.lastKeyQ = isKeyQ;
            this.lastKeyE = isKeyE;
            this.lastKeyR = isKeyR;
            this.lastKeyF = isKeyF;
        }
        
        const isFiring = sm.gameState.isFiring;
        const isKnifing = sm.gameState.isKnifing;
        
        if (isFiring && !this.lastFiring) {
            if (this.selectedEntity?.mesh) {
                this.selectedEntity.isPreview = false;
                const mat = this.selectedEntity.mesh.material as BABYLON.StandardMaterial;
                mat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
                mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
                mat.alpha = 1;
                this.selectedEntity = null;
            } else if (this.previewEntity?.mesh) {
                this.previewEntity.mesh.metadata = { type: 'mapbuilder_entity', entity: this.previewEntity };
                this.previewEntity.isPreview = false;
                this.entities.push(this.previewEntity);
                
                const mat = this.previewEntity.mesh.material as BABYLON.StandardMaterial;
                mat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
                mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
                mat.alpha = 1;
                
                this.previewEntity = null;
                this.createNewPreview(sm);
            }
            
            sm.ui.setBuildModeControls({
                entityType: this.previewType,
                placedCount: this.entities.length,
                selectedEntity: false
            });
        }
        
        if (isKnifing && !this.lastKnifing) {
            if (this.selectedEntity?.mesh) {
                this.deleteEntity(this.selectedEntity);
                this.selectedEntity = null;
                
                sm.ui.setBuildModeControls({
                    entityType: this.previewType,
                    placedCount: this.entities.length,
                    selectedEntity: false
                });
            }
        }
        
        // Update UI with current selection state
        sm.ui.setBuildModeControls({
            entityType: this.previewType,
            placedCount: this.entities.length,
            selectedEntity: !!this.selectedEntity
        });
        
        this.lastFiring = isFiring;
        this.lastKnifing = isKnifing;
    }

    placeWall(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('wall', args, sm);
    }

    placeFloor(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('floor', args, sm);
    }

    placeCeiling(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('ceiling', args, sm);
    }

    placeBox(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('box', args, sm);
    }

    placeRamp(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('ramp', args, sm);
    }

    placeGround(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('ground', args, sm);
    }

    placeDoor(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('door', args, sm);
    }

    placeWindow(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('window', args, sm);
    }

    placePerk(args: string[], sm: StateManager): string {
        const perkType = args[0]?.toLowerCase();
        if (!perkType || !['juggernog', 'speed_cola', 'quick_revive'].includes(perkType)) {
            return "Usage: /build perk <juggernog|speed_cola|quick_revive>";
        }
        return this.enterBuildingMode('perk', args, sm);
    }

    placeWallbuy(args: string[], sm: StateManager): string {
        const weapon = args[0]?.toLowerCase();
        if (!weapon) return "Usage: /build wallbuy <weapon_id> [cost] [zone]";
        const validWeapons = ['shotgun', 'smg', 'assault_rifle', 'lmg', 'pistol', 'famas', 'g11', 'aug', 'spas', 'hs10', 'm72'];
        if (!validWeapons.includes(weapon)) return `Invalid weapon. Valid: ${validWeapons.join(', ')}`;
        return this.enterBuildingMode('wallbuy', args, sm);
    }

    placeMysterybox(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('mysterybox', args, sm);
    }

    placePower(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('power', args, sm);
    }

    placePap(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('pap', args, sm);
    }

    placeZone(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('zone', args, sm);
    }

    placeSpawn(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('spawn', args, sm);
    }

    placeLight(args: string[], sm: StateManager): string {
        return this.enterBuildingMode('light', args, sm);
    }

    listEntities(): string {
        if (this.entities.length === 0) return "No entities placed yet.";
        const lines = this.entities.map(e => `${e.type}: [${e.pos.join(', ')}]`);
        return `Placed entities (${this.entities.length}):\n` + lines.slice(0, 10).join('\n') + (lines.length > 10 ? `\n... and ${lines.length - 10} more` : '');
    }

    undo(): string {
        if (this.entities.length === 0) return "Nothing to undo.";
        const removed = this.entities.pop();
        if (removed?.mesh) removed.mesh.dispose();
        return `Removed: ${removed?.type} at [${(removed?.pos || [0,0,0]).join(', ')}]`;
    }

    clear(): string {
        const count = this.entities.length;
        for (const entity of this.entities) {
            if (entity.mesh) entity.mesh.dispose();
        }
        this.entities = [];
        this.idCounter = 0;
        return `Cleared ${count} entities.`;
    }

    export(): string {
        const geometry = this.entities.filter(e => ['wall', 'floor', 'ceiling', 'box', 'ramp'].includes(e.type));
        const grounds = this.entities.filter(e => e.type === 'ground');
        const doors = this.entities.filter(e => e.type === 'door');
        const windows = this.entities.filter(e => e.type === 'window');
        const perks = this.entities.filter(e => e.type === 'perk');
        const wallbuys = this.entities.filter(e => e.type === 'wallbuy');
        const mysteryboxes = this.entities.filter(e => e.type === 'mysterybox');
        const powers = this.entities.filter(e => e.type === 'power');
        const paps = this.entities.filter(e => e.type === 'pap');
        const zones = this.entities.filter(e => e.type === 'zone');
        const spawns = this.entities.filter(e => e.type === 'spawn');
        const lights = this.entities.filter(e => e.type === 'light');

        const hostSpawn = spawns.find(s => s.props.which === 'host');
        const clientSpawn = spawns.find(s => s.props.which === 'client');

        return `import { MapDefinition } from '@/engine/MapDefinition';

export const CustomMapDefinition: MapDefinition = {
    meta: {
        id: "custom_map_${Date.now()}",
        name: "Custom Map",
        version: "1.0.0",
        description: "Built via /build debug command"
    },
    
    geometry: [
${geometry.map(e => `        { type: "${e.type}", pos: [${e.pos.join(', ')}], size: [${Number(e.props.width || 1).toFixed(1)}, ${Number(e.props.height || 1).toFixed(1)}, ${Number(e.props.depth || 1).toFixed(1)}], rotation: [0, ${e.rotation}, 0], texture: "${e.props.texture || 'brick'}" }`).join(',\n')}
    ],
    
    grounds: [
${grounds.map(e => `        { width: ${(e.props.width as number).toFixed(1)}, height: ${(e.props.depth as number).toFixed(1)}, pos: [${e.pos.join(', ')}], texture: "${e.props.texture || 'wood'}" }`).join(',\n')}
    ],
    
    interactables: {
        doors: [
${doors.map(e => `            { id: "${e.id}", cost: ${e.props.cost}, connects: [${(e.props.connects as number[]).join(', ')}], pos: [${e.pos.join(', ')}], size: [${(e.props.size as number[]).join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        windows: [
${windows.map(e => `            { id: "${e.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation}, planks: ${e.props.planks} }`).join(',\n')}
        ],
        perks: [
${perks.map(e => `            { type: "${e.props.type}", id: "${e.props.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        wallbuys: [
${wallbuys.map(e => `            { weapon: "${e.props.weapon}", cost: ${e.props.cost}, id: "${e.props.id}", zone: ${e.props.zone}, pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        mysteryBoxes: [
${mysteryboxes.map(e => `            { pos: [${e.pos.join(', ')}], rotation: ${e.rotation} }`).join(',\n')}
        ],
        powerSwitch: ${powers.length > 0 ? `{ pos: [${powers[0].pos.join(', ')}], rotation: ${powers[0].rotation} }` : 'null'},
        packAPunch: ${paps.length > 0 ? `{ pos: [${paps[0].pos.join(', ')}], rotation: ${paps[0].rotation}, zone: ${paps[0].props.zone} }` : 'null'}
    },
    
    fixtures: [
${lights.map(e => `        { pos: [${e.pos[0]}, ${e.pos[2]}], zone: ${e.props.zone}, intensity: ${e.props.intensity}, range: ${e.props.range} }`).join(',\n')}
    ],
    
    zones: [
${zones.map(e => `        { id: ${e.props.id}, bounds: { minX: ${(e.props.bounds as {minX:number}).minX}, maxX: ${(e.props.bounds as {maxX:number}).maxX}, minZ: ${(e.props.bounds as {minZ:number}).minZ}, maxZ: ${(e.props.bounds as {maxZ:number}).maxZ} }, spawnBounds: { min: [${((e.props.spawnBounds as {min:number[]}).min).join(', ')}], max: [${((e.props.spawnBounds as {max:number[]}).max).join(', ')}] } }`).join(',\n')}
    ],
    
    spawns: {
        host: ${hostSpawn ? `{ pos: [${hostSpawn.pos.join(', ')}], rot: ${hostSpawn.props.rot} }` : '{ pos: [0, 2.2, 0], rot: 0 }'},
        client: ${clientSpawn ? `{ pos: [${clientSpawn.pos.join(', ')}], rot: ${clientSpawn.props.rot} }` : '{ pos: [4, 2.2, 0], rot: 0 }'}
    },
    
    environment: {
        fog: { mode: 'exp2', density: 0.02, color: [0.3, 0.35, 0.45] },
        skybox: true,
        ambientLight: { intensity: 0.4, diffuse: [0.3, 0.35, 0.45], ground: [0.15, 0.15, 0.2] },
        directionalLight: { direction: [-0.3, -1, 0.2], intensity: 0.4 }
    },
    
    navigation: {
        navmeshParameters: {
            cs: 0.2, ch: 0.2, walkableSlopeAngle: 45, walkableHeight: 2.0,
            walkableClimb: 0.5, walkableRadius: 0.3, maxEdgeLen: 12,
            maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
            maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1
        }
    }
};`;
    }

    execute(subcommand: string, args: string[], sm: StateManager): string {
        switch (subcommand) {
            case 'wall': return this.placeWall(args, sm);
            case 'floor': return this.placeFloor(args, sm);
            case 'ceiling': return this.placeCeiling(args, sm);
            case 'box': return this.placeBox(args, sm);
            case 'ramp': return this.placeRamp(args, sm);
            case 'ground': return this.placeGround(args, sm);
            case 'door': return this.placeDoor(args, sm);
            case 'window': return this.placeWindow(args, sm);
            case 'perk': return this.placePerk(args, sm);
            case 'wallbuy': return this.placeWallbuy(args, sm);
            case 'mysterybox': return this.placeMysterybox(args, sm);
            case 'power': return this.placePower(args, sm);
            case 'pap': return this.placePap(args, sm);
            case 'zone': return this.placeZone(args, sm);
            case 'spawn': return this.placeSpawn(args, sm);
            case 'light': return this.placeLight(args, sm);
            case 'list': return this.listEntities();
            case 'undo': return this.undo();
            case 'clear': return this.clear();
            case 'export': return this.export();
            case 'exit': return this.exitBuildingMode(sm);
            case 'help':
                return "Usage: /build <subcommand> [args]\nSubcommands: wall, floor, ceiling, box, ramp, ground, door, window, perk, wallbuy, mysterybox, power, pap, zone, spawn, light, list, undo, clear, export\n\nBuilding mode controls:\n- Walk to move preview\n- Click entity to select (green)\n- Shoot to place entity\n- Knife to delete selected entity\n- /build exit to exit building mode";
            default:
                return `Unknown subcommand: ${subcommand}. Use: wall, floor, ceiling, box, ramp, ground, door, window, perk, wallbuy, mysterybox, power, pap, zone, spawn, light, list, undo, clear, export, exit`;
        }
    }
}

export const mapBuilder = new MapBuilderSystem();
