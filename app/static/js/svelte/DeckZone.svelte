<script>
    let {
        cardsRemaining = 0,
        deckClass = '',
        zoneIdentifier = '',
        overlayText = '',
        onClick = null
    } = $props();

    const stackCards = $derived(() => {
        if (cardsRemaining === 0) {
            return '';
        }

        const stackLayers = Math.min(5, Math.max(1, cardsRemaining));
        return Array.from({ length: stackLayers }, () => `
            <div class="deck-card-layer">
                <div class="card-back-mini"></div>
            </div>
        `).join('');
    });

    function handleClick(event) {
        if (typeof onClick === 'function') {
            onClick(event);
        }
    }
</script>

<div class="deck-zone-stack-wrapper w-full flex flex-col items-center">
    {#if cardsRemaining === 0}
        <button
            type="button"
            class={deckClass}
            data-zone-context={zoneIdentifier}
            onclick={handleClick}>
            {@html UIUtils.generateEmptyZoneContent('📖', 'Deck is empty')}
        </button>
    {:else}
        <button
            type="button"
            class={deckClass}
            data-zone-context={zoneIdentifier}
            onclick={handleClick}>
            {@html stackCards()}
            <div class="deck-click-overlay">
                <span class="draw-hint">{overlayText}</span>
            </div>
        </button>
    {/if}
    <div class="deck-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>
