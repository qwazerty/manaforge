/**
 * ManaForge Game UI Module
 * Handles user interface elements, rendering and updates
 */

// ===== UI FUNCTIONS =====
function updateRoleDisplay() {
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
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

function generateStackArea() {
    const gameState = GameCore.getGameState();
    const stackContainer = document.getElementById('stack-area');
    if (!stackContainer || !gameState) {
        console.warn('Stack area container or game state not found');
        return;
    }

    try {
        const stack = gameState.stack || [];
        
        stackContainer.innerHTML = `
            <div class="stack-container">
                <div class="stack-header">
                    📜 The Stack (${stack.length})
                </div>
                <div class="stack-content">
                    ${stack.length > 0 ? 
                        stack.map((spell, index) => {
                            const spellType = spell.card_type || spell.type || 'ability';
                            const spellClass = spellType.includes('instant') ? 'stack-spell-instant' : 
                                             spellType.includes('sorcery') ? 'stack-spell-sorcery' : 
                                             'stack-spell-ability';
                            
                            // Use image URL if available and valid, otherwise show text-based fallback
                            const imageUrl = GameCards.getSafeImageUrl(spell);
                            const cardName = spell.name || spell.card_name || 'Unknown Spell';
                            const playerNumber = (spell.player_id || '1').replace('player', '');
                            
                            // Escape card name for safe injection in JavaScript
                            const escapedCardName = GameUtils.escapeJavaScript(cardName);
                            const escapedImageUrl = GameUtils.escapeJavaScript(imageUrl || '');
                            
                            // Debug logging for stack cards
                            GameCards.debugCardImage(cardName, imageUrl, 'stack');
                            
                            return `
                                <div class="stack-spell ${spellClass}" data-stack-index="${index}" title="${cardName} - Cast by Player ${playerNumber}">
                                    <div class="stack-card-container">
                                        ${imageUrl ? `
                                            <div class="relative">
                                                <img src="${imageUrl}" 
                                                     alt="${cardName}"
                                                     class="stack-card-image"
                                                     loading="lazy"
                                                     style="opacity: 0; transition: opacity 0.3s ease;"
                                                     onload="console.log('✅ Stack image loaded:', '${escapedCardName}'); this.style.opacity='1'; this.nextElementSibling.style.display='none';"
                                                     onerror="console.log('❌ Stack image failed:', '${escapedCardName}', '${escapedImageUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                                />
                                                <!-- Fallback content if image fails to load -->
                                                <div class="stack-card-fallback" style="display: flex;">
                                                    <div class="stack-spell-name">${cardName}</div>
                                                    ${spell.mana_cost ? `<div class="stack-spell-mana">${spell.mana_cost}</div>` : ''}
                                                </div>
                                            </div>
                                        ` : `
                                            <!-- Text-based fallback when no image URL is available -->
                                            <div class="stack-card-fallback">
                                                <div class="stack-spell-name">${cardName}</div>
                                                ${spell.mana_cost ? `<div class="stack-spell-mana">${spell.mana_cost}</div>` : ''}
                                            </div>
                                        `}
                                        <!-- Player indicator overlay -->
                                        <div class="stack-player-indicator">
                                            P${playerNumber}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).reverse().join('') // Reverse to show most recent spells on top
                        : 
                        `<div class="stack-empty">
                            <div style="font-size: 24px; margin-bottom: 8px;">📚</div>
                            <div>The stack is empty</div>
                            <div style="font-size: 10px; margin-top: 4px; color: rgba(201, 170, 113, 0.4);">
                                Spells and abilities will appear here
                            </div>
                        </div>`
                    }
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error generating stack area:', error);
        stackContainer.innerHTML = `
            <div class="stack-container">
                <div class="stack-header">
                    📜 The Stack
                </div>
                <div class="stack-content">
                    <div class="stack-empty" style="color: #ef4444;">
                        ⚠️ Error loading stack
                    </div>
                </div>
            </div>
        `;
    }
}

