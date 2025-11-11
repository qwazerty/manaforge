/**
 * ManaForge Game Actions Module
 * Handles game actions like playing cards, changing phases, etc.
 */

/* ===== ACTION HISTORY HELPERS ===== */
function sanitizeActionDetails(data) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    const sanitized = {};
    const refs = {
        uniqueIds: new Set(),
        cardIds: new Set(),
        names: new Set()
    };

    Object.entries(data).forEach(([key, value]) => {
        collectCardRefsFromValue(refs, key, value);

        if (
            key === 'player_id' ||
            value === undefined ||
            value === null ||
            value === ''
        ) {
            return;
        }

        const normalizedKey = String(key).toLowerCase();
        if (normalizedKey.includes('unique') && typeof value === 'string') {
            return;
        }

        if (value && typeof value === 'object') {
            try {
                sanitized[key] = JSON.parse(JSON.stringify(value));
            } catch (_error) {
                sanitized[key] = value;
            }
        } else {
            sanitized[key] = value;
        }
    });

    const cardInfo = resolveCardInfoFromRefs(refs);
    if (cardInfo) {
        sanitized.card = cardInfo;
    } else {
        const fallback =
            firstSetValue(refs.names) || firstSetValue(refs.cardIds);
        if (fallback) {
            sanitized.card_name = formatCardName(fallback);
        }
    }

    return Object.keys(sanitized).length ? sanitized : null;
}

function collectCardRefsFromValue(refs, key, value) {
    if (!refs) {
        return;
    }

    if (value === undefined || value === null) {
        return;
    }

    const normalizedKey = key ? String(key).toLowerCase() : '';

    if (typeof value === 'string' || typeof value === 'number') {
        const textValue = String(value);
        if (normalizedKey.includes('unique')) {
            refs.uniqueIds.add(textValue);
        }
        if (normalizedKey.includes('card')) {
            if (normalizedKey.includes('name')) {
                refs.names.add(textValue);
            } else {
                refs.cardIds.add(textValue);
            }
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => collectCardRefsFromValue(refs, key, item));
        return;
    }

    if (typeof value === 'object') {
        ['unique_id', 'uniqueId', 'card_unique_id', 'cardUniqueId'].forEach((prop) => {
            if (value[prop]) {
                refs.uniqueIds.add(String(value[prop]));
            }
        });
        ['card_id', 'cardId', 'id'].forEach((prop) => {
            if (value[prop]) {
                refs.cardIds.add(String(value[prop]));
            }
        });
        ['name', 'card_name', 'cardName'].forEach((prop) => {
            if (value[prop]) {
                refs.names.add(String(value[prop]));
            }
        });

        Object.entries(value).forEach(([childKey, childValue]) => {
            collectCardRefsFromValue(refs, childKey, childValue);
        });
    }
}

function resolveCardInfoFromRefs(refs) {
    if (!refs) {
        return null;
    }

    const uniqueIds = Array.from(refs.uniqueIds || []);
    const cardIds = Array.from(refs.cardIds || []);
    const names = Array.from(refs.names || []);

    const domInfo = findCardInfoInDom(uniqueIds, cardIds, names);
    if (domInfo) {
        return domInfo;
    }

    const stateInfo = findCardInfoInState(uniqueIds, cardIds, names);
    if (stateInfo) {
        return stateInfo;
    }

    const fallbackId = firstSetValue(refs.cardIds);
    const fallbackUniqueId = firstSetValue(refs.uniqueIds);
    const fallbackName =
        firstSetValue(refs.names) ||
        (fallbackId ? formatCardName(fallbackId) : null);

    if (fallbackId || fallbackName) {
        return {
            id: fallbackId || null,
            card_id: fallbackId || null,
            unique_id: fallbackUniqueId || null,
            name: fallbackName || null,
            image_url: null
        };
    }

    return null;
}

