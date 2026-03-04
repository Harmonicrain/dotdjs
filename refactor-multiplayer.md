# Multiplayer Refactor - Issues & Required Fixes

## Architecture Overview

The game uses a **host-authoritative P2P model** over WebRTC (PeerJS). The HOST runs all game logic (zombie AI, spawning, damage, rounds) and broadcasts state at 20 Hz. The CLIENT sends input at 20 Hz and uses optimistic prediction for local interactions. Delta compression reduces bandwidth with full snapshots forced every 5 seconds.

**Key files:**
- `network/useMultiplayer.ts` - PeerJS connection management
- `network/NetworkMessageHandler.ts` - Packet processing & state merge
- `network/NetworkDeltaCompressor.ts` - Delta encoding
- `network/InterpolationBuffer.ts` - Remote player smoothing (100ms buffer)
- `systems/NetworkSystem.ts` - 20 Hz tick, STATE/INPUT serialization
- `state/StateManager.ts` - Authoritative state container
- `config/gameplay.ts` - `SYNC_CONFIG` parameters

---

## CRITICAL Issues

### 1. Client-Side Point Deduction Race Condition

**Severity:** CRITICAL
**Files:** `DoorHandler.ts`, `PerkHandler.ts`, `WallBuyHandler.ts`, `PackAPunchHandler.ts`, `MysteryBoxHandler.ts`

**Problem:** All interaction handlers deduct points immediately on the client before sending the request to the host. There is no rejection/confirmation mechanism.

```
DoorHandler.ts:18-20
  stateManager.gameState.points -= doorState.cost;   // IMMEDIATE local deduct
  stateManager.setPoints(stateManager.gameState.points);
  if (gameMode === 'CLIENT') stateManager.send({ type: 'INTERACT_DOOR', doorId });
```

**Failure scenarios:**
- **Double-spend:** Both players click the same door simultaneously. Both deduct points locally and send requests. HOST processes both but should only deduct once.
- **Desync:** CLIENT deducts points, HOST rejects (insufficient funds on host-tracked state), but no REJECT message exists. CLIENT points are now wrong until the next full sync (up to 5 seconds).
- **Stale state:** CLIENT sees 2500 points locally, but HOST has already processed a different purchase reducing them to 500. CLIENT buys a 2000-point perk that HOST can't validate.

**Fix:** Points should be HOST-authoritative. CLIENT sends interaction requests without deducting locally. HOST validates, deducts, and sends an ACK/REJECT event. CLIENT applies the point change only after confirmation.

---

### 2. No Zombie Health Synchronization

**Severity:** CRITICAL
**Files:** `NetworkSystem.ts:116-128`, `NetworkMessageHandler.ts:311-330`

**Problem:** The HOST sends zombie **positions** (x, y, z, rot, isBurning) but **NOT health values**. The CLIENT has no idea how much health any zombie has.

```
NetworkSystem.ts:121-127 — zombie snapshot only includes:
  s.id, s.type, s.x, s.y, s.z, s.rot, s.isBurning
  // NO: s.health, s.maxHealth, s.isCrawling
```

**Consequences:**
- CLIENT shoots a zombie, sees a visual hit, but the zombie doesn't die until HOST processes it and removes it from the next STATE packet (~100ms+ delay).
- CLIENT has no hit feedback — can't tell if zombie is at 10% or 100% health.
- Zombie death appears delayed: HOST marks dead → next STATE broadcast (50ms) → CLIENT receives (50ms network) → remove from scene. Total ~100-150ms minimum.
- Crawler state (`isCrawling`) is not synced — CLIENT sees zombie walking normally when it should be crawling on HOST's screen.

**Fix:** Include `health`, `maxHealth`, and `isCrawling` in the zombie sync data. Consider sending a lightweight `ZOMBIE_HIT` event for immediate hit feedback.

---

### 3. Projectile Owner Attribution Bug

