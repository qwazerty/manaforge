/**
 * ManaForge Game Actions Module
 * Handles game actions like playing cards, changing phases, etc.
 */

// ===== GAME ACTION FUNCTIONS =====
function performGameAction(actionType, actionData = {}) {
    console.log(`Performing action: ${actionType}`, actionData);
    
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

function tapCard(cardId) {
    // Find the card element
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    
    if (cardElement) {
        // Toggle tapped state
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const newTappedState = !isTapped;
        
        // Update visual state immediately for better UX
        cardElement.setAttribute('data-card-tapped', newTappedState.toString());
        cardElement.classList.toggle('tapped', newTappedState);
        
        // Update title
        const cardName = cardElement.getAttribute('data-card-name');
        cardElement.title = `${cardName}${newTappedState ? ' (Tapped)' : ''}`;
        
        // Add or remove tapped indicator
        let tappedIndicator = cardElement.querySelector('.card-tapped-indicator');
        if (newTappedState && !tappedIndicator) {
            tappedIndicator = document.createElement('div');
            tappedIndicator.className = 'card-tapped-indicator';
            tappedIndicator.textContent = 'T';
            cardElement.appendChild(tappedIndicator);
        } else if (!newTappedState && tappedIndicator) {
            tappedIndicator.remove();
        }
        
        // Send action to server
        performGameAction('tap_card', { 
            card_id: cardId,
            tapped: newTappedState
        });
        
        const actionText = newTappedState ? 'tapped' : 'untapped';
        GameUI.showNotification(`Card ${actionText}`, 'info');
    } else {
        // Fallback if element not found
        performGameAction('tap_card', { 
            card_id: cardId
        });
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

function updateCardTappedState(cardId, tapped) {
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    
    if (cardElement) {
        cardElement.setAttribute('data-card-tapped', tapped.toString());
        cardElement.classList.toggle('tapped', tapped);
        
        // Update title
        const cardName = cardElement.getAttribute('data-card-name');
        cardElement.title = `${cardName}${tapped ? ' (Tapped)' : ''}`;
        
        // Add or remove tapped indicator
        let tappedIndicator = cardElement.querySelector('.card-tapped-indicator');
        if (tapped && !tappedIndicator) {
            tappedIndicator = document.createElement('div');
            tappedIndicator.className = 'card-tapped-indicator';
            tappedIndicator.textContent = 'T';
            cardElement.appendChild(tappedIndicator);
        } else if (!tapped && tappedIndicator) {
            tappedIndicator.remove();
        }
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
