import ErrorPage, { mount } from './components/ErrorPage.esm.js';

const init = () => {
    const root = document.getElementById('error-root');
    if (!root) return;

    const dataEl = document.getElementById('error-props');
    let props = {};
    if (dataEl?.textContent) {
        try {
            props = JSON.parse(dataEl.textContent);
        } catch (error) {
            console.error('[error-page] unable to parse props', error);
        }
    }

    try {
        mount(ErrorPage, { target: root, props });
    } catch (error) {
        console.error('[error-page] failed to mount', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
