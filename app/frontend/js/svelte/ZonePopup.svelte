<script>
    let {
        popupKey = '',
        title = 'Zone',
        icon = '🗂️',
        cardsHtml = '',
        cardCount = 0,
        baseZone = '',
        isOpponent = false,
        ownerId = '',
        persistent = false,
        allowDrop = false,
        typeSummary = null
    } = $props();

    const panelId = $derived(popupKey ? `zone-popup-${popupKey}` : 'zone-popup');
    const bodyId = $derived(popupKey ? `zone-popup-body-${popupKey}` : 'zone-popup-body');
    const countId = $derived(popupKey ? `zone-popup-count-${popupKey}` : 'zone-popup-count');

    const hasCards = $derived(Number(cardCount) > 0);
    const hasTypeSummary = $derived(typeSummary && typeof typeSummary.distinctCount === 'number');
    const typeSummaryText = $derived(Array.isArray(typeSummary?.lines) ? typeSummary.lines.join('\n') : '');

    let searchQuery = $state('');
    let panelEl;
    let handleEl;
    let emptyStateEl;


    const handleClose = () => {
        if (persistent) {
            return;
        }
        if (typeof UIZonesManager?.closeZoneModal === 'function') {
            UIZonesManager.closeZoneModal(popupKey);
        }
    };

    const applySearch = () => {
        const listEl = panelEl?.querySelector('.reveal-card-list');
        if (!listEl) {
            return;
        }

        const normalized = (searchQuery || '').trim().toLowerCase();
        if (panelEl) {
            panelEl.dataset.currentSearchQuery = searchQuery || '';
        }

        const cards = listEl.querySelectorAll('[data-card-id]');
        let visibleCount = 0;
        cards.forEach((card) => {
            const searchData = (card.dataset.cardSearch || `${card.dataset.cardName || ''} ${card.dataset.cardZone || ''}`).toLowerCase();
            const isMatch = !normalized || searchData.includes(normalized);
            if (isMatch) {
                card.classList.remove('popup-card-hidden');
                visibleCount += 1;
            } else {
                card.classList.add('popup-card-hidden');
            }
        });

        if (emptyStateEl) {
            if (normalized && visibleCount === 0) {
                emptyStateEl.classList.remove('hidden');
            } else {
                emptyStateEl.classList.add('hidden');
            }
        }
    };

    const handleSearch = (event) => {
        searchQuery = event?.target?.value || '';
        applySearch();
    };

    const handleDragOver = (event) => {
        if (!allowDrop) {
            return;
        }
        event.preventDefault();
        if (typeof UIZonesManager?.handlePopupDragOver === 'function') {
            UIZonesManager.handlePopupDragOver(event);
        }
    };

    const handleDragLeave = (event) => {
        if (!allowDrop) {
            return;
        }
        if (typeof UIZonesManager?.handlePopupDragLeave === 'function') {
            UIZonesManager.handlePopupDragLeave(event);
        }
    };

    const handleDrop = (event) => {
        if (!allowDrop) {
            return;
        }
        event.preventDefault();
        if (typeof UIZonesManager?.handlePopupDrop === 'function') {
            UIZonesManager.handlePopupDrop(event, baseZone);
        }
    };

    const getHorizontalScrollManager = () => {
        if (typeof window === 'undefined') {
            return null;
        }
        return window.UIHorizontalScroll || null;
    };

    const attachHorizontalScroll = () => {
        const listEl = panelEl?.querySelector('.reveal-card-list');
        if (!listEl || listEl.dataset.wheelListenerAttached === 'true') {
            return;
        }
        const manager = getHorizontalScrollManager();
        if (manager && typeof manager.attachWheelListener === 'function') {
            manager.attachWheelListener(listEl);
            listEl.dataset.wheelListenerAttached = 'true';
        }
    };

    let draggableSetup = $state(false);

    $effect(() => {
        // One-time draggable setup when DOM is ready
        if (draggableSetup || !panelEl || !handleEl) {
            return;
        }
        if (typeof UIRenderersTemplates?._makePopupDraggable === 'function') {
            UIRenderersTemplates._makePopupDraggable(panelEl, handleEl);
        }
        draggableSetup = true;
    });

    $effect(() => {
        // Re-apply search and scroll wiring when content or query changes
        void searchQuery;
        if (!panelEl) {
            return;
        }
        emptyStateEl = panelEl.querySelector('.popup-search-empty') || null;
        applySearch();
        attachHorizontalScroll();
    });
</script>

<div
    id={panelId}
    class="stack-popup reveal-popup zone-popup hidden"
    role="dialog"
    aria-label={`${title || 'Zone'} Zone`}
    aria-hidden="true"
    data-zone-popup-key={popupKey}
    data-zone-owner={isOpponent ? 'opponent' : 'player'}
    data-persistent={persistent ? 'true' : 'false'}
    data-appear="hidden"
    bind:this={panelEl}>
    <div class="stack-popup-header reveal-popup-header zone-popup-header" data-draggable-handle bind:this={handleEl}>
        <div class="stack-popup-title reveal-popup-title zone-popup-title">
            <span class="stack-popup-icon reveal-popup-icon zone-popup-icon">{icon || '🗂️'}</span>
            <span class="stack-popup-label reveal-popup-label zone-popup-label">{title || 'Zone'}</span>
            <span class="stack-popup-count reveal-popup-count zone-popup-count" id={countId}>{cardCount}</span>
            {#if hasTypeSummary && baseZone === 'graveyard'}
                <div class="zone-popup-type-summary" aria-label="Graveyard type summary">
                    <span class="zone-popup-type-count">{typeSummary?.distinctCount ?? 0} types</span>
                    <div class="zone-popup-type-tooltip" role="tooltip">
                        {#if typeSummaryText}
                            <div class="zone-popup-type-tooltip-title">Types in graveyard</div>
                            <div class="zone-popup-type-tooltip-list">{typeSummaryText}</div>
                        {:else}
                            <div class="zone-popup-type-tooltip-empty">No card types yet</div>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
        {#if !persistent}
            <button class="zone-popup-close" type="button" onclick={handleClose}>✕</button>
        {/if}
    </div>

    <div class="popup-search-container">
        <input
            type="search"
            class="popup-card-search-input"
            placeholder={`Search ${title || 'cards'}`}
            aria-label={`Search ${title || 'cards'}`}
            value={searchQuery}
            oninput={handleSearch} />
    </div>

    <div class="stack-popup-body reveal-popup-body zone-popup-body" id={bodyId}>
        <div class="reveal-card-container">
            <div
                class={`reveal-card-list zone-card-list${!hasCards ? ' zone-card-list-empty' : ''}`}
                role="list"
                data-zone-context={baseZone}
                data-zone-owner={ownerId}
                data-card-count={cardCount}
                ondragover={handleDragOver}
                ondragleave={handleDragLeave}
                ondrop={handleDrop}>
                {#if hasCards}
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html cardsHtml}
                {:else}
                    <div class="reveal-empty">No cards in this zone</div>
                {/if}
            </div>
        </div>
    </div>

    <div class="popup-search-empty hidden" bind:this={emptyStateEl}>No cards match your search</div>
</div>
