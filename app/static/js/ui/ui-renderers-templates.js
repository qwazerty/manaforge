/**
 * ManaForge Unified Renderers and Templates Module
 * Combines rendering logic and HTML template generation
 * Replaces ui-renderers.js + ui-templates.js + ui-game-interface.js (~445 lines → ~300 lines)
 */

class UIRenderersTemplates {
    static _revealPopupElements = new Map();
    static _actionPanelComponent = null;
    static _actionPanelTarget = null;
    static _stackPopupComponent = null;
    static _stackPopupTarget = null;
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
            UIZonesManager.hydrateSvelteZones();
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
            gameBoardContainer.dataset.boardHydrated = 'true';

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

    static updateGameBoard(gameState, previousGameState = null) {
        const gameBoardContainer = document.getElementById('game-board');
        if (!this._validateContainer(gameBoardContainer, 'Game board container')) return false;
        if (!this._validateGameState(gameState)) return false;
        if (gameBoardContainer.dataset.boardHydrated !== 'true') {
            return false;
        }

        try {
            const { controlledIdx, opponentIdx, players, activePlayer } = this._getPlayerIndices(gameState);
            const previousPlayers = Array.isArray(previousGameState?.players) ? previousGameState.players : [];

            this._updatePlayerAreaBattlefield(
                players[controlledIdx],
                previousPlayers[controlledIdx],
                controlledIdx,
                false
            );
            this._updatePlayerAreaBattlefield(
                players[opponentIdx],
                previousPlayers[opponentIdx],
                opponentIdx,
                true
            );
            this._updatePlayerHandZone(players[controlledIdx], previousPlayers[controlledIdx], controlledIdx);
            this._updateOpponentHandZone(players[opponentIdx], previousPlayers[opponentIdx], opponentIdx);
            this._updatePlayerZoneActiveState('player', activePlayer === controlledIdx);
            this._updatePlayerZoneActiveState('opponent', activePlayer === opponentIdx);

            this._updateRevealOverlay(gameState);
            this._ensureCommanderPopups(gameState);
            return true;
        } catch (error) {
            console.error('Incremental game board update failed', error);
            return false;
        }
    }

    /**
     * Render action panel
     */
    static renderActionPanel() {
        const gameState = GameCore.getGameState();
        const actionPanelContainer = document.getElementById('action-panel');
        
        if (!this._validateContainer(actionPanelContainer, 'Action panel container')) {
            this._destroyActionPanelComponent();
            return;
        }
        if (!this._validateGameState(gameState)) {
            this._destroyActionPanelComponent();
            return;
        }

        try {
            const stack = Array.isArray(gameState.stack) ? gameState.stack : [];
            const panelProps = this._buildActionPanelProps(gameState);

            this._renderActionPanelSvelte(actionPanelContainer, panelProps);

            this._updateStackOverlay(stack, gameState);
            this._updateRevealOverlay(gameState);
            this._ensureCommanderPopups(gameState);
        } catch (error) {
            this._destroyActionPanelComponent();
            this._renderError(actionPanelContainer, 'Error', error.message);
            this._updateStackOverlay([], null);
            this._updateRevealOverlay(null);
            this._ensureCommanderPopups(null);
        }
    }

    static _renderActionPanelSvelte(container, props) {
        if (typeof ActionPanelComponent === 'undefined') {
            container.innerHTML = `
                <div class="text-center py-4 text-arena-text-dim text-sm">
                    Unable to load action panel
                </div>
            `;
            return;
        }

        if (!this._actionPanelComponent || this._actionPanelTarget !== container) {
            this._destroyActionPanelComponent();
            container.innerHTML = '';
            this._actionPanelComponent = new ActionPanelComponent.default({
                target: container,
                props
            });
            this._actionPanelTarget = container;
        } else {
            this._actionPanelComponent.$set(props);
        }
    }

