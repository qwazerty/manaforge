<script>
    import { onMount } from 'svelte';

    let {
        cardsRemaining = 0,
        deckClass = '',
        zoneIdentifier = '',
        overlayText = '',
        onClick = null
    } = $props();
    let deckButton = null;

    const attachContextMenu = () => {
        if (!deckButton || !zoneIdentifier || typeof window === 'undefined' ||
            !window.ZoneContextMenu || typeof window.ZoneContextMenu.attachToZone !== 'function') {
            return;
        }
        if (deckButton.dataset.zoneMenuAttached === 'true') {
            return;
        }
        window.ZoneContextMenu.attachToZone(deckButton, zoneIdentifier);
        deckButton.classList.add('zone-context-menu-enabled');
        deckButton.dataset.zoneMenuAttached = 'true';
    };

    onMount(() => {
        attachContextMenu();
    });

    $effect(() => {
        const currentIdentifier = zoneIdentifier;
        if (!currentIdentifier || !deckButton) {
            return;
        }
        if (deckButton.dataset.zoneIdentifier !== currentIdentifier) {
            deckButton.dataset.zoneMenuAttached = '';
        }
        deckButton.dataset.zoneIdentifier = currentIdentifier;
        attachContextMenu();
    });

    const stackCards = $derived(() => {
        if (cardsRemaining === 0) return '';
        const layers = Math.min(5, Math.max(1, cardsRemaining));
        return Array.from({ length: layers }, () => '<div class="deck-card-layer"><div class="card-back-mini"></div></div>').join('');
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
            bind:this={deckButton}
            type="button"
            class={deckClass}
            data-zone-context={zoneIdentifier}
            onclick={handleClick}>
            {@html UIUtils.generateEmptyZoneContent('📖', 'Deck is empty')}
        </button>
    {:else}
        <button
            bind:this={deckButton}
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
