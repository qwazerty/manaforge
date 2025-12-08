import { UIConfig } from './ui-config';

/**
 * Zone Data helpers previously exposed via the global ZoneData class.
 * These remain side-effect free and still rely on existing globals
 * (UIZonesManager, GameActions, GameCards) for behaviour hooks.
 */

// @ts-ignore - GameCore, UIZonesManager, GameActions, GameCards are globals injected by the server
declare const GameCore: any, UIZonesManager: any, GameActions: any, GameCards: any;

const getSelectedPlayer = () => {
    return typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function'
        ? GameCore.getSelectedPlayer()
        : null;
};

const isSpectatorView = () => getSelectedPlayer() === 'spectator';

const getDeckZoneConfig = (deck: any[] = [], isOpponent = false) => {
    const deckArray = Array.isArray(deck) ? deck : [];
    const cardsRemaining = deckArray.length;
    const isSpectator = isSpectatorView();
    let onClick: (() => void) | null = null;
    let overlayText = '';

    if (isSpectator) {
        onClick = isOpponent
            ? () => UIZonesManager.showOpponentZoneModal('deck')
            : () => UIZonesManager.showZoneModal('deck');
        overlayText = '';
    } else if (!isOpponent) {
        onClick = () => GameActions.drawCard();
        overlayText = 'Draw';
    }

    const deckClass = isOpponent ? 'deck-cards-stack opponent-deck' : 'deck-cards-stack';
    const zoneIdentifier = isOpponent ? 'opponent_deck' : 'deck';

    return {
        cardsRemaining,
        overlayText,
        onClick,
        deckClass,
        zoneIdentifier
    };
};

const getGraveyardZoneConfig = (graveyard: any[] = [], isOpponent = false) => {
    const graveyardArray = Array.isArray(graveyard) ? graveyard : [];
    const cardsRemaining = graveyardArray.length;
    const zoneIdentifier = isOpponent ? 'opponent_graveyard' : 'graveyard';
    const clickHandler = isOpponent
        ? () => UIZonesManager.showOpponentZoneModal('graveyard')
        : () => UIZonesManager.showZoneModal('graveyard');

    return {
        cardsRemaining,
        graveyardArray,
        zoneIdentifier,
        clickHandler,
        overlayHtml: 'View<br>All'
    };
};

const getExileZoneConfig = (exile: any[] = [], isOpponent = false) => {
    const exileArray = Array.isArray(exile) ? exile : [];
    const cardsRemaining = exileArray.length;
    const zoneIdentifier = isOpponent ? 'opponent_exile' : 'exile';
    const clickHandler = isOpponent
        ? () => UIZonesManager.showOpponentZoneModal('exile')
        : () => UIZonesManager.showZoneModal('exile');
    const topCard = cardsRemaining > 0 ? exileArray[cardsRemaining - 1] : null;

    return {
        cardsRemaining,
        exileArray,
        zoneIdentifier,
        clickHandler,
        overlayHtml: 'View<br>All',
        topCard
    };
};

const getLifeZoneConfig = (playerData: any = {}, playerId = 'player1') => {
    const safeData = playerData || {};
    const lifeValue = typeof safeData.life === 'number'
        ? safeData.life
        : parseInt((safeData as any).life || 20, 10) || 20;
    const counters = extractCounterEntries(safeData);
    const lifeControls = Array.isArray(UIConfig.LIFE_CONTROLS) ? UIConfig.LIFE_CONTROLS : [];
    const manageButton = {
        label: 'Counters',
        title: 'Manage player counters',
        className: [
            'w-full flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded',
            'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 hover:border-indigo-300',
            'text-indigo-100 hover:text-white transition-all duration-200'
        ].join(' '),
        onClick: null as any
    };
    const toControlConfig = (control: any, index: number) => {
        const classes = (UIConfig.CSS_CLASSES.button.life && UIConfig.CSS_CLASSES.button.life[control.class as keyof typeof UIConfig.CSS_CLASSES.button.life]) || '';
        if (control.type === 'custom') {
            const direction = Number(control.direction) >= 0 ? 1 : -1;
            return {
                id: `life-control-${playerId}-${index}`,
                label: control.label,
                title: direction > 0 ? 'Add custom amount' : 'Remove custom amount',
                className: classes,
                onClick: (event: any) => UIZonesManager.openCustomLifeInput(
                    playerId,
                    direction,
                    event?.currentTarget || event?.target || null
                )
            };
        }
        const value = typeof control.value === 'number' ? control.value : 0;
        return {
            id: `life-control-${playerId}-${index}`,
            label: control.label,
            title: value >= 0 ? `Add ${value} life` : `Remove ${Math.abs(value)} life`,
            className: classes,
            onClick: () => GameActions.modifyLife(playerId, value)
        };
    };

    const isNegativeControl = (control: any) =>
        (control.type === 'custom' && Number(control.direction) < 0) ||
        (typeof control.value === 'number' && control.value < 0);
    const isPositiveControl = (control: any) =>
        (control.type === 'custom' && Number(control.direction) > 0) ||
        (typeof control.value === 'number' && control.value > 0);

    const negativeControls = lifeControls
        .map((control, index) => ({ control, index }))
        .filter(({ control }) => isNegativeControl(control))
        .map(({ control, index }) => toControlConfig(control, index));
    const positiveControls = lifeControls
        .map((control, index) => ({ control, index }))
        .filter(({ control }) => isPositiveControl(control))
        .map(({ control, index }) => toControlConfig(control, index));

    const hasCustomLifeControls = lifeControls.some((control) => control.type === 'custom');

    return {
        life: lifeValue,
        playerId,
        counters,
        manageButton,
        negativeControls,
        positiveControls,
        hasCustomLifeControls
    };
};

const extractCounterEntries = (playerData: any = {}) => {
    const counters = (playerData as any)?.counters || {};
    return Object.entries(counters)
        .filter(([, value]) => Number(value) > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, amount]) => ({
            type,
            amount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
            label: formatCounterLabel(type),
            icon: getCounterIcon(type)
        }));
};

const formatCounterLabel = (counterType: any) => {
    if (!counterType) {
        return 'Compteur';
    }
    const normalized = String(counterType).trim();
    if (!normalized) {
        return 'Compteur';
    }
    const lower = normalized.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const getCounterIcon = (counterType: any) => {
    if (typeof GameCards !== 'undefined' && typeof GameCards.getCounterIcon === 'function') {
        const icon = GameCards.getCounterIcon(counterType);
        if (icon) {
            return icon;
        }
        const lower = typeof counterType === 'string' ? counterType.toLowerCase() : counterType;
        if (lower) {
            return GameCards.getCounterIcon(lower) || null;
        }
    }
    return null;
};

export {
    getSelectedPlayer,
    isSpectatorView,
    getDeckZoneConfig,
    getGraveyardZoneConfig,
    getExileZoneConfig,
    getLifeZoneConfig,
    extractCounterEntries,
    formatCounterLabel,
    getCounterIcon
};
