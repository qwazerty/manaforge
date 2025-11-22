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
    const draftTypeRaw = (roomData.draft_type || '').toString().toLowerCase();
    const deckLabel = draftTypeRaw === 'sealed'
        ? 'Sealed'
        : draftTypeRaw === 'cube'
            ? 'Cube Draft'
            : 'Draft';
    const resolvedSetName = (roomData.set_name || '').toString().trim() || 'Set';
    const resolvedRoomName = roomData.name || 'Room';

    window.MANAFORGE_DECK_CONTEXT = {
        deckId,
        deckName: `${deckLabel} - ${resolvedSetName} - ${resolvedRoomName}`,
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
        playerParam: playerParamRaw,
        draftType: draftTypeRaw
    };
})();
