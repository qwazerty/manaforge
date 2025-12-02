/**
 * ManaForge Card Context Menu Initialization
 * Bootstraps the CardContextMenu Svelte component
 */
(function bootstrapCardContextMenu() {
    if (typeof CardContextMenuComponent === 'undefined' || typeof CardContextMenuComponent.mount !== 'function') {
        console.error('[CardContextMenu] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        CardContextMenuComponent.mount(CardContextMenuComponent.default, {
            target
        });
    } catch (error) {
        console.error('[CardContextMenu] failed to initialize', error);
    }
})();
