/**
 * ManaForge Unified Renderers and Templates Module
 * Combines rendering logic and HTML template generation
 * Replaces ui-renderers.js + ui-templates.js + ui-game-interface.js (~445 lines → ~300 lines)
 */

class UIRenderersTemplates {
    static _revealPopupElements = new Map();
    // ===== MAIN RENDERING METHODS =====
    
    /**
     * Render role display
     */
    static renderRoleDisplay() {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        const roleDisplay = document.getElementById('current-role-display');
        const roleDescription = document.getElementById('role-description');
        const gameState = GameCore.getGameState() || {};
        const players = Array.isArray(gameState.players) ? gameState.players : [];
        
        if (!roleDisplay || !roleDescription) {
            console.warn('Role display elements not found');
            return;
        }
        
        const roleData = this._getRoleData();
        const role = roleData[currentSelectedPlayer] || roleData['player1'];
        let titleText = role.title;

        if (currentSelectedPlayer === 'player1' || currentSelectedPlayer === 'player2') {
            const playerIndex = currentSelectedPlayer === 'player1' ? 0 : 1;
            const fallback = this._getSeatFallbackName(playerIndex);
            const playerName = this._getPlayerDisplayName(players[playerIndex], fallback);
            const icon = currentSelectedPlayer === 'player1' ? '🛡️' : '🎯';
            titleText = `${icon} ${playerName}`;
        }

        roleDisplay.className = `px-4 py-3 rounded-lg border-2 mb-3 ${role.class}`;
        roleDisplay.textContent = titleText;
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
            const opponentName = this._getPlayerDisplayName(opponent, this._getSeatFallbackName(opponentIdx));
            const playerName = this._getPlayerDisplayName(player, this._getSeatFallbackName(controlledIdx));
            
            stackContainer.innerHTML = `
                <!-- Opponent Card Zones -->
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>${opponentName}
                    </h4>
                    ${this.generateCardZones(opponent, true, opponentIdx)}
                </div>

                <!-- Game Actions Panel -->
                <div id="action-panel" class="arena-card rounded-lg p-4 mb-3"></div>

                <!-- Player's Card Zones -->
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>${playerName}
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

            this._updateRevealOverlay(gameState);
            this._ensureCommanderPopups(gameState);
        } catch (error) {
            this._renderError(gameBoardContainer, 'Error Loading Game Board', error.message);
            this._updateRevealOverlay(null);
            this._ensureCommanderPopups(null);
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
                ${isActivePlayer ? this.generateActionButtons(gameState) : this.generateSpectatorView(gameState)}
            `;

            this._updateStackOverlay(stack, gameState);
            this._updateRevealOverlay(gameState);
            this._ensureCommanderPopups(gameState);
        } catch (error) {
            this._renderError(actionPanelContainer, 'Error', error.message);
            this._updateStackOverlay([], null);
            this._updateRevealOverlay(null);
            this._ensureCommanderPopups(null);
        }
    }

    // ===== TEMPLATE GENERATION METHODS =====
    
    /**
     * Generate combined card zones display
     */
    static generateCardZones(playerData, isOpponent = false, playerIndex = null) {
        const playerName = this._getPlayerDisplayName(playerData, isOpponent ? 'Opponent' : 'Player');
        const config = UIUtils.getZoneConfiguration(isOpponent, playerIndex, playerName);
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
    static generateActionButtons(gameStateParam = null) {
        const gameState = gameStateParam || GameCore.getGameState();
        const currentPhase = gameState?.phase || 'begin';
        const currentTurn = gameState?.turn || 1;
        const activePlayer = gameState?.active_player || 0;
        const players = Array.isArray(gameState?.players) ? gameState.players : [];
        const priorityPlayer = typeof gameState?.priority_player === 'number'
            ? gameState.priority_player
            : activePlayer;
        const stack = Array.isArray(gameState?.stack) ? gameState.stack : [];
        const phaseMode = String(gameState?.phase_mode || 'casual').toLowerCase();
        const phaseModeLabel = phaseMode === 'strict' ? 'Strict' : 'Casual';
        const combatState = gameState?.combat_state || {};
        const expectedCombatPlayer = combatState.expected_player || null;
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        let controlledPlayerIndex = null;

        if (currentSelectedPlayer === 'player1') {
            controlledPlayerIndex = 0;
        } else if (currentSelectedPlayer === 'player2') {
            controlledPlayerIndex = 1;
        }

        const passConfig = {
            passDisabled: true,
            passLabel: '⏭️ Pass Phase',
            passAction: 'pass_phase',
            passTitle: 'Pass current phase'
        };
        const activePlayerName = this._getPlayerDisplayName(
            players[activePlayer],
            this._getSeatFallbackName(activePlayer)
        );

        if (controlledPlayerIndex === null) {
            passConfig.passTitle = 'Select a player to perform actions';
        } else {
            const isStrictMode = phaseMode === 'strict';
            const hasStack = stack.length > 0;
            const isActivePlayer = controlledPlayerIndex === activePlayer;
            const isPriorityPlayer = controlledPlayerIndex === priorityPlayer;
            const opponentSeatIndex = controlledPlayerIndex === 0 ? 1 : 0;
            const opponentName = this._getPlayerDisplayName(
                players[opponentSeatIndex],
                this._getSeatFallbackName(opponentSeatIndex)
            );
            const controlledPlayerKey = controlledPlayerIndex === 0 ? 'player1' : 'player2';

            if (isStrictMode && hasStack) {
                if (isPriorityPlayer) {
                    passConfig.passDisabled = false;
                    passConfig.passAction = 'resolve_stack';
                    passConfig.passLabel = '🎯 Resolve';
                    passConfig.passTitle = 'Resolve the top spell on the stack';
                } else {
                    passConfig.passDisabled = true;
                    passConfig.passTitle = `Waiting for ${opponentName} to resolve the stack`;
                }
            } else {
                // Casual mode or no stack in strict mode
                if (hasStack) {
                    // There's a stack, show Resolve button
                    passConfig.passDisabled = !isActivePlayer;
                    passConfig.passAction = 'resolve_stack';
                    passConfig.passLabel = '🎯 Resolve';
                    passConfig.passTitle = passConfig.passDisabled
                        ? `Waiting for ${activePlayerName} to resolve the stack`
                        : 'Resolve the top spell on the stack';
                } else {
                    // No stack, show Pass Phase button
                    passConfig.passDisabled = !isActivePlayer;
                    passConfig.passAction = 'pass_phase';
                    passConfig.passLabel = '⏭️ Pass Phase';
                    passConfig.passTitle = passConfig.passDisabled
                        ? `Waiting for ${activePlayerName} to pass the phase`
                        : 'Pass current phase';

                    if (
                        currentPhase === 'block' &&
                        expectedCombatPlayer &&
                        expectedCombatPlayer !== controlledPlayerKey
                    ) {
                        passConfig.passDisabled = true;
                        passConfig.passTitle = `Waiting for ${opponentName} to confirm blockers`;
                    }
                }
            }
        }
        
        return `
            <div>
                ${this._generateGameInfoSection(currentTurn, activePlayer, players, priorityPlayer)}
                ${this._generateGamePhases(currentPhase)}
                <div class="text-center text-xs text-arena-muted mb-3">
                    Phase Mode: ${phaseModeLabel}
                </div>
                ${this._generateActionButtonsSection(passConfig)}
            </div>
        `;
    }

    /**
     * Generate spectator view
     */
    static generateSpectatorView(gameStateParam = null) {
        const gameState = gameStateParam || GameCore.getGameState() || {};
        const currentPhase = gameState.phase || 'begin';
        const currentTurn = typeof gameState.turn === 'number' ? gameState.turn : 1;
        const activePlayer = typeof gameState.active_player === 'number'
            ? gameState.active_player
            : 0;
        const priorityPlayer = typeof gameState.priority_player === 'number'
            ? gameState.priority_player
            : activePlayer;
        const players = Array.isArray(gameState.players) ? gameState.players : [];

        return `
            <div>
                ${this._generateGameInfoSection(currentTurn, activePlayer, players, priorityPlayer)}
                ${this._generateGamePhases(currentPhase, { readOnly: true })}
                <div class="text-center py-6 border-t border-arena-accent/10">
                    <div class="text-3xl mb-2 leading-none">👁️</div>
                    <div class="text-arena-accent font-semibold mb-1">Spectator Mode</div>
                    <p class="text-arena-text-dim text-sm">Game controls are disabled while you are watching.</p>
                </div>
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
            return GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, zoneName, isOpponent, null, playerId);
        }).join('');

        return `
            <div class="battlefield-zone ${zoneName}-zone compact-zones"
                data-battlefield-zone="${zoneName}"
                ondragover="UIZonesManager.handleZoneDragOver(event)"
                ondragleave="UIZonesManager.handleZoneDragLeave(event)"
                ondrop="UIZonesManager.handleZoneDrop(event, '${zoneName}')">
                <div class="${zoneName}-zone-content zone-content" data-card-count="${cardCount}">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Generate the battlefield layout with its subzones
     */
    static generateBattlefieldLayout(cards, isOpponent, playerId = null) {
        const layoutClasses = ['battlefield-layout'];
        if (isOpponent) {
            layoutClasses.push('battlefield-layout-opponent');
        }

        return `
            <div class="${layoutClasses.join(' ')}">
                ${this.generateBattlefieldZone(cards, 'lands', isOpponent, playerId)}
                ${this.generateBattlefieldZone(cards, 'creatures', isOpponent, playerId)}
                ${this.generateBattlefieldZone(cards, 'support', isOpponent, playerId)}
            </div>
        `;
    }

    /**
     * Generate player's hand
     */
    static generatePlayerHand(hand = [], playerId = null, options = {}) {
        const cards = Array.isArray(hand) ? hand : [];
        if (!cards.length) {
            return '<div class="text-arena-text-dim text-center py-4">No cards in hand</div>';
        }

        const { isOpponent = false, readOnly = null } = options;
        const isSpectator =
            typeof GameCore !== 'undefined' &&
            typeof GameCore.getSelectedPlayer === 'function' &&
            GameCore.getSelectedPlayer() === 'spectator';
        const forceReadOnly = readOnly === null ? isSpectator : readOnly;

        return cards.map((card, index) =>
            GameCards.renderCardWithLoadingState(
                card,
                UIConfig.CSS_CLASSES.card.mini,
                false,
                'hand',
                isOpponent,
                index,
                playerId,
                { readOnly: forceReadOnly }
            )
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
        const phaseDisplay = UIConfig.getPhaseDisplayName(currentPhase);
        const players = Array.isArray(gameState.players) ? gameState.players : [];
        const priorityIndex = typeof gameState.priority_player === 'number' ? gameState.priority_player : 0;
        const priorityName = this._getPlayerDisplayName(players[priorityIndex], this._getSeatFallbackName(priorityIndex));

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
                    <div class="text-lg font-bold">${priorityName}</div>
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
    static getZoneConfiguration(isOpponent, playerIndex, playerName = null) { return UIUtils.getZoneConfiguration(isOpponent, playerIndex, playerName); }

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
        const safePlayerData = playerData || {};
        const {
            library = [],
            deck = [],
            graveyard = [],
            exile = [],
            life = 20
        } = safePlayerData;
        
        const deckData = library.length > 0 ? library : deck;

        return {
            life: this.generateLifeZone(life, playerId, titlePrefix),
            deck: this.generateDeckZone(deckData, isOpponent),
            graveyard: this.generateGraveyardZone(graveyard, isOpponent),
            exile: this.generateExileZone(exile, isOpponent)
        };
    }

    static _ensureCommanderPopups(gameState) {
        if (typeof UIZonesManager === 'undefined' || !UIZonesManager) {
            return;
        }
        try {
            UIZonesManager.showCommanderPopups(gameState);
        } catch (error) {
            console.error('Failed to update commander popups:', error);
        }
    }

    /**
     * Get role data configuration
     */
    static _getRoleData() {
        return {
            'player1': { class: 'bg-green-500/20 border-green-500/50 text-green-400', title: 'Player 1', description: 'You control the first player position' },
            'player2': { class: 'bg-red-500/20 border-red-500/50 text-red-400', title: 'Player 2', description: 'You control the second player position' },
            'spectator': { class: 'bg-purple-500/20 border-purple-500/50 text-purple-400', title: '👁️ Spectator', description: 'You are watching the battle unfold' }
        };
    }

    /**
     * Generate game info section
     */
    static _generateGameInfoSection(currentTurn, activePlayer, players = [], priorityIndex = null) {
        const activePlayerName = this._getPlayerDisplayName(
            players[activePlayer],
            this._getSeatFallbackName(activePlayer)
        );
        const resolvedPriorityIndex = priorityIndex === null ? activePlayer : priorityIndex;
        const priorityName = this._getPlayerDisplayName(
            players[resolvedPriorityIndex],
            this._getSeatFallbackName(resolvedPriorityIndex)
        );
        
        return `
            <div class="grid grid-cols-3 gap-2 mb-4">
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
                <div class="text-center">
                    <div class="bg-purple-500/20 rounded-lg p-3 border border-purple-500/30">
                        <div class="text-purple-300 font-semibold text-sm">Priority</div>
                        <div class="text-lg font-bold text-arena-accent">${priorityName}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate game phases indicator
     */
    static _generateGamePhases(currentPhase, options = {}) {
        const {
            readOnly = false,
        } = options;

        const phases = [
            { id: 'begin', name: 'Begin', icon: '🔄', type: 'phase' },
            { id: 'main1', name: 'Main 1', icon: '🎯', type: 'phase' },
            { id: 'attack', name: 'Attack', icon: '⚔️', type: 'phase' },
            { id: 'block', name: 'Block', icon: '🛡️', type: 'phase' },
            { id: 'damage', name: 'Damage', icon: '💥', type: 'phase' },
            { id: 'main2', name: 'Main 2', icon: '✨', type: 'phase' },
            { id: 'end', name: 'End', icon: '🏁', type: 'phase' }
        ];

        const normalizedPhase = currentPhase || 'begin';
        const activeIndex = Math.max(
            phases.findIndex(phase => phase.id === normalizedPhase),
            0
        );

        const itemTemplate = phases.map((phase, index) => {
            const isUnderlyingCurrent = normalizedPhase === phase.id;
            const timelineState = index < activeIndex
                ? 'completed'
                : index === activeIndex
                    ? 'current'
                    : 'upcoming';

            let stateClasses = '';
            if (timelineState === 'current') {
                stateClasses = 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 shadow';
            } else if (timelineState === 'completed') {
                stateClasses = readOnly
                    ? 'text-green-300 border border-green-500/20'
                    : 'text-green-200 border border-green-500/30';
            } else {
                stateClasses = readOnly
                    ? 'text-arena-text-dim border border-transparent'
                    : 'text-arena-text-dim border border-transparent';
            }

            const isInteractive = !readOnly && !isUnderlyingCurrent;
            const onClickAttr = isInteractive
                ? `onclick="GameActions.changePhase('${phase.id}')"`
                : '';

            let interactionClasses = isInteractive ? 'cursor-pointer' : 'cursor-default';
            if (isInteractive) {
                interactionClasses += timelineState === 'completed'
                    ? ' hover:border-green-400/50 hover:text-green-100'
                    : ' hover:text-arena-text hover:border-yellow-500/30';
            }

            const titleText = `${phase.name} Phase`;

            return `
                <div class="text-center py-2 px-1 rounded transition-all duration-200 ${stateClasses} ${interactionClasses}"
                    title="${titleText}"
                    ${onClickAttr}>
                    <div class="text-lg mb-1 leading-none">${phase.icon}</div>
                    <div class="text-xs font-medium leading-tight">${phase.name}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="mb-4 bg-arena-surface/30 border border-arena-accent/20 rounded-lg p-3">
                <div class="grid grid-cols-7 gap-1">
                    ${itemTemplate}
                </div>
            </div>
        `;
    }

    /**
     * Generate action buttons section
     */
    static _generateActionButtonsSection(config = {}) {
        const {
            passDisabled = false,
            passLabel = '⏭️ Pass Phase',
            passAction = 'pass_phase',
            passTitle = 'Pass current phase'
        } = config;

        const gameState = GameCore.getGameState();
        const currentPhase = gameState?.phase || 'begin';
        
        // Show combat-specific button during the attack or block phases
        let finalPassLabel = passLabel;
        let finalPassAction = passAction;
        let finalPassTitle = passTitle;
        let finalPassDisabled = passDisabled;
        
        if (['attack', 'block'].includes(currentPhase) && typeof GameCombat !== 'undefined') {
            const combatConfig = GameCombat.getCombatButtonConfig();
            if (combatConfig) {
                finalPassLabel = combatConfig.label;
                finalPassTitle = combatConfig.title;
                finalPassDisabled = !combatConfig.enabled;
                
                // When clicking the button in combat, it should trigger the combat action
                if (combatConfig.action === 'declare_attackers') {
                    finalPassAction = 'GameCombat.confirmAttackers()';
                } else if (combatConfig.action === 'declare_blockers') {
                    finalPassAction = 'GameCombat.confirmBlockers()';
                }
            }
        }

        const passButtonClasses = UIConfig.CSS_CLASSES.button.passPhase
            || UIConfig.CSS_CLASSES.button.primary;

        let passPhaseBtn;
        if (finalPassAction.startsWith('GameCombat.')) {
            // Direct function call for combat actions
            const funcName = finalPassAction.replace('GameCombat.', '').replace('()', '');
            passPhaseBtn = UIUtils.generateButton(
                `GameCombat.${funcName}()`,
                passButtonClasses,
                finalPassTitle,
                finalPassLabel,
                finalPassDisabled
            );
        } else {
            // Regular game action
            passPhaseBtn = UIUtils.generateButton(
                `GameActions.performGameAction('${finalPassAction}')`,
                passButtonClasses,
                finalPassTitle,
                finalPassLabel,
                finalPassDisabled
            );
        }

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
    static _updateStackOverlay(stack, gameState = null) {
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
        body.innerHTML = this._generateStackContent(stack, gameState);
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
    static _generateStackContent(stack, gameState = null) {
        return `
            <div class="stack-container">
                <div class="stack-content"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, 'stack')">
                    ${stack.length > 0 ? 
                        stack.map((spell, index) => this._renderStackSpell(spell, index, gameState)).join('')
                        : this._renderEmptyStack()
                    }
                </div>
            </div>
        `;
    }

    /**
     * Render individual stack spell
     */
    static _renderStackSpell(card, index, gameState = null) {
        const cardName = card.name || 'Unknown Spell';
        const imageUrl = GameCards.getSafeImageUrl(card);
        const cardId = card.id || card.name;
        const isTargeted = card.targeted || false;
        const targetedClass = isTargeted ? ' targeted' : '';
        const uniqueId = card.unique_id;

        const escapedCardId = GameUtils.escapeJavaScript(cardId);
        const escapedCardName = GameUtils.escapeJavaScript(cardName);
        const escapedImageUrl = GameUtils.escapeJavaScript(imageUrl || '');
        
        // Determine if the spell should be clickable
        let isClickable = true;
        let clickHandler = `GameActions.performGameAction('resolve_stack', { card_id: '${escapedCardId}', unique_id: '${uniqueId}' }); event.stopPropagation();`;
        
        if (gameState) {
            const phaseMode = gameState.phase_mode || 'normal';
            const isStrictMode = phaseMode === 'strict';
            const currentSelectedPlayer = GameCore.getSelectedPlayer();
            
            if (isStrictMode && currentSelectedPlayer !== 'spectator') {
                // In strict mode, determine controlled player index
                let controlledPlayerIndex = null;
                const players = gameState.players || [];
                
                for (let i = 0; i < players.length; i++) {
                    if (players[i]?.id === currentSelectedPlayer) {
                        controlledPlayerIndex = i;
                        break;
                    }
                }
                
                // Check if the current player is the owner of the spell
                const spellOwnerId = card.owner_id;
                if (spellOwnerId === currentSelectedPlayer) {
                    // Player cast this spell, they should NOT be able to click it
                    isClickable = false;
                    clickHandler = 'event.stopPropagation();';
                }
            }
        }
        
        return `
            <div class="stack-spell${targetedClass}${isClickable ? '' : ' not-clickable'}" 
                 data-index="${index}"
                 data-card-id="${cardId}"
                 data-card-unique-id="${uniqueId}"
                 data-card-name="${escapedCardName}"
                 data-card-image="${escapedImageUrl}"
                 data-card-zone="stack"
                 data-stack-index="${index}"
                 oncontextmenu="GameCards.showCardContextMenu(event, this); return false;"
                 onclick="${clickHandler}">
                
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

    static _updateRevealOverlay(gameState) {
        if (!this._revealPopupElements) {
            this._revealPopupElements = new Map();
        }

        const players = Array.isArray(gameState?.players) ? gameState.players : [];
        const seen = new Set();
        const selectedPlayer = GameCore.getSelectedPlayer();

        players.forEach((player, index) => {
            const playerId = player?.id || `player${index + 1}`;
            const playerName = player?.name || `Player ${index + 1}`;
            const revealCards = Array.isArray(player?.reveal_zone) ? player.reveal_zone : [];
            const elements = this._getRevealPopupElements(playerId, playerName);
            if (!elements) {
                return;
            }

            seen.add(playerId);

            const isOpponent = selectedPlayer === 'spectator'
                ? false
                : (selectedPlayer !== playerId);
            const isControlled = selectedPlayer !== 'spectator' && !isOpponent;

            if (!revealCards.length) {
                elements.panel.classList.add('hidden');
                elements.panel.setAttribute('aria-hidden', 'true');
                delete elements.panel.dataset.userMoved;
                return;
            }

            elements.body.innerHTML = this._generateRevealContent(revealCards, isOpponent, playerId);
            elements.countLabel.textContent = String(revealCards.length);
            elements.titleLabel.textContent = `Reveal - ${playerName}`;
            elements.panel.classList.remove('hidden');
            elements.panel.setAttribute('aria-hidden', 'false');

            const computedWidth = this._calculateRevealPopupWidth(revealCards.length);
            if (computedWidth) {
                elements.panel.style.width = `${computedWidth}px`;
            }

            this._applyPopupSearch(elements.panel);

            if (elements.panel.dataset.userMoved !== 'true') {
                this._positionRevealPopup(elements.panel, index, isControlled);
            }
        });

        this._revealPopupElements.forEach((elements, playerId) => {
            if (!seen.has(playerId)) {
                elements.panel.classList.add('hidden');
                elements.panel.setAttribute('aria-hidden', 'true');
                delete elements.panel.dataset.userMoved;
            }
        });
    }

    static _calculateRevealPopupWidth(cardCount) {
        const totalCards = Number(cardCount) || 0;
        if (totalCards <= 0) {
            return 320;
        }

        const visibleCount = Math.min(totalCards, 8);
        const baseCardWidth = 160;
        const gap = 12;
        const padding = 64;

        return Math.max(
            280,
            Math.min(
                window.innerWidth * 0.9,
                padding + (visibleCount * baseCardWidth) + Math.max(0, visibleCount - 1) * gap
            )
        );
    }

    static _ensurePopupSearchElements(panel) {
        if (!panel) {
            return;
        }

        const body = panel.querySelector('.stack-popup-body');
        if (!body) {
            return;
        }

        if (!panel.querySelector('.popup-search-container')) {
            const searchContainer = document.createElement('div');
            searchContainer.className = 'popup-search-container';
            searchContainer.innerHTML = `
                <input type="search" class="popup-card-search-input" placeholder="Search cards" aria-label="Search cards">
            `;
            panel.insertBefore(searchContainer, body);
        }

        if (!panel.querySelector('.popup-search-empty')) {
            const emptyState = document.createElement('div');
            emptyState.className = 'popup-search-empty hidden';
            emptyState.textContent = 'No cards match your search';
            panel.appendChild(emptyState);
        }
    }

    static _initializePopupSearch(panel) {
        if (!panel || panel.dataset.popupSearchInit === 'true') {
            return;
        }

        this._ensurePopupSearchElements(panel);

        const input = panel.querySelector('.popup-card-search-input');
        if (!input) {
            return;
        }

        input.addEventListener('input', (event) => {
            const query = event.target.value || '';
            panel.dataset.currentSearchQuery = query;
            UIRenderersTemplates._filterPopupCards(panel, query);
        });

        panel.dataset.popupSearchInit = 'true';
    }

    static _applyPopupSearch(panel) {
        if (!panel) {
            return;
        }

        const query = panel.dataset.currentSearchQuery || '';
        const input = panel.querySelector('.popup-card-search-input');
        if (input && input.value !== query) {
            input.value = query;
        }

        this._filterPopupCards(panel, query);
    }

    static _filterPopupCards(panel, query) {
        if (!panel) {
            return;
        }

        const normalized = (query || '').trim().toLowerCase();
        const list = panel.querySelector('.reveal-card-list');
        const emptyState = panel.querySelector('.popup-search-empty');

        if (!list) {
            if (emptyState) {
                emptyState.classList.add('hidden');
            }
            return;
        }

        let visibleCount = 0;
        const cards = list.querySelectorAll('[data-card-id]');
        cards.forEach((card) => {
            const searchData = (card.dataset.cardSearch || `${card.dataset.cardName || ''} ${card.dataset.cardZone || ''}`).toLowerCase();
            const isMatch = !normalized || searchData.includes(normalized);
            if (isMatch) {
                card.classList.remove('popup-card-hidden');
                visibleCount += 1;
            } else {
                card.classList.add('popup-card-hidden');
            }
        });

        if (emptyState) {
            if (normalized && visibleCount === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
            }
        }
    }

    static _getRevealPopupElements(playerId, playerName) {
        if (!playerId) {
            return null;
        }

        if (!this._revealPopupElements) {
            this._revealPopupElements = new Map();
        }

        if (this._revealPopupElements.has(playerId)) {
            const existing = this._revealPopupElements.get(playerId);
            if (existing?.titleLabel) {
                existing.titleLabel.textContent = `Reveal - ${playerName}`;
            }
            this._ensurePopupSearchElements(existing?.panel);
            this._initializePopupSearch(existing?.panel);
            return existing;
        }

        const safeName = GameUtils.escapeHtml(playerName || 'Player');
        const panel = document.createElement('div');
        panel.id = `reveal-popup-${playerId}`;
        panel.className = 'stack-popup reveal-popup hidden';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', `Reveal - ${playerName}`);
        panel.setAttribute('aria-hidden', 'true');
        panel.dataset.playerId = playerId;
        panel.innerHTML = `
            <div class="stack-popup-header reveal-popup-header" data-draggable-handle>
                <div class="stack-popup-title reveal-popup-title">
                    <span class="stack-popup-icon reveal-popup-icon">👁️</span>
                    <span class="stack-popup-label reveal-popup-label">Reveal - ${safeName}</span>
                    <span class="stack-popup-count reveal-popup-count" id="reveal-popup-count-${playerId}">0</span>
                </div>
            </div>
            <div class="popup-search-container">
                <input type="search" class="popup-card-search-input" placeholder="Search cards" aria-label="Search revealed cards">
            </div>
            <div class="stack-popup-body reveal-popup-body" id="reveal-popup-body-${playerId}"></div>
            <div class="popup-search-empty hidden">No cards match your search</div>
        `;
        document.body.appendChild(panel);

        const handle = panel.querySelector('[data-draggable-handle]');
        const body = panel.querySelector(`#reveal-popup-body-${playerId}`);
        const countLabel = panel.querySelector(`#reveal-popup-count-${playerId}`);
        const titleLabel = panel.querySelector('.reveal-popup-label');

        this._makeStackPopupDraggable(panel, handle);
        this._initializePopupSearch(panel);

        const elements = { panel, body, countLabel, titleLabel };
        this._revealPopupElements.set(playerId, elements);
        return elements;
    }

    static _generateRevealContent(cards, isOpponent, playerId) {
        const allowDrop = !isOpponent;
        const listAttributes = allowDrop
            ? `data-zone-context="reveal" data-zone-owner="${playerId}" ondragover="UIZonesManager.handlePopupDragOver(event)" ondragleave="UIZonesManager.handlePopupDragLeave(event)" ondrop="UIZonesManager.handlePopupDrop(event, 'reveal')"`
            : `data-zone-context="reveal" data-zone-owner="${playerId}"`;

        if (!Array.isArray(cards) || cards.length === 0) {
            const emptyState = '<div class="reveal-empty">No cards revealed</div>';
            if (!allowDrop) {
                return emptyState;
            }
            return `
                <div class="reveal-card-container">
                    <div class="reveal-card-list zone-card-list zone-card-list-empty" ${listAttributes} data-card-count="0">
                        ${emptyState}
                    </div>
                </div>
            `;
        }

        const cardsHtml = cards.map((card, index) =>
            GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, 'reveal', isOpponent, index, playerId)
        ).join('');

        return `
            <div class="reveal-card-container">
                <div class="reveal-card-list zone-card-list" ${listAttributes} data-card-count="${cards.length}">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    static _positionRevealPopup(panel, index, isControlled) {
        if (!panel) {
            return;
        }

        const board = document.getElementById('game-board');
        if (!board) {
            return;
        }

        const padding = 16;
        const offset = 24;
        const boardRect = board.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const panelHeight = panelRect.height || panel.offsetHeight || 0;
        const panelWidth = panelRect.width || panel.offsetWidth || 0;

        let top;
        let left;

        if (isControlled) {
            top = boardRect.bottom - panelHeight - padding;
            left = boardRect.right + padding;
        } else {
            top = boardRect.top + padding + (index * (panelHeight + offset));
            left = boardRect.right + padding;
        }

        top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));
        left = Math.max(padding, Math.min(left, window.innerWidth - panelWidth - padding));

        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
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

    static _getSeatFallbackName(index) {
        if (index === 0) return 'Player 1';
        if (index === 1) return 'Player 2';
        return 'Player';
    }

    static _getPlayerDisplayName(playerData, fallback = 'Player') {
        const rawName = typeof playerData?.name === 'string' ? playerData.name.trim() : '';
        return rawName || fallback;
    }


    /**
     * Render opponent area
     */
    static _renderOpponentArea(opponent, opponentIdx, activePlayer) {
        const actualHandSize = Array.isArray(opponent?.hand) ? opponent.hand.length : 0;
        const placeholderHandSize = actualHandSize || 7;
        const isOpponentActiveTurn = activePlayer === opponentIdx;
        const activeTurnClass = isOpponentActiveTurn ? 'opponent-zone-active-turn' : '';
        const isSpectatorView =
            typeof GameCore !== 'undefined' &&
            typeof GameCore.getSelectedPlayer === 'function' &&
            GameCore.getSelectedPlayer() === 'spectator';
        const opponentHandHtml = isSpectatorView
            ? this.generatePlayerHand(opponent?.hand || [], opponentIdx, {
                isOpponent: true,
                readOnly: true
            })
            : this.generateOpponentHand(placeholderHandSize);
        const handDataCount = isSpectatorView ? actualHandSize : placeholderHandSize;
        
        return `
            <div class="arena-card rounded-lg mb-3 p-3 compact-zones ${activeTurnClass}">
                <div class="opponent-hand-zone space-x-1 overflow-x-auto py-1" data-card-count="${handDataCount}">
                    ${opponentHandHtml}
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
