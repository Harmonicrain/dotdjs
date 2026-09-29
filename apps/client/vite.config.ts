import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Multiplayer: `npm run dev:server` runs the game server on 8787.
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});
