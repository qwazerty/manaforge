/**
 * ManaForge UI Templates Module
 * Main orchestrator class that combines all UI modules
 */

class UITemplates {
    // Delegate methods to appropriate modules
    
    // Configuration access
    static get GAME_PHASES() { return UIConfig.GAME_PHASES; }
    static get ZONE_CONFIG() { return UIConfig.ZONE_CONFIG; }
    static get LIFE_CONTROLS() { return UIConfig.LIFE_CONTROLS; }
    static get CSS_CLASSES() { return UIConfig.CSS_CLASSES; }

    // Utility methods
    static createTransform(x, y, rotation) { return UIUtils.createTransform(x, y, rotation); }
    static createZIndex(index) { return UIUtils.createZIndex(index); }
    static generateButton(onclick, classes, title, content) { return UIUtils.generateButton(onclick, classes, title, content); }
    static generateZoneWrapper(content, zoneType) { return UIUtils.generateZoneWrapper(content, zoneType); }
    static generateEmptyZoneContent(icon, message) { return UIUtils.generateEmptyZoneContent(icon, message); }
    static generateZoneHeader(icon, title, count) { return UIUtils.generateZoneHeader(icon, title, count); }
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
    static generateZonePreviewBase(zoneConfig, content, clickHandler) { return UIZones.generateZonePreviewBase(zoneConfig, content, clickHandler); }
    static generateDeckZonePreview(deck, deckId, prefix, titlePrefix, isOpponent) { return UIZones.generateDeckZonePreview(deck, deckId, prefix, titlePrefix, isOpponent); }
    static generateGraveyardZonePreview(graveyard, graveyardId, prefix, titlePrefix, isOpponent) { return UIZones.generateGraveyardZonePreview(graveyard, graveyardId, prefix, titlePrefix, isOpponent); }
    static generateExileZonePreview(exile, exileId, prefix, titlePrefix, isOpponent) { return UIZones.generateExileZonePreview(exile, exileId, prefix, titlePrefix, isOpponent); }

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
        const { deck = [], graveyard = [], exile = [], life = 20 } = playerData;

        // Generate individual zone templates
        const zoneTemplates = {
            life: this.generateLifeZone(life, playerId, titlePrefix),
            deck: this.generateDeckZonePreview(deck, zoneIds.deck, prefix, titlePrefix, isOpponent),
            graveyard: this.generateGraveyardZonePreview(graveyard, zoneIds.graveyard, prefix, titlePrefix, isOpponent),
            exile: this.generateExileZonePreview(exile, zoneIds.exile, prefix, titlePrefix, isOpponent)
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
            ? ['exile', 'graveyard', 'deck', 'life']
            : ['life', 'deck', 'graveyard', 'exile'];

        const orderedZones = zoneOrder.map(zoneName => zoneTemplates[zoneName]);

        return `
            <div class="card-zones-container">
                ${orderedZones.join('')}
            </div>
        `;
    }
}

window.UITemplates = UITemplates;
