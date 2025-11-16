(function () {
    if (window.gameData && Object.keys(window.gameData).length) {
        return;
    }
    const source = document.querySelector('[data-game-config]');
    if (!source || !source.dataset.gameConfig) {
        return;
    }
    try {
        const config = JSON.parse(source.dataset.gameConfig);
        if (config && typeof config === 'object') {
            window.gameData = config;
        }
    } catch (error) {
        console.warn('Unable to parse game configuration dataset', error);
    }
})();
