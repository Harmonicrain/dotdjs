import { Room } from '@dotd/room';
import type { FromWorker, ToWorker } from '../game/net/link';

/**
 * Hosts a solo game's authoritative room off the main thread, speaking the same binary
 * protocol as the multiplayer server. Solo and multiplayer therefore share one code path.
 */
interface WorkerScope {
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
}
const scope = self as unknown as WorkerScope;

const LOOP_INTERVAL_MS = 4;
const PLAYER_ID_UNSET = -1;

let room: Room | null = null;
let playerId = PLAYER_ID_UNSET;
/** Solo games start paused until the player clicks in; this may arrive before the room exists. */
let paused = true;

const post = (message: FromWorker, transfer: Transferable[] = []) =>
  scope.postMessage(message, transfer);

async function start(name: string): Promise<void> {
  room = await Room.create({ code: 'SOLO', seed: Math.floor(Math.random() * 2 ** 31) });
  room.paused = paused;
  const joined = room.join(
    {
      send: (bytes) => post({ kind: 'data', bytes }, [bytes.buffer]),
      close: () => {},
    },
    name,
  );
  if (joined === null) throw new Error('Could not join the solo room');
  playerId = joined;
  setInterval(() => room?.update(performance.now()), LOOP_INTERVAL_MS);
}

scope.onmessage = (event) => {
  const message = event.data;
  switch (message.kind) {
    case 'start':
      start(message.name).catch((error: unknown) =>
        post({ kind: 'error', message: error instanceof Error ? error.message : String(error) }),
      );
      return;
    case 'data':
      if (room && playerId !== PLAYER_ID_UNSET) room.receive(playerId, message.bytes);
      return;
    case 'pause':
      paused = message.paused;
      if (room) room.paused = paused;
      return;
  }
};
