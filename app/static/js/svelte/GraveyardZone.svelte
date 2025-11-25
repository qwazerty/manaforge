<script>
    import { onMount } from 'svelte';

    let {
        cards = [],
        zoneIdentifier = '',
        cardsRemaining = 0,
        overlayHtml = 'View<br>All',
        onClick = null
    } = $props();
    let graveyardButton = null;

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

    const attachContextMenu = () => {
        if (!graveyardButton || !zoneIdentifier || typeof window === 'undefined' ||
            !window.ZoneContextMenu || typeof window.ZoneContextMenu.attachToZone !== 'function') {
            return;
        }
        if (graveyardButton.dataset.zoneMenuAttached === 'true') {
            return;
        }
        window.ZoneContextMenu.attachToZone(graveyardButton, zoneIdentifier);
        graveyardButton.classList.add('zone-context-menu-enabled');
        graveyardButton.dataset.zoneMenuAttached = 'true';
    };

    onMount(() => {
        attachContextMenu();
    });

    $effect(() => {
        const identifier = zoneIdentifier;
        if (!identifier || !graveyardButton) {
            return;
        }
        if (graveyardButton.dataset.zoneIdentifier !== identifier) {
            graveyardButton.dataset.zoneMenuAttached = '';
        }
        graveyardButton.dataset.zoneIdentifier = identifier;
        attachContextMenu();
    });
</script>

<div class="graveyard-zone-stack flex flex-col items-center w-full">
    <button
        bind:this={graveyardButton}
        type="button"
        class="graveyard-cards-stack"
        data-zone-context={zoneIdentifier}
        onclick={handleClick}>
        {#if cards.length === 0}
            <div class="graveyard-empty">
                <span>⚰️</span>
                <div class="zone-empty-text">Empty</div>
            </div>
        {:else}
            {@html stackMarkup()}
            <div class="graveyard-click-overlay" style="pointer-events: none;">
                <span class="zone-view-hint">
                    {@html overlayHtml}
                </span>
            </div>
        {/if}
    </button>
    <div class="graveyard-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>
