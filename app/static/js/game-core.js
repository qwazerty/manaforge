/**
 * ManaForge Game Core Module
 * Handles core game functionality, initialization and global state
 */

// ===== GLOBAL VARIABLES =====
let currentSelectedPlayer = 'player1';
let gameState = null; // Will be initialized from template
let autoRefreshInterval = null;
let isPageVisible = true;
let gameId = null; // Will be initialized from template
let persistentUiLoaded = false;

function updateSpectatorModeClass() {
    if (typeof document === 'undefined') {
        return;
    }

    const isSpectator = currentSelectedPlayer === 'spectator';
    const body = document.body;

    if (body) {
        body.classList.toggle('spectator-mode', isSpectator);
    }

    document.querySelectorAll('.game-container-1080').forEach((container) => {
        container.classList.toggle('spectator-mode', isSpectator);
    });
}

function syncPersistentUi(state, { force = false } = {}) {
    if (!state) {
        return;
    }

    if (persistentUiLoaded && !force) {
        return;
    }

    if (
        typeof UIActionHistory !== 'undefined' &&
        typeof UIActionHistory.loadFromState === 'function'
    ) {
        if (Object.prototype.hasOwnProperty.call(state, 'action_history')) {
            const historyEntries = Array.isArray(state.action_history)
                ? state.action_history
                : [];
            UIActionHistory.loadFromState(historyEntries);
        }
    }

    if (
        typeof UINotifications !== 'undefined' &&
        typeof UINotifications.loadChatLog === 'function'
    ) {
        if (Object.prototype.hasOwnProperty.call(state, 'chat_log')) {
            const chatEntries = Array.isArray(state.chat_log)
                ? state.chat_log
                : [];
            UINotifications.loadChatLog(chatEntries);
        }
    }

    persistentUiLoaded = true;
}

// ===== INITIALIZATION FUNCTION =====
async function initializeGame() {
    console.log('ManaForge Game Interface initializing...');
    
    // Initialize game ID from template data
    if (window.gameData) {
        gameId = window.gameData.gameId;
    }
    
    if (!gameId) {
        console.error('Game ID not found in template data');
        return;
    }
    
    // Load initial game state from API
    try {
        await loadGameState();
    } catch (error) {
        console.error('Failed to load initial game state:', error);
        return;
    }
    
    // Get player from URL or default to player1
    const playerFromUrl = GameUtils.getPlayerFromUrl();
    currentSelectedPlayer = playerFromUrl;
    updateSpectatorModeClass();
    
    // Initialize UI components safely
    // await GameUI.initializeGameUI();
    
    // Initialize zone counts
    ZoneManager.updateZoneCounts();
    
    // Initialize WebSocket connection
    GameSocket.initWebSocket();
    
    // Start auto-refresh as fallback
    startAutoRefresh();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        isPageVisible = !document.hidden;
        if (isPageVisible) {
            // Resume auto-refresh when page becomes visible
            startAutoRefresh();
            // Reconnect WebSocket if needed
            if (!window.websocket || window.websocket.readyState === WebSocket.CLOSED) {
                GameSocket.initWebSocket();
            }
            // Immediate refresh when coming back
            refreshGameData();
        } else {
            // Pause auto-refresh when page is hidden
            stopAutoRefresh();
        }
    });
    
    // Keyboard shortcuts for testing (optional)
    document.addEventListener('keydown', function(e) {
        if (e.key === '1') GameActions.changePlayer('player1');
        if (e.key === '2') GameActions.changePlayer('player2');
        if (e.key === '3') GameActions.changePlayer('spectator');
    });
}

// ===== GAME STATE LOADING =====
async function loadGameState() {
    try {
        const response = await fetch(`/api/v1/games/${gameId}/ui-data`);
        if (!response.ok) {
            throw new Error(`Failed to load game state: ${response.status}`);
        }
        
        gameState = await response.json();
        console.log('Initial game state loaded:', gameState);

        syncPersistentUi(gameState, { force: true });
        
        // Initialize UI with loaded state
        if (window.GameUI) {
            GameUI.generateLeftArea();
            GameUI.generateGameBoard();
            GameUI.generateActionPanel();
        }
        
    } catch (error) {
        console.error('Error loading game state:', error);
        throw error;
    }
}

// ===== AUTO-REFRESH FUNCTIONALITY =====
async function refreshGameData() {
    if (window.websocket && window.websocket.readyState === WebSocket.OPEN) {
        GameSocket.requestGameState();
        return;
    }
    
    try {
        const response = await fetch(`/api/v1/games/${gameId}/ui-data`);
        if (response.ok) {
            const newGameState = await response.json();
            
            if (JSON.stringify(newGameState) !== JSON.stringify(gameState)) {
                gameState = newGameState;
                console.log('Game state updated:', gameState);
                GameUI.generateLeftArea();
                GameUI.generateGameBoard();
                GameUI.generateActionPanel();
                GameUI.showAutoRefreshIndicator('🔄 HTTP Update');
            }
        }
    } catch (error) {
        console.error('Auto-refresh error:', error);
    }
}

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(refreshGameData, 5000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Export core module functionality to global scope
window.GameCore = {
    initializeGame,
    refreshGameData,
    startAutoRefresh,
    stopAutoRefresh,
    updateSpectatorModeClass,
    // Expose getters for state variables
    getGameState: () => gameState,
    getGameId: () => gameId,
    getSelectedPlayer: () => currentSelectedPlayer,
    setGameState: (state) => { gameState = state; },
    setGameId: (id) => { gameId = id; },
    setSelectedPlayer: (player) => {
        currentSelectedPlayer = player;
        updateSpectatorModeClass();
    },
    isPageVisible: () => isPageVisible,
    syncPersistentUi
};

// ===== MAIN ENTRY POINT =====
document.addEventListener('DOMContentLoaded', function() {
    // Check if all modules are loaded
    if (window.GameCore && 
        window.GameSocket && 
        window.GameUI && 
        window.GameActions && 
        window.GameUtils && 
        window.GameCards) {
        
        console.log('ManaForge game modules loaded successfully');
        // Initialize the game asynchronously
        window.GameCore.initializeGame();
    } else {
        console.error('Some ManaForge game modules failed to load');
    }
});
