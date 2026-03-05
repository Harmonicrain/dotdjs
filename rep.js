const fs = require("fs");
let content = fs.readFileSync("c:/dotdjs/engine/LevelBuilder.ts", "utf8");
const oldStr = `            let mat = baseMat;
            
            if (g.uvScale && baseMat instanceof BABYLON.StandardMaterial) {
                const clonedMat = baseMat.clone(\`ground_${idx}_mat\`) as BABYLON.StandardMaterial;
                if (clonedMat.diffuseTexture) {
                    const clonedTex = clonedMat.diffuseTexture.clone() as BABYLON.Texture;
                    clonedTex.uScale = g.uvScale[0];
                    clonedTex.vScale = g.uvScale[1];
                    clonedMat.diffuseTexture = clonedTex;
                }
                mat = clonedMat;
            }
            
            const ground = BABYLON.MeshBuilder.CreateGround(\`ground_${idx}\`, { width: g.width, height: g.height }, this.scene);
            ground.position = new BABYLON.Vector3(g.pos[0], g.pos[1], g.pos[2]);
            ground.material = mat;`;

const newStr = `            const ground = BABYLON.MeshBuilder.CreateGround(\`ground_${idx}\`, { width: g.width, height: g.height }, this.scene);
            ground.position = new BABYLON.Vector3(g.pos[0], g.pos[1], g.pos[2]);
            ground.material = baseMat;
            
            if (g.uvScale) {
                const uvs = ground.getVerticesData(BABYLON.VertexBuffer.UVKind);
                if (uvs) {
                    let baseUScale = 1;
                    let baseVScale = 1;
                    
                    if (baseMat instanceof BABYLON.StandardMaterial && baseMat.diffuseTexture instanceof BABYLON.Texture) {
                        baseUScale = baseMat.diffuseTexture.uScale || 1;
                        baseVScale = baseMat.diffuseTexture.vScale || 1;
                    } else if (baseMat instanceof BABYLON.PBRMaterial && baseMat.albedoTexture instanceof BABYLON.Texture) {
                        baseUScale = baseMat.albedoTexture.uScale || 1;
                        baseVScale = baseMat.albedoTexture.vScale || 1;
                    }

                    for (let i = 0; i < uvs.length; i += 2) {
                        uvs[i] *= g.uvScale[0] / baseUScale;
                        uvs[i + 1] *= g.uvScale[1] / baseVScale;
                    }
                    ground.updateVerticesData(BABYLON.VertexBuffer.UVKind, uvs);
                }
            }`;

const fixedOldStr = oldStr.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
content = content.replace(fixedOldStr, newStr);

fs.writeFileSync("c:/dotdjs/engine/LevelBuilder.ts", content);
console.log("Replaced!");
