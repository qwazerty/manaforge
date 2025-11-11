// Game room page controller
(function () {
    const config = window.gameRoomConfig || {};
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
        player2: document.querySelector('[data-player="player2"][data-field="details"]'),
        player2Badge: document.querySelector('[data-player="player2"][data-field="badge"]')
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

    const STATUS_POLL_INTERVAL = 2500;
    let pollTimeoutId = null;
    let isFetchingStatus = false;
    let pendingImmediatePoll = false;
    let pollingDisabled = false;
    let lastStatus = initialStatus;
    let isSubmitting = false;
    let isImportingDeck = false;

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

    function updatePlayerSection(playerKey, data) {
        const detailsElement = playerSections[playerKey];
        const badgeElement = playerSections[`${playerKey}Badge`];
        if (!detailsElement || !badgeElement) return;

        const isValidated = data?.validated;
        const isSubmitted = data?.submitted;
        const seatClaimed = data?.seat_claimed;

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

        detailsElement.innerHTML = `
            <p>Seat Status: <span class="text-arena-text">${seatClaimed ? 'Occupied' : 'Available'}</span></p>
            <p>Deck Name: <span class="text-arena-text">${data?.deck_name || 'Pending submission'}</span></p>
            <p>Card Count: <span class="text-arena-text">${data?.card_count || '—'}</span></p>
            <p>Status: <span class="text-arena-text">${data?.message || (seatClaimed ? 'Awaiting deck submission' : 'Seat open for player')}</span></p>
        `;
    }

    function updateStatus(status) {
        lastStatus = status;

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
            url.searchParams.set('spectator', 'true');
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
            pollSetupStatus(true);
        }
    });

    window.addEventListener('beforeunload', () => {
        stopPolling();
    });

    initialize();
})();
