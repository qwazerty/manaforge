import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

const isWatch = process.argv.includes('--watch');

export default defineConfig({
  base: '/static/dist/',
  root: '.',
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
    emptyOutDir: !isWatch, // Don't clear outDir in watch mode (preserves Tailwind CSS)
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
  }
});

