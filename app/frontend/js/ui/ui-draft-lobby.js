import { mount } from 'svelte';
import DraftLobby from '@svelte/DraftLobby.svelte';

const init = () => {
    const target = document.getElementById('svelte-draft-lobby');
    if (!target) return;
    try {
        mount(DraftLobby, { target });
    } catch (error) {
        console.error('[draft-lobby] failed to mount', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
