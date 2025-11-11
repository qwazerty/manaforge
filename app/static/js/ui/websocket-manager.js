/**
 * ManaForge Unified WebSocket Manager Module
 * Combines WebSocket communication and arena core functionality
 * Replaces game-socket.js + arena-core.js (~330 lines → ~200 lines)
 */

class WebSocketManager {
    static websocket = null;
    static gameId = null;
    static isPageVisible = true;

    // ===== MAIN WEBSOCKET FUNCTIONALITY =====
    
    /**
     * Initialize WebSocket connection
     */
    static initWebSocket() {
        const gameId = GameCore.getGameId();
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        
        if (!gameId) {
            console.error('Game ID not set, cannot initialize WebSocket');
            return;
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/game/${gameId}?player=${currentSelectedPlayer}`;
        
        try {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = (event) => {
                console.log('WebSocket connected as', currentSelectedPlayer);
                UINotifications.showAutoRefreshIndicator('🔗 Connected', 'success');
                
                this.websocket.send(JSON.stringify({
                    type: 'player_joined',
                    player: currentSelectedPlayer,
                    timestamp: Date.now()
                }));
                
                this.requestGameState();
            };
            
            this.websocket.onmessage = (event) => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch (parseError) {
                    console.error('WebSocket message parse error:', parseError, 'raw:', event.data);
                    return;
                }
                this.handleWebSocketMessage(message);
            };
            
            this.websocket.onclose = (event) => {
                console.warn('WebSocket disconnected', { code: event.code, reason: event.reason });
                UINotifications.showAutoRefreshIndicator('🔌 Disconnected', 'warning');
                
                setTimeout(() => {
                    if (this.isPageVisible) {
                        console.log('Attempting to reconnect WebSocket...');
                        this.initWebSocket();
                    }
                }, 3000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error, 'readyState:', this.websocket?.readyState);
                UINotifications.showAutoRefreshIndicator('❌ Connection Error', 'error');
            };
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            UINotifications.showAutoRefreshIndicator('❌ WebSocket Init Failed', 'error');
        }
    }

    /**
     * Request current game state
     */
    static requestGameState() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'request_game_state',
                timestamp: Date.now()
            }));
        } else {
            console.warn('Skipping game state request, WebSocket not open');
        }
    }

    /**
     * Send game action through WebSocket
     */
    static sendGameAction(actionType, actionData = {}) {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'game_action',
                action: actionType,
                data: actionData,
                timestamp: Date.now()
            }));
        } else {
            console.error('WebSocket not connected, cannot send game action', {
                actionType,
                actionData,
                readyState: this.websocket ? this.websocket.readyState : 'no-connection'
            });
            UINotifications.showNotification('WebSocket not connected', 'error');
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    static handleWebSocketMessage(message) {
        switch (message.type) {
            case 'game_state_update':
                const newGameState = message.game_state;
                const currentGameState = GameCore.getGameState();
                
                if (JSON.stringify(newGameState) !== JSON.stringify(currentGameState)) {
                    GameCore.setGameState(newGameState);
                    this._refreshGameUI();
                    
                    // Check for pending actions like scry or surveil
                    if (newGameState.pending_action && newGameState.pending_action.player_id === GameCore.getSelectedPlayer()) {
                        const pending = newGameState.pending_action;
                        const player = newGameState.players.find(p => p.id === pending.player_id);
                        if (player && player.temporary_zone && player.temporary_zone.length > 0) {
                            DecisionModal.show(pending.type, player.temporary_zone);
                        }
                    }
                    
                    if (message.action_result && message.action_result.action === 'tap_card') {
                        const result = message.action_result;
                        console.log(`🃏 WebSocket: Tap action completed for ${result.player}`);
                    }
                }

                if (message.action_result) {
                    WebSocketManager._recordActionResult(message.action_result);
                }
                break;
                
            case 'game_action_start':
                break;
                
            case 'game_action_failed':
                console.error('WebSocket action failed', message);
                UINotifications.showNotification(`Action failed: ${message.error}`, 'error');
                
                WebSocketManager._recordActionFailure(message.action, message.error, message.player);
                break;
                
            case 'action_error':
                console.error('WebSocket reported action error', message);
                UINotifications.showNotification(`Error: ${message.message}`, 'error');
                
                WebSocketManager._recordActionFailure(message.action, message.message, message.player);
                break;
                
            case 'chat':
                const messagePlayer = message.player;
                const currentSelectedPlayer = GameCore.getSelectedPlayer();
                const currentPlayerName = currentSelectedPlayer === 'spectator' ? 'Spectator' : 'Player ' + currentSelectedPlayer.slice(-1);
                
                if (messagePlayer !== currentPlayerName) {
                    UINotifications.addChatMessage(message.player, message.message);
                }
                break;
                
            case 'player_status':
                const action = message.action === 'joined' ? 'joined' : 'left';
                UINotifications.showNotification(`${message.player} ${action} (${message.connected_players} connected)`);
                break;
                
            case 'connection_established':
                UINotifications.showNotification(`Connected to game as ${message.player_id} (${message.connected_players} players online)`);
                break;
                
            case 'state_sync':
                UINotifications.showAutoRefreshIndicator(`🔄 Sync by ${message.requested_by}`, 'success');
                break;
                
            case 'ping':
                if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.send(JSON.stringify({
                        type: 'pong',
                        timestamp: message.timestamp
                    }));
                }
                break;
                
            case 'pong':
                console.log('Received pong from server');
                break;
                
            case 'error':
                console.error('WebSocket server error message received', message);
                UINotifications.showNotification(`Server error: ${message.message}`, 'error');
                
                WebSocketManager._recordActionFailure('server_error', message.message);
                break;
                
            default:
                console.warn('Unknown WebSocket message type received:', message);
        }
    }

    // ===== ARENA CORE FUNCTIONALITY =====
    
    /**
     * Connect to game WebSocket (legacy arena-core compatibility)
     */
    static connectWebSocket(id) {
        if (this.websocket) {
            this.websocket.close();
        }
        
        this.gameId = id;
        GameCore.setGameId(id);
        this.initWebSocket();
    }

    /**
     * Send game action (legacy arena-core compatibility)
     */
    static sendArenaGameAction(action, cardId = null, extraData = {}) {
        const message = {
            action: action,
            card_id: cardId,
            player: 'player1', // For POC
            ...extraData
        };
        
        this.sendGameAction(action, message);
        console.log('🎮 Sent action:', message);
    }

    /**
     * Show notification (fallback)
     */
    static showNotification(message, type = 'info') {
        if (typeof UINotifications !== 'undefined') {
            UINotifications.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Show game action notification
     */
    static showGameAction(player, action, card = null) {
        const message = card ? 
            `${player} ${action} ${card.name}` : 
            `${player} ${action}`;
        
        this.showNotification(message, 'info');
    }

    /**
     * Enhanced card interaction with visual feedback
     */
    static playCard(cardId) {
        this.sendArenaGameAction('play_card', cardId);
        
        // Visual feedback
        const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElement) {
            cardElement.style.transform = 'scale(1.05)';
            cardElement.style.boxShadow = '0 0 20px rgba(201, 170, 113, 0.6)';
            
            setTimeout(() => {
                cardElement.style.transform = '';
                cardElement.style.boxShadow = '';
            }, 300);
        }
    }

    /**
     * Add chat message to chat container
     */
    static addChatMessage(player, message) {
        const chatContainer = document.getElementById('chat-messages');
        if (chatContainer) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'mb-2';
            messageDiv.innerHTML = `<strong>${player}:</strong> ${message}`;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    // ===== PRIVATE HELPER METHODS =====
    
    /**
     * Refresh game UI components
     */
    static _refreshGameUI() {
        UIRenderersTemplates.renderLeftArea();
        UIRenderersTemplates.renderGameBoard();
        UIRenderersTemplates.renderActionPanel();
        
        // Update zone counts and previews
        UIZonesManager.updateZoneCounts();
        UIZonesManager.refreshOpenZonePopups(GameCore.getGameState());
    }

    static _recordActionResult(actionResult) {
        if (typeof UIActionHistory === 'undefined' || !actionResult) {
            return;
        }
        UIActionHistory.addFromActionResult(actionResult);
    }

    static _recordActionFailure(action, message, player = null) {
        if (typeof UIActionHistory === 'undefined' || !action) {
            return;
        }
        UIActionHistory.addFailure(action, message, player);
    }

    /**
     * Initialize page visibility tracking
     */
    static _initPageVisibility() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
        });
    }

    /**
     * Initialize navigation styling
     */
    static _initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        if (!navLinks.length) {
            return;
        }

        const normalize = (url) => url.replace(/\/$/, '');
        const currentUrl = normalize(window.location.href);

        navLinks.forEach(link => {
            link.classList.remove('nav-link-active');
            if (normalize(link.href) === currentUrl) {
                link.classList.add('nav-link-active');
            }
        });
    }

    /**
     * Initialize HTMX extensions
     */
    static _initHTMX() {
        // Add loading states
        document.addEventListener('htmx:beforeRequest', (event) => {
            const target = event.detail.target;
            if (target) target.style.opacity = '0.7';
        });

        document.addEventListener('htmx:afterRequest', (event) => {
            const target = event.detail.target;
            if (target) target.style.opacity = '1';
            
            // Handle game updates
            if (event.detail.target && event.detail.target.id === 'game-area') {
                // Game area was refreshed via HTMX
            }
        });
    }

    // ===== INITIALIZATION =====
    
    /**
     * Initialize WebSocket Manager
     */
    static init() {
        this._initPageVisibility();
        
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this._initNavigation();
                this._initHTMX();
            });
        } else {
            this._initNavigation();
            this._initHTMX();
        }
    }
}

// Legacy compatibility exports
window.GameSocket = {
    initWebSocket: () => WebSocketManager.initWebSocket(),
    requestGameState: () => WebSocketManager.requestGameState(),
    sendGameAction: (action, data) => WebSocketManager.sendGameAction(action, data),
    handleWebSocketMessage: (msg) => WebSocketManager.handleWebSocketMessage(msg)
};

// Arena core compatibility
window.connectWebSocket = (id) => WebSocketManager.connectWebSocket(id);
window.sendGameAction = (action, cardId, extraData) => WebSocketManager.sendArenaGameAction(action, cardId, extraData);
window.showNotification = (message, type) => WebSocketManager.showNotification(message, type);
window.showGameAction = (player, action, card) => WebSocketManager.showGameAction(player, action, card);
window.playCard = (cardId) => WebSocketManager.playCard(cardId);
window.addChatMessage = (player, message) => WebSocketManager.addChatMessage(player, message);

// Global WebSocket reference for backward compatibility
Object.defineProperty(window, 'websocket', {
    get: () => WebSocketManager.websocket,
    set: (value) => { WebSocketManager.websocket = value; }
});

// Export main class
window.WebSocketManager = WebSocketManager;

// Auto-initialize
WebSocketManager.init();
