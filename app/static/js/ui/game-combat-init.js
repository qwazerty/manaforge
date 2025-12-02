import GameCombat, { mount } from './components/GameCombat.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.getElementById('game-combat-root') || document.body;
        if (!target) return;
        try {
            mount(GameCombat, { target });
        } catch (error) {
            console.error('[GameCombat] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
