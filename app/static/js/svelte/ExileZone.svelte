<script>
    export let cards = [];
    export let zoneIdentifier = '';
    export let cardsRemaining = 0;
    export let overlayHtml = 'View<br>All';
    export let topCard = null;
    export let onClick = null;

    const renderStack = () => {
        if (cards.length === 0) {
            return '';
        }
        const stackLayers = Math.min(5, Math.max(1, cards.length));
        return Array.from({ length: stackLayers }, () => {
            return `
                <div class="exile-card-layer">
                    <div class="card-back-mini"></div>
                </div>
            `;
        }).join('');
    };

    $: stackMarkup = renderStack();

    function handleClick(event) {
        if (typeof onClick === 'function') {
            onClick(event);
        }
    }
</script>

<div class="exile-zone-stack flex flex-col items-center w-full">
    <div class="exile-stack" data-zone-context={zoneIdentifier} on:click={handleClick}>
        {#if cardsRemaining === 0}
            <div class="exile-empty">
                <span>🌌</span>
                <div class="zone-empty-text">Empty</div>
            </div>
        {:else}
            {@html stackMarkup}
            {#if topCard}
                <div class="exile-top-card">
                    {@html GameCards.renderCardWithLoadingState(topCard, 'card-front-mini', true, 'exile')}
                </div>
            {/if}
            <div class="exile-click-overlay">
                <span class="zone-view-hint">
                    {@html overlayHtml}
                </span>
            </div>
        {/if}
    </div>
    <div class="exile-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>