function findCardInfoInDom(uniqueIds, cardIds, names) {
    if (typeof document === 'undefined') {
        return null;
    }

    const hydrate = (element) => {
        if (!element) {
            return null;
        }
        const info = getCardInfoFromElement(element);
        if (info && !info.name) {
            const fallback =
                info.card_id ||
                info.id ||
                (names.length ? names[0] : null);
            if (fallback) {
                info.name = formatCardName(fallback);
            }
        }
        return info;
    };

    for (const uniqueId of uniqueIds) {
        const element = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
        const info = hydrate(element);
        if (info) {
            return info;
        }
    }

    for (const cardId of cardIds) {
        const element = document.querySelector(`[data-card-id="${cardId}"]`);
        const info = hydrate(element);
        if (info) {
            return info;
        }
    }

    for (const candidateName of names) {
        const normalized = formatCardName(candidateName);
        const element = Array.from(
            document.querySelectorAll('[data-card-name]')
        ).find(
            (el) => formatCardName(el.getAttribute('data-card-name')) === normalized
        );
        const info = hydrate(element);
        if (info) {
            return info;
        }
    }

    return null;
}

function getCardInfoFromElement(element) {
    if (!element) {
        return null;
    }
    return {
        id: element.getAttribute('data-card-id') || null,
        card_id: element.getAttribute('data-card-id') || null,
        unique_id: element.getAttribute('data-card-unique-id') || null,
        name: element.getAttribute('data-card-name') || null,
        image_url: element.getAttribute('data-card-image') || null
    };
}

function findCardInfoInState(uniqueIds, cardIds, names) {
    if (
        typeof GameCore === 'undefined' ||
        typeof GameCore.getGameState !== 'function'
    ) {
        return null;
    }

    const state = GameCore.getGameState();
    if (!state) {
        return null;
    }

    const uniqueIdSet = new Set(uniqueIds);
    const cardIdSet = new Set(cardIds);
    const normalizedNames = names.map((name) => formatCardName(name));

    const matchesCard = (card) => {
        if (!card) {
            return null;
        }
        if (card.unique_id && uniqueIdSet.has(card.unique_id)) {
            return card;
        }
        const candidateId = card.id || card.card_id;
        if (candidateId && cardIdSet.has(candidateId)) {
            return card;
        }
        if (
            card.name &&
            normalizedNames.includes(formatCardName(card.name))
        ) {
            return card;
        }
        return null;
    };

    if (Array.isArray(state.stack)) {
        for (const spell of state.stack) {
            const match = matchesCard(spell);
            if (match) {
                return createCardInfoFromCard(match);
            }
        }
    }

    if (Array.isArray(state.players)) {
        const zones = [
            'hand',
            'battlefield',
            'graveyard',
            'exile',
            'temporary_zone',
            'library'
        ];
        for (const player of state.players) {
            for (const zoneName of zones) {
                const zone = player[zoneName];
                if (!Array.isArray(zone)) {
                    continue;
                }
                for (const card of zone) {
                    const match = matchesCard(card);
                    if (match) {
                        return createCardInfoFromCard(match);
                    }
                }
            }
        }
    }

    return null;
}

function createCardInfoFromCard(card) {
    if (!card) {
        return null;
    }

    const info = {
        id: card.id || card.card_id || null,
        card_id: card.id || card.card_id || null,
        unique_id: card.unique_id || null,
        name: card.name || null,
        image_url: null
    };

    if (
        typeof GameCards !== 'undefined' &&
        typeof GameCards.getSafeImageUrl === 'function'
    ) {
        info.image_url = GameCards.getSafeImageUrl(card);
    } else if (card.image_url) {
        info.image_url = card.image_url;
    } else if (
        Array.isArray(card.card_faces) &&
        card.card_faces.length > 0
    ) {
        const face = card.card_faces[card.current_face || 0] || card.card_faces[0];
        if (face && face.image_url) {
            info.image_url = face.image_url;
        }
        if (!info.name && face && face.name) {
            info.name = face.name;
        }
    }

    if (!info.name) {
        const fallback = info.card_id || card.unique_id || card.id;
        if (fallback) {
            info.name = formatCardName(fallback);
        }
    }

    return info;
}

