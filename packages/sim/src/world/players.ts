import { MAX_PLAYERS, PLAYER } from '../config';
import { fromTuple, vec3 } from '../math/vec3';
import type { Vec3 } from '../math/vec3';
import { createCharacterCollider, removeCharacterCollider } from '../physics/physics';
import { createPlayerState, createWeaponState } from '../player/state';
import type { PlayerState } from '../player/state';
import { STARTING_WEAPON } from '../weapons/defs';
import type { World } from './types';

const KILL_PLANE_Y = -30;
const MAX_NAME_LENGTH = 16;

export function sanitizeName(name: string): string {
  // Keep printable characters only (drops ASCII control chars and DEL).
  const printable = Array.from(name)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
  const cleaned = printable.trim().slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : 'Survivor';
}

function spawnPointFor(world: World, playerId: number): Vec3 {
  const spawns = world.level.playerSpawns;
  const spawn = spawns[(playerId - 1) % spawns.length];
  return spawn ? fromTuple(spawn) : vec3(0, 1, 0);
}

/** Adds a player in the lowest free slot. Returns null when the world is full. */
export function addPlayer(world: World, name: string): PlayerState | null {
  for (let id = 1; id <= MAX_PLAYERS; id++) {
    if (world.players.has(id)) continue;
    const player = createPlayerState(id, sanitizeName(name), spawnPointFor(world, id));
    world.players.set(id, player);
    world.internals.colliders.set(id, createCharacterCollider(world.physics));
    return player;
  }
  return null;
}

export function removePlayer(world: World, id: number): void {
  const collider = world.internals.colliders.get(id);
  if (collider) removeCharacterCollider(world.physics, collider);
  world.internals.colliders.delete(id);
  world.players.delete(id);
  for (const zombie of world.zombies.values()) {
    if (zombie.targetId === id) zombie.targetId = 0;
  }
}

/** Brings a player back at their spawn with a fresh starting loadout. Points are kept. */
export function respawnPlayer(world: World, player: PlayerState): void {
  player.life = 'alive';
  player.health = player.maxHealth;
  player.regenTimer = 0;
  player.immunityTimer = 0;
  player.pos = spawnPointFor(world, player.id);
  player.vel = vec3();
  player.weapons = [createWeaponState(STARTING_WEAPON)];
  player.activeSlot = 0;
  player.reloadTimer = 0;
  player.drawTimer = 0;
  player.fireCooldown = 0;
  world.events.push({ type: 'playerRespawned', playerId: player.id });
}

/** Health regeneration, hit immunity and falling out of the world. */
export function stepPlayerVitals(world: World, dt: number): void {
  for (const player of world.players.values()) {
    if (player.life !== 'alive') continue;
    player.immunityTimer = Math.max(0, player.immunityTimer - dt);
    if (player.regenTimer > 0) {
      player.regenTimer = Math.max(0, player.regenTimer - dt);
    } else if (player.health < player.maxHealth) {
      player.health = Math.min(player.maxHealth, player.health + PLAYER.regenPerSecond * dt);
    }
    if (player.pos.y < KILL_PLANE_Y) {
      player.pos = spawnPointFor(world, player.id);
      player.vel = vec3();
    }
  }
}
