<script>
    import { onMount } from 'svelte';
    import {
        gameState,
        selectedPlayer,
        gameId,
        isPageVisible,
        getGameStateSnapshot,
        getSelectedPlayerSnapshot,
        getGameIdSnapshot,
        getPageVisibleSnapshot,
        setGameState,
        setGameId,
        setPageVisible
    } from './stores/gameCoreStore.js';
    import {
        addActionHistoryFailure,
        addActionHistoryFromActionResult,
        mergeActionHistoryEntries
    } from './stores/actionHistoryStore.js';
    import {
        addTargetingArrow,
        removeTargetingArrow
    } from './stores/gameCardsStore.js';
    import { hydrateGameState } from './stores/cardCatalogStore.js';
    import { formatSeatFallback, resolvePlayerDisplayName } from '@lib/player-seat';

    /** @type {{ reconnectDelay?: number }} */
    const { reconnectDelay = 1000 } = $props();

    let connectionState = $state({
        status: 'idle',
        attempts: 0,
        lastError: null,
        lastEventAt: null,
        reason: 'init'
    });

    let websocket = $state(null);
    let reconnectTimer = $state(null);
    let storeSnapshots = $state({
        gameId: getGameIdSnapshot(),
        gameState: getGameStateSnapshot(),
        selectedPlayer: getSelectedPlayerSnapshot(),
        isVisible: getPageVisibleSnapshot()
    });

    // Non-reactive flags (still tracked via runes for consistency)
    let managerInitialized = $state(false);
    let visibilityCleanup = $state(null);

    const PLAYER_ZONES_TO_TRACK = ['hand', 'battlefield', 'graveyard', 'exile', 'reveal_zone', 'look_zone'];

    /**
     * Shallow-ish comparison that still tracks battlefield state
     */
    function shallowEqualState(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;
        
        if (a.turn !== b.turn) return false;
        if (a.phase !== b.phase) return false;
        if (a.active_player !== b.active_player) return false;
        if (a.priority_player !== b.priority_player) return false;
        if (Boolean(a.end_step_priority_passed) !== Boolean(b.end_step_priority_passed)) return false;
        if ((a.stack?.length || 0) !== (b.stack?.length || 0)) return false;

        const aPlayers = Array.isArray(a.players) ? a.players : [];
        const bPlayers = Array.isArray(b.players) ? b.players : [];
        if (aPlayers.length !== bPlayers.length) return false;

        const signatureA = createStateSignature(a);
        const signatureB = createStateSignature(b);
        return signatureA === signatureB;
    }

    function createStateSignature(state) {
        if (!state) {
            return 'null';
        }
        const parts = [
            `turn:${state.turn ?? 'n/a'}`,
            `phase:${state.phase ?? 'none'}`,
            `active:${state.active_player ?? 'n/a'}`,
            `priority:${state.priority_player ?? 'n/a'}`,
            `endStepPriority:${state.end_step_priority_passed ?? false}`,
            `stack:${state.stack?.length || 0}`
        ];

        if (Array.isArray(state.stack) && state.stack.length) {
            parts.push(
                'stackEntries:' +
                state.stack
                    .map((entry) => `${entry?.id || entry?.card_id || entry?.unique_id || 'unknown'}:${entry?.status || entry?.zone || ''}`)
                    .join(',')
            );
        }

        (Array.isArray(state.players) ? state.players : []).forEach((player, index) => {
            const manaPool = player?.mana_pool;
            const manaSnapshot = Array.isArray(manaPool)
                ? manaPool.join(',')
                : manaPool && typeof manaPool === 'object'
                    ? Object.keys(manaPool)
                        .sort()
                        .map((key) => `${key}:${manaPool[key]}`)
                        .join(',')
                    : '';
            parts.push(`player${index}:${player?.life ?? 'life'}:${manaSnapshot}`);

            PLAYER_ZONES_TO_TRACK.forEach((zone) => {
                const cards = Array.isArray(player?.[zone]) ? player[zone] : [];
                parts.push(`${zone}:${cards.length}`);
                if (zone === 'battlefield') {
                    parts.push(cards.map(summarizeCardState).join(','));
                }
            });
        });

        return parts.join('|');
    }

    function summarizeCardState(card) {
        if (!card) {
            return '';
        }
        const counters = serializeCounters(card.counters);
        const annotations = [
            card.tapped ? 'T' : '',
            card.attacking ? `A${card.attacking === true ? '1' : card.attacking}` : '',
            card.blocking ? `B${card.blocking}` : '',
            card.damage ? `D${card.damage}` : '',
            card.face_down ? 'FD' : '',
            card.summoning_sick ? 'S' : ''
        ].filter(Boolean).join('');
        const stats = [
            card.power ?? card.base_power ?? '',
            card.toughness ?? card.base_toughness ?? ''
        ].join('/');
        return `${card.unique_id || card.id || card.card_id || 'card'}:${annotations}:${stats}:${counters}`;
    }

    function serializeCounters(counterData) {
        if (!counterData || typeof counterData !== 'object') {
            return '';
        }
        return Object.keys(counterData)
            .sort()
            .map((key) => `${key}:${counterData[key]}`)
            .join(',');
    }

    onMount(() => {
        const unsubscribers = [
            gameId.subscribe((value) => {
                const hadGameId = Boolean(storeSnapshots.gameId);
                storeSnapshots.gameId = value;
                // Auto-connect when gameId becomes available
                if (value && !hadGameId && managerInitialized) {
                    // Check if we need to connect (not already connected or connecting)
                    const needsConnect = !websocket || 
                        websocket.readyState === WebSocket.CLOSED || 
                        websocket.readyState === WebSocket.CLOSING;
                    if (needsConnect) {
                        initWebSocket({ reason: 'store-update' });
                    }
                }
            }),
            selectedPlayer.subscribe((value) => {
                storeSnapshots.selectedPlayer = value || 'player1';
            }),
            gameState.subscribe((value) => {
                storeSnapshots.gameState = value;
            }),
            isPageVisible.subscribe((value) => {
                storeSnapshots.isVisible = Boolean(value);
            })
        ];

        installGlobals();
        managerInitialized = true;
        startVisibilityTracking();
        
        // Only attempt auto-connect if gameId is already available
        // Otherwise, the subscription above will trigger it when gameId is set
        if (storeSnapshots.gameId) {
            attemptAutoConnect();
        }

        return () => {
            unsubscribers.forEach((fn) => fn());
            stopVisibilityTracking();
            teardownSocket();
        };
    });

    $effect(() => {
        if (!managerInitialized) return;
        if (!storeSnapshots.gameId) return;
        if (!storeSnapshots.isVisible) return;
        // Allow reconnect from idle or error state when conditions are met
        if ((connectionState.status === 'idle' || connectionState.status === 'error') && !websocket) {
            initWebSocket({ reason: 'auto' });
        }
    });

    function attemptAutoConnect() {
        // Get gameId from store or GameCore
        const currentGameId = storeSnapshots.gameId || getGameIdSnapshot() || 
            (typeof GameCore !== 'undefined' && typeof GameCore.getGameId === 'function' ? GameCore.getGameId() : null);
        
        if (!currentGameId) {
            // No gameId yet, will be triggered by store subscription when available
            return;
        }
        
        if (websocket && websocket.readyState !== WebSocket.CLOSED) {
            // Already connected or connecting
            return;
        }
        
        initWebSocket({ reason: 'initial' });
    }

    function startVisibilityTracking() {
        if (typeof document === 'undefined' || visibilityCleanup) {
            return;
        }

        const handler = () => {
            const visible = !document.hidden;
            storeSnapshots.isVisible = visible;
            setPageVisible(visible);
            if (visible && !websocket && storeSnapshots.gameId) {
                initWebSocket({ reason: 'visibility' });
            }
        };

        document.addEventListener('visibilitychange', handler);
        visibilityCleanup = () => {
            document.removeEventListener('visibilitychange', handler);
            visibilityCleanup = null;
        };
    }

    function stopVisibilityTracking() {
        if (visibilityCleanup) {
            visibilityCleanup();
        }
    }

    function initWebSocket({ reason = 'manual' } = {}) {
        // Get gameId from multiple sources to ensure we have the latest value
        const currentGameId = storeSnapshots.gameId || getGameIdSnapshot() || 
            (typeof GameCore !== 'undefined' && typeof GameCore.getGameId === 'function' ? GameCore.getGameId() : null);
        
        if (!currentGameId) {
            connectionState.lastError = 'Game ID not set';
            connectionState.status = 'idle';
            return;
        }

        // Update local snapshot if we got it from elsewhere
        if (!storeSnapshots.gameId && currentGameId) {
            storeSnapshots.gameId = currentGameId;
        }

        teardownSocket({ silent: true });

        connectionState.status = reason === 'auto' || reason === 'store-update' ? 'connecting' : reason === 'visibility' ? 'reconnecting' : 'connecting';
        connectionState.reason = reason;
        connectionState.attempts += 1;
        connectionState.lastError = null;

        const player = getSelectedPlayer();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/game/${currentGameId}?player=${player}`;

        try {
            const socket = new WebSocket(wsUrl);
            websocket = socket;

            socket.onopen = handleSocketOpen;
            socket.onmessage = handleSocketMessage;
            socket.onerror = handleSocketError;
            socket.onclose = handleSocketClose;
        } catch (error) {
            handleSocketError(error);
        }
    }

    function teardownSocket({ silent = false } = {}) {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        if (websocket) {
            try {
                websocket.onopen = null;
                websocket.onmessage = null;
                websocket.onerror = null;
                websocket.onclose = null;
                if (!silent && websocket.readyState === WebSocket.OPEN) {
                    websocket.close();
                }
            } finally {
                websocket = null;
            }
        }
    }

    function scheduleReconnect() {
        if (!storeSnapshots.gameId) {
            return;
        }

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }

        connectionState.status = 'reconnecting';
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            initWebSocket({ reason: 'reconnect' });
        }, reconnectDelay);
    }

    function handleSocketOpen() {
        connectionState.status = 'connected';
        connectionState.lastError = null;
        connectionState.lastEventAt = Date.now();

        // Stop HTTP polling since WebSocket is now connected
        if (typeof window !== 'undefined' && 
            window.GameCore && 
            typeof window.GameCore.stopAutoRefresh === 'function') {
            window.GameCore.stopAutoRefresh();
        }

        sendRawMessage({
            type: 'player_joined',
            player: getSelectedPlayer(),
            timestamp: Date.now()
        });

        requestGameState();
    }

    function handleSocketMessage(event) {
        connectionState.lastEventAt = Date.now();
        let parsed = null;
        try {
            parsed = JSON.parse(event.data);
        } catch {
            connectionState.lastError = 'Malformed message';
            return;
        }

        handleWebSocketMessage(parsed);
    }

    function handleSocketError(_error) {
        connectionState.lastError = _error?.message || 'WebSocket error';
        connectionState.status = 'error';
        
        // Start HTTP polling as fallback when WebSocket fails
        if (typeof window !== 'undefined' && 
            window.GameCore && 
            typeof window.GameCore.startAutoRefresh === 'function') {
            window.GameCore.startAutoRefresh();
        }
    }

    function handleSocketClose() {
        const wasConnected = connectionState.status === 'connected';
        teardownSocket({ silent: true });

        if (!storeSnapshots.isVisible) {
            connectionState.status = 'idle';
            return;
        }

        if (wasConnected) {
            scheduleReconnect();
            // Start HTTP polling as fallback while reconnecting
            if (typeof window !== 'undefined' && 
                window.GameCore && 
                typeof window.GameCore.startAutoRefresh === 'function') {
                window.GameCore.startAutoRefresh();
            }
        } else {
            connectionState.status = 'idle';
        }
    }

    function requestGameState() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            sendRawMessage({
                type: 'request_game_state',
                timestamp: Date.now()
            });
        }
    }

    function sendRawMessage(payload) {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify(payload));
        }
    }

    function sendGameAction(actionType, actionData = {}) {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        sendRawMessage({
            type: 'game_action',
            action: actionType,
            data: actionData,
            timestamp: Date.now()
        });
    }

    function sendChatMessage(messageText, options = {}) {
        const trimmed = (messageText || '').trim();
        if (!trimmed) {
            return { success: false, error: 'empty_message' };
        }

        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            return { success: false, error: 'WebSocket disconnected' };
        }

        const sender = options.playerName || getLocalPlayerInfo().name;
        const timestamp = typeof options.timestamp === 'number' ? options.timestamp : Date.now();

        sendRawMessage({
            type: 'chat',
            player: sender,
            message: trimmed,
            timestamp
        });

        return { success: true };
    }

    function connectWebSocket(id) {
        teardownSocket();
        updateGameId(id);
        initWebSocket({ reason: 'manual' });
    }

    function sendArenaGameAction(action, cardId = null, extraData = {}) {
        const payload = {
            action,
            card_id: cardId,
            player: getSelectedPlayer(),
            ...extraData
        };
        sendGameAction(action, payload);
    }

    function playCard(cardId) {
        sendArenaGameAction('play_card', cardId);
    }

    function addChatMessage(player, message) {
        if (
            typeof UIBattleChat !== 'undefined' &&
            UIBattleChat &&
            typeof UIBattleChat.addMessage === 'function'
        ) {
            UIBattleChat.addMessage(player, message, { origin: 'legacy' });
        }
    }

    async function handleWebSocketMessage(message) {
        switch (message.type) {
            case 'game_state_update':
                await handleGameStateUpdate(message);
                break;
            case 'game_action_start':
                break;
            case 'game_action_failed':
                console.error('WebSocket action failed', message);
                recordActionFailure(message.action, message.error, message.player);
                break;
            case 'action_error':
                console.error('WebSocket reported action error', message);
                recordActionFailure(message.action, message.message, message.player);
                break;
            case 'chat':
                handleRemoteChat(message);
                break;
            case 'targeting_arrow':
                handleTargetingArrow(message);
                break;
            case 'random_animation':
                handleRandomAnimation(message);
                break;
            case 'player_status':
                break;
            case 'connection_established':
                break;
            case 'state_sync':
                break;
            case 'ping':
                sendRawMessage({ type: 'pong', timestamp: message.timestamp });
                break;
            case 'pong':
                break;
            case 'error':
                console.error('WebSocket server error message received', message);
                recordActionFailure('server_error', message.message);
                break;
            default:
                break;
        }
    }

    function handleRandomAnimation(message) {
        const { animation_type, result, player } = message;
        if (typeof window !== 'undefined' && window.RandomButton && typeof window.RandomButton.playAnimation === 'function') {
            window.RandomButton.playAnimation(animation_type, result, player);
        }
    }

    async function handleGameStateUpdate(message) {
        const newGameState = message.game_state;
        const hydratedGameState = await hydrateGameState(newGameState);
        const currentGameState = getGameState();
        const actionResult = message.action_result;
        const isPreviewUpdate = Boolean(
            actionResult &&
            (actionResult.action === 'preview_attackers' || actionResult.action === 'preview_blockers')
        );

        // Fast check: compare turn/phase/timestamp first before expensive JSON comparison
        const hasQuickChange = !currentGameState ||
            hydratedGameState?.turn !== currentGameState?.turn ||
            hydratedGameState?.phase !== currentGameState?.phase ||
            hydratedGameState?.timestamp !== currentGameState?.timestamp;

        // Always refresh if there's an action result - means something changed
        const hasActionResult = Boolean(actionResult);
        
        if (hasQuickChange || hasActionResult || !shallowEqualState(hydratedGameState, currentGameState)) {
            const oldGameState = currentGameState;
            await updateGameState(hydratedGameState);
            let handledPreview = false;
            if (isPreviewUpdate && window.GameCombat && hydratedGameState?.combat_state) {
                const combatState = hydratedGameState.combat_state;
                if (actionResult.action === 'preview_attackers') {
                    const pendingAttackers = Array.isArray(combatState.pending_attackers)
                        ? combatState.pending_attackers
                        : [];
                    window.GameCombat.applyPendingAttackerVisuals?.(pendingAttackers);
                    handledPreview = true;
                } else if (actionResult.action === 'preview_blockers') {
                    const pendingBlockers =
                        combatState.pending_blockers && typeof combatState.pending_blockers === 'object'
                            ? combatState.pending_blockers
                            : {};
                    window.GameCombat.applyPendingBlockerVisuals?.(pendingBlockers);
                    handledPreview = true;
                }
            }

            if (!handledPreview) {
                refreshGameUI(oldGameState);
            }

            const oldPhase = oldGameState?.phase;
            const newPhase = hydratedGameState?.phase;
            if (
                oldPhase !== newPhase &&
                window.GameCombat &&
                typeof window.GameCombat.onPhaseChange === 'function'
            ) {
                window.GameCombat.onPhaseChange(newPhase);
            }

            if (
                window.GameCombat &&
                ['attack', 'block', 'damage'].includes(hydratedGameState?.phase)
            ) {
                handleCombatStateUpdate(oldGameState, hydratedGameState, message.action_result);
            }
        }

        if (actionResult) {
            recordActionResult(actionResult);
        }

        if (
            hydratedGameState &&
            Array.isArray(hydratedGameState.action_history)
        ) {
            mergeActionHistoryEntries(hydratedGameState.action_history);
        }
        if (
            hydratedGameState &&
            Array.isArray(hydratedGameState.chat_log) &&
            typeof UIBattleChat !== 'undefined' &&
            typeof UIBattleChat.loadChatLog === 'function'
        ) {
            UIBattleChat.loadChatLog(hydratedGameState.chat_log);
        }
    }

    function handleRemoteChat(message) {
        const selected = getSelectedPlayer();
        const senderName = getPlayerDisplayName(message.player) || message.player || 'Unknown';
        let localName = getPlayerDisplayName(selected);

        if (!localName) {
            localName = formatSeatFallback(selected);
        }

        if (senderName !== localName) {
            if (
                typeof UIBattleChat !== 'undefined' &&
                UIBattleChat &&
                typeof UIBattleChat.addMessage === 'function'
            ) {
                UIBattleChat.addMessage(senderName, message.message, {
                    timestamp: message.timestamp,
                    origin: 'remote'
                });
            }
        }
    }

    function handleTargetingArrow(message) {
        if (!window.GameCards) return;

        const action = message.action;
        const sourceId = message.source_id;
        const targetId = message.target_id;

        if (action === 'add' && sourceId && targetId) {
            // Add to store and draw the arrow visually
            addTargetingArrow(sourceId, targetId);
            if (typeof window.GameCards.drawTargetingArrow === 'function') {
                window.GameCards.drawTargetingArrow(sourceId, targetId);
            }
        } else if (action === 'remove' && sourceId) {
            removeTargetingArrow(sourceId, targetId);
            if (typeof window.GameCards.removeTargetingArrowElement === 'function') {
                window.GameCards.removeTargetingArrowElement(sourceId, targetId);
            }
        } else if (action === 'clear' && sourceId) {
            if (typeof window.GameCards.removeAllArrowsFromCardElement === 'function') {
                window.GameCards.removeAllArrowsFromCardElement(sourceId, false);
            }
        } else if (action === 'clear_all') {
            if (typeof window.GameCards.clearAllTargetingArrowElements === 'function') {
                window.GameCards.clearAllTargetingArrowElements(false);
            }
        }
    }

    function sendTargetingArrow(action, sourceId, targetId = null) {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            return;
        }
        sendRawMessage({
            type: 'targeting_arrow',
            action: action,
            source_id: sourceId,
            target_id: targetId,
            timestamp: Date.now()
        });
    }

    function refreshGameUI(_previousGameState = null) {
        UIRenderersTemplates?.renderGameArena?.();
        UIZonesManager?.updateZoneCounts?.();
        UIZonesManager?.refreshOpenZonePopups?.(getGameState());
        if (typeof UIZonesManager !== 'undefined' && UIZonesManager) {
            UIZonesManager.hydrateSvelteZones?.();
        }

        const gameStateValue = getGameState();
        if (
            gameStateValue &&
            ['attack', 'block', 'damage'].includes(gameStateValue.phase) &&
            window.GameCombat
        ) {
            requestAnimationFrame(() => {
                redrawCombatArrows(gameStateValue);
            });
        }

        // Load and redraw targeting arrows from game state
        if (window.GameCards && gameStateValue) {
            requestAnimationFrame(() => {
                if (typeof window.GameCards.loadArrowsFromGameState === 'function') {
                    window.GameCards.loadArrowsFromGameState(gameStateValue);
                } else if (typeof window.GameCards.redrawAllTargetingArrows === 'function') {
                    window.GameCards.redrawAllTargetingArrows();
                }
            });
        }
    }

    function redrawCombatArrows(gameStateValue) {
        if (!gameStateValue || !window.GameCombat) {
            return;
        }
        window.GameCombat.redrawCombatArrowsFromState?.(gameStateValue);
    }

    function recordActionResult(actionResult) {
        if (!actionResult) {
            return;
        }
        addActionHistoryFromActionResult(actionResult, { source: 'websocket' });
    }

    function recordActionFailure(action, message, player = null) {
        if (!action) {
            return;
        }
        addActionHistoryFailure(action, message, player);
    }

    function handleCombatStateUpdate(oldGameState, newGameState, actionResult) {
        if (!oldGameState || !newGameState || !window.GameCombat) return;

        const oldCombatState = oldGameState.combat_state || {};
        const newCombatState = newGameState.combat_state || {};
        const stepChanged = newCombatState.step !== oldCombatState.step;
        const attackersUpdated = newCombatState.attackers_declared && !oldCombatState.attackers_declared;
        const blockersUpdated = newCombatState.blockers_declared && !oldCombatState.blockers_declared;
        const currentPlayer = getSelectedPlayer();

        if (window.GameCombat) {
            if (Array.isArray(newCombatState.pending_attackers)) {
                if (!newCombatState.expected_player || newCombatState.expected_player === currentPlayer) {
                    window.GameCombat.attackers = new Set(newCombatState.pending_attackers);
                }
            }

            if (newCombatState && typeof newCombatState.pending_blockers === 'object' && newCombatState.pending_blockers !== null) {
                if (newCombatState.expected_player === currentPlayer || Object.keys(newCombatState.pending_blockers).length === 0) {
                    window.GameCombat.blockers = new Map(Object.entries(newCombatState.pending_blockers));
                }
            }
        }

        if (attackersUpdated || blockersUpdated) {
            applyCombatAnimations(newGameState);
        }

        if (stepChanged) {
            if (newCombatState.step === 'declare_attackers') {
                if (!newCombatState.expected_player || newCombatState.expected_player === currentPlayer) {
                    // Use microtask for immediate execution after current task
                    queueMicrotask(() => {
                        window.GameCombat?.startAttackStep?.();
                    });
                }
            } else if (newCombatState.step === 'declare_blockers') {
                if (newCombatState.expected_player === currentPlayer) {
                    queueMicrotask(() => {
                        window.GameCombat?.startDefenseStep?.();
                    });
                }
            } else if (newCombatState.step === 'end_of_combat' || newCombatState.step === 'none') {
                if (window.GameCombat) {
                    window.GameCombat.combatMode = null;
                    window.GameCombat.clearHighlights?.();
                    window.GameCombat.clearArrows?.();
                }
            }
        }

        if (actionResult && (actionResult.action === 'preview_attackers' || actionResult.action === 'preview_blockers')) {
            applyCombatAnimations(newGameState);
        } else if (actionResult && actionResult.action === 'declare_attackers') {
            applyCombatAnimations(newGameState);

            const currentPlayerId = getSelectedPlayer();
            const activePlayerIndex = newGameState.active_player || 0;
            const currentPlayerIndex = currentPlayerId === 'player2' ? 1 : 0;
            const isDefendingPlayer = currentPlayerIndex !== activePlayerIndex;

            if (isDefendingPlayer) {
                queueMicrotask(() => {
                    window.GameCombat?.startDefenseStep?.();
                });
            }
        } else if (actionResult && actionResult.action === 'declare_blockers') {
            applyCombatAnimations(newGameState);
        } else {
            const oldAttackers = getAttackingCreatures(oldGameState);
            const newAttackers = getAttackingCreatures(newGameState);

            if (newAttackers.length > oldAttackers.length) {
                applyCombatAnimations(newGameState);

                const currentPlayerId = getSelectedPlayer();
                const activePlayerIndex = newGameState.active_player || 0;
                const currentPlayerIndex = currentPlayerId === 'player2' ? 1 : 0;
                const isDefendingPlayer = currentPlayerIndex !== activePlayerIndex;

                if (isDefendingPlayer) {
                    queueMicrotask(() => {
                        window.GameCombat?.startDefenseStep?.();
                    });
                }
            }

            const oldBlockers = getBlockingCreatures(oldGameState);
            const newBlockers = getBlockingCreatures(newGameState);

            if (newBlockers.length > oldBlockers.length) {
                applyCombatAnimations(newGameState);
            }
        }
    }

    function getAttackingCreatures(gameStateValue) {
        if (!gameStateValue || !gameStateValue.players) return [];
        const allAttackers = [];
        gameStateValue.players.forEach(player => {
            if (player.battlefield) {
                player.battlefield.forEach(card => {
                    if (card.attacking) {
                        allAttackers.push(card.unique_id);
                    }
                });
            }
        });
        return allAttackers;
    }

    function getBlockingCreatures(gameStateValue) {
        if (!gameStateValue || !gameStateValue.players) return [];
        const allBlockers = [];
        gameStateValue.players.forEach(player => {
            if (player.battlefield) {
                player.battlefield.forEach(card => {
                    if (card.blocking) {
                        allBlockers.push(card.unique_id);
                    }
                });
            }
        });
        return allBlockers;
    }

    function applyCombatAnimations(gameStateValue) {
        if (!gameStateValue || !window.GameCombat) {
            return;
        }
        window.GameCombat.applyCombatVisualsFromState?.(gameStateValue);
    }

    function getSelectedPlayer() {
        if (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function') {
            return GameCore.getSelectedPlayer();
        }
        return storeSnapshots.selectedPlayer;
    }

    function _getGameId() {
        if (typeof GameCore !== 'undefined' && typeof GameCore.getGameId === 'function') {
            return GameCore.getGameId();
        }
        return storeSnapshots.gameId;
    }

    function getGameState() {
        if (typeof GameCore !== 'undefined' && typeof GameCore.getGameState === 'function') {
            return GameCore.getGameState();
        }
        return storeSnapshots.gameState;
    }

    async function updateGameState(state) {
        // Hydrate compact format to legacy format if needed
        const hydratedState = await hydrateGameState(state);

        // Set state directly to store (already hydrated, skip GameCore.setGameState which would re-hydrate)
        setGameState(hydratedState);
        storeSnapshots.gameState = hydratedState;
    }

    function updateGameId(id) {
        if (typeof GameCore !== 'undefined' && typeof GameCore.setGameId === 'function') {
            GameCore.setGameId(id);
        } else {
            setGameId(id);
        }
        storeSnapshots.gameId = id;
    }

    function getPlayerDisplayName(playerKey) {
        return resolvePlayerDisplayName(playerKey, {
            getCoreDisplayName:
                typeof GameCore !== 'undefined' && typeof GameCore.getPlayerDisplayName === 'function'
                    ? GameCore.getPlayerDisplayName
                    : null
        });
    }

    function getLocalPlayerInfo() {
        const playerKey = getSelectedPlayer() || 'player1';
        return {
            id: playerKey,
            name: getPlayerDisplayName(playerKey)
        };
    }

    function installGlobals() {
        if (typeof window === 'undefined') {
            return;
        }

        const api = {
            init: () => attemptAutoConnect(),
            initWebSocket: () => initWebSocket({ reason: 'manual' }),
            requestGameState,
            sendGameAction,
            sendChatMessage,
            sendTargetingArrow,
            handleWebSocketMessage,
            connectWebSocket,
            sendArenaGameAction,
            playCard,
            addChatMessage,
            _refreshGameUI: refreshGameUI,
            _redrawCombatArrows: redrawCombatArrows,
            _handleCombatStateUpdate: handleCombatStateUpdate,
            _applyCombatAnimations: applyCombatAnimations,
            _recordActionResult: recordActionResult,
            _recordActionFailure: recordActionFailure,
            getLocalPlayerInfo
        };

        Object.defineProperty(api, 'websocket', {
            get: () => websocket,
            set: (value) => { websocket = value; }
        });

        window.WebSocketManager = api;

        window.GameSocket = {
            initWebSocket: () => initWebSocket({ reason: 'manual' }),
            requestGameState,
            sendGameAction,
            handleWebSocketMessage
        };

        window.connectWebSocket = connectWebSocket;
        window.sendGameAction = sendArenaGameAction;
        window.playCard = playCard;
        window.addChatMessage = addChatMessage;

        if (!Object.getOwnPropertyDescriptor(window, 'websocket')) {
            Object.defineProperty(window, 'websocket', {
                get: () => websocket,
                set: (value) => { websocket = value; }
            });
        }
    }
</script>