    static _destroyActionPanelComponent() {
        if (this._actionPanelComponent) {
            this._actionPanelComponent.$destroy();
            this._actionPanelComponent = null;
            this._actionPanelTarget = null;
        }
    }

    static _buildActionPanelProps(gameState) {
        const selectedPlayer = GameCore.getSelectedPlayer();
        const spectatorMode = selectedPlayer === 'spectator';
        const players = Array.isArray(gameState?.players) ? gameState.players : [];
        const currentPhase = gameState?.phase || 'begin';
        const currentTurn = typeof gameState?.turn === 'number' ? gameState.turn : 1;
        const activePlayerIndex = typeof gameState?.active_player === 'number'
            ? gameState.active_player
            : 0;
        const priorityPlayerIndex = typeof gameState?.priority_player === 'number'
            ? gameState.priority_player
            : activePlayerIndex;
        const phaseMode = String(gameState?.phase_mode || 'strict').toLowerCase();
        const phaseModeLabel = phaseMode === 'strict' ? 'Strict' : 'Casual';

        const activePlayerName = this._getPlayerDisplayName(
            players[activePlayerIndex],
            this._getSeatFallbackName(activePlayerIndex)
        );
        const priorityPlayerName = this._getPlayerDisplayName(
            players[priorityPlayerIndex],
            this._getSeatFallbackName(priorityPlayerIndex)
        );

        const props = {
            headerIcon: '⚡',
            headerTitle: 'Game Actions',
            spectatorMode,
            gameInfo: {
                turn: currentTurn,
                active: activePlayerName,
                priority: priorityPlayerName
            },
            phases: Array.isArray(UIConfig?.GAME_PHASES)
                ? UIConfig.GAME_PHASES.map((phase) => ({ ...phase }))
                : [],
            currentPhase,
            readOnlyPhases: spectatorMode,
            phaseModeLabel,
            phaseClickHandler: this._createPhaseClickHandler()
        };

        if (spectatorMode) {
            props.spectatorInfo = {
                icon: '👁️',
                title: 'Spectator Mode',
                message: 'Game controls are disabled while you are watching.'
            };
            return props;
        }

        const controlledPlayerIndex = selectedPlayer === 'player1'
            ? 0
            : selectedPlayer === 'player2'
                ? 1
                : null;

        props.passButton = this._buildPassButtonConfig({
            gameState,
            players,
            controlledPlayerIndex,
            activePlayerIndex,
            priorityPlayerIndex
        });
        props.searchButton = this._buildSearchButtonConfig();
        props.quickButtons = this._buildQuickActionButtons();
        return props;
    }

    static _createPhaseClickHandler() {
        return (phaseId) => {
            if (!phaseId || typeof GameActions === 'undefined' || typeof GameActions.changePhase !== 'function') {
                return;
            }
            GameActions.changePhase(phaseId);
        };
    }

