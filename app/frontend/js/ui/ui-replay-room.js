import { mount } from 'svelte';
import ReplayRoom from '@svelte/ReplayRoom.svelte';

const init = () => {
    const root = document.getElementById('replay-app');
    if (!root) return;
    const gameId = root.dataset.gameId || 'local';
    try {
        mount(ReplayRoom, { target: root, props: { gameId } });
    } catch (error) {
        console.error('[replay-room] failed to mount', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
