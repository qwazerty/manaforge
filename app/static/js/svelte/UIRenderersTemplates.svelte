<svelte:options accessors={true} />

<script>
    import { onMount } from 'svelte';
    import { createClassComponent } from 'svelte/legacy';
    import {
        getGameStateSnapshot,
        getSelectedPlayerSnapshot
    } from './stores/gameCoreStore.js';

    // Import child components for dynamic mounting
    import GameArena from './GameArena.svelte';
    import ActionPanel from './ActionPanel.svelte';
    import StackPopup from './StackPopup.svelte';

    // Helper to mount Svelte 5 components dynamically
    const mountComponent = (Component, options) => {
        return createClassComponent({ component: Component, ...options });
    };

    const unmountComponent = (instance) => {
        if (instance && typeof instance.$destroy === 'function') {
            instance.$destroy();
        }
    };

    const getGameState = () => {
        if (typeof GameCore?.getGameState === 'function') {
            return GameCore.getGameState();
        }
        return getGameStateSnapshot();
    };

    const getSelectedPlayer = () => {
        if (typeof GameCore?.getSelectedPlayer === 'function') {
            return GameCore.getSelectedPlayer();
        }
        return getSelectedPlayerSnapshot();
    };

    /**
     * ManaForge Unified Renderers and Templates Module
     * Combines rendering logic and HTML template generation
     */

    class UIRenderersTemplates {
        static _revealPopupElements = new Map();
        static _lookPopupElements = new Map();
        static _actionPanelComponent = null;
        static _actionPanelTarget = null;
        static _stackPopupComponent = null;
        static _stackPopupTarget = null;
        static _stackPopupAfterHideUnsub = null;
        static _gameArenaComponent = null;
        static _gameArenaTarget = null;
        // ===== MAIN RENDERING METHODS =====
    
        /**
         * Render role display
         */
        static renderRoleDisplay() {
            const currentSelectedPlayer = getSelectedPlayer();
            const roleDisplay = document.getElementById('current-role-display');
            const roleDescription = document.getElementById('role-description');
            const gameState = getGameState() || {};
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
            this.renderGameArena();
        }

        /**
         * Render game board
         */
        static renderGameBoard() {
            this.renderGameArena();
        }

        static renderGameArena() {
            const gameState = getGameState();
            this._renderGameArenaWithState(gameState);
        }

        static _renderGameArenaWithState(gameState) {
            const arenaContainer = document.getElementById('game-arena-root');
            if (!this._validateContainer(arenaContainer, 'Game arena container')) {
                this._destroyGameArenaComponent();
                return false;
            }
            if (!this._validateGameState(gameState)) {
                this._destroyGameArenaComponent();
                arenaContainer.innerHTML = `
                    <div class="text-center py-4 text-arena-text-dim text-sm">
                        Waiting for game state...
                    </div>
                `;
                return false;
            }

            const props = {
                gameState,
                selectedPlayer: getSelectedPlayer()
            };

            this._renderGameArenaSvelte(arenaContainer, props);

            this._scheduleActionPanelRender();
            this._scheduleZoneHydration();
            this._scheduleSidebarHydration();

            const players = Array.isArray(gameState.players) ? gameState.players : [];
            this._preloadCardImages(players);
            this._updateZoneOverlay(gameState, 'reveal');
            this._updateZoneOverlay(gameState, 'look');

            return true;
        }

        static _scheduleActionPanelRender() {
            const render = () => {
                try {
                    this.renderActionPanel();
                } catch (error) {
                    console.error('[UIRenderersTemplates] Failed to render action panel', error);
                }
            };

            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(render);
            } else {
                render();
            }
        }

        static _scheduleZoneHydration() {
            if (typeof UIZonesManager?.hydrateSvelteZones !== 'function') {
                return;
            }
            const hydrate = () => {
                try {
                    UIZonesManager.hydrateSvelteZones();
                } catch (error) {
                    console.error('[UIRenderersTemplates] Failed to hydrate zones', error);
                }
            };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(hydrate);
            } else {
                hydrate();
            }
        }

        static _scheduleSidebarHydration() {
            const hydrateSidebar = () => {
                try {
                    if (
                        typeof UIBattleChat !== 'undefined' &&
                        typeof UIBattleChat.render === 'function'
                    ) {
                        UIBattleChat.render();
                    }
                } catch (error) {
                    console.error('[UIRenderersTemplates] Failed to refresh battle chat', error);
                }
            };

            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(hydrateSidebar);
            } else {
                hydrateSidebar();
            }
        }

        static _renderGameArenaSvelte(container, props) {
            if (!this._gameArenaComponent || this._gameArenaTarget !== container) {
                this._destroyGameArenaComponent();
                container.innerHTML = '';

                try {
                    this._gameArenaComponent = mountComponent(GameArena, {
                        target: container,
                        props
                    });
                    this._gameArenaTarget = container;
                } catch (error) {
                    console.error('[UIRenderersTemplates] Failed to mount GameArena', error);
                    container.innerHTML = `
                        <div class="arena-card rounded-xl p-6 text-center">
                            <h3 class="text-red-400 font-bold mb-2">⚠️ Game Arena</h3>
                            <p class="text-arena-text-dim">Unable to load the arena component.</p>
                        </div>
                    `;
                }
            } else if (typeof this._gameArenaComponent.$set === 'function') {
                this._gameArenaComponent.$set(props);
            }
        }

        static updateGameBoard(gameState) {
            return this._renderGameArenaWithState(gameState || getGameState());
        }

        /**
         * Render action panel
         */
        static renderActionPanel() {
            const gameState = getGameState();
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
                this._updateZoneOverlay(gameState, 'reveal');
                this._updateZoneOverlay(gameState, 'look');
            } catch (error) {
                this._destroyActionPanelComponent();
                this._renderError(actionPanelContainer, 'Error', error.message);
                this._updateStackOverlay([], null);
                this._updateZoneOverlay(null, 'reveal');
                this._updateZoneOverlay(null, 'look');
            }
        }

        static _renderActionPanelSvelte(container, props) {
            if (!this._actionPanelComponent || this._actionPanelTarget !== container) {
                this._destroyActionPanelComponent();
                container.innerHTML = '';

                try {
                    this._actionPanelComponent = mountComponent(ActionPanel, {
                        target: container,
                        props
                    });
                    this._actionPanelTarget = container;
                } catch (error) {
                    console.error('[UIRenderersTemplates] Failed to mount ActionPanel', error);
                    container.innerHTML = `
                        <div class="text-center py-4 text-arena-text-dim text-sm">
                            Unable to load action panel
                        </div>
                    `;
                }
            } else if (typeof this._actionPanelComponent.$set === 'function') {
                this._actionPanelComponent.$set(props);
            }
        }

        static _destroyActionPanelComponent() {
            if (this._actionPanelComponent) {
                unmountComponent(this._actionPanelComponent);
                this._actionPanelComponent = null;
                this._actionPanelTarget = null;
            }
        }

        static _destroyGameArenaComponent() {
            if (this._gameArenaComponent) {
                unmountComponent(this._gameArenaComponent);
                this._gameArenaComponent = null;
                this._gameArenaTarget = null;
            }
        }

        static _buildActionPanelProps(gameState) {
            const selectedPlayer = getSelectedPlayer();
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

            const props = {
                headerIcon: '⚡',
                headerTitle: 'Game Actions',
                spectatorMode,
                gameInfo: {
                    turn: currentTurn,
                    active: activePlayerName
                },
                phases: Array.isArray(UIConfig?.GAME_PHASES)
                    ? UIConfig.GAME_PHASES.map((phase) => ({ ...phase }))
                    : [],
                currentPhase,
                readOnlyPhases: spectatorMode,
                phaseModeLabel,
                phaseClickHandler: this._createPhaseClickHandler(),
                // Add game start phase info
                gameStartPhase: gameState?.game_start_phase || 'complete',
                gameStartInfo: this._buildGameStartInfo(gameState, players)
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
            props.tokenSearchButton = this._buildTokenSearchButtonConfig();
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
            const endStepPriorityPassed = Boolean(gameState?.end_step_priority_passed);
            const passClasses = (UIConfig?.CSS_CLASSES?.button?.passPhase)
                || (UIConfig?.CSS_CLASSES?.button?.primary)
                || '';

            // Game start phase handling
            const gameStartPhase = gameState?.game_start_phase || 'complete';
            const coinFlipWinner = gameState?.coin_flip_winner;
            const mulliganDecidingPlayer = gameState?.mulligan_deciding_player;
            const mulliganState = gameState?.mulligan_state || {};

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
                const controlledPlayerKey = controlledPlayerIndex === 0 ? 'player1' : 'player2';
                const opponentSeatIndex = controlledPlayerIndex === 0 ? 1 : 0;
                const opponentName = this._getPlayerDisplayName(
                    players[opponentSeatIndex],
                    this._getSeatFallbackName(opponentSeatIndex)
                );

                // Handle game start phases (coin flip and mulligans)
                if (gameStartPhase === 'coin_flip') {
                    // Coin flip phase - winner chooses to play or draw
                    const isCoinFlipWinner = controlledPlayerIndex === coinFlipWinner;
                    const winnerName = this._getPlayerDisplayName(
                        players[coinFlipWinner],
                        this._getSeatFallbackName(coinFlipWinner)
                    );

                    if (isCoinFlipWinner) {
                        // Return special config for coin flip choice buttons
                        return this._buildCoinFlipButtons(passClasses, winnerName);
                    } else {
                        passDisabled = true;
                        passLabel = '🎲 Waiting...';
                        passTitle = `Waiting for ${winnerName} to choose Play First or Draw`;
                    }
                } else if (gameStartPhase === 'mulligans') {
                    // Mulligan phase - alternating keep/mulligan decisions
                    const isMyTurnToDecide = mulliganDecidingPlayer === controlledPlayerKey;
                    const myMulliganState = mulliganState[controlledPlayerKey] || {};
                    const hasKept = myMulliganState.has_kept || false;

                    if (hasKept) {
                        // Already kept, waiting for opponent
                        passDisabled = true;
                        passLabel = '✅ Hand Kept';
                        passTitle = `Waiting for ${opponentName} to make mulligan decision`;
                    } else if (isMyTurnToDecide) {
                        // Return special config for keep/mulligan buttons
                        return this._buildMulliganButtons(passClasses, myMulliganState);
                    } else {
                        // Not my turn to decide
                        const decidingPlayerName = mulliganDecidingPlayer === 'player1'
                            ? this._getPlayerDisplayName(players[0], 'Player 1')
                            : this._getPlayerDisplayName(players[1], 'Player 2');
                        passDisabled = true;
                        passLabel = '⏳ Waiting...';
                        passTitle = `Waiting for ${decidingPlayerName} to make mulligan decision`;
                    }
                } else {
                    // Normal game phase handling
                    const isStrictMode = phaseMode === 'strict';
                    const hasStack = stack.length > 0;
                    const isActivePlayer = controlledPlayerIndex === activePlayerIndex;
                    const isPriorityPlayer = controlledPlayerIndex === priorityPlayerIndex;

                    // Check if we're at the end step with priority passing
                    if (currentPhase === 'end' && endStepPriorityPassed) {
                        // Opponent has priority during the end step resolve
                        if (!isActivePlayer) {
                            passDisabled = false;
                            passAction = 'pass_phase';
                            passLabel = '✅ Resolve';
                            passTitle = `Confirm end of turn (allowing ${activePlayerName} to proceed to next turn)`;
                        } else {
                            passDisabled = true;
                            passTitle = `Waiting for ${opponentName} to resolve the end step`;
                        }
                    } else if (isStrictMode && hasStack) {
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

        static _buildCoinFlipButtons(baseClasses, winnerName) {
            /**
             * Returns special button config for coin flip choice.
             * Instead of a single passButton, we return an object that signals
             * the ActionPanel to render two buttons: Play First and Draw.
             */
            return {
                isCoinFlipChoice: true,
                winnerName,
                playButton: {
                    label: '🎮 Play First',
                    title: 'Choose to take the first turn',
                    disabled: false,
                    className: baseClasses,
                    onClick: () => {
                        if (typeof GameActions !== 'undefined' && typeof GameActions.performGameAction === 'function') {
                            GameActions.performGameAction('coin_flip_choice', { choice: 'play' });
                        }
                    }
                },
                drawButton: {
                    label: '🃏 Draw',
                    title: 'Let opponent go first (you will be on the draw)',
                    disabled: false,
                    className: baseClasses,
                    onClick: () => {
                        if (typeof GameActions !== 'undefined' && typeof GameActions.performGameAction === 'function') {
                            GameActions.performGameAction('coin_flip_choice', { choice: 'draw' });
                        }
                    }
                }
            };
        }

        static _buildMulliganButtons(baseClasses, mulliganState) {
            /**
             * Returns special button config for mulligan decision.
             * Instead of a single passButton, we return an object that signals
             * the ActionPanel to render two buttons: Keep and Mulligan.
             */
            const mulliganCount = mulliganState?.mulligan_count || 0;
            const cardsToBottom = mulliganCount;

            return {
                isMulliganChoice: true,
                mulliganCount,
                keepButton: {
                    label: '✅ Keep',
                    title: cardsToBottom > 0
                        ? `Keep this hand (you must put ${cardsToBottom} card(s) on bottom of library)`
                        : 'Keep this hand',
                    disabled: false,
                    className: baseClasses,
                    onClick: () => {
                        if (typeof GameActions !== 'undefined' && typeof GameActions.performGameAction === 'function') {
                            GameActions.performGameAction('keep_hand');
                        }
                    }
                },
                mulliganButton: {
                    label: '🔄 Mulligan',
                    title: `Shuffle hand into library and draw 7 new cards (mulligan #${mulliganCount + 1})`,
                    disabled: false,
                    className: baseClasses,
                    onClick: () => {
                        if (typeof GameActions !== 'undefined' && typeof GameActions.performGameAction === 'function') {
                            GameActions.performGameAction('mulligan');
                        }
                    }
                }
            };
        }

        static _buildGameStartInfo(gameState, players) {
            /**
             * Build game start phase status information for display in the UI.
             */
            const gameStartPhase = gameState?.game_start_phase || 'complete';
            const coinFlipWinner = gameState?.coin_flip_winner;
            const firstPlayer = gameState?.first_player;
            const mulliganState = gameState?.mulligan_state || {};
            const mulliganDecidingPlayer = gameState?.mulligan_deciding_player;

            if (gameStartPhase === 'complete') {
                return null;
            }

            const getPlayerName = (index) => {
                if (index === null || index === undefined || !players[index]) {
                    return 'Unknown';
                }
                return this._getPlayerDisplayName(players[index], `Player ${index + 1}`);
            };

            if (gameStartPhase === 'coin_flip') {
                const winnerName = getPlayerName(coinFlipWinner);
                return {
                    phase: 'coin_flip',
                    icon: '🎲',
                    title: 'Coin Flip',
                    message: `${winnerName} won the coin flip!`,
                    subMessage: 'Choose to play first or draw.',
                    highlight: true
                };
            }

            if (gameStartPhase === 'mulligans') {
                const firstPlayerName = getPlayerName(firstPlayer);
                const decidingPlayerName = mulliganDecidingPlayer === 'player1'
                    ? getPlayerName(0)
                    : getPlayerName(1);

                // Build status for each player
                const player1State = mulliganState['player1'] || {};
                const player2State = mulliganState['player2'] || {};
                const player1Name = getPlayerName(0);
                const player2Name = getPlayerName(1);

                let player1Status = player1State.has_kept
                    ? `✅ Kept` + (player1State.mulligan_count > 0 ? ` (mulligan ${player1State.mulligan_count}x)` : '')
                    : player1State.mulligan_count > 0
                        ? `🔄 Mulligan ${player1State.mulligan_count}x`
                        : '⏳ Deciding...';

                let player2Status = player2State.has_kept
                    ? `✅ Kept` + (player2State.mulligan_count > 0 ? ` (mulligan ${player2State.mulligan_count}x)` : '')
                    : player2State.mulligan_count > 0
                        ? `🔄 Mulligan ${player2State.mulligan_count}x`
                        : '⏳ Deciding...';

                // Mark who is currently deciding
                if (mulliganDecidingPlayer === 'player1' && !player1State.has_kept) {
                    player1Status = '🤔 Deciding...';
                } else if (mulliganDecidingPlayer === 'player2' && !player2State.has_kept) {
                    player2Status = '🤔 Deciding...';
                }

                return {
                    phase: 'mulligans',
                    icon: '🃏',
                    title: 'Mulligan Phase',
                    message: `${firstPlayerName} will play first.`,
                    subMessage: `${decidingPlayerName} is deciding...`,
                    playerStatuses: [
                        { name: player1Name, status: player1Status },
                        { name: player2Name, status: player2Status }
                    ],
                    highlight: true
                };
            }

            return null;
        }

        static _collectBattlefieldTokenNames() {
            if (
                typeof GameCore === 'undefined' ||
                typeof GameCore.getGameState !== 'function'
            ) {
                return [];
            }

            const gameState = GameCore.getGameState();
            if (!gameState) {
                return [];
            }

            const players = Array.isArray(gameState.players) ? gameState.players : [];
            // Map of token name -> Set of source sets
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            const tokenMap = new Map();
            
            const addToken = (tokenName, sourceSet) => {
                if (!tokenName) return;
                const key = tokenName.toLowerCase();
                if (!tokenMap.has(key)) {
                    tokenMap.set(key, { name: tokenName, sourceSets: new Set() });
                }
                if (sourceSet) {
                    tokenMap.get(key).sourceSets.add(sourceSet.toLowerCase());
                }
            };
            
            for (const player of players) {
                const battlefield = Array.isArray(player?.battlefield) ? player.battlefield : [];
                for (const card of battlefield) {
                    if (!card) {
                        continue;
                    }
                    const cardName = typeof card.name === 'string' ? card.name.trim() : '';
                    const cardSet = card.set || card.set_code || '';
                
                    // Check if the card itself is a token
                    if (cardName && this._isBattlefieldToken(card, cardName)) {
                        addToken(cardName, cardSet);
                    }
                
                    // Extract token names from oracle text
                    const oracleTokens = this._extractTokenNamesFromOracle(card);
                    for (const tokenName of oracleTokens) {
                        addToken(tokenName, cardSet);
                    }
                }
            }

            // Convert to array with sourceSets as arrays, sorted by name
            return Array.from(tokenMap.values())
                .map(entry => ({ name: entry.name, sourceSets: Array.from(entry.sourceSets) }))
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        static _extractTokenNamesFromOracle(card) {
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            const tokens = new Set();
        
            // Get oracle text from card or card faces
            const oracleTexts = [];
            if (card?.oracle_text) {
                oracleTexts.push(card.oracle_text);
            }
            if (card?.text) {
                oracleTexts.push(card.text);
            }
            if (Array.isArray(card?.card_faces)) {
                for (const face of card.card_faces) {
                    if (face?.oracle_text) {
                        oracleTexts.push(face.oracle_text);
                    }
                    if (face?.text) {
                        oracleTexts.push(face.text);
                    }
                }
            }
        
            const fullText = oracleTexts.join(' ');
            if (!fullText) {
                return tokens;
            }
        
            // Pattern to match token creation text
            // Matches patterns like:
            // - "create a Treasure token"
            // - "creates a 1/1 red Goblin creature token"
            // - "create two Treasure tokens"
            // - "create X 1/1 white Soldier creature tokens"
            const tokenPattern = /creates?\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|X)?\s*(?:\d+\/\d+\s+)?([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\s+(?:creature\s+)?tokens?/gi;
        
            let match;
            while ((match = tokenPattern.exec(fullText)) !== null) {
                let tokenName = match[1].trim();
                // Clean up the token name - remove common prefixes that aren't part of the name
                // Including colors and card type keywords
                tokenName = tokenName
                    .replace(/^(legendary|colorless|artifact|enchantment|creature|white|blue|black|red|green)\s+/gi, '')
                    .replace(/\s+(creature|artifact|enchantment)$/gi, '')
                    .trim();
            
                // Apply color removal again in case there are multiple color words
                tokenName = tokenName
                    .replace(/^(white|blue|black|red|green)\s+/gi, '')
                    .trim();
            
                if (tokenName && tokenName.length > 1) {
                    tokens.add(tokenName);
                }
            }
        
            return tokens;
        }

        static _isBattlefieldToken(card, cardName) {
            if (card?.is_token) {
                return true;
            }
            const normalized = String(cardName || '').toLowerCase();
            if (normalized.includes(' token')) {
                return true;
            }
            return normalized.includes('token');
        }

        static _buildSearchButtonConfig() {
            const className = `${UIConfig?.CSS_CLASSES?.button?.secondary || ''} w-full`;
            return {
                label: '🔍 Search cards',
                title: 'Search for a card to add to the battlefield',
                disabled: false,
                className,
                onClick: () => {
                    if (typeof window === 'undefined') {
                        return;
                    }
                    if (
                        window.CardSearchModal &&
                        typeof window.CardSearchModal.setTokenFilter === 'function'
                    ) {
                        window.CardSearchModal.setTokenFilter([]);
                    }
                    if (typeof window.showCardSearch === 'function') {
                        window.showCardSearch('battlefield');
                    }
                }
            };
        }

        static _buildTokenSearchButtonConfig() {
            const className = `${UIConfig?.CSS_CLASSES?.button?.secondary || ''} w-full`;
            const tokenNames = this._collectBattlefieldTokenNames();

            return {
                label: '🔍 Search tokens',
                title: tokenNames.length
                    ? 'Search tokens that appear on the battlefield'
                    : 'No battlefield tokens detected',
                disabled: tokenNames.length === 0,
                className,
                onClick: () => {
                    if (typeof window === 'undefined') {
                        return;
                    }

                    const latestTokens = this._collectBattlefieldTokenNames();
                    if (!latestTokens.length) {
                        return;
                    }

                    if (
                        window.CardSearchModal &&
                        typeof window.CardSearchModal.setTokenFilter === 'function'
                    ) {
                        window.CardSearchModal.setTokenFilter(latestTokens);
                    }

                    if (typeof window.showCardSearch === 'function') {
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
                    id: 'random',
                    label: '🎲 Random',
                    title: 'Roll dice or flip coin',
                    disabled: false,
                    className: baseClass,
                    isRandomButton: true
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
                },
                {
                    id: 'remove-all-arrows',
                    label: '🚫 Remove All Arrows',
                    title: 'Remove all targeting arrows',
                    disabled: false,
                    className: baseClass,
                    onClick: () => {
                        if (
                            typeof window !== 'undefined' &&
                            window.GameCards &&
                            typeof window.GameCards.clearAllTargetingArrowElements === 'function'
                        ) {
                            window.GameCards.clearAllTargetingArrowElements(true);
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
        static generateOpponentHand(handSize = 0) {
            const count = Number.isFinite(handSize) && handSize > 0 ? handSize : 0;
            if (count === 0) {
                return '';
            }
            return Array(count).fill().map((_, index) => `
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
            const _players = Array.isArray(gameState.players) ? gameState.players : [];

            return `
                <div class="grid grid-cols-2 gap-4 text-center">
                    <div class="bg-yellow-500/20 rounded-lg p-3">
                        <div class="text-yellow-300 font-semibold">Turn</div>
                        <div class="text-2xl font-bold">${currentTurn}</div>
                    </div>
                    <div class="bg-blue-500/20 rounded-lg p-3">
                        <div class="text-blue-300 font-semibold">Phase</div>
                        <div class="text-lg font-bold">${phaseDisplay}</div>
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
            const { prefix: _prefix, titlePrefix, zoneIds: _zoneIds, playerId } = config;
            const safePlayerData = playerData || {};
            const {
                library = [],
                deck = [],
                graveyard = [],
                exile = [],
                life: _life = 20
            } = safePlayerData;
        
            const deckData = library.length > 0 ? library : deck;

            return {
                life: this.generateLifeZone(safePlayerData, playerId, titlePrefix),
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
                'player1': { class: 'bg-green-500/20 border-green-500/50 text-green-400', title: 'Player 1', description: 'You control the first player position' },
                'player2': { class: 'bg-red-500/20 border-red-500/50 text-red-400', title: 'Player 2', description: 'You control the second player position' },
                'spectator': { class: 'bg-purple-500/20 border-purple-500/50 text-purple-400', title: '👁️ Spectator', description: 'You are watching the battle unfold' }
            };
        }

        /**
         * Update stack overlay visibility and content
         */
        static _updateStackOverlay(stack, gameState = null) {
            const safeStack = Array.isArray(stack) ? stack : [];
            const visible = safeStack.length > 0;

            if (!visible && !this._stackPopupComponent) {
                return;
            }

            const component = visible
                ? this._ensureStackPopupComponent()
                : this._stackPopupComponent;

            if (!component) {
                return;
            }

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
            if (this._stackPopupComponent) {
                return this._stackPopupComponent;
            }

            if (typeof document === 'undefined') {
                return null;
            }

            const target = document.createElement('div');
            document.body.appendChild(target);

            try {
                this._stackPopupComponent = mountComponent(StackPopup, {
                    target,
                    props: {
                        stack: [],
                        visible: false,
                        gameState: null
                    }
                });
                this._stackPopupTarget = target;
                if (this._stackPopupAfterHideUnsub) {
                    this._stackPopupAfterHideUnsub();
                }
                if (typeof this._stackPopupComponent.$on === 'function') {
                    this._stackPopupAfterHideUnsub = this._stackPopupComponent.$on('afterHide', () => {
                        this._destroyStackPopupComponent();
                    });
                } else {
                    this._stackPopupAfterHideUnsub = null;
                }
            } catch (error) {
                console.error('Failed to initialize stack popup', error);
                target.remove();
                this._stackPopupComponent = null;
                this._stackPopupTarget = null;
            }

            return this._stackPopupComponent;
        }

        static _destroyStackPopupComponent() {
            if (!this._stackPopupComponent) {
                return;
            }
            if (this._stackPopupAfterHideUnsub) {
                const unsubscribe = this._stackPopupAfterHideUnsub;
                this._stackPopupAfterHideUnsub = null;
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('Failed to detach stack popup listener', error);
                }
            }
            try {
                unmountComponent(this._stackPopupComponent);
            } catch (error) {
                console.error('Failed to destroy stack popup', error);
            }
            if (this._stackPopupTarget) {
                this._stackPopupTarget.remove();
            }
            this._stackPopupComponent = null;
            this._stackPopupTarget = null;
        }

        static _updateZoneOverlay(gameState, zoneType) {
            const config = this._getZoneConfig(zoneType);
            const cacheKey = `_${zoneType}PopupElements`;
            if (!this[cacheKey]) {
                this[cacheKey] = new Map();
            }

            const players = Array.isArray(gameState?.players) ? gameState.players : [];
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            const seen = new Set();
            const selectedPlayer = GameCore.getSelectedPlayer();

            players.forEach((player, index) => {
                const playerId = player?.id || `player${index + 1}`;
                const playerName = player?.name || `Player ${index + 1}`;
                const zoneCards = Array.isArray(player?.[config.zoneKey])
                    ? player[config.zoneKey]
                    : (Array.isArray(player?.[zoneType]) ? player[zoneType] : []);
                const elements = this._getZonePopupElements(zoneType, playerId, playerName);
                if (!elements) {
                    return;
                }

                seen.add(playerId);

                const isOpponent = selectedPlayer === 'spectator'
                    ? false
                    : (selectedPlayer !== playerId);
                const isControlled = selectedPlayer !== 'spectator' && !isOpponent;

                if (!zoneCards.length) {
                    elements.panel.classList.add('hidden');
                    elements.panel.setAttribute('aria-hidden', 'true');
                    elements.panel.dataset.appear = 'hidden';
                    delete elements.panel.dataset.userMoved;
                    return;
                }

                // For look zone, opponent sees cards face-down
                const showFaceDown = zoneType === 'look' && isOpponent;

                elements.body.innerHTML = this._generateZoneContent(zoneCards, isOpponent, playerId, {
                    zoneContext: zoneType,
                    showFaceDown
                });
                elements.countLabel.textContent = String(zoneCards.length);
                elements.titleLabel.textContent = `${config.title} - ${playerName}`;
                elements.panel.classList.remove('hidden');
                elements.panel.setAttribute('aria-hidden', 'false');
                elements.panel.dataset.appear = 'visible';

                // Show/hide action button based on whether user controls this zone
                if (elements.actionBtn) {
                    if (isControlled) {
                        elements.actionBtn.classList.remove('hidden');
                    } else {
                        elements.actionBtn.classList.add('hidden');
                    }
                }

                const computedWidth = this._calculateRevealPopupWidth(zoneCards.length);
                if (computedWidth) {
                    elements.panel.style.width = `${computedWidth}px`;
                }

                this._applyPopupSearch(elements.panel);

                if (elements.panel.dataset.userMoved !== 'true') {
                    this._positionRevealPopup(elements.panel, index, isControlled);
                }
            });

            this[cacheKey].forEach((elements, playerId) => {
                if (!seen.has(playerId)) {
                    elements.panel.classList.add('hidden');
                    elements.panel.setAttribute('aria-hidden', 'true');
                    elements.panel.dataset.appear = 'hidden';
                    delete elements.panel.dataset.userMoved;
                }
            });
        }

        static _getZoneConfig(zoneType) {
            const configs = {
                reveal: { zoneKey: 'reveal_zone', title: 'Reveal', icon: '👁️', emptyText: 'No cards revealed' },
                look: { zoneKey: 'look_zone', title: 'Look', icon: '🕵️', emptyText: 'No cards to look at' }
            };
            return configs[zoneType] || configs.reveal;
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
            const list = panel.querySelector('.zone-card-list');
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

        static _getZonePopupElements(zoneType, playerId, playerName) {
            if (!playerId) {
                return null;
            }

            const config = this._getZoneConfig(zoneType);
            const cacheKey = `_${zoneType}PopupElements`;
            if (!this[cacheKey]) {
                this[cacheKey] = new Map();
            }

            if (this[cacheKey].has(playerId)) {
                const existing = this[cacheKey].get(playerId);
                if (existing?.titleLabel) {
                    existing.titleLabel.textContent = `${config.title} - ${playerName}`;
                }
                this._ensurePopupSearchElements(existing?.panel);
                this._initializePopupSearch(existing?.panel);
                return existing;
            }

            const safeName = GameUtils.escapeHtml(playerName || 'Player');
            const actionName = zoneType === 'look' ? 'lookTopLibrary' : 'revealTopLibrary';
            const actionLabel = zoneType === 'look' ? 'Look from Library' : 'Reveal from Library';
            const panel = document.createElement('div');
            panel.id = `${zoneType}-popup-${playerId}`;
            panel.className = `stack-popup ${zoneType}-popup hidden`;
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', `${config.title} - ${playerName}`);
            panel.setAttribute('aria-hidden', 'true');
            panel.dataset.playerId = playerId;
            panel.innerHTML = `
                <div class="stack-popup-header ${zoneType}-popup-header" data-draggable-handle>
                    <div class="stack-popup-title ${zoneType}-popup-title">
                        <span class="stack-popup-icon ${zoneType}-popup-icon">${config.icon}</span>
                        <span class="stack-popup-label ${zoneType}-popup-label">${config.title} - ${safeName}</span>
                        <span class="stack-popup-count ${zoneType}-popup-count" id="${zoneType}-popup-count-${playerId}">0</span>
                        <button class="zone-popup-action-btn hidden" data-action="${actionName}" title="${actionLabel}">
                            ${actionLabel}
                        </button>
                    </div>
                </div>
                <div class="popup-search-container">
                    <input type="search" class="popup-card-search-input" placeholder="Search cards" aria-label="Search ${zoneType} cards">
                </div>
                <div class="stack-popup-body ${zoneType}-popup-body" id="${zoneType}-popup-body-${playerId}"></div>
                <div class="popup-search-empty hidden">No cards match your search</div>
            `;
            document.body.appendChild(panel);

            const handle = panel.querySelector('[data-draggable-handle]');
            const body = panel.querySelector(`#${zoneType}-popup-body-${playerId}`);
            const countLabel = panel.querySelector(`#${zoneType}-popup-count-${playerId}`);
            const titleLabel = panel.querySelector(`.${zoneType}-popup-label`);
            const actionBtn = panel.querySelector('.zone-popup-action-btn');

            // Add click handler for the action button
            if (actionBtn) {
                actionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = actionBtn.dataset.action;
                    if (window.GameActions && typeof window.GameActions[action] === 'function') {
                        window.GameActions[action]();
                    }
                });
            }

            this._makePopupDraggable(panel, handle);
            this._initializePopupSearch(panel);

            const elements = { panel, body, countLabel, titleLabel, actionBtn };
            this[cacheKey].set(playerId, elements);
            return elements;
        }

        static _generateZoneContent(cards, isOpponent, playerId, options = {}) {
            const zoneContext = options.zoneContext || 'reveal';
            const showFaceDown = options.showFaceDown || false;
            const config = this._getZoneConfig(zoneContext);
            const allowDrop = !isOpponent;
            const listAttributes = allowDrop
                ? `data-zone-context="${zoneContext}" data-zone-owner="${playerId}" ondragover="UIZonesManager.handlePopupDragOver(event)" ondragleave="UIZonesManager.handlePopupDragLeave(event)" ondrop="UIZonesManager.handlePopupDrop(event, '${zoneContext}')"`
                : `data-zone-context="${zoneContext}" data-zone-owner="${playerId}"`;

            if (!Array.isArray(cards) || cards.length === 0) {
                const emptyState = `<div class="${zoneContext}-empty">${config.emptyText}</div>`;
                if (!allowDrop) {
                    return emptyState;
                }
                return `
                    <div class="${zoneContext}-card-container">
                        <div class="${zoneContext}-card-list zone-card-list zone-card-list-empty" ${listAttributes} data-card-count="0">
                            ${emptyState}
                        </div>
                    </div>
                `;
            }

            const cardsHtml = cards.map((card, index) => {
                // If showFaceDown, render as face-down card for opponent
                const cardToRender = showFaceDown
                    ? { ...card, is_face_down: true, face_down_controller: card.owner_id || card.controller_id || playerId }
                    : card;
                return GameCards.renderCardWithLoadingState(cardToRender, 'card-battlefield', true, zoneContext, isOpponent, index, playerId);
            }).join('');

            return `
                <div class="${zoneContext}-card-container">
                    <div class="${zoneContext}-card-list zone-card-list" ${listAttributes} data-card-count="${cards.length}">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }

        static _positionRevealPopup(panel, index, isControlled) {
            if (!panel) {
                return;
            }

            // Position relative to stack-area (zones sidebar), fallback to game-board
            const stackArea = document.getElementById('stack-area');
            const board = document.getElementById('game-board');
            const referenceElement = stackArea || board;
            if (!referenceElement) {
                return;
            }

            const padding = 16;
            const offset = 24;
            const refRect = referenceElement.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const panelHeight = panelRect.height || panel.offsetHeight || 0;
            const panelWidth = panelRect.width || panel.offsetWidth || 0;

            let top;
            let left;

            // Position to the right of the reference element
            left = refRect.right + padding;

            if (isControlled) {
                // Position near the bottom for controlled player
                top = refRect.bottom - panelHeight - padding;
            } else {
                // Stack popups for opponent(s)
                top = refRect.top + padding + (index * (panelHeight + offset));
            }

            top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));
            left = Math.max(padding, Math.min(left, window.innerWidth - panelWidth - padding));

            panel.style.top = `${top}px`;
            panel.style.left = `${left}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.transform = 'none';
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
            const placeholderHandSize = Math.max(actualHandSize, 0);
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
        static _preloadCardImages(_players) {
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

    function installGlobals() {
        if (typeof window === 'undefined') {
            return;
        }
        window.UIRenderers = UIRenderersTemplates;
        window.UITemplates = UIRenderersTemplates;
        window.UIGameInterface = UIRenderersTemplates;
        window.UIRenderersTemplates = UIRenderersTemplates;
    }

    onMount(() => {
        installGlobals();
    });
</script>
