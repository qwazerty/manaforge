/**
 * ManaForge Decision Modal orchestrator
 * Hydrates the DecisionModal Svelte component and bridges it with GameActions.
 */

class UIDecisionModal {
    static _component = null;
    static _target = null;
    static _currentActionType = 'scry';
    static _componentCallbacks = null;

    static show(actionType, cards) {
        if (!cards || cards.length === 0) {
            this.close();
            return;
        }

        const component = this._ensureComponent();
        if (!component) {
            return;
        }

        this._currentActionType = actionType || 'scry';
        component.$set({
            open: true,
            actionType: this._currentActionType,
            cards: [...cards]
        });
    }

    static close() {
        if (this._component) {
            this._component.$set({ open: false, cards: [] });
        }
    }

    static _ensureComponent() {
        if (typeof document === 'undefined') {
            return null;
        }
        if (typeof DecisionModalComponent === 'undefined') {
            console.error('[UIDecisionModal] DecisionModalComponent bundle not loaded');
            return null;
        }

        if (!this._target) {
            this._target = document.createElement('div');
            this._target.id = 'decision-modal-root';
            document.body.appendChild(this._target);
        }

        if (!this._component) {
            const mount = typeof DecisionModalComponent.mount === 'function'
                ? DecisionModalComponent.mount
                : null;
            if (!mount) {
                console.error('[UIDecisionModal] mount helper missing on component');
                return null;
            }

            try {
                this._componentCallbacks = {
                    onConfirm: (detail) => this._handleConfirm(detail?.decisions || []),
                    onAddOneMore: () => this._handleAddOneMore(),
                    onClose: () => this.close()
                };
                this._component = mount(DecisionModalComponent.default, {
                    target: this._target,
                    props: {
                        open: false,
                        actionType: 'scry',
                        cards: [],
                        ...this._componentCallbacks
                    }
                });
            } catch (error) {
                console.error('[UIDecisionModal] Failed to mount component', error);
                this._component = null;
                return null;
            }
        }

        return this._component;
    }

    static _handleConfirm(decisions) {
        if (!Array.isArray(decisions) || decisions.length === 0) {
            this.close();
            return;
        }

        if (
            typeof GameActions !== 'undefined' &&
            GameActions &&
            typeof GameActions.performGameAction === 'function'
        ) {
            GameActions.performGameAction('resolve_temporary_zone', { decisions });
        } else {
            console.error('[UIDecisionModal] GameActions.performGameAction unavailable');
        }
        this.close();
    }

    static _handleAddOneMore() {
        if (
            typeof GameActions !== 'undefined' &&
            GameActions &&
            typeof GameActions.performGameAction === 'function'
        ) {
            GameActions.performGameAction('add_to_temporary_zone', {
                action_name: this._currentActionType,
                count: 1
            });
        } else {
            console.error('[UIDecisionModal] Unable to add card, GameActions missing');
        }
    }
}

window.DecisionModal = UIDecisionModal;
