/**
 * ManaForge Game UI Module
 * Main orchestrator for UI components using modular architecture
 */

// ===== MAIN UI FUNCTIONS =====
/**
 * ManaForge Game UI Module
 * Main orchestrator for UI components using modular architecture
 * 
 * This file has been refactored to use the new modular architecture:
 * - UITemplates: HTML template generation
 * - UIRenderers: Rendering logic and orchestration  
 * - ZoneManager: Zone modal management
 * - UINotifications: Notifications and feedback
 */

// ===== MAIN UI FUNCTIONS (Legacy API compatibility) =====
function updateRoleDisplay() {
    if (typeof UIRenderers !== 'undefined') {
        UIRenderers.renderRoleDisplay();
    } else {
        console.warn('UIRenderers module not loaded yet');
    }
}

function generateStackArea() {
    if (typeof UIRenderers !== 'undefined') {
        UIRenderers.renderStackArea();
    } else {
        console.warn('UIRenderers module not loaded yet');
    }
}

function generateGameBoard() {
    if (typeof UIRenderers !== 'undefined') {
        UIRenderers.renderGameBoard();
    } else {
        console.warn('UIRenderers module not loaded yet');
    }
}

function generateActionPanel() {
    if (typeof UIRenderers !== 'undefined') {
        UIRenderers.renderActionPanel();
    } else {
        console.warn('UIRenderers module not loaded yet');
    }
}

// ===== ZONE MODAL FUNCTIONS (Legacy API compatibility) =====
function showZoneModal(zoneName) {
    if (typeof ZoneManager !== 'undefined') {
        ZoneManager.showZoneModal(zoneName);
    } else {
        console.warn('ZoneManager module not loaded yet');
    }
}

function closeZoneModal(zoneName) {
    if (typeof ZoneManager !== 'undefined') {
        ZoneManager.closeZoneModal(zoneName);
    } else {
        console.warn('ZoneManager module not loaded yet');
    }
}

function updateZoneCounts() {
    if (typeof ZoneManager !== 'undefined') {
        ZoneManager.updateZoneCounts();
    } else {
        console.warn('ZoneManager module not loaded yet');
    }
}

function showCardDetails(cardId, zoneName) {
    if (typeof ZoneManager !== 'undefined') {
        ZoneManager.showCardDetails(cardId, zoneName);
    } else {
        console.warn('ZoneManager module not loaded yet');
    }
}

// ===== NOTIFICATION FUNCTIONS (Legacy API compatibility) =====
function showNotification(message, type = 'info') {
    if (typeof UINotifications !== 'undefined') {
        UINotifications.showNotification(message, type);
    } else {
        console.warn('UINotifications module not loaded yet');
    }
}

function showAutoRefreshIndicator(message, type = 'info') {
    if (typeof UINotifications !== 'undefined') {
        UINotifications.showAutoRefreshIndicator(message, type);
    } else {
        console.warn('UINotifications module not loaded yet');
    }
}

function addChatMessage(sender, message) {
    if (typeof UINotifications !== 'undefined') {
        UINotifications.addChatMessage(sender, message);
    } else {
        console.warn('UINotifications module not loaded yet');
    }
}

// ===== LEGACY HELPER FUNCTIONS =====
function getZoneInfo(zoneName) {
    if (typeof ZoneManager !== 'undefined') {
        return ZoneManager.getZoneInfo(zoneName);
    } else {
        console.warn('ZoneManager module not loaded yet');
        return null;
    }
}

function generateZoneCardsGrid(cards, zoneName) {
    if (typeof ZoneManager !== 'undefined') {
        return ZoneManager.generateZoneCardsGrid(cards, zoneName);
    } else {
        console.warn('ZoneManager module not loaded yet');
        return '';
    }
}

function getCardTypeIcon(cardType) {
    if (typeof ZoneManager !== 'undefined') {
        return ZoneManager.getCardTypeIcon(cardType);
    } else {
        console.warn('ZoneManager module not loaded yet');
        return '❓';
    }
}

// ===== ENHANCED UI FUNCTIONS =====

/**
 * Wait for all UI modules to be loaded
 */
