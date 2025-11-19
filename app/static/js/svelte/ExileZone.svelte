<script>
    import { onMount } from 'svelte';

    let {
        cards = [],
        zoneIdentifier = '',
        cardsRemaining = 0,
        overlayHtml = 'View<br>All',
        topCard = null,
        onClick = null
    } = $props();
    let exileButton = null;

    const stackMarkup = $derived(() => {
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
    });

    function handleClick(event) {
        if (typeof onClick === 'function') {
            onClick(event);
        }
    }

    const attachContextMenu = () => {
        if (
            !exileButton ||
            !zoneIdentifier ||
            typeof window === 'undefined' ||
            !window.ZoneContextMenu ||
            typeof window.ZoneContextMenu.attachToZone !== 'function'
        ) {
            return;
        }
        if (exileButton.dataset.zoneMenuAttached === 'true') {
            return;
        }
        window.ZoneContextMenu.attachToZone(exileButton, zoneIdentifier);
        exileButton.classList.add('zone-context-menu-enabled');
        exileButton.dataset.zoneMenuAttached = 'true';
    };

    onMount(() => {
        attachContextMenu();
    });

    $effect(() => {
        const identifier = zoneIdentifier;
        if (!identifier || !exileButton) {
            return;
        }
        if (exileButton.dataset.zoneIdentifier !== identifier) {
            exileButton.dataset.zoneMenuAttached = '';
        }
        exileButton.dataset.zoneIdentifier = identifier;
        attachContextMenu();
    });
</script>

<div class="exile-zone-stack flex flex-col items-center w-full">
    <button
        bind:this={exileButton}
        type="button"
        class="exile-stack"
        data-zone-context={zoneIdentifier}
        onclick={handleClick}>
        {#if cardsRemaining === 0}
            <div class="exile-empty">
                <span>🌌</span>
                <div class="zone-empty-text">Empty</div>
            </div>
        {:else}
            {@html stackMarkup()}
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
    </button>
    <div class="exile-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>
