document.addEventListener('DOMContentLoaded', () => {
    const host = document.createElement('div');
    host.id = 'horizontal-scroll-root';
    document.body.appendChild(host);

    if (typeof HorizontalScrollManagerComponent === 'undefined') {
        console.error('[horizontal-scroll] component missing');
        return;
    }

    try {
        HorizontalScrollManagerComponent.mount(HorizontalScrollManagerComponent.default, { target: host });
    } catch (error) {
        console.error('[horizontal-scroll] failed to mount', error);
    }
});
