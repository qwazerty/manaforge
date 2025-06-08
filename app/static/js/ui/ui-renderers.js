/**
 * ManaForge UI Renderers Module
 * Contains rendering logic for different UI components
 */

class UIRenderers {
    /**
     * Render role display
     */
    static renderRoleDisplay() {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        const roleDisplay = document.getElementById('current-role-display');
        const roleDescription = document.getElementById('role-description');
        
        if (!roleDisplay || !roleDescription) {
            console.warn('Role display elements not found');
            return;
        }
        
        const roleData = this.getRoleData();
        const role = roleData[currentSelectedPlayer] || roleData['player1'];
        
        roleDisplay.className = `px-4 py-3 rounded-lg border-2 mb-3 ${role.class}`;
        roleDisplay.textContent = role.title;
        roleDescription.textContent = role.description;
    }

    /**
     * Render stack area
     */
    static renderStackArea() {
        const gameState = GameCore.getGameState();
        const stackContainer = document.getElementById('stack-area');
        
        if (!this.validateContainer(stackContainer, 'Stack area container')) return;
        if (!this.validateGameState(gameState)) return;

        try {
            const stack = gameState.stack || [];
            const { controlledIdx, opponentIdx, players } = this.getPlayerIndices(gameState);
            const opponent = players[opponentIdx] || {};
            const player = players[controlledIdx] || {};
            
            // Render both player and opponent card zones + stack area in the left sidebar
            stackContainer.innerHTML = `
                <!-- Player's Card Zones -->
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>Your Card Zones
                    </h4>
                    ${UITemplates.generateCardZones(player, false, controlledIdx)}
                </div>
                
                <!-- Opponent Card Zones -->
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>Opponent's Zones
                    </h4>
                    ${UITemplates.generateCardZones(opponent, true, opponentIdx)}
                </div>
                
                <!-- The Stack -->
                ${this.generateStackContent(stack)}
            `;
        } catch (error) {
            this.renderError(stackContainer, 'Error loading stack', error.message);
        }
    }

    /**
     * Render game board
     */
    static renderGameBoard() {
        const gameState = GameCore.getGameState();
        const gameBoardContainer = document.getElementById('game-board');
        
        if (!this.validateContainer(gameBoardContainer, 'Game board container')) return;
        if (!this.validateGameState(gameState)) return;

        try {
            const { controlledIdx, opponentIdx, players, activePlayer } = this.getPlayerIndices(gameState);
            
            // Preload card images for better performance
            this.preloadCardImages(players);
            
            gameBoardContainer.innerHTML = `
                ${this.renderOpponentArea(players[opponentIdx], opponentIdx, activePlayer)}
                ${this.renderPlayerArea(players[controlledIdx], controlledIdx, activePlayer)}
            `;
        } catch (error) {
            this.renderError(gameBoardContainer, 'Error Loading Game Board', error.message);
        }
    }

