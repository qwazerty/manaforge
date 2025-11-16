// Game room page controller
(function () {
    const configElement = document.getElementById('game-setup-root');
    let config = window.gameRoomConfig || {};
    if (configElement && configElement.dataset && configElement.dataset.gameRoomConfig) {
        try {
            config = JSON.parse(configElement.dataset.gameRoomConfig) || {};
            window.gameRoomConfig = config;
        } catch (error) {
            console.warn('Unable to parse game room config dataset', error);
        }
    }
    const {
        gameId,
        playerRole,
        setupApiUrl,
        submitApiUrl,
        gameInterfaceUrl,
        initialStatus = {},
        shareLinks = {}
    } = config;

    const statusElements = {
        overall: document.getElementById('setup-overall-status'),
        lastUpdate: document.getElementById('setup-last-update'),
        seatSummary: document.getElementById('room-seat-summary'),
        progressPill: document.getElementById('setup-progress-pill'),
        opponentMessage: document.getElementById('opponent-status-msg'),
        deckStatus: document.getElementById('deck-submit-status')
    };

    const playerSections = {
        player1: document.querySelector('[data-player="player1"][data-field="details"]'),
        player1Badge: document.querySelector('[data-player="player1"][data-field="badge"]'),
        player1Name: document.querySelector('[data-player="player1"][data-field="name"]'),
        player2: document.querySelector('[data-player="player2"][data-field="details"]'),
        player2Badge: document.querySelector('[data-player="player2"][data-field="badge"]'),
        player2Name: document.querySelector('[data-player="player2"][data-field="name"]')
    };

    const shareButtons = document.querySelectorAll('[data-copy-role]');
    const copyStatusMessage = document.getElementById('copy-status-message');

    const deckFormSection = document.getElementById('deck-form-section');
    const deckForm = document.getElementById('deck-submit-form');
    const deckTextArea = document.getElementById('decklistText');
    const deckUrlInput = document.getElementById('decklistUrl');
    const deckPreviewButton = document.getElementById('deck-preview-button');
    const deckImportButton = document.getElementById('deck-import-button');
    const deckSubmitButton = document.getElementById('deck-submit-button');
    const deckPreviewContainer = document.getElementById('deck-preview');
    const deckPreviewCards = document.getElementById('deck-preview-cards');
    const deckPreviewCount = document.getElementById('deck-preview-count');
    const modernExampleButton = document.getElementById('modern-example-button');
    const deckLibrarySection = document.getElementById('deck-library-import');
    const deckLibraryList = document.getElementById('deck-library-import-list');
    const deckLibraryEmpty = document.getElementById('deck-library-import-empty');
    
    const gameFormatSelect = document.getElementById('game-format-select');
    const phaseModeSelect = document.getElementById('phase-mode-select');
    const playerRoleSelect = document.getElementById('player-role-select');

    const STATUS_POLL_INTERVAL = 2500;
    const PLAYER_NAME_STORAGE_KEY = 'manaforge:player-name';
    let aliasSyncInProgress = false;
    let aliasSyncedFromServer = false;
    let nameEditInProgress = false;
    let pollTimeoutId = null;
    let isFetchingStatus = false;
    let pendingImmediatePoll = false;
    let pollingDisabled = false;
    let lastStatus = initialStatus;
    let isSubmitting = false;
    let isImportingDeck = false;

    function getLegacyDeckState() {
        try {
            const raw = localStorage.getItem('manaforge:deck-manager:v1');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const state = parsed && typeof parsed === 'object' && parsed.state
                ? parsed.state
                : parsed;
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
            console.warn('Unable to read legacy deck state', error);
            return null;
        }
    }

    function getDeckLibraryDecks() {
        let decks = [];
        try {
            if (window.DeckLibrary && typeof window.DeckLibrary.list === 'function') {
                decks = window.DeckLibrary.list() || [];
            }
        } catch (error) {
            console.warn('Unable to load deck library entries', error);
        }
        const legacyDeck = getLegacyDeckState();
        if (legacyDeck && !decks.some((deck) => deck.id === legacyDeck.id)) {
            decks = [legacyDeck, ...decks];
        }
        return decks;
    }

    function countCardsInColumns(state, columnKeys) {
        if (!state || !state.columns || !state.entries) return 0;
        return columnKeys.reduce((sum, key) => {
            const entryIds = state.columns[key] || [];
            return sum + entryIds.reduce((colSum, entryId) => {
                const entry = state.entries[entryId];
                return colSum + (entry?.quantity || 0);
            }, 0);
        }, 0);
    }

    function buildDecklistFromState(state) {
        if (!state || !state.columns || !state.entries) return '';
        const entries = state.entries;
        const getEntries = (columnKey) => {
            const entryIds = state.columns[columnKey] || [];
            return entryIds
                .map((entryId) => entries[entryId])
                .filter((entry) => entry && entry.card && entry.quantity);
        };

        const lines = [];
        const mainColumns = ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands'];
        mainColumns.forEach((column) => {
            const columnEntries = getEntries(column);
            columnEntries.forEach((entry) => {
                const cardName = entry.card?.name || 'Unknown Card';
                lines.push(`${entry.quantity} ${cardName}`);
            });
        });

        const sideEntries = getEntries('sideboard');
        if (sideEntries.length) {
            lines.push('');
            lines.push('Sideboard');
            sideEntries.forEach((entry) => {
                const cardName = entry.card?.name || 'Unknown Card';
                lines.push(`${entry.quantity} ${cardName}`);
            });
        }

        const commanderEntries = getEntries('commander');
        if (commanderEntries.length) {
            lines.push('');
            lines.push('Commander');
            commanderEntries.forEach((entry) => {
                const cardName = entry.card?.name || 'Unknown Card';
                lines.push(`${entry.quantity} ${cardName}`);
            });
        }

        return lines.join('\n').trim();
    }

    function renderDeckLibraryOptions() {
        if (!deckLibrarySection || !deckLibraryList || !deckLibraryEmpty) {
            return;
        }
        const decks = getDeckLibraryDecks();
        deckLibraryList.innerHTML = '';

        if (!decks.length) {
            deckLibraryEmpty.classList.remove('hidden');
            return;
        }
        deckLibraryEmpty.classList.add('hidden');

        decks.forEach((deck) => {
            const mainCount = countCardsInColumns(deck.state, ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands']);
            const sideCount = countCardsInColumns(deck.state, ['sideboard']);
            const subtitleParts = [
                (deck.format || 'unknown').toUpperCase(),
                `${mainCount} main`,
                sideCount ? `${sideCount} side` : null
            ].filter(Boolean);

            const row = document.createElement('div');
            row.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-arena-accent/10 bg-arena-surface/70 rounded-lg p-3';
            row.innerHTML = `
                <div>
                    <p class="font-semibold text-arena-text">${deck.name || 'Untitled Deck'}</p>
                    <p class="text-xs text-arena-muted">${subtitleParts.join(' • ')}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${deck.legacy ? '<span class="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full border border-arena-accent/30 text-arena-text-dim">Unsaved</span>' : ''}
                    <button type="button" class="arena-button px-4 py-2 text-xs font-semibold" data-deck-library-id="${deck.id}">
                        Load deck
                    </button>
                </div>
            `;
            deckLibraryList.appendChild(row);
        });
    }

    function handleDeckLibraryClick(event) {
        const target = event.target.closest('button[data-deck-library-id]');
        if (!target) return;
        const deckId = target.dataset.deckLibraryId;
        if (!deckId) return;
        const deck = getDeckLibraryDecks().find((entry) => entry.id === deckId);
        if (!deck) {
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = 'Unable to locate the selected deck.';
                statusElements.deckStatus.classList.remove('text-arena-accent');
                statusElements.deckStatus.classList.add('text-red-300');
            }
            return;
        }

        const deckText = buildDecklistFromState(deck.state);
        if (!deckText) {
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = 'This deck appears to be empty.';
                statusElements.deckStatus.classList.remove('text-arena-accent');
                statusElements.deckStatus.classList.add('text-red-300');
            }
            return;
        }

        if (deckTextArea) {
            deckTextArea.value = deckText;
            deckTextArea.dispatchEvent(new Event('input'));
        }
        if (deckUrlInput) {
            deckUrlInput.value = '';
        }
        renderDeckPreview(null);

        if (statusElements.deckStatus) {
            statusElements.deckStatus.textContent = `Loaded deck "${deck.name || 'Untitled Deck'}" from Deck Manager.`;
            statusElements.deckStatus.classList.remove('text-red-300');
            statusElements.deckStatus.classList.add('text-arena-accent');
        }
    }

    function getStoredPlayerAlias() {
        try {
            return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
        } catch (error) {
            console.warn('Unable to read stored player alias', error);
            return '';
        }
    }

    function persistPlayerAlias(name) {
        if (!name) return;
        try {
            localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
        } catch (error) {
            console.warn('Unable to store player alias', error);
        }
    }

    function maybeSyncPlayerAlias(status) {
        if (aliasSyncedFromServer || aliasSyncInProgress) return;
        if (!gameId) return;
        if (playerRole !== 'player1' && playerRole !== 'player2') return;

        const currentSeatStatus = status?.player_status?.[playerRole];
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
                console.warn('Failed to synchronize player alias', error);
            })
            .finally(() => {
                aliasSyncInProgress = false;
            });
    }
    function pausePollingForNameEdit() {
        nameEditInProgress = true;
        stopPolling();
    }

    function resumePollingAfterNameEdit() {
        nameEditInProgress = false;
        pollingDisabled = false;
        pollSetupStatus(true);
    }

    function selectElementText(element) {
        if (!element) return;
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    async function submitNameChange(playerKey, newName, originalName) {
        if (!gameId) return null;
        const trimmed = newName.trim();
        if (!trimmed) {
            throw new Error('Name cannot be empty.');
        }

        const response = await fetch(`/api/v1/games/${encodeURIComponent(gameId)}/claim-seat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_id: playerKey,
                player_name: trimmed
            })
        });

        const updatedStatus = await response.json().catch(() => null);
        if (!response.ok) {
            const detail = updatedStatus?.detail || 'Unable to update the name.';
            throw new Error(detail);
        }

        if (updatedStatus) {
            updateStatus(updatedStatus);
            const sanitized = updatedStatus.player_status?.[playerKey]?.player_name;
            if (playerKey === playerRole && sanitized) {
                persistPlayerAlias(sanitized);
            }
            return sanitized || trimmed;
        }

        return trimmed;
    }

    function finishInlineEdit(nameElement, playerKey, originalName, { commit = true } = {}) {
        if (!nameElement) return;

        const cleanup = () => {
            nameElement.removeAttribute('contenteditable');
            nameElement.classList.remove('ring-2', 'ring-arena-accent/50', 'px-1', 'rounded');
            nameElement.dataset.editing = 'false';
            nameElement.classList.remove('player-name-editing');
        };

        const finishAndResume = () => {
            cleanup();
            resumePollingAfterNameEdit();
        };

        if (!commit) {
            nameElement.textContent = originalName;
            finishAndResume();
            return;
        }

        const newValue = nameElement.textContent.trim();
        if (!newValue || newValue === originalName) {
            nameElement.textContent = originalName;
            finishAndResume();
            return;
        }

        nameElement.dataset.saving = 'true';

        submitNameChange(playerKey, newValue, originalName)
            .then((sanitized) => {
                nameElement.textContent = sanitized || newValue;
                if (statusElements.deckStatus) {
                    statusElements.deckStatus.textContent = 'Name updated.';
                    statusElements.deckStatus.classList.remove('text-red-300');
                    statusElements.deckStatus.classList.add('text-arena-accent');
                }
            })
            .catch((error) => {
                console.error('Alias update failed:', error);
                nameElement.textContent = originalName;
                if (statusElements.deckStatus) {
                    statusElements.deckStatus.textContent = error.message || 'Unable to update the name.';
                    statusElements.deckStatus.classList.add('text-red-300');
                }
            })
            .finally(() => {
                delete nameElement.dataset.saving;
                finishAndResume();
            });
    }

    function startInlineNameEdit(playerKey) {
        if (playerRole !== playerKey) return;
        const nameElement = playerSections[`${playerKey}Name`];
        if (!nameElement) return;
        if (nameElement.dataset.editing === 'true') return;

        nameElement.dataset.editing = 'true';
        nameElement.contentEditable = 'true';
        nameElement.spellcheck = false;
        nameElement.classList.add('ring-2', 'ring-arena-accent/50', 'px-1', 'rounded');
        nameElement.classList.add('player-name-editing');
        pausePollingForNameEdit();

        const originalName = nameElement.textContent.trim();
        setTimeout(() => selectElementText(nameElement), 0);

        const handleKeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                nameElement.removeEventListener('keydown', handleKeydown);
                nameElement.removeEventListener('blur', handleBlur);
                finishInlineEdit(nameElement, playerKey, originalName, { commit: true });
            } else if (event.key === 'Escape') {
                event.preventDefault();
                nameElement.removeEventListener('keydown', handleKeydown);
                nameElement.removeEventListener('blur', handleBlur);
                finishInlineEdit(nameElement, playerKey, originalName, { commit: false });
            }
        };

        const handleBlur = () => {
            nameElement.removeEventListener('keydown', handleKeydown);
            nameElement.removeEventListener('blur', handleBlur);
            finishInlineEdit(nameElement, playerKey, originalName, { commit: true });
        };

        nameElement.addEventListener('keydown', handleKeydown);
        nameElement.addEventListener('blur', handleBlur);
    }

    function setImportButtonLoadingState(isLoading) {
        if (!deckImportButton) return;

        if (isLoading) {
            if (!deckImportButton.dataset.originalLabel) {
                deckImportButton.dataset.originalLabel = deckImportButton.textContent;
            }
            deckImportButton.textContent = 'Importing...';
            deckImportButton.setAttribute('aria-busy', 'true');
        } else {
            const originalLabel = deckImportButton.dataset.originalLabel;
            if (originalLabel) {
                deckImportButton.textContent = originalLabel;
            }
            deckImportButton.removeAttribute('aria-busy');
            delete deckImportButton.dataset.originalLabel;
        }

        deckImportButton.disabled = isLoading;
        deckImportButton.style.opacity = isLoading ? '0.5' : '';
        deckImportButton.classList.toggle('cursor-not-allowed', isLoading);
        isImportingDeck = isLoading;
    }

    function applyModernExampleDisabledState(disabled) {
        if (!modernExampleButton) return;
        modernExampleButton.disabled = disabled;
        modernExampleButton.classList.toggle('opacity-50', disabled);
        modernExampleButton.classList.toggle('cursor-not-allowed', disabled);
    }

    function setModernExampleButtonState(isLoading) {
        if (!modernExampleButton) return;
        if (isLoading) {
            if (!modernExampleButton.dataset.originalLabel) {
                modernExampleButton.dataset.originalLabel = modernExampleButton.textContent;
            }
            modernExampleButton.textContent = 'Importing Modern decks...';
            modernExampleButton.dataset.loading = 'true';
            applyModernExampleDisabledState(true);
        } else {
            delete modernExampleButton.dataset.loading;
            if (modernExampleButton.dataset.originalLabel) {
                modernExampleButton.textContent = modernExampleButton.dataset.originalLabel;
                delete modernExampleButton.dataset.originalLabel;
            }
            if (modernExampleButton.dataset.locked !== 'true') {
                applyModernExampleDisabledState(false);
            }
        }
    }

    function updateModernExampleAvailability(status) {
        if (!modernExampleButton) return;
        const playerInfo = status.player_status || {};
        const hasSubmission = ['player1', 'player2'].some((seat) => playerInfo[seat]?.submitted);
        const shouldDisable = status.ready
            || hasSubmission
            || (playerRole !== 'player1' && playerRole !== 'player2');

        if (shouldDisable) {
            modernExampleButton.dataset.locked = 'true';
        } else {
            delete modernExampleButton.dataset.locked;
        }
        if (modernExampleButton.dataset.loading === 'true') {
            return;
        }
        applyModernExampleDisabledState(shouldDisable);
    }

    function updateShareButtons() {
        shareButtons.forEach((btn) => {
            const role = btn.getAttribute('data-copy-role');
            const link = shareLinks[role];
            if (!link) return;
            btn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(link);
                    copyStatusMessage.textContent = `Link copied for ${role}!`;
                    copyStatusMessage.classList.remove('text-arena-muted');
                    copyStatusMessage.classList.add('text-arena-accent');
                    setTimeout(() => {
                        copyStatusMessage.textContent = '';
                        copyStatusMessage.classList.remove('text-arena-accent');
                        copyStatusMessage.classList.add('text-arena-muted');
                    }, 2500);
                } catch (err) {
                    copyStatusMessage.textContent = 'Unable to copy link automatically.';
                    copyStatusMessage.classList.remove('text-arena-accent');
                    copyStatusMessage.classList.add('text-red-300');
                }
            });
        });
    }

    function bindNameEditing() {
        ['player1', 'player2'].forEach((playerKey) => {
            const nameElement = playerSections[`${playerKey}Name`];
            if (!nameElement) return;
            nameElement.addEventListener('click', () => {
                const editable = nameElement.getAttribute('data-name-editable');
                if (editable !== 'true') return;
                startInlineNameEdit(playerKey);
            });
        });

        document.querySelectorAll('[data-name-edit-trigger]').forEach((button) => {
            const target = button.getAttribute('data-name-edit-trigger');
            button.addEventListener('click', (event) => {
                event.preventDefault();
                if (!target) return;
                startInlineNameEdit(target);
            });
        });
    }

    function loadDeckFromCache() {
        if (!deckTextArea || (playerRole !== 'player1' && playerRole !== 'player2')) return;
        if (!gameId) return;

        try {
            const storageKey = `manaforge:deck:${gameId}:${playerRole}`;
            const cached = localStorage.getItem(storageKey);
            if (cached && !deckTextArea.value.trim()) {
                deckTextArea.value = cached;
            }
        } catch (error) {
            console.warn('Unable to load cached decklist', error);
        }
    }

    function storeDecklistForRole(gameId, role, decklistText) {
        if (!decklistText || !role) return;
        try {
            const storageKey = `manaforge:deck:${gameId}:${role}`;
            localStorage.setItem(storageKey, decklistText);
        } catch (error) {
            console.warn('Unable to cache decklist for later use', error);
        }
    }

    function formatTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function updateProgressPill(status) {
        if (!statusElements.progressPill) return;

        const playerStatus = status.player_status || {};
        const submittedCount = Object.values(playerStatus).filter((info) => info.submitted).length;
        statusElements.progressPill.innerHTML = `
            Deck submissions:
            <span class="font-semibold text-arena-accent">${submittedCount} / 2</span>
        `;
    }

    async function handleGameFormatChange(newFormat) {
        if (!gameId || !newFormat) return;
        
        try {
            const response = await fetch(`/api/v1/games/${encodeURIComponent(gameId)}/update-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game_format: newFormat })
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.detail || 'Failed to update game format');
            }

            const updatedStatus = await response.json();
            updateStatus(updatedStatus);
            
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = `Game format updated to ${newFormat.replace('_', ' ')}`;
                statusElements.deckStatus.classList.remove('text-red-300', 'text-arena-muted');
                statusElements.deckStatus.classList.add('text-arena-accent');
                setTimeout(() => {
                    statusElements.deckStatus.textContent = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to update game format:', error);
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = error.message || 'Failed to update game format';
                statusElements.deckStatus.classList.remove('text-arena-accent', 'text-arena-muted');
                statusElements.deckStatus.classList.add('text-red-300');
            }
            // Revert the select to the previous value
            if (gameFormatSelect && lastStatus) {
                gameFormatSelect.value = lastStatus.game_format;
            }
        }
    }

    async function handlePhaseModeChange(newPhaseMode) {
        if (!gameId || !newPhaseMode) return;
        
        try {
            const response = await fetch(`/api/v1/games/${encodeURIComponent(gameId)}/update-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase_mode: newPhaseMode })
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.detail || 'Failed to update phase mode');
            }

            const updatedStatus = await response.json();
            updateStatus(updatedStatus);
            
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = `Phase mode updated to ${newPhaseMode.replace('_', ' ')}`;
                statusElements.deckStatus.classList.remove('text-red-300', 'text-arena-muted');
                statusElements.deckStatus.classList.add('text-arena-accent');
                setTimeout(() => {
                    statusElements.deckStatus.textContent = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to update phase mode:', error);
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = error.message || 'Failed to update phase mode';
                statusElements.deckStatus.classList.remove('text-arena-accent', 'text-arena-muted');
                statusElements.deckStatus.classList.add('text-red-300');
            }
            // Revert the select to the previous value
            if (phaseModeSelect && lastStatus) {
                phaseModeSelect.value = lastStatus.phase_mode;
            }
        }
    }

    function handlePlayerRoleChange(newRole) {
        if (!gameId || !newRole) return;
        
        // Construct the new URL with the updated role parameter
        const url = new URL(window.location.href);
        url.searchParams.set('player', newRole);
        
        // Reload the page with the new role
        window.location.href = url.toString();
    }

    function updateProgressPill(status) {
        if (!statusElements.progressPill) return;

        const playerStatus = status.player_status || {};
        const submittedCount = Object.values(playerStatus).filter((info) => info.submitted).length;
        statusElements.progressPill.innerHTML = `
            Deck submissions:
            <span class="font-semibold text-arena-accent">${submittedCount} / 2</span>
        `;
    }

    function updatePlayerSection(playerKey, data) {
        const detailsElement = playerSections[playerKey];
        const badgeElement = playerSections[`${playerKey}Badge`];
        const nameElement = playerSections[`${playerKey}Name`];
        if (!detailsElement || !badgeElement) return;

        const isValidated = data?.validated;
        const isSubmitted = data?.submitted;
        const seatClaimed = data?.seat_claimed;
        const fallbackName = playerKey === 'player1' ? 'Player 1' : 'Player 2';
        const displayName = data?.player_name || fallbackName;
        const isEditing = nameElement?.dataset?.editing === 'true';
        const aliasDisplay = isEditing && nameElement ? nameElement.textContent.trim() : displayName;

        badgeElement.classList.remove(
            'border-yellow-500/40', 'text-yellow-300',
            'border-green-500/40', 'text-green-300',
            'border-red-500/40', 'text-red-300',
            'border-blue-500/40', 'text-blue-300'
        );

        if (!seatClaimed) {
            badgeElement.textContent = 'Open Seat';
            badgeElement.classList.add('border-red-500/40', 'text-red-300');
        } else if (isValidated) {
            badgeElement.textContent = 'Ready';
            badgeElement.classList.add('border-green-500/40', 'text-green-300');
        } else if (isSubmitted) {
            badgeElement.textContent = 'Deck Submitted';
            badgeElement.classList.add('border-yellow-500/40', 'text-yellow-300');
        } else {
            badgeElement.textContent = 'Seated';
            badgeElement.classList.add('border-blue-500/40', 'text-blue-300');
        }

        if (nameElement && !isEditing) {
            nameElement.textContent = displayName;
        }

        detailsElement.innerHTML = `
            <p>Seat Status: <span class="text-arena-text">${seatClaimed ? 'Occupied' : 'Available'}</span></p>
            <p>Deck Name: <span class="text-arena-text">${data?.deck_name || 'Pending submission'}</span></p>
            <p>Card Count: <span class="text-arena-text">${data?.card_count || '—'}</span></p>
            <p>Status: <span class="text-arena-text">${data?.message || (seatClaimed ? 'Awaiting deck submission' : 'Seat open for player')}</span></p>
        `;
    }

    function updateStatus(status) {
        lastStatus = status;
        if (nameEditInProgress) {
            return;
        }
        maybeSyncPlayerAlias(status);

        if (statusElements.overall) {
            statusElements.overall.textContent = status.status || 'Setting up battlefield...';
        }
        if (statusElements.lastUpdate) {
            statusElements.lastUpdate.textContent = `Last update: ${formatTimestamp()}`;
        }
        const playerInfo = status.player_status || {};

        if (statusElements.seatSummary) {
            const seatClaimed = ['player1', 'player2'].filter((key) => playerInfo[key]?.seat_claimed).length;
            const missingSeats = ['player1', 'player2'].filter((key) => !playerInfo[key]?.seat_claimed)
                .map((seat) => seat.replace('player', 'Player '));
            const summarySpan = statusElements.seatSummary.querySelector('span');
            if (summarySpan) {
                summarySpan.textContent = missingSeats.length
                    ? `${seatClaimed}/2 filled • Waiting on ${missingSeats.join(' & ')}`
                    : `${seatClaimed}/2 filled • All seats occupied`;
            }
        }

        if (statusElements.opponentMessage) {
            const opponentKey = playerRole === 'player1' ? 'player2' : 'player1';
            const opponentStatus = playerInfo[opponentKey];
            const playerSeatStatus = playerInfo[playerRole];
            if (playerRole !== 'player1' && playerRole !== 'player2') {
                statusElements.opponentMessage.textContent = 'Spectating room status...';
            } else if (!playerSeatStatus?.seat_claimed) {
                statusElements.opponentMessage.textContent = 'Claiming your seat...';
            } else if (playerSeatStatus?.validated) {
                statusElements.opponentMessage.textContent = 'Deck submitted! Waiting for opponent validation.';
            } else if (opponentStatus?.validated) {
                statusElements.opponentMessage.textContent = 'Opponent ready! Submit your validated deck.';
            } else if (opponentStatus?.seat_claimed) {
                statusElements.opponentMessage.textContent = 'Opponent has taken their seat. Awaiting deck submissions.';
            } else {
                statusElements.opponentMessage.textContent = 'Waiting for opponent to join the room...';
            }
        }

        updateProgressPill(status);
        updatePlayerSection('player1', status.player_status?.player1 || null);
        updatePlayerSection('player2', status.player_status?.player2 || null);
        updateModernExampleAvailability(status);
        
        // Update dropdown values if they've changed
        if (gameFormatSelect && status.game_format && gameFormatSelect.value !== status.game_format) {
            gameFormatSelect.value = status.game_format;
        }
        if (phaseModeSelect && status.phase_mode && phaseModeSelect.value !== status.phase_mode) {
            phaseModeSelect.value = status.phase_mode;
        }
    }

    function toggleDeckForm(visible) {
        if (!deckFormSection) return;
        deckFormSection.classList.toggle('hidden', !visible);
    }

    function toggleSpectatorMessage(visible) {
        const spectatorMessage = document.getElementById('spectator-message');
        if (!spectatorMessage) return;
        spectatorMessage.classList.toggle('hidden', !visible);
    }

    function updateFormAvailability(status) {
        const playerStatus = status.player_status || {};
        const myStatus = playerStatus[playerRole];

        if (!deckFormSection) return;

        if (playerRole !== 'player1' && playerRole !== 'player2') {
            toggleDeckForm(false);
            toggleSpectatorMessage(true);
            return;
        }

        if (status.ready && status.setup_complete) {
            // Game already spawned, redirect will happen soon
            toggleDeckForm(false);
            toggleSpectatorMessage(false);
            return;
        }

        if (!myStatus?.seat_claimed) {
            toggleDeckForm(false);
            toggleSpectatorMessage(false);
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = 'Your seat is not yet assigned.';
                statusElements.deckStatus.classList.remove('text-arena-accent', 'text-red-300');
                statusElements.deckStatus.classList.add('text-arena-muted');
            }
            return;
        }

        toggleDeckForm(true);
        toggleSpectatorMessage(false);

        if (myStatus?.validated) {
            deckSubmitButton.disabled = true;
            deckSubmitButton.classList.add('opacity-50', 'cursor-not-allowed');
            deckSubmitButton.textContent = 'Deck Validated ✔️';
            if (deckTextArea) {
                deckTextArea.disabled = true;
                deckTextArea.classList.add('opacity-70', 'cursor-not-allowed');
            }
            if (deckUrlInput) {
                deckUrlInput.disabled = true;
                deckUrlInput.classList.add('opacity-70', 'cursor-not-allowed');
            }
            if (deckImportButton) {
                deckImportButton.disabled = true;
                deckImportButton.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            deckSubmitButton.disabled = false;
            deckSubmitButton.classList.remove('opacity-50', 'cursor-not-allowed');
            deckSubmitButton.textContent = 'Submit Deck';
            if (deckTextArea) {
                deckTextArea.disabled = false;
                deckTextArea.classList.remove('opacity-70', 'cursor-not-allowed');
            }
            if (deckUrlInput) {
                deckUrlInput.disabled = false;
                deckUrlInput.classList.remove('opacity-70', 'cursor-not-allowed');
            }
            if (deckImportButton) {
                deckImportButton.disabled = false;
                deckImportButton.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    function renderDeckPreview(deckPayload) {
        if (!deckPreviewContainer || !deckPreviewCards || !deckPreviewCount) return;

        if (!deckPayload || !deckPayload.cards || !deckPayload.cards.length) {
            deckPreviewContainer.classList.add('hidden');
            deckPreviewCards.innerHTML = '';
            return;
        }

        deckPreviewCards.innerHTML = deckPayload.cards.map((entry) => `
            <div class="flex justify-between items-center p-2 bg-arena-surface/40 rounded border border-arena-accent/10">
                <span class="text-arena-text">${entry.quantity}x ${entry.card.name}</span>
                <span class="text-xs text-arena-muted">${entry.card.mana_cost || '—'}</span>
            </div>
        `).join('');

        const totalCards = deckPayload.cards.reduce((sum, entry) => sum + entry.quantity, 0);
        deckPreviewCount.textContent = `${totalCards} cards previewed`;
        deckPreviewContainer.classList.remove('hidden');
    }

    async function importModernDeckExample() {
        if (!modernExampleButton || !gameId) return;
        if (playerRole !== 'player1' && playerRole !== 'player2') {
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = 'Only seated players can import demo decks.';
                statusElements.deckStatus.classList.remove('text-arena-accent', 'text-arena-muted');
                statusElements.deckStatus.classList.add('text-red-300');
            }
            return;
        }

        const phaseMode = (lastStatus?.phase_mode) || (initialStatus?.phase_mode) || 'strict';

        setModernExampleButtonState(true);
        if (statusElements.deckStatus) {
            statusElements.deckStatus.textContent = 'Fetching the latest Modern decks from MTGGoldfish...';
            statusElements.deckStatus.classList.remove('text-red-300');
            statusElements.deckStatus.classList.add('text-arena-muted');
        }

        try {
            const response = await fetch('/api/v1/games/import-modern-example', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game_id: gameId,
                    phase_mode: phaseMode
                })
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.detail || 'Unable to import Modern decks.');
            }

            const payload = await response.json();
            if (payload.setup) {
                updateStatus(payload.setup);
                updateFormAvailability(payload.setup);
            }

            renderDeckPreview(null);

            const deckList = Array.isArray(payload.decks) ? payload.decks : [];
            const deckSummary = deckList
                .map((deck) => deck.deck_name || deck.player_id || 'Modern Deck')
                .join(' vs ');

            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = deckSummary
                    ? `Imported Modern example: ${deckSummary}. Redirecting soon...`
                    : 'Modern example imported. Redirecting soon...';
                statusElements.deckStatus.classList.remove('text-red-300', 'text-arena-muted');
                statusElements.deckStatus.classList.add('text-arena-accent');
            }

            pollSetupStatus(true);
        } catch (error) {
            console.error('Modern example import error:', error);
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = error.message || 'Unable to import Modern example.';
                statusElements.deckStatus.classList.remove('text-arena-accent', 'text-arena-muted');
                statusElements.deckStatus.classList.add('text-red-300');
            }
        } finally {
            setModernExampleButtonState(false);
        }
    }

    async function importDeckFromUrl() {
        if (!statusElements.deckStatus) return null;
        if (isImportingDeck) return null;

        const deckUrl = deckUrlInput ? deckUrlInput.value.trim() : '';

        if (!deckUrl) {
            statusElements.deckStatus.textContent = 'Please enter a deck URL to import.';
            statusElements.deckStatus.classList.remove('text-arena-accent', 'text-arena-muted');
            statusElements.deckStatus.classList.add('text-red-300');
            return null;
        }

        statusElements.deckStatus.textContent = 'Importing deck from URL...';
        statusElements.deckStatus.classList.remove('text-arena-accent', 'text-red-300');
        statusElements.deckStatus.classList.add('text-arena-muted');

        setImportButtonLoadingState(true);

        try {
            const response = await fetch('/api/v1/decks/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deck_url: deckUrl })
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.detail || 'Deck import failed');
            }

            const payload = await response.json();
            const deckText = (payload.deck_text || '').trim();

            if (deckTextArea && deckText) {
                deckTextArea.value = deckText;
            }

            if (payload.deck) {
                renderDeckPreview(payload.deck);
            } else {
                renderDeckPreview(null);
            }

            statusElements.deckStatus.textContent = 'Deck imported successfully. Review and submit when ready.';
            statusElements.deckStatus.classList.remove('text-arena-muted', 'text-red-300');
            statusElements.deckStatus.classList.add('text-arena-accent');

            if ((playerRole === 'player1' || playerRole === 'player2') && deckText) {
                storeDecklistForRole(gameId, playerRole, deckText);
            }

            return payload;
        } catch (error) {
            console.error('Deck import error:', error);
            statusElements.deckStatus.textContent = error.message || 'Unable to import deck.';
            statusElements.deckStatus.classList.remove('text-arena-muted', 'text-arena-accent');
            statusElements.deckStatus.classList.add('text-red-300');
            return null;
        } finally {
            setImportButtonLoadingState(false);
        }
    }

    async function previewDecklist() {
        if (!deckTextArea) return;

        const deckText = deckTextArea.value.trim();
        const deckUrl = deckUrlInput ? deckUrlInput.value.trim() : '';

        if (!deckText && deckUrl) {
            await importDeckFromUrl();
            return;
        }

        if (!deckText) {
            statusElements.deckStatus.textContent = 'Please paste a decklist or provide a deck URL first.';
            statusElements.deckStatus.classList.remove('text-arena-accent', 'text-arena-muted');
            statusElements.deckStatus.classList.add('text-red-300');
            return;
        }

        statusElements.deckStatus.textContent = 'Parsing deck for preview...';
        statusElements.deckStatus.classList.remove('text-red-300', 'text-arena-accent');
        statusElements.deckStatus.classList.add('text-arena-muted');

        try {
            const response = await fetch('/api/v1/decks/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decklist_text: deckText })
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.detail || 'Deck parsing failed');
            }

            const parsedDeck = await response.json();
            renderDeckPreview(parsedDeck);

            statusElements.deckStatus.textContent = 'Deck parsed successfully.';
            statusElements.deckStatus.classList.remove('text-arena-muted');
            statusElements.deckStatus.classList.add('text-arena-accent');
        } catch (error) {
            console.error('Deck preview error:', error);
            statusElements.deckStatus.textContent = error.message || 'Unable to preview deck.';
            statusElements.deckStatus.classList.add('text-red-300');
        }
    }

    async function submitDeck(event) {
        event.preventDefault();
        if (isSubmitting || !deckTextArea) return;

        let deckText = deckTextArea.value.trim();
        const deckUrl = deckUrlInput ? deckUrlInput.value.trim() : '';

        if (!deckText && deckUrl) {
            const importResult = await importDeckFromUrl();
            if (!importResult) {
                return;
            }
            deckText = deckTextArea.value.trim();
        }

        if (!deckText) {
            statusElements.deckStatus.textContent = 'Please paste a decklist or import from a URL before submitting.';
            statusElements.deckStatus.classList.remove('text-arena-accent', 'text-arena-muted');
            statusElements.deckStatus.classList.add('text-red-300');
            return;
        }

        if (playerRole !== 'player1' && playerRole !== 'player2') {
            statusElements.deckStatus.textContent = 'Spectators cannot submit decks.';
            statusElements.deckStatus.classList.add('text-red-300');
            return;
        }

        isSubmitting = true;
        deckSubmitButton.disabled = true;
        deckSubmitButton.classList.add('opacity-50', 'cursor-not-allowed');
        statusElements.deckStatus.textContent = 'Validating and submitting deck...';
        statusElements.deckStatus.classList.remove('text-red-300', 'text-arena-accent');
        statusElements.deckStatus.classList.add('text-arena-muted');

        try {
            const payload = {
                player_id: playerRole
            };

            if (deckText) {
                payload.decklist_text = deckText;
            } else if (deckUrl) {
                payload.decklist_url = deckUrl;
            }

            const response = await fetch(submitApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.detail || 'Deck submission failed');
            }

            const updatedStatus = await response.json();
            updateStatus(updatedStatus);
            updateFormAvailability(updatedStatus);
            renderDeckPreview(null);

            if (deckText) {
                storeDecklistForRole(gameId, playerRole, deckText);
            }

            statusElements.deckStatus.textContent = 'Deck submitted successfully!';
            statusElements.deckStatus.classList.add('text-arena-accent');
        } catch (error) {
            console.error('Deck submission error:', error);
            statusElements.deckStatus.textContent = error.message || 'Unable to submit deck.';
            statusElements.deckStatus.classList.add('text-red-300');
        } finally {
            isSubmitting = false;
            deckSubmitButton.disabled = false;
            deckSubmitButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function shouldRedirectToGame(status) {
        if (!status) return false;
        if (!status.ready) return false;

        if (playerRole === 'player1' || playerRole === 'player2') {
            return status.player_status?.[playerRole]?.validated;
        }

        return true;
    }

    function performRedirect() {
        const url = new URL(gameInterfaceUrl, window.location.origin);
        if (playerRole === 'player1' || playerRole === 'player2') {
            url.searchParams.set('player', playerRole);
        } else {
            url.searchParams.set('player', 'spectator');
        }
        window.location.href = url.toString();
    }

    function scheduleNextPoll() {
        if (pollTimeoutId) clearTimeout(pollTimeoutId);
        if (pollingDisabled || document.visibilityState === 'hidden') return;
        pollTimeoutId = setTimeout(() => pollSetupStatus(), STATUS_POLL_INTERVAL);
    }

    function stopPolling() {
        pollingDisabled = true;
        pendingImmediatePoll = false;
        if (pollTimeoutId) {
            clearTimeout(pollTimeoutId);
            pollTimeoutId = null;
        }
    }

    async function pollSetupStatus(force = false) {
        if (isFetchingStatus) {
            if (force) pendingImmediatePoll = true;
            return;
        }

        isFetchingStatus = true;
        try {
            const response = await fetch(`${setupApiUrl}?_=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-store' }
            });
            if (!response.ok) throw new Error('Unable to refresh setup status');
            const status = await response.json();
            updateStatus(status);
            updateFormAvailability(status);

            if (shouldRedirectToGame(status)) {
                stopPolling();
                if (statusElements.deckStatus) {
                    statusElements.deckStatus.textContent = 'Both decks validated! Entering battlefield...';
                    statusElements.deckStatus.classList.add('text-arena-accent');
                }
                pollingDisabled = true;
                setTimeout(() => performRedirect(), 1200);
                return;
            }
        } catch (error) {
            console.error('Polling error:', error);
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = 'Connection issue while updating status.';
                statusElements.deckStatus.classList.add('text-red-300');
            }
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
    }

    function initialize() {
        if (!gameId) return;

        updateStatus(initialStatus);
        updateFormAvailability(initialStatus);
        loadDeckFromCache();
        updateShareButtons();
        bindNameEditing();
        renderDeckLibraryOptions();
        if (deckLibraryList) {
            deckLibraryList.addEventListener('click', handleDeckLibraryClick);
        }

        if (deckPreviewButton) {
            deckPreviewButton.addEventListener('click', previewDecklist);
        }
        if (deckImportButton) {
            deckImportButton.addEventListener('click', importDeckFromUrl);
        }
        if (deckForm) {
            deckForm.addEventListener('submit', submitDeck);
        }
        if (deckUrlInput) {
            deckUrlInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    importDeckFromUrl();
                }
            });
        }
        if (modernExampleButton) {
            modernExampleButton.addEventListener('click', importModernDeckExample);
        }
        
        // Add dropdown event listeners
        if (gameFormatSelect) {
            gameFormatSelect.addEventListener('change', (event) => {
                handleGameFormatChange(event.target.value);
            });
        }
        if (phaseModeSelect) {
            phaseModeSelect.addEventListener('change', (event) => {
                handlePhaseModeChange(event.target.value);
            });
        }
        if (playerRoleSelect) {
            playerRoleSelect.addEventListener('change', (event) => {
                handlePlayerRoleChange(event.target.value);
            });
        }

        if (shouldRedirectToGame(initialStatus)) {
            if (statusElements.deckStatus) {
                statusElements.deckStatus.textContent = 'Battlefield ready! Entering soon...';
                statusElements.deckStatus.classList.add('text-arena-accent');
            }
            setTimeout(() => performRedirect(), 800);
            return;
        }

        pollingDisabled = false;
        pollSetupStatus(true);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            stopPolling();
        } else {
            pollingDisabled = false;
            renderDeckLibraryOptions();
            pollSetupStatus(true);
        }
    });

    window.addEventListener('beforeunload', () => {
        stopPolling();
    });

    initialize();
})();
