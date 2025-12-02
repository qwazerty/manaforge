<script>
    import { onDestroy, tick } from 'svelte';

    /**
     * ManaForge Zone Context Menu
     * Right-click context menu for game zones (deck, graveyard, exile)
     * Migrated from zone-context-menu.js to Svelte 5 runes
     */

    // State
    let isOpen = $state(false);
    let menuElement = $state(null);
    let position = $state({ x: 0, y: 0 });
    let zoneName = $state('');
    let baseZoneName = $state('');
    let isOpponentZone = $state(false);

    // Zone menu configurations
    const ZONE_MENUS = {
        deck: {
            title: 'Library Actions',
            icon: '📚',
            actions: [
                { id: 'draw', label: 'Draw Card', icon: '🃏', action: 'drawCard' },
                { id: 'lookTopLibrary', label: 'Look Top Library', icon: '👁️', action: 'lookTopLibrary' },
                { id: 'revealTopLibrary', label: 'Reveal Top Library', icon: '👁️', action: 'revealTopLibrary' },
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

    // Helpers
    function getSelectedPlayer() {
        if (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function') {
            return GameCore.getSelectedPlayer();
        }
        return null;
    }

    let isSpectator = $derived(getSelectedPlayer() === 'spectator');

    let menuConfig = $derived(() => {
        const config = ZONE_MENUS[baseZoneName];
        if (!config) return null;
        return config;
    });

    let filteredActions = $derived(() => {
        const config = menuConfig();
        if (!config) return [];

        return config.actions.filter((action) => {
            if (isSpectator) {
                // Spectators can browse public zones but not the library
                return action.action === 'searchZone' && baseZoneName !== 'deck';
            }
            if (isOpponentZone) {
                return action.action === 'searchZone';
            }
            return true;
        });
    });

    let menuTitle = $derived(() => {
        const config = menuConfig();
        if (!config) return '';
        return isOpponentZone ? `Opponent's ${config.title}` : config.title;
    });

    let menuIcon = $derived(() => {
        const config = menuConfig();
        return config?.icon || '📋';
    });

    // Public API
    export function show(zone, event, isOpponent = false) {
        event.preventDefault();
        event.stopPropagation();

        // Close any existing menu
        hide();

        // Extract base zone name (remove opponent_ prefix if present)
        baseZoneName = zone.replace('opponent_', '');
        zoneName = zone;
        isOpponentZone = isOpponent;

        const currentPlayer = getSelectedPlayer();
        const spectator = currentPlayer === 'spectator';

        // Do not show context menu for opponent's deck (non-spectator)
        if (!spectator && isOpponent && baseZoneName === 'deck') {
            return;
        }

        const config = ZONE_MENUS[baseZoneName];
        if (!config) {
            console.warn(`No context menu configuration for zone: ${baseZoneName}`);
            return;
        }

        // Check if there are any actions to show
        const actions = config.actions.filter((action) => {
            if (spectator) {
                return action.action === 'searchZone' && baseZoneName !== 'deck';
            }
            if (isOpponent) {
                return action.action === 'searchZone';
            }
            return true;
        });

        if (!actions.length) {
            return;
        }

        position = { x: event.clientX, y: event.clientY };
        isOpen = true;

        // Wait for render then adjust position
        tick().then(() => {
            adjustPosition();
        });

        // Add listeners
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleKeydown);
    }

    export function hide() {
        if (!isOpen) return;
        
        isOpen = false;
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleKeydown);
    }

    function adjustPosition() {
        if (!menuElement) return;

        const rect = menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = position.x;
        let y = position.y;

        if (x + rect.width > viewportWidth - 10) {
            x = Math.max(10, viewportWidth - rect.width - 10);
        }
        if (y + rect.height > viewportHeight - 10) {
            y = Math.max(10, viewportHeight - rect.height - 10);
        }

        if (x < 10) x = 10;
        if (y < 10) y = 10;

        position = { x, y };
    }

    function handleOutsideClick(event) {
        if (menuElement && !menuElement.contains(event.target)) {
            hide();
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            hide();
        }
    }

    // Action handlers
    function executeAction(actionType) {
        hide();

        const spectator = isSpectator;
        if ((isOpponentZone || spectator) && actionType !== 'searchZone') {
            console.warn('Action is restricted for this context');
            return;
        }
        if (spectator && actionType === 'searchZone' && baseZoneName === 'deck') {
            console.warn('Spectators cannot search the library');
            return;
        }

        switch (actionType) {
            case 'drawCard':
                drawCard();
                break;
            case 'lookTopLibrary':
                lookTopLibrary();
                break;
            case 'revealTopLibrary':
                revealTopLibrary();
                break;
            case 'searchZone':
                searchZone();
                break;
            case 'shuffleLibrary':
                shuffleLibrary();
                break;
            default:
                console.warn(`Unknown action: ${actionType}`);
        }
    }

    function drawCard() {
        if (window.GameActions && window.GameActions.drawCard) {
            window.GameActions.drawCard();
        } else {
            console.warn('GameActions.drawCard not available');
        }
    }

    function lookTopLibrary() {
        if (window.GameActions && typeof window.GameActions.lookTopLibrary === 'function') {
            window.GameActions.lookTopLibrary();
        }
    }

    function revealTopLibrary() {
        if (window.GameActions && typeof window.GameActions.revealTopLibrary === 'function') {
            window.GameActions.revealTopLibrary();
        }
    }

    function shuffleLibrary() {
        if (window.GameActions && window.GameActions.performGameAction) {
            window.GameActions.performGameAction('shuffle_library');
        } else {
            console.warn('GameActions not available for shuffle');
        }
    }

    function searchZone() {
        // Mark library search requires shuffle for own deck
        if (!isOpponentZone && baseZoneName === 'deck' && 
            window.ZoneManager && typeof window.ZoneManager.markLibrarySearchRequiresShuffle === 'function') {
            window.ZoneManager.markLibrarySearchRequiresShuffle();
        }

        if (isOpponentZone) {
            // Show opponent zone modal
            if (window.ZoneManager && window.ZoneManager.showOpponentZoneModal) {
                window.ZoneManager.showOpponentZoneModal(baseZoneName);
            } else if (window.UIZonesManager && window.UIZonesManager.showOpponentZoneModal) {
                window.UIZonesManager.showOpponentZoneModal(baseZoneName);
            } else {
                console.warn('ZoneManager.showOpponentZoneModal not available');
            }
        } else {
            const currentPlayer = getSelectedPlayer();
            if (currentPlayer === 'spectator' && baseZoneName === 'deck') {
                console.warn('Spectators cannot search the library');
                return;
            }

            // Show player zone modal
            if (window.ZoneManager && window.ZoneManager.showZoneModal) {
                window.ZoneManager.showZoneModal(baseZoneName);
            } else if (window.UIZonesManager && window.UIZonesManager.showZoneModal) {
                window.UIZonesManager.showZoneModal(baseZoneName);
            } else {
                console.warn('ZoneManager not available for search');
            }
        }
    }

    // Export API to window for legacy compatibility
    const ZoneContextMenuAPI = {
        show,
        hide,
        showMenu: show,
        closeMenu: hide
    };

    if (typeof window !== 'undefined') {
        window.ZoneContextMenu = ZoneContextMenuAPI;
    }

    onDestroy(() => {
        hide();
        if (typeof window !== 'undefined' && window.ZoneContextMenu === ZoneContextMenuAPI) {
            delete window.ZoneContextMenu;
        }
    });
</script>

{#if isOpen}
    <div 
        class="zone-context-menu active"
        bind:this={menuElement}
        style="left: {position.x}px; top: {position.y}px;"
        role="menu"
        aria-label="Zone actions"
    >
        <div class="zone-context-menu-header">
            <span class="zone-context-menu-icon">{menuIcon()}</span>
            <span class="zone-context-menu-title">{menuTitle()}</span>
        </div>
        <div class="zone-context-menu-actions">
            {#each filteredActions() as action}
                <button 
                    class="zone-context-menu-action"
                    data-zone={zoneName}
                    data-base-zone={baseZoneName}
                    data-is-opponent={isOpponentZone}
                    data-action={action.action}
                    onclick={() => executeAction(action.action)}
                >
                    <span class="action-icon">{action.icon}</span>
                    <span class="action-label">{action.label}</span>
                </button>
            {/each}
        </div>
    </div>
{/if}
