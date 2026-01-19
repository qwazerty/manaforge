/**
 * ManaForge SPA Entry Point
 * Mounts the main App component with client-side routing
 */
import { mount } from 'svelte';
import App from '@svelte/App.svelte';

// Side-effect modules (global utilities)
import './ui/ui-global.js';

// Mount the SPA when DOM is ready
const onReady = (fn: () => void) => {
    console.log('[ManaForge] Checking document ready state:', document.readyState);
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
             console.log('[ManaForge] DOMContentLoaded fired');
             fn();
        });
    } else {
        console.log('[ManaForge] Document already ready, executing immediately');
        fn();
    }
};

onReady(() => {
    console.log('[ManaForge] Starting initialization...');
    const target = document.getElementById('app');
    if (target) {
        try {
            console.log('[ManaForge] Found #app target, clearing children...');
            target.replaceChildren();
            console.log('[ManaForge] Mounting Svelte5 App...');
            const app = mount(App, { target });
            console.log('[ManaForge] App mounted successfully:', app);
            
            // Debug global access
            (window as any).__MANAFORGE_APP__ = app;
        } catch (error) {
            console.error('[ManaForge] Failed to mount App', error);
            const banner = document.createElement('div');
            banner.className = 'p-4 m-4 rounded-lg border border-red-500/30 bg-red-900/40 text-red-200';
            banner.textContent = 'ManaForge failed to initialize. Check console logs for details.';
            document.body.prepend(banner);
        }
    } else {
        console.error('[ManaForge] #app root not found');
        const banner = document.createElement('div');
        banner.className = 'p-4 m-4 rounded-lg border border-red-500/30 bg-red-900/40 text-red-200';
        banner.textContent = 'ManaForge failed to find the #app mount point.';
        document.body.prepend(banner);
    }
});
