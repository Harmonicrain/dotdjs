import * as BABYLON from '@babylonjs/core';

let masterLid: BABYLON.TransformNode | null = null;

/**
 * Builds the master lid template used for cloning.
 */
export const preWarmLidTemplate = (scene: BABYLON.Scene, lidMat: BABYLON.Material, metalMat: BABYLON.Material) => {
    if (masterLid) return;

    const holeWidth = 1.4;
    const lidWidth = holeWidth + 0.05;
    
    masterLid = new BABYLON.TransformNode("MASTER_LID_TEMPLATE", scene);
    masterLid.setEnabled(false);

    // Main plate
    const baseLid = BABYLON.MeshBuilder.CreateBox("lid_base_template", { width: lidWidth, height: 0.06, depth: lidWidth }, scene);
    baseLid.material = lidMat;
    baseLid.isPickable = false;
    baseLid.receiveShadows = true;
    baseLid.parent = masterLid;

    // Cross reinforcement bars
    const barWidth = 0.12;
    const barHeight = 0.03;
    const bar1 = BABYLON.MeshBuilder.CreateBox("lid_bar1_template", { width: lidWidth, height: barHeight, depth: barWidth }, scene);
    bar1.position.y = 0.04;
    bar1.material = lidMat;
    bar1.parent = masterLid;

    const bar2 = BABYLON.MeshBuilder.CreateBox("lid_bar2_template", { width: barWidth, height: barHeight, depth: lidWidth }, scene);
    bar2.position.y = 0.04;
    bar2.material = lidMat;
    bar2.parent = masterLid;

    // Corner bolts
    const boltSize = 0.08;
    const boltOffset = (lidWidth / 2) - 0.12;
    const boltPositions = [[boltOffset, boltOffset], [boltOffset, -boltOffset], [-boltOffset, boltOffset], [-boltOffset, -boltOffset]];
    boltPositions.forEach((pos, idx) => {
        const bolt = BABYLON.MeshBuilder.CreateBox(`lid_bolt_${idx}_template`, { size: boltSize }, scene);
        bolt.position.set(pos[0], 0.04, pos[1]);
        bolt.material = metalMat; 
        bolt.parent = masterLid;
    });
};

/**
 * Creates a new lid mesh instance from the template.
 */
export const createLidMesh = (scene: BABYLON.Scene, name: string): BABYLON.TransformNode => {
    if (!masterLid) {
        throw new Error("Lid template not pre-warmed. Call preWarmLidTemplate first.");
    }

    const instance = masterLid.instantiateHierarchy() as BABYLON.TransformNode;
    instance.name = name;
    instance.setEnabled(true);
    return instance;
};
