/**
 * ManaForge Unified Zones Manager Module
 * Combines zone generation and zone modal management
 * Replaces ui-zones.js + zone-manager.js (691 lines → ~400 lines)
 */

class UIZonesManager {
    static _zonePopupElements = new Map();
    static _deckZoneConfigs = new Map();
    static _graveyardZoneConfigs = new Map();
    static _exileZoneConfigs = new Map();
    static _lifeZoneConfigs = new Map();
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
        'reveal': { title: 'Reveal Zone', icon: '👁️', description: 'Cards currently revealed to all players' }
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

    static _buildCommanderPopupTitle(playerData, isOpponent) {
        const defaultTitle = isOpponent ? 'Opponent Commander' : 'Commander';
        const playerName = typeof playerData?.name === 'string' ? playerData.name.trim() : '';
        return playerName ? `Commander — ${playerName}` : defaultTitle;
    }

    static _createCommanderPopupConfig(playerData, playerIndex, isOpponent) {
        if (!playerData) {
            return null;
        }

        return {
            popupKey: isOpponent ? 'opponent_commander' : 'commander',
            playerData,
            isOpponent,
            ownerId: this._determinePlayerOwnerId(playerData, playerIndex, isOpponent),
            title: this._buildCommanderPopupTitle(playerData, isOpponent)
        };
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
    static generateLifeZone(playerData, playerId, titlePrefix) {
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
    static openCustomLifeInput(playerId, direction = 1) {
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
            if (window.GameUI && typeof GameUI.showNotification === 'function') {
                GameUI.showNotification('Enter a valid amount', 'warning');
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
        if (input) {
            input.value = '';
        }
    }

    /**
     * Display commander popups for applicable formats (Commander/Duel Commander).
     */
    static showCommanderPopups(gameState) {
        if (!gameState) {
            this.hideCommanderPopups();
            return;
        }

        const format = String(gameState.game_format || '').toLowerCase();
        const commanderFormats = ['duel_commander', 'commander_multi'];
        if (!commanderFormats.includes(format)) {
            this.hideCommanderPopups();
            return;
        }

        const players = Array.isArray(gameState.players) ? gameState.players : [];
        if (!players.length) {
            this.hideCommanderPopups();
            return;
        }

        const selectedPlayer = this._getSelectedPlayer();

        let controlledIndex = 0;
        if (selectedPlayer === 'player2') {
            controlledIndex = 1;
        }

        const opponentIndex = controlledIndex === 0 ? 1 : 0;

        this.hideCommanderPopups();

        const controlledPlayer = players[controlledIndex];
        const controlledConfig = this._createCommanderPopupConfig(controlledPlayer, controlledIndex, false);
        if (controlledConfig) {
            this._openCommanderPopup(controlledConfig, selectedPlayer);
        }

        const opponentPlayer = players[opponentIndex];
        const opponentConfig = players.length > 1
            ? this._createCommanderPopupConfig(opponentPlayer, opponentIndex, true)
            : null;
        if (opponentConfig) {
            this._openCommanderPopup(opponentConfig, selectedPlayer);
        }
    }

    /**
     * Hide commander popups if they are currently rendered.
     */
    static hideCommanderPopups() {
        if (!this._zonePopupElements) {
            return;
        }

        ['commander', 'opponent_commander'].forEach((key) => {
            const elements = this._zonePopupElements.get(key);
            if (elements?.panel) {
                elements.panel.classList.add('hidden');
                elements.panel.setAttribute('aria-hidden', 'true');
            }
        });
    }

    /**
     * Internal helper to open or refresh the commander popup.
     */
    static _openCommanderPopup(config, selectedPlayer) {
        const { popupKey, playerData, isOpponent, ownerId, title } = config;
        if (!playerData) {
            return;
        }

        const commanderCards = Array.isArray(playerData.commander_zone)
            ? playerData.commander_zone
            : [];
        const commanderTax = Number.isFinite(Number(playerData.commander_tax))
            ? Number(playerData.commander_tax)
            : 0;

        const zoneInfo = {
            title: title || (isOpponent ? 'Opponent Commander' : 'Commander'),
            icon: '👑',
            description: 'Commander zone',
            persistent: true,
            commanderTax,
            allowTaxControls: this._shouldAllowCommanderControls(selectedPlayer, ownerId, isOpponent)
        };

        this._openZonePopup(popupKey, commanderCards, zoneInfo, isOpponent, ownerId);
    }

    static _shouldAllowCommanderControls(selectedPlayer, ownerId, isOpponent) {
        if (isOpponent) {
            return false;
        }
        if (!selectedPlayer || selectedPlayer === 'spectator') {
            return false;
        }
        return selectedPlayer === ownerId;
    }

    // ===== ZONE MODAL MANAGEMENT =====
    
    /**
     * Show zone modal for current player
     */
    static showZoneModal(zoneName) {
        if (zoneName === 'commander') {
            this.showCommanderPopups(GameCore.getGameState());
            return;
        }
        const gameState = GameCore.getGameState();
        if (!gameState) return;

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
        if (zoneName === 'opponent_commander') {
            this.showCommanderPopups(GameCore.getGameState());
            return;
        }
        const gameState = GameCore.getGameState();
        if (!gameState) return;

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
        if (this._zonePopupElements && this._zonePopupElements.has(zoneName)) {
            const elements = this._zonePopupElements.get(zoneName);
            if (elements?.panel) {
                if (elements.panel.dataset.persistent === 'true') {
                    return;
                }
                elements.panel.classList.add('hidden');
                elements.panel.setAttribute('aria-hidden', 'true');
                delete elements.panel.dataset.userMoved;
            }
            return;
        }

        const modal = document.getElementById(`zone-modal-${zoneName}`);
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
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
        UINotifications.showNotification(`Card details: ${cardId}`, 'info');
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
            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            const { cardId, cardZone, uniqueCardId } = data;

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
                const allCards = Array.from(container.querySelectorAll('[data-card-unique-id]'));
                const filteredCards = draggedElement ? allCards.filter(card => card !== draggedElement) : allCards;
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

                if (
                    draggedElement &&
                    data.cardZone === targetZone &&
                    container.contains(draggedElement) &&
                    positionIndex !== null
                ) {
                    const referenceCard = filteredCards[positionIndex] || null;
                    container.insertBefore(draggedElement, referenceCard);
                }
            }

            // Trigger an action to move the card (adjust to the backend logic)
            if (window.GameActions && typeof window.GameActions.moveCard === 'function') {
                window.GameActions.moveCard(
                    cardId,
                    cardZone,
                    targetZone,
                    uniqueCardId,
                    null,
                    null,
                    positionIndex
                );
            } else {
                UINotifications.showNotification('Card movement not implemented on the backend.', 'warning');
            }
        } catch (e) {
            UINotifications.showNotification('Error during card drop.', 'error');
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

        const { cardId, cardZone, uniqueCardId } = dragData;
        const draggedElement = (typeof GameCards !== 'undefined' ? GameCards.draggedCardElement : null) || document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);

        let positionIndex = null;
        if (container) {
            const allCards = Array.from(container.querySelectorAll('[data-card-unique-id]'));
            const filteredCards = draggedElement ? allCards.filter(card => card !== draggedElement) : allCards;
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
                if (draggedElement) {
                    removePlaceholders();
                    container.appendChild(draggedElement);
                    draggedElement.setAttribute('data-card-zone', targetZone);
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

                if (draggedElement) {
                    removePlaceholders();
                    const referenceCard = filteredCards[insertIndex] || null;
                    container.insertBefore(draggedElement, referenceCard);
                    draggedElement.setAttribute('data-card-zone', targetZone);
                }
            }

            if (container.dataset) {
                const cardCount = container.querySelectorAll('[data-card-unique-id]').length;
                container.dataset.cardCount = String(cardCount);
            }
        }

        if (window.GameActions && typeof window.GameActions.moveCard === 'function') {
            window.GameActions.moveCard(
                cardId,
                cardZone,
                targetZone,
                uniqueCardId,
                null,
                null,
                positionIndex
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
        const normalizedZoneName = pureZoneName === 'commander' ? 'commander_zone' : pureZoneName;

        let zone = [];
        if (normalizedZoneName === 'deck') {
            zone = playerData.library || playerData.deck || [];
        } else {
            zone = playerData[normalizedZoneName] || [];
        }
        
        return { playerData, zone, playerIndex };
    }

    /**
     * Attach context menu to zone element
     */
    static _attachContextMenu(selector, zoneName) {
        setTimeout(() => {
            let element = document.querySelector(`${selector}[data-zone-context="${zoneName}"]`);
            if (!element) {
                const candidates = document.querySelectorAll(selector);
                element = Array.from(candidates).find(candidate => candidate.dataset?.zoneContext === zoneName);
            }
            if (element && window.ZoneContextMenu && element.dataset.zoneMenuAttached !== 'true') {
                window.ZoneContextMenu.attachToZone(element, zoneName);
                element.classList.add('zone-context-menu-enabled');
                element.dataset.zoneMenuAttached = 'true';
            }
        }, 100);
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
        if (typeof DeckZoneComponent === 'undefined') {
            return;
        }
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
                const mount = typeof DeckZoneComponent.mount === 'function'
                    ? DeckZoneComponent.mount
                    : null;
                if (!mount) {
                    throw new Error('DeckZoneComponent.mount is not available');
                }
                mount(DeckZoneComponent.default, {
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
                this._attachContextMenu('.deck-cards-stack', config.zoneIdentifier);
            } catch (error) {
                console.error('[UIZonesManager] Failed to hydrate deck zone', error);
            }
        });
    }

    static _hydrateGraveyardZones() {
        if (typeof GraveyardZoneComponent === 'undefined') {
            return;
        }
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
                const mount = typeof GraveyardZoneComponent.mount === 'function'
                    ? GraveyardZoneComponent.mount
                    : null;
                if (!mount) {
                    throw new Error('GraveyardZoneComponent.mount is not available');
                }
                mount(GraveyardZoneComponent.default, {
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
                this._attachContextMenu('.graveyard-cards-stack', config.zoneIdentifier);
            } catch (error) {
                console.error('[UIZonesManager] Failed to hydrate graveyard zone', error);
            }
        });
    }

    static _hydrateExileZones() {
        if (typeof ExileZoneComponent === 'undefined') {
            return;
        }
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
                const mount = typeof ExileZoneComponent.mount === 'function'
                    ? ExileZoneComponent.mount
                    : null;
                if (!mount) {
                    throw new Error('ExileZoneComponent.mount is not available');
                }
                mount(ExileZoneComponent.default, {
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
                this._attachContextMenu('.exile-stack', config.zoneIdentifier);
            } catch (error) {
                console.error('[UIZonesManager] Failed to hydrate exile zone', error);
            }
        });
    }

