<script>
    import { onMount, onDestroy, tick } from 'svelte';
    import { DeckStorage } from '../../lib/deck-storage';

    let { config } = $props();

    const STATUS_POLL_INTERVAL = 2500;
    const PLAYER_NAME_STORAGE_KEY = 'manaforge:player-name';
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    const gameId = config?.gameId || '';
    const playerRole = config?.playerRole || 'spectator';
    const setupApiUrl = config?.setupApiUrl || '';
    const submitApiUrl = config?.submitApiUrl || '';
    const gameInterfaceUrl = config?.gameInterfaceUrl || '';
    const shareLinks = config?.shareLinks || {};

    let status = $state(config?.initialStatus || {});
    let lastUpdateLabel = $state('just now');
    let selectedGameFormat = $state(config?.initialStatus?.game_format || 'modern');
    let selectedPhaseMode = $state(config?.initialStatus?.phase_mode || 'strict');
    let selectedPlayerRole = $state(playerRole);

    let deckText = $state('');
    let deckUrl = $state('');
    let deckPreview = $state(null);
    let deckPreviewCount = $state(0);
    let showDeckPreview = $state(false);

    let deckStatus = $state({ text: '', tone: 'muted' });
    let shareMessage = $state('');
    let shareMessageTone = $state('muted');

    let deckLibraryEntries = $state([]);
    let isSubmitting = $state(false);
    let isImportingDeck = $state(false);
    let isModernImportInFlight = $state(false);
    let modernExampleLocked = $state(false);

    let editingPlayer = $state(null);
    let nameDraft = $state('');
    let nameInputRef = $state(null);

    let pollTimeoutId = null;
    let pendingImmediatePoll = false;
    let pollingDisabled = false;
    let isFetchingStatus = false;
    let aliasSyncedFromServer = false;
    let aliasSyncInProgress = false;
    let nameEditInProgress = false;

    let shareTimeoutId = null;
    let deckStatusTimeoutId = null;
    let deckCacheTimeoutId = null;
    let redirectTimer = null;

    let opponentMessage = $state('');
    let deckFormNotice = $state('');

    const shareRoles = [
        { key: 'player1', label: 'Player 1' },
        { key: 'player2', label: 'Player 2' },
        { key: 'spectator', label: 'Spectator' }
    ];

    const resolveErrorMessage = async (response, fallback = 'An error occurred.') => {
        if (!response) return fallback;
        try {
            const data = await response.json();
            if (data?.detail) return data.detail;
            if (data?.message) return data.message;
        } catch {
            // ignore parse errors
        }
        try {
            const text = await response.text();
            if (text) return text;
        } catch {
            // ignore text errors
        }
        return fallback;
    };

    const shareInputId = (roleKey) => `share-link-${gameId || 'room'}-${roleKey}`;

    const formatTimestamp = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const toneClass = (tone) => {
        if (tone === 'accent') return 'text-arena-accent';
        if (tone === 'red') return 'text-red-300';
        return 'text-arena-muted';
    };

    const setDeckStatus = (text, tone = 'muted', timeoutMs = 6000) => {
        if (deckStatusTimeoutId) {
            clearTimeout(deckStatusTimeoutId);
            deckStatusTimeoutId = null;
        }
        deckStatus = { text, tone };
        if (text && timeoutMs > 0) {
            deckStatusTimeoutId = setTimeout(() => {
                deckStatus = { text: '', tone: 'muted' };
            }, timeoutMs);
        }
    };

    const setShareFeedback = (text, tone = 'muted') => {
        if (shareTimeoutId) {
            clearTimeout(shareTimeoutId);
            shareTimeoutId = null;
        }
        shareMessage = text;
        shareMessageTone = tone;
        if (text) {
            shareTimeoutId = setTimeout(() => {
                shareMessage = '';
                shareMessageTone = 'muted';
            }, 2500);
        }
    };

    const isSeatedPlayer = playerRole === 'player1' || playerRole === 'player2';

    const getPlayerData = (seat) => status?.player_status?.[seat] || null;

    const getSeatFallbackName = (seat) => {
        if (seat === 'player1') return 'Player 1';
        if (seat === 'player2') return 'Player 2';
        return seat;
    };

    const playerDisplayName = (seat) => {
        const data = getPlayerData(seat);
        return data?.player_name || getSeatFallbackName(seat);
    };

    const seatSummaryLabel = () => {
        const seats = ['player1', 'player2'];
        const claimed = seats.filter((seat) => getPlayerData(seat)?.seat_claimed).length;
        const waiting = seats
            .filter((seat) => !getPlayerData(seat)?.seat_claimed)
            .map((seat) => seat.replace('player', 'Player '));
        if (!waiting.length) {
            return `${claimed}/2 filled • All seats occupied`;
        }
        return `${claimed}/2 filled • Waiting on ${waiting.join(' & ')}`;
    };

    const deckProgressLabel = () => {
        const seats = status?.player_status || {};
        const submitted = Object.values(seats).filter((info) => info?.submitted).length;
        return `${submitted} / 2`;
    };

    const buildBadge = (seat) => {
        const data = getPlayerData(seat);
        if (!data?.seat_claimed) {
            return { label: 'Open Seat', className: 'accent-pill border-red-500/40 text-red-300' };
        }
        if (data.validated) {
            return { label: 'Ready', className: 'accent-pill border-green-500/40 text-green-300' };
        }
        if (data.submitted) {
            return { label: 'Deck Submitted', className: 'accent-pill border-yellow-500/40 text-yellow-300' };
        }
        return { label: 'Seated', className: 'accent-pill border-blue-500/40 text-blue-300' };
    };

    const buildOpponentMessage = () => {
        const mySeat = getPlayerData(playerRole);
        const opponentKey = playerRole === 'player1' ? 'player2' : 'player1';
        const opponentSeat = getPlayerData(opponentKey);
        if (!isSeatedPlayer) {
            return 'Spectating room status...';
        }
        if (!mySeat?.seat_claimed) {
            return 'Claiming your seat...';
        }
        if (mySeat?.validated) {
            return 'Deck submitted! Waiting for opponent validation.';
        }
        if (opponentSeat?.validated) {
            return 'Opponent ready! Submit your validated deck.';
        }
        if (opponentSeat?.seat_claimed) {
            return 'Opponent has taken their seat. Awaiting deck submissions.';
        }
        return 'Waiting for opponent to join the room...';
    };

    const buildDeckFormNotice = () => {
        if (!isSeatedPlayer) {
            return '';
        }
        if (status?.ready && status?.setup_complete) {
            return 'Battlefield ready. Redirecting shortly...';
        }
        const mySeat = getPlayerData(playerRole);
        if (!mySeat?.seat_claimed) {
            return 'Your seat is not yet assigned.';
        }
        if (mySeat?.validated) {
            return 'Deck locked in for this seat.';
        }
        return '';
    };

    const shouldShowDeckForm = () => {
        if (!isSeatedPlayer) return false;
        if (status?.ready && status?.setup_complete) return false;
        const mySeat = getPlayerData(playerRole);
        return Boolean(mySeat?.seat_claimed);
    };

    const deckSubmitDisabled = () => {
        if (!shouldShowDeckForm()) return true;
        const mySeat = getPlayerData(playerRole);
        return Boolean(mySeat?.validated);
    };

    const deckSubmitLabel = () => (deckSubmitDisabled() ? 'Deck Validated ✔️' : 'Submit Deck');

    const deckControlsDisabled = () => deckSubmitDisabled();

    const deckTextareaPlaceholder = [
        'Paste your decklist here...',
        '',
        'Example:',
        '4 Lightning Bolt',
        '4 Grizzly Bears',
        '12 Mountain',
        '12 Forest'
    ].join('\n');

    const deckTextareaClasses = () => [
        'w-full px-5 py-4 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none font-mono text-sm',
        deckControlsDisabled() ? 'opacity-70 cursor-not-allowed' : ''
    ].join(' ').trim();

    const shouldShowSpectatorCard = () => playerRole === 'spectator';

    const getLegacyDeckState = () => {
        if (!isBrowser) return null;
        try {
            const raw = window.localStorage.getItem('manaforge:deck-manager:v1');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const state = parsed && typeof parsed === 'object' && parsed.state ? parsed.state : parsed;
            if (!state || typeof state !== 'object') return null;
            const hasEntries = state.entries && Object.keys(state.entries).length > 0;
            if (!hasEntries) return null;
            return {
                id: parsed?.deckId || 'deck-local',
                name: state.deckName || 'Unsaved Deck',
                format: state.format || 'modern',
                state,
                updatedAt: parsed?.updatedAt || new Date().toISOString(),
                legacy: true
            };
        } catch (error) {
            console.warn('[GameRoomSetup] Unable to read legacy deck state', error);
            return null;
        }
    };

    const countCardsInColumns = (state, columns) => {
        if (!state || !state.columns || !state.entries) {
            return 0;
        }
        return columns.reduce((sum, key) => {
            const ids = state.columns[key] || [];
            return sum + ids.reduce((colSum, entryId) => {
                const entry = state.entries[entryId];
                return colSum + (entry?.quantity || 0);
            }, 0);
        }, 0);
    };

    const buildDecklistFromState = (state) => {
        if (!state || !state.columns || !state.entries) return '';
        const entries = state.entries;
        const gather = (column) => {
            const ids = state.columns[column] || [];
            return ids
                .map((id) => entries[id])
                .filter((entry) => entry && entry.card && entry.quantity);
        };

        const lines = [];
        ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands'].forEach((column) => {
            gather(column).forEach((entry) => {
                const cardName = entry.card?.name || 'Unknown Card';
                lines.push(`${entry.quantity} ${cardName}`);
            });
        });

        const addSection = (title, column) => {
            const sectionEntries = gather(column);
            if (!sectionEntries.length) return;
            lines.push('');
            lines.push(title);
            sectionEntries.forEach((entry) => {
                const cardName = entry.card?.name || 'Unknown Card';
                lines.push(`${entry.quantity} ${cardName}`);
            });
        };

        addSection('Sideboard', 'sideboard');
        addSection('Commander', 'commander');

        return lines.join('\n').trim();
    };

    const readDeckLibraryList = () => {
        if (!isBrowser) return [];
        let decks = [];
        try {
            decks = DeckStorage.list() || [];
        } catch (error) {
            console.warn('[GameRoomSetup] Unable to load deck library entries', error);
        }
        const legacy = getLegacyDeckState();
        if (legacy && !decks.some((deck) => deck.id === legacy.id)) {
            decks = [legacy, ...decks];
        }
        return decks;
    };

    const refreshDeckLibrary = () => {
        const decks = readDeckLibraryList();
        deckLibraryEntries = decks.map((deck) => {
            const mainCount = countCardsInColumns(deck.state, ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands']);
            const sideCount = countCardsInColumns(deck.state, ['sideboard']);
            const subtitleParts = [
                (deck.format || 'unknown').toUpperCase(),
                `${mainCount} main`,
                sideCount ? `${sideCount} side` : null
            ].filter(Boolean);
            return {
                id: deck.id,
                name: deck.name || 'Untitled Deck',
                subtitle: subtitleParts.join(' • '),
                legacy: Boolean(deck.legacy),
                state: deck.state
            };
        });
    };

    const storageKeyForDeck = () => {
        if (!isBrowser || !gameId || !isSeatedPlayer) {
            return null;
        }
        return `manaforge:deck:${gameId}:${playerRole}`;
    };

    const storeDecklistForRole = (decklistText) => {
        const key = storageKeyForDeck();
        if (!key || !decklistText) return;
        try {
            window.localStorage.setItem(key, decklistText);
        } catch (error) {
            console.warn('[GameRoomSetup] Unable to cache decklist', error);
        }
    };

    const scheduleDeckCacheSave = () => {
        if (deckCacheTimeoutId) {
            clearTimeout(deckCacheTimeoutId);
        }
        deckCacheTimeoutId = setTimeout(() => {
            if (deckText.trim()) {
                storeDecklistForRole(deckText.trim());
            }
        }, 400);
    };

    const loadDeckFromCache = () => {
        const key = storageKeyForDeck();
        if (!key) return;
        try {
            const cached = window.localStorage.getItem(key);
            if (cached && !deckText) {
                deckText = cached;
            }
        } catch (error) {
            console.warn('[GameRoomSetup] Unable to load cached deck', error);
        }
    };

    const updateDeckPreviewState = (payload) => {
        if (!payload || !Array.isArray(payload.cards) || payload.cards.length === 0) {
            deckPreview = null;
            deckPreviewCount = 0;
            showDeckPreview = false;
            return;
        }
        deckPreview = payload;
        deckPreviewCount = payload.cards.reduce((sum, entry) => sum + (entry?.quantity || 0), 0);
        showDeckPreview = true;
    };

    const loadDeckFromLibrary = (id) => {
        const entry = deckLibraryEntries.find((deck) => deck.id === id);
        if (!entry) {
            setDeckStatus('Unable to locate the selected deck.', 'red');
            return;
        }
        const deckList = buildDecklistFromState(entry.state);
        if (!deckList) {
            setDeckStatus('This deck appears to be empty.', 'red');
            return;
        }
        deckText = deckList;
        deckUrl = '';
        updateDeckPreviewState(null);
        if (isSeatedPlayer) {
            scheduleDeckCacheSave();
        }
        setDeckStatus(`Loaded deck "${entry.name}" from Deck Manager.`, 'accent');
    };

    const handleDeckTextInput = (value) => {
        deckText = value;
        updateDeckPreviewState(null);
        if (isSeatedPlayer) {
            scheduleDeckCacheSave();
        }
    };

    const handleDeckUrlInput = (value) => {
        deckUrl = value;
    };

    const copyShareLink = async (role) => {
        const link = shareLinks?.[role];
        if (!link) {
            setShareFeedback('No link available for this role.', 'red');
            return;
        }
        if (!isBrowser || !navigator?.clipboard) {
            setShareFeedback('Clipboard access unavailable.', 'red');
            return;
        }
        try {
            await navigator.clipboard.writeText(link);
            setShareFeedback(`Link copied for ${role}!`, 'accent');
        } catch (error) {
            console.warn('[GameRoomSetup] Clipboard copy failed', error);
            setShareFeedback('Unable to copy link automatically.', 'red');
        }
    };

    const updateDerivedMessages = () => {
        opponentMessage = buildOpponentMessage();
        deckFormNotice = buildDeckFormNotice();
    };

    const updateModernExampleAvailability = (state) => {
        const info = state?.player_status || {};
        const hasSubmission = ['player1', 'player2'].some((seat) => info[seat]?.submitted);
        modernExampleLocked = state?.ready || hasSubmission || !isSeatedPlayer;
    };

    const getStoredPlayerAlias = () => {
        if (!isBrowser) return '';
        try {
            return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
        } catch (error) {
            console.warn('[GameRoomSetup] Unable to read stored player alias', error);
            return '';
        }
    };

    const persistPlayerAlias = (name) => {
        if (!isBrowser || !name) return;
        try {
            window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
        } catch (error) {
            console.warn('[GameRoomSetup] Unable to store player alias', error);
        }
    };

    const maybeSyncPlayerAlias = (state) => {
        if (!isSeatedPlayer || aliasSyncedFromServer || aliasSyncInProgress || !gameId) {
            return;
        }
        const currentSeatStatus = state?.player_status?.[playerRole];
        const currentAlias = currentSeatStatus?.player_name;
        const storedAlias = getStoredPlayerAlias();

        if (!storedAlias) {
            if (currentAlias) {
                persistPlayerAlias(currentAlias);
                aliasSyncedFromServer = true;
            }
            return;
        }

        if (currentAlias && currentAlias === storedAlias) {
            aliasSyncedFromServer = true;
            return;
        }

        aliasSyncInProgress = true;
        fetch(`/api/v1/games/${encodeURIComponent(gameId)}/claim-seat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_id: playerRole,
                player_name: storedAlias
            })
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Unable to sync alias with server');
                }
                aliasSyncedFromServer = true;
            })
            .catch((error) => {
                console.warn('[GameRoomSetup] Failed to synchronize player alias', error);
            })
            .finally(() => {
                aliasSyncInProgress = false;
            });
    };

    const shouldRedirectToGame = (state) => {
        if (!state || !state.ready) return false;
        if (isSeatedPlayer) {
            return Boolean(state.player_status?.[playerRole]?.validated);
        }
        return true;
    };

    const redirectToGame = () => {
        if (!isBrowser) return;
        const url = new URL(gameInterfaceUrl, window.location.origin);
        url.searchParams.set('player', isSeatedPlayer ? playerRole : 'spectator');
        window.location.href = url.toString();
    };

    const queueRedirect = () => {
        if (!isBrowser) return;
        if (redirectTimer) return;
        redirectTimer = setTimeout(() => {
            redirectTimer = null;
            redirectToGame();
        }, 1200);
    };

    const queueRedirectIfReady = (state) => {
        if (shouldRedirectToGame(state)) {
            setDeckStatus('Both decks validated! Entering battlefield...', 'accent', 0);
            stopPolling();
            queueRedirect();
        }
    };

    const stopPolling = () => {
        pollingDisabled = true;
        pendingImmediatePoll = false;
        if (pollTimeoutId) {
            clearTimeout(pollTimeoutId);
            pollTimeoutId = null;
        }
    };

    const scheduleNextPoll = () => {
        if (!isBrowser) return;
        if (pollingDisabled) return;
        if (document.visibilityState === 'hidden') return;
        pollTimeoutId = setTimeout(() => pollSetupStatus(), STATUS_POLL_INTERVAL);
    };

    const pollSetupStatus = async (force = false) => {
        if (isFetchingStatus) {
            if (force) pendingImmediatePoll = true;
            return;
        }
        if (!setupApiUrl) return;
        isFetchingStatus = true;
        try {
            const response = await fetch(`${setupApiUrl}?_=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-store' }
            });
            if (!response.ok) {
                throw new Error('Unable to refresh setup status');
            }
            const payload = await response.json();
            applyStatusUpdate(payload);
            queueRedirectIfReady(payload);
        } catch (error) {
            console.error('[GameRoomSetup] Polling error', error);
            setDeckStatus('Connection issue while updating status.', 'red', 4000);
        } finally {
            isFetchingStatus = false;
            if (pollingDisabled) {
                return;
            }
            if (pendingImmediatePoll) {
                pendingImmediatePoll = false;
                pollSetupStatus();
            } else {
                scheduleNextPoll();
            }
        }
    };

    const handleVisibilityChange = () => {
        if (!isBrowser) return;
        if (document.visibilityState === 'hidden') {
            stopPolling();
        } else {
            pollingDisabled = false;
            refreshDeckLibrary();
            pollSetupStatus(true);
        }
    };

    const applyStatusUpdate = (nextStatus) => {
        status = nextStatus || {};
        lastUpdateLabel = formatTimestamp();
        selectedGameFormat = status?.game_format || selectedGameFormat;
        selectedPhaseMode = status?.phase_mode || selectedPhaseMode;
        updateModernExampleAvailability(status);
        updateDerivedMessages();
        maybeSyncPlayerAlias(status);
    };

    const submitNameChange = async (seat, newName) => {
        if (!gameId || !seat) {
            throw new Error('Game not ready.');
        }
        const trimmed = newName.trim();
        if (!trimmed) {
            throw new Error('Name cannot be empty.');
        }
        const response = await fetch(`/api/v1/games/${encodeURIComponent(gameId)}/claim-seat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_id: seat,
                player_name: trimmed
            })
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.detail || 'Unable to update the name.');
        }
        if (payload) {
            applyStatusUpdate(payload);
            const sanitized = payload.player_status?.[seat]?.player_name;
            if (seat === playerRole && sanitized) {
                persistPlayerAlias(sanitized);
            }
            return sanitized || trimmed;
        }
        return trimmed;
    };

    const startNameEdit = async (seat) => {
        if (!isSeatedPlayer || seat !== playerRole || nameEditInProgress) {
            return;
        }
        editingPlayer = seat;
        nameDraft = playerDisplayName(seat);
        nameEditInProgress = true;
        stopPolling();
        await tick();
        if (nameInputRef) {
            nameInputRef.focus();
            nameInputRef.select();
        }
    };

    const cancelNameEdit = () => {
        editingPlayer = null;
        nameDraft = '';
        nameEditInProgress = false;
        pollingDisabled = false;
        pollSetupStatus(true);
    };

    const finishNameEdit = async () => {
        if (!editingPlayer) return;
        const trimmed = nameDraft.trim();
        if (!trimmed) {
            setDeckStatus('Name cannot be empty.', 'red');
            return;
        }
        try {
            const sanitized = await submitNameChange(editingPlayer, trimmed);
            nameDraft = sanitized || trimmed;
            setDeckStatus('Name updated.', 'accent');
        } catch (error) {
            console.error('[GameRoomSetup] Alias update failed', error);
            setDeckStatus(error.message || 'Unable to update the name.', 'red');
        } finally {
            editingPlayer = null;
            nameDraft = '';
            nameEditInProgress = false;
            pollingDisabled = false;
            pollSetupStatus(true);
        }
    };

    const handleNameInputKeydown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            finishNameEdit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelNameEdit();
        }
    };

    const handleGameFormatChange = async (value) => {
        if (!gameId || !value || value === status?.game_format) {
            selectedGameFormat = status?.game_format || value;
            return;
        }
        selectedGameFormat = value;
        try {
            const response = await fetch(`/api/v1/games/${encodeURIComponent(gameId)}/update-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_format: value })
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.detail || 'Failed to update game format');
            }
            if (payload) {
                applyStatusUpdate(payload);
            }
            setDeckStatus(`Game format updated to ${value.replace('_', ' ')}`, 'accent');
        } catch (error) {
            console.error('[GameRoomSetup] Failed to update format', error);
            selectedGameFormat = status?.game_format || selectedGameFormat;
            setDeckStatus(error.message || 'Failed to update game format', 'red');
        }
    };

    const handlePhaseModeChange = async (value) => {
        if (!gameId || !value || value === status?.phase_mode) {
            selectedPhaseMode = status?.phase_mode || value;
            return;
        }
        selectedPhaseMode = value;
        try {
            const response = await fetch(`/api/v1/games/${encodeURIComponent(gameId)}/update-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase_mode: value })
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.detail || 'Failed to update phase mode');
            }
            if (payload) {
                applyStatusUpdate(payload);
            }
            setDeckStatus(`Phase mode updated to ${value.replace('_', ' ')}`, 'accent');
        } catch (error) {
            console.error('[GameRoomSetup] Failed to update phase mode', error);
            selectedPhaseMode = status?.phase_mode || selectedPhaseMode;
            setDeckStatus(error.message || 'Failed to update phase mode', 'red');
        }
    };

    const handlePlayerRoleChange = (role) => {
        selectedPlayerRole = role;
        if (!isBrowser) return;
        const url = new URL(window.location.href);
        url.searchParams.set('player', role);
        window.location.href = url.toString();
    };

    const importDeckFromUrl = async () => {
        if (isImportingDeck) return null;
        const trimmedUrl = deckUrl.trim();
        if (!trimmedUrl) {
            setDeckStatus('Please enter a deck URL to import.', 'red');
            return null;
        }
        isImportingDeck = true;
        setDeckStatus('Importing deck from URL...', 'muted', 0);
        try {
            const response = await fetch('/api/v1/decks/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deck_url: trimmedUrl })
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const message = payload?.detail || (await resolveErrorMessage(response, 'Deck import failed'));
                throw new Error(message);
            }
            const deckTextValue = (payload?.deck_text || '').trim();
            if (deckTextValue) {
                deckText = deckTextValue;
                if (isSeatedPlayer) {
                    scheduleDeckCacheSave();
                }
            }
            if (payload?.deck) {
                updateDeckPreviewState(payload.deck);
            } else {
                updateDeckPreviewState(null);
            }
            setDeckStatus('Deck imported successfully. Review and submit when ready.', 'accent');
            return payload;
        } catch (error) {
            console.error('[GameRoomSetup] Deck import error', error);
            setDeckStatus(error.message || 'Unable to import deck.', 'red');
            return null;
        } finally {
            isImportingDeck = false;
        }
    };

    const previewDecklist = async () => {
        const trimmed = deckText.trim();
        if (!trimmed && deckUrl.trim()) {
            await importDeckFromUrl();
            return;
        }
        if (!trimmed) {
            setDeckStatus('Please paste a decklist or provide a deck URL first.', 'red');
            return;
        }
        setDeckStatus('Parsing deck for preview...', 'muted', 0);
        try {
            const response = await fetch('/api/v1/decks/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decklist_text: trimmed })
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                const message = payload?.detail || (await resolveErrorMessage(response, 'Deck parsing failed'));
                throw new Error(message);
            }
            updateDeckPreviewState(payload);
            setDeckStatus('Deck parsed successfully.', 'accent');
        } catch (error) {
            console.error('[GameRoomSetup] Deck preview error', error);
            setDeckStatus(error.message || 'Unable to preview deck.', 'red');
        }
    };

    const submitDeck = async (event) => {
        event?.preventDefault();
        if (deckSubmitDisabled()) return;
        let trimmed = deckText.trim();
        if (!trimmed && deckUrl.trim()) {
            const importResult = await importDeckFromUrl();
            if (!importResult) {
                return;
            }
            trimmed = deckText.trim();
        }
        if (!trimmed) {
            setDeckStatus('Please paste a decklist or import from a URL before submitting.', 'red');
            return;
        }
        if (!isSeatedPlayer) {
            setDeckStatus('Spectators cannot submit decks.', 'red');
            return;
        }
        isSubmitting = true;
        setDeckStatus('Validating and submitting deck...', 'muted', 0);
        try {
            const payload = {
                player_id: playerRole,
                decklist_text: trimmed
            };
            const response = await fetch(submitApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const updatedStatus = await response.json().catch(() => null);
            if (!response.ok) {
                const message = updatedStatus?.detail || (await resolveErrorMessage(response, 'Deck submission failed'));
                throw new Error(message);
            }
            if (updatedStatus) {
                applyStatusUpdate(updatedStatus);
                queueRedirectIfReady(updatedStatus);
            }
            updateDeckPreviewState(null);
            storeDecklistForRole(trimmed);
            setDeckStatus('Deck submitted successfully!', 'accent');
        } catch (error) {
            console.error('[GameRoomSetup] Deck submission error', error);
            setDeckStatus(error.message || 'Unable to submit deck.', 'red');
        } finally {
            isSubmitting = false;
        }
    };

    const importModernDeckExample = async () => {
        if (modernExampleLocked || isModernImportInFlight) return;
        if (!isSeatedPlayer) {
            setDeckStatus('Only seated players can import demo decks.', 'red');
            return;
        }
        isModernImportInFlight = true;
        setDeckStatus('Fetching the latest Modern decks from MTGGoldfish...', 'muted', 0);
        try {
            const phaseMode = status?.phase_mode || config?.initialStatus?.phase_mode || 'strict';
            const response = await fetch('/api/v1/games/import-modern-example', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_id: gameId,
                    phase_mode: phaseMode
                })
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.detail || 'Unable to import Modern example.');
            }
            if (payload?.setup) {
                applyStatusUpdate(payload.setup);
                queueRedirectIfReady(payload.setup);
            }
            updateDeckPreviewState(null);
            const deckList = Array.isArray(payload?.decks) ? payload.decks : [];
            const summary = deckList
                .map((deck) => deck.deck_name || deck.player_id || 'Modern Deck')
                .join(' vs ');
            setDeckStatus(
                summary
                    ? `Imported Modern example: ${summary}. Redirecting soon...`
                    : 'Modern example imported. Redirecting soon...',
                'accent',
                4000
            );
            pollSetupStatus(true);
        } catch (error) {
            console.error('[GameRoomSetup] Modern example import failed', error);
            setDeckStatus(error.message || 'Unable to import Modern example.', 'red');
        } finally {
            isModernImportInFlight = false;
        }
    };

    onMount(() => {
        loadDeckFromCache();
        refreshDeckLibrary();
        updateDerivedMessages();
        updateModernExampleAvailability(status);
        maybeSyncPlayerAlias(status);

        if (shouldRedirectToGame(status)) {
            setDeckStatus('Battlefield ready! Entering soon...', 'accent', 0);
            queueRedirect();
        } else {
            pollingDisabled = false;
            pollSetupStatus(true);
        }

        if (isBrowser) {
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('beforeunload', stopPolling);
        }

        return () => {
            stopPolling();
            if (shareTimeoutId) clearTimeout(shareTimeoutId);
            if (deckStatusTimeoutId) clearTimeout(deckStatusTimeoutId);
            if (deckCacheTimeoutId) clearTimeout(deckCacheTimeoutId);
            if (redirectTimer) clearTimeout(redirectTimer);
            if (isBrowser) {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('beforeunload', stopPolling);
            }
        };
    });

    onDestroy(() => {
        stopPolling();
    });
</script>

<div class="max-w-6xl mx-auto space-y-8">
    <div class="arena-card rounded-xl p-8 space-y-6 animate-slide-up">
        <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
            <div class="space-y-3">
                <h1 class="font-magic text-3xl md:text-4xl font-bold text-arena-accent">⚙️ Duel Preparation</h1>
                <p class="text-arena-text text-lg">
                    Preparing battlefield <span class="text-arena-accent font-semibold">{gameId}</span>
                </p>
                <p class="text-arena-text-dim">{status?.status || 'Setting up battlefield...'}</p>
                <p class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-arena-surface-light text-sm text-arena-text-dim border border-arena-accent/20">
                    Seats:
                    <span class="font-semibold text-arena-accent">{seatSummaryLabel()}</span>
                </p>
                <p class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-arena-surface-light text-sm text-arena-text-dim border border-arena-accent/20">
                    Deck submissions:
                    <span class="font-semibold text-arena-accent">{deckProgressLabel()}</span>
                </p>
                <p class="text-xs text-arena-muted">Last update: {lastUpdateLabel}</p>
            </div>

            <div class="w-full md:w-80 space-y-4">
                <div class="bg-arena-surface/80 border border-arena-accent/20 rounded-lg p-4">
                    <p class="text-sm text-arena-muted uppercase tracking-wide mb-3">Share Room Links</p>
                    <div class="space-y-3 text-sm">
                        {#each shareRoles as role}
                            {@const shareId = shareInputId(role.key)}
                            <div class="flex flex-col gap-2">
                                <label for={shareId} class="text-arena-text-dim font-medium">{role.label}</label>
                                <div class="flex items-center gap-2">
                                    <input
                                        id={shareId}
                                        type="text"
                                        readonly
                                        class="flex-1 bg-arena-surface-light border border-arena-accent/20 rounded px-3 py-2 text-xs text-arena-text truncate focus:outline-none"
                                        value={shareLinks?.[role.key] || ''}
                                    />
                                    <button
                                        type="button"
                                        class="arena-button rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200"
                                        onclick={() => copyShareLink(role.key)}
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
                {#if shareMessage}
                    <div class={`text-xs ${toneClass(shareMessageTone)}`}>{shareMessage}</div>
                {/if}
            </div>
        </div>

        <div class="grid gap-4 text-sm text-arena-text-dim md:grid-cols-3">
            <div class="flex items-center gap-3 bg-arena-surface-light rounded-lg px-4 py-3 border border-arena-accent/10">
                <span class="text-xl">🎯</span>
                <div class="flex-1">
                    <label for="game-format-select" class="text-arena-text font-semibold block mb-1">Game Format</label>
                    <select
                        id="game-format-select"
                        class="w-full bg-arena-surface border border-arena-accent/30 rounded px-2 py-1 text-arena-text text-sm focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none"
                        bind:value={selectedGameFormat}
                        onchange={(event) => handleGameFormatChange(event.target.value)}
                    >
                        <option value="standard">Standard</option>
                        <option value="modern">Modern</option>
                        <option value="pioneer">Pioneer</option>
                        <option value="pauper">Pauper</option>
                        <option value="legacy">Legacy</option>
                        <option value="vintage">Vintage</option>
                        <option value="duel_commander">Duel Commander</option>
                        <option value="commander_multi">Commander Multi</option>
                    </select>
                </div>
            </div>
            <div class="flex items-center gap-3 bg-arena-surface-light rounded-lg px-4 py-3 border border-arena-accent/10">
                <span class="text-xl">⏱️</span>
                <div class="flex-1">
                    <label for="phase-mode-select" class="text-arena-text font-semibold block mb-1">Phase Mode</label>
                    <select
                        id="phase-mode-select"
                        class="w-full bg-arena-surface border border-arena-accent/30 rounded px-2 py-1 text-arena-text text-sm focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none"
                        bind:value={selectedPhaseMode}
                        onchange={(event) => handlePhaseModeChange(event.target.value)}
                    >
                        <option value="casual">Casual</option>
                        <option value="strict">Strict</option>
                    </select>
                </div>
            </div>
            <div class="flex items-center gap-3 bg-arena-surface-light rounded-lg px-4 py-3 border border-arena-accent/10">
                <span class="text-xl">🛡️</span>
                <div class="flex-1">
                    <label for="player-role-select" class="text-arena-text font-semibold block mb-1">Your Role</label>
                    <select
                        id="player-role-select"
                        class="w-full bg-arena-surface border border-arena-accent/30 rounded px-2 py-1 text-arena-text text-sm focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none"
                        bind:value={selectedPlayerRole}
                        onchange={(event) => handlePlayerRoleChange(event.target.value)}
                    >
                        <option value="player1">Player 1</option>
                        <option value="player2">Player 2</option>
                        <option value="spectator">Spectator</option>
                    </select>
                </div>
            </div>
        </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
        {#each ['player1', 'player2'] as seat}
            {@const badge = buildBadge(seat)}
            <div class="arena-card rounded-xl p-6 space-y-4 border border-arena-accent/20">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            {#if editingPlayer === seat}
                                <input
                                    class="font-magic text-2xl text-arena-accent mb-1 bg-transparent border-b border-arena-accent/50 focus:outline-none"
                                    bind:value={nameDraft}
                                    bind:this={nameInputRef}
                                    onkeydown={handleNameInputKeydown}
                                    onblur={finishNameEdit}
                                />
                            {:else}
                                <h2 class={`font-magic text-2xl text-arena-accent mb-1 ${playerRole === seat ? 'hover:text-arena-accent-light transition-colors' : ''}`}>
                                    {#if playerRole === seat}
                                        <button
                                            type="button"
                                            class="text-left w-full bg-transparent border-0 p-0 font-inherit text-inherit"
                                            onclick={() => startNameEdit(seat)}
                                        >
                                            {playerDisplayName(seat)}
                                        </button>
                                    {:else}
                                        {playerDisplayName(seat)}
                                    {/if}
                                </h2>
                            {/if}
                            {#if playerRole === seat && editingPlayer !== seat}
                                <button
                                    type="button"
                                    class="text-arena-muted text-sm hover:text-arena-accent transition-colors"
                                    title="Rename"
                                    onclick={() => startNameEdit(seat)}
                                >
                                    ✏️
                                </button>
                            {/if}
                        </div>
                        <p class="text-sm text-arena-muted">{seat === 'player1' ? 'Primary seat' : 'Challenger seat'}</p>
                    </div>
                    {#if badge}
                        <span class={badge.className}>{badge.label}</span>
                    {/if}
                </div>
                <div class="space-y-3 text-sm text-arena-text-dim">
                    <p>
                        Seat Status:
                        <span class="text-arena-text">{getPlayerData(seat)?.seat_claimed ? 'Occupied' : 'Available'}</span>
                    </p>
                    <p>
                        Deck Name:
                        <span class="text-arena-text">{getPlayerData(seat)?.deck_name || 'Pending submission'}</span>
                    </p>
                    <p>
                        Card Count:
                        <span class="text-arena-text">{getPlayerData(seat)?.card_count || '—'}</span>
                    </p>
                    <p>
                        Status:
                        <span class="text-arena-text">{getPlayerData(seat)?.message || (getPlayerData(seat)?.seat_claimed ? 'Awaiting deck submission' : 'Seat open for player')}</span>
                    </p>
                </div>
            </div>
        {/each}
    </div>

    {#if shouldShowDeckForm()}
        <div class="arena-card rounded-xl p-8 space-y-6 border border-arena-accent/20">
            <div>
                <h2 class="font-magic text-2xl text-arena-accent mb-2">📚 Submit Your Deck</h2>
                <p class="text-arena-text-dim text-sm">
                    Paste your decklist below or import it from a public URL. It will be validated automatically via Scryfall once submitted.
                </p>
            </div>

            <form class="space-y-4" onsubmit={submitDeck}>
                <div class="space-y-2">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p class="block text-sm font-semibold text-arena-text">Import from Deck Manager</p>
                        <a href="/decks" class="text-xs text-arena-accent hover:underline">Open Deck Library</a>
                    </div>
                    <div class="border border-arena-accent/20 rounded-lg bg-arena-surface/60 p-4 space-y-3">
                        {#if deckLibraryEntries.length === 0}
                            <p class="text-sm text-arena-muted">
                                No saved decks available yet. Visit the Deck Manager to create and save one.
                            </p>
                        {:else}
                            <div class="space-y-2">
                                {#each deckLibraryEntries as entry}
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-arena-accent/10 bg-arena-surface/70 rounded-lg p-3">
                                        <div>
                                            <p class="font-semibold text-arena-text">{entry.name}</p>
                                            <p class="text-xs text-arena-muted">{entry.subtitle}</p>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            {#if entry.legacy}
                                                <span class="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border border-arena-accent/30 text-arena-text-dim">Unsaved</span>
                                            {/if}
                                            <button
                                                type="button"
                                                class="arena-button px-4 py-2 text-xs font-semibold"
                                                onclick={() => loadDeckFromLibrary(entry.id)}
                                            >
                                                Load deck
                                            </button>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="flex items-center justify-center gap-2">
                    <span class="h-px flex-1 bg-arena-accent/20"></span>
                    <span class="text-xs font-semibold uppercase tracking-wide text-arena-muted">or</span>
                    <span class="h-px flex-1 bg-arena-accent/20"></span>
                </div>

                <div class="space-y-2">
                    <label for="decklistUrl" class="block text-sm font-semibold text-arena-text">Import from URL</label>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <input
                            type="url"
                            id="decklistUrl"
                            class={`flex-1 px-4 py-3 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none text-sm ${deckControlsDisabled() ? 'opacity-70 cursor-not-allowed' : ''}`}
                            placeholder="https://www.moxfield.com/decks/..."
                            autocomplete="off"
                            bind:value={deckUrl}
                            oninput={(event) => handleDeckUrlInput(event.target.value)}
                            disabled={deckControlsDisabled()}
                        />
                        <button
                            type="button"
                            class="arena-button rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            onclick={importDeckFromUrl}
                            disabled={deckControlsDisabled() || isImportingDeck}
                        >
                            {isImportingDeck ? 'Importing...' : 'Import Deck'}
                        </button>
                    </div>
                    <p class="text-xs text-arena-muted">
                        Paste a public deck URL from Moxfield, Scryfall, MTGGoldfish, etc. We'll fetch the list automatically.
                    </p>
                </div>

                <div class="flex items-center justify-center gap-2">
                    <span class="h-px flex-1 bg-arena-accent/20"></span>
                    <span class="text-xs font-semibold uppercase tracking-wide text-arena-muted">or</span>
                    <span class="h-px flex-1 bg-arena-accent/20"></span>
                </div>

                <textarea
                    id="decklistText"
                    rows="8"
                    class={deckTextareaClasses()}
                    placeholder={deckTextareaPlaceholder}
                    bind:value={deckText}
                    oninput={(event) => handleDeckTextInput(event.target.value)}
                    disabled={deckControlsDisabled()}
                ></textarea>

                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <p class="text-sm text-arena-muted">{opponentMessage}</p>
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            class="arena-button rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            onclick={previewDecklist}
                            disabled={deckControlsDisabled()}
                        >
                            Preview Deck
                        </button>
                        <button
                            type="submit"
                            class="arena-button rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={deckSubmitDisabled() || isSubmitting}
                        >
                            {isSubmitting ? 'Submitting...' : deckSubmitLabel()}
                        </button>
                    </div>
                </div>
            </form>

            {#if deckFormNotice}
                <div class="text-sm text-arena-muted">{deckFormNotice}</div>
            {/if}

            {#if deckStatus.text}
                <div class={`text-sm ${toneClass(deckStatus.tone)}`}>{deckStatus.text}</div>
            {/if}

            {#if showDeckPreview && deckPreview}
                <div class="space-y-3 border border-arena-accent/20 rounded-lg bg-arena-surface/60 p-4">
                    <div class="flex items-center justify-between">
                        <h3 class="font-semibold text-arena-accent">Deck Preview</h3>
                        <span class="text-xs text-arena-muted">{deckPreviewCount} cards previewed</span>
                    </div>
                    <div class="grid gap-2 md:grid-cols-2 text-sm max-h-56 overflow-y-auto pr-2">
                        {#each deckPreview.cards as entry, index}
                            <div class="flex justify-between items-center p-2 bg-arena-surface/40 rounded border border-arena-accent/10" data-index={index}>
                                <span class="text-arena-text">{entry.quantity}x {entry.card?.name}</span>
                                <span class="text-xs text-arena-muted">{entry.card?.mana_cost || '—'}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="p-4 rounded-lg bg-arena-surface/60 border border-dashed border-arena-accent/20 space-y-3">
                <div class="flex items-start gap-3">
                    <span class="text-xl">🪄</span>
                    <div>
                        <p class="text-sm text-arena-text">
                            Need a quick Modern showdown? Auto-import the top two paper decks from MTGGoldfish and start immediately.
                        </p>
                        <p class="text-xs text-arena-muted">
                            Source: <a href="https://www.mtggoldfish.com/metagame/modern#paper" class="underline hover:text-arena-accent" target="_blank" rel="noopener">MTGGoldfish Modern metagame</a>.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    class="arena-button w-full sm:w-auto px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={importModernDeckExample}
                    disabled={modernExampleLocked || isModernImportInFlight}
                >
                    {isModernImportInFlight ? 'Importing Modern decks...' : 'Import Modern Deck Example'}
                </button>
                <p class="text-xs text-arena-muted">
                    Imports decks for both seats in this room. Only works before other decks are submitted.
                </p>
            </div>
        </div>
    {:else if shouldShowSpectatorCard()}
        <div class="arena-card rounded-xl p-6 border border-arena-accent/20">
            <div class="flex items-start gap-3">
                <span class="text-2xl">👀</span>
                <div>
                    <h3 class="font-magic text-xl text-arena-accent mb-1">Spectator Mode</h3>
                    <p class="text-sm text-arena-text-dim">
                        Both seats are already taken. Feel free to stay on this page to monitor preparation or jump directly to the battlefield once decks are validated.
                    </p>
                </div>
            </div>
        </div>
    {/if}
</div>
