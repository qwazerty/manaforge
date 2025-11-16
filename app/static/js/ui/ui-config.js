/**
 * ManaForge UI Configuration Module
 * Contains all UI constants and configuration objects
 */

class UIConfig {
    static GAME_PHASES = [
        { id: 'begin', name: 'Begin', icon: '🔄' },
        { id: 'main1', name: 'Main 1', icon: '🎯' },
        { id: 'attack', name: 'Attack', icon: '⚔️' },
        { id: 'block', name: 'Block', icon: '🛡️' },
        { id: 'damage', name: 'Damage', icon: '💥' },
        { id: 'main2', name: 'Main 2', icon: '✨' },
        { id: 'end', name: 'End', icon: '🏁' }
    ];

    static LIFE_CONTROLS = [
        { type: 'preset', value: -1, class: 'red', label: '-1' },
        { type: 'custom', direction: -1, class: 'red', label: '-X' },
        { type: 'preset', value: 1, class: 'green', label: '+1' },
        { type: 'custom', direction: 1, class: 'green', label: '+X' }
    ];

    static CSS_CLASSES = {
        button: {
            primary: 'flex-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500 text-blue-300 hover:text-blue-200 py-3 px-4 rounded-lg font-semibold transition-all duration-200',
            passPhase: 'flex-1 bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/80 hover:border-amber-300 text-amber-100 hover:text-white py-3 px-4 rounded-lg font-semibold transition-all duration-200 shadow-md shadow-amber-500/20',
            secondary: 'bg-arena-surface hover:bg-arena-surface-light border border-arena-accent/30 hover:border-arena-accent/50 text-arena-text py-2 rounded',
            life: {
                red: 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 text-red-300 hover:text-red-200 py-1 px-2 rounded text-xs font-semibold transition-all duration-200',
                green: 'bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-500 text-green-300 hover:text-green-200 py-1 px-2 rounded text-xs font-semibold transition-all duration-200'
            }
        },
        zone: {
            container: 'zone-item',
            empty: 'zone-empty',
        },
        card: {
            position: 'absolute',
            mini: 'card-mini',
            back: 'card-back',
            backMini: 'card-back-mini'
        }
    };

    /**
     * Get phase display name from ID
     */
    static getPhaseDisplayName(phaseId) {
        const phase = this.GAME_PHASES.find(p => p.id === phaseId);
        return phase ? phase.name : 'Unknown Phase';
    }
}

window.UIConfig = UIConfig;
