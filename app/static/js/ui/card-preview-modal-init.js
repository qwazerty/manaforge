import CardPreviewModal, { mount } from './components/CardPreviewModal.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.body;
        if (!target) return;
        try {
            mount(CardPreviewModal, { target });
        } catch (error) {
            console.error('[CardPreviewModal] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
