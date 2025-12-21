<script>
    import { onDestroy } from 'svelte';

    /**
     * ManaForge Card Context Menu
     * Right-click context menu for card actions
     * Migrated from game-cards.js showCardContextMenu
     */

    // Reactive state
    let isOpen = $state(false);
    let menuElement = $state(null);
    let position = $state({ x: 0, y: 0 });
    
    // Card data
    let cardId = $state('');
    let cardName = $state('');
    let cardImage = $state('');
    let cardZone = $state('');
    let uniqueCardId = $state('');
    let cardData = $state(null);
    let cardElement = $state(null);
    
    // Card state flags
    let isTapped = $state(false);
    let isTargeted = $state(false);
    let isOpponent = $state(false);
    let isTokenCard = $state(false);
    let isDoubleFaced = $state(false);
    let isFaceDown = $state(false);
    let isFaceDownOwner = $state(false);
    let hasAttachmentHost = $state(false);
    let hasAttachments = $state(false);
    let cardOwnerId = $state('');
    let isCommander = $state(false);
    let hasArrows = $state(false);
    let detectedTokens = $state([]);  // Tokens detected from oracle text
    let cardSet = $state('');  // Set code of the card
    
    // Derived states
    let normalizedZone = $derived.by(() => {
        let zone = (cardZone || '').toLowerCase();
        if (zone.startsWith('opponent_')) {
            zone = zone.replace('opponent_', '');
        }
        return zone;
    });
    
    let isBattlefieldZone = $derived(
        ['battlefield', 'permanents', 'lands', 'creatures', 'support'].includes(normalizedZone)
    );
    
    let canPlayOpponentCard = $derived.by(() => {
        const selectedPlayer = getSelectedPlayer();
        const canControlZones = selectedPlayer === 'player1' || selectedPlayer === 'player2';
        const isSpectator = selectedPlayer === 'spectator';
        const opponentPlayableZones = ['graveyard', 'exile', 'reveal', 'reveal_zone', 'look', 'look_zone'];
        return canControlZones && !isSpectator && isOpponent && opponentPlayableZones.includes(normalizedZone);
    });

    // Helpers
    function getSelectedPlayer() {
        return GameCore.getSelectedPlayer();
    }

    function getGameState() {
        return GameCore.getGameState();
    }

    // Public API
    export function show(event, element) {
        if (!element) return;
        
        // Hide card preview
        CardPreviewModal.hide();
        
        // Cancel any attachment selection
        GameCards.cancelAttachmentSelection();

        // Extract card data from element
        cardElement = element;
        cardId = element.getAttribute('data-card-id') || '';
        cardName = element.getAttribute('data-card-name') || '';
        cardImage = element.getAttribute('data-card-image') || '';
        cardZone = element.getAttribute('data-card-zone') || 'unknown';
        uniqueCardId = element.getAttribute('data-card-unique-id') || '';
        cardOwnerId = element.getAttribute('data-card-owner') || '';
        
        isTapped = element.getAttribute('data-card-tapped') === 'true';
        isTargeted = element.classList.contains('targeted');
        isOpponent = element.getAttribute('data-is-opponent') === 'true';
        
        const attachedTo = element.getAttribute('data-attached-to') || '';
        hasAttachmentHost = Boolean(attachedTo && attachedTo.trim().length);
        
        const attachmentChildren = Array.from(document.querySelectorAll(`[data-attached-to="${uniqueCardId}"]`));
        hasAttachments = attachmentChildren.length > 0;
        
        // Parse card data
        try {
            cardData = JSON.parse(element.getAttribute('data-card-data') || '{}');
        } catch {
            cardData = {};
        }
        
        isTokenCard = Boolean(cardData?.is_token);
        isDoubleFaced = cardData.is_double_faced && cardData.card_faces && cardData.card_faces.length > 1;
        isFaceDown = Boolean(cardData?.face_down || cardData?.is_face_down || cardData?.faceDown);
        isCommander = Boolean(cardData?.is_commander || cardData?.isCommander);
        
        const faceDownOwnerId = cardData?.face_down_owner || cardData?.face_down_owner_id || cardData?.faceDownOwner || cardData?.faceDownOwnerId;
        const selectedPlayer = getSelectedPlayer();
        isFaceDownOwner = isFaceDown && selectedPlayer && faceDownOwnerId && faceDownOwnerId.toLowerCase() === selectedPlayer.toLowerCase();

        // Check if this card has arrows
        hasArrows = GameCards.hasArrowsFromCard(uniqueCardId);

        // Extract tokens from oracle text
        cardSet = cardData?.set || cardData?.set_code || '';
        const tokenSet = window.UIRenderersTemplates._extractTokenNamesFromOracle(cardData);
        detectedTokens = Array.from(tokenSet);

        // Position menu
        position = { x: event.clientX + 10, y: event.clientY };
        isOpen = true;
        
        // Store position for attachment modal
        GameCards._lastContextPosition = { x: event.clientX, y: event.clientY };

        // Wait for render then adjust position
        requestAnimationFrame(() => {
            adjustPosition();
        });

        // Add click listener to close
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleKeydown);
        
        // Notify CardPreviewModal that context menu is open
        CardPreviewModal.setContextMenuOpen(true);
    }

    export function hide() {
        isOpen = false;
        cardElement = null;
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleKeydown);
        
        CardPreviewModal.setContextMenuOpen(false);
    }

    function adjustPosition() {
        if (!menuElement) return;
        
        const rect = menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let x = position.x;
        let y = position.y;
        
        if (x + rect.width > viewportWidth) {
            x = position.x - rect.width - 20;
        }
        if (y + rect.height > viewportHeight) {
            y = viewportHeight - rect.height - 10;
        }
        
        x = Math.max(10, x);
        y = Math.max(10, y);
        
        position = { x, y };
    }

    function handleOutsideClick(event) {
        if (menuElement && !menuElement.contains(event.target)) {
            hide();
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            hide();
        }
    }

    // Action handlers
    function handleAction(action, ...args) {
        switch (action) {
            case 'target':
                toggleTarget();
                break;
            case 'flip':
                flipCard();
                break;
            case 'play':
                playCard();
                break;
            case 'playFaceDown':
                playCardFaceDown();
                break;
            case 'playFromLibrary':
                playFromLibrary();
                break;
            case 'tap':
                tapCard();
                break;
            case 'duplicate':
                duplicateCard();
                break;
            case 'attach':
                startAttachment();
                break;
            case 'showAttachments':
                showAttachments();
                break;
            case 'detach':
                detachCard();
                break;
            case 'addType':
                addType();
                break;
            case 'addCounter':
                addCounter();
                break;
            case 'overridePT':
                overridePowerToughness();
                break;
            case 'reveal':
                revealFaceDown();
                break;
            case 'sendToHand':
                sendToHand();
                break;
            case 'sendToBattlefieldDirect':
                sendToBattlefieldDirect(false);
                break;
            case 'sendToOpponentBattlefieldDirect':
                sendToBattlefieldDirect(true);
                break;
            case 'sendToBattlefield':
                sendToBattlefield();
                break;
            case 'sendToGraveyard':
                sendToGraveyard();
                break;
            case 'sendToExile':
                sendToExile();
                break;
            case 'sendToTopLibrary':
                sendToTopLibrary();
                break;
            case 'sendToBottomLibrary':
                sendToBottomLibrary();
                break;
            case 'showInReveal':
                showInReveal();
                break;
            case 'sendToCommanderZone':
                sendToCommanderZone();
                break;
            case 'deleteToken':
                deleteToken();
                break;
            case 'showAllHandReveal':
                showAllHandReveal();
                break;
            case 'sendAllToHand':
                sendAllToHand(args[0]);
                break;
            case 'sendAllToBattlefield':
                sendAllToBattlefield(args[0]);
                break;
            case 'sendAllToGraveyard':
                sendAllToGraveyard(args[0]);
                break;
            case 'sendAllToExile':
                sendAllToExile(args[0]);
                break;
            case 'sendAllToTopLibrary':
                sendAllToTopLibrary(args[0]);
                break;
            case 'sendAllToBottomLibrary':
                sendAllToBottomLibrary(args[0]);
                break;
            case 'playOpponentCard':
                playOpponentCard();
                break;
            case 'addArrow':
                startArrowToCard();
                break;
            case 'removeArrows':
                removeArrowsFromCard();
                break;
            case 'createToken':
                createTokenFromCard(args[0]);
                break;
        }

        // Close the menu after the action so handlers that rely on
        // the stored cardElement (e.g., target) can still access it.
        hide();
    }

    function toggleTarget() {
        CardPreviewModal.hide();
        
        if (cardElement) {
            const wasTargeted = cardElement.classList.toggle('targeted');
            cardElement.setAttribute('data-card-targeted', wasTargeted.toString());
            
            GameActions.performGameAction('target_card', {
                unique_id: uniqueCardId,
                card_id: cardId,
                targeted: wasTargeted
            });
        }
    }

    function flipCard() {
        CardPreviewModal.hide();
        GameActions.performGameAction('flip_card', {
            card_id: cardId,
            unique_id: uniqueCardId
        });
    }

    function playCard() {
        GameActions.playCardFromHand(cardId, uniqueCardId);
    }

    function playCardFaceDown() {
        GameActions.playCardFromHand(cardId, uniqueCardId, { faceDown: true });
    }

    function playFromLibrary() {
        GameActions.performGameAction("play_card_from_library", { unique_id: uniqueCardId });
        UIZonesManager.closeZoneModal("deck");
    }

    function tapCard() {
        GameActions.tapCard(cardId, uniqueCardId);
    }

    function duplicateCard() {
        GameActions.duplicateCard(cardId, uniqueCardId, cardZone);
    }

    function startAttachment() {
        GameCards.startAttachmentSelection(cardId, uniqueCardId);
    }

    function startArrowToCard() {
        GameCards.startArrowSelection(cardId, uniqueCardId);
    }

    function removeArrowsFromCard() {
        GameCards.removeAllArrowsFromCardElement(uniqueCardId);
    }

    /**
     * Create a token from the card's oracle text.
     * Searches for the token with matching set and creates it on the battlefield.
     */
    function setMatchesSource(tokenSet, sourceSet) {
        if (!tokenSet || !sourceSet) return false;
        if (tokenSet === sourceSet) return true;
        if (tokenSet.startsWith('t') && tokenSet.slice(1) === sourceSet) return true;
        if (sourceSet.startsWith('t') && sourceSet.slice(1) === tokenSet) return true;
        return false;
    }

    async function createTokenFromCard(tokenName) {
        if (!tokenName) return;
        
        const gameId = window?.gameData?.gameId;
        const playerId = GameCore.getSelectedPlayer();
        
        if (!gameId || !playerId) {
            console.error('[CardContextMenu] Missing game context for token creation');
            return;
        }

        try {
            // Search for the token with exact name match, prioritizing the card's set
            // Token sets have 't' prefix (e.g., 'tmh3' for 'mh3' tokens)
            // If source card is already a token (set starts with 't' and has 4+ chars), use its set directly
            const sourceSet = (cardSet || '').toLowerCase().trim();
            let candidateSetCodes = [];
            if (sourceSet) {
                // Token sets have 4+ characters and start with 't' (e.g., 'tneo', 'tmh2')
                // Regular sets starting with 't' are typically 3 chars (e.g., 'tmp', 'tpr')
                const isTokenSet = sourceSet.length >= 4 && sourceSet.startsWith('t');
                if (isTokenSet) {
                    candidateSetCodes = [sourceSet, sourceSet.slice(1)];
                } else {
                    candidateSetCodes = [`t${sourceSet}`, sourceSet];
                }
                candidateSetCodes = [...new Set(candidateSetCodes.filter(Boolean))];
            }
            
            // First try with the matching token set
            const baseSearchUrl = `/api/v1/cards/search?q=${encodeURIComponent(tokenName)}&tokens_only=true&exact=true&limit=100`;
            let tokens = [];

            for (const setCode of candidateSetCodes) {
                const response = await fetch(`${baseSearchUrl}&set=${encodeURIComponent(setCode)}`);
                const results = response.ok ? await response.json() : [];
                if (results.length) {
                    tokens = results;
                    break;
                }
            }

            // If no result with specific sets, search without set filter
            if (!tokens.length) {
                const response = await fetch(baseSearchUrl);
                tokens = response.ok ? await response.json() : [];
            }
            
            if (!tokens.length) {
                console.warn(`[CardContextMenu] No token found for "${tokenName}"`);
                return;
            }
            
            // Sort tokens to prioritize matching set
            if (sourceSet) {
                tokens.sort((a, b) => {
                    const aSet = (a.set || a.set_code || '').toLowerCase();
                    const bSet = (b.set || b.set_code || '').toLowerCase();
                    const aMatch = setMatchesSource(aSet, sourceSet);
                    const bMatch = setMatchesSource(bSet, sourceSet);
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    return 0;
                });
            }
            
            const selectedToken = tokens[0];
            
            // Create the token
            const payload = {
                action_type: 'create_token',
                player_id: playerId,
                scryfall_id: selectedToken.scryfall_id
            };
            
            const createResponse = await fetch(`/api/v1/games/${gameId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!createResponse.ok) {
                console.error('[CardContextMenu] Failed to create token');
            }
        } catch (err) {
            console.error('[CardContextMenu] Error creating token:', err);
        }
    }

    function showAttachments() {
        GameCards.showAttachmentsModal(uniqueCardId, cardName);
    }

    function detachCard() {
        GameActions.detachCard(cardId, uniqueCardId);
    }

    function addType() {
        GameCards.showTypePopover(uniqueCardId, cardId);
    }

    function addCounter() {
        GameCards.showCounterPopover(uniqueCardId, cardId);
    }

    function overridePowerToughness() {
        GameCards.showPowerToughnessPopover(uniqueCardId, cardId);
    }

    function revealFaceDown() {
        GameActions.revealFaceDownCard(cardId, uniqueCardId);
    }

    function sendToHand() {
        GameActions.moveCard(cardId, cardZone, "hand", uniqueCardId);
    }

    function sendToBattlefield() {
        GameActions.sendToBattlefield(cardId, cardZone, uniqueCardId);
    }

    function sendToBattlefieldDirect(toOpponent = false) {
        const selectedPlayer = GameCore.getSelectedPlayer();
        if (!selectedPlayer || selectedPlayer === 'spectator') {
            return;
        }

        const opponentId = selectedPlayer === 'player1' ? 'player2' : 'player1';
        // Use zoneOwner, cardOwnerId, or infer from isOpponent
        const zoneOwner = cardElement?.getAttribute('data-zone-owner');
        const sourcePlayerId = zoneOwner || cardOwnerId || (isOpponent ? opponentId : selectedPlayer);
        const destinationPlayerId = toOpponent ? opponentId : selectedPlayer;

        GameActions.moveCard(
            cardId,
            cardZone,
            'battlefield',
            uniqueCardId,
            null,
            null,
            null,
            {
                sourcePlayerId,
                destinationPlayerId,
                bypassStack: true
            }
        );
    }

    function sendToGraveyard() {
        GameActions.sendToGraveyard(cardId, cardZone, uniqueCardId);
    }

    function sendToExile() {
        GameActions.sendToExile(cardId, cardZone, uniqueCardId);
    }

    function sendToTopLibrary() {
        GameActions.sendToTopLibrary(cardId, cardZone, uniqueCardId);
    }

    function sendToBottomLibrary() {
        GameActions.sendToBottomLibrary(cardId, cardZone, uniqueCardId);
    }

    function showInReveal() {
        GameActions.showInRevealZone(cardId, cardZone, uniqueCardId);
    }

    function sendToCommanderZone() {
        GameActions.moveCard(cardId, cardZone, "commander_zone", uniqueCardId);
    }

    function deleteToken() {
        GameActions.deleteToken(uniqueCardId, cardName);
    }

    function showAllHandReveal() {
        GameActions.moveAllHandToReveal();
    }

    function sendAllToHand(zone) {
        GameActions.sendAllZoneToHand(zone);
    }

    function sendAllToBattlefield(zone) {
        GameActions.sendAllZoneToBattlefield(zone);
    }

    function sendAllToGraveyard(zone) {
        GameActions.sendAllZoneToGraveyard(zone);
    }

    function sendAllToExile(zone) {
        GameActions.sendAllZoneToExile(zone);
    }

    function sendAllToTopLibrary(zone) {
        GameActions.sendAllZoneToTopLibrary(zone);
    }

    function sendAllToBottomLibrary(zone) {
        GameActions.sendAllZoneToBottomLibrary(zone);
    }

    function playOpponentCard() {
        GameActions.playOpponentCardFromZone(cardId, uniqueCardId, cardZone, cardOwnerId);
    }

    // Count cards in zone for bulk actions
    function getZoneCardCount(zoneName) {
        const gameState = getGameState();
        const selectedPlayer = getSelectedPlayer();
        if (!gameState?.players || !selectedPlayer || selectedPlayer === 'spectator') {
            return 0;
        }
        const playerIndex = selectedPlayer === 'player2' ? 1 : 0;
        const player = gameState.players[playerIndex];
        const zoneKey = zoneName === 'reveal' ? 'reveal_zone' : zoneName === 'look' ? 'look_zone' : zoneName;
        return Array.isArray(player?.[zoneKey]) ? player[zoneKey].length : 0;
    }

    let revealCardCount = $derived(getZoneCardCount('reveal'));
    let lookCardCount = $derived(getZoneCardCount('look'));

    // Export API to window
    const CardContextMenuAPI = {
        show,
        hide
    };

    window.CardContextMenu = CardContextMenuAPI;

    onDestroy(() => {
        hide();
        if (window.CardContextMenu === CardContextMenuAPI) {
            delete window.CardContextMenu;
        }
    });
</script>

{#if isOpen}
    <div 
        class="card-context-menu"
        bind:this={menuElement}
        style="left: {position.x}px; top: {position.y}px;"
        role="menu"
        aria-label="Card actions"
    >
        {#if cardImage}
            <div class="card-context-image">
                <img src={cardImage} alt={cardName} />
            </div>
        {/if}

        <div class="card-context-actions">
            <div class="card-context-header">
                <h3>{cardName || 'Unknown'}</h3>
            </div>
            <div class="card-context-menu-divider"></div>

            <!-- Target action -->
            <button class="card-context-menu-item" onclick={() => handleAction('target')}>
                <span class="icon">{isTargeted ? '❌' : '🎯'}</span>
                {isTargeted ? 'Untarget' : 'Target'}
            </button>

            <!-- Arrow targeting - battlefield and stack cards -->
            {#if isBattlefieldZone || normalizedZone === 'stack'}
                <button class="card-context-menu-item" onclick={() => handleAction('addArrow')}>
                    <span class="icon">➡️</span>
                    Add Arrow to...
                </button>
                {#if hasArrows}
                    <button class="card-context-menu-item" onclick={() => handleAction('removeArrows')}>
                        <span class="icon">🚫</span>
                        Remove Arrows
                    </button>
                {/if}
            {/if}

            <!-- Flip for double-faced cards -->
            {#if isDoubleFaced && !isOpponent}
                {@const currentFace = cardData?.current_face || 0}
                <button class="card-context-menu-item" onclick={() => handleAction('flip')}>
                    <span class="icon">🔄</span>
                    Flip to {currentFace === 0 ? 'Back' : 'Front'}
                </button>
            {/if}

            {#if !isOpponent}
                <!-- Hand zone actions -->
                {#if cardZone === 'hand'}
                    <button class="card-context-menu-item" onclick={() => handleAction('play')}>
                        <span class="icon">▶️</span> Play Card
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('playFaceDown')}>
                        <span class="icon">🙈</span> Play Face Down
                    </button>
                {/if}

                <!-- Deck zone actions -->
                {#if cardZone === 'deck'}
                    <button class="card-context-menu-item" onclick={() => handleAction('playFromLibrary')}>
                        <span class="icon">⚔️</span> Put on Battlefield
                    </button>
                {/if}

                <!-- Battlefield zone actions -->
                {#if isBattlefieldZone}
                    <button class="card-context-menu-item" onclick={() => handleAction('tap')}>
                        <span class="icon">{isTapped ? '⤴️' : '🔄'}</span>
                        {isTapped ? 'Untap' : 'Tap'}
                    </button>

                    <button class="card-context-menu-item" onclick={() => handleAction('duplicate')}>
                        <span class="icon">🪄</span> Duplicate
                    </button>

                    <button class="card-context-menu-item" onclick={() => handleAction('attach')}>
                        <span class="icon">🧲</span> Attach to other card
                    </button>

                    {#if hasAttachments}
                        <button class="card-context-menu-item" onclick={() => handleAction('showAttachments')}>
                            <span class="icon">👁️</span> Show attached cards
                        </button>
                    {/if}

                    {#if hasAttachmentHost}
                        <button class="card-context-menu-item" onclick={() => handleAction('detach')}>
                            <span class="icon">🔓</span> Detach
                        </button>
                    {/if}

                    <div class="card-context-menu-divider"></div>

                    <button class="card-context-menu-item" onclick={() => handleAction('addType')}>
                        <span class="icon">🧬</span> Add Type
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('addCounter')}>
                        <span class="icon">🔢</span> Add Counter
                    </button>
                    {#each detectedTokens as tokenName (tokenName)}
                        <button class="card-context-menu-item" onclick={() => handleAction('createToken', tokenName)}>
                            <span class="icon">🎭</span> Add {tokenName} Token
                        </button>
                    {/each}
                    <button class="card-context-menu-item" onclick={() => handleAction('overridePT')}>
                        <span class="icon">💪</span> Override Power/Toughness
                    </button>
                {/if}

                <!-- Reveal face-down card -->
                {#if isFaceDown && isFaceDownOwner && cardZone !== 'hand'}
                    <button class="card-context-menu-item" onclick={() => handleAction('reveal')}>
                        <span class="icon">👁️</span> Reveal Card
                    </button>
                {/if}

                <div class="card-context-menu-divider"></div>

                <!-- Move actions -->
                {#if isCommander && !['commander', 'commander_zone'].includes(cardZone)}
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToCommanderZone')}>
                        <span class="icon"><i class="ms ms-commander"></i></span> Send to Commander Zone
                    </button>
                {/if}

                {#if cardZone !== 'hand'}
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToHand')}>
                        <span class="icon">👋</span> Send to Hand
                    </button>
                {/if}

                {#if ['graveyard', 'exile', 'reveal', 'reveal_zone', 'look', 'look_zone'].includes(cardZone)}
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToBattlefieldDirect')}>
                        <span class="icon">⚔️</span> Send to Battlefield
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToOpponentBattlefieldDirect')}>
                        <span class="icon">🗡️</span> Send to Opponent Battlefield
                    </button>
                {/if}

                {#if isTokenCard}
                    <button class="card-context-menu-item" onclick={() => handleAction('deleteToken')}>
                        <span class="icon">🗑️</span> Delete Token
                    </button>
                {:else}
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToGraveyard')}>
                        <span class="icon">⚰️</span> Send to Graveyard
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToExile')}>
                        <span class="icon">✨</span> Send to Exile
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToTopLibrary')}>
                        <span class="icon">⬆️</span> Send to Top Library
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendToBottomLibrary')}>
                        <span class="icon">⬇️</span> Send to Bottom Library
                    </button>
                {/if}

                {#if cardZone !== 'reveal'}
                    <button class="card-context-menu-item" onclick={() => handleAction('showInReveal')}>
                        <span class="icon">👁️</span> Show in Reveal Zone
                    </button>
                {/if}

                <!-- Bulk actions for hand -->
                {#if cardZone === 'hand'}
                    <div class="card-context-menu-divider"></div>
                    <button class="card-context-menu-item" onclick={() => handleAction('showAllHandReveal')}>
                        <span class="icon">👁️</span> Show all Hand in Reveal Zone
                    </button>
                {/if}

                <!-- Bulk actions for reveal zone -->
                {#if (cardZone === 'reveal' || cardZone === 'reveal_zone') && revealCardCount >= 2}
                    <div class="card-context-menu-divider"></div>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToHand', 'reveal')}>
                        <span class="icon">👋</span> Send all to Hand
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToBattlefield', 'reveal')}>
                        <span class="icon">⚔️</span> Send all to Battlefield
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToGraveyard', 'reveal')}>
                        <span class="icon">⚰️</span> Send all to Graveyard
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToExile', 'reveal')}>
                        <span class="icon">✨</span> Send all to Exile
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToTopLibrary', 'reveal')}>
                        <span class="icon">🔀</span> Send all to Top Library (random)
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToBottomLibrary', 'reveal')}>
                        <span class="icon">🔀</span> Send all to Bottom Library (random)
                    </button>
                {/if}

                <!-- Bulk actions for look zone -->
                {#if (cardZone === 'look' || cardZone === 'look_zone') && lookCardCount >= 2}
                    <div class="card-context-menu-divider"></div>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToHand', 'look')}>
                        <span class="icon">👋</span> Send all to Hand
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToGraveyard', 'look')}>
                        <span class="icon">⚰️</span> Send all to Graveyard
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToExile', 'look')}>
                        <span class="icon">✨</span> Send all to Exile
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToTopLibrary', 'look')}>
                        <span class="icon">🔀</span> Send all to Top Library (random)
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToBottomLibrary', 'look')}>
                        <span class="icon">🔀</span> Send all to Bottom Library (random)
                    </button>
                    <button class="card-context-menu-item" onclick={() => handleAction('sendAllToBattlefield', 'look')}>
                        <span class="icon">⚔️</span> Send all to Battlefield
                    </button>
                {/if}
            {/if}

            <!-- Opponent card actions -->
            {#if canPlayOpponentCard}
                <button class="card-context-menu-item" onclick={() => handleAction('sendToBattlefieldDirect')}>
                    <span class="icon">⚔️</span> Send to Battlefield
                </button>
            {/if}
        </div>
    </div>
{/if}