function firstSetValue(set) {
    if (!set || typeof set.values !== 'function') {
        return null;
    }
    const iterator = set.values();
    const result = iterator.next();
    return result && result.value ? result.value : null;
}

function formatCardName(value) {
    if (!value) {
        return '';
    }
    const text = String(value).replace(/[_-]+/g, ' ').trim();
    if (!text) {
        return '';
    }
    return text
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function recordActionHistory(actionType, success, data = null, message = null, playerOverride = null) {
    if (typeof UIActionHistory === 'undefined') {
        return;
    }

    const player = playerOverride || GameCore.getSelectedPlayer();
    let details = sanitizeActionDetails(data);

    if (message) {
        details = details || {};
        details.message = message;
    }

    UIActionHistory.addEntry({
        action: actionType,
        player,
        success,
        details
    });
}

function recordActionFailure(actionType, message, data = null, playerOverride = null) {
    if (typeof UIActionHistory === 'undefined') {
        return;
    }

    const player = playerOverride || GameCore.getSelectedPlayer();
    let details = sanitizeActionDetails(data);

    if (message) {
        details = details || {};
        details.error = message;
    }

    if (!details || (Object.keys(details).length === 1 && details.error)) {
        UIActionHistory.addFailure(actionType, message || 'Action failed', player);
        return;
    }

    UIActionHistory.addEntry({
        action: actionType,
        player,
        success: false,
        details
    });
}

/* ===== GAME ACTION FUNCTIONS ===== */
function performGameAction(actionType, actionData = {}) {
   const currentSelectedPlayer = GameCore.getSelectedPlayer();
    if (currentSelectedPlayer === 'spectator') {
        GameUI.showNotification('Spectators cannot perform actions', 'error');
        return;
    }
    
    const websocket = window.websocket;
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        GameSocket.sendGameAction(actionType, actionData);
    } else {
        performHttpGameAction(actionType, actionData);
    }
}

async function performHttpGameAction(actionType, actionData = {}) {
    const gameId = GameCore.getGameId();
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
    
    try {
        let endpoint;
        let requestData = { player_id: currentSelectedPlayer, ...actionData };
        
        switch (actionType) {
            case 'pass_phase':
                endpoint = `/api/v1/games/${gameId}/pass-phase`;
                break;
            case 'draw_card':
                endpoint = `/api/v1/games/${gameId}/draw-card`;
                break;
            case 'play_card':
                endpoint = `/api/v1/games/${gameId}/play-card`;
                break;
            case 'resolve_stack':
                endpoint = `/api/v1/games/${gameId}/resolve-stack`;
                delete requestData.player_id;
                break;
            case 'resolve_all_stack':
                endpoint = `/api/v1/games/${gameId}/action`;
                requestData.action_type = 'resolve_all_stack';
                break;
            case 'tap_card':
                endpoint = `/api/v1/games/${gameId}/tap-card`;
                break;
            case 'modify_life':
                endpoint = `/api/v1/games/${gameId}/modify-life`;
                break;
            case 'send_to_graveyard':
                endpoint = `/api/v1/games/${gameId}/send-to-graveyard`;
                break;
            case 'send_to_exile':
                endpoint = `/api/v1/games/${gameId}/send-to-exile`;
                break;
            case 'send_to_hand':
                endpoint = `/api/v1/games/${gameId}/send-to-hand`;
                break;
            case 'shuffle_library':
                endpoint = `/api/v1/games/${gameId}/shuffle-library`;
                break;
            case 'untap_all':
                endpoint = `/api/v1/games/${gameId}/untap-all`;
                break;
            case 'duplicate_card':
                endpoint = `/api/v1/games/${gameId}/action`;
                requestData = {
                    action_type: 'duplicate_card',
                    player_id: currentSelectedPlayer,
                    ...actionData
                };
                break;
            case 'move_card':
                endpoint = `/api/v1/games/${gameId}/move-card`;
                break;
            case 'play_card_from_library':
                endpoint = `/api/v1/games/${gameId}/play-card-from-library`;
                break;
            case 'target_card':
                endpoint = `/api/v1/games/${gameId}/target-card`;
                break;
            case 'change_phase':
                endpoint = `/api/v1/games/${gameId}/actions`;
                requestData = {
                    action_type: 'change_phase',
                    player_id: currentSelectedPlayer,
                    ...actionData
                };
                break;
            default:
                throw new Error(`Unknown action type: ${actionType}`);
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                recordActionHistory(actionType, true, actionData, null, currentSelectedPlayer);
            } else {
                const errorMessage = result.error || 'Action failed';
                GameUI.showNotification(`Action failed: ${errorMessage}`, 'error');
                recordActionFailure(actionType, errorMessage, actionData, currentSelectedPlayer);
            }
        } else {
            const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            GameUI.showNotification(`Error: ${errorMessage}`, 'error');
            recordActionFailure(actionType, errorMessage, actionData, currentSelectedPlayer);
        }
        
    } catch (error) {
        console.error('HTTP action error:', error);
        GameUI.showNotification(`Error: ${error.message}`, 'error');
        recordActionFailure(actionType, error.message, actionData, currentSelectedPlayer);
    }
}

