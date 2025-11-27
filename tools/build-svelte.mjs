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

const compileComponentSource = async (fileName) => {
    const inputPath = path.join(SVELTE_DIR, fileName);
    const baseName = path.basename(fileName, '.svelte');
    const jsOutputPath = path.join(COMPONENT_DIR, `${baseName}.js`);
    const source = await fs.readFile(inputPath, 'utf8');

    const compiled = compile(source, {
        filename: path.relative(process.cwd(), inputPath),
        dev: false,
        runes: true,
        accessors: true,
        compatibility: {
            componentApi: 5
        }
    });

    const rewrittenJs = compiled.js.code.replace(/(from\s+['"][^'"]+)\.svelte(['"])/g, '$1.js$2');

    const code = `${rewrittenJs}\nimport { createClassComponent } from 'svelte/legacy';\n\nexport function mount(component, options = {}) {\n    if (!component) {\n        throw new Error('mount requires a Svelte component');\n    }\n    if (!options.target) {\n        throw new Error('mount requires a target element');\n    }\n    return createClassComponent({\n        component,\n        ...options\n    });\n}\n\nexport function unmount(instance) {\n    if (instance && typeof instance.$destroy === 'function') {\n        instance.$destroy();\n    }\n}`;
    await fs.writeFile(jsOutputPath, code, 'utf8');
};

const bundleComponent = (fileName) => {
    const baseName = path.basename(fileName, '.svelte');
    const jsOutputPath = path.join(COMPONENT_DIR, `${baseName}.js`);
    const bundlePath = path.join(COMPONENT_DIR, `${baseName}.bundle.js`);
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

const copyUtilsDirectory = async () => {
    const srcUtilsDir = path.join(SVELTE_DIR, 'utils');
    const destUtilsDir = path.join(COMPONENT_DIR, 'utils');

    try {
        const stats = await fs.stat(srcUtilsDir);
        if (!stats.isDirectory()) {
            return;
        }
    } catch {
        // utils directory doesn't exist, skip
        return;
    }

    await fs.mkdir(destUtilsDir, { recursive: true });

    const entries = await fs.readdir(srcUtilsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.js')) {
            const srcPath = path.join(srcUtilsDir, entry.name);
            const destPath = path.join(destUtilsDir, entry.name);
            await fs.copyFile(srcPath, destPath);
            console.log(`[build-svelte] copied utility: ${entry.name}`);
        }
    }
};

export const buildAllSvelte = async () => {
    await fs.mkdir(COMPONENT_DIR, { recursive: true });

    // Copy utility files first so they can be resolved during bundling
    await copyUtilsDirectory();

    const entries = await fs.readdir(SVELTE_DIR, { withFileTypes: true });
    const components = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.svelte'))
        .map((entry) => entry.name);

    if (components.length === 0) {
        console.warn('[build-svelte] No Svelte components found');
        return;
    }

    console.log('[build-svelte] components to build:', components);

    console.log('[build-svelte] compiling sources');
    for (const component of components) {
        console.log(`[build-svelte] compiling ${component}`);
        await compileComponentSource(component);
    }

    console.log('[build-svelte] bundling outputs');
    for (const component of components) {
        console.log(`[build-svelte] bundling ${component}`);
        bundleComponent(component);
    }
};

if (fileURLToPath(import.meta.url) === __filename) {
    buildAllSvelte().catch((error) => {
        console.error('[build-svelte] failure', error);
        process.exit(1);
    });
}
