# Type Safety Issues

> Loose typing (`any`, unnecessary `unknown`, missing type narrowing) that defeats TypeScript's strict mode and makes it easy for LLMs to introduce type errors silently.

---

## Critical: `any` usage that enables silent bugs

### `engine/EventBus.ts` ~line 33
```typescript
Map<keyof GameEvents, Handler<any>[]>
```
**Problem**: The handler map stores `any`-typed handlers, so subscribing with the wrong payload type compiles fine but fails at runtime.
**Fix**: Use a properly generic `get`/`set` accessor pattern or accept the trade-off with a comment explaining why.

### `network/NetworkMessageHandler.ts` ~lines 24, 54
```typescript
[key: string]: any;  // in CachedHostState and CachedClientState
```
**Problem**: These index signatures allow any property to be read/written without type checking. A typo like `cachedHost.heatlh` silently returns `undefined`.
**Fix**: Remove the index signature. Define all fields explicitly. If extensibility is needed, use a separate `extras: Record<string, unknown>` field.

### `network/NetworkMessageHandler.ts` ~line 245
```typescript
const perkMsg = msg as any;
```
**Problem**: Casts away all type safety for the perk message. If the message shape changes, no compile error.
**Fix**: Define a `PerkSyncMessage` type and use a type guard or discriminated union.

### `network/network.ts` (types) ~lines 18, 29-30
```typescript
(...args: any[])
```
**Problem**: Event handler signatures are fully permissive.
**Fix**: Use the `GameEvents` interface to derive handler types.

---

## High: Loose `any` in world/entity types

### `types/world.ts`
| Line | Field | Current Type | Suggested Type |
|------|-------|-------------|----------------|
| 26 | `InteractableMetadata.data` | `any` | Discriminated union by `type` field |
| 248 | `DebugInfo.metadata` | `any` | `Record<string, string \| number \| boolean>` |
| 259 | `DoorMeshEntry.obstacle` | `any` | Recast obstacle handle type or `unknown` with guards |
| 310 | `MapDefinition.navmeshParameters` | `any` | `INavMeshParameters` from Recast |

### `engine/LevelBuilder.ts` ~line 48
```typescript
Promise<any>[]
```
**Fix**: `Promise<BABYLON.AssetContainer>[]` or `Promise<void>[]` depending on actual return.

### `game/Game.ts` ~line 78
```typescript
...args: any[]
```
**Fix**: Type the args based on what `console.warn` accepts: `...args: unknown[]`.

---

## Medium: Missing type narrowing

### `types/entities.ts` — Zombie `type` field
The `type` field is `'ZOMBIE' | 'HELLHOUND'` but many systems check it with string comparison instead of using a type guard. A shared `isHellhound(z: Zombie)` guard would prevent typo bugs and help LLMs pattern-match.

### `types/player.ts` — WeaponConfig `automatic` field
The `automatic` property controls fire mode but the name is ambiguous. An LLM seeing `automatic: true` doesn't know if this means "automatic fire" or "automatically equipped". The JSDoc added in commit `50274f5` helps, but a union type like `fireMode: 'auto' | 'semi'` would be self-documenting.

### `network/useMultiplayer.ts` ~line 75
```typescript
data: unknown
```
**Improvement**: Use a discriminated union `NetworkMessage` type with a `type` field, then narrow in the handler.

---

## Low: Config type documentation gaps

### `config/gameplay.ts` — Missing units in numeric fields
| Field | Value | Unit? |
|-------|-------|-------|
| `BLOOD_NORMAL_OFFSET` | `0.02` | meters? UV units? |
| `BLOOD_FADE_SPEED` | `0.02` | per frame? per second? |
| `DAMAGE_IMMUNITY_MS` | `500` | clearly ms (good) |

**Fix**: Add JSDoc with units on every numeric config field, or adopt a naming convention like `_MS`, `_SEC`, `_METERS`.

### Weapon upgrade scaling — no documented formula
STG-44 upgrade: damage 25->50 (2x), clip 30->60 (2x)
FAMAS upgrade: damage 30->55 (1.8x), clip 30->45 (1.5x)
No consistent multiplier. This isn't a bug, but LLMs creating new weapons will guess wrong.
**Fix**: Add a comment block in `config/weapons/index.ts` documenting the design philosophy for upgrade scaling.

---

## Refactoring Strategy

1. **Phase 1**: Remove `[key: string]: any` from `CachedHostState`/`CachedClientState` — highest impact
2. **Phase 2**: Type `InteractableMetadata.data` as discriminated union
3. **Phase 3**: Replace `as any` casts with proper type guards
4. **Phase 4**: Add unit suffixes to config field names or JSDoc
