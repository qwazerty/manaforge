<script>
    export let cardsRemaining = 0;
    export let deckClass = '';
    export let zoneIdentifier = '';
    export let overlayText = '';
    export let onClick = null;

    const generateStack = () => {
        if (cardsRemaining === 0) {
            return '';
        }

        const stackLayers = Math.min(5, Math.max(1, cardsRemaining));
        return Array.from({ length: stackLayers }, () => `
            <div class="deck-card-layer">
                <div class="card-back-mini"></div>
            </div>
        `).join('');
    };

    $: stackCards = generateStack();

    function handleClick(event) {
        if (typeof onClick === 'function') {
            onClick(event);
        }
    }
</script>

<div class="deck-zone-stack-wrapper w-full flex flex-col items-center">
    {#if cardsRemaining === 0}
        <div class={deckClass} data-zone-context={zoneIdentifier} on:click={handleClick}>
            {@html UIUtils.generateEmptyZoneContent('📖', 'Deck is empty')}
        </div>
    {:else}
        <div class={deckClass} data-zone-context={zoneIdentifier} on:click={handleClick}>
            {@html stackCards}
            <div class="deck-click-overlay">
                <span class="draw-hint">{overlayText}</span>
            </div>
        </div>
    {/if}
    <div class="deck-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>
