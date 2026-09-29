import { maxConcurrentZombies, ROUNDS, spawnDelayForRound, zombiesForRound } from '../config';
import type { World } from '../world/types';
import { liveZombieCount, spawnZombie } from '../zombies/ai';
import { respawnPlayer } from '../world/players';

function startRound(world: World, round: number): void {
  const game = world.game;
  game.phase = 'active';
  game.round = round;
  game.zombiesToSpawn = zombiesForRound(round, world.players.size);
  game.spawnTimer = 1;
  world.events.push({ type: 'roundStarted', round });
}

/** Round flow: waiting for players → pregame countdown → rounds with intermissions → game over. */
export function stepRounds(world: World, dt: number): void {
  const game = world.game;
  const anyoneAlive = [...world.players.values()].some((p) => p.life === 'alive');

  switch (game.phase) {
    case 'waiting':
      if (world.players.size > 0) {
        game.phase = 'pregame';
        game.phaseTimer = ROUNDS.pregameDuration;
      }
      return;

    case 'pregame':
      game.phaseTimer -= dt;
      if (game.phaseTimer <= 0) startRound(world, 1);
      return;

    case 'active':
      if (world.players.size > 0 && !anyoneAlive) {
        game.phase = 'over';
        world.events.push({ type: 'gameOver', round: game.round });
        return;
      }
      game.spawnTimer -= dt;
      if (
        game.zombiesToSpawn > 0 &&
        game.spawnTimer <= 0 &&
        liveZombieCount(world) < maxConcurrentZombies(game.round)
      ) {
        spawnZombie(world);
        game.zombiesToSpawn -= 1;
        game.spawnTimer = spawnDelayForRound(game.round);
      }
      if (game.zombiesToSpawn === 0 && liveZombieCount(world) === 0) {
        game.phase = 'intermission';
        game.phaseTimer = ROUNDS.intermissionDuration;
        world.events.push({ type: 'roundEnded', round: game.round });
      }
      return;

    case 'intermission':
      game.phaseTimer -= dt;
      if (game.phaseTimer <= 0) {
        for (const player of world.players.values()) {
          if (player.life === 'dead') respawnPlayer(world, player);
        }
        startRound(world, game.round + 1);
      }
      return;

    case 'over':
      return;
  }
}
