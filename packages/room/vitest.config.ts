import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'room', environment: 'node', testTimeout: 60_000 },
});
