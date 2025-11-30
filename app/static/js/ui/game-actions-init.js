(function bootstrapGameActions() {
    if (typeof GameActionsComponent === 'undefined' || typeof GameActionsComponent.mount !== 'function') {
        console.error('[GameActions] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        GameActionsComponent.mount(GameActionsComponent.default, {
            target
        });
    } catch (error) {
        console.error('[GameActions] failed to initialize', error);
    }
})();
