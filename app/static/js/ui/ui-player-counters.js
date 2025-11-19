/**
 * Manage player-level counters (poison, charge, etc.)
 */
class UIPlayerCounters {
    static _modalComponent = null;
    static _modalTarget = null;
    static _modalPlayerId = null;
    static _modalPosition = null;

    static getBadgeEntries(playerData = {}) {
        return this._getCounterEntries(playerData).map(([type, amount]) => ({
            type,
            amount,
            label: this._formatCounterLabel(type),
            icon: this._getCounterIcon(type)
        }));
    }

    static openCounterManager(playerId, anchorElement = null) {
        if (!playerId) {
            return;
        }

        const component = this._ensureModalComponent();
        if (!component) {
            return;
        }

        this._modalPlayerId = playerId;
        this._modalPosition = this._calculatePopoverPosition(anchorElement);
        component.$set(this._buildModalProps(playerId, true, this._modalPosition));
    }

    static closeModal() {
        const component = this._ensureModalComponent();
        if (component) {
            component.$set({ open: false });
        }
        this._modalPlayerId = null;
        this._modalPosition = null;
    }

    static refreshModal(playerId = null) {
        if (!this._modalComponent || !this._modalPlayerId) {
            return;
        }
        const targetId = playerId || this._modalPlayerId;
        if (targetId !== this._modalPlayerId) {
            return;
        }
        this._modalComponent.$set(this._buildModalProps(targetId, true, this._modalPosition));
    }

    static _ensureModalComponent() {
        if (typeof document === 'undefined') {
            return null;
        }
        if (typeof PlayerCounterModalComponent === 'undefined') {
            console.error('[UIPlayerCounters] PlayerCounterModalComponent is not available');
            return null;
        }
        if (!this._modalTarget) {
            this._modalTarget = document.createElement('div');
            this._modalTarget.id = 'player-counter-modal-root';
            document.body.appendChild(this._modalTarget);
        }
        if (!this._modalComponent) {
            const mount = typeof PlayerCounterModalComponent.mount === 'function'
                ? PlayerCounterModalComponent.mount
                : null;
            if (!mount) {
                console.error('[UIPlayerCounters] PlayerCounterModalComponent.mount missing');
                return null;
            }
            this._modalComponent = mount(PlayerCounterModalComponent.default, {
                target: this._modalTarget,
                props: { open: false }
            });
        }
        return this._modalComponent;
    }

    static _buildModalProps(playerId, open = false, positionOverride = null) {
        const playerData = this._findPlayerData(playerId);
        const counters = this.getBadgeEntries(playerData);
        const { addButtonClass, decrementButtonClass, incrementButtonClass, resetButtonClass } = this._getButtonClasses();
        const position = positionOverride || this._calculatePopoverPosition();

        return {
            open,
            playerId,
            playerName: this._getPlayerDisplayName(playerId),
            counters,
            amountInputMin: 1,
            amountInputStep: 1,
            addButtonClass,
            decrementButtonClass,
            incrementButtonClass,
            resetButtonClass,
            position,
            onClose: () => this.closeModal(),
            onModify: (type, delta) => this._handleModify(playerId, type, delta),
            onRemove: (type) => this._handleRemove(playerId, type),
            onAdd: (type, amount) => this._handleAdd(playerId, type, amount)
        };
    }

    static _calculatePopoverPosition(anchorElement = null) {
        if (!UIUtils || typeof UIUtils.calculateAnchorPosition !== 'function') {
            return { top: 200, left: 200, anchor: 'center' };
        }

        return UIUtils.calculateAnchorPosition(anchorElement, {
            preferredAnchor: anchorElement ? 'bottom-left' : 'center',
            panelWidth: 420,
            panelHeight: 460,
            verticalOffset: 4,
            horizontalOffset: 4
        });
    }

    static _handleModify(playerId, counterType, delta) {
        if (!playerId || !counterType || !Number.isFinite(delta)) {
            return;
        }
        GameActions.modifyPlayerCounter(playerId, counterType, delta);
        setTimeout(() => this.refreshModal(playerId), 200);
    }

    static _handleRemove(playerId, counterType) {
        if (!playerId || !counterType) {
            return;
        }
        GameActions.setPlayerCounter(playerId, counterType, 0);
        setTimeout(() => this.refreshModal(playerId), 200);
    }

    static _handleAdd(playerId, counterType, amount) {
        const normalizedType = typeof counterType === 'string' ? counterType.trim() : '';
        if (!playerId || !normalizedType) {
            GameUI.logMessage('Indiquer un type de compteur', 'warning');
            return;
        }
        const parsedAmount = parseInt(amount, 10);
        const safeAmount = Number.isFinite(parsedAmount) && parsedAmount !== 0 ? parsedAmount : 1;
        GameActions.modifyPlayerCounter(playerId, normalizedType, safeAmount);
        setTimeout(() => this.refreshModal(playerId), 200);
    }

    static _findPlayerData(playerId) {
        if (typeof GameCore === 'undefined' || typeof GameCore.getGameState !== 'function') {
            return null;
        }
        const state = GameCore.getGameState() || {};
        const players = Array.isArray(state.players) ? state.players : [];
        return players.find((player) => player && player.id === playerId) || null;
    }

    static _getCounterEntries(playerData) {
        if (!playerData || typeof playerData !== 'object') {
            return [];
        }
        const counters = playerData.counters || {};
        return Object.entries(counters)
            .filter(([, value]) => Number(value) > 0)
            .sort(([a], [b]) => a.localeCompare(b));
    }

    static _getButtonClasses() {
        const buttonConfig = UIConfig?.CSS_CLASSES?.button || {};
        const life = buttonConfig.life || {};
        return {
            addButtonClass: `${life.green || 'bg-green-500/20 border border-green-500/50 text-green-200 rounded px-3 py-2 text-xs font-semibold'} w-full text-center uppercase tracking-wide`,
            decrementButtonClass: life.red || 'bg-red-500/20 border border-red-500/50 text-red-200 rounded px-2 py-1 text-xs font-semibold',
            incrementButtonClass: life.green || 'bg-green-500/20 border border-green-500/50 text-green-200 rounded px-2 py-1 text-xs font-semibold',
            resetButtonClass: `${buttonConfig.secondary || 'bg-arena-surface border border-arena-accent/30 text-arena-text rounded'} text-xs px-3 py-2`
        };
    }

    static _formatCounterLabel(counterType) {
        if (!counterType) {
            return 'Compteur';
        }
        const lower = String(counterType).toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }

    static _getCounterIcon(counterType) {
        if (typeof GameCards !== 'undefined' && typeof GameCards.getCounterIcon === 'function') {
            const byOriginal = GameCards.getCounterIcon(counterType);
            if (byOriginal) {
                return byOriginal;
            }
            const lower = typeof counterType === 'string' ? counterType.toLowerCase() : counterType;
            if (lower) {
                return GameCards.getCounterIcon(lower) || null;
            }
        }
        return null;
    }

    static _getPlayerDisplayName(playerId) {
        if (
            typeof GameCore !== 'undefined' &&
            typeof GameCore.getPlayerDisplayName === 'function'
        ) {
            return GameCore.getPlayerDisplayName(playerId, playerId);
        }
        return playerId;
    }
}

window.UIPlayerCounters = UIPlayerCounters;
