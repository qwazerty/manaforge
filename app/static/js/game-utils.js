/**
 * ManaForge Game Utils Module
 * Utility functions for the game interface
 */

// ===== URL PARAMETER MANAGEMENT =====
function getPlayerFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const player = urlParams.get('player');
    return ['player1', 'player2', 'spectator'].includes(player) ? player : 'player1';
}

function setPlayerInUrl(playerType) {
    const url = new URL(window.location);
    url.searchParams.set('player', playerType);
    window.history.replaceState({}, '', url);
}

// ===== UTILITY FUNCTIONS =====
function escapeJavaScript(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// Export utils module functionality
window.GameUtils = {
    getPlayerFromUrl,
    setPlayerInUrl,
    escapeJavaScript
};
