import { mount } from 'svelte';
import FormatStats from '@svelte/FormatStats.svelte';

const init = () => {
    const root = document.getElementById('format-stats-root');
    const dataEl = document.getElementById('format-stats-props');
    if (!root) return;

    let stats = null;
    if (dataEl?.textContent) {
        try {
            stats = JSON.parse(dataEl.textContent);
        } catch (error) {
            console.error('[format-stats] unable to parse data payload', error);
        }
    }

    try {
        mount(FormatStats, {
            target: root,
            props: { stats }
        });
    } catch (error) {
        console.error('[format-stats] failed to mount component', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
