import CardContextMenu, { mount } from './components/CardContextMenu.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.body;
        if (!target) return;
        try {
            mount(CardContextMenu, { target });
        } catch (error) {
            console.error('[CardContextMenu] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