function playCardFromHand(cardId, uniqueId) {
    // Close hover preview when playing a card
    if (typeof GameCards !== 'undefined' && GameCards._closeActiveCardPreview) {
        GameCards._closeActiveCardPreview();
    }
    
    performGameAction('play_card', { 
        card_id: cardId,
        unique_id: uniqueId 
    });

    // Find card name for better user feedback
    let cardName = cardId; // fallback to cardId if name not found
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    if (cardElement) {
        cardName = cardElement.getAttribute('data-card-name') || cardId;
    }

    GameUI.showNotification(`Card played: ${cardName}`, 'info');
}

function changePlayer(playerType) {
    GameCore.setSelectedPlayer(playerType);
    GameUtils.setPlayerInUrl(playerType);

    if (window.gameData && playerType !== 'spectator') {
        window.gameData.playerId = playerType;
    }

    GameUI.updateRoleDisplay();
    GameUI.generateGameBoard();
    GameUI.generateActionPanel();
    
    // Reconnect WebSocket with new player type
    const websocket = window.websocket;
    if (websocket) {
        websocket.close();
    }
    
    GameSocket.initWebSocket();
    GameUI.showNotification(`Switched to ${playerType === 'spectator' ? 'spectator' : 'player ' + playerType.slice(-1)}`, 'info');
}

function clearTappedState(uniqueCardId) {
    if (!uniqueCardId) {
        return;
    }
    const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
    if (!cardElement) {
        return;
    }
    cardElement.classList.remove('tapped');
    cardElement.setAttribute('data-card-tapped', 'false');
}

function clearTargetedState(uniqueCardId) {
    if (!uniqueCardId) {
        return;
    }
    const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
    if (!cardElement) {
        return;
    }
    cardElement.classList.remove('targeted');
    cardElement.setAttribute('data-card-targeted', 'false');
}

function changePhase(phaseId) {
    if (!phaseId) return;
    performGameAction('change_phase', { phase: phaseId });
    
    const phaseName = (typeof UIConfig !== 'undefined' && UIConfig.getPhaseDisplayName)
        ? UIConfig.getPhaseDisplayName(phaseId)
        : phaseId;
    GameUI.showNotification(`Phase set to ${phaseName}`, 'info');
}

