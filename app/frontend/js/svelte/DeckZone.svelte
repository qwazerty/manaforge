<script>
    import ZoneContextMenu from './ZoneContextMenu.svelte';
    import { generateEmptyZoneContent } from '@lib/ui-utils';

    let {
        cardsRemaining = 0,
        deckClass = '',
        zoneIdentifier = '',
        zoneOwnerId = '',
        overlayText = '',
        onClick = null
    } = $props();

    let zoneContextMenu = $state(null);

    const stackCards = $derived.by(() => {
        if (cardsRemaining === 0) return '';
        const layers = Math.min(5, Math.max(1, cardsRemaining));
        return Array.from({ length: layers }, () => '<div class="deck-card-layer"><div class="card-back-mini"></div></div>').join('');
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

<div
    class="deck-zone-stack-wrapper w-full flex flex-col items-center"
    role="group"
    aria-label="Deck zone"
    data-zone-owner={zoneOwnerId}
    data-zone-type="deck"
    ondragover={(event) => UIZonesManager.handleZoneDragOver(event)}
    ondragleave={(event) => UIZonesManager.handleZoneDragLeave(event)}
    ondrop={(event) => UIZonesManager.handleZoneDrop(event, 'library', { deckPosition: 'top' })}>
    {#if cardsRemaining === 0}
        <button
            type="button"
            class="{deckClass} zone-context-menu-enabled"
            data-zone-context={zoneIdentifier}
            onclick={handleClick}
            oncontextmenu={handleContextMenu}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html generateEmptyZoneContent('📖', 'Deck is empty')}
        </button>
    {:else}
        <button
            type="button"
            class="{deckClass} zone-context-menu-enabled"
            data-zone-context={zoneIdentifier}
            onclick={handleClick}
            oncontextmenu={handleContextMenu}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html stackCards}
            <div class="deck-click-overlay">
                <span class="draw-hint">{overlayText}</span>
            </div>
        </button>
    {/if}
    <div class="deck-cards-count mt-2">
        <span class="cards-remaining">{cardsRemaining} card{cardsRemaining !== 1 ? 's' : ''}</span>
    </div>
</div>

<ZoneContextMenu bind:this={zoneContextMenu} />
