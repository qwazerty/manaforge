import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        conditions: ['browser'],
        alias: {
            '@svelte': path.resolve(__dirname, 'app/frontend/js/svelte'),
            '@ui': path.resolve(__dirname, 'app/frontend/js/ui'),
            '@static': path.resolve(__dirname, 'app/frontend/js'),
            '@lib': path.resolve(__dirname, 'app/frontend/js/lib')
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./setupTests.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: 'coverage',
            thresholds: {
                statements: 0.8,
                branches: 0.8,
                functions: 0.8,
                lines: 0.8
            }
        }
    }
});