function tapCard(cardId, uniqueCardId) {
    // Close hover preview when tapping a card
    if (typeof GameCards !== 'undefined' && GameCards._closeActiveCardPreview) {
        GameCards._closeActiveCardPreview();
    }
    
    const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);

    if (cardElement) {
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const newTappedState = !isTapped;
        const cardName = cardElement.getAttribute('data-card-name') || cardId;

        console.log(`🃏 Card ${cardName}: ${isTapped ? 'tapped' : 'untapped'} -> ${newTappedState ? 'tapped' : 'untapped'}`);

        cardElement.setAttribute('data-card-tapped', newTappedState.toString());
        cardElement.classList.toggle('tapped', newTappedState);
        cardElement.title = `${cardName}${newTappedState ? ' (Tapped)' : ''}`;

        const tapData = {
            card_id: cardId,
            tapped: newTappedState,
            unique_id: uniqueCardId
        };

        performGameAction('tap_card', tapData);
        const actionText = newTappedState ? 'tapped' : 'untapped';
        GameUI.showNotification(`${cardName} ${actionText}`, 'info');
    } else {
        console.warn(`🃏 Card element not found for cardId: ${cardId}, uniqueCardId: ${uniqueCardId}`);
        performGameAction('tap_card', { card_id: cardId, unique_id: uniqueCardId });
        GameUI.showNotification(`Card tapped/untapped`, 'info');
    }
}

function sendToGraveyard(cardId, sourceZone, uniqueCardId = null, callback = null) {
    // Close hover preview when moving a card
    if (typeof GameCards !== 'undefined' && GameCards._closeActiveCardPreview) {
        GameCards._closeActiveCardPreview();
    }
    
    if (uniqueCardId) {
        clearTappedState(uniqueCardId);
        clearTargetedState(uniqueCardId);
    }
    moveCard(cardId, sourceZone, 'graveyard', uniqueCardId, null, callback);
}

function sendToExile(cardId, sourceZone, uniqueCardId = null, callback = null) {
    // Close hover preview when moving a card
    if (typeof GameCards !== 'undefined' && GameCards._closeActiveCardPreview) {
        GameCards._closeActiveCardPreview();
    }
    
    if (uniqueCardId) {
        clearTappedState(uniqueCardId);
        clearTargetedState(uniqueCardId);
    }
    moveCard(cardId, sourceZone, 'exile', uniqueCardId, null, callback);
}

function showInRevealZone(cardId, sourceZone, uniqueCardId = null, callback = null) {
    // Close hover preview when moving a card
    if (typeof GameCards !== 'undefined' && GameCards._closeActiveCardPreview) {
        GameCards._closeActiveCardPreview();
    }
    
    if (uniqueCardId) {
        clearTappedState(uniqueCardId);
        clearTargetedState(uniqueCardId);
    }
    moveCard(cardId, sourceZone, 'reveal', uniqueCardId, null, callback);
}

function sendToHand(cardId, sourceZone, uniqueCardId = null, callback = null) {
    moveCard(cardId, sourceZone, 'hand', uniqueCardId, null, callback);
}

function moveAllHandToReveal() {
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
    if (currentSelectedPlayer === 'spectator') {
        GameUI.showNotification('Spectators cannot perform actions', 'error');
        return;
    }

    const gameState = GameCore.getGameState();
    if (!gameState || !gameState.players) {
        GameUI.showNotification('Unable to access game state', 'error');
        return;
    }

    // Find the current player's hand
    const playerIndex = currentSelectedPlayer === 'player2' ? 1 : 0;
    const player = gameState.players[playerIndex];
    const hand = Array.isArray(player?.hand) ? player.hand : [];

    if (hand.length === 0) {
        GameUI.showNotification('Your hand is empty', 'info');
        return;
    }

    // Move all cards from hand to reveal
    let movedCount = 0;
    hand.forEach(card => {
        if (card.unique_id) {
            moveCard(card.id || card.card_id, 'hand', 'reveal', card.unique_id);
            movedCount++;
        }
    });

    GameUI.showNotification(`${movedCount} card${movedCount !== 1 ? 's' : ''} revealed from hand`, 'success');
}

