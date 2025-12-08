import { mount } from 'svelte';
import DraftRoom from '@svelte/DraftRoom.svelte';

const init = () => {
    const root = document.getElementById('draft-room-root');
    if (!root) return;

    let room = null;
    if (root.dataset?.room) {
        try {
            room = JSON.parse(root.dataset.room);
        } catch (error) {
            console.error('[draft-room] unable to parse room payload', error);
        }
    }

    try {
        mount(DraftRoom, { target: root, props: { room } });
    } catch (error) {
        console.error('[draft-room] failed to mount', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
