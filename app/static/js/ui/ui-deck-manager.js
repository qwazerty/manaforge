import DeckManager, { mount } from './components/DeckManager.esm.js';

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
