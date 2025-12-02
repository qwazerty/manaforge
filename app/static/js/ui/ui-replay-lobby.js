import ReplayLobby, { mount } from './components/ReplayLobby.esm.js';

const init = () => {
    const root = document.getElementById('replay-lobby-root');
    if (!root) return;

    try {
        mount(ReplayLobby, { target: root });
    } catch (error) {
        console.error('[replay-lobby] failed to mount ReplayLobby', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
