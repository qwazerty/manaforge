import WebSocketManager, { mount } from './components/WebSocketManager.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.body;
        if (!target) return;
        try {
            mount(WebSocketManager, { target });
        } catch (error) {
            console.error('[WebSocketManager] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
