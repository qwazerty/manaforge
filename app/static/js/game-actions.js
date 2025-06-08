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
    performGameAction('tap_card', { 
        card_id: cardId
    });
    GameUI.showNotification(`Card ${cardId} tapped/untapped`, 'info');
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

// Export actions module functionality
window.GameActions = {
    performGameAction,
    performHttpGameAction,
    playCardFromHand,
    changePlayer,
    tapCard,
    sendToGraveyard,
    sendToExile,
    sendToHand
};
