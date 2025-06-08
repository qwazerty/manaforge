/**
 * ManaForge UI Configuration Module
 * Contains all UI constants and configuration objects
 */

class UIConfig {
    static GAME_PHASES = [
        { id: 'begin', name: 'Begin', icon: '🔄' },
        { id: 'main1', name: 'Main 1', icon: '🎯' },
        { id: 'combat', name: 'Combat', icon: '⚔️' },
        { id: 'main2', name: 'Main 2', icon: '✨' },
        { id: 'end', name: 'End', icon: '🏁' }
    ];

    static ZONE_CONFIG = {
        deck: { icon: '📖', name: 'Deck', stackLayers: 5 },
        graveyard: { icon: '⚰️', name: 'Graveyard', maxVisible: 5 },
        exile: { icon: '🌌', name: 'Exile', maxVisible: 6 },
        life: { icon: '❤️', name: 'Life Total' }
    };

    static LIFE_CONTROLS = [
        { value: -5, class: 'red', label: '-5' },
        { value: -1, class: 'red', label: '-1' },
        { value: 1, class: 'green', label: '+1' },
        { value: 5, class: 'green', label: '+5' }
    ];

    static CSS_CLASSES = {
        button: {
            primary: 'flex-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500 text-blue-300 hover:text-blue-200 py-3 px-4 rounded-lg font-semibold transition-all duration-200',
            secondary: 'bg-arena-surface hover:bg-arena-surface-light border border-arena-accent/30 hover:border-arena-accent/50 text-arena-text py-2 rounded',
            life: {
                red: 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 text-red-300 hover:text-red-200 py-1 px-2 rounded text-xs font-semibold transition-all duration-200',
                green: 'bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-500 text-green-300 hover:text-green-200 py-1 px-2 rounded text-xs font-semibold transition-all duration-200'
            }
        },
        zone: {
            container: 'zone-display',
            empty: 'zone-empty',
            title: 'zone-title'
        },
        card: {
            position: 'absolute',
            mini: 'card-mini',
            back: 'card-back',
            backMini: 'card-back-mini'
        }
    };

    static PHASE_DISPLAY_MAP = {
        'begin': 'Begin',
        'main1': 'Main 1',
        'combat': 'Combat',
        'main2': 'Main 2',
        'end': 'End'
    };

    /**
     * Get phase display name from ID
     */
    static getPhaseDisplayName(phaseId) {
        return this.PHASE_DISPLAY_MAP[phaseId] || 
               phaseId.charAt(0).toUpperCase() + phaseId.slice(1);
    }
}

window.UIConfig = UIConfig;
