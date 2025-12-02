/**
 * CardManager Svelte Component Initialization (ESM)
 * Dynamically mounts the unified card manager without relying on globals.
 */
import CardManager from './components/CardManager.esm.js';
import { mountComponent } from './component-mount.js';

function init() {
    let target = document.getElementById('card-manager-root');
    if (!target) {
        target = document.createElement('div');
        target.id = 'card-manager-root';
        document.body.appendChild(target);
    }

    try {
        mountComponent(CardManager, { target });
    } catch (error) {
        console.error('[card-manager-init] Failed to mount CardManager', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
