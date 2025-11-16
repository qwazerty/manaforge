import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { compile } from 'svelte/compiler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVELTE_DIR = path.resolve('app/static/js/svelte');
const COMPONENT_DIR = path.resolve('app/static/js/ui/components');

const sanitizeGlobalName = (name) => {
    const trimmed = name.replace(/[^a-zA-Z0-9]/g, '');
    const safe = trimmed || 'component';
    return `${safe.charAt(0).toUpperCase()}${safe.slice(1)}Component`;
};

const compileComponent = async (fileName) => {
    const inputPath = path.join(SVELTE_DIR, fileName);
    const baseName = path.basename(fileName, '.svelte');
    const jsOutputPath = path.join(COMPONENT_DIR, `${baseName}.js`);
    const bundlePath = path.join(COMPONENT_DIR, `${baseName}.bundle.js`);
    const source = await fs.readFile(inputPath, 'utf8');

const compiled = compile(source, {
    filename: path.relative(process.cwd(), inputPath),
    dev: false,
    compatibility: {
        componentApi: 4
    }
});

    await fs.writeFile(jsOutputPath, compiled.js.code, 'utf8');

    const globalName = sanitizeGlobalName(baseName);
    const command = [
        'npx esbuild',
        `"${jsOutputPath}"`,
        '--bundle --format=iife',
        `--global-name=${globalName}`,
        `--outfile="${bundlePath}"`,
        '--sourcemap'
    ].join(' ');

    console.log(`[build-svelte] esbuild: ${command}`);
    execSync(command, { stdio: 'inherit' });
};

export const buildAllSvelte = async () => {
    await fs.mkdir(COMPONENT_DIR, { recursive: true });

    const entries = await fs.readdir(SVELTE_DIR, { withFileTypes: true });
    const components = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.svelte'))
        .map((entry) => entry.name);

    if (components.length === 0) {
        console.warn('[build-svelte] No Svelte components found');
        return;
    }

    console.log('[build-svelte] components to build:', components);
    for (const component of components) {
        console.log(`[build-svelte] compiling ${component}`);
        await compileComponent(component);
    }
};

if (fileURLToPath(import.meta.url) === __filename) {
    buildAllSvelte().catch((error) => {
        console.error('[build-svelte] failure', error);
        process.exit(1);
    });
}
