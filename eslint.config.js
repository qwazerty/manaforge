import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

// Global variables used across the application
const appGlobals = {
    // Game modules
    GameCore: 'readonly',
    GameCards: 'readonly',
    GameActions: 'readonly',
    GameCombat: 'readonly',
    GameUI: 'readonly',
    GameSocket: 'readonly',
    GameUtils: 'readonly',
    // UI modules
    UIConfig: 'readonly',
    UIUtils: 'readonly',
    UIZonesManager: 'readonly',
    UIRenderersTemplates: 'readonly',
    UIBattleChat: 'readonly',
    UICardManager: 'readonly',
    UIHorizontalScroll: 'readonly',
    // Components
    CardPreviewModal: 'readonly',
    CardContextMenu: 'readonly',
    ZoneManager: 'readonly',
    // External libraries
    Chart: 'readonly',
    // Utility functions
    addTargetingArrow: 'readonly'
};

export default [
    js.configs.recommended,
    ...svelte.configs['flat/recommended'],
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...appGlobals
            }
        },
        rules: {
            // Disable rules that are too noisy for this codebase
            'no-unused-vars': ['warn', { 
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            'svelte/no-at-html-tags': 'warn',
            'svelte/require-each-key': 'warn',
            'svelte/prefer-svelte-reactivity': 'warn',
            'svelte/no-useless-mustaches': 'warn',
            'svelte/no-unused-svelte-ignore': 'warn',
            'no-unsafe-finally': 'warn'
        }
    },
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parserOptions: {
                parser: null
            }
        }
    },
    {
        ignores: [
            'node_modules/**',
            'app/static/js/ui/components/**',
            'app/static/js/**/*.bundle.js',
            'app/static/js/**/*.esm.js',
            '**/*.min.js'
        ]
    }
];
