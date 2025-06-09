/**
 * ManaForge Game Core Module
 * Handles core game functionality, initialization and global state
 */

// ===== GLOBAL VARIABLES =====
let currentSelectedPlayer = 'player1';
let gameState = null; // Will be initialized from template
let autoRefreshInterval = null;
let isPageVisible = true;
let websocket = null;
let gameId = null; // Will be initialized from template

// ===== INITIALIZATION FUNCTION =====
async function initializeGame() {
    console.log('ManaForge Game Interface initializing...');
    
    // Initialize from template data
    if (window.gameData) {
        gameState = window.gameData.game;
        gameId = window.gameData.gameId;
    }
    
    // Get player from URL or default to player1
    const playerFromUrl = GameUtils.getPlayerFromUrl();
    currentSelectedPlayer = playerFromUrl;
    
    // Initialize UI components safely
    await GameUI.initializeGameUI();
    
    // Initialize zone previews
    ZoneManager.updateZoneCounts();
    ZoneManager.updateZonePreviews();
    
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
            if (!websocket || websocket.readyState === WebSocket.CLOSED) {
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

// ===== AUTO-REFRESH FUNCTIONALITY =====
async function refreshGameData() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        GameSocket.requestGameState();
        return;
    }
    
    try {
        const response = await fetch(`/api/v1/games/${gameId}/state`);
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

// ===== INITIALIZATION (Dom Ready) =====
// NOTE: Initialization is handled by game-main.js to avoid double loading
// This legacy initialization is kept for reference but disabled
/*
document.addEventListener('DOMContentLoaded', function() {
    // Legacy initialization for inline templates
    if (!window.gameData) {
        console.log('Legacy mode: game data not found in window.gameData');
        return;
    }
    initializeGame();
});
*/

// Export core module functionality to global scope
window.GameCore = {
    initializeGame,
    refreshGameData,
    startAutoRefresh,
    stopAutoRefresh,
    // Expose getters for state variables
    getGameState: () => gameState,
    getGameId: () => gameId,
    getSelectedPlayer: () => currentSelectedPlayer,
    setGameState: (state) => { gameState = state; },
    setSelectedPlayer: (player) => { currentSelectedPlayer = player; }
};