    static _buildPassButtonConfig(options) {
        const {
            gameState,
            players,
            controlledPlayerIndex,
            activePlayerIndex,
            priorityPlayerIndex
        } = options;

        const stack = Array.isArray(gameState?.stack) ? gameState.stack : [];
        const phaseMode = String(gameState?.phase_mode || 'strict').toLowerCase();
        const currentPhase = gameState?.phase || 'begin';
        const combatState = gameState?.combat_state || {};
        const expectedCombatPlayer = combatState.expected_player || null;
        const passClasses = (UIConfig?.CSS_CLASSES?.button?.passPhase)
            || (UIConfig?.CSS_CLASSES?.button?.primary)
            || '';

        let passDisabled = true;
        let passLabel = '⏭️ Pass Phase';
        let passAction = 'pass_phase';
        let passTitle = 'Pass current phase';

        const activePlayerName = this._getPlayerDisplayName(
            players[activePlayerIndex],
            this._getSeatFallbackName(activePlayerIndex)
        );

        if (controlledPlayerIndex === null) {
            passTitle = 'Select a player to perform actions';
        } else {
            const isStrictMode = phaseMode === 'strict';
            const hasStack = stack.length > 0;
            const isActivePlayer = controlledPlayerIndex === activePlayerIndex;
            const isPriorityPlayer = controlledPlayerIndex === priorityPlayerIndex;
            const opponentSeatIndex = controlledPlayerIndex === 0 ? 1 : 0;
            const opponentName = this._getPlayerDisplayName(
                players[opponentSeatIndex],
                this._getSeatFallbackName(opponentSeatIndex)
            );
            const controlledPlayerKey = controlledPlayerIndex === 0 ? 'player1' : 'player2';

            if (isStrictMode && hasStack) {
                if (isPriorityPlayer) {
                    passDisabled = false;
                    passAction = 'resolve_stack';
                    passLabel = '🎯 Resolve';
                    passTitle = 'Resolve the top spell on the stack';
                } else {
                    passDisabled = true;
                    passTitle = `Waiting for ${opponentName} to resolve the stack`;
                }
            } else if (hasStack) {
                passDisabled = !isActivePlayer;
                passAction = 'resolve_stack';
                passLabel = '🎯 Resolve';
                passTitle = passDisabled
                    ? `Waiting for ${activePlayerName} to resolve the stack`
                    : 'Resolve the top spell on the stack';
            } else {
                passDisabled = !isActivePlayer;
                passAction = 'pass_phase';
                passLabel = '⏭️ Pass Phase';
                passTitle = passDisabled
                    ? `Waiting for ${activePlayerName} to pass the phase`
                    : 'Pass current phase';

                if (
                    currentPhase === 'block' &&
                    expectedCombatPlayer &&
                    expectedCombatPlayer !== controlledPlayerKey
                ) {
                    passDisabled = true;
                    passTitle = `Waiting for ${opponentName} to confirm blockers`;
                }
            }
        }

        let onClick = this._createGameActionHandler(passAction);

        if (
            ['attack', 'block'].includes(currentPhase) &&
            typeof GameCombat !== 'undefined' &&
            typeof GameCombat.getCombatButtonConfig === 'function'
        ) {
            const combatConfig = GameCombat.getCombatButtonConfig();
            if (combatConfig) {
                passLabel = combatConfig.label;
                passTitle = combatConfig.title;
                passDisabled = !combatConfig.enabled;

                if (combatConfig.action === 'declare_attackers' &&
                    typeof GameCombat.confirmAttackers === 'function') {
                    onClick = () => {
                        if (!passDisabled) {
                            GameCombat.confirmAttackers();
                        }
                    };
                } else if (combatConfig.action === 'declare_blockers' &&
                    typeof GameCombat.confirmBlockers === 'function') {
                    onClick = () => {
                        if (!passDisabled) {
                            GameCombat.confirmBlockers();
                        }
                    };
                } else if (combatConfig.action) {
                    onClick = this._createGameActionHandler(combatConfig.action);
                }
            }
        }

        return {
            label: passLabel,
            title: passTitle,
            disabled: passDisabled,
            className: passClasses,
            onClick
        };
    }

    static _buildSearchButtonConfig() {
        const className = `${UIConfig?.CSS_CLASSES?.button?.secondary || ''} w-full`;
        return {
            label: '🔍 Search cards',
            title: 'Search for a card to add to the battlefield',
            disabled: false,
            className,
            onClick: () => {
                if (typeof window !== 'undefined' && typeof window.showCardSearch === 'function') {
                    window.showCardSearch('battlefield');
                }
            }
        };
    }

