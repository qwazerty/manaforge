(function bootstrapGameCombat() {
    if (typeof GameCombatComponent === 'undefined' || typeof GameCombatComponent.mount !== 'function') {
        console.error('[GameCombat] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        GameCombatComponent.mount(GameCombatComponent.default, {
            target
        });
    } catch (error) {
        console.error('[GameCombat] failed to initialize', error);
    }
})();
