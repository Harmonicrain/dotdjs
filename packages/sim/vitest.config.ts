import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'sim', environment: 'node' },
});
