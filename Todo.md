# README.md Inaccuracies

The following issues were found by comparing README.md against the current codebase.

---

## 1. Wrong map name for `map_test`
- **README says**: `MAP TEST`
- **Actual** (`maps/mapTest/mapDefinition.ts`): `"Test Arena"`

---

## 2. Config/weapons structure comment is wrong
- **README says**: `# Individual weapon configs (pistol, shotgun, rifle, wonderweapons)`
- **Actual files**: `pistol.ts`, `shotgun.ts`, `fullauto.ts`, `semiauto.ts`, `wonderweapons.ts`
- There is no `rifle.ts` — the rifle configs are split into `fullauto.ts` and `semiauto.ts`.

---

## 3. `ui/index.tsx` listed in project structure but does not exist
- **README says**: `└── index.tsx         # UI entry point` under `ui/`
- **Actual `ui/` contents**: `GameMenuManager.tsx`, `GameMenus.tsx`, `GameScene.tsx`, `HUD.tsx`, `components/`

---

## 4. `state/RemotePlayerState.ts` missing from project structure
- **README omits** `RemotePlayerState.ts` from the `state/` section
- **Actual `state/` contents**: `RemotePlayerState.ts`, `StateManager.ts`, `UIBridge.ts`

---

## 5. `/build` debug command listed but not functional
- **README lists**: `/build [args]  — Enter map building mode`
- **Actual**: `MapBuilder.ts` exists but is never imported or registered in `CommandRegistry.ts`. The command is not routed anywhere and returns "Unknown command: build." `/build` is also absent from the `/help` output.

---

## 6. Author section has wrong project name (typo)
- **README says**: `"DOM OF THE ROAD" was architected and written by Artificial Intelligence.`
- **Should be**: `"DOM OF THE DEAD"`
