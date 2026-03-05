const fs = require('fs');

let content = fs.readFileSync('systems/ZombieAISystem.ts', 'utf8');

// 1. Initialize _tempMoveResult in the main loop
content = content.replace(
    "            for (const z of zombies) {\n                if (z.isDead) continue;\n\n                // Burning damage",
    "            for (const z of zombies) {\n                if (z.isDead) continue;\n\n                _tempMoveResult.set(0, 0, 0);\n\n                // Burning damage"
);

// 2. updateHellhoundAI: Spawning state
content = content.replace(
    "            _tempGravity.set(0, gc.GRAVITY * 3 * frameFactor, 0);\n            z.mesh.moveWithCollisions(_tempGravity);\n            return;",
    "            _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;\n            z.mesh.moveWithCollisions(_tempMoveResult);\n            return;"
);

// 3. updateHellhoundAI: Chasing state moveWithCollisions removal
content = content.replace(
    "                    _tempMoveResult.scaleInPlace(z.speed * frameFactor);\n                    z.mesh.moveWithCollisions(_tempMoveResult);",
    "                    _tempMoveResult.scaleInPlace(z.speed * frameFactor);"
);

// 4. updateHellhoundAI: Attacking state moveWithCollisions removal
content = content.replace(
    "                _tempMoveResult.scaleInPlace(z.speed * hc.LUNGE_SPEED_MULTIPLIER * frameFactor);\n                z.mesh.moveWithCollisions(_tempMoveResult);",
    "                _tempMoveResult.scaleInPlace(z.speed * hc.LUNGE_SPEED_MULTIPLIER * frameFactor);"
);

// 5. updateHellhoundAI: Recovery state moveWithCollisions removal
content = content.replace(
    "                    _tempMoveResult.scaleInPlace(z.speed * frameFactor);\n                    z.mesh.moveWithCollisions(_tempMoveResult);",
    "                    _tempMoveResult.scaleInPlace(z.speed * frameFactor);"
);

// 6. updateHellhoundAI: End gravity merging
content = content.replace(
    "        _tempGravity.set(0, gc.GRAVITY * 3 * frameFactor, 0);\n        z.mesh.moveWithCollisions(_tempGravity);",
    "        _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;\n        z.mesh.moveWithCollisions(_tempMoveResult);"
);

// 7. updateSoloDownedWander: Merge physics
content = content.replace(
    "        _tempMoveResult.scaleInPlace(z.speed * frameFactor);\n        z.mesh.moveWithCollisions(_tempMoveResult);\n        _tempGravity.set(0, gc.GRAVITY * 3 * frameFactor, 0);\n        z.mesh.moveWithCollisions(_tempGravity);",
    "        _tempMoveResult.scaleInPlace(z.speed * frameFactor);\n        _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;\n        z.mesh.moveWithCollisions(_tempMoveResult);"
);

// 8. updateZombieChase: Remove moveWithCollisions
const chaseSearch = "                _tempMoveResult.scaleInPlace(z.speed * frameFactor);\n                z.mesh.moveWithCollisions(_tempMoveResult);";
const chaseReplace = "                _tempMoveResult.scaleInPlace(z.speed * frameFactor);";
content = content.replace(chaseSearch, chaseReplace);
// In case the above replace matches another occurrence, but we already removed them from Hellhound, let's just make sure.

// 9. updateWindowInteraction: Remove moveWithCollisions
const windowSearch = "            _tempMoveResult.scaleInPlace(z.speed * frameFactor);\n            z.mesh.moveWithCollisions(_tempMoveResult);";
const windowReplace = "            _tempMoveResult.scaleInPlace(z.speed * frameFactor);";
content = content.replace(windowSearch, windowReplace);

// 10. Main loop gravity merge
content = content.replace(
    "                // Apply gravity (except when entering window)\n                if (z.state !== ZombieState.ENTERING) {\n                    _tempGravity.set(0, gc.GRAVITY * 3 * frameFactor, 0);\n                    z.mesh.moveWithCollisions(_tempGravity);\n                    if (z.mesh.position.y > 0 && z.mesh.position.y < 0.15) z.mesh.position.y = 0;\n                }",
    "                // Apply gravity (except when entering window)\n                if (z.state !== ZombieState.ENTERING) {\n                    _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;\n                    z.mesh.moveWithCollisions(_tempMoveResult);\n                    if (z.mesh.position.y > 0 && z.mesh.position.y < 0.15) z.mesh.position.y = 0;\n                }"
);

fs.writeFileSync('systems/ZombieAISystem.ts', content);
console.log('Successfully updated ZombieAISystem.ts');
