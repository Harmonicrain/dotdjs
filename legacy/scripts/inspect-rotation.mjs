import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

await MeshoptDecoder.ready;

async function inspect(glbPath) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const document = await io.read(glbPath);
  const root = document.getRoot();

  console.log(`\n=== ${path.relative(ROOT, glbPath)} ===`);

  // Show scene structure
  for (const scene of root.listScenes()) {
    console.log(`  Scene: "${scene.getName()}"`);
    for (const child of scene.listChildren()) {
      printNode(child, 2);
    }
  }

  console.log(`\n  All nodes (flat):`);
  for (const node of root.listNodes()) {
    const parent = node.getParentNode();
    console.log(`  Node: "${node.getName()}" (parent: "${parent?.getName() ?? 'SCENE ROOT'}")`);
    console.log(`    Rotation:    [${node.getRotation().join(', ')}]`);
    console.log(`    Translation: [${node.getTranslation().join(', ')}]`);
    console.log(`    Scale:       [${node.getScale().join(', ')}]`);
    console.log(`    Has mesh:    ${!!node.getMesh()}`);
  }
}

function printNode(node, depth) {
  const indent = '  '.repeat(depth);
  console.log(`${indent}-> "${node.getName()}" (mesh: ${!!node.getMesh()})`);
  for (const child of node.listChildren()) {
    printNode(child, depth + 1);
  }
}

await inspect(path.resolve(ROOT, 'public/models/m1911.glb'));
await inspect(path.resolve(ROOT, 'public/models/m1_garand.glb'));
