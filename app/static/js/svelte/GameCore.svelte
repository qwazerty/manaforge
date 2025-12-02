<svelte:options accessors={true} />

<script>
    import { onMount } from 'svelte';
    import {
        gameState,
        gameId,
        isPageVisible,
        selectedPlayer,
        getGameStateSnapshot,
        getGameIdSnapshot,
        getPageVisibleSnapshot,
        getSelectedPlayerSnapshot,
        setGameId,
        setGameState,
        setPageVisible,
        setSelectedPlayer
    } from './stores/gameCoreStore.js';
    import { loadActionHistoryFromState } from './stores/actionHistoryStore.js';

    let autoRefreshInterval = null;
    let persistentUiLoaded = false;
    let visibilityCleanup = null;
    let moduleReadyTimer = null;
    let gameInitialized = false;
    let combatInitialized = false;

    const getGameState = () => getGameStateSnapshot();
    const getGameId = () => getGameIdSnapshot();
    const getSelectedPlayer = () => getSelectedPlayerSnapshot();

    function normalizePlayerSeatKey(identifier) {
        if (!identifier || typeof identifier !== 'string') {
            return null;
        }

        const trimmed = identifier.trim();
        if (!trimmed) {
            return null;
        }

        const normalized = trimmed.toLowerCase();
        const collapsed = normalized.replace(/\s+/g, '');

        if (normalized === 'player1' || collapsed === 'player1' || normalized === 'p1') {
            return 'player1';
        }
        if (normalized === 'player2' || collapsed === 'player2' || normalized === 'p2') {
            return 'player2';
        }

        const match = normalized.match(/player\s*(\d+)/);
        if (match) {
            return `player${match[1]}`;
        }

        return null;
    }

    function getSeatFallbackLabel(seatKey) {
        if (seatKey === 'player1') {
            return 'Player 1';
        }
        if (seatKey === 'player2') {
            return 'Player 2';
        }
        return 'Player';
    }

    function lookupPlayerAlias(seatKey) {
        if (!seatKey) {
            return null;
        }

        const state = getGameState();
        if (!state) {
            return null;
        }

        const players = Array.isArray(state.players) ? state.players : [];
        const seatIndex = seatKey === 'player2' ? 1 : 0;

        if (seatIndex >= 0 && seatIndex < players.length) {
            const candidate = players[seatIndex];
            if (candidate) {
                const directName = typeof candidate.name === 'string' ? candidate.name.trim() : '';
                if (directName) {
                    return directName;
                }
                const fallbackName = typeof candidate.player_name === 'string' ? candidate.player_name.trim() : '';
                if (fallbackName) {
                    return fallbackName;
                }
            }
        }

        const matchById = players.find(
            (player) => player && typeof player.id === 'string' && player.id.toLowerCase() === seatKey
        );
        if (matchById) {
            const name = typeof matchById.name === 'string' ? matchById.name.trim() : '';
            if (name) {
                return name;
            }
            const alias = typeof matchById.player_name === 'string' ? matchById.player_name.trim() : '';
            if (alias) {
                return alias;
            }
        }

        const statusMap = state.player_status;
        const statusEntry = statusMap && statusMap[seatKey];
        if (statusEntry && typeof statusEntry.player_name === 'string') {
            const sanitized = statusEntry.player_name.trim();
            if (sanitized) {
                return sanitized;
            }
        }

        if (state.player_names && typeof state.player_names === 'object') {
            const named = state.player_names[seatKey];
            if (typeof named === 'string') {
                const clean = named.trim();
                if (clean) {
                    return clean;
                }
            }
        }

        return null;
    }

    function resolvePlayerDisplayName(identifier, fallback = null) {
        if (identifier === null || identifier === undefined) {
            return fallback || 'Unknown';
        }

        if (typeof identifier !== 'string') {
            return String(identifier);
        }

        const trimmed = identifier.trim();
        if (!trimmed) {
            return fallback || 'Unknown';
        }

        const normalized = trimmed.toLowerCase();
        if (normalized === 'spectator') {
            return 'Spectator';
        }

        const seatKey = normalizePlayerSeatKey(trimmed);
        if (seatKey) {
            const alias = lookupPlayerAlias(seatKey);
            if (alias) {
                return alias;
            }
            return getSeatFallbackLabel(seatKey);
        }

        return trimmed;
    }

    function getLocalPlayerSeat() {
        const seatFromUrl = GameUtils?.getPlayerFromUrl?.();
        return seatFromUrl || getSelectedPlayer();
    }

    function isSpectatorSeat(seat) {
        return typeof seat === 'string' && seat.trim().toLowerCase() === 'spectator';
    }

    function updateEndGameButtonState(player = null) {
        if (typeof document === 'undefined') {
            return;
        }

        const seat = player || getLocalPlayerSeat();
        const normalizedSeat = normalizePlayerSeatKey(seat);
        const spectator = isSpectatorSeat(seat);
        const restrictControl = spectator || !normalizedSeat;
        const buttons = [
            {
                element: document.getElementById('end-game-btn'),
                title: restrictControl
                    ? 'Only seated players can end the game'
                    : 'End Game'
            },
            {
                element: document.getElementById('restart-game-btn'),
                title: restrictControl
                    ? 'Only seated players can restart the game'
                    : 'Restart Game'
            }
        ];

        buttons.forEach(({ element, title }) => {
            if (!element) {
                return;
            }

            const isLocked = element.dataset?.locked === 'true';
            element.classList.toggle('hidden', restrictControl);
            element.setAttribute('aria-hidden', restrictControl ? 'true' : 'false');
            element.setAttribute('aria-disabled', restrictControl ? 'true' : 'false');
            element.title = title;

            if (!isLocked) {
                element.disabled = restrictControl;
            }
        });
    }

    function updateSpectatorModeClass(player = null) {
        if (typeof document === 'undefined') {
            return;
        }

        const seat = player || getSelectedPlayer();
        const spectator = isSpectatorSeat(seat);
        const body = document.body;

        if (body) {
            body.classList.toggle('spectator-mode', spectator);
        }

        document.querySelectorAll('.game-container-1080').forEach((container) => {
            container.classList.toggle('spectator-mode', spectator);
        });

        updateEndGameButtonState(seat);
    }

    function syncPersistentUi(state, { force = false } = {}) {
        if (!state) {
            return;
        }

        if (persistentUiLoaded && !force) {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(state, 'action_history')) {
            const historyEntries = Array.isArray(state.action_history)
                ? state.action_history
                : [];
            loadActionHistoryFromState(historyEntries);
        }

        if (
            typeof UIBattleChat !== 'undefined' &&
            typeof UIBattleChat.loadChatLog === 'function'
        ) {
            if (Object.prototype.hasOwnProperty.call(state, 'chat_log')) {
                const chatEntries = Array.isArray(state.chat_log)
                    ? state.chat_log
                    : [];
                UIBattleChat.loadChatLog(chatEntries);
            }
        }

        persistentUiLoaded = true;
    }

    function readGameConfig() {
        const root = typeof document !== 'undefined'
            ? document.getElementById('game-interface-root')
            : null;

        let parsed = {};
        const datasetConfig = root?.dataset?.gameConfig;
        if (datasetConfig) {
            try {
                parsed = JSON.parse(datasetConfig);
            } catch (error) {
                console.warn('Unable to parse game configuration dataset', error);
            }
        }

        if (typeof window !== 'undefined' && window.gameData) {
            parsed = { ...parsed, ...window.gameData };
        }

        return {
            gameId: parsed.gameId || null,
            playerId: parsed.playerId || null
        };
    }

    /**
     * Applies a new game state to the UI, regenerating all visual components.
     * @param {Object} state - The game state object
     * @param {Object} options - Options for UI sync
     * @param {boolean} options.forceSync - Force persistent UI sync
     */
    function applyGameStateToUi(state, { forceSync = false } = {}) {
        if (!state) {
            return;
        }

        setGameState(state);
        syncPersistentUi(state, { force: forceSync });

        if (window.GameUI) {
            GameUI.generateLeftArea();
            GameUI.generateGameBoard();
            GameUI.generateActionPanel();
        }

        if (typeof ZoneManager !== 'undefined' && typeof ZoneManager.updateZoneCounts === 'function') {
            ZoneManager.updateZoneCounts();
        }

        if (window.GameCombat && typeof window.GameCombat.onPhaseChange === 'function') {
            window.GameCombat.onPhaseChange(state?.phase);
        }

        if (window.WebSocketManager && typeof window.WebSocketManager._applyCombatAnimations === 'function') {
            setTimeout(() => {
                window.WebSocketManager._applyCombatAnimations(state);
            }, 60);
        }
    }

    async function loadGameState() {
        const id = getGameId();
        if (!id) {
            throw new Error('Game ID not set');
        }

        const response = await fetch(`/api/v1/games/${id}/ui-data`);
        if (!response.ok) {
            throw new Error(`Failed to load game state: ${response.status}`);
        }

        const state = await response.json();
        applyGameStateToUi(state, { forceSync: true });
    }

    async function refreshGameData() {
        // Skip HTTP polling entirely if WebSocket is connected
        const socket = typeof window !== 'undefined' ? window.websocket : null;
        if (socket && socket.readyState === WebSocket.OPEN) {
            // WebSocket is handling updates - no need for HTTP polling
            return;
        }

        // Also check WebSocketManager connection state
        if (typeof window !== 'undefined' && 
            window.WebSocketManager && 
            window.WebSocketManager.websocket?.readyState === WebSocket.OPEN) {
            return;
        }

        const id = getGameId();
        if (!id) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/games/${id}/ui-data`);
            if (response.ok) {
                const newGameState = await response.json();
                const currentState = getGameState();

                if (JSON.stringify(newGameState) !== JSON.stringify(currentState)) {
                    const oldPhase = currentState?.phase;
                    setGameState(newGameState);
                    const newPhase = newGameState?.phase;

                    GameUI.generateLeftArea();
                    GameUI.generateGameBoard();
                    GameUI.generateActionPanel();
                    if (
                        Array.isArray(newGameState.chat_log) &&
                        typeof UIBattleChat !== 'undefined' &&
                        typeof UIBattleChat.loadChatLog === 'function'
                    ) {
                        UIBattleChat.loadChatLog(newGameState.chat_log);
                    }
                    if (
                        oldPhase !== newPhase &&
                        window.GameCombat &&
                        typeof window.GameCombat.onPhaseChange === 'function'
                    ) {
                        window.GameCombat.onPhaseChange(newPhase);
                    }
                }
            }
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }

    function startAutoRefresh() {
        // Don't start polling if WebSocket is already connected
        const socket = typeof window !== 'undefined' ? window.websocket : null;
        if (socket && socket.readyState === WebSocket.OPEN) {
            return;
        }
        if (typeof window !== 'undefined' && 
            window.WebSocketManager && 
            window.WebSocketManager.websocket?.readyState === WebSocket.OPEN) {
            return;
        }

        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        // Fallback polling only when WebSocket is not available (15s interval)
        autoRefreshInterval = setInterval(refreshGameData, 15000);
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    async function exportReplay() {
        const id = getGameId();
        if (!id) {
            console.error('No game ID available for export');
            return;
        }

        try {
            const response = await fetch(`/api/v1/games/${id}/replay`);
            if (!response.ok) {
                throw new Error('Failed to fetch replay data');
            }
            const data = await response.json();

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute('href', dataStr);
            downloadAnchorNode.setAttribute('download', `replay-${id}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (error) {
            console.error('Error exporting replay:', error);
            alert('Failed to export replay. Please try again later.');
        }
    }

    async function endGame() {
        const id = getGameId();
        if (!id) {
            console.error('No game ID available');
            return;
        }

        const localSeat = getLocalPlayerSeat();
        const normalizedSeat = normalizePlayerSeatKey(localSeat);
        if (!normalizedSeat) {
            alert('Only seated players can end the game.');
            console.warn('Blocked end game request from non-player seat', localSeat);
            return;
        }

        const confirmed = confirm('Are you sure you want to end this game? This action cannot be undone.');
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/games/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error('Failed to end game');
            }

            stopAutoRefresh();
            if (window.websocket) {
                window.websocket.close();
            }

            document.body.classList.add('game-ended');

            const endGameBtn = document.getElementById('end-game-btn');
            if (endGameBtn) {
                endGameBtn.disabled = true;
                endGameBtn.classList.add('opacity-50', 'cursor-not-allowed');
                endGameBtn.dataset.locked = 'true';
            }

            const restartBtn = document.getElementById('restart-game-btn');
            if (restartBtn) {
                restartBtn.disabled = true;
                restartBtn.classList.add('opacity-50', 'cursor-not-allowed');
                restartBtn.dataset.locked = 'true';
            }
        } catch (error) {
            console.error('Error ending game:', error);
            alert('Failed to end game. Please try again.');
        }
    }

    async function restartGame() {
        const id = getGameId();
        if (!id) {
            console.error('No game ID available');
            return;
        }

        const localSeat = getLocalPlayerSeat();
        const normalizedSeat = normalizePlayerSeatKey(localSeat);
        if (!normalizedSeat) {
            alert('Only seated players can restart the game.');
            console.warn('Blocked restart request from non-player seat', localSeat);
            return;
        }

        const confirmed = confirm('Restart the game with the same players and decks?');
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/games/${id}/restart`, {
                method: 'POST'
            });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(detail || 'Failed to restart game');
            }

            const result = await response.json();
            const state = result.game_state || result;

            applyGameStateToUi(state, { forceSync: true });

            if (window.WebSocketManager && typeof window.WebSocketManager.requestGameState === 'function') {
                window.WebSocketManager.requestGameState();
            }

            document.body.classList.remove('game-ended');

            [
                document.getElementById('end-game-btn'),
                document.getElementById('restart-game-btn')
            ].forEach((btn) => {
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    btn.dataset.locked = 'false';
                }
            });
        } catch (error) {
            console.error('Error restarting game:', error);
            alert('Failed to restart game. Please try again.');
        }
    }

    function setupVisibilityListener() {
        if (visibilityCleanup || typeof document === 'undefined') {
            return visibilityCleanup;
        }

        const initialVisibility = !document.hidden;
        setPageVisible(initialVisibility);

        const handler = () => {
            const visible = !document.hidden;
            setPageVisible(visible);
            if (visible) {
                // Check if WebSocket is connected before starting polling or refreshing
                const wsConnected = (window.websocket && window.websocket.readyState === WebSocket.OPEN) ||
                    (window.WebSocketManager?.websocket?.readyState === WebSocket.OPEN);
                
                if (!wsConnected) {
                    // Only start polling and refresh if WebSocket is not connected
                    startAutoRefresh();
                    if (window.GameSocket && typeof window.GameSocket.initWebSocket === 'function') {
                        window.GameSocket.initWebSocket();
                    }
                    refreshGameData();
                } else {
                    // WebSocket is connected, just request fresh state via WebSocket
                    if (window.WebSocketManager && typeof window.WebSocketManager.requestGameState === 'function') {
                        window.WebSocketManager.requestGameState();
                    }
                }
            } else {
                stopAutoRefresh();
            }
        };

        document.addEventListener('visibilitychange', handler);
        visibilityCleanup = () => document.removeEventListener('visibilitychange', handler);
        return visibilityCleanup;
    }

    async function initializeGame() {
        if (gameInitialized) {
            return;
        }
        const root = typeof document !== 'undefined'
            ? document.getElementById('game-interface-root')
            : null;
        if (!root) {
            return;
        }

        const config = readGameConfig();
        if (config.gameId) {
            setGameId(config.gameId);
        }

        const id = getGameId();
        if (!id) {
            console.error('Game ID not found in template data');
            return;
        }

        const playerFromUrl = getLocalPlayerSeat() || config.playerId || 'player1';
        setSelectedPlayer(playerFromUrl);
        updateSpectatorModeClass(playerFromUrl);
        if (typeof window !== 'undefined' && window.gameData) {
            window.gameData.playerId = playerFromUrl;
            window.gameData.gameId = id;
        }

        try {
            await loadGameState();
        } catch (error) {
            console.error('Failed to load initial game state:', error);
            return;
        }

        if (typeof ZoneManager !== 'undefined' && typeof ZoneManager.updateZoneCounts === 'function') {
            ZoneManager.updateZoneCounts();
        }

        if (window.GameSocket && typeof window.GameSocket.initWebSocket === 'function') {
            window.GameSocket.initWebSocket();
        }

        // Don't start auto-refresh here - WebSocket will handle updates
        // Auto-refresh will only start as fallback if WebSocket fails to connect
        // (handled by WebSocketManager on connection failure)
        setupVisibilityListener();
        gameInitialized = true;
    }

    function areModulesReady() {
        if (typeof window === 'undefined') {
            return false;
        }
        const required = ['GameSocket', 'GameUI', 'GameActions', 'GameUtils', 'GameCards', 'GameCombat'];
        return required.every((name) => typeof window[name] !== 'undefined');
    }

    function bootGameWhenReady() {
        if (gameInitialized) {
            return;
        }
        if (!areModulesReady()) {
            if (!moduleReadyTimer) {
                moduleReadyTimer = setTimeout(() => {
                    moduleReadyTimer = null;
                    bootGameWhenReady();
                }, 120);
            }
            return;
        }
        initializeGame();
        if (!combatInitialized && window.GameCombat && typeof window.GameCombat.init === 'function') {
            try {
                window.GameCombat.init();
            } catch (error) {
                console.error('GameCombat initialization failed', error);
            } finally {
                combatInitialized = true;
            }
        }
    }

    function attachDomReady() {
        if (typeof document === 'undefined') {
            return () => {};
        }

        const runner = () => {
            bootGameWhenReady();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runner);
            return () => document.removeEventListener('DOMContentLoaded', runner);
        }

        runner();
        return () => {};
    }

    const GameCoreApi = {
        initializeGame,
        refreshGameData,
        startAutoRefresh,
        stopAutoRefresh,
        updateSpectatorModeClass,
        exportReplay,
        endGame,
        restartGame,
        getGameState,
        getGameId,
        getSelectedPlayer,
        getPlayerDisplayName: (identifier, fallback = null) =>
            resolvePlayerDisplayName(identifier, fallback),
        setGameState: (state) => setGameState(state),
        setGameId: (id) => setGameId(id),
        setSelectedPlayer: (player) => {
            setSelectedPlayer(player);
            updateSpectatorModeClass(player);
        },
        isPageVisible: () => getPageVisibleSnapshot(),
        syncPersistentUi
    };

    if (typeof window !== 'undefined') {
        window.GameCore = GameCoreApi;
    }

    onMount(() => {
        const detachReady = attachDomReady();
        return () => {
            stopAutoRefresh();
            if (moduleReadyTimer) {
                clearTimeout(moduleReadyTimer);
                moduleReadyTimer = null;
            }
            if (visibilityCleanup) {
                visibilityCleanup();
                visibilityCleanup = null;
            }
            if (detachReady) {
                detachReady();
            }
        };
    });
</script>
