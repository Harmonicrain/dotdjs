# Dead Code & Unused Exports

Code that is unused, unreachable, or serving no purpose. Removing it reduces noise for LLMs and humans alike.

---

## 1. ZombieDamageSystem.ts — Empty dispose()

**File**: `systems/zombie/ZombieDamageSystem.ts` ~lines 70-71
```typescript
dispose: () => {
},
```
Empty function body. Either remove `dispose` entirely (it's optional on the System interface) or add a comment explaining why it's intentionally empty if needed for future use.

---

## 2. Duplicate `BuildingDefinition` Interface

**File 1**: `types/world.ts` ~lines 262-271
**File 2**: `factories/BuildingFactory.ts` ~lines 3-12
**Issue**: Identical interface defined in both places. The factory's copy is never imported by anything else — it's a stale duplicate.
**Fix**: Delete the definition from `BuildingFactory.ts` and import from `types/world.ts`.

---

## 3. Duplicate `WeaponUpgrade` Type

**File 1**: `types/player.ts` ~line 33
**File 2**: `config/weapons/types.ts` ~line 3
**Issue**: Both define `WeaponUpgrade = Partial<WeaponConfig> & { name: string }`. Different parts of the codebase import from different locations.
**Fix**: Keep one canonical definition (probably `types/player.ts`) and have `config/weapons/types.ts` re-export it, or consolidate to a single source.

---

## 4. Unused `MapGameplay` Interface

**File**: `types/index.ts` ~lines 9-12
```typescript
export interface MapGameplay {
  perkCosts?: Record<string, number>;
  packAPunchCost?: number;
}
```
Never imported or used anywhere. The actual per-map config uses `MapConfiguration` from `maps/types.ts`.
**Fix**: Delete it.

---

## 5. HitMarker.tsx — Demo/Placeholder Logic

**File**: `ui/components/HitMarker.tsx` ~lines 13-34
**Issue**: Comment says `"simplified - in real implementation would use event bus"` and uses `Math.random() > 0.7` for headshot detection. This is demo code in production.
**Fix**: Either connect to actual event bus data or document clearly that this is intentionally randomized for the current implementation stage.

---

## 6. KillFeed.tsx — Random Kill Generation

**File**: `ui/components/KillFeed.tsx` ~lines 24-43
**Issue**: Comment says `"Random for demo"` — generates random headshot status with `Math.random() > 0.6`. Production code using demo placeholders.
**Fix**: Same as HitMarker — connect to real data or clearly document intent.

---

## 7. Unused `PowerUpManager.windows` Property

**File**: `managers/PowerUpManager.ts`
**Issue**: `windows` property is set in constructor (~line 28) but never referenced by any method in the class.
**Fix**: Remove the property if not needed.

---

## 8. NetworkDeltaCompressor — Unexported-Only Types

**File**: `network/NetworkDeltaCompressor.ts` ~lines 23-68
**Issue**: `MysteryBoxSnapshot`, `HostSnapshot`, `ClientSnapshot` types are exported but only used internally within this file.
**Fix**: Remove `export` keyword — keep them as file-local types.

---

## Priority

Items 2-4 are the most impactful — duplicate type definitions are a major source of LLM confusion because the AI doesn't know which one is canonical and may import from the wrong location or create yet another duplicate.
