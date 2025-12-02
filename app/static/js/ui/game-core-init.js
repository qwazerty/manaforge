import GameCore, { mount } from './components/GameCore.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.getElementById('game-interface-root') || document.body;
        if (!target) return;
        try {
            mount(GameCore, { target });
        } catch (error) {
            console.error('[GameCore] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
