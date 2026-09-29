import { ZOMBIE, zombieBaseSpeedForRound, zombieHealthForRound, ROUNDS } from '../config';
import { damagePlayer } from '../combat/damage';
import { PositionHistory } from '../combat/history';
import { nextInt, nextRange } from '../math/rng';
import { distanceXZ, fromTuple, yawFromDirection } from '../math/vec3';
import type { Vec3 } from '../math/vec3';
import type { PlayerState } from '../player/state';
import type { World } from '../world/types';
import { addZombieAgent, closestNavPoint } from './navigation';
import type { ZombieState } from './state';

const RISE_DEPTH = 1.9;
const TURN_RATE = 8; // radians per second
const TARGET_SWITCH_MARGIN = 3; // metres closer before switching targets

export const isZombieAlive = (z: ZombieState): boolean => z.mode !== 'dead';

export function liveZombieCount(world: World): number {
  let count = 0;
  for (const z of world.zombies.values()) if (isZombieAlive(z)) count++;
  return count;
}

const alivePlayers = (world: World): PlayerState[] =>
  [...world.players.values()].filter((p) => p.life === 'alive');

function allocateZombieId(world: World): number {
  do {
    world.internals.nextZombieId = (world.internals.nextZombieId % 0xffff) + 1;
  } while (world.zombies.has(world.internals.nextZombieId));
  return world.internals.nextZombieId;
}

/** Picks a ground spawn away from (but not too far from) the players. */
function chooseSpawnPoint(world: World): Vec3 {
  const spawns = world.level.zombieSpawns.map(fromTuple);
  const players = alivePlayers(world);
  const nearestPlayerDistance = (p: Vec3) =>
    players.reduce((min, pl) => Math.min(min, distanceXZ(p, pl.pos)), Infinity);
  const valid = spawns.filter((s) => nearestPlayerDistance(s) >= ROUNDS.minSpawnDistance);
  const pool = valid.length > 0 ? valid : spawns;
  const choice = pool[nextInt(world.rng, pool.length)];
  if (!choice) throw new Error(`Level ${world.level.id} has no zombie spawns`);
  return choice;
}

export function spawnZombie(world: World): ZombieState {
  const spawnPos = chooseSpawnPoint(world);
  const round = world.game.round;
  const [minVar, maxVar] = ZOMBIE.speedVariation;
  const speed = Math.min(
    ZOMBIE.maxSpeed,
    zombieBaseSpeedForRound(round) * nextRange(world.rng, minVar, maxVar),
  );
  const health = zombieHealthForRound(round);
  const zombie: ZombieState = {
    id: allocateZombieId(world),
    pos: { x: spawnPos.x, y: spawnPos.y - RISE_DEPTH, z: spawnPos.z },
    yaw: nextRange(world.rng, -Math.PI, Math.PI),
    health,
    maxHealth: health,
    speed,
    mode: 'rising',
    modeTime: 0,
    targetId: 0,
    repathTimer: 0,
    attackResolved: false,
    spawnPos,
  };
  world.zombies.set(zombie.id, zombie);
  const history = new PositionHistory();
  history.record(world.tick, zombie.pos);
  world.internals.history.set(zombie.id, history);
  return zombie;
}

export function removeZombie(world: World, id: number): void {
  const agent = world.internals.agents.get(id);
  if (agent) world.nav.crowd.removeAgent(agent);
  world.internals.agents.delete(id);
  world.internals.history.delete(id);
  world.zombies.delete(id);
}

function pickTarget(world: World, zombie: ZombieState): PlayerState | null {
  const current = world.players.get(zombie.targetId);
  let best: PlayerState | null = current?.life === 'alive' ? current : null;
  let bestDistance = best ? distanceXZ(best.pos, zombie.pos) - TARGET_SWITCH_MARGIN : Infinity;
  for (const player of world.players.values()) {
    if (player.life !== 'alive') continue;
    const d = distanceXZ(player.pos, zombie.pos);
    if (d < bestDistance) {
      best = player;
      bestDistance = d;
    }
  }
  zombie.targetId = best?.id ?? 0;
  return best;
}

