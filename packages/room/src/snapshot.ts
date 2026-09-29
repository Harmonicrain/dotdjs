import { activeWeapon, Button, copyPredicted, liveZombieCount } from '@dotd/sim';
import type { PlayerState, PredictedState, World, ZombieState } from '@dotd/sim';
import type { PlayerSnapshot, Snapshot, TickedEvent, ZombieSnapshot } from '@dotd/protocol';

function playerSnapshot(p: PlayerState): PlayerSnapshot {
  return {
    id: p.id,
    pos: p.pos,
    yaw: p.yaw,
    pitch: p.pitch,
    life: p.life,
    health: p.health,
    maxHealth: p.maxHealth,
    points: p.points,
    kills: p.kills,
    headshots: p.headshots,
    weaponId: activeWeapon(p).id,
    buttons: p.prevButtons & ~Button.Interact,
    grounded: p.grounded,
    sprinting: p.sprinting,
    reloading: p.reloadTimer > 0,
  };
}

const zombieSnapshot = (z: ZombieState): ZombieSnapshot => ({
  id: z.id,
  pos: z.pos,
  yaw: z.yaw,
  mode: z.mode,
  healthFraction: z.maxHealth > 0 ? z.health / z.maxHealth : 0,
  speed: z.speed,
});

/** The parts of a snapshot that are identical for every recipient. */
export type SharedSnapshot = Omit<Snapshot, 'ackSeq' | 'self'>;

export function buildSharedSnapshot(world: World, events: TickedEvent[]): SharedSnapshot {
  return {
    tick: world.tick,
    game: {
      phase: world.game.phase,
      round: world.game.round,
      phaseTimer: world.game.phaseTimer,
      zombiesRemaining: world.game.zombiesToSpawn + liveZombieCount(world),
    },
    players: [...world.players.values()].map(playerSnapshot),
    zombies: [...world.zombies.values()].map(zombieSnapshot),
    events,
  };
}

export function snapshotFor(shared: SharedSnapshot, player: PlayerState | undefined): Snapshot {
  let self: PredictedState | null = null;
  if (player) {
    self = {} as PredictedState;
    copyPredicted(player, self);
  }
  return { ...shared, ackSeq: player?.lastInputSeq ?? 0, self };
}
