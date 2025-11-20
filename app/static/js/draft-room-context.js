(function () {
    const root = document.getElementById('draft-room-root');
    if (!root || !root.dataset || !root.dataset.room) {
        return;
    }

    let roomData = {};
    try {
        roomData = JSON.parse(root.dataset.room) || {};
    } catch (error) {
        console.warn('Unable to parse draft room dataset', error);
        roomData = {};
    }

    const params = new URLSearchParams(window.location.search);
    const playerParamRaw = params.get('player') || 'local';
    const sanitizedPlayer = (playerParamRaw || 'local').replace(/[^a-zA-Z0-9_-]/g, '');
    const deckId = `draft_${roomData.id || 'room'}_${sanitizedPlayer || 'player'}`;
    const resolvedSetName = roomData.set_name || 'Set';
    const resolvedRoomName = roomData.name || 'Room';

    window.MANAFORGE_DECK_CONTEXT = {
        deckId,
        deckName: `Draft - ${resolvedSetName} - ${resolvedRoomName}`,
        format: 'draft',
        forceDeckFormat: true,
        persistEmpty: true,
        suppressUrlUpdates: true
    };

    window.MANAFORGE_DRAFT_META = {
        roomId: roomData.id,
        roomName: roomData.name,
        setName: roomData.set_name,
        deckId,
        playerParam: playerParamRaw
    };
})();
