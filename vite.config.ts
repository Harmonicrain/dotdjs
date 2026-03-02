
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: {
            // Fixes HMR connection issues in some cloud IDEs/network setups
            protocol: 'ws', 
            host: 'localhost',
        }
      },
      publicDir: 'public', // Explicitly serve the public directory
      assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.envmap'], // Ensure 3D models and env textures are treated as assets
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      }
    };
});
