import GameLobby, { mount } from './components/GameLobby.esm.js';

const init = () => {
    const target = document.getElementById('svelte-game-lobby');
    if (!target) return;
    try {
        mount(GameLobby, { target });
    } catch (error) {
        console.error('[game-lobby] failed to mount', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
