(function () {
    let setInput;
    let suggestionsDiv;
    let setCodeInput;
    let setFullNameInput;
    let draftModeSelect;
    let setOptionsContainer;
    let cubeOptionsContainer;
    let allSets = [];
    let isLoadingSets = false;

    function isSetDraftMode() {
        if (!draftModeSelect) {
            draftModeSelect = document.getElementById('draftMode');
        }
        return !draftModeSelect || draftModeSelect.value === 'set';
    }

    function updateDraftModeUI() {
        const inSetMode = isSetDraftMode();
        if (!setOptionsContainer) {
            setOptionsContainer = document.getElementById('set-options');
        }
        if (!cubeOptionsContainer) {
            cubeOptionsContainer = document.getElementById('cube-options');
        }
        if (setOptionsContainer) {
            setOptionsContainer.classList.toggle('hidden', !inSetMode);
        }
        if (cubeOptionsContainer) {
            cubeOptionsContainer.classList.toggle('hidden', inSetMode);
        }
        if (!inSetMode) {
            hideSetSuggestions();
        }
    }

    function initializeDraftModeControls() {
        draftModeSelect = document.getElementById('draftMode');
        if (draftModeSelect) {
            draftModeSelect.addEventListener('change', updateDraftModeUI);
        }
        updateDraftModeUI();
    }

    async function ensureSetsLoaded() {
        if (allSets.length || isLoadingSets) {
            return allSets;
        }

        isLoadingSets = true;
        try {
            const response = await fetch('/api/v1/draft/sets');
            if (!response.ok) {
                allSets = [];
                return allSets;
            }

            allSets = await response.json();
            return allSets;
        } catch (error) {
            console.warn('Failed to load set list', error);
            allSets = [];
            return allSets;
        } finally {
            isLoadingSets = false;
        }
    }

    function renderLoadingSets() {
        if (!suggestionsDiv) {
            return;
        }

        suggestionsDiv.innerHTML = `
            <div class="p-4 text-center text-arena-muted text-sm">
                Loading sets...
            </div>
        `;
    }

    function renderSetSuggestions(sets) {
        if (!suggestionsDiv) {
            return;
        }

        if (!sets.length) {
            suggestionsDiv.innerHTML = `
                <div class="p-4 text-center text-arena-muted text-sm">
                    No sets found.
                </div>
            `;
            return;
        }

        suggestionsDiv.innerHTML = `
            <div class="max-h-72 overflow-y-auto border border-arena-accent/20 rounded-lg divide-y divide-arena-accent/10 bg-arena-surface/90 backdrop-blur">
                ${sets.map(set => `
                    <button
                        type="button"
                        class="w-full flex items-center justify-between px-4 py-3 hover:bg-arena-surface transition-colors text-left"
                        data-code="${set.code ?? ''}"
                        data-name="${encodeURIComponent(set.name ?? '')}"
                    >
                        <div class="flex items-center gap-3">
                            ${set.icon_svg_uri ? `<img src="${set.icon_svg_uri}" alt="${String(set.code ?? '').toUpperCase()} icon" class="w-8 h-8">` : `<div class="w-8 h-8 rounded-full bg-arena-accent/20"></div>`}
                            <div>
                                <p class="font-semibold text-sm md:text-base text-arena-text">${set.name ?? 'Unknown Set'}</p>
                                <p class="text-xs text-arena-muted uppercase tracking-wide">${String(set.code ?? '').toUpperCase()}</p>
                            </div>
                        </div>
                        <span class="text-xs text-arena-muted">${set.released_at ?? 'TBD'}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    function hideSetSuggestions() {
        if (suggestionsDiv) {
            suggestionsDiv.innerHTML = '';
        }
    }

    function getFilteredSets(term) {
        if (!term) {
            return allSets;
        }

        const normalized = term.toLowerCase();
        return allSets.filter(set =>
            (set.name ?? '').toLowerCase().includes(normalized) ||
            (set.code ?? '').toLowerCase().includes(normalized)
        );
    }

    async function showSetSuggestions() {
        if (!setInput) {
            return;
        }

        if (!isSetDraftMode()) {
            hideSetSuggestions();
            return;
        }

        if (!allSets.length) {
            renderLoadingSets();
            await ensureSetsLoaded();
        }

        const filtered = getFilteredSets(setInput.value.trim());
        renderSetSuggestions(filtered);
    }

    async function handleSetInput() {
        if (!setInput) {
            return;
        }

        if (!isSetDraftMode()) {
            hideSetSuggestions();
            return;
        }

        if (!allSets.length) {
            renderLoadingSets();
            await ensureSetsLoaded();
        }

        const filtered = getFilteredSets(setInput.value.trim());
        renderSetSuggestions(filtered);
    }

    function selectSet(code, name) {
        if (!setInput || !setCodeInput || !setFullNameInput) {
            return;
        }

        setInput.value = name;
        setCodeInput.value = code;
        setFullNameInput.value = name;
        hideSetSuggestions();
    }

    async function createDraftRoom() {
        const roomNameInput = document.getElementById('roomName');
        const roomName = roomNameInput ? roomNameInput.value : '';
        const mode = draftModeSelect ? draftModeSelect.value : 'set';
        const creatorId = `player-${Math.random().toString(36).substr(2, 9)}`;
        const payload = {
            name: roomName,
            creator_id: creatorId,
            set_code: '',
            set_name: '',
            use_cube: mode === 'cube'
        };

        if (mode === 'cube') {
            const cubeUrlInput = document.getElementById('cubeUrl');
            const cubeListInput = document.getElementById('cubeList');
            const cubeUrl = cubeUrlInput ? cubeUrlInput.value.trim() : '';
            const cubeList = cubeListInput ? cubeListInput.value.trim() : '';

            if (!cubeUrl && !cubeList) {
                alert('Provide a CubeCobra URL or paste a cube list.');
                return;
            }

            payload.set_code = 'cube';
            payload.set_name = 'Custom Cube';
            payload.cube_name = payload.set_name;
            payload.cube_url = cubeUrl || null;
            payload.cube_list = cubeList || null;
        } else {
            const setCode = setCodeInput ? setCodeInput.value : document.getElementById('setCode')?.value;
            const setFullName = setFullNameInput ? setFullNameInput.value : document.getElementById('setFullName')?.value;

            if (!setCode) {
                alert('Please select a set.');
                return;
            }

            payload.set_code = setCode;
            payload.set_name = setFullName || (setInput ? setInput.value : setCode);
        }

        const response = await fetch('/api/v1/draft/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const room = await response.json();
            window.location.href = `/draft/${room.id}?player=${creatorId}`;
            return;
        }

        let errorMessage = 'Failed to create draft room.';
        try {
            const errorPayload = await response.json();
            if (errorPayload && errorPayload.detail) {
                errorMessage = errorPayload.detail;
            }
        } catch (err) {
            // Ignore JSON parsing issues and use default message.
        }
        alert(errorMessage);
    }

    async function loadDraftRooms() {
        const response = await fetch('/api/v1/draft/rooms');
        const rooms = await response.json();
        const listDiv = document.getElementById('draft-room-list');
        if (!listDiv) {
            return;
        }
        if (!rooms.length) {
            listDiv.innerHTML = `<p class="text-center text-arena-text-dim">No active draft rooms found.</p>`;
            return;
        }
        listDiv.innerHTML = rooms.map(room => `
            <div class="p-4 bg-arena-surface rounded-lg flex justify-between items-center">
                <div>
                    <h3 class="font-bold text-lg">${room.name}</h3>
                    <p class="text-sm text-arena-text-dim">${room.set_name} - ${room.players.length}/${room.max_players} players</p>
                </div>
                <button onclick="joinDraftRoom('${room.id}')" class="arena-button px-4 py-2 rounded-lg">Join</button>
            </div>
        `).join('');
    }

    async function joinDraftRoom(roomId) {
        const playerId = `player-${Math.random().toString(36).substr(2, 9)}`;
        const response = await fetch(`/api/v1/draft/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: playerId })
        });

        if (response.ok) {
            window.location.href = `/draft/${roomId}?player=${playerId}`;
        } else {
            alert('Failed to join draft room. It might be full or already started.');
        }
    }

    function generateRandomRoomName() {
        const ADJECTIVES = ['Mystic', 'Arcane', 'Forbidden', 'Ancient', 'Cosmic', 'Shadowy', 'Radiant', 'Eternal'];
        const NOUNS = ['Nexus', 'Crucible', 'Sanctum', 'Rift', 'Spire', 'Obelisk', 'Chamber', 'Gauntlet'];

        const randomAdjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const randomNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        const randomNumber = Math.floor(Math.random() * 999) + 1;

        const randomName = `${randomAdjective}-${randomNoun}-${randomNumber}`;
        const roomNameInput = document.getElementById('roomName');
        if (roomNameInput) {
            roomNameInput.value = randomName;
        }
    }

    function initializeSetSelection() {
        setInput = document.getElementById('setName');
        suggestionsDiv = document.getElementById('set-suggestions');
        setCodeInput = document.getElementById('setCode');
        setFullNameInput = document.getElementById('setFullName');

        if (!setInput || !suggestionsDiv) {
            return;
        }

        setInput.addEventListener('focus', showSetSuggestions);
        setInput.addEventListener('input', handleSetInput);

        suggestionsDiv.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button[data-code]');
            if (!targetButton) {
                return;
            }

            const code = targetButton.dataset.code ?? '';
            const name = targetButton.dataset.name ? decodeURIComponent(targetButton.dataset.name) : '';
            selectSet(code, name);
        });

        document.addEventListener('click', (event) => {
            if (!setInput || !suggestionsDiv) {
                return;
            }

            if (event.target === setInput || suggestionsDiv.contains(event.target)) {
                return;
            }

            hideSetSuggestions();
        });
    }

    window.createDraftRoom = createDraftRoom;
    window.joinDraftRoom = joinDraftRoom;
    window.generateRandomRoomName = generateRandomRoomName;

    window.addEventListener('load', () => {
        initializeDraftModeControls();
        initializeSetSelection();
        loadDraftRooms();
        generateRandomRoomName();
    });
})();
