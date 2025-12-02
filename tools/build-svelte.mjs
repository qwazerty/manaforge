import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { build as esbuild } from 'esbuild';
import { compile } from 'svelte/compiler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVELTE_DIR = path.resolve('app/static/js/svelte');
const COMPONENT_DIR = path.resolve('app/static/js/ui/components');

// Path aliases - must match tsconfig.json paths
const PATH_ALIASES = {
    '@lib': path.resolve('app/static/js/lib'),
    '@svelte': path.resolve('app/static/js/svelte'),
    '@ui': path.resolve('app/static/js/ui'),
};

// Plugin to resolve relative imports from compiled components to svelte source directories
const svelteRelativeImportsPlugin = {
    name: 'svelte-relative-imports',
    setup(build) {
        // Redirect ./stores/, ./utils/, ./lib/ imports from components dir to svelte dir
        build.onResolve({ filter: /^\.\/(?:stores|utils|lib)\// }, (args) => {
            if (args.resolveDir.includes('ui/components')) {
                const relativePath = args.path.slice(2); // remove './'
                return { path: path.join(SVELTE_DIR, relativePath) };
            }
            return null;
        });
    }
};

const sanitizeGlobalName = (name) => {
    const trimmed = name.replace(/[^a-zA-Z0-9]/g, '');
    const safe = trimmed || 'component';
    return `${safe.charAt(0).toUpperCase()}${safe.slice(1)}Component`;
};

export const compileComponentSource = async (fileName) => {
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
    
    // Check if createClassComponent is already imported
    const hasCreateClassComponent = rewrittenJs.includes('createClassComponent');
    
    const helper = hasCreateClassComponent
        ? `
export function mount(component, options = {}) {
    if (!component) throw new Error('mount requires a Svelte component');
    if (!options.target) throw new Error('mount requires a target element');
    return createClassComponent({ component, ...options });
}

export function unmount(instance) {
    if (instance && typeof instance.$destroy === 'function') {
        instance.$destroy();
    }
}
`
        : `
import { createClassComponent } from 'svelte/legacy';

export function mount(component, options = {}) {
    if (!component) throw new Error('mount requires a Svelte component');
    if (!options.target) throw new Error('mount requires a target element');
    return createClassComponent({ component, ...options });
}

export function unmount(instance) {
    if (instance && typeof instance.$destroy === 'function') {
        instance.$destroy();
    }
}
`;
    await fs.writeFile(jsOutputPath, `${rewrittenJs}\n${helper}`, 'utf8');
};

export const bundleAllComponents = async (entryFiles) => {
    if (!entryFiles.length) {
        console.warn('[build-svelte] No entry files to bundle');
        return;
    }
    for (const entry of entryFiles) {
        const baseName = path.basename(entry, '.js');
        const globalName = sanitizeGlobalName(baseName);
        const outfileBundle = path.join(COMPONENT_DIR, `${baseName}.bundle.js`);
        const outfileEsm = path.join(COMPONENT_DIR, `${baseName}.esm.js`);

        await esbuild({
            entryPoints: [entry],
            bundle: true,
            format: 'iife',
            globalName,
            outfile: outfileBundle,
            sourcemap: true,
            platform: 'browser',
            target: 'es2020',
            legalComments: 'none',
            alias: PATH_ALIASES,
            plugins: [svelteRelativeImportsPlugin],
            logLevel: 'error'
        });

        await esbuild({
            entryPoints: [entry],
            bundle: true,
            format: 'esm',
            outfile: outfileEsm,
            sourcemap: true,
            platform: 'browser',
            target: 'es2020',
            legalComments: 'none',
            alias: PATH_ALIASES,
            plugins: [svelteRelativeImportsPlugin],
            logLevel: 'error'
        });
    }
};

export const listSvelteComponents = async () => {
    const entries = await fs.readdir(SVELTE_DIR, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.svelte'))
        .map((entry) => entry.name);
};

export const buildAllSvelte = async () => {
    await fs.mkdir(COMPONENT_DIR, { recursive: true });

    const components = await listSvelteComponents();

    if (components.length === 0) {
        console.warn('[build-svelte] No Svelte components found');
        return;
    }

    console.log('[build-svelte] components to build (esm):', components);

    console.log('[build-svelte] compiling sources');
    const entryFiles = [];
    for (const component of components) {
        console.log(`[build-svelte] compiling ${component}`);
        await compileComponentSource(component);
        const baseName = path.basename(component, '.svelte');
        entryFiles.push(path.join(COMPONENT_DIR, `${baseName}.js`));
    }

    console.log('[build-svelte] bundling outputs (esm, splitting)');
    await bundleAllComponents(entryFiles);

    return components;
};

if (fileURLToPath(import.meta.url) === __filename) {
    buildAllSvelte().catch((error) => {
        console.error('[build-svelte] failure', error);
        process.exit(1);
    });
}
