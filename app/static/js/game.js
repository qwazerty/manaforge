/**
 * ManaForge Game Interface JavaScript
 * Handles real-time game interactions, WebSocket communication, and UI updates
 */

// ===== GLOBAL VARIABLES =====
let currentSelectedPlayer = 'player1';
let gameState = null; // Will be initialized from template
let autoRefreshInterval = null;
let isPageVisible = true;
let websocket = null;
let gameId = null; // Will be initialized from template

// ===== INITIALIZATION FUNCTION =====
function initializeGame() {
    console.log('ManaForge Game Interface initializing...');
    
    // Initialize from template data
    if (window.gameData) {
        gameState = window.gameData.game;
        gameId = window.gameData.gameId;
    }
    
    // Get player from URL or default to player1
    const playerFromUrl = getPlayerFromUrl();
    currentSelectedPlayer = playerFromUrl;
    
    // Update role display
    updateRoleDisplay();
    
    // Generate dynamic content
    generateGameBoard();
    generateActionPanel();
    
    // Initialize WebSocket connection
    initWebSocket();
    
    // Start auto-refresh as fallback
    startAutoRefresh();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        isPageVisible = !document.hidden;
        if (isPageVisible) {
            // Resume auto-refresh when page becomes visible
            startAutoRefresh();
            // Reconnect WebSocket if needed
            if (!websocket || websocket.readyState === WebSocket.CLOSED) {
                initWebSocket();
            }
            // Immediate refresh when coming back
            refreshGameData();
        } else {
            // Pause auto-refresh when page is hidden
            stopAutoRefresh();
        }
    });
    
    // Keyboard shortcuts for testing (optional)
    document.addEventListener('keydown', function(e) {
        if (e.key === '1') changePlayer('player1');
        if (e.key === '2') changePlayer('player2');
        if (e.key === '3') changePlayer('spectator');
    });
}

// ===== INITIALIZATION (Legacy support) =====
document.addEventListener('DOMContentLoaded', function() {
    // Legacy initialization for inline templates
    if (!window.gameData) {
        console.log('Legacy mode: game data not found in window.gameData');
        return;
    }
    initializeGame();
    
    // Start auto-refresh as fallback
    startAutoRefresh();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        isPageVisible = !document.hidden;
        if (isPageVisible) {
            startAutoRefresh();
            if (!websocket || websocket.readyState === WebSocket.CLOSED) {
                initWebSocket();
            }
            refreshGameData();
        } else {
            stopAutoRefresh();
        }
    });
    
    // Keyboard shortcuts for testing (optional)
    document.addEventListener('keydown', function(e) {
        if (e.key === '1') changePlayer('player1');
        if (e.key === '2') changePlayer('player2');
        if (e.key === '3') changePlayer('spectator');
    });
});

// ===== URL PARAMETER MANAGEMENT =====
function getPlayerFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const player = urlParams.get('player');
    return ['player1', 'player2', 'spectator'].includes(player) ? player : 'player1';
}

function setPlayerInUrl(playerType) {
    const url = new URL(window.location);
    url.searchParams.set('player', playerType);
    window.history.replaceState({}, '', url);
}

