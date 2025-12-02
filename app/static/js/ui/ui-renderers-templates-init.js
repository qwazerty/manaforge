import UIRenderersTemplates, { mount } from './components/UIRenderersTemplates.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.body;
        if (!target) return;
        try {
            mount(UIRenderersTemplates, { target });
        } catch (error) {
            console.error('[UIRenderersTemplates] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
