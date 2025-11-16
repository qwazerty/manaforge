(function () {
    const draftMeta = window.MANAFORGE_DRAFT_META || {};
    const roomId = draftMeta.roomId || null;
    const urlParams = new URLSearchParams(window.location.search);
    const playerId = urlParams.get('player') || draftMeta.playerParam || null;
    let websocket;
    const DECK_MANAGER_IMPORT_KEY = 'manaforge:deck-manager:pending-import';
    let cachedDraftedCards = [];
    let currentRoomMeta = { setName: draftMeta.setName || '', roomName: draftMeta.roomName || '' };
    const playerListElement = document.getElementById('player-list');
    const deckManagerContext = window.MANAFORGE_DECK_CONTEXT || null;
    const deckManagerLink = document.getElementById('draft-open-deck-builder');
    const deckSyncState = {
        latestCards: [],
        ready: false
    };

    if (!roomId) {
        console.warn('Draft room metadata missing; skipping draft room setup.');
        return;
    }

    if (deckManagerLink && deckManagerContext && deckManagerContext.deckId) {
        deckManagerLink.href = `/decks/builder?deckId=${encodeURIComponent(deckManagerContext.deckId)}`;
    }

    window.addEventListener('manaforge:deck-manager-ready', (event) => {
        deckSyncState.ready = true;
        const detail = event && event.detail ? event.detail : {};
        const resolvedDeckId = detail.deckId || (deckManagerContext && deckManagerContext.deckId);
        if (deckManagerLink && resolvedDeckId) {
            deckManagerLink.href = `/decks/builder?deckId=${encodeURIComponent(resolvedDeckId)}`;
        }
        syncDeckBuilderWithDraft(deckSyncState.latestCards);
    });

    function escapeAttr(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function buildCardPreviewAttributes(card) {
        const safeCard = card || {};
        const uniqueId = safeCard.unique_id || safeCard.id || safeCard.card_id || safeCard.collector_number || safeCard.name || '';
        const fallbackId = safeCard.id || safeCard.card_id || safeCard.collector_number || uniqueId;
        const serializedCard = JSON.stringify(safeCard);
        return {
            uniqueId,
            uniqueIdAttr: escapeAttr(uniqueId),
            cardIdAttr: escapeAttr(fallbackId),
            cardNameAttr: escapeAttr(safeCard.name || ''),
            cardImageAttr: escapeAttr(safeCard.image_url || ''),
            cardDataAttr: escapeAttr(serializedCard)
        };
    }

    function initializeWebSocket() {
        if (!playerId) {
            alert("Player ID not found. Returning to lobby.");
            window.location.href = '/draft';
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        websocket = new WebSocket(`${wsProtocol}://${window.location.host}/ws/game/${roomId}?player=${playerId}`);

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'draft_starting') {
                const packContainer = document.getElementById('current-pack');
                packContainer.innerHTML = `<div class="col-span-full text-center text-arena-text-dim p-8">Starting Draft...</div>`;
                const packHeader = document.getElementById('pack-header');
                packHeader.innerText = 'Starting Draft...';

                const addBotButton = document.getElementById('add-bot-button');
                const fillBotsButton = document.getElementById('fill-bots-button');
                const startDraftButton = document.getElementById('start-draft-button');

                addBotButton.disabled = true;
                addBotButton.classList.add('opacity-50', 'cursor-not-allowed');

                fillBotsButton.disabled = true;
                fillBotsButton.classList.add('opacity-50', 'cursor-not-allowed');
                
                startDraftButton.disabled = true;
                startDraftButton.classList.add('opacity-50', 'cursor-not-allowed');

                const loadingIndicator = document.querySelector('.fixed.inset-0');
                if (loadingIndicator) {
                    loadingIndicator.remove();
                }
            } else if (data.type === 'draft_state_update') {
                const room = data.room_state;
                currentRoomMeta = {
                    setName: room.set_name || currentRoomMeta.setName,
                    roomName: room.name || currentRoomMeta.roomName
                };
                const me = room.players.find(p => p.id === playerId);
                const packContainer = document.getElementById('current-pack');

                if (me) {
                    if (me.has_picked_card) {
                        packContainer.innerHTML = `<div class="col-span-full text-center text-arena-text-dim p-8">Waiting for other players to pick...</div>`;
                        packContainer.classList.add('opacity-50', 'pointer-events-none');
                        document.getElementById('confirm-pick-button').disabled = true;
                    } else {
                        packContainer.classList.remove('opacity-50', 'pointer-events-none');
                        if (room.state.toLowerCase() === 'drafting' && me.current_pack.length === 0) {
                             packContainer.innerHTML = `<div class="col-span-full text-center text-arena-text-dim p-8">Waiting for next pack...</div>`;
                        } else {
                            renderPack(me.current_pack);
                        }
                    }
                    renderDraftedCards(me.drafted_cards);
                }
                renderPlayerList(room);

                const packHeader = document.getElementById('pack-header');
                packHeader.innerText = `Current Pack (Pack ${room.current_pack_number}, Pick ${room.current_pick_number})`;

                if (room.state.toLowerCase() === 'drafting') {
                    const loadingIndicator = document.querySelector('.fixed.inset-0');
                    if (loadingIndicator) {
                        loadingIndicator.remove();
                    }
                    const startButton = document.getElementById('start-draft-button');
                    startButton.style.display = 'none';
                    const addBotButton = document.getElementById('add-bot-button');
                    addBotButton.style.display = 'none';
                    const fillBotsButton = document.getElementById('fill-bots-button');
                    fillBotsButton.style.display = 'none';
                    const confirmPickButton = document.getElementById('confirm-pick-button');
                    confirmPickButton.style.display = 'block';
                } else if (room.state.toLowerCase() === 'completed') {
                    // Hide drafting elements and show completion message
                    document.getElementById('current-pack-container').style.display = 'none';
                    document.getElementById('confirm-pick-button').style.display = 'none';
                    document.getElementById('draft-complete-message').classList.remove('hidden');
                    document.getElementById('export-container').classList.remove('hidden');
                }
            }
        };
    }

    let selectedCardId = null;

    function renderPack(pack) {
        const packContainer = document.getElementById('current-pack');
        packContainer.innerHTML = pack.map(card => {
            const attrs = buildCardPreviewAttributes(card);
            return `
            <div id="card-${attrs.uniqueIdAttr}" class="cursor-pointer"
                data-select-id="${attrs.uniqueIdAttr}"
                data-card-id="${attrs.cardIdAttr}"
                data-card-name="${attrs.cardNameAttr}"
                data-card-image="${attrs.cardImageAttr}"
                data-card-data="${attrs.cardDataAttr}"
                onclick="selectCard(this.dataset.selectId)">
                <img src="${attrs.cardImageAttr}" alt="${attrs.cardNameAttr}" class="rounded-lg w-full">
            </div>
        `;
        }).join('');
    }

    function renderDraftedCards(cards) {
        const safeCards = Array.isArray(cards) ? cards : [];
        cachedDraftedCards = safeCards.map((card) => cloneCardData(card)).filter(Boolean);
        deckSyncState.latestCards = cachedDraftedCards.map((card) => cloneCardData(card)).filter(Boolean);
        syncDeckBuilderWithDraft(deckSyncState.latestCards);
    }

    function getPlayerNameElement(targetPlayerId) {
        if (!targetPlayerId) return null;
        const escapedId = window.CSS && window.CSS.escape ? window.CSS.escape(targetPlayerId) : targetPlayerId.replace(/"/g, '\\"');
        return document.querySelector(`[data-player-entry-name="${escapedId}"]`);
    }

    async function submitDraftNameChange(targetPlayerId, desiredName) {
        const trimmed = desiredName.trim();
        if (!trimmed) {
            throw new Error('Name cannot be empty.');
        }
        const response = await fetch(`/api/v1/draft/rooms/${encodeURIComponent(roomId)}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: targetPlayerId, player_name: trimmed })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.detail || 'Unable to update name.');
        }
        return payload?.name || trimmed;
    }

    function finishDraftNameEdit(nameElement, targetPlayerId, originalName, commit = true) {
        const cleanup = () => {
            nameElement.removeAttribute('contenteditable');
            nameElement.classList.remove('ring-2', 'ring-arena-accent/50', 'px-1', 'rounded');
            nameElement.dataset.editing = 'false';
        };

        if (!commit) {
            nameElement.textContent = originalName;
            cleanup();
            return;
        }

        const nextValue = nameElement.textContent.trim();
        if (!nextValue || nextValue === originalName) {
            nameElement.textContent = originalName;
            cleanup();
            return;
        }

        submitDraftNameChange(targetPlayerId, nextValue)
            .then((sanitized) => {
                nameElement.textContent = sanitized || nextValue;
                showDraftStatus('Name updated.', 'success');
            })
            .catch((error) => {
                console.error('Unable to rename player', error);
                nameElement.textContent = originalName;
                showDraftStatus(error.message || 'Unable to update name.', 'error');
            })
            .finally(cleanup);
    }

    function startDraftNameEdit(targetPlayerId) {
        if (!playerId || playerId !== targetPlayerId) return;
        const nameElement = getPlayerNameElement(targetPlayerId);
        if (!nameElement || nameElement.dataset.editing === 'true') return;
        const originalName = nameElement.textContent.trim();
        nameElement.dataset.editing = 'true';
        nameElement.contentEditable = 'true';
        nameElement.spellcheck = false;
        nameElement.classList.add('ring-2', 'ring-arena-accent/50', 'px-1', 'rounded');
        setTimeout(() => selectTextContent(nameElement), 0);

        const handleKeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                nameElement.removeEventListener('keydown', handleKeydown);
                nameElement.removeEventListener('blur', handleBlur);
                finishDraftNameEdit(nameElement, targetPlayerId, originalName, true);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                nameElement.removeEventListener('keydown', handleKeydown);
                nameElement.removeEventListener('blur', handleBlur);
                finishDraftNameEdit(nameElement, targetPlayerId, originalName, false);
            }
        };

        const handleBlur = () => {
            nameElement.removeEventListener('keydown', handleKeydown);
            nameElement.removeEventListener('blur', handleBlur);
            finishDraftNameEdit(nameElement, targetPlayerId, originalName, true);
        };

        nameElement.addEventListener('keydown', handleKeydown);
        nameElement.addEventListener('blur', handleBlur);
    }

    function selectTextContent(element) {
        if (!element) return;
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function renderPlayerList(room) {
        if (!playerListElement) return;
        const players = Array.isArray(room.players) ? room.players : [];
        playerListElement.innerHTML = players.map((p) => {
            const safeId = escapeAttr(p.id || '');
            const safeName = escapeAttr(p.name || '');
            const statusIcon = p.has_picked_card
                ? `<span class="text-green-400" title="Card picked">&#10003;</span>`
                : '';
            const canRename = Boolean(playerId && p.id === playerId && !p.is_bot);
            const renameButton = canRename
                ? `<button type="button" class="text-xs text-arena-muted hover:text-arena-accent transition-colors" title="Rename" data-player-rename="${safeId}">✏️</button>`
                : '';
            const botLabel = p.is_bot ? `<span class="text-xs text-arena-text-dim">(Bot)</span>` : '';
            return `
                <div id="player-${safeId}" class="p-2 bg-arena-surface rounded flex items-center justify-between ${p.id === playerId ? 'font-bold' : ''}">
                    <span class="flex items-center gap-2">
                        <span data-player-entry-name="${safeId}">${safeName}</span>
                        ${botLabel}
                        ${renameButton}
                    </span>
                    ${statusIcon}
                </div>
            `;
        }).join('');
    }

    function selectCard(cardUniqueId) {
        if (selectedCardId) {
            document.getElementById(`card-${selectedCardId}`).classList.remove('ring-2', 'ring-yellow-400');
        }
        selectedCardId = cardUniqueId;
        document.getElementById(`card-${selectedCardId}`).classList.add('ring-2', 'ring-yellow-400');
        document.getElementById('confirm-pick-button').disabled = false;
    }

    function pickCard() {
        if (selectedCardId) {
            websocket.send(JSON.stringify({
                type: 'pick_card',
                card_unique_id: selectedCardId
            }));
            selectedCardId = null;
            document.getElementById('confirm-pick-button').disabled = true;
        }
    }

    function exportDecklist(event) {
        event.stopPropagation();
        if (!websocket) {
            showDraftStatus('Connection not ready. Try again in a moment.', 'error');
            return;
        }

        showDraftStatus('Preparing decklist...', 'info');
        const originalOnMessage = websocket.onmessage;
        websocket.onmessage = async (messageEvent) => {
            const data = JSON.parse(messageEvent.data);
            if (data.type === 'decklist_data') {
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(data.decklist);
                    } else {
                        throw new Error('Clipboard API unavailable');
                    }
                    showDraftStatus('Decklist copied to clipboard.', 'success');
                } catch (error) {
                    console.error('Clipboard copy failed', error);
                    showDraftStatus('Clipboard unavailable. Downloading instead.', 'error');
                    downloadDecklistFallback(data.decklist);
                } finally {
                    websocket.onmessage = originalOnMessage;
                }
            } else {
                originalOnMessage(messageEvent);
            }
        };

        websocket.send(JSON.stringify({ type: 'get_decklist' }));
    }

    function downloadDecklistFallback(decklist) {
        const blob = new Blob([decklist], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drafted-deck.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showDraftStatus(message, variant = 'info') {
        const statusEl = document.getElementById('draft-export-status');
        if (!statusEl) {
            return;
        }
        if (!message) {
            statusEl.textContent = '';
            statusEl.classList.add('hidden');
            return;
        }
        statusEl.textContent = message;
        statusEl.classList.remove('hidden', 'text-red-400', 'text-arena-accent', 'text-arena-text-dim');
        if (variant === 'success') {
            statusEl.classList.add('text-arena-accent');
        } else if (variant === 'error') {
            statusEl.classList.add('text-red-400');
        } else {
            statusEl.classList.add('text-arena-text-dim');
        }
    }

    function cloneCardData(card) {
        if (!card) {
            return null;
        }
        try {
            return JSON.parse(JSON.stringify(card));
        } catch (error) {
            console.warn('Unable to clone card data', error);
            return card;
        }
    }

    function getCardIdentity(card) {
        if (!card) {
            return null;
        }
        return card.id || card.card_id || card.scryfall_id || card.unique_id || (card.set && card.collector_number ? `${card.set}-${card.collector_number}` : card.name) || null;
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
        if (!window.DeckManager || !DeckManager.state || !DeckManager.state.entries) {
            return {};
        }
        const counts = {};
        Object.values(DeckManager.state.entries).forEach((entry) => {
            if (!entry || !entry.card) return;
            const key = getCardIdentity(entry.card);
            if (!key) return;
            counts[key] = (counts[key] || 0) + (entry.quantity || 0);
        });
        return counts;
    }

    function removeDeckManagerCopies(cardKey, quantity) {
        if (!cardKey || !quantity || !window.DeckManager || !DeckManager.state || !DeckManager.state.entries) {
            return;
        }
        let remaining = quantity;
        const entryIds = Object.keys(DeckManager.state.entries);
        for (const entryId of entryIds) {
            if (remaining <= 0) {
                break;
            }
            const entry = DeckManager.state.entries[entryId];
            if (!entry || !entry.card) {
                continue;
            }
            const entryKey = getCardIdentity(entry.card);
            if (entryKey !== cardKey) {
                continue;
            }
            const currentQty = entry.quantity || 0;
            if (currentQty <= 0) {
                continue;
            }
            const nextQty = Math.max(0, currentQty - remaining);
            const removed = currentQty - nextQty;
            DeckManager.updateEntryQuantity(entryId, nextQty);
            remaining -= removed;
        }
    }

    function syncDeckBuilderWithDraft(cards) {
        if (!deckSyncState.ready || !window.DeckManager || !DeckManager.state) {
            return;
        }
        const { counts: targetCounts, samples } = buildDraftCardCounts(Array.isArray(cards) ? cards : []);
        const currentCounts = getDeckManagerCardCounts();
        const handledKeys = new Set();

        Object.entries(targetCounts).forEach(([cardKey, desiredCount]) => {
            handledKeys.add(cardKey);
            const current = currentCounts[cardKey] || 0;
            if (current < desiredCount) {
                const diff = desiredCount - current;
                const sample = samples[cardKey];
                if (sample) {
                    DeckManager.addCard(cloneCardData(sample), { quantity: diff });
                }
            } else if (current > desiredCount) {
                removeDeckManagerCopies(cardKey, current - desiredCount);
            }
        });

        Object.keys(currentCounts).forEach((cardKey) => {
            if (!handledKeys.has(cardKey)) {
                removeDeckManagerCopies(cardKey, currentCounts[cardKey]);
            }
        });
    }

    function importDraftToDeckManager(event) {
        event.stopPropagation();
        const deckIdTarget = deckManagerContext && deckManagerContext.deckId;
        if (deckIdTarget) {
            showDraftStatus('Opening deck builder...', 'info');
            window.location.href = `/decks/builder?deckId=${encodeURIComponent(deckIdTarget)}`;
            return;
        }
        if (!cachedDraftedCards.length) {
            showDraftStatus('Finish drafting before importing.', 'error');
            return;
        }
        try {
            const grouped = new Map();
            cachedDraftedCards.forEach((card) => {
                if (!card) return;
                const key = card.id || card.scryfall_id || card.unique_id || card.name;
                if (!key) return;
                if (!grouped.has(key)) {
                    grouped.set(key, { card, quantity: 0 });
                }
                grouped.get(key).quantity += 1;
            });

            if (!grouped.size) {
                showDraftStatus('No cards available to import.', 'error');
                return;
            }

            const deckPayload = {
                name: `${currentRoomMeta.setName || currentRoomMeta.roomName || 'ManaForge'} Draft Deck`,
                format: 'standard',
                cards: Array.from(grouped.values()),
                commanders: []
            };

            localStorage.setItem(DECK_MANAGER_IMPORT_KEY, JSON.stringify({
                deck: deckPayload,
                message: 'Draft deck imported from draft room.',
                source: 'draft'
            }));

            showDraftStatus('Deck sent to Deck Manager!', 'success');
            window.location.href = '/decks/builder';
        } catch (error) {
            console.error('Unable to import deck into deck manager', error);
            showDraftStatus('Import failed. Please try again.', 'error');
        }
    }

    window.selectCard = selectCard;
    window.exportDecklist = exportDecklist;

    document.getElementById('add-bot-button').addEventListener('click', () => {
        if (websocket) websocket.send(JSON.stringify({ type: 'add_bot' }));
    });
    document.getElementById('fill-bots-button').addEventListener('click', () => {
        if (websocket) websocket.send(JSON.stringify({ type: 'fill_bots' }));
    });
    document.getElementById('confirm-pick-button').addEventListener('click', pickCard);
    document.getElementById('confirm-pick-button').style.display = 'none';
    document.getElementById('start-draft-button').addEventListener('click', () => {
        if (websocket) websocket.send(JSON.stringify({ type: 'start_draft' }));
    });
    if (playerListElement) {
        playerListElement.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-player-rename]');
            if (!trigger) return;
            const targetId = trigger.dataset.playerRename;
            startDraftNameEdit(targetId);
        });
    }

    window.addEventListener('load', initializeWebSocket);
})();
