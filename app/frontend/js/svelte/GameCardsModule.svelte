<script>
    /**
     * ManaForge Game Cards Module (Svelte Runes)
     * Card rendering and management functions
     */
    import { onDestroy } from 'svelte';
    import {
        CARD_BACK_IMAGE,
        isFaceDownCard,
        canViewerSeeFaceDownCard,
        buildMaskedCardData,
        isCreatureCard,
        getSafeImageUrl,
        preloadCardImages,
        buildSearchIndex,
        computeEffectivePowerToughness,
        getCustomKeywords,
        getCustomTypes,
        getCounterIcon,
        getCounterClass,
        computeCardVisualState,
        resolvePrimaryCardType,
        generateCountersHtml,
        generatePowerToughnessOverlay,
        generateKeywordOverlay,
        generateTypeOverlay,
        generateCommanderOverlay,
        generateCardOverlayStack,
        getAttachmentsFromState,
        escapeHtml,
        getCurrentViewerSeat
    } from './lib/game-cards-utils.js';

    import {
        getDraggedCardElement,
        setDraggedCardElement,
        getLastContextPosition,
        setLastContextPosition,
        getAttachmentSelection,
        setAttachmentSelection,
        getAttachmentTargets,
        setAttachmentTargets,
        clearAttachmentTargets,
        getArrowSelection,
        setArrowSelection,
        getArrowTargets,
        setArrowTargets,
        clearArrowTargets,
        getTargetingArrows,
        addTargetingArrow,
        removeAllArrowsFromCard,
        clearAllTargetingArrows
    } from './stores/gameCardsStore.js';
    import { UIConfig } from '@lib/ui-config';

    // ===== REACTIVE STATE =====
    let boundAttachmentClickHandler = $state(null);
    let boundAttachmentKeydownHandler = $state(null);
    let boundCloseAttachmentClick = $state(null);
    let boundAttachmentMenuClose = $state(null);
    let boundAttachmentMenuKeydown = $state(null);

    // Arrow selection handlers
    let boundArrowClickHandler = $state(null);
    let boundArrowKeydownHandler = $state(null);

    // ===== CARD RENDERING =====
    function renderCardWithLoadingState(
        card,
        cardClass = 'card-mini',
        _showTooltip = true,
        zone = 'unknown',
        isOpponent = false,
        _index = 0,
        _playerId = null,
        options = {}
    ) {
        const cardId = card.id || card.name;
        const cardName = card.name || 'Unknown';
        const viewerSeat = getCurrentViewerSeat();
        const isFaceDown = isFaceDownCard(card);
        const maskForViewer = isFaceDown && !canViewerSeeFaceDownCard(card, viewerSeat);
        const displayCardLabel = isFaceDown ? 'Face-down Card' : cardName;
        const actualImageUrl = getSafeImageUrl(card, { ignoreFaceDown: true });
        const thumbnailImageUrl = isFaceDown ? CARD_BACK_IMAGE : actualImageUrl;
        const previewImageUrl = maskForViewer ? CARD_BACK_IMAGE : actualImageUrl;
        const cardDataForAttr = maskForViewer ? buildMaskedCardData(card, displayCardLabel) : card;
        const serializedCardData = JSON.stringify(cardDataForAttr).replace(/'/g, "&#39;");
        const visualState = computeCardVisualState(card, zone, isOpponent);
        const stateClasses = visualState.classes;
        const stateFlags = visualState.data;
        const combatTappedClass = stateClasses.combatTapped ? ' combat-tapped' : '';
        const tappedClass = stateClasses.tapped ? ' tapped' : '';
        const targetedClass = stateClasses.targeted ? ' targeted' : '';
        const attackingClass = stateClasses.attacking ? ' attacking-creature' : '';
        const blockingClass = stateClasses.blocking ? ' blocking-creature' : '';
        const uniqueCardId = card.unique_id;

        const { primaryCardType } = resolvePrimaryCardType(card);
        const controllerId = card.controller_id || card.controllerId || card.owner_id || card.ownerId || '';
        const ownerId = card.owner_id || card.ownerId || '';
        const zoneOwnerId = (options && options.zoneOwner) || '';

        const dataCardId = escapeHtml(cardId || '');
        const dataCardName = escapeHtml((!maskForViewer ? cardName : displayCardLabel) || '');
        const dataImageUrl = escapeHtml(previewImageUrl || '');
        const dataUniqueId = escapeHtml(uniqueCardId || '');
        const dataZone = escapeHtml(zone || '');
        const dataCardType = escapeHtml(primaryCardType || '');
        const dataCardOwner = escapeHtml(ownerId || '');
        const dataCardController = escapeHtml(controllerId || '');
        const dataZoneOwner = escapeHtml(zoneOwnerId || '');
        const attachmentHostId = card.attached_to || card.attachedTo || '';
        const parsedAttachmentOrder = (() => {
            const raw = card?.attachment_order ?? card?.attachmentOrder;
            if (Number.isFinite(raw)) return raw;
            const parsed = parseInt(String(raw), 10);
            return Number.isFinite(parsed) ? parsed : null;
        })();
        const dataAttachmentHost = escapeHtml(attachmentHostId || '');
        const dataAttachmentOrder = parsedAttachmentOrder !== null ? parsedAttachmentOrder : '';
        const searchIndex = escapeHtml(maskForViewer ? 'face-down card' : buildSearchIndex(card));
        const jsCardId = JSON.stringify(cardId || '');
        const jsUniqueCardId = JSON.stringify(uniqueCardId || '');
        const zoneAttr = (zone || '').replace(/'/g, "\\'");
        const selectedPlayer = getCurrentViewerSeat();
        const spectatorView = selectedPlayer === 'spectator';
        const hasReadOnlyOption = options && Object.prototype.hasOwnProperty.call(options, 'readOnly');
        const readOnly = hasReadOnlyOption ? Boolean(options.readOnly) : spectatorView;
        const allowInteractions = !readOnly;
        const disableContextMenu = Boolean(options && options.disableContextMenu);
        const disableDrag = Boolean(options && options.disableDrag);
        const allowDrag = allowInteractions && !disableDrag;

        let onClickAction = '';
        if (allowInteractions && (zone === 'creatures' || zone === 'support' || zone === 'permanents' || zone === 'lands' || zone === 'battlefield')) {
            onClickAction = `onclick='GameCards.handleCardClick(${jsCardId}, ${jsUniqueCardId}, "${zone}"); event.stopPropagation();'`;
        } else if (allowInteractions && zone === 'hand') {
            onClickAction = `onclick='GameActions.playCardFromHand(${jsCardId}, ${jsUniqueCardId}); event.stopPropagation();'`;
        } else if (allowInteractions && (zone === 'commander_zone' || zone === 'commander')) {
            onClickAction = `onclick='GameActions.playCard(${jsCardId}, ${jsUniqueCardId}, "commander_zone"); event.stopPropagation();'`;
        }

        const enableDrop = zone === 'battlefield' || zone === 'lands' || zone === 'creatures' || zone === 'support' || zone === 'permanents';
        const dropAttributes = enableDrop
            ? `ondragover="UIZonesManager.handleZoneDragOver(event)" ondragleave="UIZonesManager.handleZoneDragLeave(event)" ondrop="UIZonesManager.handleZoneDrop(event, '${zoneAttr}')"`
            : '';
        const dropAttr = allowDrag ? dropAttributes : '';
        const dragStartAttr = allowDrag ? 'ondragstart="GameCards.handleDragStart(event, this)"' : '';
        const dragEndAttr = allowDrag ? 'ondragend="GameCards.handleDragEnd(event, this)"' : '';
        const allowCardContextMenu = allowInteractions && !disableContextMenu;
        const contextMenuAttr = allowCardContextMenu ? 'oncontextmenu="GameCards.showCardContextMenu(event, this); return false;"' : '';

        let combinedTransform = visualState.transformValue || '';
        if (options && options.offsetTransform) {
            combinedTransform = combinedTransform ? `${combinedTransform} ${options.offsetTransform}` : options.offsetTransform;
        }
        const styleParts = [];
        if (combinedTransform) styleParts.push(`transform: ${combinedTransform};`);
        if (options && options.inlineStyle) styleParts.push(String(options.inlineStyle));
        const inlineStyleText = styleParts.join(' ');

        const countersHtml = generateCountersHtml(card);
        const powerToughnessHtml = generatePowerToughnessOverlay(card);
        const overlayStack = generateCardOverlayStack(card);
        const commanderHtml = generateCommanderOverlay(card);

        return `
            <div class="${cardClass}${tappedClass}${combatTappedClass}${targetedClass}${attackingClass}${blockingClass}" 
                data-card-id="${dataCardId}"
                data-card-unique-id="${dataUniqueId}"
                data-card-name="${dataCardName}"
                data-card-image="${dataImageUrl}"
                data-card-zone="${dataZone}"
                data-card-type="${dataCardType}"
                data-card-owner="${dataCardOwner}"
                data-card-controller="${dataCardController}"
                data-zone-owner="${dataZoneOwner}"
                data-attached-to="${dataAttachmentHost}"
                data-attachment-order="${dataAttachmentOrder}"
                data-card-tapped="${stateFlags.isTapped}"
                data-card-targeted="${stateFlags.isTargeted}"
                data-card-search="${searchIndex}"
                data-card-data='${serializedCardData}'
                data-is-opponent="${isOpponent}"
                data-readonly="${readOnly}"
                style="${inlineStyleText}"
                draggable="${allowDrag ? 'true' : 'false'}"
                ${dragStartAttr}
                ${dropAttr}
                ${onClickAction}
                ${dragEndAttr}
                ${contextMenuAttr}>
                ${thumbnailImageUrl ? `
                    <div class="relative">
                        <img src="${thumbnailImageUrl}" 
                             alt="${displayCardLabel}" 
                             style="opacity: 0; transition: opacity 0.3s ease;"
                             onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="card-fallback" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none;"></div>
                        ${overlayStack}
                        ${countersHtml}
                        ${powerToughnessHtml}
                        ${commanderHtml}
                    </div>
                ` : `
                    <div class="card-fallback relative" aria-label="${displayCardLabel}">
                        ${overlayStack}
                        ${countersHtml}
                        ${powerToughnessHtml}
                        ${commanderHtml}
                    </div>
                `}
            </div>
        `;
    }

    function renderCardWithAttachments(card, attachments = [], zone = 'battlefield', isOpponent = false, playerId = null) {
        const hostHtml = renderCardWithLoadingState(card, 'card-battlefield', true, zone, isOpponent, 0, playerId, { zoneOwner: playerId });
        const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
        const hostId = card?.unique_id || card?.uniqueId || '';
        const safeHostId = escapeHtml(hostId || '');
        const visibleAttachments = normalizedAttachments.slice(0, 4);
        const overflowCount = normalizedAttachments.length - visibleAttachments.length;
        const offsetStep = 15;
        const offsetPadding = normalizedAttachments.length ? (normalizedAttachments.length * offsetStep) + 20 : 0;
        const groupStyle = offsetPadding ? `style="padding-bottom:${offsetPadding}px; padding-right:${offsetPadding}px;"` : '';

        const attachmentHtml = visibleAttachments.map((attachment, idx) => {
            const attachmentClass = (typeof UIConfig !== 'undefined' && UIConfig?.CSS_CLASSES?.card?.attachment) || 'card-attachment';
            return renderCardWithLoadingState(attachment, attachmentClass, true, zone, isOpponent, idx, playerId, { disableDrag: true, zoneOwner: playerId });
        }).join('');

        const overflowBadge = overflowCount > 0 ? `<div class="card-attachment-overflow">+${overflowCount}</div>` : '';
        const attachmentsSection = normalizedAttachments.length
            ? `<div class="card-attachment-pile">${attachmentHtml}${overflowBadge}</div>`
            : '';

        return `
            <div class="card-attachment-group"
                 data-attachment-host="${safeHostId}"
                 data-attachment-count="${normalizedAttachments.length}"
                 ${groupStyle}>
                <div class="card-host">${hostHtml}</div>
                ${attachmentsSection}
            </div>
        `;
    }

    function updateCardElementState(cardElement, cardData, zone = 'unknown', isOpponent = false) {
        if (!cardElement || !cardData) return;

        const visualState = computeCardVisualState(cardData, zone, isOpponent);
        const stateClasses = visualState.classes;
        const stateFlags = visualState.data;

        cardElement.classList.toggle('tapped', Boolean(stateClasses.tapped));
        cardElement.classList.toggle('combat-tapped', Boolean(stateClasses.combatTapped));
        cardElement.classList.toggle('targeted', Boolean(stateClasses.targeted));
        cardElement.classList.toggle('attacking-creature', Boolean(stateClasses.attacking));
        cardElement.classList.toggle('blocking-creature', Boolean(stateClasses.blocking));

        const viewerSeat = getCurrentViewerSeat();
        const maskForViewer = isFaceDownCard(cardData) && !canViewerSeeFaceDownCard(cardData, viewerSeat);
        const maskedData = maskForViewer ? buildMaskedCardData(cardData, 'Face-down Card') : cardData;
        const serializedData = JSON.stringify(maskedData).replace(/'/g, "&#39;");
        cardElement.setAttribute('data-card-data', serializedData);
        cardElement.setAttribute('data-card-tapped', stateFlags.isTapped ? 'true' : 'false');
        cardElement.setAttribute('data-card-targeted', stateFlags.isTargeted ? 'true' : 'false');

        if (visualState.transformValue) {
            cardElement.style.transform = visualState.transformValue;
        } else {
            cardElement.style.removeProperty('transform');
        }
    }

    // ===== CONTEXT MENU =====
    function showCardContextMenu(event, cardElement) {
        event.preventDefault();
        if (typeof CardContextMenu !== 'undefined' && typeof CardContextMenu.show === 'function') {
            CardContextMenu.show(event, cardElement);
        } else {
            console.warn('[GameCards] CardContextMenu component not available');
        }
    }

    function closeContextMenu() {
        if (typeof CardContextMenu !== 'undefined' && typeof CardContextMenu.hide === 'function') {
            CardContextMenu.hide();
        }
    }

    // ===== CARD ACTIONS =====
    function toggleCardTarget(uniqueCardId) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();

        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const isTargeted = cardElement.classList.toggle('targeted');
            cardElement.setAttribute('data-card-targeted', isTargeted.toString());
            const cardId = cardElement.getAttribute('data-card-id');

            if (typeof GameActions !== 'undefined') {
                GameActions.performGameAction('target_card', {
                    unique_id: uniqueCardId,
                    card_id: cardId,
                    targeted: isTargeted
                });
            }
        }
    }

    function flipCard(cardId, uniqueCardId) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();

        if (typeof GameActions !== 'undefined') {
            GameActions.performGameAction('flip_card', {
                card_id: cardId,
                unique_id: uniqueCardId
            });
        }
    }

    function handleCardClick(cardId, uniqueCardId, zone) {
        if (typeof GameCombat !== 'undefined') {
            if (GameCombat.combatMode === 'declaring_attackers' && zone === 'creatures') {
                GameCombat.toggleAttacker(uniqueCardId);
                return;
            }
            if (GameCombat.combatMode === 'declaring_blockers' && zone === 'creatures') {
                GameCombat.toggleBlocker(uniqueCardId);
                return;
            }
        }
        if (typeof GameActions !== 'undefined') {
            GameActions.tapCard(cardId, uniqueCardId);
        }
    }

    // ===== DRAG AND DROP =====
    function handleDragStart(event, cardElement) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();

        const cardId = cardElement.getAttribute('data-card-id');
        const cardZone = cardElement.getAttribute('data-card-zone');
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id');
        const cardOwnerId = cardElement.getAttribute('data-card-owner');
        const cardControllerId = cardElement.getAttribute('data-card-controller');
        const zoneOwnerId = cardElement.getAttribute('data-zone-owner');

        event.dataTransfer?.setData('text/plain', JSON.stringify({
            cardId,
            cardZone,
            uniqueCardId,
            cardOwnerId,
            cardControllerId,
            zoneOwnerId
        }));

        const dragHandle = cardElement.closest('.card-attachment-group') || cardElement;
        dragHandle.classList.add('dragging');
        if (dragHandle !== cardElement) cardElement.classList.add('dragging');
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        setDraggedCardElement(dragHandle);
    }

    function handleDragEnd(event, cardElement) {
        if (!cardElement) return;

        cardElement.classList.remove('dragging');
        const dragHandle = cardElement.closest('.card-attachment-group') || cardElement;
        if (dragHandle && dragHandle !== cardElement) {
            dragHandle.classList.remove('dragging');
        }
        cardElement.style.removeProperty('opacity');
        cardElement.style.removeProperty('pointer-events');

        const currentDraggedElement = getDraggedCardElement();
        if (currentDraggedElement === cardElement || currentDraggedElement === dragHandle) {
            setDraggedCardElement(null);
        }
    }

    // ===== ATTACHMENT MANAGEMENT =====
    function startAttachmentSelection(cardId, uniqueCardId) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();
        closeContextMenu();
        cancelAttachmentSelection();

        const sourceElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        const sourceOwner = sourceElement ? sourceElement.getAttribute('data-card-owner') : null;

        const candidates = Array.from(
            document.querySelectorAll('.battlefield-zone [data-card-unique-id]')
        ).filter((el) => {
            const uid = el.getAttribute('data-card-unique-id');
            return uid && uid !== uniqueCardId;
        });

        if (!candidates.length) {
            console.warn('[GameCards] No valid attachment targets found.');
            return;
        }

        setAttachmentSelection({ cardId, uniqueId: uniqueCardId, owner: sourceOwner });
        setAttachmentTargets(candidates);
        candidates.forEach((el) => el.classList.add('attachment-targetable'));

        boundAttachmentClickHandler = handleAttachmentTargetClick;
        boundAttachmentKeydownHandler = handleAttachmentKeydown;

        document.addEventListener('click', boundAttachmentClickHandler, true);
        document.addEventListener('keydown', boundAttachmentKeydownHandler);
    }

    function handleAttachmentTargetClick(event) {
        const selection = getAttachmentSelection();
        if (!selection) return;

        const targetElement = event.target.closest('[data-card-unique-id]');
        if (!targetElement) {
            cancelAttachmentSelection();
            return;
        }

        const targetUniqueId = targetElement.getAttribute('data-card-unique-id');
        if (!targetUniqueId || targetUniqueId === selection.uniqueId) {
            cancelAttachmentSelection();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (typeof GameActions !== 'undefined' && typeof GameActions.attachCard === 'function') {
            const targetCardId = targetElement.getAttribute('data-card-id');
            GameActions.attachCard(
                selection.cardId,
                selection.uniqueId,
                targetCardId,
                targetUniqueId
            );
        }

        cancelAttachmentSelection();
    }

    function handleAttachmentKeydown(event) {
        if (event.key === 'Escape') cancelAttachmentSelection();
    }

    function cancelAttachmentSelection() {
        const targets = getAttachmentTargets();
        if (targets.length) {
            targets.forEach((el) => el.classList.remove('attachment-targetable'));
        }
        clearAttachmentTargets();
        setAttachmentSelection(null);

        if (boundAttachmentClickHandler) {
            document.removeEventListener('click', boundAttachmentClickHandler, true);
        }
        if (boundAttachmentKeydownHandler) {
            document.removeEventListener('keydown', boundAttachmentKeydownHandler);
        }
    }

    // ===== ARROW TARGETING MANAGEMENT =====
    function startArrowSelection(cardId, uniqueCardId) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();
        closeContextMenu();
        cancelArrowSelection();

        // Find all cards on the battlefield or stack that could be targets (any card except the source)
        const candidates = Array.from(
            document.querySelectorAll('[data-card-unique-id]')
        ).filter((el) => {
            const uid = el.getAttribute('data-card-unique-id');
            const zone = el.getAttribute('data-card-zone') || '';
            // Allow targeting cards on battlefield zones and stack
            const isValidZone = ['battlefield', 'creatures', 'lands', 'support', 'permanents', 'stack'].includes(zone);
            return uid && uid !== uniqueCardId && isValidZone;
        });

        if (!candidates.length) {
            console.warn('[GameCards] No valid arrow targets found.');
            return;
        }

        setArrowSelection({ cardId, uniqueId: uniqueCardId });
        setArrowTargets(candidates);
        candidates.forEach((el) => el.classList.add('arrow-targetable'));

        boundArrowClickHandler = handleArrowTargetClick;
        boundArrowKeydownHandler = handleArrowKeydown;

        document.addEventListener('click', boundArrowClickHandler, true);
        document.addEventListener('keydown', boundArrowKeydownHandler);
    }

    function handleArrowTargetClick(event) {
        const selection = getArrowSelection();
        if (!selection) return;

        const targetElement = event.target.closest('[data-card-unique-id]');
        if (!targetElement) {
            cancelArrowSelection();
            return;
        }

        const targetUniqueId = targetElement.getAttribute('data-card-unique-id');
        if (!targetUniqueId || targetUniqueId === selection.uniqueId) {
            cancelArrowSelection();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        // Draw the arrow locally immediately for responsiveness
        drawTargetingArrow(selection.uniqueId, targetUniqueId);

        // Send the arrow to the server via game action (will be persisted and broadcast)
        // The store will be updated when we receive the broadcast back
        if (typeof GameActions !== 'undefined' && typeof GameActions.performGameAction === 'function') {
            GameActions.performGameAction('add_targeting_arrow', {
                source_id: selection.uniqueId,
                target_id: targetUniqueId
            });
        }

        cancelArrowSelection();
    }

    function handleArrowKeydown(event) {
        if (event.key === 'Escape') cancelArrowSelection();
    }

    function cancelArrowSelection() {
        const targets = getArrowTargets();
        if (targets.length) {
            targets.forEach((el) => el.classList.remove('arrow-targetable'));
        }
        clearArrowTargets();
        setArrowSelection(null);

        if (boundArrowClickHandler) {
            document.removeEventListener('click', boundArrowClickHandler, true);
        }
        if (boundArrowKeydownHandler) {
            document.removeEventListener('keydown', boundArrowKeydownHandler);
        }
    }
    function drawTargetingArrow(sourceUniqueId, targetUniqueId) {
        const source = document.querySelector(`[data-card-unique-id="${sourceUniqueId}"]`);
        const target = document.querySelector(`[data-card-unique-id="${targetUniqueId}"]`);

        if (!source || !target) return;

        // Remove any existing arrow between these two cards
        removeTargetingArrowElement(sourceUniqueId, targetUniqueId);

        // Create arrow element
        const arrow = document.createElement('div');
        arrow.className = 'targeting-arrow';
        arrow.dataset.source = sourceUniqueId;
        arrow.dataset.target = targetUniqueId;

        // Calculate positions
        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        const startX = sourceRect.left + sourceRect.width / 2;
        const startY = sourceRect.top + sourceRect.height / 2;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;

        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

        arrow.style.width = `${length}px`;
        arrow.style.left = `${startX}px`;
        arrow.style.top = `${startY}px`;
        arrow.style.transform = `rotate(${angle}deg)`;
        arrow.style.transformOrigin = '0 0';

        document.body.appendChild(arrow);
    }

    function removeTargetingArrowElement(sourceUniqueId, targetUniqueId = null) {
        const selector = targetUniqueId
            ? `.targeting-arrow[data-source="${sourceUniqueId}"][data-target="${targetUniqueId}"]`
            : `.targeting-arrow[data-source="${sourceUniqueId}"]`;
        document.querySelectorAll(selector).forEach(arrow => arrow.remove());
    }

    function removeAllArrowsFromCardElement(uniqueId, broadcast = true) {
        // Remove arrows where card is source or target
        document.querySelectorAll(`.targeting-arrow[data-source="${uniqueId}"]`).forEach(arrow => arrow.remove());
        document.querySelectorAll(`.targeting-arrow[data-target="${uniqueId}"]`).forEach(arrow => arrow.remove());
        // Also update the store
        removeAllArrowsFromCard(uniqueId);

        // Send the removal to the server via game action (will be persisted and broadcast)
        if (broadcast && typeof GameActions !== 'undefined' && typeof GameActions.performGameAction === 'function') {
            GameActions.performGameAction('remove_targeting_arrow', {
                source_id: uniqueId
            });
        }
    }

    function clearAllTargetingArrowElements(broadcast = false) {
        // Get all unique source IDs before clearing
        const arrows = getTargetingArrows();
        const sourceIds = [...new Set(arrows.map(a => a.sourceId))];

        // Remove all DOM arrows
        document.querySelectorAll('.targeting-arrow').forEach(arrow => arrow.remove());
        clearAllTargetingArrows();

        // Broadcast removal for each source if requested
        if (broadcast && sourceIds.length > 0) {
            sourceIds.forEach(sourceId => {
                GameActions.performGameAction('remove_targeting_arrow', {
                    source_id: sourceId
                });
            });
        }
    }

    function redrawAllTargetingArrows() {
        // Remove all DOM arrows
        document.querySelectorAll('.targeting-arrow').forEach(arrow => arrow.remove());
        // Redraw from store
        const arrows = getTargetingArrows();
        arrows.forEach(({ sourceId, targetId }) => {
            drawTargetingArrow(sourceId, targetId);
        });
    }

    function loadArrowsFromGameState(gameState) {
        if (!gameState) return;

        // Clear existing arrows
        clearAllTargetingArrowElements();

        // Load arrows from game state
        const arrows = gameState.targeting_arrows || [];
        arrows.forEach(arrow => {
            const sourceId = arrow.source_id;
            const targetId = arrow.target_id;
            if (sourceId && targetId) {
                addTargetingArrow(sourceId, targetId);
                // Delay drawing to ensure DOM elements exist
                requestAnimationFrame(() => {
                    drawTargetingArrow(sourceId, targetId);
                });
            }
        });
    }

    function hasArrowsFromCard(uniqueId) {
        const arrows = getTargetingArrows();
        return arrows.some(a => a.sourceId === uniqueId);
    }

    function showAttachmentsModal(hostUniqueId, hostName = 'Attached Cards') {
        if (!hostUniqueId) return;

        const attachmentsFromState = getAttachmentsFromState(hostUniqueId);
        const domAttachments = Array.from(document.querySelectorAll(`[data-attached-to="${hostUniqueId}"]`));
        const attachments = attachmentsFromState.length
            ? attachmentsFromState
            : domAttachments.map((el) => {
                try {
                    const parsed = JSON.parse(el.getAttribute('data-card-data') || '{}');
                    const zoneAttr = el.getAttribute('data-card-zone') || 'battlefield';
                    return {
                        ...parsed,
                        card_zone: parsed.card_zone || zoneAttr,
                        zone: parsed.zone || zoneAttr,
                        name: parsed.name || el.getAttribute('data-card-name') || parsed.id || 'Card'
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

        if (!attachments.length) return;

        closeAttachmentsModal();

        const modal = document.createElement('div');
        modal.id = 'attachment-popup';
        modal.className = 'stack-popup attachment-popup';
        modal.dataset.appear = 'visible';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Attached Cards');

        const countLabel = attachments.length;
        const itemsHtml = attachments.map((cardData) => {
            const zone = cardData?.zone || cardData?.card_zone || 'battlefield';
            const ownerId = cardData?.owner_id || cardData?.ownerId || '';
            const controllerId = cardData?.controller_id || cardData?.controllerId || ownerId;
            const cardId = cardData?.id || cardData?.card_id || cardData?.name || '';
            const uniqueId = cardData?.unique_id || cardData?.uniqueId || '';
            const cardName = cardData?.name || 'Card';
            const imageUrl = getSafeImageUrl(cardData);
            const safeName = escapeHtml(cardName);
            const safeImage = escapeHtml(imageUrl || '');
            const serialized = escapeHtml(JSON.stringify(cardData));

            return `
                <div class="stack-spell"
                     data-card-id="${escapeHtml(cardId)}"
                     data-card-unique-id="${escapeHtml(uniqueId)}"
                     data-card-name="${safeName}"
                     data-card-image="${safeImage}"
                     data-card-zone="${escapeHtml(zone)}"
                     data-card-owner="${escapeHtml(ownerId)}"
                     data-card-controller="${escapeHtml(controllerId)}"
                     data-card-data='${serialized}'
                     draggable="true"
                     ondragstart="GameCards.handleDragStart(event, this)"
                     ondragend="GameCards.handleDragEnd(event, this)"
                     oncontextmenu="GameCards.handleAttachmentModalContextMenu(event, this); return false;">
                    <div class="stack-card-container">
                        ${safeImage
                            ? `<img src="${safeImage}" alt="${safeName}" class="stack-card-image" />`
                            : `<div class="stack-card-fallback"></div>`}
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="stack-popup-header" data-draggable-handle>
                <div class="stack-popup-title">
                    <span class="stack-popup-icon">📎</span>
                    <span class="stack-popup-label">${escapeHtml(hostName)}</span>
                    <span class="stack-popup-count">${countLabel}</span>
                </div>
                <button class="counter-modal-close" onclick="GameCards.closeAttachmentsModal()" aria-label="Close attachments">&times;</button>
            </div>
            <div class="stack-popup-body">
                <div class="stack-container">
                    <div class="stack-content" role="list" aria-label="Attached Cards">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const clampPosition = (left, top) => {
            const padding = 12;
            const rect = modal.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width - padding;
            const maxY = window.innerHeight - rect.height - padding;
            const clampedLeft = Math.min(Math.max(left, padding), Math.max(maxX, padding));
            const clampedTop = Math.min(Math.max(top, padding), Math.max(maxY, padding));
            modal.style.left = `${clampedLeft}px`;
            modal.style.top = `${clampedTop}px`;
        };

        const pointer = getLastContextPosition();
        const modalRect = modal.getBoundingClientRect();
        const fallbackLeft = Math.max(16, window.innerWidth - (modalRect.width || 360) - 32);
        const fallbackTop = Math.max(24, (window.innerHeight - (modalRect.height || 240)) / 2);
        const initialLeft = pointer ? pointer.x + 12 : fallbackLeft;
        const initialTop = pointer ? pointer.y + 12 : fallbackTop;
        clampPosition(initialLeft, initialTop);

        const dragHandle = modal.querySelector('[data-draggable-handle]');
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onMouseDown = (event) => {
            dragging = true;
            modal.classList.add('stack-popup-dragging');
            offsetX = event.clientX - modal.getBoundingClientRect().left;
            offsetY = event.clientY - modal.getBoundingClientRect().top;
            event.preventDefault();
        };

        const onMouseMove = (event) => {
            if (!dragging) return;
            clampPosition(event.clientX - offsetX, event.clientY - offsetY);
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            modal.classList.remove('stack-popup-dragging');
        };

        if (dragHandle) {
            dragHandle.addEventListener('mousedown', onMouseDown);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        modal._attachmentDragCleanup = () => {
            if (dragHandle) dragHandle.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        boundCloseAttachmentClick = (event) => {
            if (event.target === modal) closeAttachmentsModal();
        };
        modal.addEventListener('click', boundCloseAttachmentClick);
    }

    function handleAttachmentModalContextMenu(event, element = null) {
        event.preventDefault();
        event.stopPropagation();
        const cardElement = element || event.currentTarget || event.target.closest('[data-card-unique-id]');
        if (!cardElement) return false;

        const cardId = cardElement.getAttribute('data-card-id');
        const uniqueId = cardElement.getAttribute('data-card-unique-id');
        if (!cardId || !uniqueId) return false;

        closeAttachmentContextMenu();

        const menu = document.createElement('div');
        menu.id = 'attachment-context-menu';
        menu.className = 'card-context-menu';

        const detachItem = document.createElement('div');
        detachItem.className = 'card-context-menu-item';
        detachItem.innerHTML = '<span class="icon">🔓</span> Detach';
        detachItem.onclick = () => {
            if (typeof GameActions !== 'undefined' && typeof GameActions.detachCard === 'function') {
                GameActions.detachCard(cardId, uniqueId);
            }
            closeAttachmentContextMenu();
            closeAttachmentsModal();
        };

        menu.appendChild(detachItem);

        const pointerX = event.clientX || 0;
        const pointerY = event.clientY || 0;
        menu.style.left = `${pointerX}px`;
        menu.style.top = `${pointerY}px`;

        document.body.appendChild(menu);
        setLastContextPosition({ x: pointerX, y: pointerY });

        boundAttachmentMenuClose = (evt) => {
            if (!menu.contains(evt.target)) closeAttachmentContextMenu();
        };

        boundAttachmentMenuKeydown = (evt) => {
            if (evt.key === 'Escape') closeAttachmentContextMenu();
        };

        document.addEventListener('click', boundAttachmentMenuClose, true);
        document.addEventListener('keydown', boundAttachmentMenuKeydown);

        return false;
    }

    function closeAttachmentContextMenu() {
        const existing = document.getElementById('attachment-context-menu');
        if (existing) existing.remove();
        if (boundAttachmentMenuClose) {
            document.removeEventListener('click', boundAttachmentMenuClose, true);
        }
        if (boundAttachmentMenuKeydown) {
            document.removeEventListener('keydown', boundAttachmentMenuKeydown);
        }
    }

    function closeAttachmentsModal() {
        const modal = document.getElementById('attachment-popup');
        if (modal) {
            if (boundCloseAttachmentClick) {
                modal.removeEventListener('click', boundCloseAttachmentClick);
            }
            if (typeof modal._attachmentDragCleanup === 'function') {
                modal._attachmentDragCleanup();
            }
            modal.remove();
        }
        closeAttachmentContextMenu();
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();
    }

    // ===== POPOVER METHODS =====
    function showTypePopover(uniqueCardId, cardId) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openTypePopover === 'function') {
            UICardManager.openTypePopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Type popover is unavailable.');
        }
    }

    function showCounterPopover(uniqueCardId, cardId) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openCounterPopover === 'function') {
            UICardManager.openCounterPopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Counter popover is unavailable.');
        }
    }

    function showPowerToughnessPopover(uniqueCardId, cardId) {
        if (typeof CardPreviewModal !== 'undefined') CardPreviewModal.hide();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openPowerPopover === 'function') {
            UICardManager.openPowerPopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Power/Toughness popover is unavailable.');
        }
    }

    function showCounterModal(uniqueCardId, cardId) {
        showCounterPopover(uniqueCardId, cardId);
    }

    function closeCounterModal() {
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.closeAll === 'function') {
            UICardManager.closeAll();
        }
    }

    // ===== PUBLIC API =====
    const GameCardsAPI = {
        get draggedCardElement() { return getDraggedCardElement(); },
        set draggedCardElement(value) { setDraggedCardElement(value); },
        get _lastContextPosition() { return getLastContextPosition(); },
        set _lastContextPosition(value) { setLastContextPosition(value); },
        getCurrentViewerSeat,
        canViewerSeeFaceDownCard,
        _buildMaskedCardData: buildMaskedCardData,
        isFaceDownCard,
        isCreatureCard,
        getSafeImageUrl,
        preloadCardImages,
        buildSearchIndex,
        computeEffectivePowerToughness,
        generatePowerToughnessOverlay,
        _computeCardVisualState: computeCardVisualState,
        renderCardWithLoadingState,
        renderCardWithAttachments,
        updateCardElementState,
        generateCountersHtml,
        getCustomKeywords,
        getCustomTypes,
        generateKeywordOverlay,
        generateTypeOverlay,
        generateCommanderOverlay,
        generateCardOverlayStack,
        getCounterIcon,
        getCounterClass,
        showCardContextMenu,
        toggleCardTarget,
        closeContextMenu,
        _getAttachmentsFromState: getAttachmentsFromState,
        showAttachmentsModal,
        handleAttachmentModalContextMenu,
        closeAttachmentContextMenu,
        closeAttachmentsModal,
        startAttachmentSelection,
        handleAttachmentTargetClick,
        handleAttachmentKeydown,
        cancelAttachmentSelection,
        // Arrow targeting functions
        startArrowSelection,
        handleArrowTargetClick,
        handleArrowKeydown,
        cancelArrowSelection,
        drawTargetingArrow,
        removeTargetingArrowElement,
        removeAllArrowsFromCardElement,
        clearAllTargetingArrowElements,
        redrawAllTargetingArrows,
        hasArrowsFromCard,
        loadArrowsFromGameState,
        flipCard,
        handleDragStart,
        handleCardClick,
        handleDragEnd,
        showTypePopover,
        showCounterPopover,
        showPowerToughnessPopover,
        showCounterModal,
        closeCounterModal
    };

    // Register globally
    if (typeof window !== 'undefined') {
        window.GameCards = GameCardsAPI;
    }

    onDestroy(() => {
        cancelAttachmentSelection();
        cancelArrowSelection();
        closeAttachmentsModal();
        closeAttachmentContextMenu();
    });
</script>
