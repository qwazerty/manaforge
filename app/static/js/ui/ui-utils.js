/**
 * ManaForge UI Utilities Module
 * Contains utility functions for UI generation
 */

class UIUtils {
    /**
     * Create CSS transform string
     */
    static createTransform(x = 0, y = 0, rotation = 0) {
        return `transform: translateX(${x}px) translateY(${y}px) rotate(${rotation}deg)`;
    }

    /**
     * Create CSS z-index string
     */
    static createZIndex(index) {
        return `z-index: ${index}`;
    }

    /**
     * Generate HTML button element
     */
    static generateButton(onclick, classes, title, content, disabled = false) {
        return `
            <button onclick="${onclick}" 
                    class="${classes}"
                    title="${title}"
                    ${disabled ? 'disabled' : ''}>
                ${content}
            </button>
        `;
    }

    /**
     * Generate zone wrapper
     */
    static generateZoneWrapper(content, zoneType) {
        return `
            <div class="${UIConfig.CSS_CLASSES.zone.container} ${zoneType}-zone">
                ${content}
            </div>
        `;
    }

    /**
     * Generate empty zone content
     */
    static generateEmptyZoneContent(icon, message) {
        return `
            <div class="${UIConfig.CSS_CLASSES.zone.empty}">
                <div class="text-arena-text-dim text-center py-4">${icon} ${message}</div>
            </div>
        `;
    }

    /**
     * Generate card layer with transforms
     */
    static generateCardLayer(card, index, transforms, customClass = null) {
        const { x = 0, y = 0, rotation = 0, zIndex = 1 } = transforms;
        const style = `${this.createTransform(x, y, rotation)}; ${this.createZIndex(zIndex)}`;
        
        // Use custom class if provided, otherwise use default
        const layerClass = customClass || UIConfig.CSS_CLASSES.card.position;
        
        return `
            <div class="${layerClass}" style="${style}">
                ${card ? GameCards.renderCardWithLoadingState(card, UIConfig.CSS_CLASSES.card.mini, true, 'zone') : 
                         `<div class="${UIConfig.CSS_CLASSES.card.backMini}"></div>`}
            </div>
        `;
    }

    /**
     * Generate card layer with transforms and actual card image
     */
    static generateCardLayerWithImage(card, index, transforms, customClass = null) {
        const { x = 0, y = 0, rotation = 0, zIndex = 1 } = transforms;
        const style = `${this.createTransform(x, y, rotation)}; ${this.createZIndex(zIndex)}`;
        
        // Use custom class if provided, otherwise use default
        const layerClass = customClass || UIConfig.CSS_CLASSES.card.position;
        
        return `
            <div class="${layerClass}" style="${style}">
                ${GameCards.renderCardWithLoadingState(card, 'card-front-mini', true, 'graveyard')}
            </div>
        `;
    }

    /**
     * Generate empty zone fallback
     */
    static generateEmptyZone(icon, name) {
        return `
            <div class="card-fallback text-xs">
                <span class="text-2xl mb-2">${icon}</span>
                <div>${name}</div>
            </div>
        `;
    }

    /**
     * Generate click handler for zone modal
     */
    static generateZoneClickHandler(isOpponent, prefix, zoneType, title) {
        const handlerPrefix = isOpponent ? 'Opponent' : '';
        return `onclick="ZoneManager.show${handlerPrefix}ZoneModal('${prefix}${zoneType}')" title="Click to view ${title}"`;
    }

    /**
     * Filter cards by type for battlefield zones
     */
    static filterCardsByType(cards, zoneName) {
        if (!cards || !Array.isArray(cards)) return [];

        const normalizeTypeText = (card) => {
            if (!card) return '';
            const faceTypes = (() => {
                if (!Array.isArray(card.card_faces) || card.card_faces.length === 0) {
                    return [];
                }
                const currentFaceIndex = typeof card.current_face === 'number' ? card.current_face : 0;
                const activeFace = card.card_faces[currentFaceIndex] || card.card_faces[0];
                return activeFace && activeFace.type_line ? [activeFace.type_line] : [];
            })();
            const pieces = [
                card.card_type,
                card.cardType,
                card.type_line,
                card.typeLine,
                card.subtype,
                ...faceTypes
            ].filter(Boolean);
            return pieces.join(' ').toLowerCase();
        };

        if (zoneName === 'lands') {
            return cards.filter(card => {
                const typeText = normalizeTypeText(card);
                return typeText.includes('land');
            });
        } else if (zoneName === 'creatures') {
            return cards.filter(card => {
                const typeText = normalizeTypeText(card);
                return typeText.includes('creature');
            });
        } else if (zoneName === 'support') {
            return cards.filter(card => {
                const typeText = normalizeTypeText(card);
                const isCreature = typeText.includes('creature');
                const isLand = typeText.includes('land');
                const hasSupportType = ['artifact', 'enchantment', 'planeswalker'].some(type => typeText.includes(type));
                return hasSupportType && !isCreature && !isLand;
            });
        }
        return cards;
    }

    /**
     * Get zone configuration for player type
     */
    static getZoneConfiguration(isOpponent, playerIndex) {
        const prefix = isOpponent ? 'opponent_' : '';
        const titlePrefix = isOpponent ? "Opponent's " : '';
        
        // Generate unique IDs for zone elements
        const zoneIds = {
            deck: isOpponent ? 'opponent-deck-preview' : 'deck-preview-container',
            graveyard: isOpponent ? 'opponent-graveyard-preview' : 'graveyard-preview',
            exile: isOpponent ? 'opponent-exile-preview' : 'exile-preview'
        };
        
        // Determine the correct player ID
        let playerId;
        if (playerIndex !== null) {
            playerId = `player${playerIndex + 1}`;
        } else {
            playerId = isOpponent ? 'player2' : 'player1';
        }

        return { prefix, titlePrefix, zoneIds, playerId };
    }
}

window.UIUtils = UIUtils;
