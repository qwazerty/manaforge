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
        allowCommanderControls = false,
        commanderTax = 0
    } = $props();

    const panelId = $derived(() => popupKey ? `zone-popup-${popupKey}` : 'zone-popup');
    const bodyId = $derived(() => popupKey ? `zone-popup-body-${popupKey}` : 'zone-popup-body');
    const countId = $derived(() => popupKey ? `zone-popup-count-${popupKey}` : 'zone-popup-count');

    const isCommanderPopup = $derived(() => baseZone === 'commander');
    const hasCards = $derived(() => Number(cardCount) > 0);
    const allowCommanderDrop = $derived(() => isCommanderPopup() && allowCommanderControls && allowDrop);
    const effectiveAllowDrop = $derived(() => allowCommanderDrop() || (!isCommanderPopup() && allowDrop));

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
        if (!effectiveAllowDrop()) {
            return;
        }
        event.preventDefault();
        if (typeof UIZonesManager?.handlePopupDragOver === 'function') {
            UIZonesManager.handlePopupDragOver(event);
        }
    };

    const handleDragLeave = (event) => {
        if (!effectiveAllowDrop()) {
            return;
        }
        if (typeof UIZonesManager?.handlePopupDragLeave === 'function') {
            UIZonesManager.handlePopupDragLeave(event);
        }
    };

    const handleDrop = (event) => {
        if (!effectiveAllowDrop()) {
            return;
        }
        event.preventDefault();
        if (typeof UIZonesManager?.handlePopupDrop === 'function') {
            UIZonesManager.handlePopupDrop(event, baseZone);
        }
    };

    const attachHorizontalScroll = () => {
        if (isCommanderPopup()) {
            return;
        }
        const listEl = panelEl?.querySelector('.reveal-card-list');
        if (!listEl || listEl.dataset.wheelListenerAttached === 'true') {
            return;
        }
        if (typeof UIHorizontalScroll?.attachWheelListener === 'function') {
            UIHorizontalScroll.attachWheelListener(listEl);
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
    id={panelId()}
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
            <span class="stack-popup-count reveal-popup-count zone-popup-count" id={countId()}>{cardCount}</span>
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

    <div class="stack-popup-body reveal-popup-body zone-popup-body" id={bodyId()}>
        {#if isCommanderPopup()}
            <div class="commander-popup-content">
                <div class="commander-popup-tax">
                    <span class="commander-tax-label">Commander Tax</span>
                    <div class="commander-tax-value-group">
                        {#if allowCommanderControls}
                            <button
                            class={`commander-tax-adjust-btn${commanderTax <= 0 ? ' commander-tax-adjust-btn-disabled' : ''}`}
                            type="button"
                            disabled={commanderTax <= 0}
                            onclick={(event) => { event.stopPropagation(); GameActions.adjustCommanderTax(ownerId, -2); }}>
                            -2
                        </button>
                    {/if}
                    <span class="commander-tax-value">{commanderTax}</span>
                    {#if allowCommanderControls}
                        <button
                            class="commander-tax-adjust-btn"
                            type="button"
                            onclick={(event) => { event.stopPropagation(); GameActions.adjustCommanderTax(ownerId, 2); }}>
                            +2
                        </button>
                    {/if}
                </div>
            </div>

            {#if hasCards()}
                <div class="reveal-card-container commander-popup-card-container">
                    <div
                        class="reveal-card-list commander-popup-card-list"
                        role="list"
                        data-zone-context={baseZone}
                        data-zone-owner={ownerId}
                        data-card-count={cardCount}
                        ondragover={handleDragOver}
                        ondragleave={handleDragLeave}
                        ondrop={handleDrop}>
                        {@html cardsHtml}
                    </div>
                </div>
            {:else if allowCommanderDrop()}
                <div class="reveal-card-container commander-popup-card-container">
                    <div
                        class="reveal-card-list commander-popup-card-list commander-popup-card-list-empty"
                        role="list"
                        data-zone-context={baseZone}
                        data-zone-owner={ownerId}
                        data-card-count="0"
                        ondragover={handleDragOver}
                        ondragleave={handleDragLeave}
                        ondrop={handleDrop}>
                        <div class="commander-popup-empty">
                            <span class="commander-popup-empty-icon">🧙</span>
                            <div>No commander assigned</div>
                        </div>
                    </div>
                    </div>
                {:else}
                    <div class="commander-popup-empty">
                        <span class="commander-popup-empty-icon">🧙</span>
                        <div>No commander assigned</div>
                    </div>
                {/if}
            </div>
        {:else}
            <div class="reveal-card-container">
                <div
                    class={`reveal-card-list zone-card-list${!hasCards() ? ' zone-card-list-empty' : ''}`}
                    role="list"
                    data-zone-context={baseZone}
                    data-zone-owner={ownerId}
                    data-card-count={cardCount}
                    ondragover={handleDragOver}
                    ondragleave={handleDragLeave}
                    ondrop={handleDrop}>
                    {#if hasCards()}
                        {@html cardsHtml}
                    {:else}
                        <div class="reveal-empty">No cards in this zone</div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>

    <div class="popup-search-empty hidden" bind:this={emptyStateEl}>No cards match your search</div>
</div>
