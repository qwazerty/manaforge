import HorizontalScrollManager, { mount } from './components/HorizontalScrollManager.esm.js';

const init = () => {
    const host = document.createElement('div');
    host.id = 'horizontal-scroll-root';
    document.body.appendChild(host);

    try {
        mount(HorizontalScrollManager, { target: host });
    } catch (error) {
        console.error('[horizontal-scroll] failed to mount', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