**Severity:** CRITICAL
**Files:** `ProjectileSystem.ts:171-178`

**Problem:** When HOST receives a REMOTE_SHOOT event from CLIENT, the spawned projectile is hardcoded with owner `'CLIENT'`. But when CLIENT receives a REMOTE_SHOOT from HOST, the projectile is also created with owner `'CLIENT'` — this is **wrong**.

```
ProjectileSystem.ts:178
  engine.spawnProjectile(
      rayOrigin, rayDir, COMBAT_CONFIG.PROJECTILE_SPEED,
      0, true, msg.isPacked || false,
      'CLIENT',          // ← HARDCODED, always 'CLIENT'
      msg.isExplosive || false, ...
  );
```

**Consequences:**
- On the HOST side: remote projectiles are correctly attributed to 'CLIENT', damage is sent via HIT_CONFIRM. This works.
- On the CLIENT side: remote projectiles from HOST are incorrectly attributed to 'CLIENT'. If CLIENT-side collision somehow processes these (shouldn't normally since CLIENT isn't authority), kill points could be misattributed.
- The owner should reflect the actual sender — HOST projectiles should be `'HOST'`, CLIENT projectiles should be `'CLIENT'`.

**Fix:** The SHOOT message should include an `owner` field. The receiver should use the sender's role, not a hardcoded string.

---

### 4. No HOST-Side Validation of Client Interactions

**Severity:** CRITICAL
**Files:** `NetworkMessageHandler.ts:195-223`

**Problem:** When HOST receives interaction requests from CLIENT, it blindly executes them without validating the CLIENT's ability to perform the action.

```
NetworkMessageHandler.ts:195-196
  case 'INTERACT_DOOR':
      sm.eventBus.emit('DOOR_OPEN_REQUEST', msg.doorId);  // No point check!

  case 'INTERACT_POWER':
      sm.eventBus.emit('POWER_ON_REQUEST', null);  // No validation!

  case 'INTERACT_BOX':
  case 'INTERACT_BOX_START':
  case 'INTERACT_BOX_TAKE':
      sm.mysteryBoxSystem.interact(playerName);  // No point check!
```

**Missing validations:**
- Does CLIENT have enough points for the door/perk/wall buy/mystery box?
- Is the door already open?
- Does CLIENT already have the perk?
- Is the mystery box already in use by another player?
- Is CLIENT close enough to the interactable?

**Fix:** HOST must validate every interaction request against authoritative state. Send explicit ACK/REJECT responses.

---

## HIGH Severity Issues

### 5. Client Movement Not Validated by HOST

**Severity:** HIGH
**Files:** `NetworkMessageHandler.ts:358-399`, `NetworkSystem.ts:76-94`

**Problem:** CLIENT sends position in INPUT packets. HOST receives and stores the position without any validation. There is no server-side collision checking, zone validation, or position bounds checking.

**Exploits possible:**
- Walk through walls (skip door purchases)
- Teleport to arbitrary positions
- Enter locked zones without buying doors
- Clip through level geometry

**Fix:** HOST should validate CLIENT position against the navmesh/collision geometry. If the position is invalid, snap it back to the last known valid position and send a correction.

---

### 6. Power-Up Pickup Race Condition

**Severity:** HIGH
**Files:** `PowerUpSystem.ts:102-125`

**Problem:** Both HOST and CLIENT independently check pickup distance (horizontal distance < `PICKUP_RADIUS`). Both can pick up the same power-up simultaneously.

```
PowerUpSystem.ts:110-111
  if (horizDist < pc.PICKUP_RADIUS) {
      ctx.powerUpManager.activatePowerUp(p.type);  // Both players can trigger this
```

**Consequences:**
- Both players collect the same Nuke/Max Ammo/etc.
- Double activation of timed effects (Double Points stacks or resets timer)
- Power-up mesh disposed twice (potential error)

