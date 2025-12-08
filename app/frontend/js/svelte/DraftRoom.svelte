<script>
    import { onDestroy, onMount } from 'svelte';
    import { createPriceLookup, formatPrice, getCachedPrice } from '@lib/pricing';
    import DeckManager from './DeckManager.svelte';

    const DECK_MANAGER_IMPORT_KEY = 'manaforge:deck-manager:pending-import';

    const deepClone = (data) => {
        if (data === null || data === undefined) return null;
        try { return JSON.parse(JSON.stringify(data)); } catch { return null; }
    };

    let { room: initialRoom = null } = $props();

    let room = $state({});
    let playerId = $state('');
    let websocket = null;
    let selectedCardId = $state('');
    let isSubmittingPick = $state(false);
    let packStatus = $state('Waiting for draft to start...');
    let status = $state({ message: '', type: '' });
    let renameState = $state({ playerId: null, value: '', saving: false });
    let draftedCards = $state([]);
    let deckManagerReady = $state(false);
    let decklistPending = $state(false);
    let isStarting = $state(false);
    let sealedSyncNotified = $state(false);
    let deckContext = $state({ deckId: '', deckName: '', draftType: '' });
    let deckManagerVisible = $state(false);
    let lastRefreshAt = 0;
    
    // Price cache for draft cards
    let cardPrices = $state({});
    const queuePriceLookup = createPriceLookup({
        delay: 50,
        onPrices: (prices) => {
            cardPrices = { ...cardPrices, ...prices };
        }
    });
    let showPrices = $state(false);

    const draftType = $derived((room?.draft_type || '').toString().toLowerCase());
    const roomState = $derived((room?.state || '').toString().toLowerCase());
    const players = $derived(Array.isArray(room?.players) ? room.players : []);
    const currentPlayer = $derived(players.find((p) => p?.id === playerId) || null);
    const currentPack = $derived(
        sortCardsByRarity(Array.isArray(currentPlayer?.current_pack) ? currentPlayer.current_pack : [])
    );
    const draftLabel = $derived(getDraftLabelPrefix(draftType));
    const showExportActions = $derived(roomState === 'completed');
    const canManageBots = $derived(roomState === 'waiting' && !isStarting);
    const packHeader = $derived.by(() => {
        if (draftType === 'sealed' && roomState === 'completed') {
            return 'Sealed pool generated';
        }
        const packNumber = room?.current_pack_number ?? 1;
        const pickNumber = room?.current_pick_number ?? 1;
        return `Current Pack (Pack ${packNumber}, Pick ${pickNumber})`;
    });

    onMount(() => {
        playerId = resolvePlayerId();
        room = initialRoom || {};
        
        if (room?.id && playerId) {
            deckContext = buildDeckContext(room, playerId, draftType);
            applyGlobalContext(deckContext);
            applyRoomState(room);
            connectWebSocket();
        }
        
        window.addEventListener('manaforge:deck-manager-ready', handleDeckManagerReady);
        deckManagerVisible = true;

        return () => {
            cleanupWebsocket();
            window.removeEventListener('manaforge:deck-manager-ready', handleDeckManagerReady);
        };
    });

    onDestroy(() => {
        cleanupWebsocket();
    });

    function resolvePlayerId() {
        if (typeof window === 'undefined') {
            return 'local';
        }
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('player') || 'local';
        return raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
    }

    function buildDeckContext(currentRoom, currentPlayerId, type) {
        const sanitizedRoomId = (currentRoom?.id || 'room').toString();
        const deckId = `draft_${sanitizedRoomId}_${currentPlayerId || 'player'}`;
        const setName = (currentRoom?.set_name || '').toString().trim() || 'Set';
        const roomName = currentRoom?.name || 'Room';
        const label = getDraftLabelPrefix(type);
        return {
            deckId,
            deckName: `${label} - ${setName} - ${roomName}`,
            draftType: type
        };
    }

    function applyGlobalContext(context) {
        if (typeof window === 'undefined') {
            return;
        }
        window.MANAFORGE_DECK_CONTEXT = {
            deckId: context.deckId,
            deckName: context.deckName,
            format: 'draft',
            forceDeckFormat: true,
            persistEmpty: true,
            suppressUrlUpdates: true
        };
        window.MANAFORGE_DRAFT_META = {
            roomId: room?.id,
            roomName: room?.name,
            setName: room?.set_name,
            deckId: context.deckId,
            playerParam: playerId,
            draftType: context.draftType
        };
    }

    function connectWebSocket() {
        if (!room?.id || !playerId || typeof window === 'undefined') {
            setStatus('Missing draft metadata; cannot join room.', 'error');
            return;
        }
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const nextSocket = new WebSocket(
            `${wsProtocol}://${window.location.host}/ws/game/${room.id}?player=${playerId}`
        );

        nextSocket.onmessage = handleWebSocketMessage;
        nextSocket.onerror = () => setStatus('Connection issue, trying to stay in sync.', 'error');
        nextSocket.onclose = () => setStatus('Disconnected from draft. Refresh to reconnect.', 'error');

        websocket = nextSocket;
    }

    function cleanupWebsocket() {
        if (websocket) {
            websocket.close();
            websocket = null;
        }
    }

    function handleWebSocketMessage(event) {
        const payload = safeParse(event?.data);
        if (!payload || typeof payload !== 'object') {
            return;
        }

        if (payload.type === 'draft_starting') {
            handleDraftStarting();
            return;
        }

        if (payload.type === 'draft_state_update' && payload.room_state) {
            isStarting = false;
            applyRoomState(payload.room_state);
            return;
        }

        if (payload.type === 'decklist_data') {
            handleDecklistData(payload.decklist || '');
        }
    }

    function handleDraftStarting() {
        isStarting = true;
        packStatus = 'Starting draft...';
    }

    function applyRoomState(nextRoom) {
        room = nextRoom || {};
        const me = findPlayer(nextRoom, playerId);

        if (!me) {
            packStatus = 'Waiting to join the table...';
            draftedCards = [];
            return;
        }

        updatePackState(me, nextRoom);
        updateDraftedCards(me.drafted_cards || []);
        
        // Fetch prices for current pack cards
        if (Array.isArray(me.current_pack) && me.current_pack.length > 0) {
            fetchPricesForPack(me.current_pack);
        }
    }

    function findPlayer(nextRoom, targetPlayerId) {
        if (!nextRoom || !Array.isArray(nextRoom.players)) {
            return null;
        }
        return nextRoom.players.find((p) => p?.id === targetPlayerId) || null;
    }

    function updatePackState(me, state) {
        const normalizedState = (state?.state || '').toString().toLowerCase();
        const draftMode = (state?.draft_type || '').toString().toLowerCase();
        const hasPack = Array.isArray(me.current_pack) && me.current_pack.length > 0;

        if (normalizedState === 'completed') {
            packStatus = draftMode === 'sealed' ? 'Sealed pool ready.' : 'Draft complete!';
            selectedCardId = '';
            isSubmittingPick = false;
            return;
        }

        if (normalizedState !== 'drafting') {
            packStatus = 'Waiting for draft to start...';
            selectedCardId = '';
            isSubmittingPick = false;
            return;
        }

        if (me.has_picked_card) {
            packStatus = 'Waiting for other players to pick...';
            return;
        }

        if (!hasPack) {
            packStatus = 'Waiting for next pack...';
            isSubmittingPick = false;
            return;
        }

        packStatus = '';
        selectedCardId = '';
        isSubmittingPick = false;
    }

    function updateDraftedCards(cards) {
        draftedCards = Array.isArray(cards) ? cards.map(deepClone).filter(Boolean) : [];
        syncDeckBuilderWithDraft(draftedCards);

        if (
            draftType === 'sealed' &&
            roomState === 'completed' &&
            deckManagerReady &&
            !sealedSyncNotified
        ) {
            setStatus('Sealed pool synced to Deck Manager.', 'success');
            sealedSyncNotified = true;
        }
    }

    function setStatus(message, type = 'info') {
        status = { message, type };
    }

    function sendMessage(payload) {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            setStatus('Connection not ready. Try again in a moment.', 'error');
            return false;
        }
        websocket.send(JSON.stringify(payload));
        return true;
    }

    function pickCard(card) {
        if (!card || isSubmittingPick) {
            return;
        }
        const uniqueId = card.unique_id || card.id || card.card_id;
        if (!uniqueId) {
            setStatus('Unable to identify this card.', 'error');
            return;
        }
        const sent = sendMessage({ type: 'pick_card', card_unique_id: uniqueId });
        if (!sent) {
            return;
        }
        selectedCardId = uniqueId;
        isSubmittingPick = true;
        packStatus = 'Waiting for other players to pick...';
    }

    function addBot() {
        sendMessage({ type: 'add_bot' });
    }

    function fillBots() {
        sendMessage({ type: 'fill_bots' });
    }

    function startDraft() {
        const sent = sendMessage({ type: 'start_draft' });
        if (!sent) {
            // Fallback to REST API if WebSocket not ready
            triggerDraftStartFallback();
        }
        isStarting = true;
        packStatus = 'Starting draft...';
    }

    async function exportDecklist() {
        if (!sendMessage({ type: 'get_decklist' })) {
            return;
        }
        decklistPending = true;
        setStatus('Preparing decklist...', 'info');
    }

    async function handleDecklistData(decklist) {
        decklistPending = false;
        if (!decklist) {
            setStatus('No decklist available yet.', 'error');
            return;
        }
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(decklist);
                setStatus('Decklist copied to clipboard.', 'success');
                return;
            }
            throw new Error('Clipboard API unavailable');
        } catch (error) {
            console.error('Clipboard copy failed', error);
            downloadDecklistFallback(decklist);
            setStatus('Clipboard unavailable. Downloaded the list instead.', 'error');
        }
    }

    function downloadDecklistFallback(decklist) {
        if (typeof window === 'undefined') {
            return;
        }
        const blob = new Blob([decklist], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'drafted-deck.txt';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    function handleDeckManagerReady(event) {
        deckManagerReady = true;
        if (event?.detail?.deckId) {
            deckContext = { ...deckContext, deckId: event.detail.deckId };
        }
        syncDeckBuilderWithDraft(draftedCards);
    }

    function getCardIdentity(card) {
        if (!card) {
            return null;
        }
        return (
            card.id ||
            card.card_id ||
            card.scryfall_id ||
            card.unique_id ||
            (card.set && card.collector_number ? `${card.set}-${card.collector_number}` : card.name) ||
            null
        );
    }

    function buildDraftCardCounts(cards) {
        const counts = {};
        const samples = {};
        cards.forEach((card) => {
            const key = getCardIdentity(card);
            if (!key) {
                return;
            }
            if (!samples[key]) {
                samples[key] = card;
            }
            counts[key] = (counts[key] || 0) + 1;
        });
        return { counts, samples };
    }

    function getDeckManagerCardCounts() {
        if (!window?.DeckManager?.state?.entries) {
            return {};
        }
        const counts = {};
        Object.values(window.DeckManager.state.entries).forEach((entry) => {
            if (!entry?.card) return;
            const key = getCardIdentity(entry.card);
            if (!key) return;
            counts[key] = (counts[key] || 0) + (entry.quantity || 0);
        });
        return counts;
    }

    function removeDeckManagerCopies(cardKey, quantity) {
        if (!cardKey || !quantity || !window?.DeckManager?.state?.entries) {
            return;
        }
        let remaining = quantity;
        const entryIds = Object.keys(window.DeckManager.state.entries);
        for (const entryId of entryIds) {
            if (remaining <= 0) break;
            const entry = window.DeckManager.state.entries[entryId];
            if (!entry?.card) continue;
            const entryKey = getCardIdentity(entry.card);
            if (entryKey !== cardKey) continue;
            const currentQty = entry.quantity || 0;
            if (currentQty <= 0) continue;
            const nextQty = Math.max(0, currentQty - remaining);
            const removed = currentQty - nextQty;
            window.DeckManager.updateEntryQuantity(entryId, nextQty);
            remaining -= removed;
        }
    }

    function syncDeckBuilderWithDraft(cards) {
        if (!deckManagerReady || !window?.DeckManager?.state) {
            return;
        }
        const { counts: targetCounts, samples } = buildDraftCardCounts(Array.isArray(cards) ? cards : []);
        const currentCounts = getDeckManagerCardCounts();
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const handled = new Set();

        Object.entries(targetCounts).forEach(([cardKey, desiredCount]) => {
            handled.add(cardKey);
            const current = currentCounts[cardKey] || 0;
            if (current < desiredCount) {
                const diff = desiredCount - current;
                const sample = samples[cardKey];
                if (sample) {
                    window.DeckManager.addCard(deepClone(sample), { quantity: diff });
                }
            } else if (current > desiredCount) {
                removeDeckManagerCopies(cardKey, current - desiredCount);
            }
        });

        Object.keys(currentCounts).forEach((cardKey) => {
            if (!handled.has(cardKey)) {
                removeDeckManagerCopies(cardKey, currentCounts[cardKey]);
            }
        });
    }

    function importDraftToDeckManager() {
        if (deckContext?.deckId) {
            setStatus('Opening deck builder...', 'info');
            window.location.href = `/decks/builder?deckId=${encodeURIComponent(deckContext.deckId)}`;
            return;
        }

        if (!draftedCards.length) {
            setStatus('Finish drafting before importing.', 'error');
            return;
        }

        try {
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            const grouped = new Map();
            draftedCards.forEach((card) => {
                if (!card) return;
                const key = card.id || card.scryfall_id || card.unique_id || card.name;
                if (!key) return;
                if (!grouped.has(key)) {
                    grouped.set(key, { card, quantity: 0 });
                }
                grouped.get(key).quantity += 1;
            });

            if (!grouped.size) {
                setStatus('No cards available to import.', 'error');
                return;
            }

            const deckPayload = {
                name: `${draftLabel} - ${room?.set_name || room?.name || 'ManaForge'}`,
                format: 'draft',
                cards: Array.from(grouped.values()),
                commanders: []
            };

            window.localStorage.setItem(
                DECK_MANAGER_IMPORT_KEY,
                JSON.stringify({
                    deck: deckPayload,
                    message: 'Draft deck imported from draft room.',
                    source: 'draft'
                })
            );

            setStatus('Deck sent to Deck Manager!', 'success');
            window.location.href = '/decks/builder';
        } catch (error) {
            console.error('Unable to import deck into deck manager', error);
            setStatus('Import failed. Please try again.', 'error');
        }
    }

    async function _refreshRoomState() {
        const now = Date.now();
        if (now - lastRefreshAt < 300) {
            return;
        }
        lastRefreshAt = now;

        try {
            const response = await fetch('/api/v1/draft/rooms');
            if (!response.ok) {
                return;
            }
            const rooms = await response.json();
            if (!Array.isArray(rooms)) {
                return;
            }
            const match = rooms.find((entry) => entry?.id === room?.id);
            if (match) {
                applyRoomState(match);
            }
        } catch (error) {
            console.warn('[draft-room] unable to refresh room state', error);
        }
    }

    async function triggerDraftStartFallback() {
        if (!room?.id) {
            return;
        }
        try {
            await fetch(`/api/v1/draft/rooms/${encodeURIComponent(room.id)}/start`, {
                method: 'POST'
            });
        } catch (error) {
            console.warn('[draft-room] fallback start failed', error);
        }
    }

    async function submitRename(player, value) {
        const trimmed = (value || '').trim();
        if (!trimmed) {
            setStatus('Name cannot be empty.', 'error');
            return null;
        }
        try {
            const response = await fetch(
                `/api/v1/draft/rooms/${encodeURIComponent(room.id)}/rename`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ player_id: player.id, player_name: trimmed })
                }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.detail || 'Unable to update name.');
            }
            setStatus('Name updated.', 'success');
            return payload?.name || trimmed;
        } catch (error) {
            console.error('Unable to rename player', error);
            setStatus(error?.message || 'Unable to update name.', 'error');
            return null;
        }
    }

    async function handleRenameSubmit() {
        if (!renameState.playerId || renameState.saving) {
            return;
        }
        renameState = { ...renameState, saving: true };
        const targetPlayer = players.find((p) => p?.id === renameState.playerId);
        const nextName = await submitRename(targetPlayer, renameState.value);
        renameState = { playerId: null, value: '', saving: false };

        if (nextName) {
            room = {
                ...room,
                players: players.map((p) => (p.id === targetPlayer.id ? { ...p, name: nextName } : p))
            };
        }
    }

    function startRename(player) {
        if (!player || player.is_bot || player.id !== playerId) {
            return;
        }
        renameState = { playerId: player.id, value: player.name || '', saving: false };
    }

    function cancelRename() {
        renameState = { playerId: null, value: '', saving: false };
    }

    function safeParse(raw) {
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function sortCardsByRarity(cards) {
        const order = { mythic: 0, rare: 1, uncommon: 2, common: 3 };
        return (Array.isArray(cards) ? [...cards] : []).sort((a, b) => {
            const rankA = order[(a?.rarity || '').toLowerCase()] ?? 4;
            const rankB = order[(b?.rarity || '').toLowerCase()] ?? 4;
            if (rankA !== rankB) return rankA - rankB;
            return 0;
        });
    }

    function getDraftLabelPrefix(rawType) {
        const normalized = (rawType || '').toString().toLowerCase();
        if (normalized === 'sealed') return 'Sealed';
        if (normalized === 'cube') return 'Cube Draft';
        return 'Draft';
    }

    function _rarityBadge(card) {
        const rarity = (card?.rarity || '').toLowerCase();
        if (!rarity) return null;
        const map = {
            mythic: 'text-orange-400',
            rare: 'text-yellow-300',
            uncommon: 'text-blue-300',
            common: 'text-gray-300'
        };
        return map[rarity] || 'text-arena-text-dim';
    }

    function stateBadge() {
        if (roomState === 'completed') return { label: 'Completed', tone: 'bg-emerald-500/10 text-emerald-300' };
        if (roomState === 'drafting') return { label: 'In Progress', tone: 'bg-arena-accent/10 text-arena-accent' };
        return { label: 'Waiting', tone: 'bg-arena-muted/20 text-arena-muted' };
    }

    function getCardPrice(cardName) {
        return getCachedPrice(cardPrices, cardName);
    }

    function fetchPricesForPack(cards) {
        if (!Array.isArray(cards) || cards.length === 0) return;

        const missingNames = [];
        cards.forEach((card) => {
            if (card?.name && !(card.name in cardPrices)) {
                missingNames.push(card.name);
            }
        });

        if (missingNames.length === 0) {
            return;
        }

        queuePriceLookup(missingNames);
    }
</script>

{#if !room?.id}
<div class="py-12 px-4">
    <div class="max-w-4xl mx-auto arena-card rounded-xl p-6 text-center">
        <p class="text-lg text-red-400 font-semibold">Draft room not available.</p>
        <p class="text-arena-text-dim mt-2">Return to the lobby and try again.</p>
    </div>
</div>
{:else}
<div class="py-12 px-4">
    <div class="max-w-[1800px] mx-auto space-y-10">
        <header class="text-center space-y-3 animate-fade-in">
            <p class="text-sm uppercase tracking-[0.35em] text-arena-muted">{draftLabel}</p>
            <h1 class="font-magic text-4xl md:text-5xl text-arena-accent">{room?.name}</h1>
            <p class="text-lg text-arena-text-dim">
                {room?.set_name}
            </p>
            <div class="flex items-center justify-center gap-3 text-sm text-arena-text-dim">
                <span class="px-3 py-1 rounded-full bg-arena-surface/60 border border-arena-surface/60">
                    Seat ID: {playerId}
                </span>
                <span class="px-3 py-1 rounded-full bg-arena-surface/60 border border-arena-surface/60">
                    Players: {players.length}/{room?.max_players ?? 8}
                </span>
            </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <section class="lg:col-span-1 arena-card p-5 rounded-xl space-y-4">
                <div class="flex items-center justify-between">
                    <h2 class="font-magic text-2xl text-arena-accent">Players</h2>
                    {#if stateBadge()}
                    <span class="text-xs px-3 py-1 rounded-full border border-arena-surface/60 {stateBadge().tone}">
                        {stateBadge().label}
                    </span>
                    {/if}
                </div>

                <div class="space-y-2">
                    {#if !players.length}
                        <div class="text-sm text-arena-text-dim">Waiting for players...</div>
                    {:else}
                        {#each players as player (player.id)}
                            <div class="p-3 bg-arena-surface rounded flex items-center justify-between gap-3 {player.id === playerId ? 'border border-arena-accent/40' : ''}">
                                <div class="flex-1">
                                    {#if renameState.playerId === player.id}
                                        <div class="space-y-2">
                                            <input
                                                class="w-full px-3 py-2 bg-arena-surface-dark rounded border border-arena-accent/30 focus:outline-none focus:ring-2 focus:ring-arena-accent/40"
                                                value={renameState.value}
                                                oninput={(event) => renameState = { ...renameState, value: event.target.value }}
                                                onkeydown={(event) => {
                                                    if (event.key === 'Enter') { handleRenameSubmit(); }
                                                    if (event.key === 'Escape') { cancelRename(); }
                                                }}
                                            >
                                            <div class="flex gap-2">
                                                <button
                                                    class="arena-button px-3 py-2 rounded text-sm"
                                                    disabled={renameState.saving}
                                                    onclick={handleRenameSubmit}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    class="px-3 py-2 rounded text-sm bg-arena-surface-dark border border-arena-surface/70"
                                                    onclick={cancelRename}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    {:else}
                                        <div class="flex items-center gap-2 text-sm">
                                            <span class="font-semibold">{player.name}</span>
                                            {#if player.is_bot}
                                                <span class="text-xs text-arena-text-dim">(Bot)</span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                                <div class="flex items-center gap-2">
                                    {#if player.has_picked_card}
                                        <span title="Card picked" class="text-green-400">✓</span>
                                    {/if}
                                    {#if player.id === playerId && !player.is_bot && renameState.playerId !== player.id}
                                        <button
                                            class="text-xs text-arena-muted hover:text-arena-accent transition-colors"
                                            title="Rename"
                                            onclick={() => startRename(player)}
                                        >
                                            ✏️
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>

                <div class="mt-4 space-y-2">
                    <button
                        class="arena-button w-full py-3 px-4 rounded-lg disabled:opacity-50"
                        onclick={addBot}
                        disabled={!canManageBots}
                    >
                        Add Bot
                    </button>
                    <button
                        class="arena-button w-full py-3 px-4 rounded-lg disabled:opacity-50"
                        onclick={fillBots}
                        disabled={!canManageBots}
                    >
                        Fill with Bots
                    </button>
                    <button
                        class="arena-button w-full py-3 px-4 rounded-lg disabled:opacity-50"
                        onclick={startDraft}
                        disabled={!canManageBots}
                    >
                        Start Draft
                    </button>
                </div>

                {#if status.message}
                    <p class="text-sm mt-2 {status.type === 'success' ? 'text-arena-accent' : status.type === 'error' ? 'text-red-400' : 'text-arena-text-dim'}">
                        {status.message}
                    </p>
                {/if}
            </section>

            <section class="lg:col-span-3 space-y-4">
                <div class="arena-card p-5 rounded-xl space-y-4">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <h2 class="font-magic text-2xl text-arena-accent">{packHeader}</h2>
                        <label class="flex items-center gap-2 text-sm text-arena-text cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                bind:checked={showPrices}
                                class="rounded border-arena-accent/40 bg-arena-surface w-4 h-4 accent-arena-accent"
                            />
                            <span>Show cards price</span>
                        </label>
                    </div>

                    {#if packStatus}
                        <div class="text-center text-arena-text-dim py-6">
                            {packStatus}
                        </div>
                    {:else if currentPack.length === 0}
                        <div class="text-center text-arena-text-dim py-6">
                            Waiting for pack contents...
                        </div>
                    {:else}
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {#each currentPack as card (card.unique_id || card.id || card.name)}
                                <button
                                    class="relative cursor-pointer rounded-lg overflow-hidden border border-transparent hover:border-arena-accent/40 transition-all {selectedCardId === (card.unique_id || card.id || card.name) ? 'ring-2 ring-yellow-400' : ''}"
                                    onclick={() => pickCard(card)}
                                    data-card-id={card.id || card.card_id || ''}
                                    data-card-unique-id={card.unique_id || ''}
                                    data-card-name={card.name || ''}
                                    data-card-image={card.image_url || ''}
                                    data-card-data={JSON.stringify(card)}
                                >
                                    <img src={card.image_url} alt={card.name} class="w-full block">
                                    <!-- Price badge -->
                                    {#if showPrices}
                                    <div class="absolute bottom-1 left-1">
                                        {#if getCardPrice(card.name) !== null}
                                            <span class="bg-black/70 text-white text-[11px] font-semibold px-2 py-1 rounded-full shadow-md">
                                                {formatPrice(getCardPrice(card.name))}
                                            </span>
                                        {:else}
                                            <span class="bg-black/50 text-white/70 text-[10px] font-semibold px-2 py-1 rounded-full">
                                                Prix N/A
                                            </span>
                                        {/if}
                                    </div>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if showExportActions}
                    <div class="arena-card p-5 rounded-xl space-y-3">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h3 class="font-semibold text-arena-accent text-lg">Draft Complete</h3>
                                <p class="text-sm text-arena-text-dim">
                                    Export your decklist or jump into Deck Manager to keep refining.
                                </p>
                            </div>
                            <div class="flex flex-col md:flex-row gap-3">
                                <button
                                    class="arena-button px-4 py-3 rounded-lg disabled:opacity-50"
                                    onclick={exportDecklist}
                                    disabled={decklistPending}
                                >
                                    {decklistPending ? 'Preparing...' : 'Copy Decklist'}
                                </button>
                                <button
                                    class="arena-button px-4 py-3 rounded-lg"
                                    onclick={importDraftToDeckManager}
                                >
                                    Open in Deck Manager
                                </button>
                            </div>
                        </div>
                        {#if status.message}
                            <p class="text-sm {status.type === 'success' ? 'text-arena-accent' : status.type === 'error' ? 'text-red-400' : 'text-arena-text-dim'}">
                                {status.message}
                            </p>
                        {/if}
                    </div>
                {/if}
            </section>
        </div>

        <div class="mt-10">
            {#if deckManagerVisible}
                <DeckManager embedded={true} />
            {/if}
        </div>
    </div>
</div>
{/if}
