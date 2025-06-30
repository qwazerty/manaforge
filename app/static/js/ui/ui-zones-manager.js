/**
 * ManaForge Unified Zones Manager Module
 * Combines zone generation and zone modal management
 * Replaces ui-zones.js + zone-manager.js (691 lines → ~400 lines)
 */

class UIZonesManager {
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
        'battlefield': { title: 'Battlefield', icon: '⚔️', description: 'Cards currently in play' }
    };

    // ===== ZONE GENERATION =====
    
    /**
     * Generate deck zone with clickable cards for drawing
     */
    static generateDeckZone(deck = [], isOpponent = false) {
        const deckArray = Array.isArray(deck) ? deck : [];
        const cardsRemaining = deckArray.length;
        const clickHandler = isOpponent ? '' : 'onclick="GameActions.drawCard()"';
        const overlayText = isOpponent ? '' : 'Draw';
        const deckClass = isOpponent ? 'deck-cards-stack opponent-deck' : 'deck-cards-stack';

        let stackCardsHTML;
        if (cardsRemaining === 0) {
            stackCardsHTML = UIUtils.generateEmptyZoneContent('📖', 'Deck is empty');
        } else {
            const stackLayers = Math.min(5, Math.max(1, cardsRemaining));
            const stackCards = Array(stackLayers).fill().map((_, index) => {
                const transforms = {
                    x: index * 1, y: index * 1.5,
                    rotation: (index % 2 === 0) ? -1 : 1, zIndex: index + 1
                };
                return UIUtils.generateCardLayer(null, index, transforms);
            }).join('');

            stackCardsHTML = `
                <div class="${deckClass}" ${clickHandler}>
                    ${stackCards}
                    <div class="deck-click-overlay">
                        <span class="draw-hint">${overlayText}</span>
                    </div>
                </div>
            `;
        }

        const zoneContent = UIUtils.generateZoneWrapper(`
            <div class="relative flex flex-col items-center py-4"
                ondragover="UIZonesManager.handleZoneDragOver(event)"
                ondrop="UIZonesManager.handleZoneDrop(event, 'deck')">
                ${stackCardsHTML}
                <div class="deck-cards-count mt-2">
                    <span class="cards-remaining">${cardsRemaining} card${cardsRemaining !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `, 'deck');

        // Add context menu after DOM update
        this._attachContextMenu(isOpponent ? '.deck-cards-stack.opponent-deck' : '.deck-cards-stack:not(.opponent-deck)',
                               isOpponent ? 'opponent_deck' : 'deck');
        return zoneContent;
    }

    /**
     * Generate graveyard zone with stack effect showing actual card images
     */
    static generateGraveyardZone(graveyard = [], isOpponent = false) {
        const graveyardArray = Array.isArray(graveyard) ? graveyard : [];
        const cardsRemaining = graveyardArray.length;
        const clickHandler = isOpponent ?
            "UIZonesManager.showOpponentZoneModal('graveyard')" :
            "UIZonesManager.showZoneModal('graveyard')";

        let stackCardsHTML;
        if (cardsRemaining === 0) {
            stackCardsHTML = `
                <div class="graveyard-empty">
                    <span>⚰️</span>
                    <div class="zone-empty-text">Empty</div>
                </div>
            `;
        } else {
            const stackLayers = Math.min(5, Math.max(1, cardsRemaining));
            stackCardsHTML = Array(stackLayers).fill().map((_, index) => {
                const transforms = {
                    x: index * 1, y: index * 1.5,
                    rotation: (index % 2 === 0) ? -1 : 1, zIndex: index + 1
                };
                const cardIndex = Math.max(0, cardsRemaining - stackLayers + index);
                const card = graveyardArray[cardIndex];
                return UIUtils.generateCardLayerWithImage(card, index, transforms, 'graveyard-card-layer');
            }).join('');
        }

        const zoneContent = UIUtils.generateZoneWrapper(`
            <div class="relative flex flex-col items-center py-4"
                ondragover="UIZonesManager.handleZoneDragOver(event)"
                ondrop="UIZonesManager.handleZoneDrop(event, 'graveyard')">
                <div class="graveyard-cards-stack" onclick="${clickHandler}">
                    ${stackCardsHTML}
                    ${cardsRemaining > 0 ? `
                    <div class="graveyard-click-overlay">
                        <span class="zone-view-hint">View<br>All</span>
                    </div>
                    ` : ''}
                </div>
                <div class="graveyard-cards-count mt-2">
                    <span class="cards-remaining">${cardsRemaining} card${cardsRemaining !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `, 'graveyard');

        this._attachContextMenu('.graveyard-cards-stack', isOpponent ? 'opponent_graveyard' : 'graveyard');
        return zoneContent;
    }

    /**
     * Generate exile zone with single card preview and stack effect
     */
    static generateExileZone(exile = [], isOpponent = false) {
        const exileArray = Array.isArray(exile) ? exile : [];
        const cardsRemaining = exileArray.length;
        const clickHandler = isOpponent ?
            "UIZonesManager.showOpponentZoneModal('exile')" :
            "UIZonesManager.showZoneModal('exile')";

        let exileContentHTML;
        if (cardsRemaining === 0) {
            exileContentHTML = `
                <div class="exile-empty">
                    <span>🌌</span>
                    <div class="zone-empty-text">Empty</div>
                </div>
            `;
        } else {
            const stackLayers = Math.min(5, Math.max(1, cardsRemaining));
            const stackCards = Array(stackLayers).fill().map((_, index) => {
                const transforms = {
                    x: index * 1, y: index * 1,
                    rotation: (index % 2 === 0) ? -1 : 1, zIndex: index + 1
                };
                return UIUtils.generateCardLayer(null, index, transforms, 'exile-card-layer');
            }).join('');
            const topCard = exileArray[exileArray.length - 1];

            exileContentHTML = `
                <div class="exile-stack" onclick="${clickHandler}">
                    ${stackCards}
                    <div class="exile-top-card">
                        ${GameCards.renderCardWithLoadingState(topCard, 'card-front-mini', true, 'exile')}
                    </div>
                    <div class="exile-click-overlay">
                        <span class="zone-view-hint">View<br>All</span>
                    </div>
                </div>
            `;
        }

        const zoneContent = UIUtils.generateZoneWrapper(`
            <div class="relative flex flex-col items-center py-4"
                ondragover="UIZonesManager.handleZoneDragOver(event)"
                ondrop="UIZonesManager.handleZoneDrop(event, 'exile')">
                ${exileContentHTML}
                <div class="exile-cards-count mt-2">
                    <span class="cards-remaining">${cardsRemaining} card${cardsRemaining !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `, 'exile');

        this._attachContextMenu('.exile-stack', isOpponent ? 'opponent_exile' : 'exile');
        return zoneContent;
    }

    /**
     * Generate life total zone with enhanced life controls
     */
    static generateLifeZone(life, playerId, titlePrefix) {
        return UIUtils.generateZoneWrapper(`
            <div class="life-zone-container p-4">
                <div class="text-center mb-3">
                    <div class="text-2xl font-bold text-red-400 life-total-display">
                        ❤️ ${life}
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-center">
                    <div class="space-y-1">
                        ${UIConfig.LIFE_CONTROLS.filter(c => c.value < 0).map(control => 
                            UIUtils.generateButton(
                                `GameActions.modifyLife('${playerId}', ${control.value})`,
                                UIConfig.CSS_CLASSES.button.life[control.class],
                                `Remove ${Math.abs(control.value)} life`,
                                control.label
                            )
                        ).join('')}
                    </div>
                    <div class="space-y-1">
                        ${UIConfig.LIFE_CONTROLS.filter(c => c.value > 0).map(control => 
                            UIUtils.generateButton(
                                `GameActions.modifyLife('${playerId}', ${control.value})`,
                                UIConfig.CSS_CLASSES.button.life[control.class],
                                `Add ${control.value} life`,
                                control.label
                            )
                        ).join('')}
                    </div>
                </div>
            </div>
        `, 'life');
    }

    // ===== ZONE MODAL MANAGEMENT =====
    
    /**
     * Show zone modal for current player
     */
    static showZoneModal(zoneName) {
        const gameState = GameCore.getGameState();
        if (!gameState) return;

        const { playerData, zone } = this._getPlayerZoneData(gameState, zoneName, false);
        if (!playerData) return;
        
        const zoneInfo = this.getZoneInfo(zoneName);
        this.closeZoneModal(zoneName);
        
        const modalHTML = this._generateZoneModalHTML(zoneName, zone, zoneInfo);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        setTimeout(() => {
            const modal = document.getElementById(`zone-modal-${zoneName}`);
            if (modal) {
                modal.classList.add('active');
                this._attachModalEventListeners(modal, zoneName);
            }
        }, 10);
    }

    /**
     * Show opponent zone modal
     */
    static showOpponentZoneModal(zoneName) {
        const gameState = GameCore.getGameState();
        if (!gameState) return;

        const { playerData, zone } = this._getPlayerZoneData(gameState, zoneName, true);
        if (!playerData) return;
        
        const pureZoneName = zoneName.replace('opponent_', '');
        const zoneInfo = this.getZoneInfo(pureZoneName);
        this.closeZoneModal(`opponent_${pureZoneName}`);
        
        const modalHTML = this._generateZoneModalHTML(`opponent_${pureZoneName}`, zone, zoneInfo);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        setTimeout(() => {
            const modal = document.getElementById(`zone-modal-opponent_${pureZoneName}`);
            if (modal) {
                modal.classList.add('active');
                this._attachModalEventListeners(modal, `opponent_${pureZoneName}`);
            }
        }, 10);
    }

    /**
     * Close zone modal
     */
    static closeZoneModal(zoneName) {
        const modal = document.getElementById(`zone-modal-${zoneName}`);
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
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
        if (event.currentTarget) {
            event.currentTarget.classList.add('zone-drag-over');
        }
    }

    static handleZoneDrop(event, targetZone) {
        event.preventDefault();
        if (event.currentTarget) {
            event.currentTarget.classList.remove('zone-drag-over');
        }
        try {
            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            // Appeler une action pour déplacer la carte (à adapter selon la logique backend)
            if (window.GameActions && typeof window.GameActions.moveCard === 'function') {
                window.GameActions.moveCard(data.cardId, data.cardZone, targetZone, data.uniqueCardId);
            } else {
                UINotifications.showNotification('Déplacement de carte non implémenté côté backend.', 'warning');
            }
        } catch (e) {
            UINotifications.showNotification('Erreur lors du drop de carte.', 'error');
        }
    }

    // ===== PRIVATE HELPER METHODS =====
    
    /**
     * Get player zone data (unified for both player and opponent)
     */
    static _getPlayerZoneData(gameState, zoneName, isOpponent) {
        const currentPlayer = GameCore.getSelectedPlayer();
        let playerIndex = currentPlayer === 'player2' ? 1 : 0;
        if (isOpponent) playerIndex = playerIndex === 0 ? 1 : 0;
        
        const playerData = gameState.players?.[playerIndex];
        if (!playerData) return { playerData: null, zone: [] };

        const pureZoneName = zoneName.replace('opponent_', '');
        let zone = [];
        if (pureZoneName === 'deck') {
            zone = playerData.library || playerData.deck || [];
        } else {
            zone = playerData[pureZoneName] || [];
        }
        
        return { playerData, zone };
    }

    /**
     * Attach context menu to zone element
     */
    static _attachContextMenu(selector, zoneName) {
        setTimeout(() => {
            const element = document.querySelector(selector);
            if (element && window.ZoneContextMenu) {
                window.ZoneContextMenu.attachToZone(element, zoneName);
                element.classList.add('zone-context-menu-enabled');
            }
        }, 100);
    }

    /**
     * Generate zone modal HTML
     */
    static _generateZoneModalHTML(zoneName, zone, zoneInfo) {
        const info = zoneInfo || this.getZoneInfo(zoneName);
        return `
            <div class="zone-modal" id="zone-modal-${zoneName}">
                <div class="zone-modal-content">
                    <div class="zone-modal-header">
                        <div class="zone-modal-title">
                            <span>${info.icon}</span>
                            ${info.title}
                        </div>
                        <button class="zone-modal-close" onclick="UIZonesManager.closeZoneModal('${zoneName}')">
                            ✕
                        </button>
                    </div>
                    <div class="zone-cards-container">
                        ${this._generateZoneCardsGrid(zone, zoneName)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate zone cards grid
     */
    static _generateZoneCardsGrid(cards, zoneName) {
        if (!cards || cards.length === 0) {
            const zoneInfo = this.getZoneInfo(zoneName);
            return `
                <div class="zone-empty-message">
                    <div class="zone-empty-icon">${zoneInfo.icon}</div>
                    <div class="zone-empty-text">No cards in ${zoneInfo.title.toLowerCase()}</div>
                    <div class="zone-empty-description">${zoneInfo.description}</div>
                </div>
            `;
        }
        
        const cardsHTML = cards.map((card, index) => `
            <div class="zone-card-slider-item" onclick="UIZonesManager.showCardDetails('${card.id || index}', '${zoneName}')">
                ${GameCards.renderCardWithLoadingState(card, 'card-mini', true, zoneName)}
            </div>
        `).join('');
        
        return `<div class="zone-cards-slider">${cardsHTML}</div>`;
    }

    /**
     * Attach modal event listeners
     */
    static _attachModalEventListeners(modal, zoneName) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeZoneModal(zoneName);
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeZoneModal(zoneName);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
}

// Backward compatibility exports
window.UIZones = UIZonesManager;
window.ZoneManager = UIZonesManager;
window.UIZonesManager = UIZonesManager;