**Fix:** Only HOST should process pickup collision. HOST sends `ACTIVATE_POWERUP_EFFECT` to CLIENT after validating pickup. CLIENT should only render the power-up mesh, not check for pickup collision.

---

### 7. Ammo & Weapon State Not Synced

**Severity:** HIGH
**Files:** `NetworkSystem.ts:77-94` (CLIENT delta), `NetworkSystem.ts:130-164` (HOST delta)

**Problem:** Only `activeWeaponIndex` and `activeWeaponId` are synced. The following weapon data is **never sent over the network**:
- `currentAmmo` / `currentReserve` (clip and reserve ammo counts)
- `clipSize` / `maxReserve` (weapon capacities)
- `isPacked` (Pack-a-Punch status)
- `reloadTime` state
- Weapon inventory (which weapons each player owns)

**Consequences:**
- Max Ammo power-up only refills the local player's ammo — remote player's ammo state is unknown
- When CLIENT Pack-a-Punches, HOST doesn't know the weapon is upgraded (affects damage calculation via HIT_CONFIRM)
- Remote player's weapon model may not match their actual weapon
- Wall Buy "already full ammo" check is local-only

**Fix:** Include weapon inventory snapshots (at minimum `isPacked` flag per weapon) in STATE/INPUT packets. Send ammo state or at minimum respond to MAX_AMMO with full refill events.

---

### 8. Window/Barrier Board State Desync

**Severity:** HIGH
**Files:** `NetworkSystem.ts:98-109`, `NetworkMessageHandler.ts:203-211`

**Problem:** HOST sends window board states as bitmasks in STATE packets. CLIENT receives INTERACT_WINDOW messages and enables a single board. But:

1. The bitmask in STATE packets is computed but **CLIENT doesn't apply it** — it only receives it in `cachedHost.windowStates` but there's no code to reconcile actual board mesh states with the bitmask.
2. When CLIENT repairs a board (INTERACT_WINDOW), HOST enables one board locally, but there's no guarantee it's the **same board** the CLIENT intended.
3. Zombie board destruction on HOST is not explicitly communicated — CLIENT only sees the bitmask change in the next STATE, with no animation trigger.

**Fix:** Apply the bitmask from STATE packets to actual board meshes on CLIENT. Ensure board index is communicated in INTERACT_WINDOW messages.

---

## MEDIUM Severity Issues

### 9. Mystery Box Race Condition

**Severity:** MEDIUM
**Files:** `MysteryBoxHandler.ts:18-33`, `NetworkMessageHandler.ts:213-223`

**Problem:** If both players click the mystery box simultaneously:
- CLIENT deducts points locally and sends `INTERACT_BOX_START`
- HOST also interacts locally (if HOST clicked)
- Both start the rolling animation optimistically
- HOST's weapon selection takes priority in STATE
- CLIENT sees their local animation then a visual "snap" to HOST's result

Additionally, `MysteryBoxHandler.ts:24` uses `stateManager.remote.gameState.isDowned` to determine player name, which seems inverted — it should check the local player's downed state.

**Fix:** Add a `BOX_LOCKED` state or ownership check. When one player initiates, the box is locked to that player. Reject other interaction attempts during rolling.

---

### 10. Perk Purchase Not Validated on HOST

**Severity:** MEDIUM
**Files:** `PerkHandler.ts:40-56`

**Problem:** CLIENT-side perk purchase deducts points and sets perk state immediately. No INTERACT_PERK message is sent to HOST. The HOST only learns about the CLIENT's perks through the INPUT packet's `clientPerks` field — meaning **CLIENT self-reports their perks**.

**Consequences:**
- CLIENT could theoretically report perks they didn't buy
- No cost validation on HOST side
- If network drops the INPUT packet with the perk update, HOST has stale perk data
- Juggernog health increase is applied locally (`gameState.maxHealth = 250`) — HOST doesn't know CLIENT has extra health

