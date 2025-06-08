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

        // For opponent, don't show clickable overlay since they can't draw from opponent's deck
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
     * Generate graveyard zone with visible cards
     */
    static generateGraveyardZone(graveyard = []) {
        // Ensure graveyard is always an array
        const graveyardArray = Array.isArray(graveyard) ? graveyard : [];
        
        if (graveyardArray.length === 0) {
            return UIUtils.generateZoneWrapper(`
                ${UIUtils.generateEmptyZoneContent('⚰️', 'No cards in graveyard')}
            `, 'graveyard');
        }

        const visibleCards = Math.min(5, graveyardArray.length);
        const cardsToShow = graveyardArray.slice(-visibleCards).reverse();
        
        const spreadCards = cardsToShow.map((card, index) => {
            const transforms = {
                x: index * 30,
                y: index * 10,
                rotation: (index - visibleCards / 2) * 5,
                zIndex: visibleCards - index
            };
            
            return `
                <div class="graveyard-card-position ${UIConfig.CSS_CLASSES.card.position}" 
                     style="${UIUtils.createTransform(transforms.x, transforms.y, transforms.rotation)}; ${UIUtils.createZIndex(transforms.zIndex)}">
                    ${GameCards.renderCardWithLoadingState(card, UIConfig.CSS_CLASSES.card.mini, true, 'graveyard')}
                </div>
            `;
        }).join('');

        const moreIndicator = graveyardArray.length > visibleCards ? 
            `<div class="graveyard-more-indicator">+${graveyardArray.length - visibleCards} more</div>` : '';

        return UIUtils.generateZoneWrapper(`
            <div class="relative h-72 mt-2 mb-4">
                <div class="graveyard-cards-spread" onclick="ZoneManager.showZoneModal('graveyard')">
                    ${spreadCards}
                    ${moreIndicator}
                </div>
            </div>
        `, 'graveyard');
    }

    /**
     * Generate exile zone with visible cards
     */
    static generateExileZone(exile = []) {
        // Ensure exile is always an array
        const exileArray = Array.isArray(exile) ? exile : [];
        
        if (exileArray.length === 0) {
            return UIUtils.generateZoneWrapper(`
                ${UIUtils.generateEmptyZoneContent('🌌', 'No cards in exile')}
            `, 'exile');
        }

        const visibleCards = Math.min(6, exileArray.length);
        const cardsToShow = exileArray.slice(-visibleCards);
        
        const gridCards = cardsToShow.map((card, index) => {
            const randomRotation = (Math.random() * 6) - 3; // Between -3 and +3 degrees
            
            return `
                <div class="relative" style="${UIUtils.createTransform(0, 0, randomRotation)}">
                    ${GameCards.renderCardWithLoadingState(card, UIConfig.CSS_CLASSES.card.mini, true, 'exile')}
                </div>
            `;
        }).join('');

        const moreIndicator = exileArray.length > visibleCards ? 
            `<div class="text-center text-arena-accent mt-2">+${exileArray.length - visibleCards} more cards</div>` : '';

        return UIUtils.generateZoneWrapper(`
            <div class="mt-2 mb-4">
                <div class="grid grid-cols-3 gap-2" onclick="ZoneManager.showZoneModal('exile')">
                    ${gridCards}
                </div>
                ${moreIndicator}
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
