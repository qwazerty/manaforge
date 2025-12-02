/**
 * GameCardsModule Initialization
 * Auto-mounts the GameCardsModule Svelte component to expose window.GameCards API
 */
import GameCardsModule, { mount } from './components/GameCardsModule.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const mountPoint = document.createElement('div');
        mountPoint.id = 'game-cards-module-mount';
        mountPoint.style.display = 'none';
        document.body.appendChild(mountPoint);

        try {
            mount(GameCardsModule, { target: mountPoint });
        } catch (error) {
            console.error('[game-cards-init] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