function generateGameBoard() {
    const gameState = GameCore.getGameState();
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
    const gameBoardContainer = document.getElementById('game-board');
    if (!gameBoardContainer || !gameState) {
        console.warn('Game board container or game state not found');
        return;
    }
    
    try {
        const players = gameState.players || [];
        
        // Preload all card images for better performance
        players.forEach(player => {
            if (player.hand) GameCards.preloadCardImages(player.hand);
            if (player.battlefield) GameCards.preloadCardImages(player.battlefield);
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
                <!-- Opponent's Battlefield -->
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
                                    ? lands.map(card => GameCards.renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
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
                                    ? permanents.slice(0, 10).map(card => GameCards.renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
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
                                    ? permanents.map(card => GameCards.renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
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
                                    ? lands.map(card => GameCards.renderCardWithLoadingState(card, 'card-battlefield', true)).join('')
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
                            const cardHtml = GameCards.renderCardWithLoadingState(card, 'card-mini', false);
                            const escapedCardId = GameUtils.escapeJavaScript(card.id || card.name);
                            return `<div onclick="GameActions.playCardFromHand('${escapedCardId}', ${index})">${cardHtml}</div>`;
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
    const gameState = GameCore.getGameState();
    const currentSelectedPlayer = GameCore.getSelectedPlayer();
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
                    <button onclick="GameActions.performGameAction('pass_phase')" 
                            class="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500 text-blue-300 hover:text-blue-200 py-3 rounded-lg font-semibold transition-all duration-200">
                        ⏭️ Pass Phase
                    </button>
                    <button onclick="GameActions.performGameAction('draw_card')" 
                            class="w-full bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-500 text-green-300 hover:text-green-200 py-3 rounded-lg font-semibold transition-all duration-200">
                        🃏 Draw Card
                    </button>
                </div>
                <!-- Quick Actions -->
                <div class="border-t border-arena-accent/30 pt-4">
                    <h5 class="text-arena-accent font-semibold mb-3">Quick Actions</h5>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <button onclick="GameActions.performGameAction('untap_all')" 
                                class="bg-arena-surface hover:bg-arena-surface-light border border-arena-accent/30 hover:border-arena-accent/50 text-arena-text py-2 rounded">
                            🔄 Untap All
                        </button>
                        <button onclick="GameActions.performGameAction('end_turn')" 
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

// Notification and feedback functions
function showNotification(message, type = 'info') {
    // Implementation needed - show a temporary notification
    console.log(`[${type}] ${message}`);
    
    // Create a notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = message;
    
    // Add to notifications area if it exists
    const notificationsArea = document.getElementById('notifications-area');
    if (notificationsArea) {
        notificationsArea.appendChild(notification);
        
        // Auto remove after delay
        setTimeout(() => {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }
}

function showAutoRefreshIndicator(message, type = 'info') {
    // Implementation needed - update the status indicator
    const indicator = document.getElementById('auto-refresh-indicator');
    if (indicator) {
        indicator.textContent = message;
        indicator.className = `auto-refresh-indicator auto-refresh-${type}`;
        
        // Make it flash
        indicator.classList.add('auto-refresh-flash');
        setTimeout(() => {
            indicator.classList.remove('auto-refresh-flash');
        }, 1000);
    }
}

function addChatMessage(sender, message) {
    // Implementation needed - add message to chat
    const chatArea = document.getElementById('chat-area');
    if (chatArea) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.innerHTML = `
            <span class="chat-sender">${sender}:</span>
            <span class="chat-text">${message}</span>
        `;
        chatArea.appendChild(messageElement);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

// Export UI module functionality
window.GameUI = {
    updateRoleDisplay,
    generateStackArea,
    generateGameBoard,
    generateActionPanel,
    showNotification,
    showAutoRefreshIndicator,
    addChatMessage
};
