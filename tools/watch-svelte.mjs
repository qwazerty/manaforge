#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {
    buildAllSvelte,
    compileComponentSource,
    bundleAllComponents,
    listSvelteComponents
} from './build-svelte.mjs';

const WATCH_DIR = path.resolve('app/frontend/js/svelte');
const DEBOUNCE_MS = 150;

const log = (message) => console.log(`[watch-svelte] ${message}`);

let timer = null;
let pendingFiles = new Set();
let knownComponents = [];
let buildInProgress = false;

const scheduleBuild = async (filename) => {
    if (filename) {
        pendingFiles.add(filename);
    }

    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(async () => {
        await runBuild();
    }, DEBOUNCE_MS);
};

const runBuild = async () => {
    if (buildInProgress) return;
    buildInProgress = true;

    const files = Array.from(pendingFiles);
    pendingFiles.clear();

    try {
        if (files.length === 0) {
            knownComponents = await buildAllSvelte();
            log('build complete');
            return;
        }

        const svelteFiles = files.filter((file) => file.endsWith('.svelte'));

        if (svelteFiles.length === files.length && svelteFiles.length > 0) {
            const entryFiles = [];
            for (const file of svelteFiles) {
                log(`incremental compile ${file}`);
                await compileComponentSource(file);
                const baseName = path.basename(file, '.svelte');
                entryFiles.push(path.join('app/static/dist/js/ui/components', `${baseName}.js`));
            }
            await bundleAllComponents(entryFiles);
            log('incremental build complete');
            return;
        }

        // Fallback: do full rebuild (covers added/removed components, other files)
        knownComponents = await buildAllSvelte();
        log('build complete');
    } catch (error) {
        log(`build failed: ${error.message}`);
    } finally {
        buildInProgress = false;
    }
};

const startWatching = async () => {
    knownComponents = await buildAllSvelte();

    if (!fs.existsSync(WATCH_DIR)) {
        log('watch directory does not exist');
        process.exit(1);
    }

    const watcher = fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
        if (!filename) {
            return;
        }
        log(`change detected (${eventType} ${filename})`);
        scheduleBuild(filename);
    });

    const cleanup = () => {
        watcher.close();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
};

startWatching().catch((error) => {
    log(`watcher failed: ${error.message}`);
    process.exit(1);
});
