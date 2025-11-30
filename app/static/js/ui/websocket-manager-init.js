(function bootstrapWebSocketManager() {
    if (typeof WebSocketManagerComponent === 'undefined' || typeof WebSocketManagerComponent.mount !== 'function') {
        console.error('[WebSocketManager] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        WebSocketManagerComponent.mount(WebSocketManagerComponent.default, {
            target
        });
    } catch (error) {
        console.error('[WebSocketManager] failed to initialize', error);
    }
})();