**Fix:** Send `INTERACT_PERK` messages. HOST validates cost and proximity, then broadcasts confirmed perk state.

---

### 11. Revive State Machine Lacks Formal States

**Severity:** MEDIUM
**Files:** `ReviveSystem.ts`, `DownedSystem.ts`, `NetworkMessageHandler.ts:249-275`

**Problems:**
- **No ACK for REVIVE_COMPLETE:** If the message is lost, one player thinks the other is revived while the other is still downed. No retry/timeout mechanism.
- **Perk loss on revive is local-only:** `ReviveSystem.ts:65` clears all perks when revived (`gameState.perkStates = {}`) but only on the downed player's side. HOST doesn't explicitly set CLIENT's perks to empty.
- **Quick Revive counter not synced:** `quickRevivesRemaining` is only decremented locally in `DownedSystem.ts:104`. In co-op, if HOST goes down and self-revives, the CLIENT doesn't know the counter changed.
- **SELF_REVIVE event only sent in solo mode:** `DownedSystem.ts` handles solo Quick Revive self-revive but there's no `SELF_REVIVE` send call in that code path — the `SELF_REVIVE` message type exists in `NetworkMessageHandler.ts:271` but may never be sent from downed system.
- **Race condition:** Player goes down → starts being revived → goes down again (zombie hit during revive). No protection against re-triggering downed state during revive animation.

**Fix:** Implement a proper state machine: `ALIVE → DOWNED → BEING_REVIVED → ALIVE` with explicit transitions. Add ACK messages for revive completion. Sync Quick Revive counter.

---

### 12. Nuke Power-Up Kill Credit & Sync

**Severity:** MEDIUM
**Files:** `PowerUpManager.ts` (referenced in `PowerUpSystem.ts`)

**Problem:** When Nuke is activated, all zombies are killed. But:
- Only HOST processes zombie deaths (authority check in damage systems)
- Points from Nuke kills (400 per zombie) are awarded only to the activating player
- If CLIENT activates Nuke, HOST must process all kills and send HIT_CONFIRM for each — but the activation message may not carry the activating player's identity clearly
- Mass zombie removal causes a large delta in the next STATE packet (many `removedZombieIds`)

**Fix:** Nuke activation should clearly identify the activating player. HOST awards points accordingly. Consider batching the zombie removal notification.

---

### 13. Round Transition & Respawn Issues

**Severity:** MEDIUM
**Files:** `RoundSystem.ts:163-166`, `NetworkMessageHandler.ts:243-246`

**Problems:**
- **Respawn message is fire-and-forget:** `RoundSystem.ts:165` sends a single RESPAWN message at round end. If this packet is dropped, the dead CLIENT never respawns.
- **Spectating state desync:** CLIENT sets `isSpectating = false` on RESPAWN receipt (`NetworkMessageHandler.ts:246`), but if CLIENT never received the RESPAWN, they remain in spectate mode permanently.
- **No round state reconciliation:** CLIENT knows the round number from STATE, but doesn't independently verify round transitions — relies entirely on HOST's round counter in STATE packets. If STATE is missed during a round transition, CLIENT might show wrong round for up to 5 seconds.
- **End-of-round intermission is host-only:** CLIENT has no explicit intermission state — just sees zombies stop spawning and the round number eventually increment.

**Fix:** Include respawn eligibility in periodic STATE packets (not just a one-shot event). Add round transition events that are retried until ACK'd.

---

### 14. Door Open Animation Desync

**Severity:** MEDIUM
**Files:** `DoorHandler.ts:21-27`, `NetworkMessageHandler.ts:195-196`

**Problem:** When CLIENT opens a door, it sets `doorState.isOpen = true` locally AND emits `DOOR_OPEN_REQUEST` locally. When HOST receives `INTERACT_DOOR`, it also emits `DOOR_OPEN_REQUEST`. But:

