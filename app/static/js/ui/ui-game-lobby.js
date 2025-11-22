document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('svelte-game-lobby');
    if (target && typeof GameLobbyComponent !== 'undefined') {
        GameLobbyComponent.mount(GameLobbyComponent.default, {
            target: target
        });
    }
});
