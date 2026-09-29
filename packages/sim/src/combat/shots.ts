import { LAG_COMPENSATION } from '../config';
import { addScaled } from '../math/vec3';
import type { Vec3 } from '../math/vec3';
import { raycastLevel } from '../physics/physics';
import type { PlayerState } from '../player/state';
import type { Shot } from '../player/weapon';
import type { World } from '../world/types';
import type { ZombieState } from '../zombies/state';
import { damageZombie } from './damage';
import { rayHitsZombie } from './hitscan';

/**
 * Resolves a player's shot on the server. Zombies are rewound to where the shooter saw them
 * (`viewTick`), so a shot that looked like a hit on screen counts as a hit.
 */
export function resolveShot(world: World, shooter: PlayerState, shot: Shot, viewTick: number): void {
  const rewindTick = Math.min(
    world.tick,
    Math.max(world.tick - LAG_COMPENSATION.maxRewindTicks, viewTick),
  );
  const ends: Vec3[] = [];

  for (const dir of shot.dirs) {
    const wall = raycastLevel(world.physics, shot.origin, dir, shot.range);
    let closest = wall?.distance ?? shot.range;
    let target: { zombie: ZombieState; headshot: boolean } | null = null;

    for (const zombie of world.zombies.values()) {
      if (zombie.mode === 'dead') continue;
      const feet = world.internals.history.get(zombie.id)?.sample(rewindTick) ?? zombie.pos;
      const hit = rayHitsZombie(shot.origin, dir, closest, feet);
      if (hit && hit.distance < closest) {
        closest = hit.distance;
        target = { zombie, headshot: hit.headshot };
      }
    }

    const end = addScaled(shot.origin, dir, closest);
    ends.push(end);
    if (target) {
      const damage = shot.damage * (target.headshot ? shot.headshotMultiplier : 1);
      damageZombie(world, target.zombie, shooter, damage, target.headshot, end);
    }
  }

  world.events.push({
    type: 'shot',
    playerId: shooter.id,
    weaponId: shot.weaponId,
    origin: shot.origin,
    ends,
  });
}
