/**
 * Svelte-backed popovers for card types, counters, and P/T overrides.
 */
class UICardManager {
    static COUNTER_OPTIONS = [
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

    static TYPE_OPTIONS = [
        { value: 'creature', label: 'Creature' },
        { value: 'land', label: 'Land' },
        { value: 'artifact', label: 'Artifact' },
        { value: 'enchantment', label: 'Enchantment' },
        { value: 'planeswalker', label: 'Planeswalker' },
        { value: 'instant', label: 'Instant' },
        { value: 'sorcery', label: 'Sorcery' }
    ];

    static _typeComponent = null;
    static _counterComponent = null;
    static _powerComponent = null;
    static _typeTarget = null;
    static _counterTarget = null;
    static _powerTarget = null;
    static _currentCard = null;
    static _currentCardName = 'Unknown Card';
    static _position = null;
    static _refreshTimer = null;

    // ===== PUBLIC API =====

    static openTypePopover(uniqueCardId, cardId = null, anchorElement = null) {
        this._openPopover('type', uniqueCardId, cardId, anchorElement);
    }

    static openCounterPopover(uniqueCardId, cardId = null, anchorElement = null) {
        this._openPopover('counter', uniqueCardId, cardId, anchorElement);
    }

    static openPowerPopover(uniqueCardId, cardId = null, anchorElement = null) {
        this._openPopover('power', uniqueCardId, cardId, anchorElement);
    }

    static closeAll() {
        this._setOpenState(false, false, false);
        this._currentCard = null;
        this._position = null;
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
    }

    static refresh(uniqueCardId = null, cardId = null) {
        if (!this._currentCard) {
            return;
        }

        const targetUid = uniqueCardId || this._currentCard.uniqueCardId;
        if (targetUid !== this._currentCard.uniqueCardId) {
            return;
        }

        const targetCardId = cardId || this._currentCard.cardId;
        const payload = this._prepareCardPayload(targetUid, targetCardId);
        if (!payload) {
            this.closeAll();
            return;
        }

        this._currentCard = {
            uniqueCardId: payload.uniqueCardId,
            cardId: payload.cardId
        };
        this._currentCardName = payload.cardName;
        this._position = this._calculatePopoverPosition(payload.anchorElement);

        this._updateTypeProps(payload.cardData, false);
        this._updateCounterProps(payload.cardData, false);
        this._updatePowerProps(payload.cardData, false);
    }

    // ===== INTERNAL =====

    static _openPopover(kind, uniqueCardId, cardId = null, anchorElement = null) {
        const payload = this._prepareCardPayload(uniqueCardId, cardId);
        if (!payload) {
            return;
        }

        this._currentCard = {
            uniqueCardId: payload.uniqueCardId,
            cardId: payload.cardId
        };
        this._currentCardName = payload.cardName;
        this._position = this._calculatePopoverPosition(anchorElement || payload.anchorElement);

        const openType = kind === 'type';
        const openCounter = kind === 'counter';
        const openPower = kind === 'power';
        this._setOpenState(openType, openCounter, openPower, payload.cardData);
    }

    static _setOpenState(typeOpen, counterOpen, powerOpen, cardData = null) {
        const data = cardData || this._prepareCardPayload(this._currentCard?.uniqueCardId, this._currentCard?.cardId)?.cardData || {};
        this._updateTypeProps(data, typeOpen);
        this._updateCounterProps(data, counterOpen);
        this._updatePowerProps(data, powerOpen);
    }

    static _updateTypeProps(cardData, openFlag) {
        const component = this._ensureTypeComponent();
        if (!component) return;
        const props = this._buildTypeProps(cardData, openFlag);
        component.$set(props);
    }

    static _updateCounterProps(cardData, openFlag) {
        const component = this._ensureCounterComponent();
        if (!component) return;
        const props = this._buildCounterProps(cardData, openFlag);
        component.$set(props);
    }

    static _updatePowerProps(cardData, openFlag) {
        const component = this._ensurePowerComponent();
        if (!component) return;
        const props = this._buildPowerProps(cardData, openFlag);
        component.$set(props);
    }

    static _ensureTypeComponent() {
        if (typeof document === 'undefined') return null;
        if (typeof CardAddTypePopoverComponent === 'undefined') {
            console.error('[UICardManager] CardAddTypePopoverComponent is not available');
            return null;
        }
        if (!this._typeTarget) {
            this._typeTarget = document.createElement('div');
            this._typeTarget.id = 'card-type-popover-root';
            document.body.appendChild(this._typeTarget);
        }
        if (!this._typeComponent) {
            const mount = typeof CardAddTypePopoverComponent.mount === 'function'
                ? CardAddTypePopoverComponent.mount
                : null;
            if (!mount) {
                console.error('[UICardManager] CardAddTypePopoverComponent.mount missing');
                return null;
            }
            this._typeComponent = mount(CardAddTypePopoverComponent.default, {
                target: this._typeTarget,
                props: { open: false }
            });
        }
        return this._typeComponent;
    }

    static _ensureCounterComponent() {
        if (typeof document === 'undefined') return null;
        if (typeof CardAddCounterPopoverComponent === 'undefined') {
            console.error('[UICardManager] CardAddCounterPopoverComponent is not available');
            return null;
        }
        if (!this._counterTarget) {
            this._counterTarget = document.createElement('div');
            this._counterTarget.id = 'card-counter-popover-root';
            document.body.appendChild(this._counterTarget);
        }
        if (!this._counterComponent) {
            const mount = typeof CardAddCounterPopoverComponent.mount === 'function'
                ? CardAddCounterPopoverComponent.mount
                : null;
            if (!mount) {
                console.error('[UICardManager] CardAddCounterPopoverComponent.mount missing');
                return null;
            }
            this._counterComponent = mount(CardAddCounterPopoverComponent.default, {
                target: this._counterTarget,
                props: { open: false }
            });
        }
        return this._counterComponent;
    }

    static _ensurePowerComponent() {
        if (typeof document === 'undefined') return null;
        if (typeof CardPowerToughnessPopoverComponent === 'undefined') {
            console.error('[UICardManager] CardPowerToughnessPopoverComponent is not available');
            return null;
        }
        if (!this._powerTarget) {
            this._powerTarget = document.createElement('div');
            this._powerTarget.id = 'card-power-popover-root';
            document.body.appendChild(this._powerTarget);
        }
        if (!this._powerComponent) {
            const mount = typeof CardPowerToughnessPopoverComponent.mount === 'function'
                ? CardPowerToughnessPopoverComponent.mount
                : null;
            if (!mount) {
                console.error('[UICardManager] CardPowerToughnessPopoverComponent.mount missing');
                return null;
            }
            this._powerComponent = mount(CardPowerToughnessPopoverComponent.default, {
                target: this._powerTarget,
                props: { open: false }
            });
        }
        return this._powerComponent;
    }

    static _buildTypeProps(cardData, open) {
        const target = this._currentCard || {};
        return {
            open,
            cardName: this._currentCardName || 'Unknown Card',
            cardId: target.cardId || '',
            uniqueId: target.uniqueCardId || '',
            types: this._getCustomTypes(cardData),
            typeOptions: this.TYPE_OPTIONS,
            position: this._position,
            onClose: () => this.closeAll(),
            onAddType: (type) => this._handleAddType(type),
            onRemoveType: (type) => this._handleRemoveType(type),
            onResetTypes: () => this._handleResetTypes()
        };
    }

    static _buildCounterProps(cardData, open) {
        const target = this._currentCard || {};
        return {
            open,
            cardName: this._currentCardName || 'Unknown Card',
            cardId: target.cardId || '',
            uniqueId: target.uniqueCardId || '',
            counters: this._buildCounterEntries(cardData),
            counterOptions: this.COUNTER_OPTIONS,
            position: this._position,
            onClose: () => this.closeAll(),
            onModifyCounter: (type, delta) => this._handleModifyCounter(type, delta),
            onRemoveAllCounters: (type) => this._handleRemoveAllCounters(type),
            onAddCounter: (type, amount) => this._handleAddCounter(type, amount)
        };
    }

    static _buildPowerProps(cardData, open) {
        const target = this._currentCard || {};
        return {
            open,
            cardName: this._currentCardName || 'Unknown Card',
            cardId: target.cardId || '',
            uniqueId: target.uniqueCardId || '',
            powerToughness: this._buildPowerToughness(cardData),
            position: this._position,
            onClose: () => this.closeAll(),
            onApply: (power, toughness) => this._handleApplyPowerToughness(power, toughness),
            onReset: () => this._handleResetPowerToughness()
        };
    }

    static _prepareCardPayload(uniqueCardId, cardId = null) {
        if (!uniqueCardId || typeof document === 'undefined') {
            return null;
        }

        const element = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (!element) {
            return null;
        }

        const rawData = element.getAttribute('data-card-data') || '{}';
        let cardData = {};
        try {
            const normalized = rawData
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            cardData = JSON.parse(normalized);
        } catch (error) {
            console.warn('[UICardManager] Failed to parse card data from element', error);
        }

        const resolvedCardId = cardId ||
            cardData.id ||
            cardData.card_id ||
            element.getAttribute('data-card-id') ||
            null;
        const resolvedName = cardData.name ||
            element.getAttribute('data-card-name') ||
            'Unknown Card';

        return {
            uniqueCardId,
            cardId: resolvedCardId,
            cardName: resolvedName,
            cardData,
            anchorElement: element
        };
    }

    static _calculatePopoverPosition(anchorElement = null) {
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

    static _getCustomTypes(cardData) {
        if (typeof GameCards !== 'undefined' && typeof GameCards.getCustomTypes === 'function') {
            return GameCards.getCustomTypes(cardData);
        }
        return [];
    }

    static _resolveCounterIcon(counterType) {
        if (typeof GameCards !== 'undefined' && typeof GameCards.getCounterIcon === 'function') {
            const direct = GameCards.getCounterIcon(counterType);
            if (direct) {
                return direct;
            }
            const lower = typeof counterType === 'string' ? counterType.toLowerCase() : counterType;
            if (lower) {
                return GameCards.getCounterIcon(lower) || null;
            }
        }
        return null;
    }

    static _buildCounterEntries(cardData) {
        const counters = cardData && typeof cardData === 'object'
            ? cardData.counters || {}
            : {};
        return Object.entries(counters)
            .filter(([, count]) => Number(count) > 0)
            .map(([type, amount]) => ({
                type,
                amount,
                label: this._formatCounterLabel(type),
                icon: this._resolveCounterIcon(type)
            }));
    }

    static _formatCounterLabel(counterType) {
        if (!counterType) {
            return 'Counter';
        }
        const text = String(counterType);
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    static _buildPowerToughness(cardData) {
        const basePower = cardData?.power !== undefined && cardData.power !== null
            ? String(cardData.power)
            : '';
        const baseToughness = cardData?.toughness !== undefined && cardData.toughness !== null
            ? String(cardData.toughness)
            : '';

        const overridePower = cardData?.current_power ?? cardData?.currentPower ??
            cardData?.power_override ?? cardData?.powerOverride ?? '';
        const overrideToughness = cardData?.current_toughness ?? cardData?.currentToughness ??
            cardData?.toughness_override ?? cardData?.toughnessOverride ?? '';

        const hasBaseStat = Boolean(basePower || baseToughness);
        const hasOverride = Boolean(overridePower || overrideToughness);
        const typeLine = String(cardData?.type_line || cardData?.typeLine || '').toLowerCase();
        const isCreature = (typeof cardData?.card_type === 'string' && cardData.card_type.toLowerCase().includes('creature'))
            || typeLine.includes('creature');

        if (!hasBaseStat && !hasOverride && !isCreature) {
            return null;
        }

        const stats = typeof GameCards !== 'undefined' && typeof GameCards.computeEffectivePowerToughness === 'function'
            ? GameCards.computeEffectivePowerToughness(cardData)
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

    // ===== ACTION HANDLERS =====

    static _handleAddType(cardType) {
        const target = this._currentCard;
        if (!target || !cardType) {
            GameUI?.logMessage?.('Select a type to add', 'warning');
            return;
        }
        this._performAction('add_custom_type', {
            unique_id: target.uniqueCardId,
            card_id: target.cardId,
            card_type: cardType
        });
    }

    static _handleRemoveType(cardType) {
        const target = this._currentCard;
        if (!target || !cardType) {
            return;
        }
        this._performAction('remove_custom_type', {
            unique_id: target.uniqueCardId,
            card_id: target.cardId,
            card_type: cardType
        });
    }

    static _handleResetTypes() {
        const target = this._currentCard;
        if (!target) {
            return;
        }
        this._performAction('set_custom_type', {
            unique_id: target.uniqueCardId,
            card_id: target.cardId,
            card_type: null
        });
    }

    static _handleModifyCounter(counterType, delta) {
        const target = this._currentCard;
        if (!target || !counterType || !Number.isFinite(delta)) {
            return;
        }
        if (delta > 0) {
            this._performAction('add_counter', {
                unique_id: target.uniqueCardId,
                card_id: target.cardId,
                counter_type: counterType,
                amount: delta
            }, 120);
        } else {
            this._performAction('remove_counter', {
                unique_id: target.uniqueCardId,
                card_id: target.cardId,
                counter_type: counterType,
                amount: Math.abs(delta)
            }, 120);
        }
    }

    static _handleRemoveAllCounters(counterType) {
        const target = this._currentCard;
        if (!target || !counterType) {
            return;
        }
        this._performAction('set_counter', {
            unique_id: target.uniqueCardId,
            card_id: target.cardId,
            counter_type: counterType,
            amount: 0
        });
    }

    static _handleAddCounter(counterType, amount) {
        const target = this._currentCard;
        const normalizedType = typeof counterType === 'string' ? counterType.trim() : '';
        if (!target || !normalizedType) {
            GameUI?.logMessage?.('Select or enter a counter type', 'warning');
            return;
        }
        const parsedAmount = parseInt(amount, 10);
        const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;
        this._performAction('add_counter', {
            unique_id: target.uniqueCardId,
            card_id: target.cardId,
            counter_type: normalizedType,
            amount: safeAmount
        }, 160);
    }

    static _handleApplyPowerToughness(power, toughness) {
        const target = this._currentCard;
        if (!target) {
            return;
        }
        this._performAction('set_power_toughness', {
            unique_id: target.uniqueCardId,
            card_id: target.cardId,
            power: power ?? null,
            toughness: toughness ?? null
        }, 220);
    }

    static _handleResetPowerToughness() {
        const target = this._currentCard;
        if (!target) {
            return;
        }
        this._performAction('set_power_toughness', {
            unique_id: target.uniqueCardId,
            card_id: target.cardId,
            power: null,
            toughness: null
        }, 220);
    }

    static _performAction(action, payload, refreshDelay = 180) {
        if (typeof GameActions === 'undefined' || typeof GameActions.performGameAction !== 'function') {
            console.error('[UICardManager] GameActions.performGameAction is not available');
            return;
        }
        try {
            GameActions.performGameAction(action, payload);
        } catch (error) {
            console.error('[UICardManager] Failed to perform action', action, error);
            return;
        }
        this._scheduleRefresh(refreshDelay);
    }

    static _scheduleRefresh(delay = 180) {
        if (this._refreshTimer) {
            clearTimeout(this._refreshTimer);
        }
        this._refreshTimer = setTimeout(() => {
            this._refreshTimer = null;
            this.refresh();
        }, delay);
    }
}

window.UICardManager = UICardManager;
