const fs = require('fs');

let content = fs.readFileSync('engine/LevelBuilder.ts', 'utf8');

const buildGeometryReplacement = `    private buildGeometry(def: MapDefinition) {
        const groups: Record<string, { meshes: BABYLON.Mesh[], mat: BABYLON.Material, isWalkable: boolean }> = {};

        def.geometry.forEach((geo, idx) => {
            const matName = geo.material || geo.texture || (geo.type === 'wall' ? 'wall' : 'floor');
            const mat = this.materials.get(matName) || this.materials.get('wall')!;
            
            if (geo.type === 'box' || geo.type === 'wall' || geo.type === 'floor' || geo.type === 'ceiling') {
                const isWalkableSurface = geo.type === 'floor' || geo.type === 'box';
                const key = \`\${matName}_\${isWalkableSurface}\`;
                
                if (!groups[key]) {
                    groups[key] = { meshes: [], mat, isWalkable: isWalkableSurface };
                }

                const box = createTiledBox(
                    this.scene,
                    \`geo_\${idx}\`,
                    { w: geo.size[0], h: geo.size[1], d: geo.size[2] },
                    new BABYLON.Vector3(geo.pos[0], geo.pos[1], geo.pos[2]),
                    mat,
                    geo.uvScale || 1.0,
                    false, // Handle shadows post-merge
                    [],    // Temp array
                    []     // Temp array
                );
                
                if (geo.rotation) {
                    box.rotation = new BABYLON.Vector3(geo.rotation[0], geo.rotation[1], geo.rotation[2]);
                }
                
                box.computeWorldMatrix(true);
                groups[key].meshes.push(box as BABYLON.Mesh);
            }
        });

        Object.keys(groups).forEach(key => {
            const group = groups[key];
            if (group.meshes.length > 0) {
                if (group.meshes.length === 1) {
                    const mesh = group.meshes[0];
                    mesh.parent = this.root;
                    mesh.receiveShadows = true;
                    this.shadowCasters.push(mesh);
                    if (group.isWalkable) this.navMeshes.push(mesh);
                } else {
                    const merged = BABYLON.Mesh.MergeMeshes(group.meshes, true, true);
                    if (merged) {
                        merged.name = \`merged_geo_\${key}\`;
                        merged.parent = this.root;
                        merged.material = group.mat;
                        merged.checkCollisions = true;
                        merged.receiveShadows = true;
                        this.shadowCasters.push(merged);
                        if (group.isWalkable) this.navMeshes.push(merged);
                    }
                }
            }
        });
    }`;

const buildGroundsReplacement = `    private buildGrounds(def: MapDefinition) {
        if (!def.grounds) return;
        const hasNavFloors = def.navFloors && def.navFloors.length > 0;
        
        const groups: Record<string, { meshes: BABYLON.Mesh[], mat: BABYLON.Material }> = {};

        def.grounds.forEach((g, idx) => {
            const matName = g.texture || 'floor';
            const baseMat = this.materials.get(matName) || this.materials.get('floor')!;
            
            const ground = BABYLON.MeshBuilder.CreateGround(\`ground_\${idx}\`, { width: g.width, height: g.height }, this.scene);
            ground.position = new BABYLON.Vector3(g.pos[0], g.pos[1], g.pos[2]);
            
            if (g.uvScale) {
                const uvData = ground.getVerticesData(BABYLON.VertexBuffer.UVKind);
                if (uvData) {
                    for (let i = 0; i < uvData.length; i += 2) {
                        uvData[i] *= g.uvScale[0];
                        uvData[i + 1] *= g.uvScale[1];
                    }
                    ground.setVerticesData(BABYLON.VertexBuffer.UVKind, uvData);
                }
            }
            
            ground.computeWorldMatrix(true);

            if (!groups[matName]) {
                groups[matName] = { meshes: [], mat: baseMat };
            }
            groups[matName].meshes.push(ground);
        });

        Object.keys(groups).forEach(key => {
            const group = groups[key];
            if (group.meshes.length > 0) {
                if (group.meshes.length === 1) {
                    const mesh = group.meshes[0];
                    mesh.material = group.mat;
                    mesh.checkCollisions = true;
                    mesh.receiveShadows = true;
                    mesh.parent = this.root;
                    if (!hasNavFloors) this.navMeshes.push(mesh);
                } else {
                    const merged = BABYLON.Mesh.MergeMeshes(group.meshes, true, true);
                    if (merged) {
                        merged.name = \`merged_ground_\${key}\`;
                        merged.material = group.mat;
                        merged.checkCollisions = true;
                        merged.receiveShadows = true;
                        merged.parent = this.root;
                        if (!hasNavFloors) this.navMeshes.push(merged);
                    }
                }
            }
        });
    }`;

