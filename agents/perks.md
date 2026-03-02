# PERK SYSTEM GUIDE

This document serves as a reference for LLM agents to quickly understand, modify, or extend the perk machine system in DOM OF THE ROAD.

---

## 1. Core Architecture
The perk system follows an **Interactable** pattern:
1.  **Map Definition**: Perks are placed in the map's JSON/Config.
2.  **Factory**: A 3D model and invisible **Trigger Mesh** are created.
3.  **Metadata**: The Trigger Mesh is assigned metadata (ID, Type, Cost).
4.  **Interaction**: When a player looks at/interacts with the Trigger, `PerkHandler.ts` is executed.
5.  **State**: Purchased perks are stored in `gameState.perkStates` and synced across the network. See [multiplayer.md](./multiplayer.md) for sync details.

---

## 2. Key File Locations

| File | Purpose |
|------|---------|
| `C:\ZOMBZ\types\world.ts` | `PerkDefinition` interface and `type` union. |
| `C:\ZOMBZ\config\gameplay.ts` | Default costs and effect values. |
| `C:\ZOMBZ\meshes\perks/` | Factory files (e.g., `JuggernogFactory.ts`) for 3D models. |
| `C:\ZOMBZ\engine\LevelBuilder.ts` | Logic that calls factories and assigns **Metadata** to triggers. |
| `C:\ZOMBZ\systems\interaction\handlers\PerkHandler.ts` | Logic for buying, deducting points, and applying stats. |
| `C:\ZOMBZ\ui\components\PlayerStatus.tsx` | React component for HUD perk icons. |
| `C:\ZOMBZ\state\StateManager.ts` | `setPerks()` and `getPerkState()` helpers. |

---

## 3. Default Perk Costs

| Perk Type | Default Cost | Gameplay Config Variable |
|-----------|--------------|--------------------------|
| **Juggernog** | 2000 | `JUGGERNOG_COST` |
| **Speed Cola** | 3000 | `SPEED_COLA_COST` |
| **Quick Revive** | 1500 | `QUICK_REVIVE_COST` |

---

## 4. How to Add a New Perk (e.g., "Stamin-Up")

### Step 1: Define the Type
Add your perk string to the `PerkDefinition` type in `C:\ZOMBZ\types\world.ts`.
```typescript
export interface PerkDefinition {
    type: 'juggernog' | 'speed_cola' | 'quick_revive' | 'stamin_up'; // Added here
    // ...
}
```

### Step 2: Set Default Cost
Add a cost constant to `GAME_CONFIG` in `C:\ZOMBZ\config\gameplay.ts`.

### Step 3: Create the Factory
Create `C:\ZOMBZ\meshes\perks\StaminUpFactory.ts`. Use `JuggernogFactory.ts` as a template.
**CRITICAL**: Ensure the trigger mesh name includes the word "Trigger" (e.g., `staminUpTrigger`).

### Step 4: Register in LevelBuilder
Update `C:\ZOMBZ\engine\LevelBuilder.ts` to call your new factory.
```typescript
// Inside the perks loop
if (p.type === 'juggernog') {
    // ...
} else if (p.type === 'stamin_up') {
    machine = createStaminUp(this.scene, this.shadowCasters, pos, p.rotation || 0);
}
```

### Step 5: Implement the Logic
Modify `C:\ZOMBZ\systems\interaction\handlers\PerkHandler.ts`.
1.  Add the default cost to `perkCostDefaults`.
2.  Add any immediate effect (like increasing health for Juggernog) inside the `interact` function.
3.  If the perk affects movement/reload/combat, check `stateManager.gameState.perkStates['staminUp']` in those respective systems.

### Step 6: Add HUD Icon
Update `C:\ZOMBZ\ui\components\PlayerStatus.tsx`.
```typescript
{perks['staminUp'] && <div className="bg-orange-500..." title="Stamin-Up"></div>}
```

---

## 5. The "Never Forget" Checklist (FAIL-SAFE)

1.  **Trigger Metadata**: If you create a new perk machine, you **MUST** ensure the `LevelBuilder` assigns metadata to the trigger mesh. Without `t.metadata = { type: 'PERK', ... }`, the interaction prompt will never appear.
2.  **UI Sync**: After setting a perk state in `PerkHandler.ts`, you **MUST** call `stateManager.setPerks(stateManager.gameState.perkStates)`. If you only modify the boolean, the HUD icon will not appear and the network will not sync.
3.  **Unique IDs**: When defining perks in a map file, ensure the `id` (e.g., `staminUp_1`) is unique if multiple machines exist. 
4.  **Solo vs Multiplayer**: Quick Revive has special logic for "Solo" (self-revive) vs "Multiplayer" (faster reviving). Always check `stateManager.gameModeRef.current === 'SOLO'` if your perk has mode-specific behavior.
5.  **Remote Sync**: In multiplayer, the remote player's perks are tracked via `sm.remote.gameState.perks`. Ensure any UI that shows teammates' status is aware of this.

---

## 6. WARNING: Quick Revive Complexity

Quick Revive is the most complex perk. It is handled by **3 separate systems**:
1.  **`PerkHandler.ts`**: Handles the initial purchase and decrements `quickRevivesRemaining` in Solo.
2.  **`DownedSystem.ts`**: Triggers the **Self-Revive** sequence in Solo mode if the perk is active.
3.  **`ReviveSystem.ts`**: Modifies the **Revive Time** required for teammates in Multiplayer mode.

---

## 7. Implementation Tips
- **Stat Overrides**: If a perk modifies a player stat (like `maxHealth`), ensure you also update `stateManager.gameState.health` and call `stateManager.setHealth()` so the UI updates immediately.
- **Model Scaling**: Use `C:\ZOMBZ\config\modelTransforms.ts` to handle model offsets and scaling rather than hardcoding them in the factory.
