/**
 * ManaForge Zone Context Menu Module
 * Handles right-click context menus for game zones (deck, graveyard, exile)
 * Unified menu system for both player and opponent zones
 */

class ZoneContextMenu {
    static activeMenu = null;

    /**
     * Zone menu configurations - unified for both players
     */
    static ZONE_MENUS = {
        deck: {
            title: 'Library Actions',
            icon: '📚',
            actions: [
                { id: 'draw', label: 'Draw Card', icon: '🃏', action: 'drawCard' },
                { id: 'search', label: 'Search Library', icon: '🔍', action: 'searchZone' },
                { id: 'shuffle', label: 'Shuffle Library', icon: '🔀', action: 'shuffleLibrary' }
            ]
        },
        graveyard: {
            title: 'Graveyard Actions',
            icon: '⚰️',
            actions: [
                { id: 'search', label: 'Search Graveyard', icon: '🔍', action: 'searchZone' }
            ]
        },
        exile: {
            title: 'Exile Actions',
            icon: '🌌',
            actions: [
                { id: 'search', label: 'Search Exile', icon: '🔍', action: 'searchZone' }
            ]
        }
    };

    /**
     * Initialize context menu event listeners
     */
    static initialize() {
        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.zone-context-menu')) {
                this.closeMenu();
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMenu();
            }
        });

        console.log('Zone context menus initialized');
    }

    /**
     * Show context menu for a zone
     */
    static showMenu(zoneName, event, isOpponent = false) {
        event.preventDefault();
        event.stopPropagation();

        // Close any existing menu
        this.closeMenu();

        // Extract base zone name (remove opponent_ prefix if present)
        const baseZoneName = zoneName.replace('opponent_', '');

        // Do not show context menu for opponent's deck
        if (isOpponent && baseZoneName === 'deck') {
            return;
        }
        
        const menuConfig = this.ZONE_MENUS[baseZoneName];
        
        if (!menuConfig) {
            console.warn(`No context menu configuration for zone: ${baseZoneName}`);
            return;
        }

        // Create enhanced menu config with context
        const enhancedConfig = {
            ...menuConfig,
            title: isOpponent ? `Opponent's ${menuConfig.title}` : menuConfig.title,
            isOpponent: isOpponent,
            baseZoneName: baseZoneName
        };

        // Create menu element
        const menu = this.createMenuElement(zoneName, enhancedConfig);
        document.body.appendChild(menu);

        // Position menu near cursor
        this.positionMenu(menu, event);

        // Store reference to active menu
        this.activeMenu = menu;

        // Animate menu appearance
        setTimeout(() => {
            menu.classList.add('active');
        }, 10);
    }

    /**
     * Close active context menu
     */
    static closeMenu() {
        if (this.activeMenu) {
            this.activeMenu.classList.remove('active');
            setTimeout(() => {
                if (this.activeMenu && this.activeMenu.parentNode) {
                    this.activeMenu.parentNode.removeChild(this.activeMenu);
                }
                this.activeMenu = null;
            }, 200);
        }
    }

    /**
     * Create menu HTML element
     */
    static createMenuElement(zoneName, menuConfig) {
        const menu = document.createElement('div');
        menu.className = 'zone-context-menu';
        menu.innerHTML = `
            <div class="zone-context-menu-header">
                <span class="zone-context-menu-icon">${menuConfig.icon}</span>
                <span class="zone-context-menu-title">${menuConfig.title}</span>
            </div>
            <div class="zone-context-menu-actions">
                ${menuConfig.actions.map(action => `
                    <button class="zone-context-menu-action" 
                            data-zone="${zoneName}" 
                            data-base-zone="${menuConfig.baseZoneName}"
                            data-is-opponent="${menuConfig.isOpponent || false}"
                            data-action="${action.action}"
                            onclick="ZoneContextMenu.executeAction('${zoneName}', '${action.action}', ${menuConfig.isOpponent || false})">
                        <span class="action-icon">${action.icon}</span>
                        <span class="action-label">${action.label}</span>
                    </button>
                `).join('')}
            </div>
        `;
        return menu;
    }

    /**
     * Position menu near cursor
     */
    static positionMenu(menu, event) {
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = event.clientX;
        let y = event.clientY;

        // Adjust if menu would go off-screen
        if (x + rect.width > viewportWidth) {
            x = viewportWidth - rect.width - 10;
        }
        if (y + rect.height > viewportHeight) {
            y = viewportHeight - rect.height - 10;
        }

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
    }

    /**
     * Execute context menu action
     */
    static executeAction(zoneName, actionType, isOpponent = false) {
        console.log(`Executing ${actionType} on ${zoneName} (opponent: ${isOpponent})`);
        
        this.closeMenu();

        // Extract base zone name
        const baseZoneName = zoneName.replace('opponent_', '');

        switch (actionType) {
            case 'drawCard':
                this.drawCard(isOpponent);
                break;
            case 'searchZone':
                this.searchZone(baseZoneName, isOpponent);
                break;
            case 'shuffleLibrary':
                this.shuffleLibrary(isOpponent);
                break;
            default:
                console.warn(`Unknown action: ${actionType}`);
        }
    }

    /**
     * Draw a card from library
     */
    static drawCard(isOpponent = false) {
        if (window.GameActions && window.GameActions.drawCard) {
            // TODO: Add support for opponent draw card when needed
            window.GameActions.drawCard();
            const playerType = isOpponent ? "opponent's" : "your";
            UINotifications.showNotification(`Drawing card from ${playerType} library`, 'info');
        } else {
            console.warn('GameActions.drawCard not available');
            UINotifications.showNotification('Draw card action not available', 'error');
        }
    }

    /**
     * Shuffle library
     */
    static shuffleLibrary(isOpponent = false) {
        // Send shuffle action to server
        if (window.GameActions && window.GameActions.performGameAction) {
            // TODO: Add support for opponent shuffle when needed
            window.GameActions.performGameAction('shuffle_library');
            const playerType = isOpponent ? "Opponent's" : "Your";
            UINotifications.showNotification(`${playerType} library shuffled`, 'info');
        } else {
            console.warn('GameActions not available for shuffle');
            UINotifications.showNotification('Shuffle action not available', 'error');
        }
    }

    /**
     * Search a zone (library, graveyard, exile)
     */
    static searchZone(zoneName, isOpponent = false) {
        if (isOpponent) {
            // Show opponent zone modal
            if (window.ZoneManager && window.ZoneManager.showOpponentZoneModal) {
                const modalZoneName = zoneName === 'deck' ? 'deck' : zoneName;
                window.ZoneManager.showOpponentZoneModal(modalZoneName);
                UINotifications.showNotification(`Viewing opponent's ${zoneName}...`, 'info');
            } else {
                console.warn('ZoneManager.showOpponentZoneModal not available');
                UINotifications.showNotification(`View opponent's ${zoneName} not available`, 'error');
            }
        } else {
            // Show player zone modal
            if (window.ZoneManager && window.ZoneManager.showZoneModal) {
                const modalZoneName = zoneName === 'deck' ? 'deck' : zoneName;
                window.ZoneManager.showZoneModal(modalZoneName);
                UINotifications.showNotification(`Searching ${zoneName}...`, 'info');
            } else {
                console.warn('ZoneManager not available for search');
                UINotifications.showNotification(`Search ${zoneName} not available`, 'error');
            }
        }
    }

    /**
     * Add context menu to zone element
     */
    static attachToZone(zoneElement, zoneName) {
        if (!zoneElement) return;

        // Determine if this is an opponent zone
        const isOpponent = zoneName.startsWith('opponent_');

        zoneElement.addEventListener('contextmenu', (e) => {
            const currentPlayer = GameCore.getSelectedPlayer();
            if (currentPlayer === 'spectator') {
                return; // No context menu for spectators
            }

            this.showMenu(zoneName, e, isOpponent);
        });

        // Add visual indicator for right-click availability, unless it's the opponent's deck
        const cleanZoneName = zoneName.replace('opponent_', '');
        if (!isOpponent || cleanZoneName !== 'deck') {
            const actionType = isOpponent ? 'interact with opponent' : 'interact with';
            zoneElement.title = `Right-click to ${actionType} ${cleanZoneName}`;
        } else {
            zoneElement.title = `Opponent's library`; // Or simply remove the title
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ZoneContextMenu.initialize();
    });
} else {
    ZoneContextMenu.initialize();
}

window.ZoneContextMenu = ZoneContextMenu;
