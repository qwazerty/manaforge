/**
 * ManaForge Zone Management Module
 * Handles zone modals and zone-related UI components
 */

class ZoneManager {
    static CARD_TYPE_ICONS = {
        'creature': '🦎',
        'instant': '⚡',
        'sorcery': '🔮',
        'enchantment': '✨',
        'artifact': '⚙️',
        'planeswalker': '👑',
        'land': '🏔️',
        'default': '🃏'
    };

    /**
     * Show zone modal
     */
    static showZoneModal(zoneName) {
        const gameState = GameCore.getGameState();
        if (!gameState) {
            console.warn('No game state available for zone modal');
            return;
        }

        const currentPlayer = GameCore.getSelectedPlayer();
        const playerData = gameState[currentPlayer];
        if (!playerData) {
            console.warn('No player data available for zone modal');
            return;
        }

        const zone = playerData[zoneName] || [];
        const zoneInfo = this.getZoneInfo(zoneName);
        
        // Remove existing modal if any
        this.closeZoneModal(zoneName);
        
        // Create and show new modal
        const modalHTML = this.generateZoneModalHTML(zoneName, zone, zoneInfo);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Animate modal appearance
        setTimeout(() => {
            const modal = document.getElementById(`zone-modal-${zoneName}`);
            if (modal) {
                modal.classList.add('active');
                this.attachModalEventListeners(modal, zoneName);
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
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    /**
     * Update zone counts in UI
     */
    static updateZoneCounts() {
        const gameState = GameCore.getGameState();
        if (!gameState) return;

        const currentPlayer = GameCore.getSelectedPlayer();
        const playerData = gameState[currentPlayer];
        if (!playerData) return;

        // Handle library/deck mapping
        const deckData = playerData.library || playerData.deck || [];

        const zoneCounts = {
            'deck': deckData.length || 0,
            'exile': playerData.exile?.length || 0,
            'graveyard': playerData.graveyard?.length || 0
        };

        // Update count elements
        Object.entries(zoneCounts).forEach(([zoneName, count]) => {
            const countElement = document.getElementById(`${zoneName}-count`);
            if (countElement) {
                countElement.textContent = count;
            }
        });
    }

    /**
     * Show card details
     */
    static showCardDetails(cardId, zoneName) {
        UINotifications.showNotification(`Card details: ${cardId}`, 'info');
    }

    /**
     * Update zone previews with actual cards
     */
    static updateZonePreviews() {
        const gameState = GameCore.getGameState();
        if (!gameState) return;

        const currentPlayer = GameCore.getSelectedPlayer();
        const playerData = gameState[currentPlayer];
        if (!playerData) return;
        
        // Handle library/deck mapping
        const deckData = playerData.library || playerData.deck || [];
        
        // Update deck preview
        this.updateDeckPreview(deckData);
        
        // Update graveyard preview
        this.updateGraveyardPreview(playerData.graveyard || []);
        
        // Update exile preview
        this.updateExilePreview(playerData.exile || []);
    }
    
    /**
     * Update deck preview with top card
     */
    static updateDeckPreview(deck) {
        const deckPreviewContainer = document.getElementById('deck-preview-container');
        if (!deckPreviewContainer) return;
        
        // We'll keep the initial structure for deck (showing card backs)
    }
    
    /**
     * Update graveyard preview with top card
     */
    static updateGraveyardPreview(graveyard) {
        const graveyardTopCard = document.getElementById('graveyard-top-card');
        if (!graveyardTopCard) return;
        
        if (graveyard.length > 0) {
            const topCard = graveyard[graveyard.length - 1]; // Get the top card
            graveyardTopCard.innerHTML = GameCards.renderCardWithLoadingState(topCard, 'card-mini', true, 'graveyard');
        } else {
            graveyardTopCard.innerHTML = `
                <div class="card-fallback">
                    <span>⚰️</span>
                    <div>Empty</div>
                </div>
            `;
        }
    }
    
    /**
     * Update exile preview with top card
     */
    static updateExilePreview(exile) {
        const exileTopCard = document.getElementById('exile-top-card');
        if (!exileTopCard) return;
        
        if (exile.length > 0) {
            const topCard = exile[exile.length - 1]; // Get the most recent exiled card
            exileTopCard.innerHTML = GameCards.renderCardWithLoadingState(topCard, 'card-mini', true, 'exile');
        } else {
            exileTopCard.innerHTML = `
                <div class="card-fallback">
                    <span>🌌</span>
                    <div>Empty</div>
                </div>
            `;
        }
    }

    /**
     * Show opponent zone modal
     */
    static showOpponentZoneModal(zoneName) {
        const gameState = GameCore.getGameState();
        if (!gameState) return;

        const { opponentIdx, players } = this.getPlayerIndices(gameState);
        const opponent = players[opponentIdx];
        
        if (!opponent) return;

        // Convert opponent zone name to pure zone name
        const pureZoneName = zoneName.replace('opponent_', '');
        
        // Handle library/deck mapping
        let zone = [];
        if (pureZoneName === 'deck') {
            zone = opponent.library || opponent.deck || [];
        } else {
            zone = opponent[pureZoneName] || [];
        }
        
        // Remove existing modal if any
        this.closeZoneModal(`opponent_${pureZoneName}`);
        
        // Create and show new modal
        const modalHTML = this.generateZoneModalHTML(`opponent_${pureZoneName}`, zone);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Animate modal appearance
        setTimeout(() => {
            const modal = document.getElementById(`zone-modal-opponent_${pureZoneName}`);
            if (modal) {
                modal.classList.add('active');
                this.attachModalEventListeners(modal, `opponent_${pureZoneName}`);
            }
        }, 10);
    }

    /**
     * Get player indices for controlled and opponent players
     */
    static getPlayerIndices(gameState) {
        const currentSelectedPlayer = GameCore.getSelectedPlayer();
        const players = gameState.players || [];
        
        let controlledIdx = 0;
        if (currentSelectedPlayer === 'player2') controlledIdx = 1;
        else if (currentSelectedPlayer === 'player1') controlledIdx = 0;
        
        const opponentIdx = controlledIdx === 0 ? 1 : 0;
        
        return { controlledIdx, opponentIdx, players };
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Get zone information
     */
    static getZoneInfo(zoneName) {
        return this.ZONE_INFO[zoneName] || {
            title: 'Unknown Zone',
            icon: '❓',
            description: 'Unknown card zone'
        };
    }

    /**
     * Generate zone modal HTML
     */
    static generateZoneModalHTML(zoneName, zone) {
        return `
            <div class="zone-modal" id="zone-modal-${zoneName}">
                <div class="zone-modal-content">
                    <div class="zone-modal-header">
                        <button class="zone-modal-close" onclick="ZoneManager.closeZoneModal('${zoneName}')">
                            ✕
                        </button>
                    </div>
                    <div class="zone-cards-container">
                        ${this.generateZoneCardsGrid(zone, zoneName)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate zone cards grid
     */
    static generateZoneCardsGrid(cards, zoneName) {
        if (!cards || cards.length === 0) {
            return this.generateEmptyZoneMessage(zoneName);
        }

        const cardsHTML = cards.map((card, index) => this.generateZoneCardItem(card, index, zoneName)).join('');
        return `<div class="zone-cards-grid">${cardsHTML}</div>`;
    }

    /**
     * Generate empty zone message
     */
    static generateEmptyZoneMessage(zoneName) {
        const zoneInfo = this.getZoneInfo(zoneName);
        return `
            <div class="zone-empty-message">
                <div class="zone-empty-icon">${zoneInfo.icon}</div>
                <div class="zone-empty-text">No cards in ${zoneInfo.title.toLowerCase()}</div>
                <div class="zone-empty-description">${zoneInfo.description}</div>
            </div>
        `;
    }

    /**
     * Generate zone card item
     */
    static generateZoneCardItem(card, index, zoneName) {
        const cardName = card.name || `Unknown Card ${index + 1}`;
        const cardCost = card.mana_cost || card.cost || '';
        const cardType = card.type_line || card.type || 'Unknown Type';
        
        // Utiliser la même fonction de rendu que pour les prévisualisations
        return `
            <div class="zone-card-item" onclick="ZoneManager.showCardDetails('${card.id || index}', '${zoneName}')">
                ${GameCards.renderCardWithLoadingState(card, 'card-mini', true, zoneName)}
                <div class="zone-card-name mt-2">${cardName}</div>
                <div class="zone-card-cost">${cardCost}</div>
            </div>
        `;
    }

    /**
     * Get card type icon
     */
    static getCardTypeIcon(cardType) {
        const type = cardType.toLowerCase();
        
        for (const [typeKey, icon] of Object.entries(this.CARD_TYPE_ICONS)) {
            if (typeKey !== 'default' && type.includes(typeKey)) {
                return icon;
            }
        }
        
        return this.CARD_TYPE_ICONS.default;
    }

    /**
     * Attach modal event listeners
     */
    static attachModalEventListeners(modal, zoneName) {
        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeZoneModal(zoneName);
            }
        });

        // Close modal on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeZoneModal(zoneName);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
}

window.ZoneManager = ZoneManager;
