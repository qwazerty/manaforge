/**
 * ManaForge Zone Context Menu Module
 * Handles right-click context menus for game zones (deck, graveyard, exile)
 */

class ZoneContextMenu {
    static activeMenu = null;

    /**
     * Zone menu configurations
     */
    static ZONE_MENUS = {
        deck: {
            title: 'Library Actions',
            icon: '📚',
            actions: [
                { id: 'draw', label: 'Draw Card', icon: '🃏', action: 'drawCard' },
                { id: 'search', label: 'Search Library', icon: '🔍', action: 'searchLibrary' },
                { id: 'shuffle', label: 'Shuffle Library', icon: '🔀', action: 'shuffleLibrary' }
            ]
        },
        graveyard: {
            title: 'Graveyard Actions',
            icon: '⚰️',
            actions: [
                { id: 'search', label: 'Search Graveyard', icon: '🔍', action: 'searchGraveyard' }
            ]
        },
        exile: {
            title: 'Exile Actions',
            icon: '🌌',
            actions: [
                { id: 'search', label: 'Search Exile', icon: '🔍', action: 'searchExile' }
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
    static showMenu(zoneName, event) {
        event.preventDefault();
        event.stopPropagation();

        // Close any existing menu
        this.closeMenu();

        const menuConfig = this.ZONE_MENUS[zoneName];
        if (!menuConfig) {
            console.warn(`No context menu configuration for zone: ${zoneName}`);
            return;
        }

        // Create menu element
        const menu = this.createMenuElement(zoneName, menuConfig);
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
                            data-action="${action.action}"
                            onclick="ZoneContextMenu.executeAction('${zoneName}', '${action.action}')">
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
    static executeAction(zoneName, actionType) {
        console.log(`Executing ${actionType} on ${zoneName}`);
        
        this.closeMenu();

        switch (actionType) {
            case 'drawCard':
                this.drawCard();
                break;
            case 'searchLibrary':
                this.searchZone('library');
                break;
            case 'shuffleLibrary':
                this.shuffleLibrary();
                break;
            case 'searchGraveyard':
                this.searchZone('graveyard');
                break;
            case 'searchExile':
                this.searchZone('exile');
                break;
            default:
                console.warn(`Unknown action: ${actionType}`);
        }
    }

    /**
     * Draw a card from library
     */
    static drawCard() {
        if (window.GameActions && window.GameActions.drawCard) {
            window.GameActions.drawCard();
        } else {
            console.warn('GameActions.drawCard not available');
            UINotifications.showNotification('Draw card action not available', 'error');
        }
    }

    /**
     * Shuffle library
     */
    static shuffleLibrary() {
        // Send shuffle action to server
        if (window.GameActions && window.GameActions.performGameAction) {
            window.GameActions.performGameAction('shuffle_library');
            UINotifications.showNotification('Library shuffled', 'info');
        } else {
            console.warn('GameActions not available for shuffle');
            UINotifications.showNotification('Shuffle action not available', 'error');
        }
    }

    /**
     * Search a zone (library, graveyard, exile)
     */
    static searchZone(zoneName) {
        // Show search modal for the zone
        if (window.ZoneManager && window.ZoneManager.showSearchModal) {
            window.ZoneManager.showSearchModal(zoneName);
        } else {
            // Fallback: show regular zone modal with search capabilities
            const modalZoneName = zoneName === 'library' ? 'deck' : zoneName;
            if (window.ZoneManager && window.ZoneManager.showZoneModal) {
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

        zoneElement.addEventListener('contextmenu', (e) => {
            // Only show context menu for player's own zones (not opponent zones)
            const currentPlayer = GameCore.getSelectedPlayer();
            if (currentPlayer === 'spectator') {
                return; // No context menu for spectators
            }

            this.showMenu(zoneName, e);
        });

        // Add visual indicator for right-click availability
        zoneElement.title = `Right-click for ${zoneName} actions`;
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
