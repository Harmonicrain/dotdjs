# LLM Friendliness

Changes that would make it easier for AI coding assistants (Claude, Gemini, Copilot) to correctly implement features in this codebase. LLMs learn patterns from the code they read — inconsistencies and implicit contracts cause incorrect code generation.

---

## 1. Zombie entity type is a god-object

**File:** `types/entities.ts` ~lines 29-109

The `Zombie` type has ~80 fields covering regular zombies, crawlers, and hellhounds. Hellhound-specific fields (`hellhoundState`, hellhound attack properties) are scattered throughout rather than grouped. An LLM asked to "add a new zombie type" will struggle to know which fields apply.

**Suggestion:** Group fields with section comments:
```ts
// --- Core (all zombie types) ---
id: string;
mesh: AbstractMesh;
health: number;
// ...

// --- Hellhound-specific ---
hellhoundState?: HellhoundState;
// ...

// --- Crawler-specific ---
isCrawling?: boolean;
// ...
```

Or better: use a discriminated union on `type`:
```ts
type Enemy = ZombieEntity | HellhoundEntity | CrawlerEntity;
```

---

## 2. No "canonical example" system for LLMs to copy

When an LLM needs to create a new system, it picks one to copy from. Currently:
- `PowerUpSystem` has good `lastTickTime` compensation
- `RoundSystem` has good authority checks
- `PackAPunchSystem` is event-driven (no update)
- `WeaponViewSystem` has minimal guards

No single system demonstrates ALL required patterns. An LLM copying any one system will miss patterns from others.

**Suggestion:** Create a `_SystemTemplate.ts` in `systems/` (not registered) that shows:
```ts
export const createTemplateSystem = (ctx: ITemplateContext): System => {
    let lastTickTime = 0;
    const handlers: Array<() => void> = [];

    return {
        name: 'template',
        init: () => {
            const handler = (data: SomeEvent) => { /* ... */ };
            ctx.eventBus.on('SOME_EVENT', handler);
            handlers.push(() => ctx.eventBus.off('SOME_EVENT', handler));
        },
        update: (dt: number, now: number) => {
            // PAUSE GUARD (see AGENTS.md 5a — pick correct variant)
            if (!ctx.gameState.hasStarted || ctx.gameState.isPaused) return;

            // AUTHORITY CHECK (if host-only logic)
            if (ctx.gameMode === 'CLIENT') return;

            // LASTTICTIME COMPENSATION (if using timers)
            if (lastTickTime !== 0 && now - lastTickTime > 150) {
                const pauseDuration = now - lastTickTime;
                // shift timestamps forward
            }
            lastTickTime = now;

            // ... system logic
        },
        dispose: () => {
            handlers.forEach(h => h());
        }
    };
};
```

---

## 3. Implicit contracts not encoded in types

Several contracts exist only in AGENTS.md prose:
- "Engine code must never import React" — no ESLint rule enforces this
- "Use UIBridge, not Zustand directly" — no TypeScript constraint prevents direct Zustand writes
- "Use releaseZombieMesh, not mesh.dispose()" — nothing prevents calling dispose()

LLMs can't read ESLint configs or AGENTS.md during code generation (unless explicitly provided). These contracts should ideally be encoded:

**Suggestions:**
- Add `// @ts-expect-error NEVER import React in engine code` comments where violations would be tempting
- Consider wrapper types that hide `.dispose()` on pooled meshes
- Add eslint-plugin-import rules to restrict React imports from engine/systems/state dirs

---

## 4. Config access patterns are inconsistent

LLMs see three ways to access config:
1. Direct import: `import { GAME_CONFIG } from '../config/gameplay'`
2. MapConfigManager: `ctx.configManager.gameplay`
3. Inline constants: `const SPEED = 0.035`

AGENTS.md says "always use MapConfigManager" but many files import directly. An LLM will copy whatever pattern it sees first.

**Fix:** Add deprecation comments to direct imports that should go through MapConfigManager:
```ts
/** @deprecated Use configManager.gameplay instead for map-override support */
export const GAME_CONFIG = { ... };
```

Or restructure so direct imports are only used at the config-merge layer.

---

## 5. State mutation paths are not obvious

An LLM asked "how do I update the player's health?" could reasonably try:
1. `ctx.gameState.health = 50` (direct mutation — sometimes correct in engine)
2. `stateManager.setHealth(50)` (StateManager method)
3. `useGameStore.getState().updatePlayer({ health: 50 })` (direct Zustand — wrong)
4. `uiBridge.setHealth(50)` (UIBridge — wrong for engine code)

The correct answer depends on context (engine vs UI), but there's no quick-reference for this.

**Suggestion:** Add a comment block in `StateManager.ts`:
```ts
/**
 * STATE MUTATION GUIDE:
 * - Engine/system code: mutate `this.gameState.xxx` directly for engine state
 * - To update UI: call `this.setXxx()` methods (routes through UIBridge)
 * - React components: NEVER mutate — read via useGameStore selectors
 * - Debug commands: use StateManager methods, not direct gameState mutation
 */
```

---

## 6. EventBus event types lack payload documentation

**File:** `engine/EventBus.ts`

The `GameEvents` interface defines event names and payload types, but the payloads are just type signatures without JSDoc. An LLM emitting an event doesn't know:
- When to emit it (which system is responsible?)
- What the receiver does with the payload
- Whether the event is host-only or fires on all peers

**Suggestion:** Add JSDoc to each event:
```ts
interface GameEvents {
    /** Fired by ZombieDamageSystem when a zombie's health reaches 0.
     *  Consumed by: PowerUpManager (drop roll), RoundSystem (kill count), ZombieCleanupSystem.
     *  Authority: HOST only. */
    ZOMBIE_DEATH: { id: string; position: Vector3 };
}
```

---

## 7. ParticleManager scalar decomposition is a trap

**File:** `managers/visual/ParticleManager.ts` ~lines 87-89

The explosion queue stores `x, y, z` as separate numbers instead of `Vector3` objects. The comment doesn't fully explain that this is because Babylon.js can mutate/recycle `mesh.position` vectors when meshes are pooled.

An LLM refactoring this to use `Vector3` objects (which seems cleaner) would reintroduce the stale-reference bug.

**Fix:** Add a prominent warning comment:
```ts
// WARNING: Do NOT refactor to Vector3 objects. Babylon.js mesh pooling
// can mutate/recycle position vectors after mesh release. Scalar
// decomposition captures the value at queue time, not the reference.
```

---

## 8. Interaction handler registration is implicit

**File:** `systems/InteractionSystem.ts`

New interaction handlers must be registered in InteractionSystem, but the registration is done in the constructor with no obvious list. An LLM adding a new handler type will create the handler file but forget to register it.

**Suggestion:** Add a comment listing all registered handlers:
```ts
// REGISTERED HANDLERS (add new handlers here):
// - DoorHandler
// - WindowHandler
// - WallBuyHandler
// - PerkHandler
// - MysteryBoxHandler
// - PackAPunchHandler
// - PowerHandler
// - SpawnHoleLidHandler
```

---

## 9. Map definition structure is large and easy to get wrong

**File:** `types/world.ts` — `MapDefinition` type

The type is deeply nested (zones with spawn points, interactables with sub-types, geometry arrays). An LLM creating a new map will almost certainly miss required fields or nest things incorrectly.

**Suggestion:** The `maps/_template/` directory helps, but adding a runtime validator that gives clear error messages for missing/wrong fields would catch LLM mistakes at dev time. The `validateMapDefinition.ts` file exists — ensure it covers all required fields with descriptive errors.
