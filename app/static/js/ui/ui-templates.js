/**
 * ManaForge UI Templates Module
 * Main orchestrator class that combines all UI modules
 */

class UITemplates {
    // Delegate methods to appropriate modules
    
    // Configuration access
    static get GAME_PHASES() { return UIConfig.GAME_PHASES; }
    static get LIFE_CONTROLS() { return UIConfig.LIFE_CONTROLS; }
    static get CSS_CLASSES() { return UIConfig.CSS_CLASSES; }

    // Utility methods
    static createTransform(x, y, rotation) { return UIUtils.createTransform(x, y, rotation); }
    static createZIndex(index) { return UIUtils.createZIndex(index); }
    static generateButton(onclick, classes, title, content) { return UIUtils.generateButton(onclick, classes, title, content); }
    static generateZoneWrapper(content, zoneType) { return UIUtils.generateZoneWrapper(content, zoneType); }
    static generateEmptyZoneContent(icon, message) { return UIUtils.generateEmptyZoneContent(icon, message); }
    static generateCardLayer(card, index, transforms) { return UIUtils.generateCardLayer(card, index, transforms); }
    static generateEmptyZone(icon, name) { return UIUtils.generateEmptyZone(icon, name); }
    static generateZoneClickHandler(isOpponent, prefix, zoneType, title) { return UIUtils.generateZoneClickHandler(isOpponent, prefix, zoneType, title); }
    static filterCardsByType(cards, zoneName) { return UIUtils.filterCardsByType(cards, zoneName); }
    static getZoneConfiguration(isOpponent, playerIndex) { return UIUtils.getZoneConfiguration(isOpponent, playerIndex); }

    // Zone generation
    static generateDeckZone(deck) { return UIZones.generateDeckZone(deck); }
    static generateGraveyardZone(graveyard) { return UIZones.generateGraveyardZone(graveyard); }
    static generateExileZone(exile) { return UIZones.generateExileZone(exile); }
    static generateLifeZone(life, playerId, titlePrefix) { return UIZones.generateLifeZone(life, playerId, titlePrefix); }

    // Game interface
    static generateGameInfo(gameState) { return UIGameInterface.generateGameInfo(gameState); }
    static generateGamePhases(currentPhase) { return UIGameInterface.generateGamePhases(currentPhase); }
    static generateGameInfoSection(currentTurn, activePlayer) { return UIGameInterface.generateGameInfoSection(currentTurn, activePlayer); }
    static generateActionButtonsSection() { return UIGameInterface.generateActionButtonsSection(); }
    static generateActionButtons() { return UIGameInterface.generateActionButtons(); }
    static generateSpectatorView() { return UIGameInterface.generateSpectatorView(); }
    static generateErrorTemplate(title, message) { return UIGameInterface.generateErrorTemplate(title, message); }
    static generateBattlefieldZone(cards, zoneName, title, icon) { return UIGameInterface.generateBattlefieldZone(cards, zoneName, title, icon); }
    static generatePlayerHand(hand) { return UIGameInterface.generatePlayerHand(hand); }
    static generateOpponentHand(handSize) { return UIGameInterface.generateOpponentHand(handSize); }

    /**
     * Generate zone templates in the correct order
     */
    static generateZoneTemplates(playerData, config, isOpponent) {
        const { prefix, titlePrefix, zoneIds, playerId } = config;
        // Fix: Backend uses 'library' but frontend expects 'deck'
        const { library = [], deck = [], graveyard = [], exile = [], life = 20 } = playerData;
        
        // Use library data if available, fallback to deck
        const deckData = library.length > 0 ? library : deck;

        // Generate individual zone templates using basic zones
        const zoneTemplates = {
            life: this.generateLifeZone(life, playerId, titlePrefix),
            deck: this.generateDeckZone(deckData),
            graveyard: this.generateGraveyardZone(graveyard),
            exile: this.generateExileZone(exile)
        };

        return zoneTemplates;
    }

    /**
     * Generate combined card zones display
     */
    static generateCardZones(playerData, isOpponent = false, playerIndex = null) {
        // Get configuration for this player type
        const config = this.getZoneConfiguration(isOpponent, playerIndex);
        
        // Generate zone templates
        const zoneTemplates = this.generateZoneTemplates(playerData, config, isOpponent);

        // For opponent, display zones in reverse order: Exile, Graveyard, Deck, Life
        // For player, display zones in normal order: Life, Deck, Graveyard, Exile
        const zoneOrder = isOpponent 
            ? ['exile', 'graveyard', 'life', 'deck']
            : ['life', 'deck', 'exile', 'graveyard'];

        const orderedZones = zoneOrder.map(zoneName => zoneTemplates[zoneName]);

        return `
            <div class="card-zones-container">
                ${orderedZones.join('')}
            </div>
        `;
    }
}

window.UITemplates = UITemplates;