- CLIENT starts the door animation immediately (optimistic)
- HOST receives request, validates, opens door, broadcasts STATE
- If HOST rejects (door already open, insufficient points), CLIENT has already played the animation
- If HOST accepts, CLIENT receives STATE with `doorState.isOpen = true` — but animation already started, so it may double-trigger or stutter

**Fix:** CLIENT should wait for HOST STATE confirmation before triggering door animation. Or add a pending state that shows a "requesting" visual.

---

## LOW Severity Issues

### 15. No Interaction Timeout or Retry

**Severity:** LOW
**Files:** All interaction handlers

**Problem:** When CLIENT sends an interaction request (INTERACT_DOOR, INTERACT_BOX, etc.), there is no timeout mechanism. If the HOST never responds (packet loss, processing error), the CLIENT waits indefinitely. The next full sync (5 seconds) may resolve visible state, but optimistically deducted points won't be refunded until then.

**Fix:** Add a 2-second timeout for interaction confirmations. If no STATE update confirms the interaction, revert the optimistic local change.

---

### 16. Zombie Spawn Location Non-Determinism

**Severity:** LOW
**Files:** `ZombieManager.ts` (spawn logic)

**Problem:** Zombie spawn windows are selected randomly from accessible zones. The HOST spawns zombies at random windows with ±0.5m position jitter. CLIENT receives the zombie positions from STATE packets. This is fine architecturally (HOST-authoritative), but:

- Zombies appear to "pop in" on CLIENT's screen because they first show up at the spawn position in the next STATE packet, with no spawn animation.
- No spawn event is sent — CLIENT only learns about new zombies when they appear in the zombie array of the next STATE packet.
- Spawn timing jitter (`Math.random()` in spawn delay) makes zombie appearance feel inconsistent between HOST and CLIENT views.

**Fix:** Send a `ZOMBIE_SPAWN` event with spawn position and window ID so CLIENT can play a spawn animation. The STATE packet would then track ongoing position updates.

---

### 17. Hellhound State Not Synced

**Severity:** LOW
**Files:** `ZombieAISystem.ts`, `NetworkSystem.ts:116-128`

**Problem:** Hellhounds have a complex state machine (SPAWNING → CHASING → ATTACK_WINDUP → ATTACKING → RECOVERY). None of these states are included in the zombie sync data — only position and rotation. CLIENT can't distinguish between a hellhound that's winding up an attack vs one that's chasing.

**Fix:** Include AI state in zombie sync data, at minimum for hellhounds (attack windup/lunge are visually distinct and important for player gameplay decisions).

---

### 18. `Date.now()` vs Synchronized Game Time

**Severity:** LOW
**Files:** Throughout (ZombieManager, PowerUpSystem, DownedSystem, etc.)

**Problem:** Various systems use `Date.now()` for timestamps (spawn time, power-up expiry, downed timer). HOST and CLIENT will have different `Date.now()` values (clock skew). This doesn't cause bugs currently because most time-based logic is HOST-authoritative, but:

- Power-up timers (`activePowerUps[type] = Date.now() + duration`) use HOST's clock. CLIENT displays the same timestamp but with their own clock — timer expiry may differ by clock skew amount.
- `InterpolationBuffer.ts` uses `Date.now()` for sample timestamps — this works because it's relative, but network jitter could cause sampling issues.

**Fix:** Use a consistent game-time counter based on elapsed frames/dt rather than wall clock.

---

### 19. Pack-a-Punch Not Network-Aware

**Severity:** LOW
**Files:** `PackAPunchHandler.ts:18-31`

