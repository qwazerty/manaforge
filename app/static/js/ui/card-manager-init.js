/**
 * CardManager Svelte Component Initialization
 * Mounts the unified card manager component for popover management
 */
(function() {
    if (typeof CardManagerComponent === 'undefined') {
        console.warn('[card-manager-init] CardManagerComponent bundle not loaded');
        return;
    }

    const mount = typeof CardManagerComponent.mount === 'function'
        ? CardManagerComponent.mount
        : null;

    if (!mount) {
        console.warn('[card-manager-init] CardManagerComponent.mount not available');
        return;
    }

    function init() {
        let target = document.getElementById('card-manager-root');
        if (!target) {
            target = document.createElement('div');
            target.id = 'card-manager-root';
            document.body.appendChild(target);
        }

        try {
            mount(CardManagerComponent.default, { target });
        } catch (error) {
            console.error('[card-manager-init] Failed to mount CardManager', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