    /**
     * Render action panel
     */
    static renderActionPanel() {
        const gameState = GameCore.getGameState();
        const actionPanelContainer = document.getElementById('action-panel');
        
        if (!this.validateContainer(actionPanelContainer, 'Action panel container')) return;
        if (!this.validateGameState(gameState)) return;

        try {
            const currentSelectedPlayer = GameCore.getSelectedPlayer();
            const isActivePlayer = currentSelectedPlayer !== 'spectator';
            
            actionPanelContainer.innerHTML = `
                <h4 class="font-magic font-semibold mb-2 text-arena-accent flex items-center">
                    <span class="mr-2">⚡</span>Game Actions
                </h4>
                ${isActivePlayer ? UITemplates.generateActionButtons() : UITemplates.generateSpectatorView()}
            `;
        } catch (error) {
            this.renderError(actionPanelContainer, 'Error', error.message);
        }
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Get role data configuration
     */
    static getRoleData() {
        return {
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
    }

    /**
     * Generate stack content HTML
     */
    static generateStackContent(stack) {
        return `
            <div class="stack-container">
                <div class="stack-header">
                    📜 The Stack (${stack.length})
                </div>
                <div class="stack-content">
                    ${stack.length > 0 ? 
                        stack.map((spell, index) => this.renderStackSpell(spell, index)).reverse().join('')
                        : this.renderEmptyStack()
                    }
                </div>
            </div>
        `;
    }

    /**
     * Render individual stack spell
     */
    static renderStackSpell(spell, index) {
        const cardName = spell.name || 'Unknown Spell';
        const imageUrl = GameCards.getSafeImageUrl(spell);
        
        // Escape values for safe JavaScript injection
        const escapedCardId = GameUtils.escapeJavaScript(spell.id || spell.name);
        const escapedCardName = GameUtils.escapeJavaScript(cardName);
        const escapedImageUrl = GameUtils.escapeJavaScript(imageUrl || '');
        
        return `
            <div class="stack-spell" 
                 data-index="${index}"
                 data-card-id="${spell.id || spell.name}"
                 data-card-name="${escapedCardName}"
                 data-card-image="${escapedImageUrl}"
                 data-card-zone="stack"
                 data-stack-index="${index}"
                 oncontextmenu="GameCards.showCardContextMenu(event, this); return false;"
                 onclick="GameActions.resolveStackSpell('${escapedCardId}', '${index}'); event.stopPropagation();">
                
                <!-- Card Image Taking Full Size -->
                <div class="stack-card-container">
                    ${imageUrl ? `
                        <img src="${imageUrl}" 
                             alt="${cardName}" 
                             class="stack-card-image"
                             style="opacity: 0; transition: opacity 0.3s ease;"
                             onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="stack-card-fallback" style="display: flex;">
                            <span style="font-size: 36px;">🃏</span>
                        </div>
                    ` : `
                        <div class="stack-card-fallback">
                            <span style="font-size: 36px;">🃏</span>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Render empty stack message
     */
    static renderEmptyStack() {
        return `
            <div class="stack-empty">
                <div style="font-size: 24px; margin-bottom: 8px;">📚</div>
                <div>The stack is empty</div>
                <div style="font-size: 10px; margin-top: 4px; color: rgba(201, 170, 113, 0.4);">
                    Spells and abilities will appear here
                </div>
            </div>
        `;
    }

    /**
     * Get player indices for controlled and opponent players
     */
    static getPlayerIndices(gameState) {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        const players = gameState.players || [];
        const activePlayer = gameState.active_player || 0;
        
        let controlledIdx = 0;
        if (currentSelectedPlayer === 'player2') controlledIdx = 1;
        else if (currentSelectedPlayer === 'player1') controlledIdx = 0;
        
        const opponentIdx = controlledIdx === 0 ? 1 : 0;
        
        return { controlledIdx, opponentIdx, players, activePlayer };
    }

    /**
     * Render opponent area
     */
    static renderOpponentArea(opponent, opponentIdx, activePlayer) {
        return `
            <div class="arena-card rounded-lg p-3">
                <div class="flex justify-center space-x-1 overflow-x-auto py-1">
                    ${UITemplates.generateOpponentHand(opponent?.hand?.length || 7)}
                </div>
                
                <div class="bg-arena-surface/50 rounded-lg p-2">
                    ${UITemplates.generateBattlefieldZone(opponent?.battlefield, 'lands', 'Lands', '🌍')}
                    ${UITemplates.generateBattlefieldZone(opponent?.battlefield, 'permanents', 'Permanents', '⚔️')}
                </div>
            </div>
        `;
    }

    /**
     * Render battlefield center
     */
    static renderBattlefieldCenter(gameState) {
        return `
            <div class="arena-card rounded-xl p-6 mb-6">
                <div class="text-center">
                    <h3 class="font-magic text-xl font-bold text-arena-accent mb-4">🏟️ The Battlefield</h3>
                    ${UITemplates.generateGameInfo(gameState)}
                </div>
            </div>
        `;
    }

    /**
     * Render player area
     */
    static renderPlayerArea(player, controlledIdx, activePlayer) {
        return `
            <div class="arena-card rounded-lg p-3">
                <div class="bg-arena-surface/50 rounded-lg p-2">
                    ${UITemplates.generateBattlefieldZone(player?.battlefield, 'permanents', 'Your Permanents', '⚔️')}
                    ${UITemplates.generateBattlefieldZone(player?.battlefield, 'lands', 'Your Lands', '🌍')}
                </div>
                
                <div class="bg-arena-surface/50 rounded-lg p-2">
                    <h4 class="text-arena-accent font-semibold mb-1 text-sm">✋ Your Hand</h4>
                    <div class="flex flex-wrap gap-1 justify-center">
                        ${UITemplates.generatePlayerHand(player?.hand || [])}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Preload card images for better performance
     */
    static preloadCardImages(players) {
        players.forEach(player => {
            if (player.hand) {
                // Preload hand cards
            }
            if (player.battlefield) {
                // Preload battlefield cards
            }
        });
    }

    /**
     * Validate container element
     */
    static validateContainer(container, containerName) {
        if (!container) {
            console.warn(`${containerName} not found`);
            return false;
        }
        return true;
    }

    /**
     * Validate game state
     */
    static validateGameState(gameState) {
        if (!gameState) {
            console.warn('Game state not available');
            return false;
        }
        return true;
    }

    /**
     * Render error in container
     */
    static renderError(container, title, message) {
        console.error(`${title}:`, message);
        container.innerHTML = UITemplates.generateErrorTemplate(title, message);
    }
}

window.UIRenderers = UIRenderers;