**Problem:** Pack-a-Punch handler deducts points and emits `PACK_A_PUNCH_REQUEST` locally. No network message is sent to inform the other player. The `isPacked` weapon state is only synced if `activeWeaponId` changes (it doesn't — same weapon ID, just with a packed flag). CLIENT Pack-a-Punching a weapon means:

- HOST doesn't know CLIENT's weapon is now packed
- Damage from CLIENT's packed weapon isn't properly calculated (CLIENT sends SHOOT, HOST processes damage with non-packed multiplier)
- Remote player visual shows un-packed weapon model

**Fix:** Send `INTERACT_PACK_A_PUNCH` message. Include `isPacked` flag in weapon sync data. HOST validates cost and applies upgrade.

---

### 20. Wall Buy Has No Network Message

**Severity:** LOW
**Files:** `WallBuyHandler.ts:15-51`

**Problem:** Similar to Pack-a-Punch — wall buy deducts points and picks up weapons locally. No network message is sent. HOST doesn't know CLIENT bought a new weapon or refilled ammo.

**Fix:** Send `INTERACT_WALL_BUY` message for HOST validation and tracking.

---

## Summary Table

| # | Issue | Severity | Category | Impact |
|---|-------|----------|----------|--------|
| 1 | Client-side point deduction race | CRITICAL | Race Condition | Points desync, double-spend |
| 2 | No zombie health sync | CRITICAL | Missing Data | No hit feedback, delayed kills |
| 3 | Projectile owner hardcoded | CRITICAL | Bug | Wrong kill attribution |
| 4 | No HOST validation of interactions | CRITICAL | Security/Logic | Unvalidated purchases, exploits |
| 5 | Client movement not validated | HIGH | Security | Walk through walls |
| 6 | Power-up pickup race condition | HIGH | Race Condition | Double activation |
| 7 | Ammo & weapon state not synced | HIGH | Missing Data | Max Ammo broken, PaP unknown |
| 8 | Window board state desync | HIGH | Logic Error | Board visual mismatch |
| 9 | Mystery box race condition | MEDIUM | Race Condition | Visual flicker |
| 10 | Perk purchase not validated | MEDIUM | Logic Error | Silent perk desync |
| 11 | Revive state machine incomplete | MEDIUM | State Machine | Stuck downed/revive state |
| 12 | Nuke kill credit unclear | MEDIUM | Logic | Wrong point attribution |
| 13 | Round transition fragile | MEDIUM | Reliability | Stuck spectating |
| 14 | Door animation desync | MEDIUM | UX | Animation stutter |
| 15 | No interaction timeout | LOW | UX | Stuck pending state |
| 16 | Zombie spawn pop-in | LOW | UX | No spawn animation on client |
| 17 | Hellhound state not synced | LOW | Missing Data | Wrong visual state |
| 18 | Date.now() clock skew | LOW | Timing | Minor timer drift |
| 19 | Pack-a-Punch not networked | LOW | Missing Feature | HOST unaware of PaP |
| 20 | Wall Buy not networked | LOW | Missing Feature | HOST unaware of purchases |

---

## Recommended Fix Priority

**Phase 1 — Core authority model (fixes #1, #4, #10, #19, #20):**
Make all resource-spending interactions HOST-validated. CLIENT sends requests, HOST validates and responds with ACK/REJECT. Points are only deducted after HOST confirmation.

**Phase 2 — Zombie state sync (fixes #2, #3, #17):**
Include health, maxHealth, isCrawling, and AI state in zombie sync data. Fix projectile owner attribution. Add ZOMBIE_HIT events for immediate feedback.

**Phase 3 — Weapon & item sync (fixes #7, #8, #6):**
Sync weapon inventory with isPacked flag. Apply window bitmask from STATE to actual meshes. Make power-up pickup HOST-authoritative.

**Phase 4 — State machines & reliability (fixes #11, #13, #9, #14, #15):**
Add proper state machines for revive flow, mystery box ownership, and door animations. Add ACK/retry for critical one-shot events (RESPAWN, REVIVE_COMPLETE).

**Phase 5 — Polish (fixes #5, #12, #16, #18):**
Server-side position validation, nuke attribution, spawn animations, game-time clock.
