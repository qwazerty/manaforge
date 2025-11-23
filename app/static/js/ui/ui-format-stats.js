document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('format-stats-root');
    const dataEl = document.getElementById('format-stats-props');

    if (!root || typeof FormatStatsComponent === 'undefined') {
        return;
    }

    let stats = null;
    if (dataEl?.textContent) {
        try {
            stats = JSON.parse(dataEl.textContent);
        } catch (error) {
            console.error('[format-stats] unable to parse data payload', error);
        }
    }

    try {
        FormatStatsComponent.mount(FormatStatsComponent.default, {
            target: root,
            props: { stats }
        });
    } catch (error) {
        console.error('[format-stats] failed to mount component', error);
    }
});
