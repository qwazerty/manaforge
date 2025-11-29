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
                { id: 'lookTopLibrary', label: 'Look Top Library', icon: '👁️', action: 'lookTopLibrary' },
                { id: 'revealTopLibrary', label: 'Reveal Top Library', icon: '👁️', action: 'revealTopLibrary' },
                { id: 'search', label: 'Search Library', icon: '🔍', action: 'searchZone' },
                { id: 'shuffle', label: 'Shuffle Library', icon: '🔀', action: 'shuffleLibrary' },
                { id: 'mulligan', label: 'Mulligan', icon: '🔄', action: 'mulligan' }
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
        const currentPlayer = (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function')
            ? GameCore.getSelectedPlayer()
            : null;
        const isSpectator = currentPlayer === 'spectator';

        // Do not show context menu for opponent's deck
        if (!isSpectator && isOpponent && baseZoneName === 'deck') {
            return;
        }
        
        const menuConfig = this.ZONE_MENUS[baseZoneName];
        
        if (!menuConfig) {
            console.warn(`No context menu configuration for zone: ${baseZoneName}`);
            return;
        }

        const filteredActions = (menuConfig.actions || []).filter((action) => {
            if (isSpectator) {
                return action.action === 'searchZone';
            }
            if (isOpponent) {
                return action.action === 'searchZone';
            }
            return true;
        });

        if (!filteredActions.length) {
            return;
        }

        // Create enhanced menu config with context
        const enhancedConfig = {
            ...menuConfig,
            actions: filteredActions,
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
        if (!this.activeMenu) {
            return;
        }

        const menuToClose = this.activeMenu;
        this.activeMenu = null;
        menuToClose.classList.remove('active');

        setTimeout(() => {
            if (menuToClose.parentNode) {
                menuToClose.parentNode.removeChild(menuToClose);
            }
        }, 200);
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
        menu.dataset.zone = menuConfig.baseZoneName || zoneName;
        return menu;
    }

    /**
     * Position menu near cursor
     */
    static positionMenu(menu, event) {
        // Adjust placement so the menu stays within the viewport bounds.
        const updatePosition = () => {
            const menuWidth = menu.offsetWidth;
            const menuHeight = menu.offsetHeight;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let x = event.clientX;
            let y = event.clientY;

            if (x + menuWidth > viewportWidth - 10) {
                x = Math.max(10, viewportWidth - menuWidth - 10);
            }
            if (y + menuHeight > viewportHeight - 10) {
                y = Math.max(10, viewportHeight - menuHeight - 10);
            }

            if (x < 10) {
                x = 10;
            }
            if (y < 10) {
                y = 10;
            }

            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
        };

        updatePosition();
        requestAnimationFrame(updatePosition);
    }

    /**
     * Execute context menu action
     */
    static executeAction(zoneName, actionType, isOpponent = false) {
        this.closeMenu();

        // Extract base zone name
        const baseZoneName = zoneName.replace('opponent_', '');
        const currentPlayer = (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function')
            ? GameCore.getSelectedPlayer()
            : null;
        const isSpectator = currentPlayer === 'spectator';
        if ((isOpponent || isSpectator) && actionType !== 'searchZone') {
            console.warn('Action is restricted for this context');
            return;
        }

        switch (actionType) {
            case 'drawCard':
                this.drawCard(isOpponent);
                break;
            case 'lookTopLibrary':
                if (window.GameActions && typeof window.GameActions.lookTopLibrary === 'function') {
                    window.GameActions.lookTopLibrary();
                }
                break;
            case 'revealTopLibrary':
                if (window.GameActions && typeof window.GameActions.revealTopLibrary === 'function') {
                    window.GameActions.revealTopLibrary();
                }
                break;
            case 'searchZone':
                this.searchZone(baseZoneName, isOpponent);
                break;
            case 'shuffleLibrary':
                this.shuffleLibrary(isOpponent);
                break;
            case 'mulligan':
                this.mulligan(isOpponent);
                break;
            default:
                console.warn(`Unknown action: ${actionType}`);
        }
    }

    /**
     * Mulligan
     */
    static mulligan(isOpponent = false) {
        if (isOpponent) return; // Can't mulligan for opponent
        if (window.GameActions && window.GameActions.performGameAction) {
            window.GameActions.performGameAction('mulligan');
        } else {
            console.warn('GameActions not available for mulligan');
        }
    }

    /**
     * Draw a card from library
     */
    static drawCard(isOpponent = false) {
        if (window.GameActions && window.GameActions.drawCard) {
            // TODO: Add support for opponent draw card when needed
            window.GameActions.drawCard();
        } else {
            console.warn('GameActions.drawCard not available');
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
        } else {
            console.warn('GameActions not available for shuffle');
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
            } else {
                console.warn('ZoneManager.showOpponentZoneModal not available');
            }
        } else {
            // Show player zone modal
            if (window.ZoneManager && window.ZoneManager.showZoneModal) {
                const modalZoneName = zoneName === 'deck' ? 'deck' : zoneName;
                window.ZoneManager.showZoneModal(modalZoneName);
            } else {
                console.warn('ZoneManager not available for search');
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
            this.showMenu(zoneName, e, isOpponent);
        });

        zoneElement.title = 'Right-click for zone options';
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
