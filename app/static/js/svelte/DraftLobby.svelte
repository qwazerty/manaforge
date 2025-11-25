<script>
    import { onMount } from 'svelte';

    let roomName = $state('');
    let draftMode = $state('set');
    let setTerm = $state('');
    let setCode = $state('');
    let setFullName = $state('');
    let cubeUrl = $state('');
    let cubeList = $state('');
    let isProcessing = $state(false);
    let status = $state({ message: '', type: '' });
    let sets = $state([]);
    let isLoadingSets = $state(false);
    let suggestionsOpen = $state(false);
    let rooms = $state([]);
    let roomsLoading = $state(false);

    let setInputEl = $state();
    let suggestionsEl = $state();

    const generateId = (length = 8) => Math.random().toString(36).substring(2, 2 + length);

    const draftType = $derived.by(() => {
        if (draftMode === 'cube') return 'cube';
        if (draftMode === 'sealed') return 'sealed';
        return 'booster_draft';
    });

    const isSetMode = $derived(draftMode === 'set' || draftMode === 'sealed');
    const hasSearchTerm = $derived(setTerm.trim().length > 0);

    const normalizedSets = $derived.by(() => {
        return [...sets].map((set) => ({
            ...set,
            searchCode: (set.code ?? '').toString().toLowerCase(),
            searchName: (set.name ?? '').toString().toLowerCase()
        }));
    });

    const sortedSets = $derived.by(() => {
        return [...normalizedSets].sort((a, b) => {
            const aDate = new Date(a?.released_at || 0).getTime();
            const bDate = new Date(b?.released_at || 0).getTime();
            return bDate - aDate;
        });
    });

    const filteredSets = $derived.by(() => {
        const term = setTerm.trim().toLowerCase();
        if (!term) return sortedSets;
        const byName = sortedSets.filter((set) => set.searchName?.includes(term));
        const byCode = sortedSets.filter((set) => set.searchCode?.includes(term));
        const merged = [...byName];
        byCode.forEach((set) => {
            if (!merged.find((s) => s.searchCode === set.searchCode && s.searchName === set.searchName)) {
                merged.push(set);
            }
        });
        return merged;
    });

    const displayedSets = $derived.by(() => {
        if (hasSearchTerm) {
            return filteredSets;
        }
        return sortedSets.slice(0, 10);
    });

    function formatDraftTypeLabel(rawType) {
        const normalized = (rawType || '').toString().toLowerCase();
        if (normalized === 'sealed') return 'Sealed';
        if (normalized === 'cube') return 'Cube Draft';
        return 'Draft';
    }

    function generateRandomRoomName() {
        const ADJECTIVES = ['Mystic', 'Arcane', 'Forbidden', 'Ancient', 'Cosmic', 'Shadowy', 'Radiant', 'Eternal'];
        const NOUNS = ['Nexus', 'Crucible', 'Sanctum', 'Rift', 'Spire', 'Obelisk', 'Chamber', 'Gauntlet'];

        const randomAdjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const randomNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        const randomNumber = Math.floor(Math.random() * 999) + 1;

        roomName = `${randomAdjective}-${randomNoun}-${randomNumber}`;
    }

    function normalizeSetPayload(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }
        if (Array.isArray(payload?.sets)) {
            return payload.sets;
        }
        if (Array.isArray(payload?.data)) {
            return payload.data;
        }
        return [];
    }

    function mapSetEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        const code = entry.code || entry.set_code || entry.id || '';
        const name = entry.name || entry.set_name || '';
        const released_at = entry.released_at || entry.releaseDate || entry.releasedAt || entry.date || null;
        const icon_svg_uri = entry.icon_svg_uri || entry.icon || entry.icon_uri || null;
        if (!code && !name) {
            return null;
        }
        return {
            code,
            name,
            released_at,
            icon_svg_uri
        };
    }

    async function ensureSetsLoaded() {
        if (isLoadingSets || sets.length) return;

        isLoadingSets = true;
        try {
            const response = await fetch('/api/v1/draft/sets');
            if (!response.ok) {
                sets = [];
                return;
            }
            const payload = await response.json();
            const normalized = normalizeSetPayload(payload)
                .map(mapSetEntry)
                .filter(Boolean);
            sets = normalized;
        } catch (error) {
            sets = [];
        } finally {
            isLoadingSets = false;
        }
    }

    async function handleSetInput(term) {
        setTerm = term;
        if (!isSetMode) {
            suggestionsOpen = false;
            return;
        }

        await ensureSetsLoaded();
        suggestionsOpen = true;
    }

    function selectSet(set) {
        setTerm = set.name ?? set.code ?? '';
        setCode = (set.code ?? '').toString().toLowerCase();
        setFullName = set.name ?? set.code ?? '';
        suggestionsOpen = false;
    }

    function closeSuggestionsIfOutside(event) {
        if (!suggestionsOpen) {
            return;
        }
        if (!setInputEl || !suggestionsEl) {
            suggestionsOpen = false;
            return;
        }
        if (setInputEl.contains(event.target) || suggestionsEl.contains(event.target)) {
            return;
        }
        suggestionsOpen = false;
    }

    function resetStatus() {
        status = { message: '', type: '' };
    }

    async function createDraftRoom() {
        resetStatus();
        if (!roomName.trim()) {
            status = { message: 'Enter a limited room name.', type: 'error' };
            return;
        }

        const creatorId = `player-${generateId(9)}`;
        const payload = {
            name: roomName.trim(),
            creator_id: creatorId,
            set_code: '',
            set_name: '',
            use_cube: draftMode === 'cube',
            draft_type: draftType
        };

        if (draftMode === 'cube') {
            if (!cubeUrl.trim() && !cubeList.trim()) {
                status = { message: 'Provide a CubeCobra URL or paste a cube list.', type: 'error' };
                return;
            }
            payload.set_code = 'cube';
            payload.set_name = 'Custom Cube';
            payload.cube_name = payload.set_name;
            payload.cube_url = cubeUrl.trim() || null;
            payload.cube_list = cubeList.trim() || null;
        } else {
            if (!setCode.trim()) {
                status = { message: 'Select a set to draft.', type: 'error' };
                return;
            }
            payload.set_code = setCode.trim();
            payload.set_name = setFullName.trim() || setTerm.trim() || setCode.trim();
        }

        isProcessing = true;
        try {
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

            let errorMessage = 'Failed to create limited room.';
            try {
                const errorPayload = await response.json();
                if (errorPayload?.detail) {
                    errorMessage = errorPayload.detail;
                }
            } catch {
                // ignore parse errors
            }
            status = { message: errorMessage, type: 'error' };
        } catch (error) {
            status = { message: 'Unexpected error while creating the room.', type: 'error' };
            console.error(error);
        } finally {
            isProcessing = false;
        }
    }

    async function loadDraftRooms() {
        roomsLoading = true;
        try {
            const response = await fetch('/api/v1/draft/rooms');
            if (!response.ok) {
                rooms = [];
                return;
            }
            rooms = await response.json();
        } catch (error) {
            console.error('Failed to load limited rooms', error);
            rooms = [];
        } finally {
            roomsLoading = false;
        }
    }

    async function joinDraftRoom(roomId) {
        const playerId = `player-${generateId(9)}`;
        try {
            const response = await fetch(`/api/v1/draft/rooms/${roomId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: playerId })
            });

            if (response.ok) {
                window.location.href = `/draft/${roomId}?player=${playerId}`;
                return;
            }
            status = { message: 'Failed to join limited room. It might be full or already started.', type: 'error' };
        } catch (error) {
            status = { message: 'Unexpected error while joining the room.', type: 'error' };
            console.error(error);
        }
    }

    onMount(() => {
        generateRandomRoomName();
        loadDraftRooms();

        const handleClick = (event) => closeSuggestionsIfOutside(event);
        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('click', handleClick);
        };
    });
</script>

<div class="py-12 px-4">
    <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
            <h1 class="font-magic text-4xl md:text-5xl font-bold text-arena-accent mb-4">
                📦 Limited Lobby
            </h1>
            <p class="text-xl text-arena-text-dim">
                Create or join a limited room to build your deck.
            </p>
        </div>

        <div class="arena-card rounded-xl mb-8">
            <div class="p-8">
                <h2 class="font-magic text-3xl font-bold text-arena-accent mb-2 text-center">Create a Limited Room</h2>
                <div class="max-w-2xl mx-auto space-y-6">
                    <div class="relative">
                        <input
                            type="text"
                            bind:value={roomName}
                            placeholder="Enter Limited Room Name..."
                            class="w-full px-6 py-4 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200 text-center text-lg font-semibold"
                        >
                        <button
                            class="absolute left-4 top-1/2 transform -translate-y-1/2 text-arena-accent hover:text-arena-accent-light transition-colors"
                            title="Generate random name"
                            onclick={generateRandomRoomName}
                        >
                            🎲
                        </button>
                    </div>

                    <div>
                        <label for="draftMode" class="block text-arena-text-dim mb-2">Limited Mode</label>
                        <select
                            id="draftMode"
                            bind:value={draftMode}
                            class="w-full px-6 py-4 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200"
                            onchange={() => { suggestionsOpen = false; }}
                        >
                            <option value="set">Set Booster Draft</option>
                            <option value="sealed">Sealed Deck</option>
                            <option value="cube">Cube Draft</option>
                        </select>
                    </div>

                    {#if isSetMode}
                        <div id="set-options">
                            <label for="setName" class="block text-arena-text-dim mb-2">Set Name</label>
                            <input
                                id="setName"
                                type="text"
                                bind:value={setTerm}
                                placeholder="Search for a set (e.g., Dominaria United)"
                                class="w-full px-6 py-4 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200"
                                onfocus={() => { suggestionsOpen = true; ensureSetsLoaded(); }}
                                oninput={(event) => handleSetInput(event.target.value)}
                                bind:this={setInputEl}
                            >
                            <div id="set-suggestions" class="mt-2" bind:this={suggestionsEl}>
                                {#if isLoadingSets}
                                    <div class="p-4 text-center text-arena-muted text-sm">
                                        Loading sets...
                                    </div>
                                {:else if suggestionsOpen}
                                    {#if displayedSets.length === 0}
                                        <div class="p-4 text-center text-arena-muted text-sm">
                                            {#if hasSearchTerm}
                                                No sets found.
                                            {:else}
                                                Type a set name to search.
                                            {/if}
                                        </div>
                                    {:else}
                                        <div class="max-h-72 overflow-y-auto border border-arena-accent/20 rounded-lg divide-y divide-arena-accent/10 bg-arena-surface/90 backdrop-blur">
                                            {#each displayedSets as set (set.code)}
                                                <button
                                                    type="button"
                                                    class="w-full flex items-center justify-between px-4 py-3 hover:bg-arena-surface transition-colors text-left"
                                                    onclick={() => selectSet(set)}
                                                >
                                                    <div class="flex items-center gap-3">
                                                        {#if set.icon_svg_uri}
                                                            <img src={set.icon_svg_uri} alt={`${String(set.code ?? '').toUpperCase()} icon`} class="w-8 h-8">
                                                        {:else}
                                                            <div class="w-8 h-8 rounded-full bg-arena-accent/20"></div>
                                                        {/if}
                                                        <div>
                                                            <p class="font-semibold text-sm md:text-base text-arena-text">{set.name ?? 'Unknown Set'}</p>
                                                            <p class="text-xs text-arena-muted uppercase tracking-wide">{String(set.code ?? '').toUpperCase()}</p>
                                                        </div>
                                                    </div>
                                                    <span class="text-xs text-arena-muted">{set.released_at ?? 'TBD'}</span>
                                                </button>
                                            {/each}
                                        </div>
                                    {/if}
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <div id="cube-options" class="space-y-4">
                            <div>
                                <label for="cubeUrl" class="block text-arena-text-dim mb-2">CubeCobra List URL</label>
                                <input
                                    id="cubeUrl"
                                    type="text"
                                    bind:value={cubeUrl}
                                    placeholder="https://cubecobra.com/cube/list/yourcube"
                                    class="w-full px-6 py-4 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200"
                                >
                                <p class="text-xs text-arena-muted mt-1">We will automatically fetch the MTGO export from CubeCobra using the provided list or download URL.</p>
                            </div>
                            <div>
                                <label for="cubeList" class="block text-arena-text-dim mb-2">Import Cube List</label>
                                <textarea
                                    id="cubeList"
                                    rows="5"
                                    bind:value={cubeList}
                                    placeholder="Optional: paste a plain text list (e.g., MTGO export) if you do not have a URL."
                                    class="w-full px-6 py-4 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200"
                                ></textarea>
                                <p class="text-xs text-arena-muted mt-1">Paste an MTGO-style list: we will parse it and create 15-card packs.</p>
                            </div>
                        </div>
                    {/if}

                    <button
                        class="arena-button w-full py-4 px-8 rounded-lg font-semibold text-xl transition-all duration-300 group {isProcessing ? 'opacity-50 cursor-not-allowed' : ''}"
                        onclick={createDraftRoom}
                        disabled={isProcessing}
                    >
                        {#if isProcessing}
                            <span class="mr-3 animate-spin">⚡</span>
                            Creating...
                            <span class="ml-3 animate-pulse">⏳</span>
                        {:else}
                            Create Room
                        {/if}
                    </button>

                    {#if status.message}
                        <div class="text-center">
                            <div class="arena-surface px-4 py-2 rounded-lg mt-2 animate-pulse
                                {status.type === 'error' ? 'border-red-500/50 text-red-400' :
                                 status.type === 'success' ? 'border-green-500/50 text-green-400' :
                                 'border-yellow-500/50 text-yellow-400'}">
                                {status.type === 'error' ? '❌' :
                                 status.type === 'success' ? '✨' : '⏳'}
                                {status.message}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <div class="arena-card rounded-xl">
            <div class="p-8">
                <h2 class="font-magic text-3xl font-bold text-arena-accent mb-2 text-center">Join a Limited Room</h2>
                <div class="space-y-4">
                    {#if roomsLoading}
                        <div class="text-center text-arena-text-dim py-4">Loading limited rooms...</div>
                    {:else if rooms.length === 0}
                        <p class="text-center text-arena-text-dim">No active limited rooms found.</p>
                    {:else}
                        {#each rooms as room (room.id)}
                            <div class="p-4 bg-arena-surface rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <h3 class="font-bold text-lg">{room.name}</h3>
                                    <p class="text-sm text-arena-text-dim">
                                        {formatDraftTypeLabel(room.draft_type)} • {room.set_name} - {room.players?.length ?? 0}/{room.max_players} players
                                    </p>
                                </div>
                                <button class="arena-button px-4 py-2 rounded-lg text-sm" onclick={() => joinDraftRoom(room.id)}>
                                    Join
                                </button>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