// ===== WEBSOCKET FUNCTIONALITY =====
function initWebSocket() {
    if (!gameId) {
        console.error('Game ID not set, cannot initialize WebSocket');
        return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game/${gameId}?player=${currentSelectedPlayer}`;
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function(event) {
            console.log('WebSocket connected as', currentSelectedPlayer);
            showAutoRefreshIndicator('🔗 Connected', 'success');
            
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
            showAutoRefreshIndicator('🔌 Disconnected', 'warning');
            
            setTimeout(() => {
                if (isPageVisible) {
                    console.log('Attempting to reconnect WebSocket...');
                    initWebSocket();
                }
            }, 3000);
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            showAutoRefreshIndicator('❌ Connection Error', 'error');
        };
        
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        showAutoRefreshIndicator('❌ WebSocket Init Failed', 'error');
    }
}

function requestGameState() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'request_game_state',
            timestamp: Date.now()
        }));
    }
}

function sendGameAction(actionType, actionData = {}) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'game_action',
            action: actionType,
            data: actionData,
            timestamp: Date.now()
        }));
    } else {
        showNotification('WebSocket not connected', 'error');
    }
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'game_state_update':
            const newGameState = message.game_state;
            if (JSON.stringify(newGameState) !== JSON.stringify(gameState)) {
                gameState = newGameState;
                generateGameBoard();
                generateActionPanel();
                
                if (message.action_result) {
                    const result = message.action_result;
                    showNotification(`${result.player} performed: ${result.action}`, 'success');
                }
                
                showAutoRefreshIndicator('⚡ Real-time Update', 'success');
            }
            break;
            
        case 'game_action_start':
            showNotification(`${message.player} is performing: ${message.action}...`, 'success');
            break;
            
        case 'game_action_failed':
            showNotification(`Action failed: ${message.error}`, 'error');
            break;
            
        case 'action_error':
            showNotification(`Error: ${message.message}`, 'error');
            break;
            
        case 'chat':
            // Only add chat messages from other players to avoid duplication
            // (our own messages are added immediately when sending)
            const messagePlayer = message.player;
            const currentPlayerName = currentSelectedPlayer === 'spectator' ? 'Spectator' : 'Player ' + currentSelectedPlayer.slice(-1);
            
            if (messagePlayer !== currentPlayerName) {
                addChatMessage(message.player, message.message);
            }
            break;
            
        case 'player_status':
            const action = message.action === 'joined' ? 'joined' : 'left';
            showNotification(`${message.player} ${action} (${message.connected_players} connected)`);
            break;
            
        case 'connection_established':
            showNotification(`Connected to game as ${message.player_id} (${message.connected_players} players online)`);
            break;
            
        case 'state_sync':
            showAutoRefreshIndicator(`🔄 Sync by ${message.requested_by}`, 'success');
            break;
            
        case 'ping':
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
            showNotification(`Server error: ${message.message}`, 'error');
            break;
            
        default:
            console.log('Unknown WebSocket message:', message);
    }
}

// ===== AUTO-REFRESH FUNCTIONALITY =====
async function refreshGameData() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
            type: 'request_game_state',
            timestamp: Date.now()
        }));
        return;
    }
    
    try {
        const response = await fetch(`/api/v1/games/${gameId}/state`);
        if (response.ok) {
            const newGameState = await response.json();
            
            if (JSON.stringify(newGameState) !== JSON.stringify(gameState)) {
                gameState = newGameState;
                generateGameBoard();
                generateActionPanel();
                showAutoRefreshIndicator('🔄 HTTP Update');
            }
        }
    } catch (error) {
        console.error('Auto-refresh error:', error);
    }
}

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(refreshGameData, 5000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ===== UI FUNCTIONS =====
function updateRoleDisplay() {
    const roleDisplay = document.getElementById('current-role-display');
    const roleDescription = document.getElementById('role-description');
    
    if (!roleDisplay || !roleDescription) return;
    
    const roleData = {
        'player1': {
            class: 'bg-green-500/20 border-green-500/50 text-green-400',
            title: '🛡️ Player 1',
            description: 'You control the first player position'
        },
        'player2': {
            class: 'bg-red-500/20 border-red-500/50 text-red-400',
            title: '🎯 Player 2', 
            description: 'You control the second player position'
        },
        'spectator': {
            class: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
            title: '👁️ Spectator',
            description: 'You are watching the battle unfold'
        }
    };
    
    const role = roleData[currentSelectedPlayer] || roleData['player1'];
    roleDisplay.className = `px-4 py-3 rounded-lg border-2 mb-3 ${role.class}`;
    roleDisplay.textContent = role.title;
    roleDescription.textContent = role.description;
}

function generateGameBoard() {
    const gameBoardContainer = document.getElementById('game-board');
    if (!gameBoardContainer || !gameState) {
        console.warn('Game board container or game state not found');
        return;
    }
    
    try {
        const players = gameState.players || [];
        
        // Preload all card images for better performance
        players.forEach(player => {
            if (player.hand) preloadCardImages(player.hand);
            if (player.battlefield) preloadCardImages(player.battlefield);
        });
        
        const currentPhase = gameState.phase || 'untap';
        const currentTurn = gameState.turn || 1;
        const activePlayer = gameState.active_player || 0;
        
        // Détermination de l'index du joueur contrôlé
        let controlledIdx = 0;
        if (currentSelectedPlayer === 'player2') controlledIdx = 1;
        else if (currentSelectedPlayer === 'player1') controlledIdx = 0;
        
        // Opposant
        const opponentIdx = controlledIdx === 0 ? 1 : 0;
        
        gameBoardContainer.innerHTML = `
            <!-- Opponent Area (Player ${opponentIdx + 1}) -->
            <div class="arena-card rounded-xl p-6 mb-6">
                <div class="text-center mb-4">
                    <h3 class="font-magic text-xl font-bold ${opponentIdx === 0 ? 'text-green-400' : 'text-red-400'}">
                        ${players[opponentIdx]?.name || 'Opponent'}
                        ${activePlayer === opponentIdx ? '⭐ (Active)' : ''}
                    </h3>
                    <div class="flex justify-center space-x-4 text-sm">
                        <span class="text-red-400">❤️ ${players[opponentIdx]?.life || 20} Life</span>
                        <span class="text-blue-400">🃏 ${players[opponentIdx]?.hand?.length || 7} Cards</span>
                        <span class="text-gray-400">📚 ${players[opponentIdx]?.library?.length || 53} Library</span>
                    </div>
                </div>
                <!-- Opponent's Battlefield -->
                <!-- Opponent's Hand (Hidden) -->
                <div class="flex justify-center space-x-2 mb-3 overflow-x-auto py-2">
                    ${Array(players[opponentIdx]?.hand?.length || 7).fill().map((_, index) => `
                        <div class="card-mini" 
                             data-card-id="opponent-card-${index}" 
                             style="width: 60px; height: 84px; transform: ${index % 2 === 0 ? 'rotate(-2deg)' : 'rotate(2deg)'}" 
                             title="Opponent's Card">
                            <div class="card-fallback" style="background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); border: 2px solid #c9aa71; display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;">
                                <span style="font-size: 18px;">🃏</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="bg-arena-surface/50 rounded-lg p-4 mb-4">
                    <h4 class="text-arena-accent font-semibold mb-2">🏟️ Opponent's Battlefield</h4>
                    
                    <!-- Opponent's Lands -->
                    <div class="battlefield-zone lands-zone">
                        <h5>🌍 Lands</h5>
                        <div class="zone-content">
                            ${(() => {
                                const lands = (players[opponentIdx]?.battlefield || []).filter(card => 
                                    card.card_type === 'land' || card.card_type === 'LAND'
                                );
                                return lands.length > 0 
                                    ? lands.map(card => renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
                                    : '<div class="zone-empty">No lands</div>';
                            })()}
                        </div>
                    </div>
                    
                    <!-- Opponent's Other Permanents -->
                    <div class="battlefield-zone permanents-zone">
                        <h5>⚔️ Permanents</h5>
                        <div class="zone-content">
                            ${(() => {
                                const permanents = (players[opponentIdx]?.battlefield || []).filter(card => 
                                    card.card_type !== 'land' && card.card_type !== 'LAND'
                                );
                                return permanents.length > 0 
                                    ? permanents.slice(0, 10).map(card => renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
                                    : '<div class="zone-empty">No permanents</div>';
                            })()}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Battlefield Center -->
            <div class="arena-card rounded-xl p-6 mb-6">
                <div class="text-center">
                    <h3 class="font-magic text-xl font-bold text-arena-accent mb-4">🏟️ The Battlefield</h3>
                    <!-- Stack -->
                    ${gameState.stack && gameState.stack.length > 0 ? `
                        <div class="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
                            <h4 class="text-yellow-300 font-semibold mb-2">📜 The Stack</h4>
                            <div class="space-y-2">
                                ${gameState.stack.map(spell => `
                                    <div class="bg-arena-surface rounded p-2 text-sm">
                                        ${spell.name || 'Unknown Spell'}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    <!-- Game Info -->
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div class="bg-yellow-500/20 rounded-lg p-3">
                            <div class="text-yellow-300 font-semibold">Turn</div>
                            <div class="text-2xl font-bold">${currentTurn}</div>
                        </div>
                        <div class="bg-blue-500/20 rounded-lg p-3">
                            <div class="text-blue-300 font-semibold">Phase</div>
                            <div class="text-lg font-bold capitalize">${currentPhase}</div>
                        </div>
                        <div class="bg-purple-500/20 rounded-lg p-3">
                            <div class="text-purple-300 font-semibold">Priority</div>
                            <div class="text-lg font-bold">Player ${(gameState.priority_player || 0) + 1}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Current Player Area -->
            <div class="arena-card rounded-xl p-6">
                <div class="text-center mb-4">
                    <h3 class="font-magic text-xl font-bold ${controlledIdx === 0 ? 'text-green-400' : 'text-red-400'}">
                        ${players[controlledIdx]?.name || 'You'}
                        ${activePlayer === controlledIdx ? '⭐ (Active)' : ''}
                    </h3>
                    <div class="flex justify-center space-x-4 text-sm">
                        <span class="text-red-400">❤️ ${players[controlledIdx]?.life || 20} Life</span>
                        <span class="text-blue-400">🃏 ${players[controlledIdx]?.hand?.length || 7} Cards</span>
                        <span class="text-gray-400">📚 ${players[controlledIdx]?.library?.length || 53} Library</span>
                    </div>
                </div>
                <!-- Your Battlefield -->
                <div class="bg-arena-surface/50 rounded-lg p-4 mb-4">
                    <h4 class="text-arena-accent font-semibold mb-2">🏟️ Your Battlefield</h4>
                    
                    <!-- Your Other Permanents -->
                    <div class="battlefield-zone permanents-zone">
                        <h5>⚔️ Your Permanents</h5>
                        <div class="zone-content">
                            ${(() => {
                                const permanents = (players[controlledIdx]?.battlefield || []).filter(card => 
                                    card.card_type !== 'land' && card.card_type !== 'LAND'
                                );
                                return permanents.length > 0 
                                    ? permanents.map(card => renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
                                    : '<div class="zone-empty">No permanents in play</div>';
                            })()}
                        </div>
                    </div>
                    
                    <!-- Your Lands -->
                    <div class="battlefield-zone lands-zone">
                        <h5>🌍 Your Lands</h5>
                        <div class="zone-content">
                            ${(() => {
                                const lands = (players[controlledIdx]?.battlefield || []).filter(card => 
                                    card.card_type === 'land' || card.card_type === 'LAND'
                                );
                                return lands.length > 0 
                                    ? lands.map(card => renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
                                    : '<div class="zone-empty">No lands played</div>';
                            })()}
                        </div>
                    </div>
                </div>
                <!-- Your Hand -->
                <div class="bg-arena-surface/50 rounded-lg p-4">
                    <h4 class="text-arena-accent font-semibold mb-2">✋ Your Hand</h4>
                    <div class="flex flex-wrap gap-2 justify-center">
                        ${(players[controlledIdx]?.hand || []).map((card, index) => {
                            const cardHtml = renderCardWithLoadingState(card, 'card-mini', false);
                            return `<div onclick="playCardFromHand('${card.id || card.name}', ${index})">${cardHtml}</div>`;
                        }).join('') || '<div class="text-arena-text-dim text-center py-4">No cards in hand</div>'}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error generating game board:', error);
        gameBoardContainer.innerHTML = `
            <div class="arena-card rounded-xl p-6 text-center">
                <h3 class="text-red-400 font-bold mb-2">⚠️ Error Loading Game Board</h3>
                <p class="text-arena-text-dim">${error.message}</p>
            </div>
        `;
    }
}

function generateActionPanel() {
    const actionPanelContainer = document.getElementById('action-panel');
    if (!actionPanelContainer || !gameState) {
        console.warn('Action panel container or game state not found');
        return;
    }
    
    try {
        const isActivePlayer = currentSelectedPlayer !== 'spectator';
        const canAct = isActivePlayer;
        
        actionPanelContainer.innerHTML = `
            <h4 class="font-magic font-semibold mb-4 text-arena-accent flex items-center">
                <span class="mr-2">⚡</span>Game Actions
            </h4>
            ${canAct ? `
                <!-- Phase Actions -->
                <div class="space-y-3 mb-6">
                    <button onclick="performGameAction('pass_phase')" 
                            class="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500 text-blue-300 hover:text-blue-200 py-3 rounded-lg font-semibold transition-all duration-200">
                        ⏭️ Pass Phase
                    </button>
                    <button onclick="performGameAction('draw_card')" 
                            class="w-full bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-500 text-green-300 hover:text-green-200 py-3 rounded-lg font-semibold transition-all duration-200">
                        🃏 Draw Card
                    </button>
                </div>
                <!-- Quick Actions -->
                <div class="border-t border-arena-accent/30 pt-4">
                    <h5 class="text-arena-accent font-semibold mb-3">Quick Actions</h5>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <button onclick="performGameAction('untap_all')" 
                                class="bg-arena-surface hover:bg-arena-surface-light border border-arena-accent/30 hover:border-arena-accent/50 text-arena-text py-2 rounded">
                            🔄 Untap All
                        </button>
                        <button onclick="performGameAction('end_turn')" 
                                class="bg-arena-surface hover:bg-arena-surface-light border border-arena-accent/30 hover:border-arena-accent/50 text-arena-text py-2 rounded">
                            ⏸️ End Turn
                        </button>
                    </div>
                </div>
            ` : `
                <!-- Spectator View -->
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">👁️</div>
                    <h5 class="text-arena-accent font-semibold mb-2">Spectator Mode</h5>
                    <p class="text-arena-text-dim text-sm">You are watching the battle unfold</p>
                </div>
            `}
        `;
    } catch (error) {
        console.error('Error generating action panel:', error);
        actionPanelContainer.innerHTML = `
            <div class="text-center py-4">
                <h5 class="text-red-400 font-bold mb-2">⚠️ Error</h5>
                <p class="text-arena-text-dim text-sm">${error.message}</p>
            </div>
        `;
    }
}

// ===== GAME ACTION FUNCTIONS =====
function performGameAction(actionType, actionData = {}) {
    console.log(`Performing action: ${actionType}`, actionData);
    
    if (currentSelectedPlayer === 'spectator') {
        showNotification('Spectators cannot perform actions', 'error');
        return;
    }
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        sendGameAction(actionType, actionData);
    } else {
        performHttpGameAction(actionType, actionData);
    }
}

async function performHttpGameAction(actionType, actionData = {}) {
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
                showNotification(`Action performed: ${actionType}`, 'success');
            } else {
                showNotification(`Action failed: ${result.error}`, 'error');
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('HTTP action error:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function playCardFromHand(cardId, handIndex) {
    performGameAction('play_card', { 
        card_id: cardId,
        hand_index: handIndex 
    });
}

// ===== CARD RENDERING FUNCTIONS =====
function renderCardWithLoadingState(card, cardClass = 'card-mini', showTooltip = true) {
    const cardId = card.id || card.name;
    const cardName = card.name || 'Unknown';
    const imageUrl = card.image_url;
    
    return `
        <div class="${cardClass}" 
             data-card-id="${cardId}"
             ${showTooltip ? `onclick="showCardPreview('${cardId}', '${cardName}', '${imageUrl || ''}')"` : ''}>
            ${imageUrl ? `
                <div class="relative">
                    <img src="${imageUrl}" 
                         alt="${cardName}" 
                         style="opacity: 0; transition: opacity 0.3s ease;"
                         onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="card-fallback" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                        <span style="font-size: 14px;">🃏</span>
                        <span style="font-size: 8px; text-align: center;">${cardName}</span>
                    </div>
                </div>
            ` : `
                <div class="card-fallback">
                    <span style="font-size: 14px;">🃏</span>
                    <span style="font-size: 8px; text-align: center;">${cardName}</span>
                </div>
            `}
            <div class="card-text-overlay">
                <div class="card-name">${cardName}</div>
                ${card.mana_cost ? `<div class="card-stats">💎 ${card.mana_cost}</div>` : ''}
                ${card.power !== undefined && card.toughness !== undefined ? 
                    `<div class="card-stats">${card.power}/${card.toughness}</div>` : 
                    ''}
            </div>
        </div>
    `;
}

function showCardPreview(cardId, cardName, imageUrl) {
    // Remove any existing preview
    const existingPreview = document.getElementById('card-preview-modal');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create preview modal
    const preview = document.createElement('div');
    preview.id = 'card-preview-modal';
    preview.className = 'card-preview-modal show';
    preview.onclick = (e) => {
        if (e.target === preview) {
            preview.remove();
        }
    };
    
    preview.innerHTML = `
        <div class="text-center">
            ${imageUrl ? `
                <img src="${imageUrl}" 
                     alt="${cardName}" 
                     class="card-preview-image"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display: none;">
                    <div class="w-64 h-80 bg-arena-surface border-2 border-dashed border-arena-accent/30 rounded-lg mx-auto flex items-center justify-center text-arena-text-dim mb-4">
                        <div class="text-center">
                            <span class="text-4xl block mb-2">🃏</span>
                            <span class="text-sm">No Image Available</span>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="w-64 h-80 bg-arena-surface border-2 border-dashed border-arena-accent/30 rounded-lg mx-auto flex items-center justify-center text-arena-text-dim mb-4">
                    <div class="text-center">
                        <span class="text-4xl block mb-2">🃏</span>
                        <span class="text-sm">No Image Available</span>
                    </div>
                </div>
            `}
            <h3 class="font-magic text-xl font-bold text-arena-accent mb-3">${cardName}</h3>
            <button onclick="this.closest('#card-preview-modal').remove()" 
                    class="bg-arena-primary hover:bg-arena-secondary text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(preview);
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        if (preview && preview.parentNode) {
            preview.remove();
        }
    }, 5000);
}

function preloadCardImages(cards) {
    if (!cards || !Array.isArray(cards)) return;
    
    cards.forEach(card => {
        if (card.image_url) {
            const img = new Image();
            img.src = card.image_url;
        }
    });
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'success') {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) return;
    
    const notification = document.createElement('div');
    
    const bgColor = type === 'error' ? 'bg-red-500/90' : 'bg-green-500/90';
    const icon = type === 'error' ? '❌' : '✅';
    
    notification.innerHTML = `
        <div class="${bgColor} text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
            <span>${icon}</span>
            <span>${message}</span>
        </div>
    `;
    
    notificationArea.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showAutoRefreshIndicator(text = 'Updated', type = 'success') {
    const indicator = document.createElement('div');
    
    const colors = {
        'success': 'bg-blue-500/80',
        'warning': 'bg-yellow-500/80',
        'error': 'bg-red-500/80'
    };
    
    indicator.innerHTML = `
        <div class="fixed top-4 left-4 ${colors[type] || colors.success} text-white px-3 py-1 rounded-lg text-sm flex items-center space-x-2 animate-fade-in z-50">
            <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>${text}</span>
        </div>
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.remove();
    }, 2000);
}

// ===== CHAT FUNCTIONALITY =====
function addChatMessage(player, message) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.innerHTML = `
        <div class="bg-arena-primary/20 border border-arena-accent/30 rounded p-2 animate-fade-in">
            <span class="text-arena-accent font-semibold">${player}:</span>
            <span class="text-arena-text ml-2">${message}</span>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const message = input.value.trim();
    
    if (message) {
        const playerName = currentSelectedPlayer === 'spectator' ? 'Spectator' : 'Player ' + currentSelectedPlayer.slice(-1);
        
        // Always add message locally first for immediate feedback
        addChatMessage(playerName, message);
        
        // Send via WebSocket if connected
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'chat',
                player: playerName,
                message: message,
                timestamp: Date.now()
            }));
        }
        
        input.value = '';
    }
}

// ===== ALPINE.JS COMPATIBILITY =====
function gameInterface() {
    return {
        // Component state can be added here if needed
    };
}

// ===== INITIALIZATION HELPERS =====
function initializeGameVariables(gameData, gameIdValue) {
    gameState = gameData;
    gameId = gameIdValue;
    console.log('Game variables initialized:', { gameId, gameState });
}
