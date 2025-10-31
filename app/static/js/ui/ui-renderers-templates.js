/**
 * ManaForge Unified Renderers and Templates Module
 * Combines rendering logic and HTML template generation
 * Replaces ui-renderers.js + ui-templates.js + ui-game-interface.js (~445 lines → ~300 lines)
 */

class UIRenderersTemplates {
    // ===== MAIN RENDERING METHODS =====
    
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
        
        const roleData = this._getRoleData();
        const role = roleData[currentSelectedPlayer] || roleData['player1'];
        
        roleDisplay.className = `px-4 py-3 rounded-lg border-2 mb-3 ${role.class}`;
        roleDisplay.textContent = role.title;
        roleDescription.textContent = role.description;
    }

    /**
     * Render left sidebar
     */
    static renderLeftArea() {
        const gameState = GameCore.getGameState();
        const stackContainer = document.getElementById('stack-area');
        
        if (!this._validateContainer(stackContainer, 'Left sidebar container')) return;
        if (!this._validateGameState(gameState)) return;

        try {
            const { controlledIdx, opponentIdx, players } = this._getPlayerIndices(gameState);
            const opponent = players[opponentIdx] || {};
            const player = players[controlledIdx] || {};
            
            stackContainer.innerHTML = `
                <!-- Opponent Card Zones -->
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>Opponent
                    </h4>
                    ${this.generateCardZones(opponent, true, opponentIdx)}
                </div>

                <!-- Game Actions Panel -->
                <div id="action-panel" class="arena-card rounded-lg p-4 mb-3"></div>

                <!-- Player's Card Zones -->
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>Player
                    </h4>
                    ${this.generateCardZones(player, false, controlledIdx)}
                </div>
            `;

            this.renderActionPanel();
        } catch (error) {
            this._renderError(stackContainer, 'Error loading stack', error.message);
        }
    }

    /**
     * Render game board
     */
    static renderGameBoard() {
        const gameState = GameCore.getGameState();
        const gameBoardContainer = document.getElementById('game-board');
        
        if (!this._validateContainer(gameBoardContainer, 'Game board container')) return;
        if (!this._validateGameState(gameState)) return;

        try {
            const { controlledIdx, opponentIdx, players, activePlayer } = this._getPlayerIndices(gameState);
            
            this._preloadCardImages(players);
            
            gameBoardContainer.innerHTML = `
                ${this._renderOpponentArea(players[opponentIdx], opponentIdx, activePlayer)}
                ${this._renderPlayerArea(players[controlledIdx], controlledIdx, activePlayer)}
            `;

            // Apply card overlap after DOM is updated
            if (window.UICardOverlap) {
                requestAnimationFrame(() => {
                    window.UICardOverlap.applyOverlapToAllZones();
                });
            }
        } catch (error) {
            this._renderError(gameBoardContainer, 'Error Loading Game Board', error.message);
        }
    }

    /**
     * Render action panel
     */
    static renderActionPanel() {
        const gameState = GameCore.getGameState();
        const actionPanelContainer = document.getElementById('action-panel');
        
        if (!this._validateContainer(actionPanelContainer, 'Action panel container')) return;
        if (!this._validateGameState(gameState)) return;

        try {
            const currentSelectedPlayer = GameCore.getSelectedPlayer();
            const isActivePlayer = currentSelectedPlayer !== 'spectator';
            const stack = gameState.stack || [];
            
            actionPanelContainer.innerHTML = `
                <h4 class="font-magic font-semibold mb-2 text-arena-accent flex items-center">
                    <span class="mr-2">⚡</span>Game Actions
                </h4>
                ${isActivePlayer ? this.generateActionButtons() : this.generateSpectatorView()}
            `;

            this._updateStackOverlay(stack);
        } catch (error) {
            this._renderError(actionPanelContainer, 'Error', error.message);
            this._updateStackOverlay([]);
        }
    }

    // ===== TEMPLATE GENERATION METHODS =====
    
    /**
     * Generate combined card zones display
     */
    static generateCardZones(playerData, isOpponent = false, playerIndex = null) {
        const config = UIUtils.getZoneConfiguration(isOpponent, playerIndex);
        const zoneTemplates = this._generateZoneTemplates(playerData, config, isOpponent);

        const zoneOrder = ['exile', 'graveyard', 'deck', 'life'];

        const orderedZones = zoneOrder.map(zoneName => zoneTemplates[zoneName]);

        return `
            <div class="card-zones-container">
                ${orderedZones.join('')}
            </div>
        `;
    }

    /**
     * Generate action buttons for active player
     */
    static generateActionButtons() {
        const gameState = GameCore.getGameState();
        const currentPhase = gameState?.phase || 'begin';
        const currentTurn = gameState?.turn || 1;
        const activePlayer = gameState?.active_player || 0;
        
        return `
            <div>
                ${this._generateGameInfoSection(currentTurn, activePlayer)}
                ${this._generateGamePhases(currentPhase)}
                ${this._generateActionButtonsSection()}
            </div>
        `;
    }

    /**
     * Generate spectator view
     */
    static generateSpectatorView() {
        return `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">👁️</div>
                <h5 class="text-arena-accent font-semibold mb-2">Spectator Mode</h5>
                <p class="text-arena-text-dim text-sm">You are watching the battle unfold</p>
            </div>
        `;
    }

    /**
     * Generate error template
     */
    static generateErrorTemplate(title, message) {
        return `
            <div class="arena-card rounded-xl p-6 text-center">
                <h3 class="text-red-400 font-bold mb-2">⚠️ ${title}</h3>
                <p class="text-arena-text-dim">${message}</p>
            </div>
        `;
    }

    /**
     * Generate battlefield zone
     */
    static generateBattlefieldZone(cards, zoneName, isOpponent, playerId = null) {
        const filteredCards = UIUtils.filterCardsByType(cards, zoneName);
        const cardCount = filteredCards.length;
        const cardsHtml = filteredCards.map(card => {
            return GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, 'battlefield', isOpponent, null, playerId);
        }).join('');

        return `
            <div class="battlefield-zone ${zoneName}-zone compact-zones">
                <div class="${zoneName}-zone-content zone-content" data-card-count="${cardCount}"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, '${zoneName}')">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Generate the battlefield layout with its subzones
     */
    static generateBattlefieldLayout(cards, isOpponent, playerId = null) {
        return `
            <div class="battlefield-layout">
                ${this.generateBattlefieldZone(cards, 'lands', isOpponent, playerId)}
                ${this.generateBattlefieldZone(cards, 'creatures', isOpponent, playerId)}
                ${this.generateBattlefieldZone(cards, 'support', isOpponent, playerId)}
            </div>
        `;
    }

    /**
     * Generate player's hand
     */
    static generatePlayerHand(hand = [], playerId = null) {
        if (hand.length === 0) {
            return '<div class="text-arena-text-dim text-center py-4">No cards in hand</div>';
        }

        return hand.map((card, index) => 
            GameCards.renderCardWithLoadingState(card, UIConfig.CSS_CLASSES.card.mini, false, 'hand', false, index, playerId)
        ).join('');
    }

    /**
     * Generate opponent's hidden hand
     */
    static generateOpponentHand(handSize = 7) {
        return Array(handSize).fill().map((_, index) => `
            <div class="card-back opponent-hand-card" 
                 data-card-id="opponent-card-${index}" 
                 style="width: 60px; height: 84px; ${UIUtils.createTransform(0, 0, index % 2 === 0 ? -2 : 2)}">
            </div>
        `).join('');
    }

    /**
     * Generate game info panel
     */
    static generateGameInfo(gameState) {
        const currentTurn = gameState.turn || 1;
        const currentPhase = gameState.phase || 'begin';
        const priorityPlayer = (gameState.priority_player || 0) + 1;
        const phaseDisplay = UIConfig.getPhaseDisplayName(currentPhase);

        return `
            <div class="grid grid-cols-3 gap-4 text-center">
                <div class="bg-yellow-500/20 rounded-lg p-3">
                    <div class="text-yellow-300 font-semibold">Turn</div>
                    <div class="text-2xl font-bold">${currentTurn}</div>
                </div>
                <div class="bg-blue-500/20 rounded-lg p-3">
                    <div class="text-blue-300 font-semibold">Phase</div>
                    <div class="text-lg font-bold">${phaseDisplay}</div>
                </div>
                <div class="bg-purple-500/20 rounded-lg p-3">
                    <div class="text-purple-300 font-semibold">Priority</div>
                    <div class="text-lg font-bold">Player ${priorityPlayer}</div>
                </div>
            </div>
        `;
    }

    // ===== DELEGATION TO EXISTING MODULES =====
    
    // Configuration access
    static get GAME_PHASES() { return UIConfig.GAME_PHASES; }
    static get LIFE_CONTROLS() { return UIConfig.LIFE_CONTROLS; }
    static get CSS_CLASSES() { return UIConfig.CSS_CLASSES; }

    // Utility methods delegation
    static createTransform(x, y, rotation) { return UIUtils.createTransform(x, y, rotation); }
    static createZIndex(index) { return UIUtils.createZIndex(index); }
    static generateButton(onclick, classes, title, content) { return UIUtils.generateButton(onclick, classes, title, content); }
    static generateZoneWrapper(content, zoneType) { return UIUtils.generateZoneWrapper(content, zoneType); }
    static generateEmptyZoneContent(icon, message) { return UIUtils.generateEmptyZoneContent(icon, message); }
    static generateCardLayer(card, index, transforms) { return UIUtils.generateCardLayer(card, index, transforms); }
    static generateEmptyZone(icon, name) { return UIUtils.generateEmptyZone(icon, name); }
    static generateZoneClickHandler(isOpponent, prefix, zoneType, title) { return UIUtils.generateZoneClickHandler(isOpponent, prefix, zoneType, title); }
    static filterCardsByType(cards, zoneName) { return UIUtils.filterCardsByType(cards, zoneName); }
    static getZoneConfiguration(isOpponent, playerIndex) { return UIUtils.getZoneConfiguration(isOpponent, playerIndex); }

    // Zone generation delegation to UIZonesManager
    static generateDeckZone(deck, isOpponent) { return UIZonesManager.generateDeckZone(deck, isOpponent); }
    static generateGraveyardZone(graveyard, isOpponent) { return UIZonesManager.generateGraveyardZone(graveyard, isOpponent); }
    static generateExileZone(exile, isOpponent) { return UIZonesManager.generateExileZone(exile, isOpponent); }
    static generateLifeZone(life, playerId, titlePrefix) { return UIZonesManager.generateLifeZone(life, playerId, titlePrefix); }

    // ===== PRIVATE HELPER METHODS =====
    
    /**
     * Generate zone templates in the correct order
     */
    static _generateZoneTemplates(playerData, config, isOpponent) {
        const { prefix, titlePrefix, zoneIds, playerId } = config;
        const { library = [], deck = [], graveyard = [], exile = [], life = 20 } = playerData;
        
        const deckData = library.length > 0 ? library : deck;

        return {
            life: this.generateLifeZone(life, playerId, titlePrefix),
            deck: this.generateDeckZone(deckData, isOpponent),
            graveyard: this.generateGraveyardZone(graveyard, isOpponent),
            exile: this.generateExileZone(exile, isOpponent)
        };
    }

    /**
     * Get role data configuration
     */
    static _getRoleData() {
        return {
            'player1': { class: 'bg-green-500/20 border-green-500/50 text-green-400', title: '🛡️ Player 1', description: 'You control the first player position' },
            'player2': { class: 'bg-red-500/20 border-red-500/50 text-red-400', title: '🎯 Player 2', description: 'You control the second player position' },
            'spectator': { class: 'bg-purple-500/20 border-purple-500/50 text-purple-400', title: '👁️ Spectator', description: 'You are watching the battle unfold' }
        };
    }

    /**
     * Generate game info section
     */
    static _generateGameInfoSection(currentTurn, activePlayer) {
        const activePlayerName = activePlayer === 0 ? 'Player 1' : 'Player 2';
        
        return `
            <div class="grid grid-cols-2 gap-2 mb-4">
                <div class="text-center">
                    <div class="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
                        <div class="text-blue-300 font-semibold text-sm">Turn</div>
                        <div class="text-lg font-bold text-arena-accent">${currentTurn}</div>
                    </div>
                </div>
                <div class="text-center">
                    <div class="bg-yellow-500/20 rounded-lg p-3 border border-yellow-500/30">
                        <div class="text-yellow-300 font-semibold text-sm">Active</div>
                        <div class="text-lg font-bold text-arena-accent">${activePlayerName}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate game phases indicator
     */
    static _generateGamePhases(currentPhase) {
        return `
            <div class="mb-4 bg-arena-surface/30 border border-arena-accent/20 rounded-lg p-3">
                <div class="grid grid-cols-5 gap-1">
                    ${UIConfig.GAME_PHASES.map(phase => `
                        <div class="text-center py-2 px-1 rounded transition-all duration-200 ${
                            currentPhase === phase.id ? 
                            'bg-yellow-500/20 border border-yellow-500/40 text-yellow-300' : 
                            'text-arena-text-dim hover:text-arena-text'
                        }" title="${phase.name} Phase">
                            <div class="text-lg mb-1 leading-none">${phase.icon}</div>
                            <div class="text-xs font-medium leading-tight">${phase.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Generate action buttons section
     */
    static _generateActionButtonsSection() {
        const passPhaseBtn = UIUtils.generateButton(
            "GameActions.performGameAction('pass_phase')",
            UIConfig.CSS_CLASSES.button.primary,
            "Pass current phase",
            "⏭️ Pass Phase"
        );

        const untapBtn = UIUtils.generateButton(
            "GameActions.untapAll()",
            UIConfig.CSS_CLASSES.button.secondary,
            "Untap all permanents",
            "🔄 Untap All"
        );

        const resolveStackBtn = UIUtils.generateButton(
            "GameActions.performGameAction('resolve_all_stack')",
            UIConfig.CSS_CLASSES.button.secondary,
            "Resolve all spells on the stack",
            "🎯 Resolve All Stack"
        );

        return `
            <div class="flex items-center mb-3">
                ${passPhaseBtn}
            </div>
            
            <!-- Card Search Section -->
            <div class="mb-4">
                ${UIUtils.generateButton(
                    "showCardSearch('battlefield')",
                    UIConfig.CSS_CLASSES.button.secondary + ' w-full',
                    "Search for a card to add to the battlefield",
                    "🔍 Search cards"
                )}
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                ${untapBtn}
                ${resolveStackBtn}
            </div>
        `;
    }

    /**
     * Update stack overlay visibility and content
     */
    static _updateStackOverlay(stack) {
        const elements = this._ensureStackPopup();
        if (!elements) {
            return;
        }

        const { panel, body, countLabel } = elements;

        if (!Array.isArray(stack) || stack.length === 0) {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
            body.innerHTML = '';
            countLabel.textContent = '0';
            delete panel.dataset.userMoved;
            return;
        }

        countLabel.textContent = String(stack.length);
        body.innerHTML = this._generateStackContent(stack);
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');

        if (panel.dataset.userMoved !== 'true') {
            requestAnimationFrame(() => this._positionStackPopupRelativeToBoard(panel));
        }
    }

    static _ensureStackPopup() {
        if (this._stackPopupElements && this._stackPopupElements.panel) {
            return this._stackPopupElements;
        }

        if (typeof document === 'undefined') {
            return null;
        }

        let panel = document.getElementById('stack-popup');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'stack-popup';
            panel.className = 'stack-popup hidden';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'Stack');
            panel.setAttribute('aria-hidden', 'true');
            panel.innerHTML = `
                <div class="stack-popup-header" data-draggable-handle>
                    <div class="stack-popup-title">
                        <span class="stack-popup-icon">📜</span>
                        <span class="stack-popup-label">Stack</span>
                        <span class="stack-popup-count" id="stack-popup-count">0</span>
                    </div>
                </div>
                <div class="stack-popup-body" id="stack-popup-body"></div>
            `;
            document.body.appendChild(panel);
        }

        const handle = panel.querySelector('[data-draggable-handle]');
        const body = panel.querySelector('#stack-popup-body');
        const countLabel = panel.querySelector('#stack-popup-count');

        this._makeStackPopupDraggable(panel, handle);

        this._stackPopupElements = { panel, body, countLabel };
        return this._stackPopupElements;
    }

    static _positionStackPopupRelativeToBoard(panel) {
        if (!panel) {
            return;
        }

        const board = document.getElementById('game-board');
        if (!board) {
            return;
        }

        const padding = 16;
        const boardRect = board.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const panelHeight = panelRect.height || panel.offsetHeight || 0;
        const panelWidth = panelRect.width || panel.offsetWidth || 0;

        let top = boardRect.top + (boardRect.height / 2) - (panelHeight / 2);
        let left = boardRect.right - panelWidth - padding;

        top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));

        const minLeft = boardRect.left + padding;
        const maxLeft = window.innerWidth - panelWidth - padding;
        left = Math.max(minLeft, Math.min(left, maxLeft));

        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
    }

    static _makeStackPopupDraggable(panel, handle) {
        if (!panel || !handle || panel.dataset.draggableInit === 'true') {
            return;
        }

        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        const startDragging = (clientX, clientY) => {
            isDragging = true;
            panel.dataset.userMoved = 'true';
            panel.classList.add('stack-popup-dragging');
            const rect = panel.getBoundingClientRect();
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.transform = 'none';
        };

        const stopDragging = () => {
            if (!isDragging) {
                return;
            }
            isDragging = false;
            panel.classList.remove('stack-popup-dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };

        const onMouseMove = (event) => {
            if (!isDragging) {
                return;
            }
            this._positionStackPopup(panel, event.clientX - dragOffsetX, event.clientY - dragOffsetY);
        };

        const onMouseUp = () => {
            stopDragging();
        };

        const onTouchMove = (event) => {
            if (!isDragging) {
                return;
            }
            const touch = event.touches[0];
            if (!touch) {
                return;
            }
            this._positionStackPopup(panel, touch.clientX - dragOffsetX, touch.clientY - dragOffsetY);
        };

        const onTouchEnd = () => {
            stopDragging();
        };

        const onMouseDown = (event) => {
            if (event.button !== 0 || event.target.closest('button')) {
                return;
            }
            startDragging(event.clientX, event.clientY);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            event.preventDefault();
        };

        const onTouchStart = (event) => {
            const touch = event.touches[0];
            if (!touch || event.target.closest('button')) {
                return;
            }
            startDragging(touch.clientX, touch.clientY);
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
            event.preventDefault();
        };

        handle.addEventListener('mousedown', onMouseDown);
        handle.addEventListener('touchstart', onTouchStart, { passive: false });

        panel.dataset.draggableInit = 'true';
    }

    static _positionStackPopup(panel, left, top) {
        if (!panel) {
            return;
        }

        const padding = 16;
        const width = panel.offsetWidth;
        const height = panel.offsetHeight;
        const maxX = window.innerWidth - width - padding;
        const maxY = window.innerHeight - height - padding;

        const clampedLeft = Math.min(Math.max(left, padding), Math.max(maxX, padding));
        const clampedTop = Math.min(Math.max(top, padding), Math.max(maxY, padding));

        panel.style.left = `${clampedLeft}px`;
        panel.style.top = `${clampedTop}px`;
        panel.style.transform = 'none';
    }

    /**
     * Generate stack content HTML
     */
    static _generateStackContent(stack) {
        return `
            <div class="stack-container">
                <div class="stack-content"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, 'stack')">
                    ${stack.length > 0 ? 
                        stack.map((spell, index) => this._renderStackSpell(spell, index)).join('')
                        : this._renderEmptyStack()
                    }
                </div>
            </div>
        `;
    }

    /**
     * Render individual stack spell
     */
    static _renderStackSpell(card, index) {
        const cardName = card.name || 'Unknown Spell';
        const imageUrl = GameCards.getSafeImageUrl(card);
        const cardId = card.id || card.name;
        const isTargeted = card.targeted || false;
        const targetedClass = isTargeted ? ' targeted' : '';
        const uniqueId = card.unique_id;

        const escapedCardId = GameUtils.escapeJavaScript(cardId);
        const escapedCardName = GameUtils.escapeJavaScript(cardName);
        const escapedImageUrl = GameUtils.escapeJavaScript(imageUrl || '');
        
        return `
            <div class="stack-spell${targetedClass}" 
                 data-index="${index}"
                 data-card-id="${cardId}"
                 data-card-unique-id="${uniqueId}"
                 data-card-name="${escapedCardName}"
                 data-card-image="${escapedImageUrl}"
                 data-card-zone="stack"
                 data-stack-index="${index}"
                 oncontextmenu="GameCards.showCardContextMenu(event, this); return false;"
                 onclick="GameActions.performGameAction('resolve_stack', { card_id: '${escapedCardId}', unique_id: '${uniqueId}' }); event.stopPropagation();">
                
                <div class="stack-card-container">
                    ${imageUrl ? `
                        <img src="${imageUrl}" 
                             alt="${cardName}" 
                             class="stack-card-image"
                             style="opacity: 0; transition: opacity 0.3s ease;"
                             onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="stack-card-fallback" style="display: none;">
                        </div>
                    ` : `
                        <div class="stack-card-fallback">
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Render empty stack message
     */
    static _renderEmptyStack() {
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
    static _getPlayerIndices(gameState) {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        const players = gameState.players || [];
        const activePlayer = gameState.active_player || 0;
        
        let controlledIdx = currentSelectedPlayer === 'player2' ? 1 : 0;
        const opponentIdx = controlledIdx === 0 ? 1 : 0;
        
        return { controlledIdx, opponentIdx, players, activePlayer };
    }

    /**
     * Render opponent area
     */
    static _renderOpponentArea(opponent, opponentIdx, activePlayer) {
        const handSize = opponent?.hand?.length || 7;
        const isOpponentActiveTurn = activePlayer === opponentIdx;
        const activeTurnClass = isOpponentActiveTurn ? 'opponent-zone-active-turn' : '';
        
        return `
            <div class="arena-card rounded-lg mb-3 p-3 compact-zones ${activeTurnClass}">
                <div class="opponent-hand-zone space-x-1 overflow-x-auto py-1" data-card-count="${handSize}">
                    ${this.generateOpponentHand(handSize)}
                </div>

                ${this.generateBattlefieldLayout(opponent?.battlefield, true, opponentIdx)}
            </div>
        `;
    }

    /**
     * Render player area
     */
    static _renderPlayerArea(player, controlledIdx, activePlayer) {
        const handSize = player?.hand?.length || 0;
        const isPlayerActiveTurn = activePlayer === controlledIdx;
        const activeTurnClass = isPlayerActiveTurn ? 'player-zone-active-turn' : '';
        
        return `
            <div class="arena-card rounded-lg p-3 hand-zone ${activeTurnClass}">
                ${this.generateBattlefieldLayout(player?.battlefield, false, controlledIdx)}

                <div class="hand-zone-content zone-content" data-card-count="${handSize}"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, 'hand')">
                    ${this.generatePlayerHand(player?.hand || [], controlledIdx)}
                </div>
            </div>
        `;
    }

    /**
     * Preload card images for better performance
     */
    static _preloadCardImages(players) {
        // Implementation for preloading can be added here if needed
    }

    /**
     * Validate container element
     */
    static _validateContainer(container, containerName) {
        if (!container) {
            console.warn(`${containerName} not found`);
            return false;
        }
        return true;
    }

    /**
     * Validate game state
     */
    static _validateGameState(gameState) {
        if (!gameState) {
            console.warn('Game state not available');
            return false;
        }
        return true;
    }

    /**
     * Render error in container
     */
    static _renderError(container, title, message) {
        console.error(`${title}:`, message);
        container.innerHTML = this.generateErrorTemplate(title, message);
    }
}

// Backward compatibility exports
window.UIRenderers = UIRenderersTemplates;
window.UITemplates = UIRenderersTemplates;
window.UIGameInterface = UIRenderersTemplates;
window.UIRenderersTemplates = UIRenderersTemplates;
