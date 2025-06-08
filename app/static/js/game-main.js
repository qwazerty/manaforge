/**
 * ManaForge Game Interface - Main Entry Point
 * Loads all required modules and initializes the game
 */

// Game will be initialized via initializeGame() in game-core.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if all modules are loaded
    if (window.GameCore && 
        window.GameSocket && 
        window.GameUI && 
        window.GameActions && 
        window.GameUtils && 
        window.GameCards) {
        
        console.log('ManaForge game modules loaded successfully');
        // Initialize the game
        window.GameCore.initializeGame();
    } else {
        console.error('Some ManaForge game modules failed to load');
    }
});