    static _buildQuickActionButtons() {
        const baseClass = UIConfig?.CSS_CLASSES?.button?.secondary || '';

        return [
            {
                id: 'untap-all',
                label: '🔄 Untap All',
                title: 'Untap all permanents',
                disabled: false,
                className: baseClass,
                onClick: () => {
                    if (typeof GameActions !== 'undefined' && typeof GameActions.untapAll === 'function') {
                        GameActions.untapAll();
                    }
                }
            },
            {
                id: 'resolve-all-stack',
                label: '🎯 Resolve All Stack',
                title: 'Resolve all spells on the stack',
                disabled: false,
                className: baseClass,
                onClick: () => {
                    if (
                        typeof GameActions !== 'undefined' &&
                        typeof GameActions.performGameAction === 'function'
                    ) {
                        GameActions.performGameAction('resolve_all_stack');
                    }
                }
            }
        ];
    }

    static _createGameActionHandler(action) {
        return () => {
            if (
                !action ||
                typeof GameActions === 'undefined' ||
                typeof GameActions.performGameAction !== 'function'
            ) {
                return;
            }
            GameActions.performGameAction(action);
        };
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
        const ownerId = playerId || (isOpponent ? 'player2' : 'player1');
        const sanitizedOwner = typeof GameUtils !== 'undefined' && typeof GameUtils.escapeHtml === 'function'
            ? GameUtils.escapeHtml(ownerId)
            : ownerId;
        const playerRole = isOpponent ? 'opponent' : 'player';
        const cardsHtml = filteredCards.map(card => {
            return GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, zoneName, isOpponent, null, playerId);
        }).join('');

