<script>
    import { onDestroy } from 'svelte';
    import CardAddTypePopover from './CardAddTypePopover.svelte';
    import CardAddCounterPopover from './CardAddCounterPopover.svelte';
    import CardPowerToughnessPopover from './CardPowerToughnessPopover.svelte';

    /**
     * ManaForge Card Manager
     * Unified manager for card popovers (types, counters, power/toughness)
     * Migrated from ui-card-manager.js to Svelte 5 runes
     */

    // Counter options
    const COUNTER_OPTIONS = [
        { value: '+1/+1', label: '+1/+1' },
        { value: '-1/-1', label: '-1/-1' },
        { value: 'loyalty', label: 'Loyalty' },
        { value: 'charge', label: 'Charge' },
        { value: 'poison', label: 'Poison' },
        { value: 'energy', label: 'Energy' },
        { value: 'experience', label: 'Experience' },
        { value: 'treasure', label: 'Treasure' },
        { value: 'food', label: 'Food' },
        { value: 'clue', label: 'Clue' },
        { value: 'blood', label: 'Blood' },
        { value: 'oil', label: 'Oil' }
    ];

    // Type options
    const TYPE_OPTIONS = [
        { value: 'creature', label: 'Creature' },
        { value: 'land', label: 'Land' },
        { value: 'artifact', label: 'Artifact' },
        { value: 'enchantment', label: 'Enchantment' },
        { value: 'planeswalker', label: 'Planeswalker' },
        { value: 'instant', label: 'Instant' },
        { value: 'sorcery', label: 'Sorcery' }
    ];

    // State
    let typeOpen = $state(false);
    let counterOpen = $state(false);
    let powerOpen = $state(false);

    let currentCard = $state(null);
    let currentCardName = $state('Unknown Card');
    let position = $state(null);
    let cardData = $state({});
    let refreshTimer = $state(null);

    // Derived props for popovers
    let typeProps = $derived(() => ({
        open: typeOpen,
        cardName: currentCardName,
        cardId: currentCard?.cardId || '',
        uniqueId: currentCard?.uniqueCardId || '',
        types: getCustomTypes(cardData),
        typeOptions: TYPE_OPTIONS,
        position: position,
        onClose: closeAll,
        onAddType: handleAddType,
        onRemoveType: handleRemoveType,
        onResetTypes: handleResetTypes
    }));

    let counterProps = $derived(() => ({
        open: counterOpen,
        cardName: currentCardName,
        cardId: currentCard?.cardId || '',
        uniqueId: currentCard?.uniqueCardId || '',
        counters: buildCounterEntries(cardData),
        counterOptions: COUNTER_OPTIONS,
        position: position,
        onClose: closeAll,
        onModifyCounter: handleModifyCounter,
        onRemoveAllCounters: handleRemoveAllCounters,
        onAddCounter: handleAddCounter
    }));

    let powerProps = $derived(() => ({
        open: powerOpen,
        cardName: currentCardName,
        cardId: currentCard?.cardId || '',
        uniqueId: currentCard?.uniqueCardId || '',
        powerToughness: buildPowerToughness(cardData),
        position: position,
        onClose: closeAll,
        onApply: handleApplyPowerToughness,
        onReset: handleResetPowerToughness
    }));

    // Public API
    export function openTypePopover(uniqueCardId, cardId = null, anchorElement = null) {
        openPopover('type', uniqueCardId, cardId, anchorElement);
    }

    export function openCounterPopover(uniqueCardId, cardId = null, anchorElement = null) {
        openPopover('counter', uniqueCardId, cardId, anchorElement);
    }

    export function openPowerPopover(uniqueCardId, cardId = null, anchorElement = null) {
        openPopover('power', uniqueCardId, cardId, anchorElement);
    }

    export function closeAll() {
        typeOpen = false;
        counterOpen = false;
        powerOpen = false;
        currentCard = null;
        position = null;
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    }

    export function refresh(uniqueCardId = null, cardId = null) {
        if (!currentCard) return;

        const targetUid = uniqueCardId || currentCard.uniqueCardId;
        if (targetUid !== currentCard.uniqueCardId) return;

        const targetCardId = cardId || currentCard.cardId;
        const payload = prepareCardPayload(targetUid, targetCardId);
        if (!payload) {
            closeAll();
            return;
        }

        currentCard = {
            uniqueCardId: payload.uniqueCardId,
            cardId: payload.cardId
        };
        currentCardName = payload.cardName;
        position = calculatePopoverPosition(payload.anchorElement);
        cardData = payload.cardData;
    }

    // Internal functions
    function openPopover(kind, uniqueCardId, cardId = null, anchorElement = null) {
        const payload = prepareCardPayload(uniqueCardId, cardId);
        if (!payload) return;

        currentCard = {
            uniqueCardId: payload.uniqueCardId,
            cardId: payload.cardId
        };
        currentCardName = payload.cardName;
        position = calculatePopoverPosition(anchorElement || payload.anchorElement);
        cardData = payload.cardData;

        typeOpen = kind === 'type';
        counterOpen = kind === 'counter';
        powerOpen = kind === 'power';
    }

    function prepareCardPayload(uniqueCardId, cardId = null) {
        if (!uniqueCardId || typeof document === 'undefined') return null;

        const element = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (!element) return null;

        const rawData = element.getAttribute('data-card-data') || '{}';
        let parsedCardData = {};
        try {
            const normalized = rawData.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            parsedCardData = JSON.parse(normalized);
        } catch (error) {
            console.warn('[CardManager] Failed to parse card data from element', error);
        }

        const resolvedCardId = cardId ||
            parsedCardData.id ||
            parsedCardData.card_id ||
            element.getAttribute('data-card-id') ||
            null;
        const resolvedName = parsedCardData.name ||
            element.getAttribute('data-card-name') ||
            'Unknown Card';

        return {
            uniqueCardId,
            cardId: resolvedCardId,
            cardName: resolvedName,
            cardData: parsedCardData,
            anchorElement: element
        };
    }

    function calculatePopoverPosition(anchorElement = null) {
        if (typeof UIUtils === 'undefined' || typeof UIUtils.calculateAnchorPosition !== 'function') {
            return { top: 200, left: 200, anchor: 'center' };
        }
        return UIUtils.calculateAnchorPosition(anchorElement, {
            preferredAnchor: anchorElement ? 'bottom-left' : 'center',
            panelWidth: 420,
            panelHeight: 420,
            verticalOffset: 6,
            horizontalOffset: 6,
            viewportPadding: 16
        });
    }

    function getCustomTypes(data) {
        if (typeof GameCards !== 'undefined' && typeof GameCards.getCustomTypes === 'function') {
            return GameCards.getCustomTypes(data);
        }
        return [];
    }

    function resolveCounterIcon(counterType) {
        if (typeof GameCards !== 'undefined' && typeof GameCards.getCounterIcon === 'function') {
            const direct = GameCards.getCounterIcon(counterType);
            if (direct) return direct;
            const lower = typeof counterType === 'string' ? counterType.toLowerCase() : counterType;
            if (lower) return GameCards.getCounterIcon(lower) || null;
        }
        return null;
    }

    function buildCounterEntries(data) {
        const counters = data && typeof data === 'object' ? data.counters || {} : {};
        return Object.entries(counters)
            .filter(([, count]) => Number(count) > 0)
            .map(([type, amount]) => ({
                type,
                amount,
                label: formatCounterLabel(type),
                icon: resolveCounterIcon(type)
            }));
    }

    function formatCounterLabel(counterType) {
        if (!counterType) return 'Counter';
        const text = String(counterType);
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function buildPowerToughness(data) {
        const basePower = data?.power !== undefined && data.power !== null
            ? String(data.power)
            : '';
        const baseToughness = data?.toughness !== undefined && data.toughness !== null
            ? String(data.toughness)
            : '';

        const overridePower = data?.current_power ?? data?.currentPower ??
            data?.power_override ?? data?.powerOverride ?? '';
        const overrideToughness = data?.current_toughness ?? data?.currentToughness ??
            data?.toughness_override ?? data?.toughnessOverride ?? '';

        const hasBaseStat = Boolean(basePower || baseToughness);
        const hasOverride = Boolean(overridePower || overrideToughness);
        const typeLine = String(data?.type_line || data?.typeLine || '').toLowerCase();
        const isCreature = (typeof data?.card_type === 'string' && data.card_type.toLowerCase().includes('creature'))
            || typeLine.includes('creature');

        if (!hasBaseStat && !hasOverride && !isCreature) return null;

        const stats = typeof GameCards !== 'undefined' && typeof GameCards.computeEffectivePowerToughness === 'function'
            ? GameCards.computeEffectivePowerToughness(data)
            : null;

        const currentPower = stats ? stats.displayPowerText : (overridePower || basePower || '—');
        const currentToughness = stats ? stats.displayToughnessText : (overrideToughness || baseToughness || '—');

        return {
            basePower: basePower || '—',
            baseToughness: baseToughness || '—',
            currentPower: currentPower || '—',
            currentToughness: currentToughness || '—',
            overridePower: overridePower ?? null,
            overrideToughness: overrideToughness ?? null
        };
    }

    // Action handlers
    function handleAddType(cardType) {
        if (!currentCard || !cardType) {
            GameUI?.logMessage?.('Select a type to add', 'warning');
            return;
        }
        performAction('add_custom_type', {
            unique_id: currentCard.uniqueCardId,
            card_id: currentCard.cardId,
            card_type: cardType
        });
    }

    function handleRemoveType(cardType) {
        if (!currentCard || !cardType) return;
        performAction('remove_custom_type', {
            unique_id: currentCard.uniqueCardId,
            card_id: currentCard.cardId,
            card_type: cardType
        });
    }

    function handleResetTypes() {
        if (!currentCard) return;
        performAction('set_custom_type', {
            unique_id: currentCard.uniqueCardId,
            card_id: currentCard.cardId,
            card_type: null
        });
    }

    function handleModifyCounter(counterType, delta) {
        if (!currentCard || !counterType || !Number.isFinite(delta)) return;
        if (delta > 0) {
            performAction('add_counter', {
                unique_id: currentCard.uniqueCardId,
                card_id: currentCard.cardId,
                counter_type: counterType,
                amount: delta
            }, 120);
        } else {
            performAction('remove_counter', {
                unique_id: currentCard.uniqueCardId,
                card_id: currentCard.cardId,
                counter_type: counterType,
                amount: Math.abs(delta)
            }, 120);
        }
    }

    function handleRemoveAllCounters(counterType) {
        if (!currentCard || !counterType) return;
        performAction('set_counter', {
            unique_id: currentCard.uniqueCardId,
            card_id: currentCard.cardId,
            counter_type: counterType,
            amount: 0
        });
    }

    function handleAddCounter(counterType, amount) {
        const normalizedType = typeof counterType === 'string' ? counterType.trim() : '';
        if (!currentCard || !normalizedType) {
            GameUI?.logMessage?.('Select or enter a counter type', 'warning');
            return;
        }
        const parsedAmount = parseInt(amount, 10);
        const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;
        performAction('add_counter', {
            unique_id: currentCard.uniqueCardId,
            card_id: currentCard.cardId,
            counter_type: normalizedType,
            amount: safeAmount
        }, 160);
    }

    function handleApplyPowerToughness(power, toughness) {
        if (!currentCard) return;
        performAction('set_power_toughness', {
            unique_id: currentCard.uniqueCardId,
            card_id: currentCard.cardId,
            power: power ?? null,
            toughness: toughness ?? null
        }, 220);
    }

    function handleResetPowerToughness() {
        if (!currentCard) return;
        performAction('set_power_toughness', {
            unique_id: currentCard.uniqueCardId,
            card_id: currentCard.cardId,
            power: null,
            toughness: null
        }, 220);
    }

    function performAction(action, payload, refreshDelay = 180) {
        if (typeof GameActions === 'undefined' || typeof GameActions.performGameAction !== 'function') {
            console.error('[CardManager] GameActions.performGameAction is not available');
            return;
        }
        try {
            GameActions.performGameAction(action, payload);
        } catch (error) {
            console.error('[CardManager] Failed to perform action', action, error);
            return;
        }
        scheduleRefresh(refreshDelay);
    }

    function scheduleRefresh(delay = 180) {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            refresh();
        }, delay);
    }

    // Export API to window
    const UICardManagerAPI = {
        openTypePopover,
        openCounterPopover,
        openPowerPopover,
        closeAll,
        refresh
    };

    if (typeof window !== 'undefined') {
        window.UICardManager = UICardManagerAPI;
    }

    onDestroy(() => {
        closeAll();
        if (typeof window !== 'undefined' && window.UICardManager === UICardManagerAPI) {
            delete window.UICardManager;
        }
    });
</script>

<CardAddTypePopover {...typeProps()} />
<CardAddCounterPopover {...counterProps()} />
<CardPowerToughnessPopover {...powerProps()} />
