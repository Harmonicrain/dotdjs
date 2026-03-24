import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

function createIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

function rotateVec3(v, q) {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

const io = createIO();

// 180° around Y to flip barrel from right to left
console.log(`Flipping barrel direction with 180° Y rotation`);

const garandPath = path.resolve(ROOT, 'public/models/m1_garand.glb');
const garandDoc = await io.read(garandPath);
const garandRoot = garandDoc.getRoot();

const rot = [0, 1, 0, 0]; // 180° around Y (applying again undoes it)
for (const mesh of garandRoot.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const attr of ['POSITION', 'NORMAL']) {
      const acc = prim.getAttribute(attr);
      if (!acc) continue;
      const arr = acc.getArray();
      for (let i = 0; i < arr.length; i += 3) {
        const r = rotateVec3([arr[i], arr[i+1], arr[i+2]], rot);
        arr[i] = r[0]; arr[i+1] = r[1]; arr[i+2] = r[2];
      }
      acc.setArray(arr);
    }
    const tanAcc = prim.getAttribute('TANGENT');
    if (tanAcc) {
      const arr = tanAcc.getArray();
      for (let i = 0; i < arr.length; i += 4) {
        const r = rotateVec3([arr[i], arr[i+1], arr[i+2]], rot);
        arr[i] = r[0]; arr[i+1] = r[1]; arr[i+2] = r[2];
      }
      tanAcc.setArray(arr);
    }
  }
}
for (const node of garandRoot.listNodes()) {
  const t = node.getTranslation();
  if (t[0] !== 0 || t[1] !== 0 || t[2] !== 0) {
    const rt = rotateVec3(t, rot);
    node.setTranslation(rt);
  }
}

await io.write(garandPath, garandDoc);
console.log('M1 Garand reverted to barrel-left orientation.');