function returnAllRevealToHand() {
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
    if (currentSelectedPlayer === 'spectator') {
        GameUI.showNotification('Spectators cannot perform actions', 'error');
        return;
    }

    const gameState = GameCore.getGameState();
    if (!gameState || !gameState.players) {
        GameUI.showNotification('Unable to access game state', 'error');
        return;
    }

    // Find the current player's reveal zone
    const playerIndex = currentSelectedPlayer === 'player2' ? 1 : 0;
    const player = gameState.players[playerIndex];
    const revealZone = Array.isArray(player?.reveal_zone) ? player.reveal_zone : [];

    if (revealZone.length === 0) {
        GameUI.showNotification('No cards in reveal zone', 'info');
        return;
    }

    // Move all cards from reveal to hand
    let movedCount = 0;
    revealZone.forEach(card => {
        if (card.unique_id) {
            moveCard(card.id || card.card_id, 'reveal', 'hand', card.unique_id);
            movedCount++;
        }
    });

    GameUI.showNotification(`${movedCount} card${movedCount !== 1 ? 's' : ''} returned to hand`, 'success');
}

function duplicateCard(cardId, uniqueCardId, sourceZone = 'battlefield') {
    // Close hover preview when duplicating a card
    if (typeof GameCards !== 'undefined' && GameCards._closeActiveCardPreview) {
        GameCards._closeActiveCardPreview();
    }
    
    if (!uniqueCardId) {
        console.warn('Duplicate action requires a unique card identifier');
        return;
    }

    performGameAction('duplicate_card', {
        card_id: cardId,
        unique_id: uniqueCardId,
        source_zone: sourceZone
    });

    const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
    const cardName = cardElement?.getAttribute('data-card-name') || cardId;
    GameUI.showNotification(`${cardName} duplicated`, 'success');
}

function updateCardTappedState(cardId, tapped, uniqueCardId = null) {
    const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);

    if (cardElement) {
        cardElement.setAttribute('data-card-tapped', tapped.toString());
        cardElement.classList.toggle('tapped', tapped);

        const cardName = cardElement.getAttribute('data-card-name');
        cardElement.title = `${cardName}${tapped ? ' (Tapped)' : ''}`;
    }
}

function resolveStackSpell(cardId, stackIndex) {
    performGameAction('resolve_stack_spell', { 
        card_id: cardId,
        stack_index: parseInt(stackIndex) || 0
    });
    GameUI.showNotification(`Resolving spell ${cardId}`, 'info');
}

function counterStackSpell(cardId, stackIndex) {
    performGameAction('counter_stack_spell', { 
        card_id: cardId,
        stack_index: parseInt(stackIndex) || 0
    });
    GameUI.showNotification(`Spell countered`, 'info');
}

function copyStackSpell(cardId, stackIndex) {
    performGameAction('copy_stack_spell', { 
        card_id: cardId,
        stack_index: parseInt(stackIndex) || 0
    });
    GameUI.showNotification(`Spell copied`, 'info');
}

function drawCard() {
    performGameAction('draw_card');
    
    // Visual feedback
    const deckPreview = document.getElementById('deck-top-card');
    if (deckPreview) {
        deckPreview.classList.add('animate-card-draw');
        setTimeout(() => {
            deckPreview.classList.remove('animate-card-draw');
        }, 1000);
    }
    
    GameUI.showNotification(`Card drawn`, 'info');
}

