document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('replay-app');
    if (!root || typeof ReplayRoomComponent === 'undefined') {
        return;
    }

    const gameId = root.dataset.gameId || 'local';
    ReplayRoomComponent.mount(ReplayRoomComponent.default, {
        target: root,
        props: { gameId }
    });
});
