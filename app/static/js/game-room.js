(function () {
    const root = document.getElementById('game-setup-root');
    if (!root) {
        console.warn('[game-room] Missing #game-setup-root container');
        return;
    }

    const parseConfig = () => {
        if (window.gameRoomConfig) {
            return window.gameRoomConfig;
        }
        const payload = root.dataset?.gameRoomConfig;
        if (!payload) {
            return {};
        }
        try {
            const parsed = JSON.parse(payload) || {};
            window.gameRoomConfig = parsed;
            return parsed;
        } catch (error) {
            console.warn('[game-room] Unable to parse embedded config', error);
            return {};
        }
    };

    const renderFallback = (message) => {
        root.innerHTML = `
            <div class="max-w-2xl mx-auto bg-red-950/60 border border-red-500/40 rounded-xl p-6 text-sm text-red-50">
                ${message}
            </div>
        `;
    };

    const config = parseConfig();
    if (!config || !config.gameId) {
        renderFallback('Missing duel room configuration.');
        return;
    }

    if (typeof GameRoomSetupComponent === 'undefined') {
        renderFallback('GameRoomSetup bundle is not loaded.');
        return;
    }

    const mount = typeof GameRoomSetupComponent.mount === 'function'
        ? GameRoomSetupComponent.mount
        : null;
    if (!mount) {
        renderFallback('Unable to bootstrap the duel room UI.');
        return;
    }

    try {
        mount(GameRoomSetupComponent.default, {
            target: root,
            props: { config }
        });
    } catch (error) {
        console.error('[game-room] Failed to mount GameRoomSetup', error);
        renderFallback('An unexpected error prevented the duel room from loading.');
    }
})();
