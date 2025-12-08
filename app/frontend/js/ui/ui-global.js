/**
 * ManaForge Global UI Functions
 * Contains global UI utilities and compatibility functions
 */

// Global GameUI object for compatibility
window.GameUI = window.GameUI || {};

// Global UI utilities
Object.assign(window.GameUI, {
    _logBuffer: [],

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

    /**
     * Lightweight logging shim now that notifications are gone
     */
    logMessage(message, level = 'info') {
        const entry = {
            message: typeof message === 'string' ? message : JSON.stringify(message),
            level,
            timestamp: Date.now()
        };

        if (!Array.isArray(this._logBuffer)) {
            this._logBuffer = [];
        }
        this._logBuffer.push(entry);
        if (this._logBuffer.length > 50) {
            this._logBuffer.shift();
        }

        const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
        logFn.call(console, `[GameUI:${level}]`, entry.message);

        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('gameui:log', { detail: entry }));
        }

        return entry;
    },

    getRecentLogs(count = 10) {
        if (!Array.isArray(this._logBuffer) || this._logBuffer.length === 0) {
            return [];
        }
        return this._logBuffer.slice(-count);
    },
    
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
            
        } catch (error) {
            console.error('Error refreshing UI:', error);
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
window.addChatMessage = (sender, message) => window.GameUI.addChatMessage(sender, message);
window.logMessage = (message, level) => window.GameUI.logMessage(message, level);
