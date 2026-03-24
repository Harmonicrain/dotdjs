import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const WEAPONS = [
  { file: 'm1911.glb',   scale: 0.0002 },
  { file: 'stg44.glb',   scale: 0.3 },
  { file: 'shotgun.glb',  scale: 0.3 },
  { file: 'famas.glb',   scale: 0.3 },
  { file: 'ray_gun.glb', scale: 0.3615 },
  { file: 'm1_garand.glb', scale: 0.012 },
];

const DIRS = ['public/models', 'dist/models'];

async function rescale(glbPath, scaleFactor) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(glbPath);
  const root = document.getRoot();

  // Scale all mesh vertex positions
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const posAccessor = prim.getAttribute('POSITION');
      if (!posAccessor) continue;

      const posArray = posAccessor.getArray();
      for (let i = 0; i < posArray.length; i++) {
        posArray[i] *= scaleFactor;
      }
      // Update min/max bounds
      posAccessor.setArray(posArray);

      // Scale morph target position deltas too
      for (const target of prim.listTargets()) {
        const targetPos = target.getAttribute('POSITION');
        if (!targetPos) continue;
        const targetArray = targetPos.getArray();
        for (let i = 0; i < targetArray.length; i++) {
          targetArray[i] *= scaleFactor;
        }
        targetPos.setArray(targetArray);
      }
    }
  }

  // Scale all node translations and reset any existing node scales
  for (const node of root.listNodes()) {
    const t = node.getTranslation();
    node.setTranslation([
      t[0] * scaleFactor,
      t[1] * scaleFactor,
      t[2] * scaleFactor,
    ]);
  }

  // Scale animation translation channels
  for (const anim of root.listAnimations()) {
    for (const channel of anim.listChannels()) {
      if (channel.getTargetPath() === 'translation') {
        const sampler = channel.getSampler();
        if (!sampler) continue;
        const output = sampler.getOutput();
        if (!output) continue;
        const arr = output.getArray();
        for (let i = 0; i < arr.length; i++) {
          arr[i] *= scaleFactor;
        }
        output.setArray(arr);
      }
    }
  }

  // Scale skin inverse bind matrices (translation components)
  for (const skin of root.listSkins()) {
    const ibmAccessor = skin.getInverseBindMatrices();
    if (!ibmAccessor) continue;
    const ibmArray = ibmAccessor.getArray();
    // Each matrix is 16 floats (4x4 column-major)
    // Translation is at indices 12, 13, 14 of each matrix
    for (let m = 0; m < ibmArray.length / 16; m++) {
      const base = m * 16;
      ibmArray[base + 12] *= scaleFactor;
      ibmArray[base + 13] *= scaleFactor;
      ibmArray[base + 14] *= scaleFactor;
    }
    ibmAccessor.setArray(ibmArray);
  }

  await io.write(glbPath, document);
}

for (const weapon of WEAPONS) {
  for (const dir of DIRS) {
    const fullPath = path.resolve(ROOT, dir, weapon.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`SKIP: ${fullPath} not found`);
      continue;
    }
    console.log(`Rescaling ${path.relative(ROOT, fullPath)} by ${weapon.scale}...`);
    await rescale(fullPath, weapon.scale);
    console.log(`  Done.`);
  }
}

console.log('\nAll weapons rescaled successfully.');