const buildNavFloorsReplacement = `    private buildNavFloors(def: MapDefinition) {
        if (!def.navFloors) return;
        
        const DEBUG_SHOW_NAVFLOORS = false;
        const colors = [
            new BABYLON.Color3(1, 0, 0),
            new BABYLON.Color3(1, 1, 0),
            new BABYLON.Color3(0, 1, 0),
            new BABYLON.Color3(0, 1, 1),
            new BABYLON.Color3(0, 0, 1),
            new BABYLON.Color3(1, 0, 1),
        ];
        
        const navFloorMeshes: BABYLON.Mesh[] = [];

        def.navFloors.forEach((g, idx) => {
            const ground = BABYLON.MeshBuilder.CreateGround(\`navfloor_\${idx}\`, { width: g.width, height: g.height }, this.scene);
            ground.position = new BABYLON.Vector3(g.pos[0], g.pos[1] + 0.05, g.pos[2]);
            
            if (DEBUG_SHOW_NAVFLOORS) {
                const mat = new BABYLON.StandardMaterial(\`navfloor_mat_\${idx}\`, this.scene);
                mat.diffuseColor = colors[idx % colors.length];
                mat.alpha = 0.3;
                mat.backFaceCulling = false;
                ground.material = mat;
                ground.visibility = 1;
            } else {
                ground.visibility = 0;
            }
            
            ground.computeWorldMatrix(true);
            navFloorMeshes.push(ground);
        });

        if (navFloorMeshes.length > 0) {
            if (navFloorMeshes.length === 1) {
                const mesh = navFloorMeshes[0];
                mesh.isPickable = false;
                mesh.checkCollisions = false;
                mesh.parent = this.root;
                this.navMeshes.push(mesh);
            } else {
                if (!DEBUG_SHOW_NAVFLOORS) {
                    const merged = BABYLON.Mesh.MergeMeshes(navFloorMeshes, true, true);
                    if (merged) {
                        merged.name = "merged_navfloors";
                        merged.visibility = 0;
                        merged.isPickable = false;
                        merged.checkCollisions = false;
                        merged.parent = this.root;
                        this.navMeshes.push(merged);
                    }
                } else {
                    navFloorMeshes.forEach(mesh => {
                        mesh.isPickable = false;
                        mesh.checkCollisions = false;
                        mesh.parent = this.root;
                        this.navMeshes.push(mesh);
                    });
                }
            }
        }
    }`;

function replaceMethod(source, methodName, replacement) {
    const startIdx = source.indexOf(\`private \${methodName}(def: MapDefinition) {\`);
    if (startIdx === -1) {
        console.error('Could not find ' + methodName);
        return source;
    }
    
    // Find matching brace
    let openBraces = 0;
    let endIdx = -1;
    let started = false;
    for (let i = startIdx; i < source.length; i++) {
        if (source[i] === '{') {
            openBraces++;
            started = true;
        } else if (source[i] === '}') {
            openBraces--;
            if (started && openBraces === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }
    
    if (endIdx === -1) {
        console.error('Could not find end of ' + methodName);
        return source;
    }
    
    // Maintain exact same newlines style
    const isCRLF = source.includes('\\r\\n');
    let finalReplacement = replacement;
    if (isCRLF) {
        finalReplacement = finalReplacement.replace(/\\n/g, '\\r\\n');
    } else {
    	finalReplacement = finalReplacement.replace(/\\r\\n/g, '\\n');
    }
    
    return source.substring(0, startIdx) + finalReplacement + source.substring(endIdx);
}

content = replaceMethod(content, 'buildGeometry', buildGeometryReplacement);
content = replaceMethod(content, 'buildGrounds', buildGroundsReplacement);
content = replaceMethod(content, 'buildNavFloors', buildNavFloorsReplacement);

fs.writeFileSync('engine/LevelBuilder.ts', content);
console.log('Successfully updated LevelBuilder.ts');
