(function() {
    const selectors = {
        grid: document.getElementById('deck-library-grid'),
        emptyState: document.getElementById('deck-library-empty'),
        count: document.getElementById('deck-library-count'),
        lastEdit: document.getElementById('deck-library-last-edit')
    };

    function formatTimestamp(isoString) {
        if (!isoString) return '—';
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function getCardCount(state, keys) {
        if (!state || !state.columns || !state.entries) return 0;
        const entries = state.entries;
        return keys.reduce((total, key) => {
            const columnEntries = state.columns[key] || [];
            return total + columnEntries.reduce((sum, entryId) => {
                const entry = entries[entryId];
                return sum + (entry?.quantity || 0);
            }, 0);
        }, 0);
    }

    function getLegacyDeck() {
        try {
            const raw = localStorage.getItem('manaforge:deck-manager:v1');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const state = parsed && typeof parsed === 'object' && parsed.state
                ? parsed.state
                : parsed;
            if (!state || typeof state !== 'object') return null;
            if (!state.entries || !Object.keys(state.entries).length) {
                return null;
            }
            return {
                id: parsed.deckId || 'local-deck',
                name: state.deckName || 'Unsaved Deck',
                format: state.format || 'modern',
                state,
                updatedAt: parsed.updatedAt || new Date().toISOString(),
                _legacy: true
            };
        } catch (error) {
            console.warn('Unable to load legacy deck', error);
            return null;
        }
    }

    function createDeckCard(deck) {
        const wrapper = document.createElement('div');
        wrapper.className = 'bg-arena-surface/70 border border-arena-accent/10 rounded-xl p-4 flex flex-col gap-4';
        wrapper.dataset.deckId = deck.id;

        const mainCount = getCardCount(deck.state, ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands']);
        const sideCount = getCardCount(deck.state, ['sideboard']);
        const commanderCount = getCardCount(deck.state, ['commander']);
        const subtitleParts = [
            deck.format ? deck.format.toUpperCase() : 'UNKNOWN',
            `${mainCount} main`,
            `${sideCount} side`,
            commanderCount ? `${commanderCount} commander` : null
        ].filter(Boolean);

        const isLegacy = Boolean(deck._legacy);
        wrapper.innerHTML = `
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-xl font-semibold text-white">${deck.name || 'Untitled Deck'}</h3>
                    <p class="text-sm text-arena-text-dim">${subtitleParts.join(' • ')}</p>
                </div>
                <div class="text-xs text-arena-text-dim text-right whitespace-nowrap">
                    <span class="block uppercase tracking-wide">Updated</span>
                    <span>${formatTimestamp(deck.updatedAt)}</span>
                </div>
            </div>
            <div class="flex flex-wrap gap-2">
                <a href="/decks/builder?deckId=${encodeURIComponent(deck.id)}" class="arena-button px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-1">
                    <span>✏️</span>${isLegacy ? 'Resume deck' : 'Open'}
                </a>
                ${isLegacy ? `
                    <span class="text-xs text-arena-text-dim">Save the deck from the builder to add it to your library.</span>
                ` : `
                    <button class="px-4 py-2 rounded-lg border border-arena-accent/30 hover:border-arena-accent transition text-sm flex items-center gap-1" data-action="duplicate" data-deck-id="${deck.id}">
                        <span>🧬</span>Duplicate
                    </button>
                    <button class="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition text-sm flex items-center gap-1" data-action="delete" data-deck-id="${deck.id}">
                        <span>🗑️</span>Delete
                    </button>
                `}
            </div>
        `;

        return wrapper;
    }

    function renderLibrary() {
        if (!selectors.grid) {
            return;
        }
        const baseDecks = window.DeckLibrary ? window.DeckLibrary.list() : [];
        const decks = Array.isArray(baseDecks) ? [...baseDecks] : [];
        const legacyDeck = getLegacyDeck();
        if (legacyDeck && !decks.find((deck) => deck.id === legacyDeck.id)) {
            decks.unshift(legacyDeck);
        }
        selectors.grid.innerHTML = '';

        if (Array.isArray(decks) && decks.length) {
            decks
                .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
                .forEach((deck) => {
                    selectors.grid.appendChild(createDeckCard(deck));
                });
            selectors.emptyState?.classList.add('hidden');
        } else {
            selectors.emptyState?.classList.remove('hidden');
        }

        if (selectors.count) {
            selectors.count.textContent = Array.isArray(decks) ? decks.length : 0;
        }
        if (selectors.lastEdit) {
            const latest = decks?.length ? decks[0] : null;
            selectors.lastEdit.textContent = latest ? formatTimestamp(latest.updatedAt) : '—';
        }
    }

    function handleGridClick(event) {
        const actionButton = event.target.closest('button[data-action]');
        if (!actionButton || !window.DeckLibrary) return;
        const deckId = actionButton.dataset.deckId;
        if (!deckId) return;
        const action = actionButton.dataset.action;
        if (action === 'duplicate') {
            window.DeckLibrary.duplicate(deckId);
            renderLibrary();
        } else if (action === 'delete') {
            if (confirm('Delete this saved deck? This cannot be undone.')) {
                window.DeckLibrary.remove(deckId);
                renderLibrary();
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderLibrary();
        selectors.grid?.addEventListener('click', handleGridClick);
    });
})();
