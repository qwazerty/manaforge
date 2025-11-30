(function bootstrapGameCore() {
    if (typeof GameCoreComponent === 'undefined' || typeof GameCoreComponent.mount !== 'function') {
        console.error('[GameCore] component bundle is missing');
        return;
    }

    const target = document.getElementById('game-interface-root') || document.body;
    if (!target) {
        return;
    }

    try {
        GameCoreComponent.mount(GameCoreComponent.default, {
            target
        });
    } catch (error) {
        console.error('[GameCore] failed to initialize', error);
    }
})();
