/** Letters that are hard to confuse when read aloud or typed (no I, L, O, 0, 1). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

/** Random room code. `random` returns a float in [0, 1). */
export function generateRoomCode(random: () => number, taken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ALPHABET[Math.floor(random() * ALPHABET.length)];
    }
    if (!taken(code)) return code;
  }
  throw new Error('No free room codes');
}

/** Uppercases and strips anything that cannot be part of a code, or returns null if invalid. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((ch) => ALPHABET.includes(ch)) ? code : null;
}
