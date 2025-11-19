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
                
                setTimeout(() => {
                    if (this.isPageVisible) {
                        this.initWebSocket();
                    }
                }, 3000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error, 'readyState:', this.websocket?.readyState);
            };
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
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
                const actionResult = message.action_result;
                const isPreviewUpdate = Boolean(
                    actionResult &&
                    (actionResult.action === 'preview_attackers' || actionResult.action === 'preview_blockers')
                );
                
                if (JSON.stringify(newGameState) !== JSON.stringify(currentGameState)) {
                    const oldGameState = currentGameState;
                    GameCore.setGameState(newGameState);
                    let handledPreview = false;
                    if (isPreviewUpdate && window.GameCombat && newGameState?.combat_state) {
                        const combatState = newGameState.combat_state;
                        if (actionResult.action === 'preview_attackers') {
                            const pendingAttackers = Array.isArray(combatState.pending_attackers)
                                ? combatState.pending_attackers
                                : [];
                            window.GameCombat.applyPendingAttackerVisuals(pendingAttackers);
                            handledPreview = true;
                        } else if (actionResult.action === 'preview_blockers') {
                            const pendingBlockers =
                                combatState.pending_blockers && typeof combatState.pending_blockers === 'object'
                                    ? combatState.pending_blockers
                                    : {};
                            window.GameCombat.applyPendingBlockerVisuals(pendingBlockers);
                            handledPreview = true;
                        }
                    }

                    if (!handledPreview) {
                        this._refreshGameUI(oldGameState);
                    }

                    const oldPhase = oldGameState?.phase;
                    const newPhase = newGameState?.phase;
                    if (
                        oldPhase !== newPhase &&
                        window.GameCombat &&
                        typeof window.GameCombat.onPhaseChange === 'function'
                    ) {
                        setTimeout(() => {
                            window.GameCombat.onPhaseChange(newPhase);
                        }, 50);
                    }
                    
                    // Check for combat changes
                    if (
                        window.GameCombat &&
                        ['attack', 'block', 'damage'].includes(newGameState.phase)
                    ) {
                        this._handleCombatStateUpdate(oldGameState, newGameState, message.action_result);
                    }
                    
                    // Check for pending actions like scry or surveil
                    if (newGameState.pending_action && newGameState.pending_action.player_id === GameCore.getSelectedPlayer()) {
                        const pending = newGameState.pending_action;
                        const player = newGameState.players.find(p => p.id === pending.player_id);
                        if (player && player.temporary_zone && player.temporary_zone.length > 0) {
                            DecisionModal.show(pending.type, player.temporary_zone);
                        }
                    }
                    
                    if (actionResult && actionResult.action === 'tap_card') {
                        const result = actionResult;
                    }
                }

                if (actionResult) {
                    WebSocketManager._recordActionResult(actionResult);
                }

                if (
                    newGameState &&
                    Array.isArray(newGameState.action_history) &&
                    typeof UIActionHistory !== 'undefined' &&
                    typeof UIActionHistory.mergeStateEntries === 'function'
                ) {
                    UIActionHistory.mergeStateEntries(newGameState.action_history);
                }
                if (
                    newGameState &&
                    Array.isArray(newGameState.chat_log) &&
                    typeof UIBattleChat !== 'undefined' &&
                    typeof UIBattleChat.loadChatLog === 'function'
                ) {
                    UIBattleChat.loadChatLog(newGameState.chat_log);
                }
                break;
                
            case 'game_action_start':
                break;
                
            case 'game_action_failed':
                console.error('WebSocket action failed', message);
                
                WebSocketManager._recordActionFailure(message.action, message.error, message.player);
                break;
                
            case 'action_error':
                console.error('WebSocket reported action error', message);
                
                WebSocketManager._recordActionFailure(message.action, message.message, message.player);
                break;
                
            case 'chat': {
                const selectedPlayer = GameCore.getSelectedPlayer();
                const resolveName =
                    typeof GameCore.getPlayerDisplayName === 'function'
                        ? (value) => GameCore.getPlayerDisplayName(value)
                        : (value) => value;
                const senderName = resolveName(message.player) || message.player || 'Unknown';
                let localName = resolveName(selectedPlayer);

                if (!localName) {
                    if (selectedPlayer === 'spectator') {
                        localName = 'Spectator';
                    } else if (
                        window.GameChat &&
                        typeof window.GameChat._formatSeatFallback === 'function'
                    ) {
                        localName = window.GameChat._formatSeatFallback(selectedPlayer);
                    } else {
                        localName = selectedPlayer || 'Unknown';
                    }
                }

                if (senderName !== localName) {
                    if (
                        typeof UIBattleChat !== 'undefined' &&
                        UIBattleChat &&
                        typeof UIBattleChat.addMessage === 'function'
                    ) {
                        UIBattleChat.addMessage(senderName, message.message, {
                            timestamp: message.timestamp,
                            origin: 'remote'
                        });
                    }
                }
                break;
            }
                
            case 'player_status':
                const action = message.action === 'joined' ? 'joined' : 'left';
                console.info(`${message.player} ${action} (${message.connected_players} connected)`);
                break;
                
            case 'connection_established':
                console.info(`Connected to game as ${message.player_id} (${message.connected_players} players online)`);
                break;
                
            case 'state_sync':
                console.info(`State sync requested by ${message.requested_by}`);
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
                break;
                
            case 'error':
                console.error('WebSocket server error message received', message);
                
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
        if (
            typeof UIBattleChat !== 'undefined' &&
            UIBattleChat &&
            typeof UIBattleChat.addMessage === 'function'
        ) {
            UIBattleChat.addMessage(player, message, { origin: 'legacy' });
        }
    }

    // ===== PRIVATE HELPER METHODS =====
    
    /**
     * Refresh game UI components
     */
    static _refreshGameUI(previousGameState = null) {
        UIRenderersTemplates.renderGameArena();
        
        // Update zone counts and previews
        UIZonesManager.updateZoneCounts();
        UIZonesManager.refreshOpenZonePopups(GameCore.getGameState());
        if (typeof UIPlayerCounters !== 'undefined' && UIPlayerCounters) {
            UIPlayerCounters.refreshModal();
        }
        if (typeof UIZonesManager !== 'undefined' && UIZonesManager) {
            UIZonesManager.hydrateSvelteZones();
        }
        
        // Redraw combat arrows if in a combat window
        const gameState = GameCore.getGameState();
        if (
            gameState &&
            ['attack', 'block', 'damage'].includes(gameState.phase) &&
            window.GameCombat
        ) {
            setTimeout(() => {
                this._redrawCombatArrows(gameState);
            }, 100);
        }
    }
    
    /**
     * Redraw blocking arrows for combat
     */
    static _redrawCombatArrows(gameState) {
        if (!gameState || !gameState.players || !window.GameCombat) return;
        
        // Clear existing arrows
        if (typeof window.GameCombat.clearArrows === 'function') {
            window.GameCombat.clearArrows();
        }
        
        // Redraw arrows for all blocking creatures
        gameState.players.forEach(player => {
            if (player.battlefield) {
                player.battlefield.forEach(card => {
                    if (card.blocking && typeof window.GameCombat.drawBlockingArrow === 'function') {
                        window.GameCombat.drawBlockingArrow(card.unique_id, card.blocking);
                    }
                });
            }
        });
    }

    static _recordActionResult(actionResult) {
        if (typeof UIActionHistory === 'undefined' || !actionResult) {
            return;
        }
        UIActionHistory.addFromActionResult(actionResult, { source: 'websocket' });
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

    /**
     * Handle combat state updates to show animations
     */
    static _handleCombatStateUpdate(oldGameState, newGameState, actionResult) {
        if (!oldGameState || !newGameState || !window.GameCombat) return;

        const oldCombatState = oldGameState.combat_state || {};
        const newCombatState = newGameState.combat_state || {};
        const stepChanged = newCombatState.step !== oldCombatState.step;
        const attackersUpdated = newCombatState.attackers_declared && !oldCombatState.attackers_declared;
        const blockersUpdated = newCombatState.blockers_declared && !oldCombatState.blockers_declared;
        const currentPlayer = GameCore.getSelectedPlayer();

        if (window.GameCombat) {
            if (Array.isArray(newCombatState.pending_attackers)) {
                if (!newCombatState.expected_player || newCombatState.expected_player === currentPlayer) {
                    window.GameCombat.attackers = new Set(newCombatState.pending_attackers);
                }
            }

            if (newCombatState && typeof newCombatState.pending_blockers === 'object' && newCombatState.pending_blockers !== null) {
                if (newCombatState.expected_player === currentPlayer || Object.keys(newCombatState.pending_blockers).length === 0) {
                    window.GameCombat.blockers = new Map(Object.entries(newCombatState.pending_blockers));
                }
            }
        }

        if (attackersUpdated || blockersUpdated) {
            this._applyCombatAnimations(newGameState);
        }

        if (stepChanged) {
            if (newCombatState.step === 'declare_attackers') {
                if (!newCombatState.expected_player || newCombatState.expected_player === currentPlayer) {
                    setTimeout(() => {
                        if (window.GameCombat && typeof window.GameCombat.startAttackStep === 'function') {
                            window.GameCombat.startAttackStep();
                        }
                    }, 150);
                }
            } else if (newCombatState.step === 'declare_blockers') {
                if (newCombatState.expected_player === currentPlayer) {
                    setTimeout(() => {
                        if (window.GameCombat && typeof window.GameCombat.startDefenseStep === 'function') {
                            window.GameCombat.startDefenseStep();
                        }
                    }, 150);
                }
            } else if (newCombatState.step === 'end_of_combat' || newCombatState.step === 'none') {
                if (window.GameCombat) {
                    window.GameCombat.combatMode = null;
                    window.GameCombat.clearHighlights();
                    window.GameCombat.clearArrows();
                }
            }
        }

        // Check if this was a declare/preview combat action
        if (actionResult && (actionResult.action === 'preview_attackers' || actionResult.action === 'preview_blockers')) {
            this._applyCombatAnimations(newGameState);
        } else if (actionResult && actionResult.action === 'declare_attackers') {
            this._applyCombatAnimations(newGameState);
            
            // Start blocker declaration for defending player
            const currentPlayer = GameCore.getSelectedPlayer();
            const activePlayerIndex = newGameState.active_player || 0;
            const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
            const isDefendingPlayer = currentPlayerIndex !== activePlayerIndex;
            
            if (isDefendingPlayer) {
                setTimeout(() => {
                    if (window.GameCombat && typeof window.GameCombat.startDefenseStep === 'function') {
                        window.GameCombat.startDefenseStep();
                    }
                }, 200);
            }
        } else if (actionResult && actionResult.action === 'declare_blockers') {
            this._applyCombatAnimations(newGameState);
        } else {
            // Fallback: detect changes in attacking/blocking status
            const oldAttackers = this._getAttackingCreatures(oldGameState);
            const newAttackers = this._getAttackingCreatures(newGameState);
            
            if (newAttackers.length > oldAttackers.length) {
                this._applyCombatAnimations(newGameState);
                
                // Start blocker declaration for defending player
                const currentPlayer = GameCore.getSelectedPlayer();
                const activePlayerIndex = newGameState.active_player || 0;
                const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
                const isDefendingPlayer = currentPlayerIndex !== activePlayerIndex;
                
                if (isDefendingPlayer) {
                    setTimeout(() => {
                        if (window.GameCombat && typeof window.GameCombat.startDefenseStep === 'function') {
                            window.GameCombat.startDefenseStep();
                        }
                    }, 200);
                }
            }
            
            const oldBlockers = this._getBlockingCreatures(oldGameState);
            const newBlockers = this._getBlockingCreatures(newGameState);
            
            if (newBlockers.length > oldBlockers.length) {
                this._applyCombatAnimations(newGameState);
            }
        }
    }

    /**
     * Get all attacking creatures from game state
     */
    static _getAttackingCreatures(gameState) {
        if (!gameState || !gameState.players) return [];
        const allAttackers = [];
        gameState.players.forEach(player => {
            if (player.battlefield) {
                player.battlefield.forEach(card => {
                    if (card.attacking) {
                        allAttackers.push(card.unique_id);
                    }
                });
            }
        });
        return allAttackers;
    }

    /**
     * Get all blocking creatures from game state
     */
    static _getBlockingCreatures(gameState) {
        if (!gameState || !gameState.players) return [];
        const allBlockers = [];
        gameState.players.forEach(player => {
            if (player.battlefield) {
                player.battlefield.forEach(card => {
                    if (card.blocking) {
                        allBlockers.push(card.unique_id);
                    }
                });
            }
        });
        return allBlockers;
    }

    /**
     * Apply visual animations for combat
     */
    static _applyCombatAnimations(gameState) {
        if (!gameState || !gameState.players) return;

        const combatState = gameState.combat_state || {};
        const pendingAttackers = new Set(Array.isArray(combatState.pending_attackers) ? combatState.pending_attackers : []);
        const pendingBlockers = combatState.pending_blockers || {};
        const blockingPairs = new Map();

        const getTranslate = (element) => (
            element && element.getAttribute('data-is-opponent') === 'true' ? 20 : -20
        );

        // Apply attacker animations
        gameState.players.forEach((player, playerIndex) => {
            if (player.battlefield) {
                player.battlefield.forEach(card => {
                    const cardElement = document.querySelector(`[data-card-unique-id="${card.unique_id}"]`);
                    if (!cardElement) return;

                    // Add attacking animation
                    const isPendingAttacker = pendingAttackers.has(card.unique_id);
                    const isAttacking = Boolean(card.attacking);
                    if (isAttacking || isPendingAttacker) {
                        cardElement.classList.add('attacking-creature');
                        const translateY = getTranslate(cardElement);
                        if (isAttacking && card.tapped) {
                            cardElement.style.transform = `translateY(${translateY}px) rotate(90deg)`;
                            cardElement.classList.add('combat-tapped');
                        } else {
                            cardElement.style.transform = `translateY(${translateY}px)`;
                            cardElement.classList.remove('combat-tapped');
                        }
                        if (isPendingAttacker && !isAttacking) {
                            cardElement.dataset.pendingAttacker = 'true';
                        } else {
                            delete cardElement.dataset.pendingAttacker;
                        }
                    } else {
                        cardElement.classList.remove('attacking-creature');
                        cardElement.style.transform = '';
                        cardElement.classList.remove('combat-tapped');
                        delete cardElement.dataset.pendingAttacker;
                    }

                    // Add blocking animation
                    const pendingBlockTarget = pendingBlockers[card.unique_id];
                    const isBlocking = Boolean(card.blocking);
                    if (isBlocking || pendingBlockTarget) {
                        cardElement.classList.add('blocking-creature');
                        const attackerTarget = isBlocking ? card.blocking : pendingBlockTarget;
                        if (attackerTarget) {
                            blockingPairs.set(`${card.unique_id}->${attackerTarget}`, {
                                blocker: card.unique_id,
                                attacker: attackerTarget
                            });
                        }
                    } else {
                        cardElement.classList.remove('blocking-creature');
                    }
                });
            }
        });

        if (window.GameCombat) {
            window.GameCombat.clearArrows();
            if (typeof window.GameCombat.drawBlockingArrow === 'function') {
                blockingPairs.forEach(pair => {
                    window.GameCombat.drawBlockingArrow(pair.blocker, pair.attacker);
                });
            }
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
