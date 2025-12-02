import GameActions, { mount } from './components/GameActions.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.body;
        if (!target) return;
        try {
            mount(GameActions, { target });
        } catch (error) {
            console.error('[GameActions] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
