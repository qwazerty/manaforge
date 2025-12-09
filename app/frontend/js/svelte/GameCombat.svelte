<script>
    import { onMount } from 'svelte';

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

    // Core mutable state (Runes)
    let attackers = $state(new Set());
    let blockers = $state(new Map());
    let combatMode = $state(null); // 'declaring_attackers' or 'declaring_blockers'
    let selectedBlocker = $state(null);
    let uiRefreshHandle = $state(null);
    let blockerRenderRetryHandle = $state(null);
    let blockerRenderStabilizeHandle = $state(null);
    let currentBlockingVisuals = $state(new Set());
    let attackSyncHandle = $state(null);
    let blockSyncHandle = $state(null);
    let lastSyncedAttackersPayload = $state(null);
    let lastSyncedBlockersPayload = $state(null);
    let clickHandler = $state(null);

    const GameCombat = {
        // Combat state (proxied to runes)
        get attackers() {
            return attackers;
        },
        set attackers(value) {
            attackers = value instanceof Set ? value : new Set(value || []);
        },
        get blockers() {
            return blockers;
        },
        set blockers(value) {
            blockers = value instanceof Map ? value : new Map(value || []);
        },
        get combatMode() {
            return combatMode;
        },
        set combatMode(value) {
            combatMode = value;
        },
        get selectedBlocker() {
            return selectedBlocker;
        },
        set selectedBlocker(value) {
            selectedBlocker = value;
        },
        get uiRefreshHandle() {
            return uiRefreshHandle;
        },
        set uiRefreshHandle(value) {
            uiRefreshHandle = value;
        },
        get blockerRenderRetryHandle() {
            return blockerRenderRetryHandle;
        },
        set blockerRenderRetryHandle(value) {
            blockerRenderRetryHandle = value;
        },
        get blockerRenderStabilizeHandle() {
            return blockerRenderStabilizeHandle;
        },
        set blockerRenderStabilizeHandle(value) {
            blockerRenderStabilizeHandle = value;
        },
        get currentBlockingVisuals() {
            return currentBlockingVisuals;
        },
        set currentBlockingVisuals(value) {
            currentBlockingVisuals = value instanceof Set ? value : new Set(value || []);
        },
        get attackSyncHandle() {
            return attackSyncHandle;
        },
        set attackSyncHandle(value) {
            attackSyncHandle = value;
        },
        get blockSyncHandle() {
            return blockSyncHandle;
        },
        set blockSyncHandle(value) {
            blockSyncHandle = value;
        },
        get lastSyncedAttackersPayload() {
            return lastSyncedAttackersPayload;
        },
        set lastSyncedAttackersPayload(value) {
            lastSyncedAttackersPayload = value;
        },
        get lastSyncedBlockersPayload() {
            return lastSyncedBlockersPayload;
        },
        set lastSyncedBlockersPayload(value) {
            lastSyncedBlockersPayload = value;
        },
        get clickHandler() {
            return clickHandler;
        },
        set clickHandler(value) {
            clickHandler = value;
        },
    
        /**
         * Check if a card has vigilance
         */
        hasVigilance(card) {
            if (!card) return false;
            const text = (card.text || '').toLowerCase();
            return text.includes('vigilance');
        },

        getNormalizedTypeText(card) {
            if (!card) return '';

            const typePieces = [];
            const pushType = (value) => {
                if (value) {
                    typePieces.push(String(value));
                }
            };

            pushType(card.card_type);
            pushType(card.cardType);
            pushType(card.type_line);
            pushType(card.typeLine);
            pushType(card.subtype);
            if (Array.isArray(card.types)) {
                card.types.forEach(pushType);
            }
            if (Array.isArray(card.subtypes)) {
                card.subtypes.forEach(pushType);
            }
            if (Array.isArray(card.supertypes)) {
                card.supertypes.forEach(pushType);
            }

            if (Array.isArray(card.card_faces)) {
                card.card_faces.forEach(face => {
                    pushType(face?.type_line);
                    pushType(face?.typeLine);
                    if (Array.isArray(face?.types)) {
                        face.types.forEach(pushType);
                    }
                    if (Array.isArray(face?.subtypes)) {
                        face.subtypes.forEach(pushType);
                    }
                });
            }

            return typePieces.join(' ').toLowerCase();
        },

        isCreatureCard(card) {
            if (typeof GameCards !== 'undefined' && typeof GameCards.isCreatureCard === 'function') {
                return GameCards.isCreatureCard(card);
            }
            return this.getNormalizedTypeText(card).includes('creature');
        },

        getCardControllerId(card, element = null) {
            if (card && (card.controller_id || card.controllerId || card.owner_id || card.ownerId)) {
                return card.controller_id || card.controllerId || card.owner_id || card.ownerId;
            }
            if (element) {
                const datasetController = element.getAttribute('data-card-controller');
                if (datasetController) {
                    return datasetController;
                }
                const datasetOwner = element.getAttribute('data-card-owner');
                if (datasetOwner) {
                    return datasetOwner;
                }
            }
            return null;
        },

        getAttackingTranslate(cardElement) {
            if (!cardElement) return -20;
            const isOpponentCard = cardElement.getAttribute('data-is-opponent') === 'true';
            return isOpponentCard ? 20 : -20;
        },
    
        /**
         * Determine what combat step we're in based on game state
         * Returns: 'attackers', 'blockers', or 'none'
         */
        getCombatStep() {
            const gameState = GameCore.getGameState();
        
            if (!gameState) {
                return 'none';
            }
            const phase = (gameState.phase || '').toLowerCase();
            if (!['attack', 'block', 'damage'].includes(phase)) {
                return 'none';
            }

            if (phase === 'damage') {
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
        
            const gameState = GameCore.getGameState();
            if (!gameState || gameState.phase !== 'attack') {
                return;
            }
        
            const currentPlayer = GameCore.getSelectedPlayer();
            const activePlayerIndex = gameState.active_player || 0;
            const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
            const combatState = gameState.combat_state || {};
            if (combatState.expected_player && combatState.expected_player !== currentPlayer) {
                return;
            }
            if (combatState.step && combatState.step !== 'declare_attackers' && combatState.step !== 'none') {
                return;
            }
        
            if (currentPlayerIndex !== activePlayerIndex) {
                return;
            }
        
            this.combatMode = 'declaring_attackers';
            this.attackers.clear();
            if (Array.isArray(combatState.pending_attackers) && combatState.pending_attackers.length) {
                this.attackers = new Set(combatState.pending_attackers);
                this.lastSyncedAttackersPayload = JSON.stringify(combatState.pending_attackers);
                setTimeout(() => this.applyPendingAttackerVisuals(combatState.pending_attackers), 50);
            }
            this.highlightValidAttackers();
        },
    
        /**
         * Start the Defense Step - defending player declares blockers
         */
        startDefenseStep() {
        
            const gameState = GameCore.getGameState();
            if (!gameState || gameState.phase !== 'block') {
                return;
            }
        
            const currentPlayer = GameCore.getSelectedPlayer();
            const activePlayerIndex = gameState.active_player || 0;
            const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
            const combatState = gameState.combat_state || {};
            if (combatState.expected_player && combatState.expected_player !== currentPlayer) {
                return;
            }
            if (combatState.step && combatState.step !== 'declare_blockers') {
                return;
            }
        
            if (currentPlayerIndex === activePlayerIndex) {
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
                this.lastSyncedBlockersPayload = JSON.stringify(combatState.pending_blockers);
                setTimeout(() => this.applyPendingBlockerVisuals(combatState.pending_blockers), 50);
            }
            this.renderBlockingAssignments({ retry: true });
        
            this.highlightValidBlockers();

            if (attackingCreatures.length > 0) {
                this.highlightAttackers();
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
                GameUI.logMessage('Cannot attack with tapped creature', 'error');
                return;
            }
        
            // Check for defender ability
            const hasDefender = (cardData?.text || '').toLowerCase().includes('defender');
            if (hasDefender) {
                GameUI.logMessage('Creature with Defender cannot attack', 'error');
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
                const translateY = this.getAttackingTranslate(cardElement);
                cardElement.style.transform = `translateY(${translateY}px)`;
            }
        
            this.updateCombatUI();
            this.syncPendingAttackers();
        },
    
        /**
         * Confirm attackers - end Attack Step and move to Defense Step
         */
        confirmAttackers() {        
            const gameState = GameCore.getGameState();
            if (!gameState || gameState.phase !== 'attack') {
                GameUI.logMessage('Not in attack phase', 'error');
                return;
            }
            const combatState = gameState.combat_state || {};
            if (combatState.step && combatState.step !== 'declare_attackers') {
                GameUI.logMessage('Waiting for combat progression', 'warning');
                return;
            }
        
            const attackingCreatures = Array.from(this.attackers);
        
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
                    const translateY = this.getAttackingTranslate(cardElement);
                    if (!hasVigilance) {
                        cardElement.classList.add('combat-tapped');
                        cardElement.style.transform = `translateY(${translateY}px) rotate(90deg)`;
                    } else {
                        cardElement.classList.remove('combat-tapped');
                        cardElement.style.transform = `translateY(${translateY}px)`;
                    }
                }
            });

            this.combatMode = null;
            this.clearHighlights();

            this.lastSyncedAttackersPayload = null;
        },
    
        /**
         * Confirm blockers - end Defense Step and continue combat
         */
        confirmBlockers() {        
            const gameState = GameCore.getGameState();
            if (!gameState || gameState.phase !== 'block') {
                GameUI.logMessage('Not in block phase', 'error');
                return;
            }
            const combatState = gameState.combat_state || {};
            if (combatState.step && combatState.step !== 'declare_blockers') {
                GameUI.logMessage('Waiting for combat progression', 'warning');
                return;
            }
        
            const blockingAssignments = Object.fromEntries(this.blockers);
        
            // Send declare_blockers action
            GameActions.performGameAction('declare_blockers', {
                blocking_assignments: blockingAssignments
            });
        
            this.combatMode = null;
            this.clearHighlights();
            this.clearArrows();

            this.lastSyncedBlockersPayload = null;
        },
    
    
        /**
         * Toggle blocker selection or assign to attacker when in blocker mode
         */
        toggleBlocker(uniqueId) {
            if (this.combatMode !== 'declaring_blockers') return;

            const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
            if (!cardElement) return;

            const cardData = this.getCardData(uniqueId);
            const currentPlayerId = GameCore.getSelectedPlayer();
            const controllerId = this.getCardControllerId(cardData, cardElement);

            if (controllerId === currentPlayerId) {
                if (!cardElement.classList.contains('can-block')) {
                    GameUI.logMessage('Cannot block with this creature', 'error');
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
                GameUI.logMessage('Cannot block with tapped creature', 'error');
                return;
            }
        
            // Clear previous selection
            document.querySelectorAll('.selected-blocker').forEach(el => {
                el.classList.remove('selected-blocker');
            });
        
            this.selectedBlocker = uniqueId;
            cardElement.classList.add('selected-blocker');
        },
    
        /**
         * Handle clicking on an attacker to assign a blocker
         */
        assignBlocker(attackerUniqueId) {
            if (this.combatMode !== 'declaring_blockers') return;
            if (!this.selectedBlocker) {
                GameUI.logMessage('Select a blocker first', 'warning');
                return;
            }
        
            const blockerId = this.selectedBlocker;
            const previousAssignment = this.blockers.get(blockerId);

            if (previousAssignment === attackerUniqueId) {
                this.blockers.delete(blockerId);
                document.querySelectorAll('.selected-blocker').forEach(el => el.classList.remove('selected-blocker'));
                this.renderBlockingAssignments({ retry: true });
                this.syncPendingBlockers();
                this.selectedBlocker = null;
                this.updateCombatUI();
                return;
            }

            this.blockers.set(blockerId, attackerUniqueId);

            document.querySelectorAll('.selected-blocker').forEach(el => {
                el.classList.remove('selected-blocker');
            });

            this.renderBlockingAssignments({ retry: true });
            this.syncPendingBlockers();
            this.selectedBlocker = null;
            this.updateCombatUI();
        },

        updateCombatUI(force = false) {
            if (!window.GameUI || typeof window.GameUI.generateActionPanel !== 'function') {
                return;
            }

            const websocket = window.websocket;
            const isWebSocketActive = websocket && websocket.readyState === WebSocket.OPEN;
            if (!force && isWebSocketActive) {
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

        syncPendingAttackers(immediate = false) {
            if (!immediate) {
                if (this.attackSyncHandle) {
                    clearTimeout(this.attackSyncHandle);
                }
                this.attackSyncHandle = setTimeout(() => this.syncPendingAttackers(true), 120);
                return;
            }

            this.attackSyncHandle = null;

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

            const attackingArray = Array.from(this.attackers);
            const payload = JSON.stringify(attackingArray);
            if (payload === this.lastSyncedAttackersPayload) {
                return;
            }

            window.GameSocket.sendGameAction('preview_attackers', {
                attacking_creatures: attackingArray
            });
            this.lastSyncedAttackersPayload = payload;
        },

        syncPendingBlockers(immediate = false) {
            if (!immediate) {
                if (this.blockSyncHandle) {
                    clearTimeout(this.blockSyncHandle);
                }
                this.blockSyncHandle = setTimeout(() => this.syncPendingBlockers(true), 120);
                return;
            }

            this.blockSyncHandle = null;

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
            const payload = JSON.stringify(blockingAssignments);
            if (payload === this.lastSyncedBlockersPayload) {
                return;
            }

            window.GameSocket.sendGameAction('preview_blockers', {
                blocking_assignments: blockingAssignments
            });
            this.lastSyncedBlockersPayload = payload;
        },

        renderBlockingAssignments({ retry = false, attempt = 0 } = {}) {
            if (this.blockerRenderRetryHandle) {
                clearTimeout(this.blockerRenderRetryHandle);
                this.blockerRenderRetryHandle = null;
            }
            if (this.blockerRenderStabilizeHandle) {
                clearTimeout(this.blockerRenderStabilizeHandle);
                this.blockerRenderStabilizeHandle = null;
            }

            document.querySelectorAll('.blocking-arrow').forEach(arrow => arrow.remove());

            this.currentBlockingVisuals.forEach(uniqueId => {
                const existing = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
                if (existing) {
                    existing.classList.remove('blocking-creature');
                    existing.classList.add('can-block');
                }
            });
            this.currentBlockingVisuals.clear();

            let missingElements = false;

            this.blockers.forEach((attackerId, blockerId) => {
                if (!blockerId) {
                    return;
                }

                const blockerElement = document.querySelector(`[data-card-unique-id="${blockerId}"]`);
                const attackerElement = attackerId
                    ? document.querySelector(`[data-card-unique-id="${attackerId}"]`)
                    : null;

                if (!blockerElement) {
                    missingElements = true;
                } else {
                    blockerElement.classList.add('blocking-creature', 'can-block');
                    this.currentBlockingVisuals.add(blockerId);
                }

                if (attackerId) {
                    if (blockerElement && attackerElement) {
                        this.drawBlockingArrow(blockerId, attackerId);
                    } else {
                        missingElements = true;
                    }
                }
            });

            if (retry && missingElements && attempt < 6) {
                this.blockerRenderRetryHandle = setTimeout(() => {
                    this.renderBlockingAssignments({ retry: true, attempt: attempt + 1 });
                }, 80);
            }

            if (retry) {
                this.blockerRenderStabilizeHandle = setTimeout(() => {
                    this.blockerRenderStabilizeHandle = null;
                    this.renderBlockingAssignments({ retry: false, attempt: attempt + 1 });
                }, 160);
            }
        },

        applyCombatVisualsFromState(gameState) {
            if (!gameState || !gameState.players) return;

            const combatState = gameState.combat_state || {};
            const pendingAttackers = new Set(Array.isArray(combatState.pending_attackers) ? combatState.pending_attackers : []);
            const pendingBlockers = combatState.pending_blockers || {};
            // eslint-disable-next-line svelte/prefer-svelte-reactivity
            const blockingPairs = new Map();

            const getTranslate = (element) => (
                element && element.getAttribute('data-is-opponent') === 'true' ? 20 : -20
            );

            gameState.players.forEach((player) => {
                if (!player.battlefield) {
                    return;
                }
                player.battlefield.forEach(card => {
                    const cardElement = document.querySelector(`[data-card-unique-id="${card.unique_id}"]`);
                    if (!cardElement) return;

                    const isPendingAttacker = pendingAttackers.has(card.unique_id);
                    const isAttacking = Boolean(card.attacking);
                    if (isAttacking || isPendingAttacker) {
                        cardElement.classList.add('attacking-creature');
                        const translateY = getTranslate(cardElement);
                        if (isAttacking && card.tapped) {
                            cardElement.style.transform = `translateY(${translateY}px) rotate(90deg)`;
                            cardElement.classList.add('combat-tapped');
                        } else {
                            cardElement.style.transform = `translateY(${translateY}px)`;
                            cardElement.classList.remove('combat-tapped');
                        }
                        if (isPendingAttacker && !isAttacking) {
                            cardElement.dataset.pendingAttacker = 'true';
                        } else {
                            delete cardElement.dataset.pendingAttacker;
                        }
                    } else {
                        cardElement.classList.remove('attacking-creature');
                        cardElement.style.transform = '';
                        cardElement.classList.remove('combat-tapped');
                        delete cardElement.dataset.pendingAttacker;
                    }

                    const pendingBlockTarget = pendingBlockers[card.unique_id];
                    const isBlocking = Boolean(card.blocking);
                    if (isBlocking || pendingBlockTarget) {
                        cardElement.classList.add('blocking-creature');
                        const attackerTarget = isBlocking ? card.blocking : pendingBlockTarget;
                        if (attackerTarget) {
                            blockingPairs.set(`${card.unique_id}->${attackerTarget}`, {
                                blocker: card.unique_id,
                                attacker: attackerTarget
                            });
                        }
                    } else {
                        cardElement.classList.remove('blocking-creature');
                    }
                });
            });

            this.clearArrows();
            if (typeof this.drawBlockingArrow === 'function') {
                blockingPairs.forEach(pair => {
                    this.drawBlockingArrow(pair.blocker, pair.attacker);
                });
            }
        },

        redrawCombatArrowsFromState(gameState) {
            if (!gameState || !gameState.players) return;

            this.clearArrows();

            gameState.players.forEach(player => {
                if (player.battlefield) {
                    player.battlefield.forEach(card => {
                        if (card.blocking && typeof this.drawBlockingArrow === 'function') {
                            this.drawBlockingArrow(card.unique_id, card.blocking);
                        }
                    });
                }
            });
        },

        applyPendingAttackerVisuals(pendingAttackers) {
            if (!Array.isArray(pendingAttackers)) return;

            this.attackers = new Set(pendingAttackers);
            this.lastSyncedAttackersPayload = JSON.stringify(pendingAttackers);

            pendingAttackers.forEach(uniqueId => {
                const cardElement = document.querySelector(`[data-card-unique-id="${uniqueId}"]`);
                if (!cardElement) return;
                cardElement.classList.add('attacking-creature');
                const translateY = this.getAttackingTranslate(cardElement);
                cardElement.style.transform = `translateY(${translateY}px)`;
            });
        },

        applyPendingBlockerVisuals(pendingAssignments) {
            if (!pendingAssignments || typeof pendingAssignments !== 'object') return;
            this.blockers = new Map(Object.entries(pendingAssignments));
            this.lastSyncedBlockersPayload = JSON.stringify(pendingAssignments);
            this.renderBlockingAssignments({ retry: true });
        },
    
        /**
         * Cancel current combat action
         */
        cancelCombat() {
            if (this.attackSyncHandle) {
                clearTimeout(this.attackSyncHandle);
                this.attackSyncHandle = null;
            }
            if (this.blockSyncHandle) {
                clearTimeout(this.blockSyncHandle);
                this.blockSyncHandle = null;
            }

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
            this.syncPendingAttackers(true);
            this.syncPendingBlockers(true);
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
                if (this.isCreatureCard(card)) {
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
                if (this.isCreatureCard(card) && !card.tapped) {
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

            this.currentBlockingVisuals.clear();
            if (this.blockerRenderRetryHandle) {
                clearTimeout(this.blockerRenderRetryHandle);
                this.blockerRenderRetryHandle = null;
            }
            if (this.blockerRenderStabilizeHandle) {
                clearTimeout(this.blockerRenderStabilizeHandle);
                this.blockerRenderStabilizeHandle = null;
            }
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

        removeBlockingArrow(blockerUniqueId, attackerUniqueId = null) {
            const selector = attackerUniqueId
                ? `.blocking-arrow[data-blocker="${blockerUniqueId}"][data-attacker="${attackerUniqueId}"]`
                : `.blocking-arrow[data-blocker="${blockerUniqueId}"]`;
            document.querySelectorAll(selector).forEach(arrow => arrow.remove());
        },
    
        /**
         * Clear all blocking arrows
         */
        clearArrows() {
            document.querySelectorAll('.blocking-arrow').forEach(arrow => arrow.remove());
            if (this.blockerRenderRetryHandle) {
                clearTimeout(this.blockerRenderRetryHandle);
                this.blockerRenderRetryHandle = null;
            }
            if (this.blockerRenderStabilizeHandle) {
                clearTimeout(this.blockerRenderStabilizeHandle);
                this.blockerRenderStabilizeHandle = null;
            }
        },

        _cleanupCombatVisuals() {
            this.combatMode = null;
            this.attackers.clear();
            this.blockers.clear();
            this.clearHighlights();
            this.clearArrows();
            document.querySelectorAll('.combat-tapped').forEach(el => {
                el.classList.remove('combat-tapped');
                el.style.transform = '';
            });

            if (this.attackSyncHandle) {
                clearTimeout(this.attackSyncHandle);
                this.attackSyncHandle = null;
            }
            if (this.blockSyncHandle) {
                clearTimeout(this.blockSyncHandle);
                this.blockSyncHandle = null;
            }
            this.lastSyncedAttackersPayload = null;
            this.lastSyncedBlockersPayload = null;

            if (window.GameUI && typeof window.GameUI.refreshGameState === 'function') {
                setTimeout(() => {
                    window.GameUI.refreshGameState();
                }, 100);
            }
        },
    
        /**
         * Handle phase changes during combat windows
         */
        onPhaseChange(newPhase) {
            const normalizedPhase = (newPhase || '').toLowerCase();

            const gameState = GameCore.getGameState();
            if (!gameState) {
                this._cleanupCombatVisuals();
                return;
            }

            const currentPlayer = GameCore.getSelectedPlayer();
            const activePlayerIndex = gameState.active_player || 0;
            const currentPlayerIndex = currentPlayer === 'player2' ? 1 : 0;
            const isActivePlayer = currentPlayerIndex === activePlayerIndex;

            if (normalizedPhase === 'attack') {
                if (isActivePlayer) {
                    setTimeout(() => this.startAttackStep(), 100);
                }
                return;
            }

            if (normalizedPhase === 'block') {
                if (!isActivePlayer) {
                    setTimeout(() => this.startDefenseStep(), 100);
                }
                return;
            }

            this._cleanupCombatVisuals();
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
            this.teardown();
            const handler = (event) => {
                const cardElement = event.target.closest('[data-card-unique-id]');
                if (!cardElement) return;
            
                const uniqueId = cardElement.getAttribute('data-card-unique-id');
                const zone = cardElement.getAttribute('data-card-zone');
                const isBattlefieldZone = ['battlefield', 'creatures', 'lands', 'support', 'permanents'].includes(zone);
                if (!isBattlefieldZone) return;
            
                const cardData = this.getCardData(uniqueId);
                const typeAttr = cardElement.getAttribute('data-card-type');
                const isCreature = typeAttr === 'creature' || this.isCreatureCard(cardData);
                if (!isCreature) return;

                // Handle based on current combat mode
                if (this.combatMode === 'declaring_attackers') {
                    // Check if it's the current player's creature
                    const currentPlayer = GameCore.getSelectedPlayer();
                    const controllerId = this.getCardControllerId(cardData, cardElement);
                    if (controllerId === currentPlayer) {
                        this.toggleAttacker(uniqueId);
                    }
                } else if (this.combatMode === 'declaring_blockers') {
                    const currentPlayer = GameCore.getSelectedPlayer();
                    const controllerId = this.getCardControllerId(cardData, cardElement);
                
                    if (controllerId === currentPlayer) {
                        // This is a potential blocker
                        if (cardElement.classList.contains('can-block')) {
                            this.selectBlocker(uniqueId);
                        }
                    } else if (cardElement.classList.contains('is-attacker')) {
                        // This is an attacker
                        this.assignBlocker(uniqueId);
                    }
                }
            };
            document.addEventListener('click', handler);
            this.clickHandler = handler;
        },

        teardown() {
            if (this.clickHandler) {
                document.removeEventListener('click', this.clickHandler);
                this.clickHandler = null;
            }
        }
    };

    // Initialize on load
    if (typeof window !== 'undefined') {
        window.GameCombat = GameCombat;
    }

    function installGlobal() {
        if (typeof window !== 'undefined') {
            window.GameCombat = GameCombat;
        }
    }

    onMount(() => {
        installGlobal();
        if (typeof GameCombat?.init === 'function') {
            try {
                GameCombat.init();
            } catch (error) {
                console.error('[GameCombat] init failed', error);
            }
        }
        return () => {
            if (typeof GameCombat?.teardown === 'function') {
                GameCombat.teardown();
            }
        };
    });
</script>
