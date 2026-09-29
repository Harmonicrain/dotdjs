import { PLAYER, POINTS } from '../config';
import type { Vec3 } from '../math/vec3';
import type { PlayerState } from '../player/state';
import type { World } from '../world/types';
import type { ZombieState } from '../zombies/state';

export function awardPoints(world: World, player: PlayerState, amount: number): void {
  player.points += amount;
  world.events.push({ type: 'points', playerId: player.id, amount });
}

/** Applies a bullet hit to a zombie, awarding points to the shooter. */
export function damageZombie(
  world: World,
  zombie: ZombieState,
  shooter: PlayerState,
  damage: number,
  headshot: boolean,
  point: Vec3,
): void {
  if (zombie.mode === 'dead') return;
  zombie.health -= damage;
  const killed = zombie.health <= 0;

  if (killed) {
    zombie.health = 0;
    killZombie(world, zombie);
    shooter.kills += 1;
    if (headshot) shooter.headshots += 1;
    awardPoints(world, shooter, POINTS.kill + (headshot ? POINTS.headshotBonus : 0));
  } else {
    awardPoints(world, shooter, POINTS.hit);
  }

  world.events.push({
    type: 'zombieHit',
    zombieId: zombie.id,
    playerId: shooter.id,
    point,
    headshot,
    killed,
  });
}

/** Turns a zombie into a corpse and takes it out of the crowd. */
export function killZombie(world: World, zombie: ZombieState): void {
  zombie.mode = 'dead';
  zombie.modeTime = 0;
  const agent = world.internals.agents.get(zombie.id);
  if (agent) {
    world.nav.crowd.removeAgent(agent);
    world.internals.agents.delete(zombie.id);
  }
}

export function damagePlayer(world: World, player: PlayerState, amount: number, from: Vec3): void {
  if (player.life !== 'alive' || player.immunityTimer > 0) return;

  player.health = Math.max(0, player.health - amount);
  player.immunityTimer = PLAYER.damageImmunity;
  player.regenTimer = PLAYER.regenDelay;
  world.events.push({ type: 'playerHurt', playerId: player.id, amount, from });

  if (player.health === 0) {
    player.life = 'dead';
    player.vel = { x: 0, y: 0, z: 0 };
    world.events.push({ type: 'playerDied', playerId: player.id });
  }
}
