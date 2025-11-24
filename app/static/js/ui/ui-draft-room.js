document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('draft-room-root');
    if (!root || typeof DraftRoomComponent === 'undefined') {
        return;
    }

    let room = null;
    if (root.dataset?.room) {
        try {
            room = JSON.parse(root.dataset.room);
        } catch (error) {
            console.error('[draft-room] unable to parse room payload', error);
        }
    }

    DraftRoomComponent.mount(DraftRoomComponent.default, {
        target: root,
        props: { room }
    });
});