function turnTowards(zombie: ZombieState, targetYaw: number, dt: number): void {
  let diff = targetYaw - zombie.yaw;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const maxTurn = TURN_RATE * dt;
  zombie.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff));
}

const inAttackRange = (zombie: ZombieState, target: PlayerState, range: number): boolean =>
  distanceXZ(zombie.pos, target.pos) <= range && Math.abs(zombie.pos.y - target.pos.y) < 1.4;

function stopAgent(world: World, zombie: ZombieState): void {
  const agent = world.internals.agents.get(zombie.id);
  if (!agent) return;
  agent.resetMoveTarget();
  agent.requestMoveVelocity({ x: 0, y: 0, z: 0 });
}

function updateIntent(world: World, zombie: ZombieState, dt: number): void {
  zombie.modeTime += dt;

  switch (zombie.mode) {
    case 'rising': {
      const t = Math.min(1, zombie.modeTime / ZOMBIE.riseDuration);
      const eased = 1 - (1 - t) * (1 - t);
      zombie.pos.y = zombie.spawnPos.y - RISE_DEPTH * (1 - eased);
      if (t >= 1) {
        const start = closestNavPoint(world.nav, zombie.spawnPos) ?? zombie.spawnPos;
        zombie.pos = { ...start };
        world.internals.agents.set(zombie.id, addZombieAgent(world.nav, start, zombie.speed));
        zombie.mode = 'chasing';
        zombie.modeTime = 0;
        zombie.repathTimer = 0;
      }
      return;
    }
    case 'chasing': {
      const target = pickTarget(world, zombie);
      const agent = world.internals.agents.get(zombie.id);
      if (!target || !agent) {
        stopAgent(world, zombie);
        return;
      }
      if (inAttackRange(zombie, target, ZOMBIE.attackRange)) {
        zombie.mode = 'attacking';
        zombie.modeTime = 0;
        zombie.attackResolved = false;
        stopAgent(world, zombie);
        return;
      }
      zombie.repathTimer -= dt;
      if (zombie.repathTimer <= 0) {
        zombie.repathTimer = ZOMBIE.repathInterval;
        agent.requestMoveTarget(closestNavPoint(world.nav, target.pos) ?? target.pos);
      }
      return;
    }
    case 'attacking': {
      const target = world.players.get(zombie.targetId);
      if (target) {
        turnTowards(
          zombie,
          yawFromDirection(target.pos.x - zombie.pos.x, target.pos.z - zombie.pos.z),
          dt,
        );
      }
      if (!zombie.attackResolved && zombie.modeTime >= ZOMBIE.attackWindup) {
        zombie.attackResolved = true;
        const hit =
          !!target && target.life === 'alive' && inAttackRange(zombie, target, ZOMBIE.attackReach);
        if (target) {
          world.events.push({ type: 'zombieAttack', zombieId: zombie.id, targetId: target.id, hit });
        }
        if (hit) damagePlayer(world, target, ZOMBIE.attackDamage, zombie.pos);
      }
      if (zombie.modeTime >= ZOMBIE.attackDuration) {
        zombie.mode = 'chasing';
        zombie.modeTime = 0;
        zombie.repathTimer = 0;
      }
      return;
    }
    case 'dead':
      if (zombie.modeTime >= ZOMBIE.corpseDuration) removeZombie(world, zombie.id);
      return;
  }
}

/** Advances every zombie: decisions, then crowd movement, then pose. */
export function stepZombies(world: World, dt: number): void {
  for (const zombie of [...world.zombies.values()]) updateIntent(world, zombie, dt);

  world.nav.crowd.update(dt);

  for (const zombie of world.zombies.values()) {
    const agent = world.internals.agents.get(zombie.id);
    if (!agent || zombie.mode === 'dead') continue;
    const p = agent.position();
    zombie.pos = { x: p.x, y: p.y, z: p.z };
    if (zombie.mode === 'chasing') {
      const v = agent.velocity();
      if (v.x * v.x + v.z * v.z > 0.04) turnTowards(zombie, yawFromDirection(v.x, v.z), dt);
    }
  }
}
