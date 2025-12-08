import { mount } from 'svelte';
import DeckManager from '@svelte/DeckManager.svelte';

const init = () => {
    const target = document.getElementById('deck-manager-root');
    if (!target) return;
    try {
        mount(DeckManager, { target });
    } catch (error) {
        console.error('[deck-manager] failed to mount', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
