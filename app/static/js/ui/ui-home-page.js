import HomePage, { mount } from './components/HomePage.esm.js';

const init = () => {
    const root = document.getElementById('home-root');
    if (!root) return;
    try {
        mount(HomePage, { target: root });
    } catch (error) {
        console.error('[home-page] failed to mount homepage component', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