        return `
            <div class="battlefield-zone ${zoneName}-zone compact-zones"
                data-battlefield-zone="${zoneName}"
                data-zone-owner="${sanitizedOwner}"
                data-player-role="${playerRole}"
                ondragover="UIZonesManager.handleZoneDragOver(event)"
                ondragleave="UIZonesManager.handleZoneDragLeave(event)"
                ondrop="UIZonesManager.handleZoneDrop(event, '${zoneName}')">
                <div class="${zoneName}-zone-content zone-content"
                    data-card-count="${cardCount}"
                    data-zone-owner="${sanitizedOwner}"
                    data-player-role="${playerRole}">
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
    static generateEmptyZone(icon, name) { return UIUtils.generateEmptyZone(icon, name); }
    static generateZoneClickHandler(isOpponent, prefix, zoneType, title) { return UIUtils.generateZoneClickHandler(isOpponent, prefix, zoneType, title); }
    static filterCardsByType(cards, zoneName) { return UIUtils.filterCardsByType(cards, zoneName); }
    static getZoneConfiguration(isOpponent, playerIndex, playerName = null) { return UIUtils.getZoneConfiguration(isOpponent, playerIndex, playerName); }

    // Zone generation delegation to UIZonesManager
    static generateDeckZone(deck, isOpponent) { return UIZonesManager.generateDeckZone(deck, isOpponent); }
    static generateGraveyardZone(graveyard, isOpponent) { return UIZonesManager.generateGraveyardZone(graveyard, isOpponent); }
    static generateExileZone(exile, isOpponent) { return UIZonesManager.generateExileZone(exile, isOpponent); }
    static generateLifeZone(playerData, playerId, titlePrefix) { return UIZonesManager.generateLifeZone(playerData, playerId, titlePrefix); }

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
            life: this.generateLifeZone(safePlayerData, playerId, titlePrefix),
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
     * Update stack overlay visibility and content
     */
    static _updateStackOverlay(stack, gameState = null) {
        const component = this._ensureStackPopupComponent();
        if (!component) {
            return;
        }

        const safeStack = Array.isArray(stack) ? stack : [];
        const visible = safeStack.length > 0;

        try {
            component.$set({
                stack: safeStack,
                visible,
                gameState
            });
        } catch (error) {
            console.error('Failed to update stack popup', error);
        }
    }

    static _ensureStackPopupComponent() {
        if (typeof StackPopupComponent === 'undefined') {
            return null;
        }

        if (this._stackPopupComponent) {
            return this._stackPopupComponent;
        }

        if (typeof document === 'undefined') {
            return null;
        }

        const target = document.createElement('div');
        document.body.appendChild(target);

        try {
            this._stackPopupComponent = new StackPopupComponent.default({
                target,
                props: {
                    stack: [],
                    visible: false,
                    gameState: null
                }
            });
            this._stackPopupTarget = target;
        } catch (error) {
            console.error('Failed to initialize stack popup', error);
            target.remove();
            this._stackPopupComponent = null;
            this._stackPopupTarget = null;
        }

        return this._stackPopupComponent;
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

    static _makePopupDraggable(panel, handle) {
        if (!panel || !handle || panel.dataset.popupDraggableInit === 'true') {
            return;
        }

        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        const startDragging = (clientX, clientY) => {
            if (isDragging) return;
            isDragging = true;
            panel.dataset.userMoved = 'true';
            panel.classList.add('popup-dragging');
            const rect = panel.getBoundingClientRect();
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
        };

        const stopDragging = () => {
            if (!isDragging) {
                return;
            }
            isDragging = false;
            panel.classList.remove('popup-dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };

        const onMouseMove = (event) => {
            if (!isDragging) {
                return;
            }
            this._positionPopup(panel, event.clientX - dragOffsetX, event.clientY - dragOffsetY);
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
            this._positionPopup(panel, touch.clientX - dragOffsetX, touch.clientY - dragOffsetY);
            event.preventDefault();
        };

        const onTouchEnd = () => {
            stopDragging();
        };

        const onMouseDown = (event) => {
            if (event.button !== 0 || event.target.closest('button')) {
                return;
            }
            startDragging(event.clientX, event.clientY);
            event.preventDefault();
        };

        const onTouchStart = (event) => {
            const touch = event.touches[0];
            if (!touch || event.target.closest('button')) {
                return;
            }
            startDragging(touch.clientX, touch.clientY);
            event.preventDefault();
        };

        handle.addEventListener('mousedown', onMouseDown);
        handle.addEventListener('touchstart', onTouchStart, { passive: false });
        panel.dataset.popupDraggableInit = 'true';
    }

    static _positionPopup(panel, left, top) {
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
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
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

        this._makePopupDraggable(panel, handle);
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

    static _updatePlayerAreaBattlefield(player, previousPlayer, playerIndex, isOpponent) {
        const ownerId = this._resolvePlayerOwnerId(player, playerIndex, isOpponent);
        const battlefieldCards = Array.isArray(player?.battlefield) ? player.battlefield : [];
        const previousCards = Array.isArray(previousPlayer?.battlefield) ? previousPlayer.battlefield : [];

        ['lands', 'creatures', 'support'].forEach((zoneName) => {
            this._updateBattlefieldZone(ownerId, zoneName, battlefieldCards, previousCards, { isOpponent });
        });
    }

    static _resolvePlayerOwnerId(playerData, playerIndex, isOpponent) {
        if (playerData && typeof playerData.id === 'string') {
            return playerData.id;
        }
        if (typeof playerIndex === 'number' && !Number.isNaN(playerIndex)) {
            return `player${playerIndex + 1}`;
        }
        return isOpponent ? 'player2' : 'player1';
    }

    static _updateBattlefieldZone(ownerId, zoneName, battlefieldCards, previousBattlefieldCards, options = {}) {
        if (!ownerId) {
            return;
        }

        const zoneSelector = `.battlefield-zone[data-zone-owner="${ownerId}"][data-battlefield-zone="${zoneName}"]`;
        const zoneElement = document.querySelector(zoneSelector);
        if (!zoneElement) {
            return;
        }

        const zoneContent = zoneElement.querySelector('.zone-content');
        if (!zoneContent) {
            return;
        }

        const isOpponent = Boolean(options.isOpponent);
        const currentCards = UIUtils.filterCardsByType(battlefieldCards, zoneName);
        const previousCards = UIUtils.filterCardsByType(previousBattlefieldCards, zoneName);
        const previousLookup = new Map(previousCards.map(card => [this._getCardKey(card), card]));
        const existingElements = new Map();

        Array.from(zoneContent.children).forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            const key = this._getCardElementKey(node);
            if (key) {
                existingElements.set(key, node);
            }
        });

        currentCards.forEach((card, index) => {
            const cardKey = this._getCardKey(card);
            const existing = cardKey ? existingElements.get(cardKey) : null;
            const previousCard = cardKey ? previousLookup.get(cardKey) : null;
            const referenceNode = zoneContent.children[index] || null;

            if (existing) {
                if (previousCard && this._hasOnlySimpleStateChanges(previousCard, card)) {
                    GameCards.updateCardElementState(existing, card, zoneName, isOpponent);
                    if (referenceNode !== existing) {
                        zoneContent.insertBefore(existing, referenceNode);
                    }
                } else {
                    const newNode = this._createCardElement(card, zoneName, isOpponent, ownerId);
                    zoneContent.insertBefore(newNode, referenceNode);
                    existing.remove();
                }
                existingElements.delete(cardKey);
                previousLookup.delete(cardKey);
            } else {
                const newNode = this._createCardElement(card, zoneName, isOpponent, ownerId);
                zoneContent.insertBefore(newNode, referenceNode);
            }
        });

        existingElements.forEach(node => node.remove());
        zoneContent.setAttribute('data-card-count', currentCards.length);
        zoneElement.setAttribute('data-card-count', currentCards.length);

        if (window.UICardOverlap) {
            window.UICardOverlap.applyOverlapToZone(zoneContent);
        }
    }

    static _getCardKey(card) {
        if (!card) {
            return null;
        }
        return card.unique_id || card.id || card.name || null;
    }

    static _getCardElementKey(element) {
        if (!element) {
            return null;
        }
        return (
            element.getAttribute('data-card-unique-id') ||
            element.getAttribute('data-card-id') ||
            element.getAttribute('data-card-name')
        );
    }

    static _createCardElement(card, zoneName, isOpponent, ownerId) {
        const html = GameCards.renderCardWithLoadingState(
            card,
            'card-battlefield',
            true,
            zoneName,
            isOpponent,
            null,
            ownerId
        );
        return this._createElementFromHTML(html);
    }

    static _createElementFromHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstElementChild;
    }

    static _hasOnlySimpleStateChanges(previousCard, nextCard) {
        if (!previousCard || !nextCard) {
            return false;
        }

        const simpleKeys = ['tapped', 'attacking', 'blocking', 'targeted'];
        const simpleChanged = simpleKeys.some(
            (key) => Boolean(previousCard[key]) !== Boolean(nextCard[key])
        );
        if (!simpleChanged) {
            return false;
        }

        const sanitize = (card) => {
            const clone = JSON.parse(JSON.stringify(card));
            simpleKeys.forEach((key) => {
                delete clone[key];
            });
            return clone;
        };

        const previousSanitized = sanitize(previousCard);
        const nextSanitized = sanitize(nextCard);
        return JSON.stringify(previousSanitized) === JSON.stringify(nextSanitized);
    }

    static _areCardListsEqual(nextList, previousList) {
        const safeNext = Array.isArray(nextList) ? nextList : [];
        const safePrev = Array.isArray(previousList) ? previousList : [];
        return JSON.stringify(safeNext) === JSON.stringify(safePrev);
    }

    static _updatePlayerHandZone(player, previousPlayer, playerIndex) {
        const ownerId = this._resolvePlayerOwnerId(player, playerIndex, false);
        const container = document.querySelector(`.hand-zone-content[data-player-owner="${ownerId}"]`);
        if (!container) {
            return;
        }

        const hand = Array.isArray(player?.hand) ? player.hand : [];
        const previousHand = Array.isArray(previousPlayer?.hand) ? previousPlayer.hand : [];
        if (this._areCardListsEqual(hand, previousHand)) {
            container.setAttribute('data-card-count', hand.length);
            return;
        }

        container.innerHTML = this.generatePlayerHand(hand, playerIndex);
        container.setAttribute('data-card-count', hand.length);

        if (window.UICardOverlap) {
            window.UICardOverlap.applyOverlapToZone(container);
        }
    }

    static _updateOpponentHandZone(opponent, previousOpponent, opponentIdx) {
        const ownerId = this._resolvePlayerOwnerId(opponent, opponentIdx, true);
        const container = document.querySelector(`.opponent-hand-zone[data-player-owner="${ownerId}"]`);
        if (!container) {
            return;
        }

        const isSpectatorView =
            typeof GameCore !== 'undefined' &&
            typeof GameCore.getSelectedPlayer === 'function' &&
            GameCore.getSelectedPlayer() === 'spectator';
        const hand = Array.isArray(opponent?.hand) ? opponent.hand : [];
        const previousHand = Array.isArray(previousOpponent?.hand) ? previousOpponent.hand : [];

        if (isSpectatorView) {
            if (this._areCardListsEqual(hand, previousHand) && container.dataset.handMode === 'spectator') {
                container.setAttribute('data-card-count', hand.length);
                return;
            }
            container.innerHTML = this.generatePlayerHand(hand, opponentIdx, {
                isOpponent: true,
                readOnly: true
            });
            container.dataset.handMode = 'spectator';
            container.setAttribute('data-card-count', hand.length);
            if (window.UICardOverlap) {
                window.UICardOverlap.applyOverlapToZone(container);
            }
            return;
        }

        const placeholderSize = hand.length || 7;
        if (
            Number(container.dataset.cardCount) === placeholderSize &&
            container.dataset.handMode === 'hidden'
        ) {
            return;
        }
        container.innerHTML = this.generateOpponentHand(placeholderSize);
        container.dataset.handMode = 'hidden';
        container.setAttribute('data-card-count', placeholderSize);
    }

    static _updatePlayerZoneActiveState(zoneRole, isActive) {
        const container = document.querySelector(`[data-player-zone="${zoneRole}"]`);
        if (!container) {
            return;
        }
        const activeClass = zoneRole === 'player' ? 'player-zone-active-turn' : 'opponent-zone-active-turn';
        container.classList.toggle(activeClass, Boolean(isActive));
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
        const ownerId = this._resolvePlayerOwnerId(opponent, opponentIdx, true);
        const opponentHandHtml = isSpectatorView
            ? this.generatePlayerHand(opponent?.hand || [], opponentIdx, {
                isOpponent: true,
                readOnly: true
            })
            : this.generateOpponentHand(placeholderHandSize);
        const handDataCount = isSpectatorView ? actualHandSize : placeholderHandSize;
        
        return `
            <div class="arena-card rounded-lg mb-3 p-3 compact-zones ${activeTurnClass}"
                data-player-zone="opponent"
                data-player-owner="${ownerId}">
                <div class="opponent-hand-zone space-x-1 overflow-x-auto py-1"
                    data-card-count="${handDataCount}"
                    data-player-owner="${ownerId}"
                    data-hand-mode="${isSpectatorView ? 'spectator' : 'hidden'}"
                    data-zone-type="opponent-hand">
                    ${opponentHandHtml}
                </div>

                ${this.generateBattlefieldLayout(opponent?.battlefield, true, ownerId)}
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
        const ownerId = this._resolvePlayerOwnerId(player, controlledIdx, false);
        
        return `
            <div class="arena-card rounded-lg p-3 hand-zone ${activeTurnClass}"
                data-player-zone="player"
                data-player-owner="${ownerId}">
                ${this.generateBattlefieldLayout(player?.battlefield, false, ownerId)}

                <div class="hand-zone-content zone-content"
                    data-card-count="${handSize}"
                    data-zone-type="hand"
                    data-player-owner="${ownerId}"
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
