document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('deck-manager-root');
    if (target && typeof DeckManagerComponent !== 'undefined') {
        DeckManagerComponent.mount(DeckManagerComponent.default, {
            target: target
        });
    }
});
