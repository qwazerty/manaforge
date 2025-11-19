<script>
    let {
        gameState = null,
        selectedPlayer = 'player1'
    } = $props();

    const leftSidebarMarkup = $derived(() => {
        if (!gameState) {
            return generateErrorTemplate('Game State', 'Waiting for game data');
        }
        try {
            return buildLeftSidebarMarkup(gameState, selectedPlayer);
        } catch (error) {
            console.error('[GameArena] failed to render left sidebar', error);
            return generateErrorTemplate('Left Sidebar', error?.message || 'Unable to render sidebar');
        }
    });

    const boardMarkup = $derived(() => {
        if (!gameState) {
            return generateErrorTemplate('Game Board', 'Waiting for game data');
        }
        try {
            return buildBoardMarkup(gameState, selectedPlayer);
        } catch (error) {
            console.error('[GameArena] failed to render board', error);
            return generateErrorTemplate('Game Board', error?.message || 'Unable to render board');
        }
    });

    const boardHydrated = $derived(() => {
        const markup = boardMarkup() || '';
        return markup.trim().length ? 'true' : 'false';
    });

    function buildLeftSidebarMarkup(state, playerSelection) {
        const { players, controlledIdx, opponentIdx } = computePlayerContext(state, playerSelection);
        if (!players.length) {
            return generateErrorTemplate('Players', 'No players are available in this match.');
        }

        const opponent = players[opponentIdx] || {};
        const player = players[controlledIdx] || {};
        const opponentName = getPlayerDisplayName(opponent, getSeatFallbackName(opponentIdx));
        const playerName = getPlayerDisplayName(player, getSeatFallbackName(controlledIdx));

        const opponentZones = generateCardZones(opponent, true, opponentIdx);
        const playerZones = generateCardZones(player, false, controlledIdx);

        return `
            <div class="arena-card rounded-lg p-3 mb-3">
                <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                    <span class="mr-1">📚</span>${opponentName}
                </h4>
                ${opponentZones}
            </div>

            <div id="action-panel" class="arena-card rounded-lg p-4 mb-3"></div>

            <div class="arena-card rounded-lg p-3 mb-3">
                <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                    <span class="mr-1">📚</span>${playerName}
                </h4>
                ${playerZones}
            </div>
        `;
    }

    function buildBoardMarkup(state, playerSelection) {
        const { players, controlledIdx, opponentIdx, activePlayer } = computePlayerContext(state, playerSelection);
        if (!players.length) {
            return generateErrorTemplate('Game Board', 'Missing player information');
        }

        const opponent = players[opponentIdx] || {};
        const player = players[controlledIdx] || {};

        const opponentArea = renderOpponentArea(opponent, opponentIdx, activePlayer, playerSelection);
        const playerArea = renderPlayerArea(player, controlledIdx, activePlayer, playerSelection);

        return `${opponentArea}${playerArea}`;
    }

    function computePlayerContext(state, playerSelection) {
        const players = Array.isArray(state?.players) ? state.players : [];
        let controlledIdx = 0;
        if (playerSelection === 'player2') {
            controlledIdx = 1;
        } else if (playerSelection !== 'player1') {
            controlledIdx = 0;
        }
        const opponentIdx = controlledIdx === 0 ? 1 : 0;
        const activePlayer = typeof state?.active_player === 'number'
            ? state.active_player
            : 0;

        return {
            players,
            controlledIdx,
            opponentIdx,
            activePlayer
        };
    }

    function getSeatFallbackName(index) {
        if (index === 0) return 'Player 1';
        if (index === 1) return 'Player 2';
        return 'Player';
    }

    function getPlayerDisplayName(playerData, fallback = 'Player') {
        const rawName = typeof playerData?.name === 'string' ? playerData.name.trim() : '';
        return rawName || fallback;
    }

    function generateCardZones(playerData, isOpponent = false, playerIndex = null) {
        const playerName = getPlayerDisplayName(playerData, isOpponent ? 'Opponent' : 'Player');
        const config = typeof UIUtils !== 'undefined' && typeof UIUtils.getZoneConfiguration === 'function'
            ? UIUtils.getZoneConfiguration(isOpponent, playerIndex, playerName)
            : null;

        if (!config) {
            return generateErrorTemplate('Zones', 'Zone configuration unavailable');
        }

        const zoneTemplates = generateZoneTemplates(playerData, config, isOpponent);
        const zoneOrder = ['exile', 'graveyard', 'deck', 'life'];
        const orderedZones = zoneOrder.map((zoneName) => zoneTemplates[zoneName] || '');

        return `
            <div class="card-zones-container">
                ${orderedZones.join('')}
            </div>
        `;
    }

    function generateZoneTemplates(playerData, config, isOpponent) {
        const { titlePrefix, playerId } = config;
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
            life: typeof UIZonesManager?.generateLifeZone === 'function'
                ? UIZonesManager.generateLifeZone(safePlayerData, playerId, titlePrefix)
                : '',
            deck: typeof UIZonesManager?.generateDeckZone === 'function'
                ? UIZonesManager.generateDeckZone(deckData, isOpponent)
                : '',
            graveyard: typeof UIZonesManager?.generateGraveyardZone === 'function'
                ? UIZonesManager.generateGraveyardZone(graveyard, isOpponent)
                : '',
            exile: typeof UIZonesManager?.generateExileZone === 'function'
                ? UIZonesManager.generateExileZone(exile, isOpponent)
                : ''
        };
    }

    function renderOpponentArea(opponent, opponentIdx, activePlayer, playerSelection) {
        const actualHandSize = Array.isArray(opponent?.hand) ? opponent.hand.length : 0;
        const placeholderHandSize = actualHandSize || 7;
        const isOpponentActiveTurn = activePlayer === opponentIdx;
        const activeTurnClass = isOpponentActiveTurn ? 'opponent-zone-active-turn' : '';
        const isSpectatorView = playerSelection === 'spectator';
        const ownerId = resolvePlayerOwnerId(opponent, opponentIdx, true);
        const opponentHandHtml = isSpectatorView
            ? generatePlayerHand(opponent?.hand || [], opponentIdx, {
                isOpponent: true,
                readOnly: true
            }, playerSelection)
            : generateOpponentHand(placeholderHandSize);
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

                ${generateBattlefieldLayout(opponent?.battlefield, true, ownerId)}
            </div>
        `;
    }

    function renderPlayerArea(player, controlledIdx, activePlayer, playerSelection) {
        const handSize = Array.isArray(player?.hand) ? player.hand.length : 0;
        const isPlayerActiveTurn = activePlayer === controlledIdx;
        const activeTurnClass = isPlayerActiveTurn ? 'player-zone-active-turn' : '';
        const ownerId = resolvePlayerOwnerId(player, controlledIdx, false);

        return `
            <div class="arena-card rounded-lg p-3 hand-zone ${activeTurnClass}"
                data-player-zone="player"
                data-player-owner="${ownerId}">
                ${generateBattlefieldLayout(player?.battlefield, false, ownerId)}

                <div class="hand-zone-content zone-content"
                    data-card-count="${handSize}"
                    data-zone-type="hand"
                    data-player-owner="${ownerId}"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, 'hand')">
                    ${generatePlayerHand(player?.hand || [], controlledIdx, {}, playerSelection)}
                </div>
            </div>
        `;
    }

    function generateBattlefieldLayout(cards, isOpponent, playerId = null) {
        const layoutClasses = ['battlefield-layout'];
        if (isOpponent) {
            layoutClasses.push('battlefield-layout-opponent');
        }

        return `
            <div class="${layoutClasses.join(' ')}">
                ${generateBattlefieldZone(cards, 'lands', isOpponent, playerId)}
                ${generateBattlefieldZone(cards, 'creatures', isOpponent, playerId)}
                ${generateBattlefieldZone(cards, 'support', isOpponent, playerId)}
            </div>
        `;
    }

    function generateBattlefieldZone(cards, zoneName, isOpponent, playerId = null) {
        const filteredCards = typeof UIUtils?.filterCardsByType === 'function'
            ? UIUtils.filterCardsByType(cards, zoneName)
            : Array.isArray(cards)
                ? cards
                : [];
        const cardCount = filteredCards.length;
        const ownerId = playerId || (isOpponent ? 'player2' : 'player1');
        const sanitizedOwner = typeof GameUtils?.escapeHtml === 'function'
            ? GameUtils.escapeHtml(ownerId)
            : ownerId;
        const playerRole = isOpponent ? 'opponent' : 'player';
        const cardsHtml = filteredCards.map((card) => {
            return GameCards.renderCardWithLoadingState(
                card,
                'card-battlefield',
                true,
                zoneName,
                isOpponent,
                null,
                playerId
            );
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

    function generatePlayerHand(hand = [], playerId = null, options = {}, playerSelection = 'player1') {
        const cards = Array.isArray(hand) ? hand : [];
        if (!cards.length) {
            return '<div class="text-arena-text-dim text-center py-4">No cards in hand</div>';
        }

        const { isOpponent = false, readOnly = null } = options;
        const isSpectator = playerSelection === 'spectator';
        const forceReadOnly = readOnly === null ? isSpectator : readOnly;

        return cards.map((card, index) =>
            GameCards.renderCardWithLoadingState(
                card,
                UIConfig?.CSS_CLASSES?.card?.mini || 'card-mini',
                false,
                'hand',
                isOpponent,
                index,
                playerId,
                { readOnly: forceReadOnly }
            )
        ).join('');
    }

    function generateOpponentHand(handSize = 7) {
        const count = Number.isFinite(handSize) && handSize > 0 ? handSize : 7;
        return Array.from({ length: count }).map((_, index) => `
            <div class="card-back opponent-hand-card"
                 data-card-id="opponent-card-${index}"
                 style="width: 60px; height: 84px; ${UIUtils?.createTransform
                     ? UIUtils.createTransform(0, 0, index % 2 === 0 ? -2 : 2)
                     : ''}">
            </div>
        `).join('');
    }

    function resolvePlayerOwnerId(playerData, playerIndex, isOpponent) {
        if (playerData && typeof playerData.id === 'string') {
            return playerData.id;
        }
        if (typeof playerIndex === 'number' && !Number.isNaN(playerIndex)) {
            return `player${playerIndex + 1}`;
        }
        return isOpponent ? 'player2' : 'player1';
    }

    function generateErrorTemplate(title, message) {
        return `
            <div class="arena-card rounded-xl p-6 text-center">
                <h3 class="text-red-400 font-bold mb-2">⚠️ ${title}</h3>
                <p class="text-arena-text-dim">${message}</p>
            </div>
        `;
    }
</script>

<div class="grid grid-cols-1 xl:grid-cols-4 gap-4 flex-grow h-full">
    <div class="xl:col-span-1" id="stack-area">
        {@html leftSidebarMarkup()}
    </div>

    <div class="xl:col-span-2" id="game-board" data-board-hydrated={boardHydrated()}>
        {@html boardMarkup()}
    </div>

    <div class="xl:col-span-1 space-y-3" id="right-sidebar">
        <div id="action-history-panel"></div>
        <div id="battle-chat-panel"></div>
    </div>
</div>
