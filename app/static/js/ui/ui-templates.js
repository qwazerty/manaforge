/**
 * ManaForge UI Templates Module
 * Contains HTML template generation functions
 */

class UITemplates {
    /**
     * Generate player info section
     */
    static generatePlayerInfo(player, playerIndex, isActive = false, isOpponent = false) {
        const playerName = player?.name || (isOpponent ? 'Opponent' : 'You');
        const life = player?.life || 20;
        const handSize = player?.hand?.length || 7;
        const librarySize = player?.library?.length || 53;
        const colorClass = playerIndex === 0 ? 'text-green-400' : 'text-red-400';
        
        return `
            <div class="text-center mb-4">
                <h3 class="font-magic text-xl font-bold ${colorClass}">
                    ${playerName}
                    ${isActive ? '⭐ (Active)' : ''}
                </h3>
                <div class="flex justify-center space-x-4 text-sm">
                    <span class="text-red-400">❤️ ${life} Life</span>
                    <span class="text-blue-400">🃏 ${handSize} Cards</span>
                    <span class="text-gray-400">📚 ${librarySize} Library</span>
                </div>
            </div>
        `;
    }

    /**
     * Generate opponent's hidden hand
     */
    static generateOpponentHand(handSize = 7) {
        return Array(handSize).fill().map((_, index) => `
            <div class="card-back" 
                 data-card-id="opponent-card-${index}" 
                 style="width: 60px; height: 84px; transform: ${index % 2 === 0 ? 'rotate(-2deg)' : 'rotate(2deg)'}">
            </div>
        `).join('');
    }

    /**
     * Generate battlefield zone
     */
    static generateBattlefieldZone(cards, zoneName, title, icon) {
        const filteredCards = this.filterCardsByType(cards, zoneName);
        const cardsHtml = filteredCards.length > 0 
            ? filteredCards.map(card => GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, zoneName)).join('')
            : `<div class="zone-empty">No ${title.toLowerCase()}</div>`;

        return `
            <div class="battlefield-zone ${zoneName}-zone">
                <h5>${icon} ${title}</h5>
                <div class="zone-content">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Generate player's hand
     */
    static generatePlayerHand(hand = []) {
        if (hand.length === 0) {
            return '<div class="text-arena-text-dim text-center py-4">No cards in hand</div>';
        }

        return hand.map((card, index) => {
            const cardHtml = GameCards.renderCardWithLoadingState(card, 'card-mini', false, 'hand');
            const escapedCardId = GameUtils.escapeJavaScript(card.id || card.name);
            return `<div onclick="GameActions.playCardFromHand('${escapedCardId}', ${index})">${cardHtml}</div>`;
        }).join('');
    }

    /**
     * Generate game info panel
     */
    static generateGameInfo(gameState) {
        const currentTurn = gameState.turn || 1;
        const currentPhase = gameState.phase || 'untap';
        const priorityPlayer = (gameState.priority_player || 0) + 1;

        return `
            <div class="grid grid-cols-3 gap-4 text-center">
                <div class="bg-yellow-500/20 rounded-lg p-3">
                    <div class="text-yellow-300 font-semibold">Turn</div>
                    <div class="text-2xl font-bold">${currentTurn}</div>
                </div>
                <div class="bg-blue-500/20 rounded-lg p-3">
                    <div class="text-blue-300 font-semibold">Phase</div>
                    <div class="text-lg font-bold capitalize">${currentPhase}</div>
                </div>
                <div class="bg-purple-500/20 rounded-lg p-3">
                    <div class="text-purple-300 font-semibold">Priority</div>
                    <div class="text-lg font-bold">Player ${priorityPlayer}</div>
                </div>
            </div>
        `;
    }

    /**
     * Generate action buttons for active player
     */
    static generateActionButtons() {
        return `
            <div class="space-y-3 mb-6">
                <button onclick="GameActions.performGameAction('pass_phase')" 
                        class="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500 text-blue-300 hover:text-blue-200 py-3 rounded-lg font-semibold transition-all duration-200">
                    ⏭️ Pass Phase
                </button>
                <button onclick="GameActions.performGameAction('draw_card')" 
                        class="w-full bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-500 text-green-300 hover:text-green-200 py-3 rounded-lg font-semibold transition-all duration-200">
                    🃏 Draw Card
                </button>
            </div>
            <div class="border-t border-arena-accent/30 pt-4">
                <h5 class="text-arena-accent font-semibold mb-3">Quick Actions</h5>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <button onclick="GameActions.performGameAction('untap_all')" 
                            class="bg-arena-surface hover:bg-arena-surface-light border border-arena-accent/30 hover:border-arena-accent/50 text-arena-text py-2 rounded">
                        🔄 Untap All
                    </button>
                    <button onclick="GameActions.performGameAction('end_turn')" 
                            class="bg-arena-surface hover:bg-arena-surface-light border border-arena-accent/30 hover:border-arena-accent/50 text-arena-text py-2 rounded">
                        ⏸️ End Turn
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Generate spectator view
     */
    static generateSpectatorView() {
        return `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">👁️</div>
                <h5 class="text-arena-accent font-semibold mb-2">Spectator Mode</h5>
                <p class="text-arena-text-dim text-sm">You are watching the battle unfold</p>
            </div>
        `;
    }

