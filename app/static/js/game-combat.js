/**
 * ManaForge Game Combat Module
 * Handles combat phase mechanics including declaring attackers and blockers
 * 
 * Combat flow:
 * 2. Main Phase 1
 * 3. Combat Phase - Attack Step (active player declares attackers)
 * 4. Combat Phase - Defense Step (defending player declares blockers)
 * 5. Main Phase 2
 * 6. End Phase
 */

const GameCombat = {
    // Combat state
    attackers: new Set(),
    blockers: new Map(), // Map of blocker unique_id -> attacker unique_id
    combatMode: null, // 'declaring_attackers' or 'declaring_blockers'
    selectedBlocker: null,
    uiRefreshHandle: null,
    
    /**
     * Check if a card has vigilance
     */
    hasVigilance(card) {
        if (!card) return false;
        const text = (card.text || '').toLowerCase();
        return text.includes('vigilance');
    },
    
    /**
     * Determine what combat step we're in based on game state
     * Returns: 'attackers', 'blockers', or 'none'
     */
    getCombatStep() {
        const gameState = GameCore.getGameState();
        
        // Not in combat phase at all
        if (!gameState || gameState.phase !== 'combat') {
            return 'none';
        }
        
        const currentPlayer = GameCore.getSelectedPlayer();
        const activePlayerIndex = gameState.active_player || 0;
        const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
        const isActivePlayer = currentPlayerIndex === activePlayerIndex;
        const combatState = gameState.combat_state || {};
        const combatStep = combatState.step || 'none';
        const expectedPlayer = combatState.expected_player || null;
        
        // Check if attackers have been declared
        const players = gameState.players || [];
        const activePlayerData = players[activePlayerIndex];
        const hasAttackers = activePlayerData?.battlefield?.some(card => card.attacking) || false;
        
        console.log('🎯 Combat Step Check:', {
            phase: gameState.phase,
            isActivePlayer,
            hasAttackers,
            combatStep,
            expectedPlayer,
            activePlayerIndex,
            currentPlayerIndex
        });
        
        if (combatStep && combatStep !== 'none') {
            if (combatStep === 'declare_attackers') {
                if (!expectedPlayer || expectedPlayer === currentPlayer) {
                    return 'attackers';
                }
                return 'none';
            }
            if (combatStep === 'declare_blockers') {
                if (expectedPlayer === currentPlayer) {
                    return 'blockers';
                }
                return 'none';
            }
            return 'none';
        }
        
        // If no attackers declared yet -> Attack Step (active player declares)
        if (!hasAttackers) {
            return isActivePlayer ? 'attackers' : 'none';
        }
        
        // If attackers declared -> Defense Step (defending player declares blockers)
        if (hasAttackers) {
            return !isActivePlayer ? 'blockers' : 'none';
        }
        
        return 'none';
    },
    
    /**
     * Start the Attack Step - active player declares attackers
     */
    startAttackStep() {
        console.log('⚔️ Starting Attack Step');
        
        const gameState = GameCore.getGameState();
        if (!gameState || gameState.phase !== 'combat') {
            console.log('❌ Not in combat phase');
            return;
        }
        
        const currentPlayer = GameCore.getSelectedPlayer();
        const activePlayerIndex = gameState.active_player || 0;
        const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
        const combatState = gameState.combat_state || {};
        if (combatState.expected_player && combatState.expected_player !== currentPlayer) {
            console.log('❌ Not the expected player for declare attackers');
            return;
        }
        if (combatState.step && combatState.step !== 'declare_attackers' && combatState.step !== 'none') {
            console.log(`⚠️ Combat state is ${combatState.step}, skipping attacker mode`);
            return;
        }
        
        if (currentPlayerIndex !== activePlayerIndex) {
            console.log('❌ Not the active player');
            return;
        }
        
        this.combatMode = 'declaring_attackers';
        this.attackers.clear();
        if (Array.isArray(combatState.pending_attackers) && combatState.pending_attackers.length) {
            this.attackers = new Set(combatState.pending_attackers);
            setTimeout(() => this.applyPendingAttackerVisuals(combatState.pending_attackers), 50);
        }
        this.highlightValidAttackers();
        GameUI.showNotification('Select creatures to attack, then confirm', 'info');
    },
    
    /**
     * Start the Defense Step - defending player declares blockers
     */
    startDefenseStep() {
        console.log('🛡️ Starting Defense Step');
        
        const gameState = GameCore.getGameState();
        if (!gameState || gameState.phase !== 'combat') {
            console.log('❌ Not in combat phase');
            return;
        }
        
        const currentPlayer = GameCore.getSelectedPlayer();
        const activePlayerIndex = gameState.active_player || 0;
        const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
        const combatState = gameState.combat_state || {};
        if (combatState.expected_player && combatState.expected_player !== currentPlayer) {
            console.log('❌ Not the expected player for declare blockers');
            return;
        }
        if (combatState.step && combatState.step !== 'declare_blockers') {
            console.log(`⚠️ Combat state is ${combatState.step}, skipping blocker mode`);
            return;
        }
        
        if (currentPlayerIndex === activePlayerIndex) {
            console.log('❌ Active player cannot block');
            return;
        }
        
        // Check if there are attackers
        const players = gameState.players || [];
        const activePlayerData = players[activePlayerIndex];
        const attackingCreatures = activePlayerData?.battlefield?.filter(card => card.attacking) || [];
        
        this.combatMode = 'declaring_blockers';
        this.blockers.clear();
        this.selectedBlocker = null;
        if (combatState.pending_blockers && Object.keys(combatState.pending_blockers).length > 0) {
            this.blockers = new Map(Object.entries(combatState.pending_blockers));
            setTimeout(() => this.applyPendingBlockerVisuals(combatState.pending_blockers), 50);
        }
        
        if (attackingCreatures.length === 0) {
            GameUI.showNotification('No attackers - click Confirm to continue', 'info');
        } else {
            this.highlightValidBlockers();
            this.highlightAttackers();
            GameUI.showNotification('Click blocker, then attacker to assign', 'info');
        }
    },
    
    /**
     * Toggle a creature as an attacker
     */
    toggleAttacker(uniqueId) {
        if (this.combatMode !== 'declaring_attackers') return;
        
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
        if (!cardElement) return;
        
        // Check if creature can attack (not tapped, not have defender, etc.)
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const cardData = this.getCardData(uniqueId);
        
        if (isTapped && !this.hasVigilance(cardData)) {
            GameUI.showNotification('Cannot attack with tapped creature', 'error');
            return;
        }
        
        // Check for defender ability
        const hasDefender = (cardData?.text || '').toLowerCase().includes('defender');
        if (hasDefender) {
            GameUI.showNotification('Creature with Defender cannot attack', 'error');
            return;
        }
        
        // Toggle attacker status
        if (this.attackers.has(uniqueId)) {
            this.attackers.delete(uniqueId);
            cardElement.classList.remove('attacking-creature');
            cardElement.style.transform = '';
        } else {
            this.attackers.add(uniqueId);
            cardElement.classList.add('attacking-creature');
            
            // Move creature forward (add visual effect)
            cardElement.style.transform = 'translateY(-20px)';
        }
        
        this.updateCombatUI();
        this.syncPendingAttackers();
    },
    
    /**
     * Confirm attackers - end Attack Step and move to Defense Step
     */
    confirmAttackers() {
        console.log('=== CONFIRM ATTACKERS ===');
        
        const gameState = GameCore.getGameState();
        if (!gameState || gameState.phase !== 'combat') {
            console.log('❌ Not in combat phase');
            GameUI.showNotification('Not in combat phase', 'error');
            return;
        }
        const combatState = gameState.combat_state || {};
        if (combatState.step && combatState.step !== 'declare_attackers') {
            console.log(`⚠️ Cannot confirm attackers during ${combatState.step}`);
            GameUI.showNotification('Waiting for combat progression', 'warning');
            return;
        }
        
        const attackingCreatures = Array.from(this.attackers);
        console.log(`⚔️ Declaring ${attackingCreatures.length} attackers:`, attackingCreatures);
        
        // Send declare_attackers action
        GameActions.performGameAction('declare_attackers', {
            attacking_creatures: attackingCreatures
        });
        
        attackingCreatures.forEach(uniqueId => {
            const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
            if (cardElement) {
                const cardData = this.getCardData(uniqueId);
                const hasVigilance = this.hasVigilance(cardData);
                cardElement.setAttribute('data-card-tapped', hasVigilance ? 'false' : 'true');
                if (!hasVigilance) {
                    cardElement.classList.add('combat-tapped');
                    cardElement.style.transform = 'translateY(-20px) rotate(90deg)';
                } else {
                    cardElement.classList.remove('combat-tapped');
                    cardElement.style.transform = 'translateY(-20px)';
                }
            }
        });

        // Pass priority to defending player
        setTimeout(() => {
            console.log('🔄 Passing priority for Defense Step');
            GameActions.performGameAction('pass_priority');
        }, 100);
        
        this.combatMode = null;
        this.clearHighlights();
        
        const count = attackingCreatures.length;
        GameUI.showNotification(
            count === 0 ? 'No attackers declared' : `${count} attacker(s) declared`,
            'info'
        );
    },
    
    /**
     * Confirm blockers - end Defense Step and continue combat
     */
    confirmBlockers() {
        console.log('=== CONFIRM BLOCKERS ===');
        
        const gameState = GameCore.getGameState();
        if (!gameState || gameState.phase !== 'combat') {
            console.log('❌ Not in combat phase');
            GameUI.showNotification('Not in combat phase', 'error');
            return;
        }
        const combatState = gameState.combat_state || {};
        if (combatState.step && combatState.step !== 'declare_blockers') {
            console.log(`⚠️ Cannot confirm blockers during ${combatState.step}`);
            GameUI.showNotification('Waiting for combat progression', 'warning');
            return;
        }
        
        const blockingAssignments = Object.fromEntries(this.blockers);
        console.log(`🛡️ Declaring ${this.blockers.size} blockers:`, blockingAssignments);
        
        // Send declare_blockers action
        GameActions.performGameAction('declare_blockers', {
            blocking_assignments: blockingAssignments
        });
        
        // Pass priority to continue (will move to next phase)
        setTimeout(() => {
            console.log('🔄 Passing priority to end Combat Phase');
            GameActions.performGameAction('pass_priority');
        }, 100);
        
        this.combatMode = null;
        this.clearHighlights();
        this.clearArrows();
        
        const count = this.blockers.size;
        GameUI.showNotification(
            count === 0 ? 'No blockers declared' : `${count} blocker(s) declared`,
            'info'
        );
    },
    
    
    /**
     * Toggle blocker selection or assign to attacker when in blocker mode
     */
    toggleBlocker(uniqueId) {
        if (this.combatMode !== 'declaring_blockers') return;

        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
        if (!cardElement) return;

        const cardData = this.getCardData(uniqueId);
        if (!cardData) return;

        const currentPlayerId = GameCore.getSelectedPlayer();

        if (cardData.owner_id === currentPlayerId) {
            if (!cardElement.classList.contains('can-block')) {
                GameUI.showNotification('Cannot block with this creature', 'error');
                return;
            }

            if (this.selectedBlocker === uniqueId) {
                cardElement.classList.remove('selected-blocker');
                this.selectedBlocker = null;
                return;
            }

            this.selectBlocker(uniqueId);
            return;
        }

        if (!cardElement.classList.contains('is-attacker')) {
            GameUI.showNotification('Select a blocker, then click an attacker to assign', 'info');
            return;
        }

        this.assignBlocker(uniqueId);
    },

    /**
     * Handle clicking on a potential blocker
     */
    selectBlocker(uniqueId) {
        if (this.combatMode !== 'declaring_blockers') return;
        
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
        if (!cardElement) return;
        
        // Check if creature can block (not tapped)
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        if (isTapped) {
            GameUI.showNotification('Cannot block with tapped creature', 'error');
            return;
        }
        
        // Clear previous selection
        document.querySelectorAll('.selected-blocker').forEach(el => {
            el.classList.remove('selected-blocker');
        });
        
        this.selectedBlocker = uniqueId;
        cardElement.classList.add('selected-blocker');
        GameUI.showNotification('Now click an attacker to block', 'info');
    },
    
    /**
     * Handle clicking on an attacker to assign a blocker
     */
    assignBlocker(attackerUniqueId) {
        if (this.combatMode !== 'declaring_blockers') return;
        if (!this.selectedBlocker) {
            GameUI.showNotification('Select a blocker first', 'warning');
            return;
        }
        
        // Assign blocker to attacker
    this.blockers.set(this.selectedBlocker, attackerUniqueId);
        
    // Draw arrow from blocker to attacker immediately for previews
    this.drawBlockingArrow(this.selectedBlocker, attackerUniqueId);
    this.syncPendingBlockers();
        
        // Clear selection
        document.querySelectorAll('.selected-blocker').forEach(el => {
            el.classList.remove('selected-blocker');
        });
        
        const blockerCard = document.querySelector(`[data-card-unique-id="${this.selectedBlocker}"]`);
        if (blockerCard) {
            blockerCard.classList.add('blocking-creature');
        }
        
    this.selectedBlocker = null;
    this.updateCombatUI();
    },

    updateCombatUI() {
        if (!window.GameUI || typeof window.GameUI.generateActionPanel !== 'function') {
            return;
        }

        if (this.uiRefreshHandle) {
            clearTimeout(this.uiRefreshHandle);
        }

        this.uiRefreshHandle = setTimeout(() => {
            try {
                window.GameUI.generateActionPanel();
            } catch (error) {
                console.error('Combat UI refresh failed:', error);
            }
        }, 75);
    },

    syncPendingAttackers() {
        const websocket = window.websocket;
        const gameState = GameCore.getGameState();
        const combatState = gameState?.combat_state || {};
        const currentPlayer = GameCore.getSelectedPlayer();

        if (combatState.step && combatState.step !== 'declare_attackers') {
            return;
        }

        if (combatState.expected_player && combatState.expected_player !== currentPlayer) {
            return;
        }

        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (!window.GameSocket || typeof window.GameSocket.sendGameAction !== 'function') {
            return;
        }

        window.GameSocket.sendGameAction('preview_attackers', {
            attacking_creatures: Array.from(this.attackers)
        });
    },

    syncPendingBlockers() {
        const websocket = window.websocket;
        const gameState = GameCore.getGameState();
        const combatState = gameState?.combat_state || {};
        const currentPlayer = GameCore.getSelectedPlayer();

        if (combatState.step !== 'declare_blockers') {
            return;
        }

        if (combatState.expected_player && combatState.expected_player !== currentPlayer) {
            return;
        }

        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (!window.GameSocket || typeof window.GameSocket.sendGameAction !== 'function') {
            return;
        }

        const blockingAssignments = Object.fromEntries(this.blockers);
        window.GameSocket.sendGameAction('preview_blockers', {
            blocking_assignments: blockingAssignments
        });
    },

    applyPendingAttackerVisuals(pendingAttackers) {
        if (!Array.isArray(pendingAttackers)) return;
        pendingAttackers.forEach(uniqueId => {
            const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
            if (!cardElement) return;
            cardElement.classList.add('attacking-creature');
            cardElement.style.transform = 'translateY(-20px)';
        });
    },

    applyPendingBlockerVisuals(pendingAssignments) {
        if (!pendingAssignments || typeof pendingAssignments !== 'object') return;
        this.clearArrows();
        Object.entries(pendingAssignments).forEach(([blockerId, attackerId]) => {
            const blockerElement = document.querySelector(`[data-card-unique-id="${blockerId}"]`);
            if (blockerElement) {
                blockerElement.classList.add('blocking-creature');
            }
            if (attackerId && typeof this.drawBlockingArrow === 'function') {
                this.drawBlockingArrow(blockerId, attackerId);
            }
        });
    },
    
    /**
     * Cancel current combat action
     */
    cancelCombat() {
        // Clear attacker visuals
        this.attackers.forEach(uniqueId => {
            const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
            if (cardElement) {
                cardElement.classList.remove('attacking-creature');
                cardElement.style.transform = '';
            }
        });
        
        this.attackers.clear();
        this.blockers.clear();
        this.combatMode = null;
        this.clearHighlights();
        this.clearArrows();
        this.syncPendingAttackers();
        this.syncPendingBlockers();
        GameUI.showNotification('Combat action cancelled', 'info');
    },
    
    /**
     * Get combat button configuration based on current state
     */
    /**
     * Get button configuration for combat UI
     */
    getCombatButtonConfig() {
        const combatStep = this.getCombatStep();
        
        if (combatStep === 'attackers') {
            return {
                label: '⚔️ Confirm Attackers',
                action: 'declare_attackers',
                title: 'Confirm your attacking creatures',
                enabled: true
            };
        }
        
        if (combatStep === 'blockers') {
            return {
                label: '🛡️ Confirm Blockers',
                action: 'declare_blockers',
                title: 'Confirm your blocking creatures',
                enabled: true
            };
        }
        
        return null;
    },
    
    /**
     * Highlight valid attackers (untapped creatures or creatures with vigilance)
     */
    highlightValidAttackers() {
        const gameState = GameCore.getGameState();
        if (!gameState) return;
        
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) return;
        
        currentPlayer.battlefield.forEach(card => {
            if (card.card_type === 'creature') {
                const cardElement = document.querySelector(`[data-card-unique-id="${card.unique_id}"]`);
                if (cardElement) {
                    const isTapped = card.tapped;
                    const hasVigilance = this.hasVigilance(card);
                    const hasDefender = (card.text || '').toLowerCase().includes('defender');
                    
                    if ((!isTapped || hasVigilance) && !hasDefender) {
                        cardElement.classList.add('can-attack');
                    }
                }
            }
        });
    },
    
    /**
     * Highlight valid blockers (untapped creatures)
     */
    highlightValidBlockers() {
        const gameState = GameCore.getGameState();
        if (!gameState) return;
        
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) return;
        
        currentPlayer.battlefield.forEach(card => {
            if (card.card_type === 'creature' && !card.tapped) {
                const cardElement = document.querySelector(`[data-card-unique-id="${card.unique_id}"]`);
                if (cardElement) {
                    cardElement.classList.add('can-block');
                }
            }
        });
    },
    
    /**
     * Highlight attacking creatures
     */
    highlightAttackers() {
        const opponentPlayer = this.getOpponentPlayer();
        if (!opponentPlayer) return;
        
        opponentPlayer.battlefield.forEach(card => {
            if (card.attacking) {
                const cardElement = document.querySelector(`[data-card-unique-id="${card.unique_id}"]`);
                if (cardElement) {
                    cardElement.classList.add('is-attacker');
                }
            }
        });
    },
    
    /**
     * Clear all combat highlights
     */
    clearHighlights() {
        document.querySelectorAll('.can-attack, .can-block, .is-attacker, .attacking-creature, .blocking-creature, .selected-blocker').forEach(el => {
            el.classList.remove('can-attack', 'can-block', 'is-attacker', 'attacking-creature', 'blocking-creature', 'selected-blocker');
        });
        
        // Clear transform on attacking creatures
        document.querySelectorAll('[style*="translateY"]').forEach(el => {
            if (!el.classList.contains('combat-tapped')) {
                el.style.transform = '';
            }
        });
    },
    
    /**
     * Draw an arrow from blocker to attacker
     */
    drawBlockingArrow(blockerUniqueId, attackerUniqueId) {
        const blocker = document.querySelector(`[data-card-unique-id="${blockerUniqueId}"]`);
        const attacker = document.querySelector(`[data-card-unique-id="${attackerUniqueId}"]`);
        
        if (!blocker || !attacker) return;
        
        // Create arrow element
        const arrow = document.createElement('div');
        arrow.className = 'blocking-arrow';
        arrow.dataset.blocker = blockerUniqueId;
        arrow.dataset.attacker = attackerUniqueId;
        
        // Calculate positions
        const blockerRect = blocker.getBoundingClientRect();
        const attackerRect = attacker.getBoundingClientRect();
        
        const startX = blockerRect.left + blockerRect.width / 2;
        const startY = blockerRect.top + blockerRect.height / 2;
        const endX = attackerRect.left + attackerRect.width / 2;
        const endY = attackerRect.top + attackerRect.height / 2;
        
        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
        
        arrow.style.width = `${length}px`;
        arrow.style.left = `${startX}px`;
        arrow.style.top = `${startY}px`;
        arrow.style.transform = `rotate(${angle}deg)`;
        arrow.style.transformOrigin = '0 0';
        
        document.body.appendChild(arrow);
    },
    
    /**
     * Clear all blocking arrows
     */
    clearArrows() {
        document.querySelectorAll('.blocking-arrow').forEach(arrow => arrow.remove());
    },
    
    /**
     * Handle phase change to combat
     */
    /**
     * Handle phase changes
     */
    onPhaseChange(newPhase) {
        console.log(`🔄 Phase changed to: ${newPhase}`);
        
        if (newPhase === 'combat') {
            // Entering Combat Phase - start Attack Step for active player
            const gameState = GameCore.getGameState();
            if (!gameState) return;
            
            const currentPlayer = GameCore.getSelectedPlayer();
            const activePlayerIndex = gameState.active_player || 0;
            const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
            const isActivePlayer = currentPlayerIndex === activePlayerIndex;
            
            if (isActivePlayer) {
                console.log('⚔️ Active player - starting Attack Step');
                setTimeout(() => this.startAttackStep(), 100);
            } else {
                console.log('👁️ Waiting for opponent to declare attackers');
                GameUI.showNotification('Opponent is declaring attackers...', 'info');
            }
        } else {
            // Leaving Combat Phase - clean up
            console.log('🧹 Cleaning up combat state');
            this.combatMode = null;
            this.attackers.clear();
            this.blockers.clear();
            this.clearHighlights();
            this.clearArrows();
            document.querySelectorAll('.combat-tapped').forEach(el => {
                el.classList.remove('combat-tapped');
                el.style.transform = '';
            });
            
            // Force re-render to remove combat animations
            if (window.GameUI && typeof window.GameUI.refreshGameState === 'function') {
                setTimeout(() => {
                    console.log('♻️ Re-rendering cards to remove combat animations');
                    window.GameUI.refreshGameState();
                }, 100);
            }
        }
    },
    
    /**
     * Get current player
     */
    getCurrentPlayer() {
        const gameState = GameCore.getGameState();
        if (!gameState) return null;
        
        const currentPlayer = GameCore.getSelectedPlayer();
        const playerIndex = currentPlayer === 'player2' ? 1 : 0;
        return gameState.players[playerIndex];
    },
    
    /**
     * Get opponent player
     */
    getOpponentPlayer() {
        const gameState = GameCore.getGameState();
        if (!gameState) return null;
        
        const currentPlayer = GameCore.getSelectedPlayer();
        const opponentIndex = currentPlayer === 'player2' ? 0 : 1;
        return gameState.players[opponentIndex];
    },
    
    /**
     * Get card data by unique ID
     */
    getCardData(uniqueId) {
        const gameState = GameCore.getGameState();
        if (!gameState) return null;
        
        for (const player of gameState.players) {
            for (const zone of ['hand', 'battlefield', 'graveyard', 'exile', 'library']) {
                const cards = player[zone] || [];
                const card = cards.find(c => c.unique_id === uniqueId);
                if (card) return card;
            }
        }
        return null;
    },
    
    /**
     * Initialize combat system
     */
    init() {
        // Add click handlers for battlefield creatures
        document.addEventListener('click', (event) => {
            const cardElement = event.target.closest('[data-card-unique-id]');
            if (!cardElement) return;
            
            const uniqueId = cardElement.getAttribute('data-card-unique-id');
            const zone = cardElement.getAttribute('data-card-zone');
            
            if (zone !== 'battlefield') return;
            
            const cardType = cardElement.getAttribute('data-card-type');
            if (cardType !== 'creature') return;
            
            // Handle based on current combat mode
            if (this.combatMode === 'declaring_attackers') {
                // Check if it's the current player's creature
                const currentPlayer = GameCore.getSelectedPlayer();
                const cardData = this.getCardData(uniqueId);
                if (cardData && cardData.owner_id === currentPlayer) {
                    this.toggleAttacker(uniqueId);
                }
            } else if (this.combatMode === 'declaring_blockers') {
                const currentPlayer = GameCore.getSelectedPlayer();
                const cardData = this.getCardData(uniqueId);
                
                if (cardData && cardData.owner_id === currentPlayer) {
                    // This is a potential blocker
                    if (cardElement.classList.contains('can-block')) {
                        this.selectBlocker(uniqueId);
                    }
                } else if (cardElement.classList.contains('is-attacker')) {
                    // This is an attacker
                    this.assignBlocker(uniqueId);
                }
            }
        });
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    window.GameCombat = GameCombat;
}
