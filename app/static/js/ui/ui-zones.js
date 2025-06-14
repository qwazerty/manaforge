/**
 * ManaForge Game Zones Module
 * Contains zone generation functions for deck, graveyard, exile, and life
 */

class UIZones {
    /**
     * Generate deck zone with clickable cards for drawing
     */
    static generateDeckZone(deck = [], isOpponent = false) {
        // Ensure deck is always an array
        const deckArray = Array.isArray(deck) ? deck : [];
        
        // Show empty deck for both player and opponent when deck is truly empty
        if (deckArray.length === 0) {
            return UIUtils.generateZoneWrapper(`
                ${UIUtils.generateEmptyZoneContent('📖', 'Deck is empty')}
            `, 'deck');
        }

        // Calculate cards remaining - both player and opponent should show actual count
        const cardsRemaining = deckArray.length;

        // Show stack layers based on actual card count for both player and opponent
        const stackLayers = Math.min(5, Math.max(1, deckArray.length));
        
        const stackCards = Array(stackLayers).fill().map((_, index) => {
            const transforms = {
                x: index * 1,
                y: index * 1.5,
                rotation: (index % 2 === 0) ? -1 : 1,
                zIndex: index + 1
            };
            
            return UIUtils.generateCardLayer(null, index, transforms);
        }).join('');

        // For opponent, don't show clickable overlay or click handler since they can't draw from opponent's deck  
        const clickHandler = isOpponent ? '' : 'onclick="GameActions.drawCard()"';
        const clickOverlay = isOpponent ? '' : `
            <div class="deck-click-overlay">
                <span class="draw-hint">Draw</span>
            </div>
        `;
        
        // Add opponent-specific CSS class to disable interactions
        const deckClass = isOpponent ? 'deck-cards-stack opponent-deck' : 'deck-cards-stack';

        return UIUtils.generateZoneWrapper(`
            <div class="relative flex flex-col items-center py-4">
                <div class="${deckClass}" ${clickHandler}>
                    ${stackCards}
                    ${clickOverlay}
                </div>
                <div class="deck-cards-count mt-2">
                    <span class="cards-remaining">${cardsRemaining} card${cardsRemaining !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `, 'deck');
    }

    /**
     * Generate graveyard zone with stack effect showing actual card images
     */
    static generateGraveyardZone(graveyard = []) {
        // Ensure graveyard is always an array
        const graveyardArray = Array.isArray(graveyard) ? graveyard : [];
        
        if (graveyardArray.length === 0) {
            return UIUtils.generateZoneWrapper(`
                <div class="relative flex flex-col items-center py-4">
                    <div class="graveyard-empty">
                        <span>⚰️</span>
                        <div class="zone-empty-text">Empty</div>
                    </div>
                </div>
            `, 'graveyard');
        }

        // Calculate cards remaining
        const cardsRemaining = graveyardArray.length;

        // Show stack layers based on actual card count (like deck)
        const stackLayers = Math.min(5, Math.max(1, graveyardArray.length));
        
        const stackCards = Array(stackLayers).fill().map((_, index) => {
            const transforms = {
                x: index * 1,
                y: index * 1.5,
                rotation: (index % 2 === 0) ? -1 : 1,
                zIndex: index + 1
            };
            
            // Get the card for this layer (from bottom to top of graveyard)
            const cardIndex = Math.max(0, graveyardArray.length - stackLayers + index);
            const card = graveyardArray[cardIndex];
            
            return UIUtils.generateCardLayerWithImage(card, index, transforms, 'graveyard-card-layer');
        }).join('');

        return UIUtils.generateZoneWrapper(`
            <div class="relative flex flex-col items-center py-4">
                <div class="graveyard-cards-stack" onclick="ZoneManager.showZoneModal('graveyard')">
                    ${stackCards}
                    <div class="graveyard-click-overlay">
                        <span class="zone-view-hint">View<br>All</span>
                    </div>
                </div>
                <div class="graveyard-cards-count mt-2">
                    <span class="cards-remaining">${cardsRemaining} card${cardsRemaining !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `, 'graveyard');
    }

    /**
     * Generate exile zone with single card preview and stack effect
     */
    static generateExileZone(exile = []) {
        // Ensure exile is always an array
        const exileArray = Array.isArray(exile) ? exile : [];
        
        if (exileArray.length === 0) {
            return UIUtils.generateZoneWrapper(`
                <div class="relative flex flex-col items-center py-4">
                    <div class="exile-empty">
                        <span>🌌</span>
                        <div class="zone-empty-text">Empty</div>
                    </div>
                </div>
            `, 'exile');
        }

        // Calculate cards remaining
        const cardsRemaining = exileArray.length;

        // Show stack layers based on card count (max 5 layers for visual effect)
        const stackLayers = Math.min(5, Math.max(1, exileArray.length));
        
        const stackCards = Array(stackLayers).fill().map((_, index) => {
            const transforms = {
                x: index * 1,
                y: index * 1,
                rotation: (index % 2 === 0) ? -1 : 1,
                zIndex: index + 1
            };
            
            return UIUtils.generateCardLayer(null, index, transforms, 'exile-card-layer');
        }).join('');

        // Get top card for display (most recent exiled card)
        const topCard = exileArray[exileArray.length - 1];

        return UIUtils.generateZoneWrapper(`
            <div class="relative flex flex-col items-center py-4">
                <div class="exile-stack" onclick="ZoneManager.showZoneModal('exile')">
                    ${stackCards}
                    <div class="exile-top-card">
                        ${GameCards.renderCardWithLoadingState(topCard, 'card-front-mini', true, 'exile')}
                    </div>
                    <div class="exile-click-overlay">
                        <span class="zone-view-hint">View<br>All</span>
                    </div>
                </div>
                <div class="exile-cards-count mt-2">
                    <span class="cards-remaining">${cardsRemaining} card${cardsRemaining !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `, 'exile');
    }

    /**
     * Generate life total zone with enhanced life controls
     */
    static generateLifeZone(life, playerId, titlePrefix) {
        return UIUtils.generateZoneWrapper(`
            <div class="life-zone-container p-4">
            <!-- Life Total Display -->
            <div class="text-center mb-3">
                <div class="text-2xl font-bold text-red-400 life-total-display">
                    ❤️ ${life}
                </div>
            </div>
            
            <!-- Life Control Buttons -->
                <div class="grid grid-cols-2 gap-2 text-center">
                    <!-- Negative buttons (left side) -->
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
                    <!-- Positive buttons (right side) -->
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
}

window.UIZones = UIZones;
