/**
 * ManaForge Game Zones Module
 * Contains zone generation functions for deck, graveyard, exile, and life
 */

class UIZones {
    /**
     * Generate deck zone with clickable cards for drawing
     */
    static generateDeckZone(deck = []) {
        const config = UIConfig.ZONE_CONFIG.deck;
        
        if (deck.length === 0) {
            return UIUtils.generateZoneWrapper(`
                ${UIUtils.generateZoneHeader(config.icon, config.name, 0)}
                ${UIUtils.generateEmptyZoneContent(config.icon, 'Deck is empty')}
            `, 'deck');
        }

        const topCard = deck[deck.length - 1];
        const stackLayers = Math.min(config.stackLayers, deck.length);
        
        const faceUpNotice = topCard && !topCard.facedown ? 
            '<div class="text-xs text-arena-accent mt-2 mb-1">Top card visible (Debug mode)</div>' : '';
        
        const stackCards = Array(stackLayers).fill().map((_, index) => {
            const isTopCard = index === stackLayers - 1;
            const showCardFront = isTopCard && topCard && !topCard.facedown;
            const transforms = {
                x: index * 1,
                y: index * 1.5,
                rotation: (index % 2 === 0) ? -1 : 1,
                zIndex: index + 1
            };
            
            return UIUtils.generateCardLayer(showCardFront ? topCard : null, index, transforms);
        }).join('');

        return UIUtils.generateZoneWrapper(`
            ${UIUtils.generateZoneHeader(config.icon, config.name, deck.length)}
            ${faceUpNotice}
            <div class="relative flex justify-center py-4">
                <div class="deck-cards-stack" onclick="GameActions.drawCard()" title="Click to draw a card">
                    ${stackCards}
                    <div class="deck-click-overlay">
                        <span class="draw-hint">Draw</span>
                    </div>
                </div>
            </div>
        `, 'deck');
    }

