(function bootstrapUIZonesManager() {
    if (typeof UIZonesManagerComponent === 'undefined' || typeof UIZonesManagerComponent.mount !== 'function') {
        console.error('[UIZonesManager] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        UIZonesManagerComponent.mount(UIZonesManagerComponent.default, {
            target
        });
    } catch (error) {
        console.error('[UIZonesManager] failed to initialize', error);
    }
})();
