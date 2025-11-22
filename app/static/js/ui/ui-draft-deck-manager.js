document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('draft-deck-builder-root');
    if (target && typeof DeckManagerComponent !== 'undefined') {
        DeckManagerComponent.mount(DeckManagerComponent.default, {
            target: target,
            props: { embedded: true }
        });
    }
});