    /**
     * Generate graveyard zone with visible cards
     */
    static generateGraveyardZone(graveyard = []) {
        const config = UIConfig.ZONE_CONFIG.graveyard;
        
        if (graveyard.length === 0) {
            return UIUtils.generateZoneWrapper(`
                ${UIUtils.generateZoneHeader(config.icon, config.name, 0)}
                ${UIUtils.generateEmptyZoneContent(config.icon, 'No cards in graveyard')}
            `, 'graveyard');
        }

        const visibleCards = Math.min(config.maxVisible, graveyard.length);
        const cardsToShow = graveyard.slice(-visibleCards).reverse();
        
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

        const moreIndicator = graveyard.length > visibleCards ? 
            `<div class="graveyard-more-indicator">+${graveyard.length - visibleCards} more</div>` : '';

        return UIUtils.generateZoneWrapper(`
            ${UIUtils.generateZoneHeader(config.icon, config.name, graveyard.length)}
            <div class="relative h-72 mt-2 mb-4">
                <div class="graveyard-cards-spread" onclick="ZoneManager.showZoneModal('graveyard')" title="Click to view all cards">
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
        const config = UIConfig.ZONE_CONFIG.exile;
        
        if (exile.length === 0) {
            return UIUtils.generateZoneWrapper(`
                ${UIUtils.generateZoneHeader(config.icon, config.name, 0)}
                ${UIUtils.generateEmptyZoneContent(config.icon, 'No cards in exile')}
            `, 'exile');
        }

        const visibleCards = Math.min(config.maxVisible, exile.length);
        const cardsToShow = exile.slice(-visibleCards);
        
        const gridCards = cardsToShow.map((card, index) => {
            const randomRotation = (Math.random() * 6) - 3; // Between -3 and +3 degrees
            
            return `
                <div class="relative" style="${UIUtils.createTransform(0, 0, randomRotation)}">
                    ${GameCards.renderCardWithLoadingState(card, UIConfig.CSS_CLASSES.card.mini, true, 'exile')}
                </div>
            `;
        }).join('');

        const moreIndicator = exile.length > visibleCards ? 
            `<div class="text-center text-arena-accent mt-2">+${exile.length - visibleCards} more cards</div>` : '';

        return UIUtils.generateZoneWrapper(`
            ${UIUtils.generateZoneHeader(config.icon, config.name, exile.length)}
            <div class="mt-2 mb-4">
                <div class="grid grid-cols-3 gap-2" onclick="ZoneManager.showZoneModal('exile')" title="Click to view all exiled cards">
                    ${gridCards}
                </div>
                ${moreIndicator}
            </div>
        `, 'exile');
    }

    /**
     * Generate life total zone
     */
    static generateLifeZone(life, playerId, titlePrefix) {
        const lifeButtons = UIConfig.LIFE_CONTROLS.map(control => 
            UIUtils.generateButton(
                `GameActions.modifyLife('${playerId}', ${control.value})`,
                UIConfig.CSS_CLASSES.button.life[control.class],
                `${control.value > 0 ? 'Add' : 'Remove'} ${Math.abs(control.value)} life`,
                control.label
            )
        ).join('');

        return UIUtils.generateZoneWrapper(`
            <h5 class="${UIConfig.CSS_CLASSES.zone.title}">${UIConfig.ZONE_CONFIG.life.icon} ${titlePrefix}${UIConfig.ZONE_CONFIG.life.name}</h5>
            <div class="bg-arena-surface/50 rounded-lg p-3 border border-arena-accent/20">
                <div class="text-center">
                    <div class="text-2xl font-bold text-red-400">${life}</div>
                </div>
                <div class="grid grid-cols-4 gap-1 mt-2">
                    ${lifeButtons}
                </div>
            </div>
        `, 'life');
    }

    /**
     * Generate zone preview base template
     */
    static generateZonePreviewBase(zoneConfig, content, clickHandler) {
        return UIUtils.generateZoneWrapper(`
            ${UIUtils.generateZoneHeader(zoneConfig.icon, zoneConfig.name, zoneConfig.count)}
            <div class="flex justify-center">
                <div class="zone-preview-container" id="${zoneConfig.id}">
                    <div class="zone-card-preview" ${clickHandler}>
                        ${content}
                    </div>
                </div>
            </div>
        `, zoneConfig.type);
    }

    /**
     * Generate deck zone preview
     */
    static generateDeckZonePreview(deck, deckId, prefix, titlePrefix, isOpponent) {
        const config = UIConfig.ZONE_CONFIG.deck;
        const zoneConfig = {
            icon: config.icon,
            name: `${titlePrefix}${config.name}`,
            count: deck.length,
            id: deckId,
            type: 'deck'
        };

        const clickHandler = `onclick="ZoneManager.show${isOpponent ? 'Opponent' : ''}ZoneModal('${prefix}deck')" title="Click to view ${isOpponent ? 'opponent\'s' : 'your'} deck"`;
        
        const stackContent = Array(Math.min(3, deck.length > 0 ? 3 : 0)).fill().map((_, index) => {
            const transforms = {
                x: index * 2,
                y: index * 4,
                rotation: 0,
                zIndex: index + 1
            };
            
            return `
                <div class="deck-card-layer" style="${UIUtils.createTransform(transforms.x, transforms.y, transforms.rotation)}">
                    <div class="${UIConfig.CSS_CLASSES.card.backMini}"></div>
                </div>
            `;
        }).join('');

        const content = `<div class="deck-stack">${stackContent}</div>`;

        return this.generateZonePreviewBase(zoneConfig, content, clickHandler);
    }

    /**
     * Generate graveyard zone preview
     */
    static generateGraveyardZonePreview(graveyard, graveyardId, prefix, titlePrefix, isOpponent) {
        const config = UIConfig.ZONE_CONFIG.graveyard;
        const zoneConfig = {
            icon: config.icon,
            name: `${titlePrefix}${config.name}`,
            count: graveyard.length,
            id: graveyardId,
            type: 'graveyard'
        };

        const clickHandler = UIUtils.generateZoneClickHandler(isOpponent, prefix, 'graveyard', 
            `${isOpponent ? 'opponent\'s' : 'your'} graveyard`);
        
        let content;
        if (graveyard.length > 0) {
            const cardsToShow = graveyard.slice(-Math.min(3, graveyard.length)).reverse();
            content = cardsToShow.map((card, index) => {
                const transforms = {
                    x: index * 20,
                    y: index * 5,
                    rotation: (index - 1) * 5,
                    zIndex: 3 - index
                };
                
                return `
                    <div class="graveyard-card-position ${UIConfig.CSS_CLASSES.card.position}" 
                        style="${UIUtils.createTransform(transforms.x, transforms.y, transforms.rotation)}; ${UIUtils.createZIndex(transforms.zIndex)}">
                        ${GameCards.renderCardWithLoadingState(card, UIConfig.CSS_CLASSES.card.mini, true, `${prefix}graveyard`)}
                    </div>
                `;
            }).join('');
        } else {
            content = UIUtils.generateEmptyZone(config.icon, 'Empty');
        }

        return this.generateZonePreviewBase(zoneConfig, content, clickHandler);
    }

    /**
     * Generate exile zone preview
     */
    static generateExileZonePreview(exile, exileId, prefix, titlePrefix, isOpponent) {
        const config = UIConfig.ZONE_CONFIG.exile;
        const zoneConfig = {
            icon: config.icon,
            name: `${titlePrefix}${config.name}`,
            count: exile.length,
            id: exileId,
            type: 'exile'
        };

        const clickHandler = UIUtils.generateZoneClickHandler(isOpponent, prefix, 'exile', 
            `${isOpponent ? 'opponent\'s' : 'your'} exile zone`);
        
        let content;
        if (exile.length > 0) {
            const topCard = exile[exile.length - 1];
            const cardDisplay = GameCards.renderCardWithLoadingState(topCard, UIConfig.CSS_CLASSES.card.mini, true, `${prefix}exile`);
            const countBadge = exile.length > 1 ? 
                `<div class="absolute top-1 right-1 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-semibold">+${exile.length - 1}</div>` : '';
            
            content = `
                <div class="relative">
                    ${cardDisplay}
                    ${countBadge}
                </div>
            `;
        } else {
            content = UIUtils.generateEmptyZone(config.icon, 'Empty');
        }

        return this.generateZonePreviewBase(zoneConfig, content, clickHandler);
    }
}

window.UIZones = UIZones;
