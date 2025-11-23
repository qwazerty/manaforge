document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('home-root');
    if (!root || typeof HomePageComponent === 'undefined') {
        return;
    }

    try {
        HomePageComponent.mount(HomePageComponent.default, { target: root });
    } catch (error) {
        console.error('[home-page] failed to mount homepage component', error);
    }
});
