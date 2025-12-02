/**
 * ManaForge Card Search Modal Initialization
 * Bootstraps the CardSearchModal Svelte component
 */
(function bootstrapCardSearchModal() {
    if (typeof CardSearchModalComponent === 'undefined' || typeof CardSearchModalComponent.mount !== 'function') {
        console.error('[CardSearchModal] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        CardSearchModalComponent.mount(CardSearchModalComponent.default, {
            target
        });
    } catch (error) {
        console.error('[CardSearchModal] failed to initialize', error);
    }
})();
