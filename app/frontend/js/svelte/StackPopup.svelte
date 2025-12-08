<script>
    import { onMount, onDestroy } from 'svelte';

    let {
        stack = [],
        visible = false,
        gameState = null,
        panelTitle = 'Stack',
        panelIcon = '📜',
        afterHide = null
    } = $props();

    let panelEl = null;
    let dragHandle = null;
    let dragInitialized = false;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let previousVisible = false;
    let appearState = $state('hidden');
    let hideTimer = null;
    const APPEAR_DURATION = 0;

    const getSelectedPlayer = () => {
        if (typeof GameCore === 'undefined' || typeof GameCore.getSelectedPlayer !== 'function') {
            return null;
        }
        return GameCore.getSelectedPlayer();
    };

    const FACE_DOWN_LABEL = 'Face-down Spell';
    const CARD_BACK_IMAGE = '/static/images/card-back.jpg';

    const isFaceDownFlag = (card) => {
        if (!card) {
            return false;
        }
        // Check all possible property names for face-down status
        const faceDown = card.face_down ?? card.faceDown ?? card.is_face_down ?? card.isFaceDown;
        return faceDown === true || faceDown === 'true' || faceDown === 1;
    };

    const viewerCanSeeFaceDown = (card) => {
        if (!isFaceDownFlag(card)) {
            return true;
        }
        // Get the owner who can see this face-down card
        const faceDownOwner = (card.face_down_owner || card.faceDownOwner || card.face_down_owner_id || card.faceDownOwnerId || '').toLowerCase();
        const viewer = (getSelectedPlayer() || '').toLowerCase();
        
        // Spectators and unknown viewers cannot see face-down cards
        if (!viewer || viewer === 'spectator') {
            return false;
        }
        
        // If no face_down_owner is set, no one can see it
        if (!faceDownOwner) {
            return false;
        }
        
        // Only the face_down_owner can see the card
        return faceDownOwner === viewer;
    };

    const isFaceDownHidden = (card) => {
        if (!isFaceDownFlag(card)) {
            return false;
        }
        return !viewerCanSeeFaceDown(card);
    };

    const getDisplayName = (card) => {
        if (isFaceDownHidden(card)) {
            return FACE_DOWN_LABEL;
        }
        return card?.name || 'Unknown Spell';
    };

    const getCardImage = (card) => {
        // Always check face-down status first with our own logic
        if (isFaceDownHidden(card)) {
            return CARD_BACK_IMAGE;
        }
        // If viewer can see the card, use GameCards for proper image handling
        if (typeof GameCards !== 'undefined' && typeof GameCards.getSafeImageUrl === 'function') {
            return GameCards.getSafeImageUrl(card, { viewerId: getSelectedPlayer(), ignoreFaceDown: true });
        }
        return card?.image_url || card?.image || null;
    };

    const getCardId = (card) => {
        // For hidden face-down cards, only return the unique_id to prevent info leakage
        if (isFaceDownHidden(card)) {
            return card?.unique_id || 'face-down';
        }
        return card?.id || card?.card_id || card?.name || '';
    };

    const buildMaskedCard = (card) => {
        // Build a masked version that hides all identifying information
        const masked = {
            unique_id: card?.unique_id || null,
            name: FACE_DOWN_LABEL,
            face_down: true,
            image_url: null,
            card_type: null,
            face_down_owner: card?.face_down_owner || card?.faceDownOwner || null,
            owner_id: card?.owner_id || card?.ownerId || null,
            controller_id: card?.controller_id || card?.controllerId || null
        };
        return masked;
    };

    const getCardDataAttr = (card) => {
        if (isFaceDownHidden(card)) {
            return JSON.stringify(buildMaskedCard(card));
        }
        return JSON.stringify(card);
    };

    const getOwnerId = (card) => card?.owner_id || card?.ownerId || '';
    const getControllerId = (card) => card?.controller_id || card?.controllerId || getOwnerId(card);

    const canDragCard = (card) => {
        const selected = getSelectedPlayer();
        if (!selected || selected === 'spectator') {
            return false;
        }
        const ownerId = getOwnerId(card);
        const controllerId = getControllerId(card);
        return Boolean(card?.unique_id) && (selected === ownerId || selected === controllerId);
    };

    const isSpellClickable = (card) => {
        const selected = getSelectedPlayer();
        if (!selected || selected === 'spectator') {
            return true;
        }
        const phaseMode = String(gameState?.phase_mode || '').toLowerCase();
        const isStrict = phaseMode === 'strict';
        if (!isStrict) {
            return true;
        }
        return getOwnerId(card) !== selected;
    };

    const resolveStackSpell = (card) => {
        const cardId = getCardId(card);
        const uniqueId = card?.unique_id;
        if (!cardId || !uniqueId) {
            return;
        }
        if (typeof GameActions === 'undefined' || typeof GameActions.performGameAction !== 'function') {
            return;
        }
        GameActions.performGameAction('resolve_stack', {
            card_id: cardId,
            unique_id: uniqueId
        });
    };

    const handleSpellClick = (event, card) => {
        if (!isSpellClickable(card)) {
            event?.stopPropagation();
            return;
        }
        resolveStackSpell(card);
        event?.stopPropagation();
    };

    const handleSpellKeydown = (event, card) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        handleSpellClick(event, card);
    };

    const handleCardDragStart = (event, card) => {
        if (!canDragCard(card)) {
            event?.preventDefault();
            return;
        }
        if (typeof GameCards !== 'undefined' && typeof GameCards.handleDragStart === 'function') {
            GameCards.handleDragStart(event, event.currentTarget);
        }
    };

    const handleCardDragEnd = (event) => {
        if (typeof GameCards !== 'undefined' && typeof GameCards.handleDragEnd === 'function') {
            GameCards.handleDragEnd(event, event.currentTarget);
        }
    };

    const handleContextMenu = (event) => {
        if (typeof GameCards !== 'undefined' && typeof GameCards.showCardContextMenu === 'function') {
            GameCards.showCardContextMenu(event, event.currentTarget);
        }
        event.preventDefault();
        return false;
    };

    const handleStackDragOver = (event) => {
        event.preventDefault();
        if (typeof UIZonesManager !== 'undefined' &&
            typeof UIZonesManager.handleZoneDragOver === 'function') {
            UIZonesManager.handleZoneDragOver(event);
        }
    };

    const handleStackDrop = (event) => {
        event.preventDefault();
        if (typeof UIZonesManager !== 'undefined' &&
            typeof UIZonesManager.handleZoneDrop === 'function') {
            UIZonesManager.handleZoneDrop(event, 'stack');
        }
    };

    const positionPanel = (left, top) => {
        if (!panelEl) {
            return;
        }
        const padding = 16;
        const width = panelEl.offsetWidth;
        const height = panelEl.offsetHeight;
        const maxX = window.innerWidth - width - padding;
        const maxY = window.innerHeight - height - padding;
        const clampedLeft = Math.min(Math.max(left, padding), Math.max(maxX, padding));
        const clampedTop = Math.min(Math.max(top, padding), Math.max(maxY, padding));
        panelEl.style.left = `${clampedLeft}px`;
        panelEl.style.top = `${clampedTop}px`;
        panelEl.style.right = 'auto';
        panelEl.style.bottom = 'auto';
        panelEl.style.transform = 'none';
    };

    const positionRelativeToBoard = () => {
        if (!panelEl) {
            return;
        }
        const board = document.getElementById('game-board');
        const padding = 16;
        if (!board) {
            positionPanel(window.innerWidth - panelEl.offsetWidth - padding, padding);
            return;
        }
        const boardRect = board.getBoundingClientRect();
        const panelHeight = panelEl.offsetHeight;
        const panelWidth = panelEl.offsetWidth;
        let top = boardRect.top + (boardRect.height / 2) - (panelHeight / 2);
        top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));
        let left = boardRect.right - panelWidth - padding;
        left = Math.max(boardRect.left + padding, left);
        left = Math.min(left, window.innerWidth - panelWidth - padding);
        positionPanel(left, top);
    };

    const clampPanelToViewport = () => {
        if (!panelEl) {
            return;
        }
        const rect = panelEl.getBoundingClientRect();
        positionPanel(rect.left, rect.top);
    };

    const refreshPanelPosition = () => {
        if (!panelEl || !visible) {
            return;
        }
        if (panelEl.dataset.userMoved === 'true') {
            clampPanelToViewport();
        } else {
            positionRelativeToBoard();
        }
    };

    let refreshScheduled = false;

    const schedulePanelRefresh = () => {
        if (refreshScheduled) {
            return;
        }
        refreshScheduled = true;
        requestAnimationFrame(() => {
            refreshScheduled = false;
            refreshPanelPosition();
        });
    };

    const onMouseMove = (event) => {
        if (!isDragging) {
            return;
        }
        positionPanel(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
    };

    const onMouseUp = () => {
        stopDragging();
    };

    const onTouchMove = (event) => {
        if (!isDragging) {
            return;
        }
        const touch = event.touches[0];
        if (!touch) {
            return;
        }
        positionPanel(touch.clientX - dragOffsetX, touch.clientY - dragOffsetY);
        event.preventDefault();
    };

    const onTouchEnd = () => {
        stopDragging();
    };

    const startDragging = (clientX, clientY) => {
        if (!panelEl) {
            return;
        }
        if (isDragging) {
            return;
        }
        isDragging = true;
        panelEl.dataset.userMoved = 'true';
        panelEl.classList.add('stack-popup-dragging');
        const rect = panelEl.getBoundingClientRect();
        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    };

    const stopDragging = () => {
        if (!isDragging) {
            return;
        }
        isDragging = false;
        panelEl?.classList.remove('stack-popup-dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };

    const onMouseDown = (event) => {
        if (event.button !== 0 || event.target.closest('button')) {
            return;
        }
        startDragging(event.clientX, event.clientY);
        event.preventDefault();
    };

    const onTouchStart = (event) => {
        const touch = event.touches[0];
        if (!touch || event.target.closest('button')) {
            return;
        }
        startDragging(touch.clientX, touch.clientY);
        event.preventDefault();
    };

    const setupDragHandlers = () => {
        if (!panelEl || !dragHandle || dragInitialized) {
            return;
        }
        dragHandle.addEventListener('mousedown', onMouseDown);
        dragHandle.addEventListener('touchstart', onTouchStart, { passive: false });
        dragInitialized = true;
    };

    const teardownDragHandlers = () => {
        if (!dragInitialized || !dragHandle) {
            return;
        }
        dragHandle.removeEventListener('mousedown', onMouseDown);
        dragHandle.removeEventListener('touchstart', onTouchStart);
        dragInitialized = false;
        dragHandle = null;
        stopDragging();
    };

    let resizeListenerAttached = false;

    const handleResize = () => {
        if (!panelEl || !visible) {
            return;
        }
        schedulePanelRefresh();
    };

    const attachResizeListener = () => {
        if (resizeListenerAttached || typeof window === 'undefined') {
            return;
        }
        window.addEventListener('resize', handleResize);
        resizeListenerAttached = true;
    };

    const detachResizeListener = () => {
        if (!resizeListenerAttached || typeof window === 'undefined') {
            return;
        }
        window.removeEventListener('resize', handleResize);
        resizeListenerAttached = false;
    };

    const startShowAnimation = () => {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        if (appearState === 'visible' || appearState === 'entering') {
            return;
        }
        appearState = 'entering';
        requestAnimationFrame(() => {
            if (!visible) {
                return;
            }
            appearState = 'visible';
            schedulePanelRefresh();
        });
    };

    const startHideAnimation = () => {
        if (appearState === 'hidden' || appearState === 'hiding') {
            return;
        }
        appearState = 'hiding';
        if (hideTimer) {
            clearTimeout(hideTimer);
        }
        hideTimer = setTimeout(() => {
            if (visible) {
                return;
            }
            appearState = 'hidden';
            if (typeof afterHide === 'function') {
                afterHide();
            }
        }, APPEAR_DURATION);
    };

    onMount(() => {
        setupDragHandlers();
        attachResizeListener();
        refreshPanelPosition();
        return () => {
            teardownDragHandlers();
            detachResizeListener();
        };
    });

    $effect(() => {
        if (!panelEl || !dragHandle) {
            return;
        }
        setupDragHandlers();
    });

    onDestroy(() => {
        teardownDragHandlers();
        detachResizeListener();
        if (hideTimer) {
            clearTimeout(hideTimer);
        }
    });

    const stackItems = $derived(() => Array.isArray(stack) ? stack.filter(Boolean) : []);
    const stackCount = $derived(() => stackItems().length);

    $effect(() => {
        if (!panelEl) {
            return;
        }

        panelEl.setAttribute('aria-hidden', visible ? 'false' : 'true');

        if (!visible) {
            delete panelEl.dataset.userMoved;
            panelEl.classList.remove('stack-popup-dragging');
        } else if (!previousVisible) {
            schedulePanelRefresh();
        }
    });

    $effect(() => {
        if (visible) {
            startShowAnimation();
        } else {
            startHideAnimation();
        }

        previousVisible = visible;
    });
</script>

<div
    bind:this={panelEl}
    id="stack-popup"
    class="stack-popup"
    data-appear={appearState}
    role="dialog"
    aria-label="Stack"
    aria-hidden={visible ? 'false' : 'true'}>
    <div class="stack-popup-header" data-draggable-handle bind:this={dragHandle}>
        <div class="stack-popup-title">
            <span class="stack-popup-icon">{panelIcon}</span>
            <span class="stack-popup-label">{panelTitle}</span>
            <span class="stack-popup-count">{stackCount()}</span>
        </div>
    </div>

    <div class="stack-popup-body">
        <div class="stack-container">
            <div
                class="stack-content"
                role="list"
                aria-label="Stack Spells"
                ondragover={handleStackDragOver}
                ondrop={handleStackDrop}>
                {#if stackItems().length === 0}
                    <div class="stack-empty">
                        <div class="text-2xl mb-2">📚</div>
                        <div>The stack is empty</div>
                        <div class="text-[10px] mt-1 text-arena-text-dim/60">
                            Spells and abilities will appear here
                        </div>
                    </div>
                {:else}
                    {#each stackItems() as card, index (card.unique_id || index)}
                        {#if card}
                            <div
                                class={`stack-spell${card.targeted ? ' targeted' : ''}${isSpellClickable(card) ? '' : ' not-clickable'}`}
                                data-index={index}
                                data-card-id={getCardId(card)}
                                data-card-unique-id={card.unique_id}
                                data-card-name={getDisplayName(card)}
                                data-card-image={getCardImage(card) || ''}
                                data-card-zone="stack"
                                data-card-owner={getOwnerId(card)}
                                data-card-controller={getControllerId(card)}
                                data-card-data={getCardDataAttr(card)}
                                data-stack-index={index}
                                draggable={canDragCard(card)}
                                role="button"
                                tabindex="0"
                                onclick={(event) => handleSpellClick(event, card)}
                                ondragstart={(event) => handleCardDragStart(event, card)}
                                ondragend={handleCardDragEnd}
                                oncontextmenu={handleContextMenu}
                                onkeydown={(event) => handleSpellKeydown(event, card)}>
                                <div class="stack-card-container">
                                    {#if getCardImage(card)}
                                        <img
                                            src={getCardImage(card)}
                                            alt={getDisplayName(card)}
                                            class="stack-card-image" />
                                    {:else}
                                        <div class="stack-card-fallback" aria-label={getDisplayName(card)}></div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    {/each}
                {/if}
            </div>
        </div>
    </div>
</div>
