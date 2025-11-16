<script>
    export let cards = [];
    export let zoneIdentifier = '';
    export let cardsRemaining = 0;
    export let overlayHtml = 'View<br>All';
    export let onClick = null;

    const renderLayers = () => {
        if (cards.length === 0) {
            return '';
        }

        const stackLayers = Math.min(5, Math.max(1, cards.length));
        const topCards = cards.slice(-stackLayers);

        return topCards.map((card) => {
            return `
                <div class="graveyard-card-layer">
                    ${GameCards.renderCardWithLoadingState(card, 'card-front-mini', true, 'graveyard')}
                </div>
            `;
        }).join('');
    };

    $: stackMarkup = renderLayers();

    function handleClick(event) {
        if (typeof onClick === 'function') {
            onClick(event);
        }
    }
</script>

<div class="graveyard-zone-stack flex flex-col items-center w-full">
    <div class="graveyard-cards-stack" data-zone-context={zoneIdentifier} on:click={handleClick}>
        {#if cards.length === 0}
            <div class="graveyard-empty">
                <span>⚰️</span>
                <div class="zone-empty-text">Empty</div>
            </div>
        {:else}
            <div class="relative w-full">
                {@html stackMarkup}
                <div class="graveyard-click-overlay">
                    <span class="zone-view-hint">
                        {@html overlayHtml}
                    </span>
                </div>
            </div>
        {/if}
    </div>
    <div class="graveyard-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>
