<script>
    import DeckZone from './DeckZone.svelte';
    import GraveyardZone from './GraveyardZone.svelte';
    import ExileZone from './ExileZone.svelte';
    import LifeZone from './LifeZone.svelte';

    let {
        gameState = null,
        selectedPlayer = 'player1'
    } = $props();

    const zoneContainerClass =
        UIConfig?.CSS_CLASSES?.zone?.container || 'zone-item';

    const playerContext = $derived(() => {
        if (!gameState) {
            return null;
        }
        return computePlayerContext(gameState, selectedPlayer);
    });

    const sidebarData = $derived(() => {
        const context = playerContext();
        if (!context) {
            return null;
        }
        const { players, controlledIdx, opponentIdx } = context;
        return {
            opponent: buildSidebarSection(players[opponentIdx], opponentIdx, true),
            player: buildSidebarSection(players[controlledIdx], controlledIdx, false)
        };
    });

    const boardData = $derived(() => {
        if (!gameState) {
            return null;
        }
        try {
            return buildBoardData(gameState, selectedPlayer);
        } catch (error) {
            console.error('[GameArena] failed to prepare board data', error);
            return null;
        }
    });

    const boardHydrated = $derived(() => {
        return boardData() ? 'true' : 'false';
    });

    function buildBoardData(state, playerSelection) {
        const { players, controlledIdx, opponentIdx, activePlayer } = computePlayerContext(state, playerSelection);
        if (!players.length) {
            return null;
        }

        return {
            opponent: buildBoardSide(players[opponentIdx], opponentIdx, true, activePlayer, playerSelection),
            player: buildBoardSide(players[controlledIdx], controlledIdx, false, activePlayer, playerSelection)
        };
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

    function buildSidebarSection(playerData, playerIndex, isOpponent) {
        if (!playerData) {
            return null;
        }
        const index = typeof playerIndex === 'number'
            ? playerIndex
            : (isOpponent ? 1 : 0);
        return {
            playerName: getPlayerDisplayName(playerData, getSeatFallbackName(index)),
            zones: buildSidebarZones(playerData, playerIndex, isOpponent)
        };
    }

    function buildSidebarZones(playerData, playerIndex, isOpponent) {
        const ownerId = resolvePlayerOwnerId(playerData, playerIndex, isOpponent);
        const deckCards = getDeckCards(playerData);
        const deckConfig = getDeckConfig(deckCards, isOpponent);
        const graveyardCards = Array.isArray(playerData?.graveyard) ? playerData.graveyard : [];
        const graveyardConfig = getGraveyardConfig(graveyardCards, isOpponent);
        const exileCards = Array.isArray(playerData?.exile) ? playerData.exile : [];
        const exileConfig = getExileConfig(exileCards, isOpponent);
        const lifeConfig = getLifeConfig(playerData, ownerId);

        return [
            buildZoneDescriptor('exile', ExileZone, {
                cards: exileCards,
                cardsRemaining: exileConfig.cardsRemaining,
                overlayHtml: exileConfig.overlayHtml,
                topCard: exileConfig.topCard,
                zoneIdentifier: exileConfig.zoneIdentifier,
                onClick: exileConfig.clickHandler
            }),
            buildZoneDescriptor('graveyard', GraveyardZone, {
                cards: graveyardCards,
                cardsRemaining: graveyardConfig.cardsRemaining,
                overlayHtml: graveyardConfig.overlayHtml,
                zoneIdentifier: graveyardConfig.zoneIdentifier,
                onClick: graveyardConfig.clickHandler
            }),
            buildZoneDescriptor('deck', DeckZone, {
                cardsRemaining: deckConfig.cardsRemaining,
                deckClass: deckConfig.deckClass,
                zoneIdentifier: deckConfig.zoneIdentifier,
                overlayText: deckConfig.overlayText,
                onClick: deckConfig.onClick
            }),
            buildZoneDescriptor('life', LifeZone, {
                life: lifeConfig.life,
                playerId: lifeConfig.playerId,
                negativeControls: lifeConfig.negativeControls,
                positiveControls: lifeConfig.positiveControls,
                hasCustomLifeControls: lifeConfig.hasCustomLifeControls,
                counters: lifeConfig.counters,
                manageButton: lifeConfig.manageButton
            })
        ];
    }

    function buildZoneDescriptor(zoneKey, component, props) {
        return {
            key: zoneKey,
            component,
            props,
            label: getZoneInfo(zoneKey)
        };
    }

    function getZoneInfo(zoneKey) {
        const info = UIZonesManager?.ZONE_INFO?.[zoneKey];
        if (info) {
            return {
                title: info.title,
                icon: info.icon
            };
        }
        const normalized = zoneKey
            ? `${zoneKey.charAt(0).toUpperCase()}${zoneKey.slice(1)}`
            : 'Zone';
        return {
            title: normalized,
            icon: ''
        };
    }

    function getDeckCards(playerData = {}) {
        const library = Array.isArray(playerData?.library) ? playerData.library : [];
        if (library.length > 0) {
            return library;
        }
        return Array.isArray(playerData?.deck) ? playerData.deck : [];
    }

    function getDeckConfig(deckCards, isOpponent) {
        if (typeof ZoneData?.getDeckZoneConfig === 'function') {
            return ZoneData.getDeckZoneConfig(deckCards, isOpponent);
        }
        const cardsRemaining = Array.isArray(deckCards) ? deckCards.length : 0;
        return {
            cardsRemaining,
            overlayText: isOpponent ? 'View' : 'Draw',
            onClick: null,
            deckClass: isOpponent ? 'deck-cards-stack opponent-deck' : 'deck-cards-stack',
            zoneIdentifier: isOpponent ? 'opponent_deck' : 'deck'
        };
    }

    function getGraveyardConfig(graveyardCards, isOpponent) {
        if (typeof ZoneData?.getGraveyardZoneConfig === 'function') {
            return ZoneData.getGraveyardZoneConfig(graveyardCards, isOpponent);
        }
        return {
            cardsRemaining: Array.isArray(graveyardCards) ? graveyardCards.length : 0,
            graveyardArray: Array.isArray(graveyardCards) ? graveyardCards : [],
            overlayHtml: 'View<br>All',
            zoneIdentifier: isOpponent ? 'opponent_graveyard' : 'graveyard',
            clickHandler: null
        };
    }

    function getExileConfig(exileCards, isOpponent) {
        if (typeof ZoneData?.getExileZoneConfig === 'function') {
            return ZoneData.getExileZoneConfig(exileCards, isOpponent);
        }
        return {
            cardsRemaining: Array.isArray(exileCards) ? exileCards.length : 0,
            exileArray: Array.isArray(exileCards) ? exileCards : [],
            overlayHtml: 'View<br>All',
            zoneIdentifier: isOpponent ? 'opponent_exile' : 'exile',
            clickHandler: null,
            topCard: Array.isArray(exileCards) && exileCards.length
                ? exileCards[exileCards.length - 1]
                : null
        };
    }

    function getLifeConfig(playerData, ownerId) {
        if (typeof ZoneData?.getLifeZoneConfig === 'function') {
            return ZoneData.getLifeZoneConfig(playerData, ownerId);
        }
        const lifeValue = typeof playerData?.life === 'number'
            ? playerData.life
            : 20;
        return {
            life: lifeValue,
            playerId: ownerId || 'player1',
            negativeControls: [],
            positiveControls: [],
            hasCustomLifeControls: false,
            counters: [],
            manageButton: null
        };
    }

    function buildBoardSide(playerData = {}, playerIndex, isOpponent, activePlayer, playerSelection) {
        const ownerId = resolvePlayerOwnerId(playerData, playerIndex, isOpponent);
        const normalizedIndex = typeof playerIndex === 'number'
            ? playerIndex
            : (isOpponent ? 1 : 0);
        const hand = buildHandData(playerData, normalizedIndex, isOpponent, playerSelection);
        const battlefieldZones = buildBattlefieldZones(playerData?.battlefield, ownerId, isOpponent);
        return {
            ownerId,
            index: normalizedIndex,
            isOpponent,
            isActive: activePlayer === normalizedIndex,
            hand,
            battlefieldZones
        };
    }

    function buildHandData(playerData = {}, playerIndex, isOpponent, playerSelection) {
        const cards = Array.isArray(playerData?.hand) ? playerData.hand : [];
        if (isOpponent) {
            const isSpectatorView = playerSelection === 'spectator';
            const placeholderSize = cards.length;
            return {
                cardCount: isSpectatorView ? cards.length : placeholderSize,
                mode: isSpectatorView ? 'spectator' : 'hidden',
                html: isSpectatorView
                    ? generatePlayerHand(cards, playerIndex, { isOpponent: true, readOnly: true }, playerSelection)
                    : generateOpponentHand(placeholderSize)
            };
        }

        return {
            cardCount: cards.length,
            mode: 'player',
            html: generatePlayerHand(cards, playerIndex, {}, playerSelection)
        };
    }

    function getCardUniqueId(card) {
        if (!card) {
            return null;
        }
        return card.unique_id || card.uniqueId || null;
    }

    function buildAttachmentsMap(cards = []) {
        const indexLookup = new Map();
        cards.forEach((card, index) => {
            const uid = getCardUniqueId(card);
            if (uid) {
                indexLookup.set(uid, index);
            }
        });

        const attachments = new Map();
        const parseOrder = (value) => {
            const parsed = parseInt(value, 10);
            return Number.isFinite(parsed) ? parsed : null;
        };

        cards.forEach((card) => {
            const hostId = card?.attached_to || card?.attachedTo;
            if (!hostId) {
                return;
            }
            const list = attachments.get(hostId) || [];
            list.push(card);
            attachments.set(hostId, list);
        });

        attachments.forEach((list, hostId) => {
            list.sort((a, b) => {
                const orderA = parseOrder(a?.attachment_order ?? a?.attachmentOrder);
                const orderB = parseOrder(b?.attachment_order ?? b?.attachmentOrder);
                if (orderA !== null && orderB !== null && orderA !== orderB) {
                    return orderA - orderB;
                }
                const idxA = indexLookup.get(getCardUniqueId(a)) ?? 0;
                const idxB = indexLookup.get(getCardUniqueId(b)) ?? 0;
                return idxA - idxB;
            });
        });

        return attachments;
    }

    function buildBattlefieldZones(battlefieldCards, ownerId, isOpponent) {
        const cards = Array.isArray(battlefieldCards) ? battlefieldCards : [];
        const sanitizedOwner = typeof GameUtils?.escapeHtml === 'function'
            ? GameUtils.escapeHtml(ownerId)
            : ownerId;
        const playerRole = isOpponent ? 'opponent' : 'player';
        const zoneNames = ['lands', 'creatures', 'support'];
        const attachmentsByHost = buildAttachmentsMap(cards);
        const hostCards = cards.filter((card) => !card?.attached_to && !card?.attachedTo);

        return zoneNames.map((zoneName) => {
            const filteredCards = typeof UIUtils?.filterCardsByType === 'function'
                ? UIUtils.filterCardsByType(hostCards, zoneName)
                : hostCards;
            const cardCount = filteredCards.reduce((count, card) => {
                const uid = getCardUniqueId(card);
                const attachments = uid ? (attachmentsByHost.get(uid) || []) : [];
                return count + 1 + attachments.length;
            }, 0);
            const cardsHtml = filteredCards.map((card) => {
                const uid = getCardUniqueId(card);
                const cardAttachments = uid ? (attachmentsByHost.get(uid) || []) : [];
                if (typeof GameCards?.renderCardWithAttachments === 'function') {
                    return GameCards.renderCardWithAttachments(
                        card,
                        cardAttachments,
                        zoneName,
                        isOpponent,
                        ownerId
                    );
                }
                return GameCards.renderCardWithLoadingState(
                    card,
                    'card-battlefield',
                    true,
                    zoneName,
                    isOpponent,
                    null,
                    ownerId
                );
            }).join('');

            return {
                key: zoneName,
                zoneClass: `battlefield-zone ${zoneName}-zone compact-zones`,
                contentClass: `${zoneName}-zone-content zone-content`,
                ownerId: sanitizedOwner,
                playerRole,
                cardCount,
                dropTarget: zoneName,
                cardsHtml
            };
        });
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

    function generateOpponentHand(handSize = 0) {
        const count = Number.isFinite(handSize) && handSize > 0 ? handSize : 0;
        if (count === 0) {
            return '';
        }
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
        {#if sidebarData()}
            {@const sidebar = sidebarData()}
            {#if sidebar.opponent}
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>{sidebar.opponent.playerName}
                    </h4>
                    {#if Array.isArray(sidebar.opponent.zones) && sidebar.opponent.zones.length}
                        <div class="card-zones-container">
                            {#each sidebar.opponent.zones as zone (zone.key)}
                                <div class={`${zoneContainerClass} ${zone.key}-zone`}>
                                    {#if zone.key !== 'life'}
                                        <div class="zone-label w-full flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-arena-text-dim mb-2">
                                            {#if zone.label?.icon}
                                                <span class="text-base leading-none">{zone.label.icon}</span>
                                            {/if}
                                            <span>{zone.label?.title || zone.key}</span>
                                        </div>
                                    {/if}
                                    {#if zone.component}
                                        {@const ZoneComponent = zone.component}
                                        <ZoneComponent {...zone.props} />
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-sm text-center py-4 text-arena-text-dim">
                            No zones available
                        </div>
                    {/if}
                </div>
            {/if}

            <div id="action-panel" class="arena-card rounded-lg p-4 mb-3"></div>

            {#if sidebar.player}
                <div class="arena-card rounded-lg p-3 mb-3">
                    <h4 class="font-magic font-semibold mb-2 text-arena-accent text-sm flex items-center">
                        <span class="mr-1">📚</span>{sidebar.player.playerName}
                    </h4>
                    {#if Array.isArray(sidebar.player.zones) && sidebar.player.zones.length}
                        <div class="card-zones-container">
                            {#each sidebar.player.zones as zone (zone.key)}
                                <div class={`${zoneContainerClass} ${zone.key}-zone`}>
                                    {#if zone.key !== 'life'}
                                        <div class="zone-label w-full flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-arena-text-dim mb-2">
                                            {#if zone.label?.icon}
                                                <span class="text-base leading-none">{zone.label.icon}</span>
                                            {/if}
                                            <span>{zone.label?.title || zone.key}</span>
                                        </div>
                                    {/if}
                                    {#if zone.component}
                                        {@const ZoneComponent = zone.component}
                                        <ZoneComponent {...zone.props} />
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-sm text-center py-4 text-arena-text-dim">
                            No zones available
                        </div>
                    {/if}
                </div>
            {/if}
        {:else}
            <div class="arena-card rounded-lg p-3 mb-3">
                {@html generateErrorTemplate('Game State', 'Waiting for game data')}
            </div>
            <div id="action-panel" class="arena-card rounded-lg p-4 mb-3"></div>
        {/if}
    </div>

    <div class="xl:col-span-2" id="game-board" data-board-hydrated={boardHydrated()}>
        {#if boardData()}
            {@const board = boardData()}
            {#if board.opponent}
                <div
                    class={`arena-card rounded-lg mb-3 p-3 compact-zones ${board.opponent.isActive ? 'opponent-zone-active-turn' : ''}`}
                    data-player-zone="opponent"
                    data-player-owner={board.opponent.ownerId}>
                    <div
                        class="opponent-hand-zone space-x-1 overflow-x-auto py-1"
                        data-card-count={board.opponent.hand.cardCount}
                        data-player-owner={board.opponent.ownerId}
                        data-hand-mode={board.opponent.hand.mode}
                        data-zone-type="opponent-hand">
                        {@html board.opponent.hand.html}
                    </div>

                    <div class="battlefield-layout battlefield-layout-opponent">
                        {#each board.opponent.battlefieldZones as zone (zone.key)}
                            <div
                                class={zone.zoneClass}
                                role="region"
                                aria-label={`${zone.playerRole} ${zone.key} zone`}
                                data-battlefield-zone={zone.key}
                                data-zone-owner={zone.ownerId}
                                data-player-role={zone.playerRole}
                                ondragover={(event) => UIZonesManager.handleZoneDragOver(event)}
                                ondragleave={(event) => UIZonesManager.handleZoneDragLeave(event)}
                                ondrop={(event) => UIZonesManager.handleZoneDrop(event, zone.dropTarget)}>
                                <div
                                    class={zone.contentClass}
                                    data-card-count={zone.cardCount}
                                    data-zone-owner={zone.ownerId}
                                    data-player-role={zone.playerRole}>
                                    {@html zone.cardsHtml}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if board.player}
                <div
                    class={`arena-card rounded-lg p-3 hand-zone ${board.player.isActive ? 'player-zone-active-turn' : ''}`}
                    data-player-zone="player"
                    data-player-owner={board.player.ownerId}>
                    <div class="battlefield-layout">
                        {#each board.player.battlefieldZones as zone (zone.key)}
                            <div
                                class={zone.zoneClass}
                                role="region"
                                aria-label={`${zone.playerRole} ${zone.key} zone`}
                                data-battlefield-zone={zone.key}
                                data-zone-owner={zone.ownerId}
                                data-player-role={zone.playerRole}
                                ondragover={(event) => UIZonesManager.handleZoneDragOver(event)}
                                ondragleave={(event) => UIZonesManager.handleZoneDragLeave(event)}
                                ondrop={(event) => UIZonesManager.handleZoneDrop(event, zone.dropTarget)}>
                                <div
                                    class={zone.contentClass}
                                    data-card-count={zone.cardCount}
                                    data-zone-owner={zone.ownerId}
                                    data-player-role={zone.playerRole}>
                                    {@html zone.cardsHtml}
                                </div>
                            </div>
                        {/each}
                    </div>

                    <div
                        class="hand-zone-content zone-content"
                        role="region"
                        aria-label="player hand zone"
                        data-card-count={board.player.hand.cardCount}
                        data-zone-type="hand"
                        data-player-owner={board.player.ownerId}
                        ondragover={(event) => UIZonesManager.handleZoneDragOver(event)}
                        ondrop={(event) => UIZonesManager.handleZoneDrop(event, 'hand')}>
                        {@html board.player.hand.html}
                    </div>
                </div>
            {/if}
        {:else}
            {@html generateErrorTemplate('Game Board', 'Waiting for game data')}
        {/if}
    </div>

    <div class="xl:col-span-1 space-y-3" id="right-sidebar">
        <div id="action-history-panel"></div>
        <div id="battle-chat-panel"></div>
    </div>
</div>
