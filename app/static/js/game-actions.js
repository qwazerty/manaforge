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

function tapCard(cardId, uniqueCardId) {
    // Find the card element using unique ID if provided, otherwise fallback to cardId
    let cardElement;
    if (uniqueCardId) {
        cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
    }
    
    // Fallback logic: try to find the correct card for the current player
    if (!cardElement) {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        let playerPrefix = 'unknown';
        if (currentSelectedPlayer === 'player1') playerPrefix = 'p0';
        else if (currentSelectedPlayer === 'player2') playerPrefix = 'p1';
        
        // Try to find cards that belong to the current player
        const candidateElements = document.querySelectorAll(`[data-card-id="${cardId}"]`);
        for (const element of candidateElements) {
            const elementUniqueId = element.getAttribute('data-card-unique-id');
            if (elementUniqueId && elementUniqueId.startsWith(playerPrefix)) {
                cardElement = element;
                break;
            }
        }
        
        // If still not found, use the first match (original fallback)
        if (!cardElement && candidateElements.length > 0) {
            cardElement = candidateElements[0];
        }
    }
    
    if (cardElement) {
        // Get current state
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const newTappedState = !isTapped;
        const cardName = cardElement.getAttribute('data-card-name') || cardId;
        
        console.log(`🃏 Card ${cardName}: ${isTapped ? 'tapped' : 'untapped'} -> ${newTappedState ? 'tapped' : 'untapped'}`);
        
        // Update visual state immediately for better UX (optimistic update)
        cardElement.setAttribute('data-card-tapped', newTappedState.toString());
        cardElement.classList.toggle('tapped', newTappedState);
        cardElement.title = `${cardName}${newTappedState ? ' (Tapped)' : ''}`;
        
        // Send action to server via WebSocket with explicit tapped state
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        const tapData = { 
            card_id: cardId,
            tapped: newTappedState,
            unique_id: uniqueCardId || `${currentSelectedPlayer}-${cardId}`
        };
        
        console.log(`🃏 Sending tap_card action via WebSocket:`, tapData);
        performGameAction('tap_card', tapData);
        
        const actionText = newTappedState ? 'tapped' : 'untapped';
        GameUI.showNotification(`${cardName} ${actionText}`, 'info');
    } else {
        console.warn(`🃏 Card element not found for cardId: ${cardId}, uniqueCardId: ${uniqueCardId}`);
        
        // Fallback if element not found - still send action to server
        const tapData = { 
            card_id: cardId,
            unique_id: uniqueCardId
        };
        
        performGameAction('tap_card', tapData);
        GameUI.showNotification(`Card tapped/untapped`, 'info');
    }
}

function sendToGraveyard(cardId, sourceZone) {
    performGameAction('send_to_graveyard', { 
        card_id: cardId,
        source_zone: sourceZone
    });
    GameUI.showNotification(`Card sent to graveyard`, 'info');
}

function sendToExile(cardId, sourceZone) {
    performGameAction('send_to_exile', { 
        card_id: cardId,
        source_zone: sourceZone
    });
    GameUI.showNotification(`Card exiled`, 'info');
}

function sendToHand(cardId, sourceZone) {
    performGameAction('send_to_hand', { 
        card_id: cardId,
        source_zone: sourceZone
    });
    GameUI.showNotification(`Card returned to hand`, 'info');
}

function updateCardTappedState(cardId, tapped, uniqueCardId = null) {
    // Try to find by unique ID first, then fallback to card ID
    let cardElement;
    if (uniqueCardId) {
        cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
    }
    
    if (!cardElement) {
        // If no unique ID or not found, try to find by card ID but only for the current player's cards
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        let playerPrefix = 'unknown';
        if (currentSelectedPlayer === 'player1') playerPrefix = 'p0';
        else if (currentSelectedPlayer === 'player2') playerPrefix = 'p1';
        
        // Try to find cards that belong to the current player
        const candidateElements = document.querySelectorAll(`[data-card-id="${cardId}"]`);
        for (const element of candidateElements) {
            const elementUniqueId = element.getAttribute('data-card-unique-id');
            if (elementUniqueId && elementUniqueId.startsWith(playerPrefix)) {
                cardElement = element;
                break;
            }
        }
        
        // If still not found, use the first match (fallback)
        if (!cardElement && candidateElements.length > 0) {
            cardElement = candidateElements[0];
        }
    }
    
    if (cardElement) {
        cardElement.setAttribute('data-card-tapped', tapped.toString());
        cardElement.classList.toggle('tapped', tapped);
        
        // Update title
        const cardName = cardElement.getAttribute('data-card-name');
        cardElement.title = `${cardName}${tapped ? ' (Tapped)' : ''}`;
        
    }
}

function resolveStackSpell(cardId, stackIndex) {
    performGameAction('resolve_stack_spell', { 
        card_id: cardId,
        stack_index: parseInt(stackIndex) || 0
    });
    GameUI.showNotification(`Resolving spell`, 'info');
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
    sendToGraveyard,
    sendToExile,
    sendToHand,
    updateCardTappedState,
    resolveStackSpell,
    counterStackSpell,
    copyStackSpell,
    drawCard,
    modifyLife
};
