(function initActionHistoryPanel() {
    if (typeof document === 'undefined') {
        return;
    }

    let mounted = false;

    const mountComponent = () => {
        if (mounted) {
            return;
        }

        if (
            typeof ActionHistoryComponent === 'undefined' ||
            typeof ActionHistoryComponent.mount !== 'function'
        ) {
            console.error('[ActionHistory] component bundle is missing');
            return;
        }

        const target = document.getElementById('action-history-panel');
        if (!target) {
            // Panel not yet in DOM, try again shortly.
            requestAnimationFrame(mountComponent);
            return;
        }

        try {
            ActionHistoryComponent.mount(ActionHistoryComponent.default, {
                target
            });
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
