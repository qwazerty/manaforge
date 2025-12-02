import UIZonesManager, { mount } from './components/UIZonesManager.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.body;
        if (!target) return;
        try {
            mount(UIZonesManager, { target });
        } catch (error) {
            console.error('[UIZonesManager] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
