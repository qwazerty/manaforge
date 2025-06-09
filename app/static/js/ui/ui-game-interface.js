/**
 * ManaForge Game Interface Module
 * Contains game UI elements like phases, buttons, and game info
 */

class UIGameInterface {
    /**
     * Generate game info panel
     */
    static generateGameInfo(gameState) {
        const currentTurn = gameState.turn || 1;
        const currentPhase = gameState.phase || 'begin';
        const priorityPlayer = (gameState.priority_player || 0) + 1;

        const phaseDisplay = UIConfig.getPhaseDisplayName(currentPhase);

        return `
            <div class="grid grid-cols-3 gap-4 text-center">
                <div class="bg-yellow-500/20 rounded-lg p-3">
                    <div class="text-yellow-300 font-semibold">Turn</div>
                    <div class="text-2xl font-bold">${currentTurn}</div>
                </div>
                <div class="bg-blue-500/20 rounded-lg p-3">
                    <div class="text-blue-300 font-semibold">Phase</div>
                    <div class="text-lg font-bold">${phaseDisplay}</div>
                </div>
                <div class="bg-purple-500/20 rounded-lg p-3">
                    <div class="text-purple-300 font-semibold">Priority</div>
                    <div class="text-lg font-bold">Player ${priorityPlayer}</div>
                </div>
            </div>
        `;
    }

    /**
     * Generate game phases indicator
     */
    static generateGamePhases(currentPhase) {
        return `
            <div class="mb-4 bg-arena-surface/30 border border-arena-accent/20 rounded-lg p-3">
                <h5 class="text-arena-accent font-semibold mb-3 text-sm text-center">Game Phases</h5>
                <div class="grid grid-cols-5 gap-1">
                    ${UIConfig.GAME_PHASES.map(phase => `
                        <div class="text-center py-2 px-1 rounded transition-all duration-200 ${
                            currentPhase === phase.id ? 
                            'bg-yellow-500/20 border border-yellow-500/40 text-yellow-300' : 
                            'text-arena-text-dim hover:text-arena-text'
                        }" title="${phase.name} Phase">
                            <div class="text-lg mb-1 leading-none">${phase.icon}</div>
                            <div class="text-xs font-medium leading-tight">${phase.name}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Generate game info section
     */
    static generateGameInfoSection(currentTurn, activePlayer) {
        const activePlayerName = activePlayer === 0 ? 'Player 1' : 'Player 2';
        
        return `
            <div class="grid grid-cols-2 gap-2 mb-4">
                <!-- Turn Block -->
                <div class="text-center">
                    <div class="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
                        <div class="text-blue-300 font-semibold text-sm">Turn</div>
                        <div class="text-lg font-bold text-arena-accent">${currentTurn}</div>
                    </div>
                </div>
                <!-- Active Player Block -->
                <div class="text-center">
                    <div class="bg-yellow-500/20 rounded-lg p-3 border border-yellow-500/30">
                        <div class="text-yellow-300 font-semibold text-sm">Active</div>
                        <div class="text-lg font-bold text-arena-accent">${activePlayerName}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate action buttons section
     */
    static generateActionButtonsSection() {
        const passPhaseBtn = UIUtils.generateButton(
            "GameActions.performGameAction('pass_phase')",
            UIConfig.CSS_CLASSES.button.primary,
            "Pass current phase",
            "⏭️ Pass Phase"
        );

        const untapBtn = UIUtils.generateButton(
            "GameActions.performGameAction('untap_all')",
            UIConfig.CSS_CLASSES.button.secondary,
            "Untap all permanents",
            "🔄 Untap all"
        );

        const passTurnBtn = UIUtils.generateButton(
            "GameActions.performGameAction('pass_turn')",
            UIConfig.CSS_CLASSES.button.secondary,
            "Pass turn to opponent",
            "⏸️ Pass Turn"
        );

        return `
            <div class="flex items-center mb-3">
                ${passPhaseBtn}
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                ${untapBtn}
                ${passTurnBtn}
            </div>
        `;
    }

    /**
     * Generate action buttons for active player
     */
    static generateActionButtons() {
        // Get current phase from game state
        const gameState = GameCore.getGameState();
        const currentPhase = gameState?.phase || 'begin';
        const currentTurn = gameState?.turn || 1;
        const activePlayer = gameState?.active_player || 0;
        
        return `
            <div>
                <!-- Game Info Section -->
                ${this.generateGameInfoSection(currentTurn, activePlayer)}
                
                <!-- Game Phases Indicator -->
                ${this.generateGamePhases(currentPhase)}
                
                <!-- Action Buttons -->
                ${this.generateActionButtonsSection()}
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
     * Generate battlefield zone
     */
    static generateBattlefieldZone(cards, zoneName, title, icon, playerId = null) {
        const filteredCards = UIUtils.filterCardsByType(cards, zoneName);
        const cardsHtml = filteredCards.length > 0 
            ? filteredCards.map((card, index) => GameCards.renderCardWithLoadingState(card, 'card-battlefield', true, zoneName, index, playerId)).join('')
            : `<div class="zone-empty">No ${title.toLowerCase()}</div>`;

        return `
            <div class="battlefield-zone ${zoneName}-zone">
                <h5>${icon} ${title}</h5>
                <div class="flex justify-center zone-content">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Generate player's hand
     */
    static generatePlayerHand(hand = [], playerId = null) {
        if (hand.length === 0) {
            return '<div class="text-arena-text-dim text-center py-4">No cards in hand</div>';
        }

        return hand.map((card, index) => 
            GameCards.renderCardWithLoadingState(card, UIConfig.CSS_CLASSES.card.mini, false, 'hand', index, playerId)
        ).join('');
    }

    /**
     * Generate opponent's hidden hand
     */
    static generateOpponentHand(handSize = 7) {
        return Array(handSize).fill().map((_, index) => `
            <div class="${UIConfig.CSS_CLASSES.card.back}" 
                 data-card-id="opponent-card-${index}" 
                 style="width: 60px; height: 84px; ${UIUtils.createTransform(0, 0, index % 2 === 0 ? -2 : 2)}">
            </div>
        `).join('');
    }
}

window.UIGameInterface = UIGameInterface;
