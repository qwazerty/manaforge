document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('replay-lobby-root');
    if (!root || typeof ReplayLobbyComponent === 'undefined') {
        return;
    }

    const mount = typeof ReplayLobbyComponent.mount === 'function'
        ? ReplayLobbyComponent.mount
        : null;
    if (!mount) {
        console.error('[replay-lobby] ReplayLobbyComponent.mount is missing');
        return;
    }

    try {
        mount(ReplayLobbyComponent.default, { target: root });
    } catch (error) {
        console.error('[replay-lobby] failed to mount ReplayLobby', error);
    }
});