function waitForModules() {
    return new Promise((resolve, reject) => {
        const checkModules = () => {
            if (typeof UIRenderers !== 'undefined' && 
                typeof ZoneManager !== 'undefined' && 
                typeof UINotifications !== 'undefined' && 
                typeof UITemplates !== 'undefined') {
                resolve();
            } else {
                // Log which modules are missing
                const missing = [];
                if (typeof UIRenderers === 'undefined') missing.push('UIRenderers');
                if (typeof ZoneManager === 'undefined') missing.push('ZoneManager');
                if (typeof UINotifications === 'undefined') missing.push('UINotifications');
                if (typeof UITemplates === 'undefined') missing.push('UITemplates');
                
                console.log('🔄 Waiting for modules:', missing.join(', '));
                setTimeout(checkModules, 50); // Check again in 50ms
            }
        };
        
        // Start checking immediately
        checkModules();
        
        // Timeout after 5 seconds
        setTimeout(() => {
            reject(new Error('Timeout: UI modules failed to load within 5 seconds'));
        }, 5000);
    });
}

/**
 * Initialize UI components safely (to be called by game-core.js)
 */
async function initializeGameUI() {
    console.log('🎮 Initializing Game UI components...');
    
    try {
        // Wait for all modules to load if not already loaded
        if (typeof UIRenderers === 'undefined' || 
            typeof ZoneManager === 'undefined' || 
            typeof UINotifications === 'undefined' || 
            typeof UITemplates === 'undefined') {
            await waitForModules();
        }
        
        // Now safely initialize UI components
        updateRoleDisplay();
        generateStackArea();
        generateGameBoard();
        generateActionPanel();
        updateZoneCounts();
        
        console.log('✅ Game UI components initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Game UI components:', error);
        return false;
    }
}

/**
 * Initialize UI components
 */
async function initializeUI() {
    console.log('🎮 Initializing ManaForge UI...');
    
    try {
        // Wait for all modules to load
        await waitForModules();
        
        console.log('✅ All UI modules loaded successfully');
        console.log('✅ UIRenderers module loaded');
        console.log('✅ ZoneManager module loaded');
        console.log('✅ UINotifications module loaded');
        console.log('✅ UITemplates module loaded');
        
        console.log('🎮 ManaForge UI initialization complete');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize UI:', error);
        
        // Show which modules are missing
        const missing = [];
        if (typeof UIRenderers === 'undefined') missing.push('UIRenderers');
        if (typeof ZoneManager === 'undefined') missing.push('ZoneManager');
        if (typeof UINotifications === 'undefined') missing.push('UINotifications');
        if (typeof UITemplates === 'undefined') missing.push('UITemplates');
        
        if (missing.length > 0) {
            console.warn('⚠️ Missing modules:', missing.join(', '));
        }
        
        return false;
    }
}

/**
 * Refresh all UI components
 */
function refreshAllUI() {
    try {
        updateRoleDisplay();
        generateStackArea();
        generateGameBoard();
        generateActionPanel();
        updateZoneCounts();
        
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

/**
 * Show loading state for UI components
 */
function showLoadingState() {
    const containers = [
        'stack-area',
        'game-board', 
        'action-panel'
    ];
    
    containers.forEach(containerId => {
        if (typeof UINotifications !== 'undefined') {
            UINotifications.showLoadingIndicator(containerId, 'Loading game state...');
        }
    });
}

/**
 * Handle UI errors gracefully
 */
function handleUIError(error, context = 'UI') {
    console.error(`${context} Error:`, error);
    if (typeof UINotifications !== 'undefined') {
        UINotifications.showErrorFeedback(`${context} error occurred`, error);
    }
}

// ===== EXPORT UI MODULE FUNCTIONALITY =====
window.GameUI = {
    // Core rendering functions
    updateRoleDisplay,
    generateStackArea,
    generateGameBoard,
    generateActionPanel,
    
    // Zone management
    showZoneModal,
    closeZoneModal,
    updateZoneCounts,
    showCardDetails,
    
    // Notifications and feedback
    showNotification,
    showAutoRefreshIndicator,
    addChatMessage,
    
    // Enhanced functions
    initializeUI,
    initializeGameUI,
    refreshAllUI,
    showLoadingState,
    handleUIError,
    
    // Legacy compatibility
    getZoneInfo,
    generateZoneCardsGrid,
    getCardTypeIcon
};

// Initialize UI when this module loads
document.addEventListener('DOMContentLoaded', async () => {
    await initializeUI();
});

