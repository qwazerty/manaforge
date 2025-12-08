import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  root: '.', // project root
  plugins: [svelte()],
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'app/frontend/js/lib'),
      '@svelte': path.resolve(__dirname, 'app/frontend/js/svelte'),
      '@ui': path.resolve(__dirname, 'app/frontend/js/ui')
    }
  },
  build: {
    outDir: 'app/static/dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'app/frontend/js/main.ts'),
        'game-config': path.resolve(__dirname, 'app/frontend/js/legacy/game-config.js'),
        'game-utils': path.resolve(__dirname, 'app/frontend/js/legacy/game-utils.js')
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'main') return 'js/main.js';
          return 'js/[name].js';
        },
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/[name][extname]';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  },
  server: {
    fs: {
      allow: ['app/frontend', 'app/static/dist']
    }
  }
});
