/**
 * ManaForge Global UI Functions
 * Contains global UI utilities and compatibility functions
 */

// Global GameUI object for compatibility
window.GameUI = window.GameUI || {};

// Global UI utilities
Object.assign(window.GameUI, {
    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen: function() {
        const container = document.querySelector('.game-container-1080');
        const header = document.querySelector('nav');
        const footer = document.querySelector('footer');
        if (container) {
            container.classList.toggle('fullscreen-mode');
            if (header) {
                header.classList.toggle('hidden');
            }
            if (footer) {
                footer.classList.toggle('hidden');
            }
        }
    },

    /**
     * Alpine.js game interface component
     */
    gameInterface: function() {
        return {
            // Alpine.js reactive data can be added here if needed
            init() {
                // This runs when Alpine.js initializes the component
                console.log('Game interface Alpine.js component initialized');
            }
        };
    },

    // Delegate functions to unified modules for backward compatibility
    updateRoleDisplay: () => UIRenderersTemplates.renderRoleDisplay(),
    generateLeftArea: () => UIRenderersTemplates.renderLeftArea(),
    generateGameBoard: () => UIRenderersTemplates.renderGameBoard(),
    generateActionPanel: () => UIRenderersTemplates.renderActionPanel(),
    
    showZoneModal: (zoneName) => UIZonesManager.showZoneModal(zoneName),
    closeZoneModal: (zoneName) => UIZonesManager.closeZoneModal(zoneName),
    updateZoneCounts: () => UIZonesManager.updateZoneCounts(),
    
    showNotification: (message, type) => UINotifications.showNotification(message, type),
    showAutoRefreshIndicator: (message, type) => UINotifications.showAutoRefreshIndicator(message, type),
    addChatMessage: (sender, message) => {
        if (
            typeof UIBattleChat !== 'undefined' &&
            UIBattleChat &&
            typeof UIBattleChat.addMessage === 'function'
        ) {
            UIBattleChat.addMessage(sender, message, { origin: 'legacy' });
        }
    },
    
    refreshAllUI: function() {
        try {
            this.updateRoleDisplay();
            this.generateLeftArea();
            this.generateGameBoard();
            this.generateActionPanel();
            this.updateZoneCounts();
            
            if (typeof UINotifications !== 'undefined') {
                UINotifications.showSuccessFeedback('UI refreshed successfully');
            }
        } catch (error) {
            console.error('Error refreshing UI:', error);
            if (typeof UINotifications !== 'undefined') {
                UINotifications.showErrorFeedback('Failed to refresh UI', error);
            }
        }
    }
});

// Handle ESC key to exit fullscreen
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const container = document.querySelector('.game-container-1080');
        if (container && container.classList.contains('fullscreen-mode')) {
            window.GameUI.toggleFullscreen();
        }
    }
});

// Export for compatibility
window.updateRoleDisplay = () => window.GameUI.updateRoleDisplay();
window.generateLeftArea = () => window.GameUI.generateLeftArea();
window.generateGameBoard = () => window.GameUI.generateGameBoard();
window.generateActionPanel = () => window.GameUI.generateActionPanel();
window.showZoneModal = (zoneName) => window.GameUI.showZoneModal(zoneName);
window.closeZoneModal = (zoneName) => window.GameUI.closeZoneModal(zoneName);
window.updateZoneCounts = () => window.GameUI.updateZoneCounts();
window.showNotification = (message, type) => window.GameUI.showNotification(message, type);
window.showAutoRefreshIndicator = (message, type) => window.GameUI.showAutoRefreshIndicator(message, type);
window.addChatMessage = (sender, message) => window.GameUI.addChatMessage(sender, message);
