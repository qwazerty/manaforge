document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('svelte-draft-lobby');
    if (target && typeof DraftLobbyComponent !== 'undefined') {
        DraftLobbyComponent.mount(DraftLobbyComponent.default, {
            target
        });
    }
});
