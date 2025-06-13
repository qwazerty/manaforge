/**
 * ManaForge Game Socket Module
 * Handles WebSocket communication for real-time game updates
 */

// ===== WEBSOCKET FUNCTIONALITY =====
function initWebSocket() {
    const gameId = GameCore.getGameId();
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
    
    if (!gameId) {
        console.error('Game ID not set, cannot initialize WebSocket');
        return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game/${gameId}?player=${currentSelectedPlayer}`;
    
    try {
        window.websocket = new WebSocket(wsUrl);
        const websocket = window.websocket;
        
        websocket.onopen = function(event) {
            console.log('WebSocket connected as', currentSelectedPlayer);
            GameUI.showAutoRefreshIndicator('🔗 Connected', 'success');
            
            websocket.send(JSON.stringify({
                type: 'player_joined',
                player: currentSelectedPlayer,
                timestamp: Date.now()
            }));
            
            requestGameState();
        };
        
        websocket.onmessage = function(event) {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        };
        
        websocket.onclose = function(event) {
            console.log('WebSocket disconnected');
            GameUI.showAutoRefreshIndicator('🔌 Disconnected', 'warning');
            
            setTimeout(() => {
                if (GameCore.isPageVisible) {
                    console.log('Attempting to reconnect WebSocket...');
                    initWebSocket();
                }
            }, 3000);
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            GameUI.showAutoRefreshIndicator('❌ Connection Error', 'error');
        };
        
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        GameUI.showAutoRefreshIndicator('❌ WebSocket Init Failed', 'error');
    }
}

function requestGameState() {
    const websocket = window.websocket;
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'request_game_state',
            timestamp: Date.now()
        }));
    }
}

function sendGameAction(actionType, actionData = {}) {
    const websocket = window.websocket;
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'game_action',
            action: actionType,
            data: actionData,
            timestamp: Date.now()
        }));
    } else {
        GameUI.showNotification('WebSocket not connected', 'error');
    }
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'game_state_update':
            const newGameState = message.game_state;
            const currentGameState = GameCore.getGameState();
            
            if (JSON.stringify(newGameState) !== JSON.stringify(currentGameState)) {
                GameCore.setGameState(newGameState);
                GameUI.generateLeftArea();
                GameUI.generateGameBoard();
                GameUI.generateActionPanel();
                
                // Update zone counts and previews
                ZoneManager.updateZoneCounts();
                ZoneManager.updateZonePreviews();
                
                // If this was a tap/untap action, show feedback
                if (message.action_result && message.action_result.action === 'tap_card') {
                    const result = message.action_result;
                    console.log(`🃏 WebSocket: Tap action completed for ${result.player}`);
                }
            }
            break;
            
        case 'game_action_start':
            break;
            
        case 'game_action_failed':
            GameUI.showNotification(`Action failed: ${message.error}`, 'error');
            break;
            
        case 'action_error':
            GameUI.showNotification(`Error: ${message.message}`, 'error');
            break;
            
        case 'chat':
            // Only add chat messages from other players to avoid duplication
            // (our own messages are added immediately when sending)
            const messagePlayer = message.player;
            const currentSelectedPlayer = GameCore.getSelectedPlayer();
            const currentPlayerName = currentSelectedPlayer === 'spectator' ? 'Spectator' : 'Player ' + currentSelectedPlayer.slice(-1);
            
            if (messagePlayer !== currentPlayerName) {
                GameUI.addChatMessage(message.player, message.message);
            }
            break;
            
        case 'player_status':
            const action = message.action === 'joined' ? 'joined' : 'left';
            GameUI.showNotification(`${message.player} ${action} (${message.connected_players} connected)`);
            break;
            
        case 'connection_established':
            GameUI.showNotification(`Connected to game as ${message.player_id} (${message.connected_players} players online)`);
            break;
            
        case 'state_sync':
            GameUI.showAutoRefreshIndicator(`🔄 Sync by ${message.requested_by}`, 'success');
            break;
            
        case 'ping':
            const websocket = window.websocket;
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({
                    type: 'pong',
                    timestamp: message.timestamp
                }));
            }
            break;
            
        case 'pong':
            console.log('Received pong from server');
            break;
            
        case 'error':
            GameUI.showNotification(`Server error: ${message.message}`, 'error');
            break;
            
        default:
            console.log('Unknown WebSocket message:', message);
    }
}

// Export socket module functionality
window.GameSocket = {
    initWebSocket,
    requestGameState,
    sendGameAction,
    handleWebSocketMessage
};
