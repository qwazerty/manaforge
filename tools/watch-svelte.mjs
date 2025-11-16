#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { buildAllSvelte } from './build-svelte.mjs';

const WATCH_DIR = path.resolve('app/static/js/svelte');
const DEBOUNCE_MS = 150;

const log = (message) => console.log(`[watch-svelte] ${message}`);

let timer = null;
const scheduleBuild = async () => {
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(async () => {
        await runBuild();
    }, DEBOUNCE_MS);
};

const runBuild = async () => {
    try {
        await buildAllSvelte();
        log('build complete');
    } catch (error) {
        log(`build failed: ${error.message}`);
    }
};

const startWatching = async () => {
    await runBuild();

    if (!fs.existsSync(WATCH_DIR)) {
        log('watch directory does not exist');
        process.exit(1);
    }

    const watcher = fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
        if (!filename) {
            return;
        }
        log(`change detected (${eventType} ${filename})`);
        scheduleBuild();
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
