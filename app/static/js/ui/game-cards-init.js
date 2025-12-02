/**
 * GameCardsModule Initialization
 * Auto-mounts the GameCardsModule Svelte component to expose window.GameCards API
 */
(function() {
    'use strict';

    if (typeof GameCardsModuleComponent === 'undefined') {
        console.error('[game-cards-init] GameCardsModuleComponent not loaded');
        return;
    }

    // Create a hidden mount point for the module
    const mountPoint = document.createElement('div');
    mountPoint.id = 'game-cards-module-mount';
    mountPoint.style.display = 'none';
    document.body.appendChild(mountPoint);

    // Mount the component to expose window.GameCards
    GameCardsModuleComponent.mount(GameCardsModuleComponent.default, {
        target: mountPoint
    });

    console.log('[game-cards-init] GameCards module initialized');
})();
