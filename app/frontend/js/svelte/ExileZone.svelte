<script>
    import ZoneContextMenu from './ZoneContextMenu.svelte';

    let {
        cards = [],
        zoneIdentifier = '',
        cardsRemaining = 0,
        overlayHtml = 'View<br>All',
        topCard = null,
        onClick = null
    } = $props();

    let zoneContextMenu = $state(null);

    const stackMarkup = $derived.by(() => {
        if (cards.length === 0) return '';
        const layers = Math.min(5, Math.max(1, cards.length));
        return Array.from({ length: layers }, () => '<div class="exile-card-layer"><div class="card-back-mini"></div></div>').join('');
    });

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

<div class="exile-zone-stack flex flex-col items-center w-full">
    <button
        type="button"
        class="exile-stack zone-context-menu-enabled"
        data-zone-context={zoneIdentifier}
        onclick={handleClick}
        oncontextmenu={handleContextMenu}>
        {#if cardsRemaining === 0}
            <div class="exile-empty">
                <span>🌌</span>
                <div class="zone-empty-text">Empty</div>
            </div>
        {:else}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html stackMarkup}
            {#if topCard}
                <div class="exile-top-card">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html GameCards.renderCardWithLoadingState(topCard, 'card-front-mini', true, 'exile')}
                </div>
            {/if}
            <div class="exile-click-overlay">
                <span class="zone-view-hint">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html overlayHtml}
                </span>
            </div>
        {/if}
    </button>
    <div class="exile-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>

<ZoneContextMenu bind:this={zoneContextMenu} />
