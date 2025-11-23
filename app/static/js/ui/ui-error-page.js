document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('error-root');
    if (!root || typeof ErrorPageComponent === 'undefined') {
        return;
    }

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
        ErrorPageComponent.mount(ErrorPageComponent.default, { target: root, props });
    } catch (error) {
        console.error('[error-page] failed to mount', error);
    }
});
