<script>
    /**
     * CommanderZones component
     * Displays both player and opponent commander zones inline in the sidebar
     * Used in commander formats instead of popup-based commander display
     */

    let {
        gameState = null,
        selectedPlayer = 'player1',
        panelTitle = 'Commander Zones',
        panelIcon = '👑'
    } = $props();

    const isSpectator = $derived(selectedPlayer === 'spectator');

    const getPlayerDisplayName = (playerData, fallback = 'Player') => {
        const rawName = typeof playerData?.name === 'string' ? playerData.name.trim() : '';
        return rawName || fallback;
    };

    const getSeatFallbackName = (index) => {
        if (index === 0) return 'Player 1';
        if (index === 1) return 'Player 2';
        return 'Player';
    };

    const getOwnerId = (playerData, index) => {
        if (playerData?.id && typeof playerData.id === 'string') {
            return playerData.id;
        }
        return `player${index + 1}`;
    };

    const buildCommanderZoneData = (playerData, playerIndex) => {
        if (!playerData) {
            return null;
        }

        const commanderCards = Array.isArray(playerData.commander_zone)
            ? playerData.commander_zone
            : [];
        const commanderTax = Number.isFinite(Number(playerData.commander_tax))
            ? Number(playerData.commander_tax)
            : 0;
        const ownerId = getOwnerId(playerData, playerIndex);
        const displayName = getPlayerDisplayName(playerData, getSeatFallbackName(playerIndex));

        const isLocal = !isSpectator && selectedPlayer === ownerId;
        const allowTaxControls = isLocal;

        return {
            ownerId,
            displayName,
            isOpponent: !isLocal,
            commanderCards,
            commanderTax,
            allowTaxControls,
            cardCount: commanderCards.length
        };
    };

    const commanderEntries = $derived.by(() => {
        if (!gameState) {
            return [];
        }
        const players = Array.isArray(gameState.players) ? gameState.players : [];
        return players
            .map((player, index) => buildCommanderZoneData(player, index))
            .filter(Boolean);
    });

    const renderCommanderCard = (card, ownerId, isOpponent) => {
        if (typeof GameCards?.renderCardWithLoadingState === 'function') {
            return GameCards.renderCardWithLoadingState(
                card,
                'card-mini card-commander-zone',
                true,
                'commander',
                isOpponent,
                null,
                ownerId,
                { readOnly: isSpectator || isOpponent }
            );
        }
    };

    const handleTaxAdjust = (ownerId, delta) => {
        if (typeof GameActions?.adjustCommanderTax === 'function') {
            GameActions.adjustCommanderTax(ownerId, delta);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.currentTarget.classList.add('zone-drag-over');
    };

    const handleDragLeave = (event) => {
        event.currentTarget.classList.remove('zone-drag-over');
    };

    const handleDrop = (event, ownerId) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('zone-drag-over');

        // Parse drag data
        let dragData = null;
        try {
            const rawData = event.dataTransfer ? event.dataTransfer.getData('text/plain') : '';
            dragData = rawData ? JSON.parse(rawData) : null;
        } catch (error) {
            console.warn('Failed to parse drag data for commander drop:', error);
        }

        if (!dragData || !dragData.uniqueCardId) {
            return;
        }

        const { cardId, cardZone, uniqueCardId, cardOwnerId } = dragData;

        // Skip if already in commander zone (avoid duplicate)
        if (cardZone === 'commander' || cardZone === 'commander_zone') {
            return;
        }

        // Call moveCard without DOM manipulation - let Svelte handle re-render
        if (typeof GameActions?.moveCard === 'function') {
            const options = {};
            if (cardOwnerId) {
                options.sourcePlayerId = cardOwnerId;
            }
            if (ownerId) {
                options.destinationPlayerId = ownerId;
            }
            GameActions.moveCard(
                cardId,
                cardZone,
                'commander',
                uniqueCardId,
                null,
                null,
                null,
                options
            );
        }
    };
</script>

<div class="arena-card rounded-lg p-4 flex flex-col commander-zones-panel">
    <div class="flex items-center gap-2 pb-3 border-b border-arena-accent/30">
        <span class="text-lg">{panelIcon}</span>
        <h3 class="font-magic font-semibold text-arena-accent">{panelTitle}</h3>
    </div>

    <div class="commander-zones-content mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {#if commanderEntries.length}
            {#each commanderEntries as data (data.ownerId)}
                <div class="commander-zone-section">
                    <div class="commander-zone-header flex flex-col items-center mb-2">
                        <span class={`text-xs font-semibold truncate w-full text-center ${data.allowTaxControls ? 'text-arena-accent' : 'text-arena-text-dim'}`}>
                            {data.displayName}
                        </span>
                        <div class={data.allowTaxControls ? 'commander-tax-controls flex items-center gap-1 mt-1' : 'commander-tax-display flex items-center gap-1 text-xs mt-1'}>
                            {#if data.allowTaxControls}
                                <button
                                    class="commander-tax-btn text-xs px-1.5 py-0.5 rounded bg-arena-surface border border-arena-accent/30 hover:bg-arena-accent/20 disabled:opacity-50"
                                    type="button"
                                    disabled={data.commanderTax <= 0}
                                    onclick={() => handleTaxAdjust(data.ownerId, -2)}>
                                    -2
                                </button>
                            {/if}
                            <span class="commander-tax-value text-arena-accent font-bold text-xs px-1">
                                {data.commanderTax}
                            </span>
                            {#if data.allowTaxControls}
                                <button
                                    class="commander-tax-btn text-xs px-1.5 py-0.5 rounded bg-arena-surface border border-arena-accent/30 hover:bg-arena-accent/20"
                                    type="button"
                                    onclick={() => handleTaxAdjust(data.ownerId, 2)}>
                                    +2
                                </button>
                            {/if}
                        </div>
                    </div>
                    <div
                        class="commander-zone-cards flex flex-col items-center gap-2 min-h-[90px] p-2 rounded bg-arena-surface/50 border border-arena-accent/20"
                        role={data.allowTaxControls ? "listbox" : "list"}
                        aria-label="Commander zone"
                        data-zone-context="commander"
                        data-zone-owner={data.ownerId}
                        data-card-count={data.cardCount}
                        ondragover={data.allowTaxControls ? handleDragOver : null}
                        ondragleave={data.allowTaxControls ? handleDragLeave : null}
                        ondrop={data.allowTaxControls ? (e) => handleDrop(e, data.ownerId) : null}>
                        {#if data.cardCount > 0}
                            {#each data.commanderCards as card, index (card.unique_id || index)}
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html renderCommanderCard(card, data.ownerId, data.isOpponent)}
                            {/each}
                        {:else}
                            <div class="commander-zone-empty text-center text-arena-muted text-xs py-2">
                                <span class="block">🧙</span>
                                <span>{data.allowTaxControls ? 'Drop here' : 'Empty'}</span>
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        {:else}
            <div class="col-span-2 text-center text-arena-muted text-sm py-4">
                Waiting for game data...
            </div>
        {/if}
    </div>
</div>
