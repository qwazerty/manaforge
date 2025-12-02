import ActionHistory, { mount } from './components/ActionHistory.esm.js';

(function initActionHistoryPanel() {
    if (typeof document === 'undefined') {
        return;
    }

    let mounted = false;

    const mountComponent = () => {
        if (mounted) {
            return;
        }

        const target = document.getElementById('action-history-panel');
        if (!target) {
            requestAnimationFrame(mountComponent);
            return;
        }

        try {
            mount(ActionHistory, { target });
            mounted = true;
        } catch (error) {
            console.error('[ActionHistory] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            requestAnimationFrame(mountComponent);
        });
    } else {
        requestAnimationFrame(mountComponent);
    }
})();
