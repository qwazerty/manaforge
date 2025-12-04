<svelte:options accessors={true} />

<script>
    import { onMount } from 'svelte';
    import { createClassComponent } from 'svelte/legacy';

    // Import zone components for dynamic mounting
    import DeckZone from './DeckZone.svelte';
    import GraveyardZone from './GraveyardZone.svelte';
    import ExileZone from './ExileZone.svelte';
    import LifeZone from './LifeZone.svelte';
    import ZonePopup from './ZonePopup.svelte';

    // Helper to mount Svelte 5 components dynamically
    const mountComponent = (Component, options) => {
        return createClassComponent({ component: Component, ...options });
    };

    const _unmountComponent = (instance) => {
        if (instance && typeof instance.$destroy === 'function') {
            instance.$destroy();
        }
    };

    /**
     * ManaForge Unified Zones Manager Module
     * Combines zone generation and zone modal management
     */

    class UIZonesManager {
        static _zonePopupElements = new Map();
        static _zonePopupComponents = new Map();
        static _deckZoneConfigs = new Map();
        static _graveyardZoneConfigs = new Map();
        static _exileZoneConfigs = new Map();
        static _lifeZoneConfigs = new Map();
        static _pendingLibraryShuffle = false;
        static _zoneConfigCounter = 0;
        // ===== CONSTANTS =====
        static CARD_TYPE_ICONS = {
            'creature': '🦎',
            'instant': '⚡',
            'sorcery': '🔮',
            'enchantment': '✨',
            'artifact': '⚙️',
            'planeswalker': '👑',
            'land': '🏔️',
            'default': ''
        };

        static ZONE_INFO = {
            'graveyard': { title: 'Graveyard', icon: '⚰️', description: 'Cards that have been destroyed or discarded' },
            'exile': { title: 'Exile', icon: '🌌', description: 'Cards that have been exiled from the game' },
            'deck': { title: 'Library', icon: '📚', description: 'Cards remaining in your library' },
            'hand': { title: 'Hand', icon: '🃏', description: 'Cards in your hand' },
            'commander': { title: 'Commander', icon: '👑', description: 'Command zone with your commander and tax' },
            'battlefield': { title: 'Battlefield', icon: '⚔️', description: 'Cards currently in play' },
            'reveal': { title: 'Reveal Zone', icon: '👁️', description: 'Cards currently revealed to all players' },
            'look': { title: 'Look Zone', icon: '🕵️', description: 'Cards you are looking at from your library' }
        };

        static _getSelectedPlayer() {
            return typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function'
                ? GameCore.getSelectedPlayer()
                : 'player1';
        }

        static _determinePlayerOwnerId(playerData, playerIndex, isOpponent) {
            if (playerData?.id && typeof playerData.id === 'string') {
                return playerData.id;
            }
            if (typeof playerIndex === 'number' && !Number.isNaN(playerIndex)) {
                return `player${playerIndex + 1}`;
            }
            return isOpponent ? 'player2' : 'player1';
        }

        static _renderZoneLabel(zoneKey) {
            const info = this.ZONE_INFO[zoneKey];
            if (!info) {
                return '';
            }

            const iconMarkup = info.icon
                ? `<span class="text-base leading-none">${info.icon}</span>`
                : '';

            return `
                <div class="zone-label w-full flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-arena-text-dim mb-2">
                    ${iconMarkup}
                    <span>${info.title}</span>
                </div>
            `;
        }

        // ===== ZONE GENERATION =====
    
        /**
         * Generate deck zone with clickable cards for drawing
         */
        static generateDeckZone(deck = [], isOpponent = false) {
            const config = ZoneData.getDeckZoneConfig(deck, isOpponent);
            const zoneLabel = this._renderZoneLabel('deck');
            const ownerKey = isOpponent ? 'player2' : 'player1';
            const zoneKey = this._registerZoneConfig('deck', config);

            const deckPlaceholder = `
                <div class="deck-zone-placeholder" data-zone-type="deck" data-zone-owner="${ownerKey}" data-zone-key="${zoneKey}"></div>
            `;

            const zoneContent = UIUtils.generateZoneWrapper(`
                <div class="relative flex flex-col items-center py-4"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, 'deck')">
                    ${zoneLabel}
                    ${deckPlaceholder}
                </div>
            `, 'deck');

            return zoneContent;
        }

        /**
         * Generate graveyard zone with stack effect showing actual card images
         */
        static generateGraveyardZone(graveyard = [], isOpponent = false) {
            const config = ZoneData.getGraveyardZoneConfig(graveyard, isOpponent);
            const zoneLabel = this._renderZoneLabel('graveyard');
            const ownerKey = isOpponent ? 'player2' : 'player1';
            const zoneKey = this._registerZoneConfig('graveyard', { ...config, ownerKey });

            const graveyardPlaceholder = `
                <div class="graveyard-zone-placeholder" data-zone-type="graveyard" data-zone-owner="${ownerKey}" data-zone-key="${zoneKey}"></div>
            `;

            const zoneContent = UIUtils.generateZoneWrapper(`
                <div class="relative flex flex-col items-center py-4"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, 'graveyard')">
                    ${zoneLabel}
                    ${graveyardPlaceholder}
                </div>
            `, 'graveyard');

            return zoneContent;
        }

        /**
         * Generate exile zone with single card preview and stack effect
         */
        static generateExileZone(exile = [], isOpponent = false) {
            const config = ZoneData.getExileZoneConfig(exile, isOpponent);
            const zoneLabel = this._renderZoneLabel('exile');
            const ownerKey = isOpponent ? 'player2' : 'player1';
            const zoneKey = this._registerZoneConfig('exile', { ...config, ownerKey });

            const placeholder = `
                <div class="exile-zone-placeholder" data-zone-type="exile" data-zone-owner="${ownerKey}" data-zone-key="${zoneKey}"></div>
            `;

            const zoneContent = UIUtils.generateZoneWrapper(`
                <div class="relative flex flex-col items-center py-4"
                    ondragover="UIZonesManager.handleZoneDragOver(event)"
                    ondrop="UIZonesManager.handleZoneDrop(event, 'exile')">
                    ${zoneLabel}
                    ${placeholder}
                </div>
            `, 'exile');

            return zoneContent;
        }

        /**
         * Generate life total zone with enhanced life controls
         */
        static generateLifeZone(playerData, playerId, _titlePrefix) {
            const config = ZoneData.getLifeZoneConfig(playerData, playerId);
            const ownerKey = playerId || 'player1';
            const zoneKey = this._registerZoneConfig('life', { ...config, ownerKey });
            const placeholder = `
                <div class="life-zone-placeholder" data-zone-type="life" data-zone-owner="${ownerKey}" data-zone-key="${zoneKey}"></div>
            `;

            return UIUtils.generateZoneWrapper(placeholder, 'life');
        }

        /**
         * Display custom life input field for personalized adjustments.
         */
        static openCustomLifeInput(playerId, direction = 1, anchorElement = null) {
            const container = document.getElementById(`life-custom-input-${playerId}`);
            const label = document.getElementById(`life-custom-input-label-${playerId}`);
            const input = document.getElementById(`life-custom-value-${playerId}`);
            if (!container || !label || !input) {
                return;
            }

            const normalizedDirection = Number(direction) >= 0 ? 1 : -1;
            container.dataset.direction = normalizedDirection > 0 ? 'positive' : 'negative';
            label.textContent = normalizedDirection > 0
                ? 'Add custom amount'
                : 'Remove custom amount';
            container.classList.remove('hidden');
            container.dataset.anchor = '';

            const panelWidth = container.offsetWidth || 320;
            const panelHeight = container.offsetHeight || 220;
            const popoverPosition = (typeof UIUtils !== 'undefined' && typeof UIUtils.calculateAnchorPosition === 'function')
                ? UIUtils.calculateAnchorPosition(anchorElement, {
                    preferredAnchor: anchorElement ? 'bottom-left' : 'center',
                    panelWidth,
                    panelHeight,
                    horizontalOffset: 0,
                    verticalOffset: 8
                })
                : null;

            if (popoverPosition) {
                container.style.position = 'fixed';
                container.style.top = `${popoverPosition.top}px`;
                container.style.left = `${popoverPosition.left}px`;
                container.style.transform = this._resolveAnchorTransform(popoverPosition.anchor);
                container.dataset.anchor = popoverPosition.anchor || '';
            } else {
                container.style.removeProperty('position');
                container.style.removeProperty('top');
                container.style.removeProperty('left');
                container.style.transform = '';
            }

            input.value = '';
            input.focus();
        }

        /**
         * Apply the custom life value entered by the user.
         */
        static submitCustomLifeInput(playerId) {
            const container = document.getElementById(`life-custom-input-${playerId}`);
            const input = document.getElementById(`life-custom-value-${playerId}`);
            if (!container || !input) {
                return;
            }

            const rawAmount = Math.abs(parseInt(input.value, 10));
            if (!rawAmount) {
                if (window.GameUI && typeof GameUI.logMessage === 'function') {
                    GameUI.logMessage('Enter a valid amount', 'warning');
                }
                input.focus();
                return;
            }

            const direction = container.dataset.direction === 'negative' ? -1 : 1;
            GameActions.modifyLife(playerId, rawAmount * direction);
            this.cancelCustomLifeInput(playerId);
        }

        /**
         * Hide and reset the custom life input field.
         */
        static cancelCustomLifeInput(playerId) {
            const container = document.getElementById(`life-custom-input-${playerId}`);
            const input = document.getElementById(`life-custom-value-${playerId}`);
            if (!container) {
                return;
            }

            container.classList.add('hidden');
            container.dataset.direction = '';
            container.dataset.anchor = '';
            container.style.removeProperty('position');
            container.style.removeProperty('top');
            container.style.removeProperty('left');
            container.style.removeProperty('transform');
            if (input) {
                input.value = '';
            }
        }

        static _resolveAnchorTransform(anchor = 'center') {
            const normalized = typeof anchor === 'string' ? anchor.toLowerCase() : 'center';
            let translateX = '-50%';
            if (normalized.includes('left')) {
                translateX = '0';
            } else if (normalized.includes('right')) {
                translateX = '-100%';
            }

            let translateY = '-50%';
            if (normalized.includes('top')) {
                translateY = '0';
            } else if (normalized.includes('bottom')) {
                translateY = '-100%';
            }

            return `translate(${translateX}, ${translateY})`;
        }

        // ===== ZONE MODAL MANAGEMENT =====
    
        static markLibrarySearchRequiresShuffle() {
            this._pendingLibraryShuffle = true;
        }

        /**
         * Show zone modal for current player
         */
        static showZoneModal(zoneName) {
            const gameState = GameCore.getGameState();
            if (!gameState) return;

            const selectedPlayer = this._getSelectedPlayer();
            const baseZone = typeof zoneName === 'string' ? zoneName.replace('opponent_', '') : '';
            if (selectedPlayer === 'spectator' && baseZone === 'deck') {
                console.warn('[UIZonesManager] Spectators cannot search the library');
                return;
            }

            const { playerData, zone } = this._getPlayerZoneData(gameState, zoneName, false);
            if (!playerData) return;
            const zoneInfo = this.getZoneInfo(zoneName);
            const ownerId = playerData.id || 'player1';

            this._openZonePopup(zoneName, zone, zoneInfo, false, ownerId);
        }

        /**
         * Show opponent zone modal
         */
        static showOpponentZoneModal(zoneName) {
            const gameState = GameCore.getGameState();
            if (!gameState) return;

            const selectedPlayer = this._getSelectedPlayer();
            const baseZone = typeof zoneName === 'string' ? zoneName.replace('opponent_', '') : '';
            if (selectedPlayer === 'spectator' && baseZone === 'deck') {
                console.warn('[UIZonesManager] Spectators cannot search the library');
                return;
            }

            const { playerData, zone } = this._getPlayerZoneData(gameState, zoneName, true);
            if (!playerData) return;
        
            const pureZoneName = zoneName.replace('opponent_', '');
            const zoneInfo = this.getZoneInfo(pureZoneName);
            const ownerId = playerData.id || 'player2';

            this._openZonePopup(`opponent_${pureZoneName}`, zone, zoneInfo, true, ownerId);
        }

        /**
         * Close zone modal
         */
        static closeZoneModal(zoneName) {
            const normalizedZone = typeof zoneName === 'string' ? zoneName : '';
            const isOpponentZone = normalizedZone.startsWith('opponent_');
            const baseZone = normalizedZone.replace('opponent_', '');
            const shouldShuffleLibrary = this._pendingLibraryShuffle && baseZone === 'deck' && !isOpponentZone;

            const triggerLibraryShuffle = () => {
                if (!shouldShuffleLibrary) {
                    return;
                }
                this._pendingLibraryShuffle = false;
                if (typeof GameActions?.performGameAction === 'function') {
                    GameActions.performGameAction('shuffle_library');
                } else {
                    console.warn('[UIZonesManager] GameActions.performGameAction not available for shuffle');
                }
            };

            if (this._zonePopupElements && this._zonePopupElements.has(normalizedZone)) {
                const elements = this._zonePopupElements.get(normalizedZone);
                if (elements?.panel) {
                    if (elements.panel.dataset.persistent === 'true') {
                        return;
                    }
                    elements.panel.classList.add('hidden');
                    elements.panel.setAttribute('aria-hidden', 'true');
                    elements.panel.dataset.appear = 'hidden';
                    delete elements.panel.dataset.userMoved;
                }
                triggerLibraryShuffle();
                return;
            }

            const modal = document.getElementById(`zone-modal-${normalizedZone}`);
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
            }
            triggerLibraryShuffle();
        }

        /**
         * Refresh zone modal content by closing and reopening it
         */
        static refreshZoneModal(zoneName) {
            const gameState = GameCore.getGameState();
            if (!gameState) return;

            const isOpponent = zoneName.startsWith('opponent_');
            const baseZoneName = zoneName.replace('opponent_', '');
            const { playerData, zone } = this._getPlayerZoneData(gameState, baseZoneName, isOpponent);
            if (!playerData) return;

            const zoneInfo = this.getZoneInfo(baseZoneName);
            const ownerId = playerData.id || (isOpponent ? 'player2' : 'player1');

            this._openZonePopup(isOpponent ? `opponent_${baseZoneName}` : baseZoneName, zone, zoneInfo, isOpponent, ownerId);
        }

        /**
         * Update zone counts in UI
         */
        static updateZoneCounts() {
            const gameState = GameCore.getGameState();
            if (!gameState) return;

            const { playerData } = this._getPlayerZoneData(gameState, 'deck', false);
            if (!playerData) return;

            const deckData = playerData.library || playerData.deck || [];
            const zoneCounts = {
                'deck': deckData.length || 0,
                'exile': playerData.exile?.length || 0,
                'graveyard': playerData.graveyard?.length || 0
            };

            Object.entries(zoneCounts).forEach(([zoneName, count]) => {
                const countElement = document.getElementById(`${zoneName}-count`);
                if (countElement) countElement.textContent = count;
            });
        }

        /**
         * Show card details
         */
        static showCardDetails(cardId, zoneName) {
            console.info(`Card details requested for ${cardId} in ${zoneName}`);
        }

        /**
         * Get zone information
         */
        static getZoneInfo(zoneName) {
            return this.ZONE_INFO[zoneName] || {
                title: 'Unknown Zone', icon: '❓', description: 'Unknown card zone'
            };
        }

        /**
         * Get card type icon
         */
        static getCardTypeIcon(cardType) {
            const type = cardType.toLowerCase();
            for (const [typeKey, icon] of Object.entries(this.CARD_TYPE_ICONS)) {
                if (typeKey !== 'default' && type.includes(typeKey)) return icon;
            }
            return this.CARD_TYPE_ICONS.default;
        }

        // ===== DRAG AND DROP HANDLERS =====

        static handleZoneDragOver(event) {
            event.preventDefault();
            // Optionally: add visual feedback
            const current = event.currentTarget;
            if (current && current.classList) {
                current.classList.add('zone-drag-over');
                const parentZone =
                    current.classList.contains('battlefield-zone')
                        ? current
                        : current.closest && current.closest('.battlefield-zone');
                if (parentZone && parentZone !== current) {
                    parentZone.classList.add('zone-drag-over');
                }
            }
        }

        static handleZoneDragLeave(event) {
            const current = event.currentTarget;
            if (current && current.classList) {
                current.classList.remove('zone-drag-over');
                const parentZone =
                    current.classList.contains('battlefield-zone')
                        ? current
                        : current.closest && current.closest('.battlefield-zone');
                if (parentZone && parentZone !== current) {
                    parentZone.classList.remove('zone-drag-over');
                }
            }
        }

        static handleZoneDrop(event, targetZone) {
            event.preventDefault();
            const current = event.currentTarget;
            if (current && current.classList) {
                current.classList.remove('zone-drag-over');
                const parentZone =
                    current.classList.contains('battlefield-zone')
                        ? current
                        : current.closest && current.closest('.battlefield-zone');
                if (parentZone && parentZone !== current) {
                    parentZone.classList.remove('zone-drag-over');
                }
            }
            try {
                const rawPayload =
                    (event.dataTransfer && event.dataTransfer.getData && event.dataTransfer.getData('text/plain')) || '';

                if (!rawPayload) {
                    return;
                }

                let data = null;
                try {
                    data = JSON.parse(rawPayload);
                } catch {
                    // Ignore drops that don't come from our drag source (e.g., external URLs)
                    console.warn('[UIZonesManager] ignoring non-JSON drop payload', rawPayload);
                    return;
                }

                const { cardId, cardZone, uniqueCardId, cardOwnerId } = data;

                const battlefieldTargets = ['battlefield', 'lands', 'creatures', 'support', 'permanents', 'stack'];
                const battlefieldZones = ['battlefield', 'lands', 'creatures', 'support', 'permanents'];
                if (
                    cardZone === 'hand' &&
                    battlefieldTargets.includes(targetZone) &&
                    window.GameActions &&
                    typeof window.GameActions.playCardFromHand === 'function'
                ) {
                    const isStrictMode = (() => {
                        if (typeof GameCore === 'undefined' || typeof GameCore.getGameState !== 'function') {
                            return false;
                        }
                        const state = GameCore.getGameState();
                        return String(state?.phase_mode || '').toLowerCase() === 'strict';
                    })();

                    let cardData = null;
                    if (uniqueCardId) {
                        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
                        if (cardElement) {
                            try {
                                cardData = JSON.parse(cardElement.getAttribute('data-card-data') || '{}');
                            } catch (parseError) {
                                console.warn('Unable to parse card data for drag-drop play', parseError);
                            }
                        }
                    }

                    const typeLine = String(cardData?.type_line || cardData?.typeLine || '').toLowerCase();
                    const cardTypeField = String(cardData?.card_type || cardData?.cardType || '').toLowerCase();
                    const normalizedTypes = Array.isArray(cardData?.types)
                        ? cardData.types.map(type => String(type).toLowerCase())
                        : [];
                    const isInstantOrSorcery =
                        typeLine.includes('instant') ||
                        typeLine.includes('sorcery') ||
                        cardTypeField.includes('instant') ||
                        cardTypeField.includes('sorcery') ||
                        normalizedTypes.includes('instant') ||
                        normalizedTypes.includes('sorcery');
                    const shouldRouteThroughStack =
                        isStrictMode && battlefieldZones.includes(targetZone) ? true : isInstantOrSorcery;

                    if (shouldRouteThroughStack) {
                        window.GameActions.playCardFromHand(cardId, uniqueCardId);
                        return;
                    }
                }

                let container = null;
                if (event.currentTarget && event.currentTarget.classList.contains('zone-content')) {
                    container = event.currentTarget;
                } else if (event.target && typeof event.target.closest === 'function') {
                    container = event.target.closest('.zone-content');
                }
                if (!container && event.currentTarget && event.currentTarget.classList.contains('battlefield-zone')) {
                    container = event.currentTarget.querySelector('.zone-content');
                }
                if (container && container.classList) {
                    container.classList.remove('zone-drag-over');
                }

                let positionIndex = null;
                if (container) {
                    const draggedElement = window.GameCards ? GameCards.draggedCardElement : null;
                    const groupHandle = draggedElement && typeof draggedElement.closest === 'function'
                        ? draggedElement.closest('.card-attachment-group')
                        : null;
                    const activeDragged = groupHandle || draggedElement;

                    let renderedCards = Array.from(container.querySelectorAll('.card-attachment-group'));
                    if (!renderedCards.length) {
                        renderedCards = Array.from(container.querySelectorAll('[data-card-unique-id]'))
                            .filter((el) => !el.closest('.card-attachment-pile'));
                    }

                    const filteredCards = activeDragged ? renderedCards.filter(card => card !== activeDragged) : renderedCards;
                    const pointerAxis = event.clientX;
                    const pointerAxisY = event.clientY;
                    const isHorizontal = container.scrollWidth >= container.scrollHeight;

                    if (filteredCards.length === 0) {
                        positionIndex = 0;
                    } else {
                        let insertIndex = filteredCards.length;
                        filteredCards.some((cardEl, index) => {
                            const rect = cardEl.getBoundingClientRect();
                            const cardCenter = isHorizontal
                                ? rect.left + rect.width / 2
                                : rect.top + rect.height / 2;
                            const pointerValue = isHorizontal ? pointerAxis : pointerAxisY;
                            if (pointerValue < cardCenter) {
                                insertIndex = index;
                                return true;
                            }
                            return false;
                        });
                        insertIndex = Math.max(0, Math.min(insertIndex, filteredCards.length));
                        positionIndex = insertIndex;
                    }
                }

                // Trigger an action to move the card (adjust to the backend logic)
                if (window.GameActions && typeof window.GameActions.moveCard === 'function') {
                    const options = {};
                    if (cardOwnerId) {
                        options.sourcePlayerId = cardOwnerId;
                    }
                    const targetOwnerId = current?.dataset?.zoneOwner;
                    if (targetOwnerId) {
                        options.destinationPlayerId = targetOwnerId;
                    }
                    window.GameActions.moveCard(
                        cardId,
                        cardZone,
                        targetZone,
                        uniqueCardId,
                        null,
                        null,
                        positionIndex,
                        options
                    );
                } else {
                    console.warn('Card movement not implemented on the backend.');
                }
            } catch (e) {
                console.error('Error during card drop.', e);
            }
        }

        static handlePopupDragOver(event) {
            event.preventDefault();
            const current = event.currentTarget;
            if (current && current.classList) {
                current.classList.add('zone-drag-over');
            }
        }

        static handlePopupDragLeave(event) {
            const current = event.currentTarget;
            if (current && current.classList) {
                current.classList.remove('zone-drag-over');
            }
        }

        static handlePopupDrop(event, targetZone) {
            event.preventDefault();
            event.stopPropagation();
            const container = event.currentTarget;
            if (container && container.classList) {
                container.classList.remove('zone-drag-over');
            }

            let dragData = null;
            try {
                const rawData = event.dataTransfer ? event.dataTransfer.getData('text/plain') : '';
                dragData = rawData ? JSON.parse(rawData) : null;
            } catch (error) {
                console.warn('Failed to parse drag data for popup drop:', error);
            }

            if (!dragData || !dragData.uniqueCardId) {
                return;
            }

            const { cardId, cardZone, uniqueCardId, cardOwnerId } = dragData;
            const draggedElement = (typeof GameCards !== 'undefined' ? GameCards.draggedCardElement : null) || document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
            const groupHandle = draggedElement && typeof draggedElement.closest === 'function'
                ? draggedElement.closest('.card-attachment-group')
                : null;
            const activeDragged = groupHandle || draggedElement;

            let positionIndex = null;
            if (container) {
                let renderedCards = Array.from(container.querySelectorAll('.card-attachment-group'));
                if (!renderedCards.length) {
                    renderedCards = Array.from(container.querySelectorAll('[data-card-unique-id]'))
                        .filter((el) => !el.closest('.card-attachment-pile'));
                }

                const filteredCards = activeDragged ? renderedCards.filter(card => card !== activeDragged) : renderedCards;
                const pointerAxisX = event.clientX;
                const pointerAxisY = event.clientY;
                const isHorizontal = container.scrollWidth >= container.scrollHeight;

                const removePlaceholders = () => {
                    const placeholders = container.querySelectorAll('.reveal-empty, .commander-popup-empty');
                    placeholders.forEach(placeholder => {
                        if (placeholder && placeholder.parentElement === container) {
                            placeholder.remove();
                        }
                    });
                    container.classList.remove('zone-card-list-empty', 'commander-popup-card-list-empty');
                };

                if (filteredCards.length === 0) {
                    positionIndex = 0;
                    if (activeDragged) {
                        removePlaceholders();
                        container.appendChild(activeDragged);
                        activeDragged.setAttribute('data-card-zone', targetZone);
                    }
                } else {
                    let insertIndex = filteredCards.length;
                    filteredCards.some((cardEl, index) => {
                        const rect = cardEl.getBoundingClientRect();
                        const cardCenter = isHorizontal
                            ? rect.left + rect.width / 2
                            : rect.top + rect.height / 2;
                        const pointerValue = isHorizontal ? pointerAxisX : pointerAxisY;
                        if (pointerValue < cardCenter) {
                            insertIndex = index;
                            return true;
                        }
                        return false;
                    });
                    insertIndex = Math.max(0, Math.min(insertIndex, filteredCards.length));
                    positionIndex = insertIndex;

                    if (activeDragged) {
                        removePlaceholders();
                        const referenceCard = filteredCards[insertIndex] || null;
                        container.insertBefore(activeDragged, referenceCard);
                        activeDragged.setAttribute('data-card-zone', targetZone);
                    }
                }

                if (container.dataset) {
                    const cardCount = renderedCards.length || container.querySelectorAll('[data-card-unique-id]').length;
                    container.dataset.cardCount = String(cardCount);
                }
            }

            if (window.GameActions && typeof window.GameActions.moveCard === 'function') {
                const options = {};
                if (cardOwnerId) {
                    options.sourcePlayerId = cardOwnerId;
                }
                const targetOwnerId = container?.dataset?.zoneOwner || container?.getAttribute('data-zone-owner');
                if (targetOwnerId) {
                    options.destinationPlayerId = targetOwnerId;
                }
                window.GameActions.moveCard(
                    cardId,
                    cardZone,
                    targetZone,
                    uniqueCardId,
                    null,
                    null,
                    positionIndex,
                    options
                );
            }
        }

        // ===== PRIVATE HELPER METHODS =====
    
        /**
         * Get player zone data (unified for both player and opponent)
         */
        static _getPlayerZoneData(gameState, zoneName, isOpponent) {
            const currentPlayer = this._getSelectedPlayer();
            let playerIndex = currentPlayer === 'player2' ? 1 : 0;
            if (isOpponent) playerIndex = playerIndex === 0 ? 1 : 0;
        
            const playerData = gameState.players?.[playerIndex];
            if (!playerData) return { playerData: null, zone: [], playerIndex: null };

            const pureZoneName = zoneName.replace('opponent_', '');
            const normalizedZoneName = (() => {
                if (pureZoneName === 'commander') return 'commander_zone';
                if (pureZoneName === 'reveal') return 'reveal_zone';
                if (pureZoneName === 'look') return 'look_zone';
                return pureZoneName;
            })();

            let zone = [];
            if (normalizedZoneName === 'deck') {
                zone = playerData.library || playerData.deck || [];
            } else if (normalizedZoneName === 'reveal_zone') {
                zone = playerData.reveal_zone || playerData.reveal || [];
            } else if (normalizedZoneName === 'look_zone') {
                zone = playerData.look_zone || playerData.look || [];
            } else {
                zone = playerData[normalizedZoneName] || [];
            }
        
            return { playerData, zone, playerIndex };
        }

        static _registerZoneConfig(type, config) {
            const key = `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            if (type === 'deck') {
                this._deckZoneConfigs.set(key, config);
            } else if (type === 'graveyard') {
                this._graveyardZoneConfigs.set(key, config);
            } else if (type === 'exile') {
                this._exileZoneConfigs.set(key, config);
            } else if (type === 'life') {
                this._lifeZoneConfigs.set(key, config);
            }
            return key;
        }

        static hydrateSvelteZones() {
            this._hydrateDeckZones();
            this._hydrateGraveyardZones();
            this._hydrateExileZones();
            this._hydrateLifeZones();
        }

        static _hydrateDeckZones() {
            document.querySelectorAll('[data-zone-type="deck"]').forEach((element) => {
                if (element.dataset.zoneHydrated === 'true') {
                    return;
                }
                const key = element.dataset.zoneKey;
                const config = this._deckZoneConfigs.get(key);
                if (!config) {
                    return;
                }
                try {
                    element.innerHTML = '';
                    mountComponent(DeckZone, {
                        target: element,
                        props: {
                            cardsRemaining: config.cardsRemaining,
                            deckClass: config.deckClass,
                            zoneIdentifier: config.zoneIdentifier,
                            overlayText: config.overlayText,
                            onClick: config.onClick
                        }
                    });
                    element.dataset.zoneHydrated = 'true';
                    this._deckZoneConfigs.delete(key);
                } catch (error) {
                    console.error('[UIZonesManager] Failed to hydrate deck zone', error);
                }
            });
        }

        static _hydrateGraveyardZones() {
            document.querySelectorAll('[data-zone-type="graveyard"]').forEach((element) => {
                if (element.dataset.zoneHydrated === 'true') {
                    return;
                }
                const key = element.dataset.zoneKey;
                const config = this._graveyardZoneConfigs.get(key);
                if (!config) {
                    return;
                }
                try {
                    element.innerHTML = '';
                    mountComponent(GraveyardZone, {
                        target: element,
                        props: {
                            cards: config.graveyardArray,
                            cardsRemaining: config.cardsRemaining,
                            zoneIdentifier: config.zoneIdentifier,
                            overlayHtml: config.overlayHtml,
                            onClick: config.clickHandler
                        }
                    });
                    element.dataset.zoneHydrated = 'true';
                    this._graveyardZoneConfigs.delete(key);
                } catch (error) {
                    console.error('[UIZonesManager] Failed to hydrate graveyard zone', error);
                }
            });
        }

        static _hydrateExileZones() {
            document.querySelectorAll('[data-zone-type="exile"]').forEach((element) => {
                if (element.dataset.zoneHydrated === 'true') {
                    return;
                }
                const key = element.dataset.zoneKey;
                const config = this._exileZoneConfigs.get(key);
                if (!config) {
                    return;
                }
                try {
                    element.innerHTML = '';
                    mountComponent(ExileZone, {
                        target: element,
                        props: {
                            cards: config.exileArray,
                            zoneIdentifier: config.zoneIdentifier,
                            cardsRemaining: config.cardsRemaining,
                            overlayHtml: config.overlayHtml,
                            topCard: config.topCard,
                            onClick: config.clickHandler
                        }
                    });
                    element.dataset.zoneHydrated = 'true';
                    this._exileZoneConfigs.delete(key);
                } catch (error) {
                    console.error('[UIZonesManager] Failed to hydrate exile zone', error);
                }
            });
        }

        static _hydrateLifeZones() {
            document.querySelectorAll('[data-zone-type="life"]').forEach((element) => {
                if (element.dataset.zoneHydrated === 'true') {
                    return;
                }
                const key = element.dataset.zoneKey;
                const config = this._lifeZoneConfigs.get(key);
                if (!config) {
                    return;
                }
                try {
                    element.innerHTML = '';
                    mountComponent(LifeZone, {
                        target: element,
                        props: {
                            life: config.life,
                            playerId: config.playerId,
                            negativeControls: config.negativeControls,
                            positiveControls: config.positiveControls,
                            hasCustomLifeControls: config.hasCustomLifeControls,
                            counters: config.counters,
                            manageButton: config.manageButton || null
                        }
                    });
                    element.dataset.zoneHydrated = 'true';
                    this._lifeZoneConfigs.delete(key);
                } catch (error) {
                    console.error('[UIZonesManager] Failed to hydrate life zone', error);
                }
            });
        }

        /**
         * Generate zone modal HTML
         */
        static _openZonePopup(popupKey, cards, zoneInfo, isOpponent, ownerId) {
            return this._openZonePopupSvelte(popupKey, cards, zoneInfo, isOpponent, ownerId);
        }

        static _openZonePopupSvelte(popupKey, cards, zoneInfo, isOpponent, ownerId) {
            const cardsArray = Array.isArray(cards) ? cards : [];
            const baseZone = popupKey.replace('opponent_', '');
            const isCommanderPopup = baseZone === 'commander';
            const allowEmptyDisplay = ['reveal', 'graveyard', 'exile', 'deck'].includes(baseZone);

            if (!cardsArray.length && !isCommanderPopup && !allowEmptyDisplay) {
                this._hideZonePopup(popupKey);
                return;
            }

            const popupTitle = `${isOpponent ? 'Opponent ' : ''}${zoneInfo.title}`;
            const allowCommanderControls = zoneInfo?.allowTaxControls === true;
            const allowDrop = isCommanderPopup ? allowCommanderControls : !isOpponent;
            const cardsHtml = this._buildZonePopupCardsHtml(cardsArray, baseZone, isOpponent, ownerId);

            const componentEntry = this._ensureZonePopupComponent(popupKey, zoneInfo, isOpponent);
            const instance = componentEntry?.instance;
            if (!instance) {
                console.error('[UIZonesManager] ZonePopupComponent instance missing');
                return;
            }

            try {
                instance.$set({
                    popupKey,
                    title: popupTitle,
                    icon: zoneInfo?.icon || '🗂️',
                    cardsHtml,
                    cardCount: cardsArray.length,
                    baseZone,
                    isOpponent,
                    ownerId,
                    persistent: zoneInfo?.persistent === true,
                    allowDrop,
                    allowCommanderControls,
                    commanderTax: zoneInfo?.commanderTax || 0
                });
            } catch (error) {
                console.error('[UIZonesManager] Failed to update ZonePopup component', error);
                return;
            }

            const elements = this._getZonePopupElements(popupKey);
            if (!elements?.panel) {
                return;
            }

            elements.panel.dataset.persistent = zoneInfo && zoneInfo.persistent ? 'true' : 'false';
            elements.panel.dataset.zoneOwner = isOpponent ? 'opponent' : 'player';
            elements.panel.classList.remove('hidden');
            elements.panel.setAttribute('aria-hidden', 'false');
            elements.panel.dataset.appear = 'visible';

            if (typeof UIRenderersTemplates !== 'undefined' &&
                typeof UIRenderersTemplates._calculateRevealPopupWidth === 'function') {
                let computedWidth = UIRenderersTemplates._calculateRevealPopupWidth(cardsArray.length);
                if ((!computedWidth || Number.isNaN(computedWidth)) && isCommanderPopup) {
                    computedWidth = 340;
                }
                if (computedWidth) {
                    elements.panel.style.width = `${computedWidth}px`;
                }
            }

            if (typeof UIRenderersTemplates !== 'undefined') {
                UIRenderersTemplates._applyPopupSearch(elements.panel);
            }

            const positionIndex = this._getZonePopupIndex(popupKey, isOpponent);
            if (elements.panel.dataset.userMoved !== 'true') {
                if (isCommanderPopup) {
                    this._positionCommanderPopup(elements.panel, isOpponent);
                } else if (typeof UIRenderersTemplates !== 'undefined') {
                    UIRenderersTemplates._positionRevealPopup(elements.panel, positionIndex, !isOpponent);
                    if (['graveyard', 'exile', 'deck'].includes(baseZone)) {
                        requestAnimationFrame(() => this._positionZonePopupLeft(elements.panel, isOpponent));
                    }
                }
            }
        }

        static _hideZonePopup(popupKey) {
            const elements = this._getZonePopupElements(popupKey);
            if (!elements?.panel) {
                return;
            }
            elements.panel.classList.add('hidden');
            elements.panel.setAttribute('aria-hidden', 'true');
            elements.panel.dataset.appear = 'hidden';
            delete elements.panel.dataset.userMoved;
        }

        static _buildZonePopupCardsHtml(cardsArray, baseZone, isOpponent, ownerId) {
            return cardsArray.map((card, index) =>
                GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, baseZone, isOpponent, index, ownerId)
            ).join('');
        }

        static _ensureZonePopupComponent(popupKey, zoneInfo, isOpponent) {
            if (!this._zonePopupComponents) {
                this._zonePopupComponents = new Map();
            }

            if (this._zonePopupComponents.has(popupKey)) {
                return this._zonePopupComponents.get(popupKey);
            }

            const container = document.createElement('div');
            document.body.appendChild(container);

            try {
                const instance = mountComponent(ZonePopup, {
                    target: container,
                    props: {
                        popupKey,
                        title: zoneInfo?.title || 'Zone',
                        icon: zoneInfo?.icon || '🗂️',
                        cardCount: 0,
                        cardsHtml: '',
                        baseZone: popupKey.replace('opponent_', ''),
                        isOpponent,
                        ownerId: isOpponent ? 'player2' : 'player1',
                        persistent: zoneInfo?.persistent === true
                    }
                });

                this._getZonePopupElements(popupKey);
                this._zonePopupComponents.set(popupKey, { instance, container });
                return this._zonePopupComponents.get(popupKey);
            } catch (error) {
                console.error('[UIZonesManager] Failed to mount ZonePopup', error);
                container.remove();
                return null;
            }
        }

        static _getZonePopupElements(popupKey) {
            if (!this._zonePopupElements) {
                this._zonePopupElements = new Map();
            }

            const existing = this._zonePopupElements.get(popupKey);
            if (existing?.panel && document.body.contains(existing.panel)) {
                return existing;
            }

            const panel = document.getElementById(`zone-popup-${popupKey}`);
            if (!panel) {
                return null;
            }
            const body = document.getElementById(`zone-popup-body-${popupKey}`) || panel.querySelector('.zone-popup-body');
            const countLabel = document.getElementById(`zone-popup-count-${popupKey}`) || panel.querySelector('.zone-popup-count');
            const titleLabel = panel.querySelector('.zone-popup-label');

            const snapshot = { panel, body, countLabel, titleLabel };
            this._zonePopupElements.set(popupKey, snapshot);
            return snapshot;
        }

        static _getZonePopupIndex(popupKey, isOpponent) {
            const baseName = popupKey.replace('opponent_', '');
            const order = ['commander', 'graveyard', 'exile', 'library', 'hand'];
            const baseIndex = order.includes(baseName) ? order.indexOf(baseName) : order.length;
            return isOpponent ? baseIndex + 2 : baseIndex;
        }

        static _positionZonePopupLeft(panel, isOpponent) {
            if (!panel) {
                return;
            }

            const board = document.getElementById('game-board');
            if (!board) {
                return;
            }

            const padding = 16;
            const boardRect = board.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const panelWidth = panelRect.width || panel.offsetWidth || 0;
            const panelHeight = panelRect.height || panel.offsetHeight || 0;

            let left = boardRect.left - panelWidth - padding;
            let top = isOpponent
                ? boardRect.top + padding
                : boardRect.bottom - panelHeight - padding;

            top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));
            left = Math.max(padding, Math.min(left, window.innerWidth - panelWidth - padding));

            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.transform = 'none';
        }

        static _positionCommanderPopup(panel, isOpponent) {
            if (!panel) {
                return;
            }

            if (typeof UIRenderersTemplates !== 'undefined' &&
                typeof UIRenderersTemplates._positionRevealPopup === 'function') {
                const index = 0;
                const isControlled = !isOpponent;
                UIRenderersTemplates._positionRevealPopup(panel, index, isControlled);
                return;
            }

            const board = document.getElementById('game-board');
            if (!board) {
                return;
            }

            const padding = 16;
            const boardRect = board.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const panelHeight = panelRect.height || panel.offsetHeight || 0;
            const panelWidth = panelRect.width || panel.offsetWidth || 0;

            let top;
            const left = boardRect.right + padding;

            if (!isOpponent) {
                top = boardRect.bottom - panelHeight - padding;
            } else {
                top = boardRect.top + padding;
            }

            top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));
            const clampedLeft = Math.max(padding, Math.min(left, window.innerWidth - panelWidth - padding));

            panel.style.left = `${clampedLeft}px`;
            panel.style.top = `${top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.transform = 'none';
        }

        static refreshOpenZonePopups(gameState = null) {
            if (!this._zonePopupElements || this._zonePopupElements.size === 0) {
                return;
            }

            const state = gameState || GameCore.getGameState();
            if (!state) {
                return;
            }

            this._zonePopupElements.forEach((elements, popupKey) => {
                const panel = elements?.panel;
                if (!panel || panel.classList.contains('hidden')) {
                    return;
                }

                const isOpponent = popupKey.startsWith('opponent_');
                const baseZone = popupKey.replace('opponent_', '');
                const { playerData, zone, playerIndex } = this._getPlayerZoneData(state, baseZone, isOpponent);
                if (!playerData) {
                    return;
                }

                if (baseZone === 'commander') {
                    const selectedPlayer = this._getSelectedPlayer();
                    const commanderConfig = this._createCommanderPopupConfig(playerData, playerIndex, isOpponent);
                    if (commanderConfig) {
                        this._openCommanderPopup(commanderConfig, selectedPlayer);
                    }
                    return;
                }

                const zoneInfo = this.getZoneInfo(baseZone);
                const ownerId = this._determinePlayerOwnerId(playerData, playerIndex, isOpponent);
                this._openZonePopup(
                    isOpponent ? `opponent_${baseZone}` : baseZone,
                    zone,
                    zoneInfo,
                    isOpponent,
                    ownerId
                );
            });
        }
    }

    // Backward compatibility exports
    window.UIZones = UIZonesManager;
    window.ZoneManager = UIZonesManager;
    window.UIZonesManager = UIZonesManager;

    function installGlobals() {
        if (typeof window === 'undefined') {
            return;
        }
        window.ZoneManager = UIZonesManager;
    }

    onMount(() => {
        installGlobals();
    });
</script>
