/**
 * Manage player-level counters (poison, charge, etc.)
 */
class UIPlayerCounters {
    static renderCounterBadges(playerData = {}, playerId = null) {
        const entries = this._getCounterEntries(playerData);

        return `
            <div class="player-counter-badges flex flex-wrap gap-2">
                ${entries.map(([type, amount]) => {
                    const icon = this._getCounterIcon(type);
                    const label = this._formatCounterLabel(type);
                    return `
                        <span class="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-arena-accent/40 bg-arena-surface/60 text-xs text-arena-text player-counter-chip">
                            ${icon ? `<span class="text-base">${icon}</span>` : ''}
                            <span class="uppercase tracking-wide text-[10px] text-arena-muted">${label}</span>
                            <span class="font-semibold text-arena-accent">${amount}</span>
                        </span>
                    `;
                }).join('')}
            </div>
        `;
    }

    static openCounterManager(playerId) {
        if (!playerId) {
            return;
        }

        const existing = document.getElementById('player-counter-modal');
        if (existing) {
            existing.remove();
        }

        const playerData = this._findPlayerData(playerId);
        const displayName = (typeof GameCore !== 'undefined' && typeof GameCore.getPlayerDisplayName === 'function')
            ? GameCore.getPlayerDisplayName(playerId, playerId)
            : playerId;

        const modal = document.createElement('div');
        modal.id = 'player-counter-modal';
        modal.dataset.playerId = playerId;
        modal.className = 'counter-modal';
        modal.innerHTML = `
            <div class="counter-modal-content max-w-xl w-full">
                <div class="counter-modal-header">
                    <h3>Compteurs - ${this._escape(displayName)}</h3>
                    <button class="counter-modal-close" onclick="UIPlayerCounters.closeModal()">&times;</button>
                </div>
                <div class="counter-modal-body">
                    ${this._generateModalBody(playerData, playerId)}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }

    static closeModal() {
        const modal = document.getElementById('player-counter-modal');
        if (modal) {
            modal.remove();
        }
    }

    static addCounterFromModal(playerId) {
        const typeInput = document.getElementById(`player-counter-type-${playerId}`);
        const amountInput = document.getElementById(`player-counter-amount-${playerId}`);

        if (!typeInput || !amountInput) {
            return;
        }

        const counterType = typeInput.value.trim();
        const amount = parseInt(amountInput.value, 10) || 1;
        if (!counterType) {
            GameUI.showNotification('Indiquer un type de compteur', 'warning');
            return;
        }

        GameActions.modifyPlayerCounter(playerId, counterType, amount);
        setTimeout(() => this.refreshModal(playerId), 200);
    }

    static modifyCounter(playerId, counterType, delta) {
        GameActions.modifyPlayerCounter(playerId, counterType, delta);
        setTimeout(() => this.refreshModal(playerId), 200);
    }

    static removeCounter(playerId, counterType) {
        GameActions.setPlayerCounter(playerId, counterType, 0);
        setTimeout(() => this.refreshModal(playerId), 200);
    }

    static refreshModal(playerId = null) {
        const modal = document.getElementById('player-counter-modal');
        if (!modal) {
            return;
        }
        const targetPlayerId = playerId || modal.dataset.playerId;
        if (!targetPlayerId) {
            return;
        }

        const body = modal.querySelector('.counter-modal-body');
        if (!body) {
            return;
        }

        const playerData = this._findPlayerData(targetPlayerId);
        body.innerHTML = this._generateModalBody(playerData, targetPlayerId);
    }

    static _generateModalBody(playerData, playerId) {
        const entries = this._getCounterEntries(playerData);
        const listHtml = entries.length
            ? `
                <div class="space-y-2">
                    ${entries.map(([type, amount]) => {
                        const icon = this._getCounterIcon(type);
                        const label = this._formatCounterLabel(type);
                        const jsType = JSON.stringify(type);
                        return `
                            <div class="flex items-center justify-between border border-arena-accent/30 rounded-lg px-3 py-2 bg-arena-surface/70">
                                <div class="flex items-center gap-3">
                                    ${icon ? `<span class="text-xl">${icon}</span>` : ''}
                                    <div>
                                        <div class="text-sm font-semibold text-arena-text">${label}</div>
                                        <div class="text-xs text-arena-muted">${this._escape(type)}</div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button class="px-2 py-1 rounded bg-red-500/30 text-sm"
                                        onclick='UIPlayerCounters.modifyCounter(${JSON.stringify(playerId)}, ${jsType}, -1)'>-</button>
                                    <span class="text-lg font-bold text-arena-accent">${amount}</span>
                                    <button class="px-2 py-1 rounded bg-green-500/30 text-sm"
                                        onclick='UIPlayerCounters.modifyCounter(${JSON.stringify(playerId)}, ${jsType}, 1)'>+</button>
                                    <button class="px-2 py-1 rounded bg-arena-surface-light text-xs"
                                        onclick='UIPlayerCounters.removeCounter(${JSON.stringify(playerId)}, ${jsType})'>Reinitialiser</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `
            : '<p class="text-sm text-arena-muted">Aucun compteur pour ce joueur.</p>';

        return `
            <section class="player-counter-manager">
                <h4 class="text-sm font-semibold uppercase tracking-wide text-arena-muted mb-2">Compteurs actifs</h4>
                ${listHtml}
            </section>
            <section class="player-counter-manager mt-4">
                <h4 class="text-sm font-semibold uppercase tracking-wide text-arena-muted mb-2">Ajouter un compteur</h4>
                <div class="grid gap-2">
                    <input type="text" id="player-counter-type-${playerId}" class="w-full rounded-lg border border-arena-accent/30 bg-arena-surface-light px-3 py-2 text-sm text-arena-text" placeholder="Poison, charge..." maxlength="30">
                    <div class="flex gap-2">
                        <input type="number" id="player-counter-amount-${playerId}" class="w-24 rounded-lg border border-arena-accent/30 bg-arena-surface-light px-3 py-2 text-sm text-arena-text" value="1" min="1" step="1">
                        <button class="flex-1 bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-50 rounded-lg px-3 py-2"
                            onclick='UIPlayerCounters.addCounterFromModal(${JSON.stringify(playerId)})'>Ajouter</button>
                    </div>
                </div>
            </section>
        `;
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

    static _escape(value) {
        if (typeof GameUtils !== 'undefined' && typeof GameUtils.escapeHtml === 'function') {
            return GameUtils.escapeHtml(value);
        }
        return value;
    }
}

window.UIPlayerCounters = UIPlayerCounters;