function untapAll() {
    performGameAction('untap_all');
    
    // Update visual state immediately for better UX (optimistic update)
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
    let playerPrefix = 'unknown';
    if (currentSelectedPlayer === 'player1') playerPrefix = 'p0';
    else if (currentSelectedPlayer === 'player2') playerPrefix = 'p1';
    
    // Find all tapped cards belonging to the current player and untap them visually
    const tappedCards = document.querySelectorAll('[data-card-tapped="true"]');
    let untappedCount = 0;
    
    tappedCards.forEach(cardElement => {
        const elementUniqueId = cardElement.getAttribute('data-card-unique-id');
        if (elementUniqueId && elementUniqueId.startsWith(playerPrefix)) {
            cardElement.setAttribute('data-card-tapped', 'false');
            cardElement.classList.remove('tapped');
            
            // Update title
            const cardName = cardElement.getAttribute('data-card-name');
            cardElement.title = cardName || '';
            
            untappedCount++;
        }
    });
    
    GameUI.showNotification(`All permanents untapped (${untappedCount} cards)`, 'success');
}

function modifyLife(playerId, amount) {
    performGameAction('modify_life', { 
        target_player: playerId,
        amount: amount
    });
    
    const actionText = amount > 0 ? `+${amount} life` : `${amount} life`;
    GameUI.showNotification(`${playerId}: ${actionText}`, amount > 0 ? 'success' : 'warning');
}

function adjustCommanderTax(playerId, amount) {
    performGameAction('adjust_commander_tax', {
        player_id: playerId,
        target_player: playerId,
        amount: amount
    });

    const signedAmount = amount > 0 ? `+${amount}` : `${amount}`;
    const tone = amount > 0 ? 'info' : 'warning';
    GameUI.showNotification(`${playerId}: Commander tax ${signedAmount}`, tone);
}

// Export actions module functionality
window.GameActions = {
    performGameAction,
    performHttpGameAction,
    playCardFromHand,
    changePlayer,
    changePhase,
    clearTappedState,
    clearTargetedState,
    tapCard,
    untapAll,
    sendToGraveyard,
    sendToExile,
    showInRevealZone,
    sendToHand,
    updateCardTappedState,
    resolveStackSpell,
    counterStackSpell,
    copyStackSpell,
    drawCard,
    modifyLife,
    adjustCommanderTax,
    moveCard,
    duplicateCard,
    moveAllHandToReveal,
    returnAllRevealToHand
};

/**
 * Déplacement générique d'une carte entre zones via drag and drop.
 * Utilise les API existantes selon la zone cible.
 */
function moveCard(cardId, sourceZone, targetZone, uniqueCardId = null, deckPosition = null, callback = null, positionIndex = null) {
    // Close hover preview when moving a card
    if (typeof GameCards !== 'undefined' && GameCards._closeActiveCardPreview) {
        GameCards._closeActiveCardPreview();
    }
    
    const actionData = {
        card_id: cardId,
        source_zone: sourceZone,
        target_zone: targetZone,
        unique_id: uniqueCardId,
    };

    if (deckPosition) {
        actionData.deck_position = deckPosition;
    }
    if (positionIndex !== null && positionIndex !== undefined) {
        actionData.position_index = positionIndex;
    }

    const normalizedTarget = typeof targetZone === 'string'
        ? targetZone.toLowerCase()
        : '';
    if (
        uniqueCardId &&
        ['graveyard', 'exile', 'library', 'deck', 'reveal', 'commander'].includes(normalizedTarget)
    ) {
        clearTappedState(uniqueCardId);
        clearTargetedState(uniqueCardId);
    }

    performGameAction('move_card', actionData);

    // Optimistic UI update
    if (uniqueCardId) {
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const isSameZoneMove = sourceZone === targetZone && positionIndex !== null && positionIndex !== undefined;
            if (!isSameZoneMove) {
                cardElement.style.opacity = '0.5';
                cardElement.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (cardElement) {
                        cardElement.style.removeProperty('opacity');
                        cardElement.style.removeProperty('pointer-events');
                    }
                }, 800);
            }
        }
    }

    GameUI.showNotification(`Card moved to ${targetZone}`, 'info');

    if (callback) {
        callback();
    }
}