    static _hydrateLifeZones() {
        if (typeof LifeZoneComponent === 'undefined') {
            return;
        }
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
                const mount = typeof LifeZoneComponent.mount === 'function'
                    ? LifeZoneComponent.mount
                    : null;
                if (!mount) {
                    throw new Error('LifeZoneComponent.mount is not available');
                }
                mount(LifeZoneComponent.default, {
                    target: element,
                    props: {
                        life: config.life,
                        playerId: config.playerId,
                        negativeControls: config.negativeControls,
                        positiveControls: config.positiveControls,
                        hasCustomLifeControls: config.hasCustomLifeControls,
                        countersHtml: config.countersHtml,
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
        if (!this._zonePopupElements) {
            this._zonePopupElements = new Map();
        }

        const elements = this._ensureZonePopupElements(popupKey, zoneInfo, isOpponent);
        const cardsArray = Array.isArray(cards) ? cards : [];
        const baseZone = popupKey.replace('opponent_', '');
        const isCommanderPopup = baseZone === 'commander';
        const allowEmptyDisplay = ['reveal', 'graveyard', 'exile', 'deck'].includes(baseZone);

        if (!cardsArray.length && !isCommanderPopup && !allowEmptyDisplay) {
            elements.panel.classList.add('hidden');
            elements.panel.setAttribute('aria-hidden', 'true');
            delete elements.panel.dataset.userMoved;
            return;
        }

        const popupTitle = `${isOpponent ? 'Opponent ' : ''}${zoneInfo.title}`;
        elements.titleLabel.textContent = popupTitle;
        elements.countLabel.textContent = String(cardsArray.length);
        elements.body.innerHTML = this._generateZonePopupContent(cardsArray, popupKey, isOpponent, ownerId, zoneInfo);
        elements.panel.classList.remove('hidden');
        elements.panel.setAttribute('aria-hidden', 'false');

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

        if (!isCommanderPopup) {
            const listElement = elements.body.querySelector('.reveal-card-list');
            if (listElement && typeof UIHorizontalScroll !== 'undefined') {
                UIHorizontalScroll.attachWheelListener(listElement);
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

    static _ensureZonePopupElements(popupKey, zoneInfo, isOpponent) {
        if (!this._zonePopupElements) {
            this._zonePopupElements = new Map();
        }

        if (this._zonePopupElements.has(popupKey)) {
            const existing = this._zonePopupElements.get(popupKey);
            if (typeof UIRenderersTemplates !== 'undefined') {
                UIRenderersTemplates._ensurePopupSearchElements(existing?.panel);
                UIRenderersTemplates._initializePopupSearch(existing?.panel);
            }
            if (existing?.panel) {
                existing.panel.dataset.persistent = zoneInfo && zoneInfo.persistent ? 'true' : 'false';
                if (zoneInfo && zoneInfo.persistent) {
                    const closeButton = existing.panel.querySelector('.zone-popup-close');
                    if (closeButton) {
                        closeButton.remove();
                    }
                }
            }
            return existing;
        }

        const safeTitle = GameUtils.escapeHtml(zoneInfo.title || 'Zone');
        const panel = document.createElement('div');
        panel.id = `zone-popup-${popupKey}`;
        panel.className = 'stack-popup reveal-popup zone-popup hidden';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', `${safeTitle} Zone`);
        panel.setAttribute('aria-hidden', 'true');
        panel.dataset.zonePopupKey = popupKey;
        panel.dataset.zoneOwner = isOpponent ? 'opponent' : 'player';
        panel.dataset.persistent = zoneInfo && zoneInfo.persistent ? 'true' : 'false';

        const closeButtonHtml = zoneInfo && zoneInfo.persistent
            ? ''
            : `<button class="zone-popup-close" onclick="UIZonesManager.closeZoneModal('${popupKey}')">✕</button>`;

        panel.innerHTML = `
            <div class="stack-popup-header reveal-popup-header zone-popup-header" data-draggable-handle>
                <div class="stack-popup-title reveal-popup-title zone-popup-title">
                    <span class="stack-popup-icon reveal-popup-icon zone-popup-icon">${zoneInfo.icon || '🗂️'}</span>
                    <span class="stack-popup-label reveal-popup-label zone-popup-label">${safeTitle}</span>
                    <span class="stack-popup-count reveal-popup-count zone-popup-count" id="zone-popup-count-${popupKey}">0</span>
                </div>
                ${closeButtonHtml}
            </div>
            <div class="popup-search-container">
                <input type="search" class="popup-card-search-input" placeholder="Search cards" aria-label="Search ${safeTitle}">
            </div>
            <div class="stack-popup-body reveal-popup-body zone-popup-body" id="zone-popup-body-${popupKey}"></div>
            <div class="popup-search-empty hidden">No cards match your search</div>
        `;
        document.body.appendChild(panel);

        const handle = panel.querySelector('[data-draggable-handle]');
        const body = panel.querySelector(`#zone-popup-body-${popupKey}`);
        const countLabel = panel.querySelector(`#zone-popup-count-${popupKey}`);
        const titleLabel = panel.querySelector('.zone-popup-label');

        if (typeof UIRenderersTemplates !== 'undefined') {
            if (typeof UIRenderersTemplates !== 'undefined' &&
                typeof UIRenderersTemplates._makePopupDraggable === 'function') {
                UIRenderersTemplates._makePopupDraggable(panel, handle);
            }
            UIRenderersTemplates._initializePopupSearch(panel);
        }

        const elements = { panel, body, countLabel, titleLabel };
        this._zonePopupElements.set(popupKey, elements);
        return elements;
    }

    static _generateZonePopupContent(cards, popupKey, isOpponent, ownerId, zoneInfo = {}) {
        const baseZone = popupKey.replace('opponent_', '');

        if (baseZone === 'commander') {
            const commanderCards = Array.isArray(cards) ? cards : [];
            const commanderTax = Number.isFinite(Number(zoneInfo.commanderTax))
                ? Number(zoneInfo.commanderTax)
                : 0;
            const allowControls = zoneInfo.allowTaxControls === true;
            const allowDrop = allowControls;
            const listAttributes = allowDrop
                ? `data-zone-context="${baseZone}" data-zone-owner="${ownerId}" ondragover="UIZonesManager.handlePopupDragOver(event)" ondragleave="UIZonesManager.handlePopupDragLeave(event)" ondrop="UIZonesManager.handlePopupDrop(event, '${baseZone}')"`
                : `data-zone-context="${baseZone}" data-zone-owner="${ownerId}"`;

            const decreaseDisabledAttr = commanderTax <= 0 ? 'disabled' : '';
            const decreaseDisabledClass = commanderTax <= 0 ? ' commander-tax-adjust-btn-disabled' : '';

            const taxControls = allowControls
                ? `
                    <button class="commander-tax-adjust-btn${decreaseDisabledClass}" ${decreaseDisabledAttr} onclick="event.stopPropagation(); GameActions.adjustCommanderTax('${ownerId}', -2);">-2</button>
                    <span class="commander-tax-value">${commanderTax}</span>
                    <button class="commander-tax-adjust-btn" onclick="event.stopPropagation(); GameActions.adjustCommanderTax('${ownerId}', 2);">+2</button>
                `
                : `<span class="commander-tax-value">${commanderTax}</span>`;

            const taxSection = `
                <div class="commander-popup-tax">
                    <span class="commander-tax-label">Commander Tax</span>
                    <div class="commander-tax-value-group">
                        ${taxControls}
                    </div>
                </div>
            `;

            const emptyCommanderState = `
                <div class="commander-popup-empty">
                    <span class="commander-popup-empty-icon">🧙</span>
                    <div>No commander assigned</div>
                </div>
            `;

            let cardsSection;
            if (commanderCards.length) {
                const cardsHtml = commanderCards.map((card, index) =>
                    GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, baseZone, isOpponent, index, ownerId)
                ).join('');
                cardsSection = `
                    <div class="reveal-card-container commander-popup-card-container">
                        <div class="reveal-card-list commander-popup-card-list" ${listAttributes} data-card-count="${commanderCards.length}">
                            ${cardsHtml}
                        </div>
                    </div>
                `;
            } else if (allowDrop) {
                cardsSection = `
                    <div class="reveal-card-container commander-popup-card-container">
                        <div class="reveal-card-list commander-popup-card-list commander-popup-card-list-empty" ${listAttributes} data-card-count="0">
                            ${emptyCommanderState}
                        </div>
                    </div>
                `;
            } else {
                cardsSection = emptyCommanderState;
            }

            return `
                <div class="commander-popup-content">
                    ${taxSection}
                    ${cardsSection}
                </div>
            `;
        }

        const allowDrop = !isOpponent;
        const listAttributes = allowDrop
            ? `data-zone-context="${baseZone}" data-zone-owner="${ownerId}" ondragover="UIZonesManager.handlePopupDragOver(event)" ondragleave="UIZonesManager.handlePopupDragLeave(event)" ondrop="UIZonesManager.handlePopupDrop(event, '${baseZone}')"`
            : `data-zone-context="${baseZone}" data-zone-owner="${ownerId}"`;

        if (!cards.length) {
            const emptyState = '<div class="reveal-empty">No cards in this zone</div>';
            if (!allowDrop) {
                return emptyState;
            }
            return `
                <div class="reveal-card-container">
                    <div class="reveal-card-list zone-card-list zone-card-list-empty" ${listAttributes} data-card-count="0">
                        ${emptyState}
                    </div>
                </div>
            `;
        }

        const cardsHtml = cards.map((card, index) =>
            GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, baseZone, isOpponent, index, ownerId)
        ).join('');

        return `
            <div class="reveal-card-container">
                <div class="reveal-card-list zone-card-list" ${listAttributes} data-card-count="${cards.length}">
                    ${cardsHtml}
                </div>
            </div>
        `;
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
