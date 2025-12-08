<script>
    import { onMount } from 'svelte';
    import { DeckStorage } from '@lib/deck-storage';

    const LIMITED_FORMATS = ['draft', 'sealed', 'cube'];
    const FORMAT_OPTIONS = [
        { key: 'standard', label: 'Standard' },
        { key: 'modern', label: 'Modern' },
        { key: 'pioneer', label: 'Pioneer' },
        { key: 'pauper', label: 'Pauper' },
        { key: 'legacy', label: 'Legacy' },
        { key: 'vintage', label: 'Vintage' },
        { key: 'duel_commander', label: 'Duel Commander' },
        { key: 'commander_multi', label: 'Commander Multi' },
        { key: 'draft', label: 'Draft' },
        { key: 'sealed', label: 'Sealed' },
        { key: 'cube', label: 'Cube' }
    ];

    let decks = $state([]);
    let lastUpdate = $state('—');
    let selectedFormat = $state('all');

    onMount(() => {
        loadDecks();
    });

    function loadDecks() {
        const baseDecks = DeckStorage.list();
        const loaded = Array.isArray(baseDecks) ? [...baseDecks] : [];
        loaded.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        decks = loaded;
        
        const latest = decks.length ? decks[0] : null;
        lastUpdate = latest ? formatTimestamp(latest.updatedAt) : '—';

        if (selectedFormat !== 'all') {
            const hasSelection = loaded.some((deck) => normalizeFormat(deck.format) === selectedFormat);
            if (!hasSelection) {
                selectedFormat = 'all';
            }
        }
    }

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

    function getSubtitleParts(deck) {
        const mainCount = getCardCount(deck.state, ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands']);
        const sideCount = getCardCount(deck.state, ['sideboard']);
        const commanderCount = getCardCount(deck.state, ['commander']);
        
        return [
            deck.format ? deck.format.toUpperCase() : 'UNKNOWN',
            `${mainCount} main`,
            `${sideCount} side`,
            commanderCount ? `${commanderCount} commander` : null
        ].filter(Boolean).join(' • ');
    }

    function handleDuplicate(deckId) {
        DeckStorage.duplicate(deckId);
        loadDecks();
    }

    function handleDelete(deckId) {
        if (confirm('Delete this saved deck? This cannot be undone.')) {
            DeckStorage.remove(deckId);
            loadDecks();
        }
    }

    const formatCounts = $derived.by(() => {
        const counts = {};
        decks.forEach((deck) => {
            const key = normalizeFormat(deck.format || deck.state?.format) || 'unknown';
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    });

    const filteredDecks = $derived.by(() => {
        if (selectedFormat === 'all') return decks;
        return decks.filter(
            (deck) => normalizeFormat(deck.format || deck.state?.format) === selectedFormat
        );
    });

    const limitedDeckCount = $derived(
        decks.filter((deck) =>
            LIMITED_FORMATS.includes(normalizeFormat(deck.format || deck.state?.format))
        ).length
    );

    function normalizeFormat(rawFormat) {
        return (rawFormat || '').toString().toLowerCase();
    }

    function formatLabel(key) {
        const match = FORMAT_OPTIONS.find((entry) => entry.key === key);
        if (match?.label) return match.label;
        return key ? key.toUpperCase() : 'UNKNOWN';
    }

    function handleFormatChange(event) {
        selectedFormat = event?.target?.value || 'all';
    }

    function handleDeleteLimited() {
        if (!limitedDeckCount) return;
        if (confirm(`Delete all limited decks (${limitedDeckCount})? This cannot be undone.`)) {
            DeckStorage.removeLimited();
            loadDecks();
        }
    }
</script>

<section class="arena-card rounded-xl p-6 space-y-6 animate-slide-up">
    <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
            <p class="text-sm uppercase tracking-wide text-arena-muted">Saved decks</p>
            <h2 class="text-2xl font-semibold text-white flex items-center gap-2">
                <span>{decks.length}</span>
                <span class="text-base font-normal text-arena-text-dim">entries</span>
            </h2>
        </div>
        <div class="text-sm text-arena-text-dim">
            <span class="block">Last update:</span>
            <span class="text-white/70">{lastUpdate}</span>
        </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm">
            <label for="format-filter" class="text-arena-text-dim">Format</label>
            <select
                id="format-filter"
                bind:value={selectedFormat}
                onchange={handleFormatChange}
                class="px-3 py-2 bg-arena-surface border border-arena-accent/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-arena-accent/30 text-arena-text"
            >
                <option value="all">All formats ({decks.length})</option>
                {#each FORMAT_OPTIONS as formatKey (formatKey.key)}
                    <option value={formatKey.key}>
                        {formatLabel(formatKey.key)} ({formatCounts[formatKey.key] || 0})
                    </option>
                {/each}
            </select>
        </div>
        <div class="flex items-center gap-3">
            <span class="text-xs text-arena-text-dim">
                Showing {filteredDecks.length} / {decks.length}
            </span>
            <button
                class="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={handleDeleteLimited}
                disabled={!limitedDeckCount}
            >
                🗑️ Delete all limited decks
            </button>
        </div>
    </div>

    {#if decks.length === 0}
        <div class="text-center text-arena-muted py-10 border border-dashed border-arena-accent/30 rounded-lg">
            <p class="text-lg font-semibold mb-2">No decks saved yet</p>
            <p class="text-sm">Create a new deck or import one from the draft room to start building.</p>
        </div>
    {:else if filteredDecks.length === 0}
        <div class="text-center text-arena-muted py-10 border border-dashed border-arena-accent/30 rounded-lg">
            <p class="text-lg font-semibold mb-2">No decks match this format</p>
            <p class="text-sm">Try switching filters to view other saved decks.</p>
        </div>
    {:else}
        <div class="grid gap-4 md:grid-cols-2">
            {#each filteredDecks as deck (deck.id)}
                <div class="bg-arena-surface/70 border border-arena-accent/10 rounded-xl p-4 flex flex-col gap-4">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <h3 class="text-xl font-semibold text-white">{deck.name || 'Untitled Deck'}</h3>
                            <p class="text-sm text-arena-text-dim">{getSubtitleParts(deck)}</p>
                        </div>
                        <div class="text-xs text-arena-text-dim text-right whitespace-nowrap">
                            <span class="block uppercase tracking-wide">Updated</span>
                            <span>{formatTimestamp(deck.updatedAt)}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <a href="/decks/builder?deckId={encodeURIComponent(deck.id)}" class="arena-button px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-1">
                            <span>✏️</span>Open
                        </a>
                        <button 
                            class="px-4 py-2 rounded-lg border border-arena-accent/30 hover:border-arena-accent transition text-sm flex items-center gap-1"
                            onclick={() => handleDuplicate(deck.id)}
                        >
                            <span>🧬</span>Duplicate
                        </button>
                        <button 
                            class="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition text-sm flex items-center gap-1"
                            onclick={() => handleDelete(deck.id)}
                        >
                            <span>🗑️</span>Delete
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</section>
