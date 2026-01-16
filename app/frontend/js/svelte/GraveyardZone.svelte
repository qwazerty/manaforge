<script>
    import ZoneContextMenu from './ZoneContextMenu.svelte';

    let {
        cards = [],
        zoneIdentifier = '',
        zoneOwnerId = '',
        cardsRemaining = 0,
        overlayHtml = 'View<br>All',
        onClick = null
    } = $props();

    let zoneContextMenu = $state(null);

    const normalizedCards = () => (Array.isArray(cards) ? cards : []);

    const stackMarkup = () => {
        const cardList = normalizedCards();
        if (cardList.length === 0) return '';
        const stackLayers = Math.min(5, Math.max(1, cardList.length));
        const topCards = cardList.slice(-stackLayers);
        return topCards.map((card, index) => `
            <div class="graveyard-card-layer">
                ${GameCards.renderCardWithLoadingState(card, 'card-front-mini', true, 'graveyard', false, index, null, { disableContextMenu: true })}
            </div>
        `).join('');
    };

    function handleClick(event) {
        if (typeof onClick === 'function') {
            onClick(event);
        }
    }

    function handleContextMenu(event) {
        const isOpponent = zoneIdentifier.startsWith('opponent_');
        if (zoneContextMenu) {
            zoneContextMenu.show(zoneIdentifier, event, isOpponent);
        }
    }
</script>

<div
    class="graveyard-zone-stack flex flex-col items-center w-full"
    role="group"
    aria-label="Graveyard zone"
    data-zone-owner={zoneOwnerId}
    data-zone-type="graveyard"
    ondragover={(event) => UIZonesManager.handleZoneDragOver(event)}
    ondragleave={(event) => UIZonesManager.handleZoneDragLeave(event)}
    ondrop={(event) => UIZonesManager.handleZoneDrop(event, 'graveyard')}>
    <button
        type="button"
        class="graveyard-cards-stack zone-context-menu-enabled"
        data-zone-context={zoneIdentifier}
        onclick={handleClick}
        oncontextmenu={handleContextMenu}>
        {#if cards.length === 0}
            <div class="graveyard-empty">
                <span>⚰️</span>
                <div class="zone-empty-text">Empty</div>
            </div>
        {:else}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html stackMarkup()}
            <div class="graveyard-click-overlay" style="pointer-events: none;">
                <span class="zone-view-hint">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html overlayHtml}
                </span>
            </div>
        {/if}
    </button>
    <div class="graveyard-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>

<ZoneContextMenu bind:this={zoneContextMenu} />
