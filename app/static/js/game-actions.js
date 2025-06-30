/**
 * ManaForge Game Actions Module
 * Handles game actions like playing cards, changing phases, etc.
 */

// ===== GAME ACTION FUNCTIONS =====
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
            case 'pass_turn':
                endpoint = `/api/v1/games/${gameId}/pass-phase`;
                break;
            case 'draw_card':
                endpoint = `/api/v1/games/${gameId}/draw-card`;
                break;
            case 'play_card':
                endpoint = `/api/v1/games/${gameId}/play-card`;
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
            case 'move_card':
                endpoint = `/api/v1/games/${gameId}/move-card`;
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
                GameUI.showNotification(`Action performed: ${actionType}`, 'success');
            } else {
                GameUI.showNotification(`Action failed: ${result.error}`, 'error');
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('HTTP action error:', error);
        GameUI.showNotification(`Error: ${error.message}`, 'error');
    }
}

function playCardFromHand(cardId, handIndex) {
    performGameAction('play_card', { 
        card_id: cardId,
        hand_index: handIndex 
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

function findCardElement(cardId, uniqueCardId) {
    let cardElement;
    if (uniqueCardId) {
        cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
    }

    if (!cardElement) {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        let playerPrefix = 'unknown';
        if (currentSelectedPlayer === 'player1') playerPrefix = 'p0';
        else if (currentSelectedPlayer === 'player2') playerPrefix = 'p1';

        const candidateElements = document.querySelectorAll(`[data-card-id="${cardId}"]`);
        for (const element of candidateElements) {
            const elementUniqueId = element.getAttribute('data-card-unique-id');
            if (elementUniqueId && elementUniqueId.startsWith(playerPrefix)) {
                cardElement = element;
                break;
            }
        }

        if (!cardElement && candidateElements.length > 0) {
            cardElement = candidateElements[0];
        }
    }
    return cardElement;
}

function tapCard(cardId, uniqueCardId) {
    const cardElement = findCardElement(cardId, uniqueCardId);

    if (cardElement) {
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const newTappedState = !isTapped;
        const cardName = cardElement.getAttribute('data-card-name') || cardId;

        console.log(`🃏 Card ${cardName}: ${isTapped ? 'tapped' : 'untapped'} -> ${newTappedState ? 'tapped' : 'untapped'}`);

        cardElement.setAttribute('data-card-tapped', newTappedState.toString());
        cardElement.classList.toggle('tapped', newTappedState);
        cardElement.title = `${cardName}${newTappedState ? ' (Tapped)' : ''}`;

        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        const tapData = {
            card_id: cardId,
            tapped: newTappedState,
            unique_id: uniqueCardId || `${currentSelectedPlayer}-${cardId}`
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

function sendToGraveyard(cardId, sourceZone, uniqueCardId = null) {
    moveCard(cardId, sourceZone, 'graveyard', uniqueCardId);
}

function sendToExile(cardId, sourceZone, uniqueCardId = null) {
    moveCard(cardId, sourceZone, 'exile', uniqueCardId);
}

function sendToHand(cardId, sourceZone, uniqueCardId = null) {
    moveCard(cardId, sourceZone, 'hand', uniqueCardId);
}

function updateCardTappedState(cardId, tapped, uniqueCardId = null) {
    const cardElement = findCardElement(cardId, uniqueCardId);

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

// Export actions module functionality
window.GameActions = {
    performGameAction,
    performHttpGameAction,
    playCardFromHand,
    changePlayer,
    tapCard,
    untapAll,
    sendToGraveyard,
    sendToExile,
    sendToHand,
    updateCardTappedState,
    resolveStackSpell,
    counterStackSpell,
    copyStackSpell,
    drawCard,
    modifyLife,
    moveCard
};

/**
 * Déplacement générique d'une carte entre zones via drag and drop.
 * Utilise les API existantes selon la zone cible.
 */
function moveCard(cardId, sourceZone, targetZone, uniqueCardId = null) {
    performGameAction('move_card', {
        card_id: cardId,
        source_zone: sourceZone,
        target_zone: targetZone,
        unique_id: uniqueCardId
    });

    // Optimistic UI update
    if (uniqueCardId) {
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            cardElement.style.opacity = '0.5';
            cardElement.style.pointerEvents = 'none';
        }
    }

    GameUI.showNotification(`Card moved to ${targetZone}`, 'info');
}