    /**
     * Generate error template
     */
    static generateErrorTemplate(title, message) {
        return `
            <div class="arena-card rounded-xl p-6 text-center">
                <h3 class="text-red-400 font-bold mb-2">⚠️ ${title}</h3>
                <p class="text-arena-text-dim">${message}</p>
            </div>
        `;
    }

    /**
     * Filter cards by type for battlefield zones
     */
    static filterCardsByType(cards, zoneName) {
        if (!cards || !Array.isArray(cards)) return [];
        
        if (zoneName === 'lands' || zoneName === 'land') {
            return cards.filter(card => 
                card.card_type === 'land' || card.card_type === 'LAND'
            );
        } else if (zoneName === 'permanents') {
            return cards.filter(card => 
                card.card_type !== 'land' && card.card_type !== 'LAND'
            );
        }
        return cards;
    }

    /**
     * Generate deck zone with clickable cards for drawing
     */
    static generateDeckZone(deck = []) {
        if (deck.length === 0) {
            return `
                <div class="zone-display deck-zone">
                    <h5 class="zone-title">📖 Deck (0)</h5>
                    <div class="zone-empty">
                        <div class="text-arena-text-dim text-center py-4">Deck is empty</div>
                    </div>
                </div>
            `;
        }

        // For the deck zone, we'll show a stack of cards with the top card visible if available
        const topCard = deck.length > 0 ? deck[deck.length - 1] : null;
        const stackLayers = Math.min(5, deck.length); // Show up to 5 layers for stack effect
        
        // Show a notice if any of the cards are face up (for debugging)
        const faceUpNotice = topCard && !topCard.facedown ? 
            `<div class="text-xs text-arena-accent mt-2 mb-1">Top card visible (Debug mode)</div>` : '';
        
        return `
            <div class="zone-display deck-zone">
                <h5 class="zone-title">📖 Deck (${deck.length})</h5>
                ${faceUpNotice}
                <div class="relative flex justify-center py-4">
                    <div class="deck-cards-stack" onclick="GameActions.drawCard()" title="Click to draw a card">
                        ${Array(stackLayers).fill().map((_, index) => {
                            // For all cards except maybe the top one, show card backs
                            const isTopCard = index === stackLayers - 1;
                            const showCardFront = isTopCard && topCard && !topCard.facedown;
                            const zIndex = index + 1;
                            const translateY = index * 1.5;
                            const translateX = index * 1;
                            const rotationDeg = (index % 2 === 0) ? -1 : 1; // Slight alternating rotation
                            
                            if (showCardFront) {
                                return `
                                    <div class="deck-card-layer absolute" 
                                        style="z-index: ${zIndex}; transform: translateY(${translateY}px) translateX(${translateX}px) rotate(${rotationDeg}deg)">
                                        ${GameCards.renderCardWithLoadingState(topCard, 'card-mini', true, 'deck')}
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="deck-card-layer absolute" 
                                        style="z-index: ${zIndex}; transform: translateY(${translateY}px) translateX(${translateX}px) rotate(${rotationDeg}deg)">
                                        <div class="card-back-mini"></div>
                                    </div>
                                `;
                            }
                        }).join('')}
                        <div class="deck-click-overlay">
                            <span class="draw-hint">🎴 Draw</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate graveyard zone with visible cards
     */
    static generateGraveyardZone(graveyard = []) {
        if (graveyard.length === 0) {
            return `
                <div class="zone-display graveyard-zone">
                    <h5 class="zone-title">⚰️ Graveyard (0)</h5>
                    <div class="zone-empty">
                        <div class="text-arena-text-dim text-center py-4">No cards in graveyard</div>
                    </div>
                </div>
            `;
        }

        // Show the top cards in a spread pattern (up to 5 most recent cards)
        const visibleCards = Math.min(5, graveyard.length);
        const cardsToShow = graveyard.slice(-visibleCards).reverse(); // Most recent cards first
        
        return `
            <div class="zone-display graveyard-zone">
                <h5 class="zone-title">⚰️ Graveyard (${graveyard.length})</h5>
                <div class="relative h-72 mt-2 mb-4">
                    <div class="graveyard-cards-spread" onclick="ZoneManager.showZoneModal('graveyard')" title="Click to view all cards">
                        ${cardsToShow.map((card, index) => {
                            const zIndex = visibleCards - index;
                            const xOffset = index * 30;
                            const yOffset = index * 10;
                            const rotation = (index - visibleCards / 2) * 5;
                            
                            return `
                                <div class="graveyard-card-position absolute" 
                                     style="z-index: ${zIndex}; transform: translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg)">
                                    ${GameCards.renderCardWithLoadingState(card, 'card-mini', true, 'graveyard')}
                                </div>
                            `;
                        }).join('')}
                        ${graveyard.length > visibleCards ? `
                            <div class="graveyard-more-indicator">+${graveyard.length - visibleCards} more</div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate exile zone with visible cards
     */
    static generateExileZone(exile = []) {
        if (exile.length === 0) {
            return `
                <div class="zone-display exile-zone">
                    <h5 class="zone-title">🌌 Exile (0)</h5>
                    <div class="zone-empty">
                        <div class="text-arena-text-dim text-center py-4">No cards in exile</div>
                    </div>
                </div>
            `;
        }

        // Show multiple cards spread out in exile - grid pattern
        const visibleCards = Math.min(6, exile.length); // Show up to 6 most recent cards
        const cardsToShow = exile.slice(-visibleCards); // Show the most recent cards
        
        return `
            <div class="zone-display exile-zone">
                <h5 class="zone-title">🌌 Exile (${exile.length})</h5>
                <div class="mt-2 mb-4">
                    <div class="grid grid-cols-3 gap-2" onclick="ZoneManager.showZoneModal('exile')" title="Click to view all exiled cards">
                        ${cardsToShow.map((card, index) => {
                            // Apply a subtle random rotation to each card for a more natural look
                            const randomRotation = (Math.random() * 6) - 3; // Between -3 and +3 degrees
                            
                            return `
                                <div class="relative" style="transform: rotate(${randomRotation}deg)">
                                    ${GameCards.renderCardWithLoadingState(card, 'card-mini', true, 'exile')}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${exile.length > visibleCards ? `
                        <div class="text-center text-arena-accent mt-2">+${exile.length - visibleCards} more cards</div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Generate combined card zones display
     */
    static generateCardZones(playerData) {
        const deck = playerData?.deck || [];
        const graveyard = playerData?.graveyard || [];
        const exile = playerData?.exile || [];

        return `
            <div class="card-zones-container">
                ${this.generateDeckZone(deck)}
                ${this.generateGraveyardZone(graveyard)}
                ${this.generateExileZone(exile)}
            </div>
        `;
    }
}

window.UITemplates = UITemplates;
